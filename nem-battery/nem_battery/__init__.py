"""
nem-battery: AEMO NEM data client for Australian battery storage analysis.

Quick-start examples
--------------------

Latest dispatch interval::

    import asyncio
    from nem_battery import fetch_dispatch_interval, KNOWN_BATTERIES, calculate_revenue

    async def main():
        interval = await fetch_dispatch_interval()
        hpr = KNOWN_BATTERIES["hornsdale"]
        rev = calculate_revenue(hpr, interval)
        print(f"Hornsdale net revenue this interval: ${rev.net:.2f}")
        print(f"  discharge {rev.discharge_mw:.1f} MW @ ${interval.price(hpr.region).rrp:.2f}/MWh")

    asyncio.run(main())

Historical full-day revenue::

    from datetime import date
    from nem_battery import fetch_next_day_dispatch, calculate_daily_revenue, KNOWN_BATTERIES

    async def main():
        vbb = KNOWN_BATTERIES["victorian_big_battery"]
        day = await fetch_next_day_dispatch(date(2026, 3, 16))
        rev = calculate_daily_revenue(vbb, day)
        print(f"VBB daily revenue: ${rev.total:,.0f}")
        print(f"  energy: ${rev.net_energy:,.0f}  |  FCAS: ${rev.total_fcas_revenue:,.0f}")

    asyncio.run(main())

Real-time stream::

    from nem_battery import stream_dispatch, KNOWN_BATTERIES, calculate_revenue

    async def main():
        hpr = KNOWN_BATTERIES["hornsdale"]
        async for interval in stream_dispatch():
            rev = calculate_revenue(hpr, interval)
            print(f"{interval.settlement_date}  net=${rev.net:.2f}")

    asyncio.run(main())
"""

from nem_battery.battery import (
    KNOWN_BATTERIES,
    Battery,
    calculate_daily_revenue,
    calculate_revenue,
)
from nem_battery.reports.dispatch import fetch_dispatch_interval
from nem_battery.reports.nextday import fetch_next_day_dispatch
from nem_battery.reports.scada import fetch_scada
from nem_battery.reports.trading import fetch_trading_prices
from nem_battery.stream import stream_dispatch, stream_dispatch_to
from nem_battery.types import (
    FCAS_SERVICES,
    DailyRevenue,
    DispatchDay,
    DispatchInterval,
    IntervalRevenue,
    RegionPrices,
    ScadaReading,
    UnitSolution,
)

__all__ = [
    # Battery
    "Battery",
    "KNOWN_BATTERIES",
    "calculate_revenue",
    "calculate_daily_revenue",
    # Fetchers
    "fetch_dispatch_interval",
    "fetch_next_day_dispatch",
    "fetch_scada",
    "fetch_trading_prices",
    # Streaming
    "stream_dispatch",
    "stream_dispatch_to",
    # Types
    "FCAS_SERVICES",
    "RegionPrices",
    "UnitSolution",
    "ScadaReading",
    "DispatchInterval",
    "DispatchDay",
    "IntervalRevenue",
    "DailyRevenue",
]
