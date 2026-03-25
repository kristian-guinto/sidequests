"""
Typed dataclasses for all NEM data structures.

All MW values are positive (the sign of cash flow is determined by context:
generator DUIDs earn on dispatch, load DUIDs pay).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

# The 8 FCAS services cleared in the NEM, in a stable canonical order.
FCAS_SERVICES: tuple[str, ...] = (
    "RAISE6SEC",
    "RAISE60SEC",
    "RAISE5MIN",
    "RAISEREG",
    "LOWER6SEC",
    "LOWER60SEC",
    "LOWER5MIN",
    "LOWERREG",
)


@dataclass(frozen=True, slots=True)
class RegionPrices:
    """Energy and FCAS clearing prices for one NEM region and dispatch interval."""

    region: str
    settlement_date: datetime
    rrp: float  # energy Regional Reference Price  $/MWh
    raise6sec: float  # FCAS prices, $/MWh
    raise60sec: float
    raise5min: float
    raisereg: float
    lower6sec: float
    lower60sec: float
    lower5min: float
    lowerreg: float

    def fcas_price(self, service: str) -> float:
        """Return the clearing price for a named FCAS service."""
        return getattr(self, service.lower())


@dataclass(frozen=True, slots=True)
class UnitSolution:
    """Per-DUID dispatch outcome for one 5-minute interval.

    TOTALCLEARED is the dispatch target used for settlement.
    The FCAS fields are enabled MW for each ancillary service.
    """

    duid: str
    settlement_date: datetime
    total_cleared: float  # MW dispatch target (energy)
    raise6sec: float  # FCAS enabled MW
    raise60sec: float
    raise5min: float
    raisereg: float
    lower6sec: float
    lower60sec: float
    lower5min: float
    lowerreg: float

    def fcas_mw(self, service: str) -> float:
        """Return enabled FCAS MW for a named service."""
        return getattr(self, service.lower())


@dataclass(frozen=True, slots=True)
class ScadaReading:
    """Actual metered MW for one DUID at one dispatch interval.

    Note: NEM settlement uses dispatch targets (UnitSolution.total_cleared),
    not SCADA actuals. SCADA is useful for operational monitoring and SOC tracking.
    """

    duid: str
    settlement_date: datetime
    scada_value: float  # actual metered MW


@dataclass(slots=True)
class DispatchInterval:
    """All prices and unit solutions for one 5-minute dispatch interval."""

    settlement_date: datetime
    prices: dict[str, RegionPrices]  # region → prices
    unit_solutions: dict[str, UnitSolution]  # duid → solution
    scada: dict[str, ScadaReading] = field(default_factory=dict)  # duid → reading

    def price(self, region: str) -> RegionPrices:
        try:
            return self.prices[region]
        except KeyError:
            available = ", ".join(sorted(self.prices))
            raise KeyError(f"No prices for region '{region}'. Available: {available}") from None

    def solution(self, duid: str) -> UnitSolution | None:
        return self.unit_solutions.get(duid)


@dataclass(slots=True)
class DispatchDay:
    """All 5-minute dispatch intervals for one NEM trading day (midnight–midnight AEST)."""

    date: date
    intervals: list[DispatchInterval]

    def __len__(self) -> int:
        return len(self.intervals)


@dataclass(slots=True)
class IntervalRevenue:
    """Revenue breakdown for one battery across one 5-minute dispatch interval.

    All dollar amounts are in AUD for the 5-minute interval duration.
    energy_revenue: income from discharging into the energy market
    energy_cost:    cost of absorbing energy while charging
    fcas_revenue:   income per FCAS service (8 services)
    """

    settlement_date: datetime
    battery_name: str
    energy_revenue: float
    energy_cost: float
    fcas_revenue: dict[str, float]  # service → $
    discharge_mw: float
    charge_mw: float

    @property
    def total_fcas(self) -> float:
        return sum(self.fcas_revenue.values())

    @property
    def net(self) -> float:
        return self.energy_revenue - self.energy_cost + self.total_fcas


@dataclass(slots=True)
class DailyRevenue:
    """Aggregated revenue for one battery across one trading day."""

    date: date
    battery_name: str
    intervals: list[IntervalRevenue]

    @property
    def total(self) -> float:
        return sum(i.net for i in self.intervals)

    @property
    def total_energy_revenue(self) -> float:
        return sum(i.energy_revenue for i in self.intervals)

    @property
    def total_energy_cost(self) -> float:
        return sum(i.energy_cost for i in self.intervals)

    @property
    def total_fcas_revenue(self) -> float:
        return sum(i.total_fcas for i in self.intervals)

    @property
    def net_energy(self) -> float:
        return self.total_energy_revenue - self.total_energy_cost
