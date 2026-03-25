"""
Fetch and parse historical full-day dispatch data.

Historical data requires combining two AEMO sources (discovered from live inspection):

  Current/Next_Day_Dispatch/          → UNIT_SOLUTION only (no prices)
  Archive/DispatchIS_Reports/         → PRICE only per inner ZIP (no unit solutions)

Both are fetched and joined on SETTLEMENTDATE to produce complete DispatchInterval
objects. This takes two HTTP requests (~8 MB + ~5 MB per trading day).

Data retention:
  Next_Day_Dispatch  ~13 months rolling
  Archive DispatchIS ~13 months rolling
"""

from __future__ import annotations

import io
import re
import warnings
import zipfile
from collections import defaultdict
from datetime import date, timedelta

import httpx

from nem_battery import _client, _parser
from nem_battery.reports.dispatch import (
    _build_prices,
    _build_unit_solutions,
)
from nem_battery._types import DispatchDay, DispatchInterval

_UNIT_SOLUTION_TABLES = {"UNIT_SOLUTION"}
_PRICE_TABLES = {"PRICE"}
_EXPECTED_INTERVALS_PER_TRADING_DAY = 288

# Filename pattern for Next Day Dispatch
_NEXT_DAY_FILE_RE = re.compile(r"PUBLIC_NEXT_DAY_DISPATCH_(\d{8})_\d+\.zip", re.IGNORECASE)


async def fetch_next_day_dispatch(
    day: date,
    client: httpx.AsyncClient | None = None,
) -> DispatchDay:
    """Fetch all 5-minute dispatch intervals for one historical trading day.

    Combines:
      - Unit solutions from Current/Next_Day_Dispatch/ (~8 MB)
      - Prices from Archive/DispatchIS_Reports/ daily bundle (~5 MB, ZIP of ZIPs)

    Both sources are joined on SETTLEMENTDATE. Only intervals with both prices
    and unit solutions are included in the result.

    Args:
        day:    The trading day (AEST date), at least one day in the past.
                Up to ~13 months of history is available.
        client: Optional shared httpx.AsyncClient.

    Returns:
        DispatchDay with up to 288 DispatchInterval objects.

    Raises:
        httpx.HTTPStatusError: If either source file is not found.
        ValueError: If no matching intervals can be assembled.
    """
    # Fetch both sources concurrently
    import asyncio

    unit_sols_task = asyncio.create_task(_fetch_unit_solutions(day, client))
    prices_task = asyncio.create_task(_fetch_prices(day, client))
    unit_solutions_by_dt, prices_by_dt = await asyncio.gather(unit_sols_task, prices_task)

    # Join on settlement_date string
    all_dts = sorted(set(unit_solutions_by_dt) & set(prices_by_dt))
    intervals: list[DispatchInterval] = []
    for dt_str in all_dts:
        settlement_date = _parser.parse_datetime(dt_str)
        prices = prices_by_dt[dt_str]
        unit_solutions = unit_solutions_by_dt[dt_str]
        intervals.append(
            DispatchInterval(
                settlement_date=settlement_date,
                prices=prices,
                unit_solutions=unit_solutions,
            )
        )

    if not intervals:
        raise ValueError(f"No matching intervals assembled for trading day {day}")

    if len(intervals) < _EXPECTED_INTERVALS_PER_TRADING_DAY:
        warnings.warn(
            "Partial trading day assembled for "
            f"{day}: expected {_EXPECTED_INTERVALS_PER_TRADING_DAY} intervals, "
            f"got {len(intervals)} "
            f"({intervals[0].settlement_date} to {intervals[-1].settlement_date}).",
            stacklevel=2,
        )

    return DispatchDay(date=day, intervals=intervals)


# ---------------------------------------------------------------------------
# Internal fetchers
# ---------------------------------------------------------------------------


async def _fetch_unit_solutions(
    day: date, client: httpx.AsyncClient | None
) -> dict[str, dict[str, any]]:  # type: ignore[type-arg]
    """Fetch unit solutions from Next_Day_Dispatch, grouped by SETTLEMENTDATE."""
    files = await _client.list_directory(_client.NEXT_DAY_DISPATCH_DIR, client=client)
    target = day.strftime("%Y%m%d")
    matching = [f for f in files if _NEXT_DAY_FILE_RE.match(f) and target in f]
    if not matching:
        raise ValueError(f"No Next Day Dispatch file for {day}")
    url = f"{_client.NEXT_DAY_DISPATCH_DIR.rstrip('/')}/{matching[-1]}"
    zip_bytes = await _client.fetch_zip(url, client=client)
    return _parse_unit_solutions(zip_bytes)


async def _fetch_prices(day: date, client: httpx.AsyncClient | None) -> dict[str, dict[str, any]]:  # type: ignore[type-arg]
    """Fetch prices from day and day+1 archive bundles, grouped by SETTLEMENTDATE."""
    import asyncio

    url_day = _client.archive_dispatch_is_url(day)
    url_next = _client.archive_dispatch_is_url(day + timedelta(days=1))

    day_task = asyncio.create_task(_client.fetch_zip(url_day, client=client))
    next_task = asyncio.create_task(_fetch_zip_optional(url_next, client=client))
    day_zip_bytes, next_zip_bytes = await asyncio.gather(day_task, next_task)

    prices = _parse_archive_prices(day_zip_bytes)
    if next_zip_bytes is not None:
        prices.update(_parse_archive_prices(next_zip_bytes))
    return prices


async def _fetch_zip_optional(url: str, client: httpx.AsyncClient | None) -> bytes | None:
    """Fetch ZIP bytes, returning None when the file is not available yet (HTTP 404)."""
    try:
        return await _client.fetch_zip(url, client=client)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return None
        raise


def _parse_unit_solutions(zip_bytes: bytes) -> dict[str, dict]:
    """Parse Next_Day_Dispatch ZIP → {settlement_date_str: {duid: UnitSolution}}."""
    tables = _parser.parse_mms_zip(zip_bytes, tables=_UNIT_SOLUTION_TABLES)
    rows = [r for r in tables.get("UNIT_SOLUTION", []) if r.get("INTERVENTION", "0") == "0"]

    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row["SETTLEMENTDATE"]].append(row)

    return {dt: _build_unit_solutions(dt_rows) for dt, dt_rows in grouped.items()}


def _parse_archive_prices(zip_bytes: bytes) -> dict[str, dict]:
    """Parse Archive DispatchIS daily bundle → {settlement_date_str: {region: RegionPrices}}."""
    result: dict[str, dict] = {}
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as outer:
        inner_zips = sorted(n for n in outer.namelist() if n.upper().endswith(".ZIP"))
        for inner_name in inner_zips:
            try:
                inner_bytes = outer.read(inner_name)
                tables = _parser.parse_mms_zip(inner_bytes, tables=_PRICE_TABLES)
                rows = [r for r in tables.get("PRICE", []) if r.get("INTERVENTION", "0") == "0"]
                if not rows:
                    continue
                dt_str = rows[0]["SETTLEMENTDATE"]
                result[dt_str] = _build_prices(rows)
            except Exception:  # noqa: BLE001
                continue
    return result
