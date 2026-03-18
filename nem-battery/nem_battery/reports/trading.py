"""
Fetch and parse TradingIS reports — 30-minute settlement prices.

Published every 30 minutes to:
  https://www.nemweb.com.au/Reports/Current/TradingIS_Reports/

The NEM settles financial transactions at the *trading interval* price
(TRADING_PRICE.RRP), which is the time-weighted average of the six
5-minute dispatch prices within each 30-minute period. This is the
price used in generator/load revenue settlement — not the dispatch price.

For battery dashboard purposes:
  - Use DispatchIS prices for real-time operational monitoring
  - Use TradingIS prices for financial revenue/cost calculations
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import httpx

from nem_battery import _client, _parser

_TABLES = {"PRICE"}


@dataclass(frozen=True, slots=True)
class TradingPrice:
    """Settlement prices for one NEM region and 30-minute trading interval."""

    region: str
    settlement_date: datetime  # end of the 30-minute trading interval
    rrp: float  # trading interval energy price $/MWh
    raise6sec: float
    raise60sec: float
    raise5min: float
    raisereg: float
    lower6sec: float
    lower60sec: float
    lower5min: float
    lowerreg: float


async def fetch_trading_prices(
    client: httpx.AsyncClient | None = None,
) -> dict[str, TradingPrice]:
    """Fetch the latest 30-minute trading interval prices.

    Returns:
        Dict of region → TradingPrice.
    """
    _, zip_bytes = await _client.fetch_latest_zip(_client.TRADING_IS_DIR, client=client)
    return parse_zip(zip_bytes)


def parse_zip(zip_bytes: bytes) -> dict[str, TradingPrice]:
    """Parse a raw TradingIS ZIP without making any HTTP requests."""
    tables = _parser.parse_mms_zip(zip_bytes, tables=_TABLES)
    return _build(tables.get("PRICE", []))


def _build(rows: list[dict[str, str]]) -> dict[str, TradingPrice]:
    prices: dict[str, TradingPrice] = {}
    for row in rows:
        if row.get("INTERVENTION", "0") != "0":
            continue
        region = row["REGIONID"]
        prices[region] = TradingPrice(
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
