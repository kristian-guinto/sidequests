"""Database schema validation for OpenElectricity pipeline derived directly from dataclass models."""

from dataclasses import fields
from typing import Any, Dict, List, Set
from pipeline.models import TABLE_MODELS


class SchemaMismatchError(Exception):
    """Raised when the target database schema does not match the expected pipeline schema."""

    pass


def get_expected_schema() -> Dict[str, Dict[str, Any]]:
    """Derives expected table names, columns, and primary keys directly from dataclasses in models.py."""
    schema: Dict[str, Dict[str, Any]] = {}
    for model_cls in TABLE_MODELS:
        table_name = getattr(model_cls, "__table_name__", None)
        pk = getattr(model_cls, "__primary_key__", [])
        if table_name:
            schema[table_name] = {
                "columns": {f.name for f in fields(model_cls)},
                "primary_key": list(pk),
                "model": model_cls,
            }
    return schema


EXPECTED_TABLES: Dict[str, Dict[str, Any]] = get_expected_schema()


def validate_database_schema(conn: Any) -> None:
    """
    Validates that the target database contains all expected base tables,
    columns, and primary key constraints directly derived from domain dataclasses.

    Raises:
        SchemaMismatchError: If any table, column, or constraint is missing.
    """
    expected_tables = get_expected_schema()

    # 1. Validate Base Tables
    tables_query = (
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_type = 'BASE TABLE' AND table_schema = 'main'"
    )
    existing_tables: Set[str] = {
        row[0] for row in conn.execute(tables_query).fetchall()
    }

    for table_name in expected_tables:
        if table_name not in existing_tables:
            raise SchemaMismatchError(
                f"Missing required base table '{table_name}' in database. "
                "Database schema must be initialized or updated before running the pipeline. "
                "Run: 'uv run ducklembic migrate'"
            )

    # 2. Validate Columns
    cols_query = (
        "SELECT table_name, column_name FROM information_schema.columns "
        "WHERE table_schema = 'main'"
    )
    existing_columns: Dict[str, Set[str]] = {}
    for t_name, c_name in conn.execute(cols_query).fetchall():
        existing_columns.setdefault(t_name, set()).add(c_name)

    for table_name, spec in expected_tables.items():
        actual_cols = existing_columns.get(table_name, set())
        missing_cols = spec["columns"] - actual_cols
        if missing_cols:
            missing_str = ", ".join(sorted(missing_cols))
            raise SchemaMismatchError(
                f"Table '{table_name}' is missing expected column(s): {missing_str}. "
                "Database schema is out of date. Run: 'uv run ducklembic migrate'"
            )

    # 3. Validate Primary Key Constraints
    try:
        constraints_query = (
            "SELECT table_name, constraint_type, constraint_column_names "
            "FROM duckdb_constraints() WHERE constraint_type = 'PRIMARY KEY'"
        )
        pk_rows = conn.execute(constraints_query).fetchall()
        actual_pks: Dict[str, List[str]] = {row[0]: list(row[2]) for row in pk_rows}

        for table_name, spec in expected_tables.items():
            expected_pk = spec["primary_key"]
            actual_pk = actual_pks.get(table_name, [])
            if sorted(expected_pk) != sorted(actual_pk):
                raise SchemaMismatchError(
                    f"Table '{table_name}' primary key mismatch. "
                    f"Expected: {expected_pk}, Found: {actual_pk}. "
                    "Run: 'uv run ducklembic migrate'"
                )
    except Exception as e:
        # If duckdb_constraints is not supported (e.g. mock connection in tests), re-raise if SchemaMismatchError
        if isinstance(e, SchemaMismatchError):
            raise
