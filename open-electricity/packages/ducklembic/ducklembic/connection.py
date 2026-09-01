import os
from pathlib import Path
from typing import Any, List, Optional, Tuple, Union
import duckdb


class DuckDB:
    """
    Manages DuckDB connections with dual local / MotherDuck support and fallback handling.
    """

    def __init__(
        self,
        local_path: Union[str, Path] = ":memory:",
        *,
        motherduck_token: Optional[str] = None,
        motherduck_database: Optional[str] = None,
        mode: str = "auto",  # "auto" | "local" | "motherduck"
        read_only: bool = False,
    ):
        self.local_path = (
            Path(local_path) if str(local_path) != ":memory:" else ":memory:"
        )
        self.motherduck_token = motherduck_token or os.getenv("MOTHERDUCK_TOKEN")
        self.motherduck_database = (
            motherduck_database or os.getenv("MOTHERDUCK_DATABASE") or "my_db"
        )
        self.mode = mode.lower()
        self.read_only = read_only

        self._conn: Optional[duckdb.DuckDBPyConnection] = None
        self._is_motherduck = False
        self._conn_str = ""

        self._connect()

    def _connect(self) -> None:
        want_motherduck = self.mode == "motherduck" or (
            self.mode == "auto" and bool(self.motherduck_token)
        )

        if want_motherduck:
            if not self.motherduck_token:
                if self.mode == "motherduck":
                    raise ValueError(
                        "MotherDuck mode selected but no MOTHERDUCK_TOKEN provided."
                    )
            else:
                self._conn_str = f"md:{self.motherduck_database}"
                try:
                    config = {"motherduck_token": self.motherduck_token}
                    # Ensure extension dir is writable in serverless environments if /tmp exists
                    if os.path.exists("/tmp") and os.access("/tmp", os.W_OK):
                        config["extension_directory"] = "/tmp/.duckdb/extensions"
                    self._conn = duckdb.connect(
                        self._conn_str, config=config, read_only=self.read_only
                    )
                    self._is_motherduck = True
                    return
                except Exception as e:
                    if self.mode == "motherduck":
                        raise ConnectionError(
                            f"Failed to connect to MotherDuck ({self._conn_str}): {e}"
                        ) from e
                    # In 'auto' mode, fall back to local
                    self._is_motherduck = False

        # Local DuckDB connection
        if self.local_path == ":memory:":
            self._conn_str = ":memory:"
            self._conn = duckdb.connect(":memory:", read_only=self.read_only)
        else:
            local_p = Path(self.local_path)
            if not self.read_only:
                local_p.parent.mkdir(parents=True, exist_ok=True)
            self._conn_str = str(local_p)
            self._conn = duckdb.connect(str(local_p), read_only=self.read_only)

        self._is_motherduck = False

    @property
    def conn(self) -> duckdb.DuckDBPyConnection:
        if self._conn is None:
            self._connect()
        return self._conn

    @property
    def is_motherduck(self) -> bool:
        return self._is_motherduck

    @property
    def backend(self) -> str:
        return "motherduck" if self._is_motherduck else "local"

    @property
    def conn_str(self) -> str:
        return self._conn_str

    def execute(
        self, sql: str, params: Optional[Any] = None
    ) -> duckdb.DuckDBPyRelation:
        if params is not None:
            return self.conn.execute(sql, params)
        return self.conn.execute(sql)

    def executemany(self, sql: str, data: List[Any]) -> None:
        self.conn.executemany(sql, data)

    def fetchone(
        self, sql: str, params: Optional[Any] = None
    ) -> Optional[Tuple[Any, ...]]:
        res = self.execute(sql, params)
        return res.fetchone()

    def fetchall(self, sql: str, params: Optional[Any] = None) -> List[Tuple[Any, ...]]:
        res = self.execute(sql, params)
        return res.fetchall()

    def close(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            finally:
                self._conn = None

    def __enter__(self) -> "DuckDB":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    def __str__(self) -> str:
        return self._conn_str

    def __repr__(self) -> str:
        return f"<DuckDB backend={self.backend} conn_str='{self._conn_str}' read_only={self.read_only}>"
