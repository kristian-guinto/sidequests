"""
Battery registry and revenue calculation.

NEM battery registration (as of 2024+)
---------------------------------------
Most utility-scale batteries in the NEM are now registered as a single
bidirectional DUID (generator_duid only, load_duid=None). In this mode:
  - TOTALCLEARED > 0  → discharging; earns energy revenue
  - TOTALCLEARED < 0  → charging; incurs energy cost

Older batteries (or some that retain legacy registration) use two separate DUIDs:
  - generator_duid → discharge direction (TOTALCLEARED > 0)
  - load_duid      → charge direction (TOTALCLEARED > 0, interpreted as cost)

Revenue calculation handles both models automatically based on whether load_duid
is set. FCAS enablement MW is always non-negative and summed across both DUIDs.

All DUIDs in KNOWN_BATTERIES are verified from live DISPATCH_UNIT_SOLUTION data.
"""

from __future__ import annotations

from dataclasses import dataclass

from nem_battery.types import (
    FCAS_SERVICES,
    DailyRevenue,
    DispatchDay,
    DispatchInterval,
    IntervalRevenue,
)

#: Duration of one dispatch interval in hours.
_INTERVAL_HOURS: float = 5.0 / 60.0


@dataclass(frozen=True)
class Battery:
    """A utility-scale battery storage system registered in the NEM.

    Args:
        name:            Human-readable asset name.
        region:          NEM region identifier (NSW1, QLD1, SA1, TAS1, VIC1).
        generator_duid:  Primary DUID. For bidirectional batteries this single
                         DUID covers both charge and discharge (negative
                         TOTALCLEARED = charging). For older registrations this
                         is the dedicated discharge DUID.
        load_duid:       Dedicated charge DUID for batteries registered with
                         separate generator/load units. None for bidirectional.
        mw_capacity:     Nameplate MW capacity (informational only).
        mwh_capacity:    Nameplate MWh capacity (informational only).
    """

    name: str
    region: str
    generator_duid: str
    load_duid: str | None = None
    mw_capacity: float | None = None
    mwh_capacity: float | None = None

    @property
    def duids(self) -> list[str]:
        """All DUIDs associated with this battery."""
        ids = [self.generator_duid]
        if self.load_duid is not None:
            ids.append(self.load_duid)
        return ids

    @property
    def bidirectional(self) -> bool:
        """True if this battery uses a single bidirectional DUID."""
        return self.load_duid is None


# ---------------------------------------------------------------------------
# Known Australian utility-scale batteries
#
# DUIDs verified from live AEMO DISPATCH_UNIT_SOLUTION data (March 2026).
# All listed batteries use single bidirectional DUIDs (load_duid=None) —
# negative TOTALCLEARED indicates charging.
#
# Batteries with unverified DUIDs are omitted; add custom Battery instances
# for any asset not listed here.
# ---------------------------------------------------------------------------

KNOWN_BATTERIES: dict[str, Battery] = {
    "hornsdale": Battery(
        name="Hornsdale Power Reserve",
        region="SA1",
        generator_duid="HPR1",
        mw_capacity=150.0,
        mwh_capacity=193.5,
    ),
    "victorian_big_battery": Battery(
        name="Victorian Big Battery",
        region="VIC1",
        generator_duid="VBB1",
        mw_capacity=300.0,
        mwh_capacity=450.0,
    ),
    "wallgrove": Battery(
        name="Wallgrove BESS",
        region="NSW1",
        generator_duid="WALGRV1",
        mw_capacity=50.0,
        mwh_capacity=75.0,
    ),
    "lake_bonney": Battery(
        name="Lake Bonney BESS",
        region="SA1",
        generator_duid="LBB1",
        mw_capacity=25.0,
        mwh_capacity=52.0,
    ),
    "gannawarra": Battery(
        name="Gannawarra ESS",
        region="VIC1",
        generator_duid="GANNB1",
        mw_capacity=25.0,
        mwh_capacity=50.0,
    ),
    "dalrymple_north": Battery(
        name="Dalrymple North BESS",
        region="SA1",
        generator_duid="DALNTH1",
        mw_capacity=30.0,
        mwh_capacity=8.0,
    ),
    "wandoan": Battery(
        name="Wandoan Power BESS",
        region="QLD1",
        generator_duid="WANDB1",
        mw_capacity=100.0,
        mwh_capacity=150.0,
    ),
    # --- Batteries added March 2026 (DUIDs from list-of-batteries.csv) ----
    "torrens_island": Battery(
        name="Torrens Island BESS",
        region="SA1",
        generator_duid="TIB1",
        mw_capacity=250.0,
        mwh_capacity=250.0,
    ),
    "blyth": Battery(
        name="Blyth BESS",
        region="SA1",
        generator_duid="BLYTHB1",
        mw_capacity=200.0,
        mwh_capacity=400.0,
    ),
    "templers": Battery(
        name="Templers BESS",
        region="SA1",
        generator_duid="TEMPB1",
        mw_capacity=138.0,
        mwh_capacity=330.0,
    ),
    "capital_battery": Battery(
        name="Capital Battery",
        region="NSW1",
        generator_duid="CAPBES1",
        mw_capacity=100.0,
        mwh_capacity=200.0,
    ),
    # "orana": Battery(  # DUID verified (ORABESS1) but still commissioning as of March 2026
    #     name="Orana BESS 1",
    #     region="NSW1",
    #     generator_duid="ORABESS1",
    #     mw_capacity=415.0,
    #     mwh_capacity=1660.0,
    # ),
    "rangebank": Battery(
        name="Rangebank BESS",
        region="VIC1",
        generator_duid="RANGEB1",
        mw_capacity=200.0,
        mwh_capacity=400.0,
    ),
    "hazelwood": Battery(
        name="Hazelwood BESS",
        region="VIC1",
        generator_duid="HBESS1",
        mw_capacity=150.0,
        mwh_capacity=150.0,
    ),
    "koorangie": Battery(
        name="Koorangie BESS",
        region="VIC1",
        generator_duid="KESSB1",
        mw_capacity=119.0,
        mwh_capacity=119.0,
    ),
    "tarong": Battery(
        name="Tarong BESS",
        region="QLD1",
        generator_duid="TARBESS1",
        mw_capacity=300.0,
        mwh_capacity=600.0,
    ),
    "western_downs": Battery(
        name="Western Downs BESS",
        region="QLD1",
        generator_duid="WDBESS1",
        mw_capacity=270.0,
        mwh_capacity=540.0,
    ),
    "greenbank": Battery(
        name="Greenbank BESS",
        region="QLD1",
        generator_duid="GREENB1",
        mw_capacity=200.0,
        mwh_capacity=400.0,
    ),
}


