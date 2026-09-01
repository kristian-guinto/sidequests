import pytest
from pathlib import Path
from ducklembic.connection import DuckDB
from ducklembic.migrator import Migrator, compute_checksum


def test_migrator_lifecycle(tmp_path: Path):
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()

    # Create 2 migrations
    (migrations_dir / "001_create_users.up.sql").write_text(
        "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR);\n", encoding="utf-8"
    )
    (migrations_dir / "001_create_users.down.sql").write_text(
        "DROP TABLE users;\n", encoding="utf-8"
    )

    (migrations_dir / "002_add_email.up.sql").write_text(
        "ALTER TABLE users ADD COLUMN email VARCHAR;\n", encoding="utf-8"
    )
    (migrations_dir / "002_add_email.down.sql").write_text(
        "ALTER TABLE users DROP COLUMN email;\n", encoding="utf-8"
    )

    db = DuckDB(":memory:", mode="local")
    migrator = Migrator(db, migrations_dir=migrations_dir)

    # 1. Initial Status
    st = migrator.status()
    assert len(st.applied) == 0
    assert len(st.pending) == 2
    assert st.current_version is None

    # 2. Migrate target 001
    applied_001 = migrator.migrate(target="001")
    assert len(applied_001) == 1
    assert applied_001[0].version == "001"

    st = migrator.status()
    assert len(st.applied) == 1
    assert len(st.pending) == 1
    assert st.current_version == "001"

    # Verify table exists
    db.execute("INSERT INTO users VALUES (1, 'Alice');")
    res = db.fetchone("SELECT name FROM users WHERE id = 1")
    assert res == ("Alice",)

    # 3. Migrate remaining (002)
    applied_002 = migrator.migrate()
    assert len(applied_002) == 1
    assert applied_002[0].version == "002"

    st = migrator.status()
    assert len(st.applied) == 2
    assert len(st.pending) == 0
    assert st.current_version == "002"

    # Verify column exists
    db.execute("UPDATE users SET email = 'alice@example.com' WHERE id = 1;")
    email = db.fetchone("SELECT email FROM users WHERE id = 1")[0]
    assert email == "alice@example.com"

    # 4. Validation (no errors)
    errors = migrator.validate()
    assert len(errors) == 0

    # 5. Rollback step 1 (002)
    rolled_back = migrator.rollback(steps=1)
    assert len(rolled_back) == 1
    assert rolled_back[0].version == "002"

    st = migrator.status()
    assert len(st.applied) == 1
    assert len(st.pending) == 1
    assert st.current_version == "001"

    # 6. Scaffolding new migration
    up, down = migrator.create_migration("add posts table")
    assert up.name == "003_add_posts_table.up.sql"
    assert down.name == "003_add_posts_table.down.sql"
    assert up.exists()
    assert down.exists()


def test_migrator_validation_drift(tmp_path: Path):
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()

    file_001 = migrations_dir / "001_init.up.sql"
    file_001.write_text("CREATE TABLE t (id INT);\n", encoding="utf-8")

    db = DuckDB(":memory:", mode="local")
    migrator = Migrator(db, migrations_dir=migrations_dir)
    migrator.migrate()

    # Modify file after migration
    file_001.write_text("CREATE TABLE t (id INT, extra VARCHAR);\n", encoding="utf-8")

    errors = migrator.validate()
    assert len(errors) == 1
    assert "checksum mismatch" in errors[0]
