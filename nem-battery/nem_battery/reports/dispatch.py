"""
Fetch and parse DispatchIS reports — the primary real-time data feed.

Published every 5 minutes to:
  https://www.nemweb.com.au/Reports/Current/DispatchIS_Reports/

Each ZIP contains one MMS CSV with (at minimum):
  PRICE         — energy RRP + 8 FCAS prices per region per interval
  UNIT_SOLUTION — per-DUID dispatch targets + FCAS enablement MW

Only non-intervention dispatch rows (INTERVENTION=0) are returned,
which represent the actual binding market outcome.
"""

from __future__ import annotations

from datetime import datetime

import httpx

from nem_battery import _client, _parser
from nem_battery._types import DispatchInterval, RegionPrices, UnitSolution

_TABLES = {"PRICE", "UNIT_SOLUTION"}


async def fetch_dispatch_interval(
    settlement_date: datetime | None = None,
    client: httpx.AsyncClient | None = None,
) -> DispatchInterval:
    """Fetch one 5-minute dispatch interval.

    Args:
        settlement_date: If None, fetches the latest published interval.
                         Specific interval fetching by date is not supported
                         here — use nextday.fetch_next_day_dispatch() for
                         historical data.
        client:          Optional shared httpx.AsyncClient (for streaming).

    Returns:
        DispatchInterval with prices and unit solutions.
    """
    if settlement_date is not None:
        raise NotImplementedError(
            "Targeted fetch by settlement_date is not supported for DispatchIS. "
            "Use nem_battery.reports.nextday.fetch_next_day_dispatch() for "
            "historical intervals."
        )
    _, zip_bytes = await _client.fetch_latest_zip(_client.DISPATCH_IS_DIR, client=client)
    return _parse(zip_bytes)


def _parse(zip_bytes: bytes) -> DispatchInterval:
    tables = _parser.parse_mms_zip(zip_bytes, tables=_TABLES)
    prices = _build_prices(tables.get("PRICE", []))
    unit_solutions = _build_unit_solutions(tables.get("UNIT_SOLUTION", []))

    # Derive settlement_date from first price row; fall back to first solution row.
    settlement_date = _extract_settlement_date(tables)
    return DispatchInterval(
        settlement_date=settlement_date,
        prices=prices,
        unit_solutions=unit_solutions,
    )


def parse_zip(zip_bytes: bytes) -> DispatchInterval:
    """Parse a raw DispatchIS ZIP without making any HTTP requests.

    Useful for testing or processing pre-downloaded files.
    """
    return _parse(zip_bytes)


# ---------------------------------------------------------------------------
# Internal builders
# ---------------------------------------------------------------------------


def _build_prices(rows: list[dict[str, str]]) -> dict[str, RegionPrices]:
    prices: dict[str, RegionPrices] = {}
    for row in rows:
        if row.get("INTERVENTION", "0") != "0":
            continue
        region = row["REGIONID"]
        prices[region] = RegionPrices(
            region=region,
            settlement_date=_parser.parse_datetime(row["SETTLEMENTDATE"]),
            rrp=_parser.safe_float(row.get("RRP", "0")),
            raise6sec=_parser.safe_float(row.get("RAISE6SECRRP", "0")),
            raise60sec=_parser.safe_float(row.get("RAISE60SECRRP", "0")),
            raise5min=_parser.safe_float(row.get("RAISE5MINRRP", "0")),
            raisereg=_parser.safe_float(row.get("RAISEREGRRP", "0")),
            lower6sec=_parser.safe_float(row.get("LOWER6SECRRP", "0")),
            lower60sec=_parser.safe_float(row.get("LOWER60SECRRP", "0")),
            lower5min=_parser.safe_float(row.get("LOWER5MINRRP", "0")),
            lowerreg=_parser.safe_float(row.get("LOWERREGRRP", "0")),
        )
    return prices


def _build_unit_solutions(rows: list[dict[str, str]]) -> dict[str, UnitSolution]:
    solutions: dict[str, UnitSolution] = {}
    for row in rows:
        if row.get("INTERVENTION", "0") != "0":
            continue
        duid = row["DUID"]
        solutions[duid] = UnitSolution(
            duid=duid,
            settlement_date=_parser.parse_datetime(row["SETTLEMENTDATE"]),
            total_cleared=_parser.safe_float(row.get("TOTALCLEARED", "0")),
            raise6sec=_parser.safe_float(row.get("RAISE6SEC", "0")),
            raise60sec=_parser.safe_float(row.get("RAISE60SEC", "0")),
            raise5min=_parser.safe_float(row.get("RAISE5MIN", "0")),
            raisereg=_parser.safe_float(row.get("RAISEREG", "0")),
            lower6sec=_parser.safe_float(row.get("LOWER6SEC", "0")),
            lower60sec=_parser.safe_float(row.get("LOWER60SEC", "0")),
            lower5min=_parser.safe_float(row.get("LOWER5MIN", "0")),
            lowerreg=_parser.safe_float(row.get("LOWERREG", "0")),
        )
    return solutions


def _extract_settlement_date(
    tables: dict[str, list[dict[str, str]]],
) -> datetime:
    for table_name in ("PRICE", "UNIT_SOLUTION"):
        rows = tables.get(table_name, [])
        for row in rows:
            if "SETTLEMENTDATE" in row:
                return _parser.parse_datetime(row["SETTLEMENTDATE"])
    raise ValueError("No SETTLEMENTDATE found in DispatchIS tables")
