import pytest
from ducklembic.connection import DuckDB


def test_in_memory_connection():
    db = DuckDB(":memory:", mode="local")
    assert db.backend == "local"
    assert not db.is_motherduck
    assert db.conn_str == ":memory:"

    db.execute("CREATE TABLE test (id INT, name VARCHAR);")
    db.executemany("INSERT INTO test VALUES (?, ?)", [(1, "A"), (2, "B")])

    res = db.fetchall("SELECT * FROM test ORDER BY id")
    assert len(res) == 2
    assert res[0] == (1, "A")
    assert res[1] == (2, "B")

    one = db.fetchone("SELECT name FROM test WHERE id = ?", [1])
    assert one == ("A",)

    db.close()


def test_context_manager():
    with DuckDB(":memory:", mode="local") as db:
        db.execute("CREATE TABLE foo (val INT);")
        db.execute("INSERT INTO foo VALUES (42);")
        val = db.fetchone("SELECT val FROM foo")[0]
        assert val == 42


def test_motherduck_mode_without_token_raises():
    with pytest.raises(ValueError, match="no MOTHERDUCK_TOKEN provided"):
        DuckDB(":memory:", motherduck_token="", mode="motherduck")
