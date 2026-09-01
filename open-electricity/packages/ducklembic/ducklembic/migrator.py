import hashlib
import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple, Union

from ducklembic.connection import DuckDB


@dataclass
class MigrationRecord:
    version: str
    name: str
    checksum: str
    applied_at: datetime
    duration_ms: int


@dataclass
class MigrationFile:
    version: str
    name: str
    up_path: Path
    down_path: Optional[Path]
    checksum: str


@dataclass
class MigrationStatus:
    applied: List[MigrationRecord]
    pending: List[MigrationFile]
    current_version: Optional[str]


def compute_checksum(content: str) -> str:
    # Normalize line endings before hashing
    normalized = content.replace("\r\n", "\n")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class Migrator:
    """
    Applies and tracks versioned SQL migrations for DuckDB and MotherDuck.
    """

    TABLE_NAME = "_ducklembic_migrations"

    def __init__(self, db: DuckDB, migrations_dir: Union[str, Path]):
        self.db = db
        self.migrations_dir = Path(migrations_dir)

    def init(self) -> None:
        """Creates the migration tracking table if it does not exist."""
        self.migrations_dir.mkdir(parents=True, exist_ok=True)
        self.db.execute(f"""
            CREATE TABLE IF NOT EXISTS {self.TABLE_NAME} (
                version     VARCHAR NOT NULL PRIMARY KEY,
                name        VARCHAR NOT NULL,
                checksum    VARCHAR NOT NULL,
                applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                duration_ms INTEGER
            );
        """)

    def get_migration_files(self) -> List[MigrationFile]:
        """Scans the migrations directory for *.up.sql files sorted by version."""
        if not self.migrations_dir.exists():
            return []

        files: List[MigrationFile] = []
        pattern = re.compile(r"^(\d+)[-_](.+)\.up\.sql$")

        for p in sorted(self.migrations_dir.glob("*.up.sql")):
            match = pattern.match(p.name)
            if not match:
                continue
            version, raw_name = match.groups()
            content = p.read_text(encoding="utf-8")
            checksum = compute_checksum(content)

            # Check for down migration
            down_path = self.migrations_dir / f"{version}_{raw_name}.down.sql"
            if not down_path.exists():
                down_alt = self.migrations_dir / f"{version}-{raw_name}.down.sql"
                down_path = down_alt if down_alt.exists() else None

            files.append(
                MigrationFile(
                    version=version,
                    name=raw_name,
                    up_path=p,
                    down_path=down_path,
                    checksum=checksum,
                )
            )

        return sorted(files, key=lambda f: f.version)

    def get_applied_migrations(self) -> List[MigrationRecord]:
        """Returns all applied migrations from the database ordered by version."""
        self.init()
        rows = self.db.fetchall(
            f"SELECT version, name, checksum, applied_at, duration_ms FROM {self.TABLE_NAME} ORDER BY version ASC"
        )
        records = []
        for r in rows:
            applied_at = r[3]
            if isinstance(applied_at, str):
                try:
                    applied_at = datetime.fromisoformat(applied_at)
                except ValueError:
                    applied_at = datetime.now()
            records.append(
                MigrationRecord(
                    version=str(r[0]),
                    name=str(r[1]),
                    checksum=str(r[2]),
                    applied_at=applied_at,
                    duration_ms=int(r[4] or 0),
                )
            )
        return records

    def status(self) -> MigrationStatus:
        """Returns applied, pending, and current version."""
        applied = self.get_applied_migrations()
        applied_versions = {a.version for a in applied}

        all_files = self.get_migration_files()
        pending = [f for f in all_files if f.version not in applied_versions]

        current_ver = applied[-1].version if applied else None
        return MigrationStatus(
            applied=applied,
            pending=pending,
            current_version=current_ver,
        )

    def migrate(self, target: Optional[str] = None) -> List[MigrationRecord]:
        """Applies pending migrations up to target (or all pending if target is None)."""
        self.init()
        status = self.status()
        pending = status.pending

        if target is not None:
            pending = [f for f in pending if f.version <= target]

        applied_now: List[MigrationRecord] = []

        for mfile in pending:
            sql = mfile.up_path.read_text(encoding="utf-8")
            start = time.perf_counter()
            self.db.execute(sql)
            duration_ms = int((time.perf_counter() - start) * 1000)

            checksum = compute_checksum(sql)
            now = datetime.now()

            self.db.execute(
                f"""
                INSERT INTO {self.TABLE_NAME} (version, name, checksum, applied_at, duration_ms)
                VALUES (?, ?, ?, ?, ?)
                """,
                [mfile.version, mfile.name, checksum, now, duration_ms],
            )

            rec = MigrationRecord(
                version=mfile.version,
                name=mfile.name,
                checksum=checksum,
                applied_at=now,
                duration_ms=duration_ms,
            )
            applied_now.append(rec)

        return applied_now

    def rollback(self, steps: int = 1) -> List[MigrationRecord]:
        """Rolls back the last `steps` applied migrations using their .down.sql files."""
        self.init()
        applied = self.get_applied_migrations()
        if not applied:
            return []

        to_rollback = list(reversed(applied[-steps:]))
        files_by_version = {f.version: f for f in self.get_migration_files()}

        rolled_back: List[MigrationRecord] = []

        for rec in to_rollback:
            mfile = files_by_version.get(rec.version)
            if not mfile or not mfile.down_path or not mfile.down_path.exists():
                raise FileNotFoundError(
                    f"Cannot rollback migration {rec.version}_{rec.name}: missing down migration file."
                )

            sql = mfile.down_path.read_text(encoding="utf-8")
            self.db.execute(sql)
            self.db.execute(
                f"DELETE FROM {self.TABLE_NAME} WHERE version = ?",
                [rec.version],
            )
            rolled_back.append(rec)

        return rolled_back

    def validate(self) -> List[str]:
        """Checks applied migrations against disk for drift or missing files."""
        self.init()
        applied = self.get_applied_migrations()
        files = {f.version: f for f in self.get_migration_files()}
        errors: List[str] = []

        for rec in applied:
            if rec.version not in files:
                errors.append(
                    f"Migration {rec.version}_{rec.name} was applied in database, but file is missing on disk."
                )
            else:
                mfile = files[rec.version]
                if mfile.checksum != rec.checksum:
                    errors.append(
                        f"Migration {rec.version}_{rec.name} has been modified after being applied (checksum mismatch)."
                    )

        return errors

    def create_migration(self, name: str) -> Tuple[Path, Path]:
        """Scaffolds a new pair of .up.sql and .down.sql migration files."""
        self.migrations_dir.mkdir(parents=True, exist_ok=True)
        files = self.get_migration_files()

        if files:
            max_ver = max(int(f.version) for f in files if f.version.isdigit())
            next_ver = f"{max_ver + 1:03d}"
        else:
            next_ver = "001"

        slug = re.sub(r"[^\w\-_]+", "_", name.strip().lower()).strip("_")
        if not slug:
            slug = "migration"

        up_file = self.migrations_dir / f"{next_ver}_{slug}.up.sql"
        down_file = self.migrations_dir / f"{next_ver}_{slug}.down.sql"

        up_template = f"-- Migration: {next_ver}_{slug}\n-- Created: {datetime.now().isoformat()}\n\n"
        down_template = f"-- Rollback Migration: {next_ver}_{slug}\n-- Created: {datetime.now().isoformat()}\n\n"

        up_file.write_text(up_template, encoding="utf-8")
        down_file.write_text(down_template, encoding="utf-8")

        return up_file, down_file