# ---------------------------------------------------------------------------
# Revenue calculation
# ---------------------------------------------------------------------------


def calculate_revenue(
    battery: Battery,
    interval: DispatchInterval,
) -> IntervalRevenue:
    """Calculate revenue for one battery across one 5-minute dispatch interval.

    Uses dispatch targets (TOTALCLEARED) for energy and FCAS enablement MW
    from DISPATCH_UNIT_SOLUTION, combined with clearing prices from
    DISPATCH_PRICE. This matches NEM settlement methodology.

    For bidirectional batteries (load_duid=None), positive TOTALCLEARED is
    discharge (revenue) and negative TOTALCLEARED is charge (cost).
    For legacy two-DUID batteries, both DUIDs have positive TOTALCLEARED.

    Args:
        battery:  Battery definition (name, region, DUIDs).
        interval: Parsed DispatchInterval from a DispatchIS or archive fetch.

    Returns:
        IntervalRevenue with energy and FCAS breakdown.

    Raises:
        KeyError: If the battery's region has no prices in the interval.
    """
    prices = interval.price(battery.region)
    gen_sol = interval.solution(battery.generator_duid)
    load_sol = interval.solution(battery.load_duid) if battery.load_duid else None

    if battery.bidirectional:
        # Single bidirectional DUID: positive = discharge, negative = charge.
        # Add 0.0 to convert -0.0 (Python float artefact) to 0.0.
        raw_mw = gen_sol.total_cleared if gen_sol else 0.0
        discharge_mw = max(raw_mw, 0.0) + 0.0
        charge_mw = max(-raw_mw, 0.0) + 0.0
    else:
        # Legacy separate generator + load DUIDs: both positive by convention
        discharge_mw = gen_sol.total_cleared if gen_sol else 0.0
        charge_mw = load_sol.total_cleared if load_sol else 0.0

    energy_revenue = discharge_mw * prices.rrp * _INTERVAL_HOURS
    energy_cost = charge_mw * prices.rrp * _INTERVAL_HOURS

    fcas_revenue: dict[str, float] = {}
    for svc in FCAS_SERVICES:
        svc_price = prices.fcas_price(svc)
        gen_mw = gen_sol.fcas_mw(svc) if gen_sol else 0.0
        load_mw = load_sol.fcas_mw(svc) if load_sol else 0.0
        fcas_revenue[svc] = (gen_mw + load_mw) * svc_price * _INTERVAL_HOURS

    return IntervalRevenue(
        settlement_date=interval.settlement_date,
        battery_name=battery.name,
        energy_revenue=energy_revenue,
        energy_cost=energy_cost,
        fcas_revenue=fcas_revenue,
        discharge_mw=discharge_mw,
        charge_mw=charge_mw,
    )


def calculate_daily_revenue(
    battery: Battery,
    day: DispatchDay,
) -> DailyRevenue:
    """Calculate revenue for one battery across a full trading day.

    Intervals where the battery's region has no prices are skipped silently
    (this can occur around market suspensions or data gaps).

    Args:
        battery: Battery definition.
        day:     DispatchDay from fetch_next_day_dispatch().

    Returns:
        DailyRevenue aggregating all intervals.
    """
    intervals: list[IntervalRevenue] = []
    for interval in day.intervals:
        if battery.region not in interval.prices:
            continue
        intervals.append(calculate_revenue(battery, interval))
    return DailyRevenue(
        date=day.date,
        battery_name=battery.name,
        intervals=intervals,
    )
