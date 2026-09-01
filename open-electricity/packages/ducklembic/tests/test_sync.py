import pytest
from pathlib import Path
from ducklembic.connection import DuckDB
from ducklembic.sync import Sync


def test_sync_diff_and_protected_push(tmp_path: Path):
    db1_path = tmp_path / "local.duckdb"
    db2_path = tmp_path / "remote.duckdb"

    # Local DB setup
    local_db = DuckDB(db1_path, mode="local")
    local_db.execute("CREATE TABLE users (id INT, name VARCHAR);")
    local_db.execute("INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob');")

    # Remote DB setup
    remote_db = DuckDB(db2_path, mode="local")

    sync_engine = Sync(local_db, remote_db)

    # Test Diff
    report = sync_engine.diff()
    assert len(report.tables) == 1
    assert report.tables[0].table == "users"
    assert report.tables[0].source_rows == 2
    assert report.tables[0].target_rows == 0
    assert report.tables[0].status == "diff"

    # Test Unconfirmed Push raises PermissionError
    with pytest.raises(PermissionError, match="destructive operation"):
        sync_engine.push(confirm=False)

    # Test Dry Run
    dry_report = sync_engine.push(confirm=False, dry_run=True)
    assert dry_report.direction == "push (dry-run)"
    assert dry_report.tables[0].status == "diff"

    # Clean up connections
    local_db.close()
    remote_db.close()


def test_sync_push_and_pull_execution(tmp_path: Path):
    db1_path = tmp_path / "local.duckdb"
    db2_path = tmp_path / "remote.duckdb"

    # Local DB setup
    local_db = DuckDB(db1_path, mode="local")
    local_db.execute("CREATE TABLE products (id INT PRIMARY KEY, title VARCHAR);")
    local_db.execute("INSERT INTO products VALUES (1, 'Book'), (2, 'Pen');")

    remote_db = DuckDB(db2_path, mode="local")

    sync_engine = Sync(local_db, remote_db)

    # Push local -> remote
    push_report = sync_engine.push(confirm=True)
    assert push_report.tables[0].status == "synced"
    assert push_report.tables[0].target_rows == 2

    # Check remote directly
    remote_db._connect()
    assert remote_db.fetchone("SELECT COUNT(*) FROM products")[0] == 2
    # Add new item on remote
    remote_db.execute("INSERT INTO products VALUES (3, 'Notebook');")
    remote_db.close()

    # Pull remote -> local
    pull_report = sync_engine.pull()
    assert pull_report.tables[0].status == "synced"
    assert pull_report.tables[0].target_rows == 3

    # Check local directly
    local_db._connect()
    assert local_db.fetchone("SELECT COUNT(*) FROM products")[0] == 3

    local_db.close()
    remote_db.close()


def test_get_tables_catalog_isolation(tmp_path: Path):
    db1_path = tmp_path / "db1.duckdb"
    db2_path = tmp_path / "db2.duckdb"

    db1 = DuckDB(db1_path, mode="local")
    db1.execute("CREATE TABLE target_table (id INT);")

    db2 = DuckDB(db2_path, mode="local")
    db2.execute("CREATE TABLE other_table (id INT);")
    db2.close()

    # Attach db2 into db1
    db1.execute(f"ATTACH '{db2_path}' AS db2;")

    sync_engine = Sync(db1, db1)
    tables = sync_engine.get_tables(db1)

    # Should only return tables in db1's catalog, not db2
    assert tables == ["target_table"]

    db1.close()
