"""
MMS (Market Management System) ZIP file parser.

AEMO publishes data as ZIP archives containing pipe-delimited CSV files in MMS format.
Each file can contain multiple tables, identified by row-type prefixes:

  C  – comment / file metadata (ignored)
  I  – column header row:  I, GROUP, TABLE_NAME, VERSION, col1, col2, ...
  D  – data row:           D, GROUP, TABLE_NAME, VERSION, val1, val2, ...
  END – end of file marker

Tables are extracted by name (the third field on I/D rows).
"""

from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict
from datetime import datetime


def parse_mms_zip(
    zip_bytes: bytes,
    tables: set[str] | None = None,
) -> dict[str, list[dict[str, str]]]:
    """Parse an AEMO MMS ZIP into a mapping of table_name → list of row dicts.

    Args:
        zip_bytes: Raw bytes of a NEMWeb ZIP file.
        tables:    Names of tables to extract, e.g. {"PRICE", "UNIT_SOLUTION"}.
                   Pass None to extract every table in the file.

    Returns:
        Dict keyed by table name. Values are lists of dicts mapping column
        name → string value exactly as published by AEMO.
    """
    result: dict[str, list[dict[str, str]]] = defaultdict(list)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        csv_name = _find_csv(zf)
        with zf.open(csv_name) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8"))
            current_table: str | None = None
            current_columns: list[str] = []

            for row in reader:
                if not row:
                    continue
                row_type = row[0]

                if row_type == "I":
                    # I, GROUP, TABLE_NAME, VERSION, col1, col2, ...
                    if len(row) < 5:
                        continue
                    table_name = row[2]
                    if tables is None or table_name in tables:
                        current_table = table_name
                        current_columns = row[4:]
                    else:
                        current_table = None
                        current_columns = []

                elif row_type == "D" and current_table is not None:
                    # D, GROUP, TABLE_NAME, VERSION, val1, val2, ...
                    if len(row) < 5:
                        continue
                    values = row[4:]
                    # Zip up to the shorter of columns/values — handles trailing
                    # empty fields that some AEMO files include.
                    row_dict = dict(zip(current_columns, values))
                    result[current_table].append(row_dict)

    return dict(result)


def _find_csv(zf: zipfile.ZipFile) -> str:
    """Return the name of the (first) CSV inside a ZIP."""
    names = zf.namelist()
    for name in names:
        if name.upper().endswith(".CSV"):
            return name
    raise ValueError(f"No CSV file found inside ZIP. Contents: {names}")


# ---------------------------------------------------------------------------
# Datetime helper
# ---------------------------------------------------------------------------

_AEMO_DT_FORMAT = "%Y/%m/%d %H:%M:%S"


def parse_datetime(value: str) -> datetime:
    """Parse AEMO's standard datetime string: '2026/03/17 20:45:00'."""
    return datetime.strptime(value, _AEMO_DT_FORMAT)


def safe_float(value: str) -> float:
    """Convert a string to float, returning 0.0 for empty or non-numeric values."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0
