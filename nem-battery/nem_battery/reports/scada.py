"""
Fetch and parse Dispatch SCADA reports — actual metered MW per DUID.

Published every 5 minutes to:
  https://www.nemweb.com.au/Reports/Current/Dispatch_SCADA/

Note: NEM settlement is based on dispatch targets (TOTALCLEARED in
DISPATCH_UNIT_SOLUTION), not SCADA actuals. SCADA data is useful for
operational monitoring — e.g. tracking actual battery charge/discharge
MW and estimating state of charge over time.
"""

from __future__ import annotations

import httpx

from nem_battery import _client, _parser
from nem_battery._types import ScadaReading

_TABLES = {"UNIT_SCADA"}


async def fetch_scada(
    client: httpx.AsyncClient | None = None,
) -> list[ScadaReading]:
    """Fetch the latest Dispatch SCADA readings.

    Returns:
        List of ScadaReading, one per active DUID.
    """
    _, zip_bytes = await _client.fetch_latest_zip(_client.DISPATCH_SCADA_DIR, client=client)
    return parse_zip(zip_bytes)


def parse_zip(zip_bytes: bytes) -> list[ScadaReading]:
    """Parse a raw Dispatch SCADA ZIP without making any HTTP requests."""
    tables = _parser.parse_mms_zip(zip_bytes, tables=_TABLES)
    return _build(tables.get("UNIT_SCADA", []))


def _build(rows: list[dict[str, str]]) -> list[ScadaReading]:
    readings: list[ScadaReading] = []
    for row in rows:
        duid = row.get("DUID", "")
        if not duid:
            continue
        dt_str = row.get("SETTLEMENTDATE", "")
        if not dt_str:
            continue
        readings.append(
            ScadaReading(
                duid=duid,
                settlement_date=_parser.parse_datetime(dt_str),
                scada_value=_parser.safe_float(row.get("SCADAVALUE", "0")),
            )
        )
    return readings


def to_dict(readings: list[ScadaReading]) -> dict[str, ScadaReading]:
    """Index a list of SCADA readings by DUID for fast lookup."""
    return {r.duid: r for r in readings}
