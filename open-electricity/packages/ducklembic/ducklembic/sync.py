import time
from dataclasses import dataclass
from typing import List, Optional

from ducklembic.connection import DuckDB


@dataclass
class TableSyncResult:
    table: str
    source_rows: int
    target_rows: int
    status: str  # "synced" | "diff" | "skipped" | "error"
    duration_ms: int = 0
    error: Optional[str] = None


@dataclass
class SyncReport:
    direction: str  # "push" | "pull" | "diff"
    source_backend: str
    target_backend: str
    tables: List[TableSyncResult]
    total_duration_ms: int = 0

    @property
    def all_matched(self) -> bool:
        return all(t.status in ("synced", "match") for t in self.tables)


class Sync:
    """
    Handles bidirectional data sync and diff reporting between local DuckDB and MotherDuck.
    """

    def __init__(self, local: DuckDB, remote: DuckDB):
        self.local = local
        self.remote = remote

    def get_tables(self, db: DuckDB) -> List[str]:
        """Returns non-system tables in the active database."""
        rows = db.fetchall("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_catalog = current_database()
              AND table_schema = 'main' 
              AND table_type = 'BASE TABLE'
              AND table_name NOT LIKE '_ducklembic_%'
            ORDER BY table_name
        """)
        return [r[0] for r in rows]

    def diff(self, tables: Optional[List[str]] = None) -> SyncReport:
        """Compares row counts between local and remote."""
        start_time = time.perf_counter()
        target_tables = tables or self.get_tables(self.local)
        results: List[TableSyncResult] = []

        for tbl in target_tables:
            # Source rows
            try:
                src_count = self.local.fetchone(f"SELECT COUNT(*) FROM {tbl}")[0]
            except Exception as e:
                src_count = -1
                results.append(
                    TableSyncResult(
                        table=tbl,
                        source_rows=src_count,
                        target_rows=-1,
                        status="error",
                        error=f"Local read error: {e}",
                    )
                )
                continue

            # Remote rows
            try:
                rem_count = self.remote.fetchone(f"SELECT COUNT(*) FROM {tbl}")[0]
            except Exception:
                rem_count = 0  # Table might not exist yet on remote

            status = "match" if src_count == rem_count else "diff"
            results.append(
                TableSyncResult(
                    table=tbl,
                    source_rows=src_count,
                    target_rows=rem_count,
                    status=status,
                )
            )

        duration = int((time.perf_counter() - start_time) * 1000)
        return SyncReport(
            direction="diff",
            source_backend=self.local.backend,
            target_backend=self.remote.backend,
            tables=results,
            total_duration_ms=duration,
        )

    def push(
        self,
        tables: Optional[List[str]] = None,
        *,
        strategy: str = "replace",
        confirm: bool = False,
        dry_run: bool = False,
    ) -> SyncReport:
        """
        Pushes local tables to MotherDuck Cloud.
        Protected operation: requires confirm=True to execute unless dry_run=True.
        """
        if not confirm and not dry_run:
            raise PermissionError(
                "Pushing to MotherDuck Cloud is a destructive operation. "
                "Pass confirm=True or use dry_run=True to preview."
            )

        if dry_run:
            diff_report = self.diff(tables)
            diff_report.direction = "push (dry-run)"
            return diff_report

        start_time = time.perf_counter()
        target_tables = tables or self.get_tables(self.local)
        results: List[TableSyncResult] = []

        local_path = str(self.local.local_path)
        if local_path == ":memory:":
            raise ValueError(
                "Cannot push an in-memory database to MotherDuck via ATTACH."
            )

        # Close local connection to prevent file lock contention
        self.local.close()

        # Connect to MotherDuck and attach local database
        md_conn = self.remote.conn
        alias = "ducklembic_local_src"

        try:
            md_conn.execute(f"ATTACH '{local_path}' AS {alias} (READ_ONLY);")
        except Exception as e:
            raise ConnectionError(
                f"Failed to attach local database to MotherDuck: {e}"
            ) from e

        try:
            for tbl in target_tables:
                t_start = time.perf_counter()
                try:
                    src_cnt = md_conn.execute(
                        f"SELECT COUNT(*) FROM {alias}.{tbl}"
                    ).fetchone()[0]

                    # Check if table exists on remote (current database)
                    exists = md_conn.execute(
                        f"SELECT COUNT(*) FROM information_schema.tables WHERE table_catalog = current_database() AND table_name = '{tbl}'"
                    ).fetchone()[0] > 0

                    if not exists:
                        md_conn.execute(
                            f"CREATE TABLE {tbl} AS SELECT * FROM {alias}.{tbl};"
                        )
                    else:
                        if strategy == "replace":
                            try:
                                md_conn.execute(
                                    f"INSERT OR REPLACE INTO {tbl} SELECT * FROM {alias}.{tbl};"
                                )
                            except Exception:
                                md_conn.execute(f"DELETE FROM {tbl};")
                                md_conn.execute(
                                    f"INSERT INTO {tbl} SELECT * FROM {alias}.{tbl};"
                                )
                        elif strategy == "append":
                            md_conn.execute(
                                f"INSERT INTO {tbl} SELECT * FROM {alias}.{tbl};"
                            )
                        else:
                            raise ValueError(f"Unknown sync strategy: {strategy}")

                    tgt_cnt = md_conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
                    t_dur = int((time.perf_counter() - t_start) * 1000)

                    results.append(
                        TableSyncResult(
                            table=tbl,
                            source_rows=src_cnt,
                            target_rows=tgt_cnt,
                            status="synced",
                            duration_ms=t_dur,
                        )
                    )
                except Exception as e:
                    results.append(
                        TableSyncResult(
                            table=tbl,
                            source_rows=-1,
                            target_rows=-1,
                            status="error",
                            error=str(e),
                        )
                    )
        finally:
            try:
                md_conn.execute(f"DETACH {alias};")
            except Exception:
                pass

        total_dur = int((time.perf_counter() - start_time) * 1000)
        return SyncReport(
            direction="push",
            source_backend="local",
            target_backend="motherduck",
            tables=results,
            total_duration_ms=total_dur,
        )

    def pull(
        self,
        tables: Optional[List[str]] = None,
        *,
        strategy: str = "replace",
    ) -> SyncReport:
        """
        Pulls tables from MotherDuck Cloud to local DuckDB.
        """
        start_time = time.perf_counter()
        local_path = str(self.local.local_path)
        if local_path == ":memory:":
            raise ValueError("Cannot pull to an in-memory database via ATTACH.")

        target_tables = tables or self.get_tables(self.remote)
        results: List[TableSyncResult] = []

        # Close local connection to prevent file lock contention
        self.local.close()

        # Execute from the authenticated MotherDuck connection and attach local target
        md_conn = self.remote.conn
        alias = "ducklembic_local_dest"

        try:
            md_conn.execute(f"ATTACH '{local_path}' AS {alias};")
        except Exception as e:
            raise ConnectionError(
                f"Failed to attach local DuckDB database: {e}"
            ) from e

        try:
            for tbl in target_tables:
                t_start = time.perf_counter()
                try:
                    src_cnt = md_conn.execute(
                        f"SELECT COUNT(*) FROM {tbl}"
                    ).fetchone()[0]

                    # Check if table exists in attached local database
                    exists = md_conn.execute(
                        f"SELECT COUNT(*) FROM information_schema.tables WHERE table_catalog = '{alias}' AND table_name = '{tbl}'"
                    ).fetchone()[0] > 0

                    if not exists:
                        md_conn.execute(
                            f"CREATE TABLE {alias}.{tbl} AS SELECT * FROM {tbl};"
                        )
                    else:
                        if strategy == "replace":
                            try:
                                md_conn.execute(
                                    f"INSERT OR REPLACE INTO {alias}.{tbl} SELECT * FROM {tbl};"
                                )
                            except Exception:
                                md_conn.execute(f"DELETE FROM {alias}.{tbl};")
                                md_conn.execute(
                                    f"INSERT INTO {alias}.{tbl} SELECT * FROM {tbl};"
                                )
                        elif strategy == "append":
                            md_conn.execute(
                                f"INSERT INTO {alias}.{tbl} SELECT * FROM {tbl};"
                            )
                        else:
                            raise ValueError(f"Unknown sync strategy: {strategy}")

                    tgt_cnt = md_conn.execute(
                        f"SELECT COUNT(*) FROM {alias}.{tbl}"
                    ).fetchone()[0]
                    t_dur = int((time.perf_counter() - t_start) * 1000)

                    results.append(
                        TableSyncResult(
                            table=tbl,
                            source_rows=src_cnt,
                            target_rows=tgt_cnt,
                            status="synced",
                            duration_ms=t_dur,
                        )
                    )
                except Exception as e:
                    results.append(
                        TableSyncResult(
                            table=tbl,
                            source_rows=-1,
                            target_rows=-1,
                            status="error",
                            error=str(e),
                        )
                    )
        finally:
            try:
                md_conn.execute(f"DETACH {alias};")
            except Exception:
                pass

        total_dur = int((time.perf_counter() - start_time) * 1000)
        return SyncReport(
            direction="pull",
            source_backend="motherduck",
            target_backend="local",
            tables=results,
            total_duration_ms=total_dur,
        )
