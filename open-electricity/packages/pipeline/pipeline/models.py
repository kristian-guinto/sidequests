"""Domain models for OpenElectricity pipeline data structures matching DuckDB table schemas."""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional, ClassVar, List


@dataclass(frozen=True)
class FacilityRecord:
    """Represents a power generation facility or generator unit in the facilities table."""

    __table_name__: ClassVar[str] = "facilities"
    __primary_key__: ClassVar[List[str]] = ["country_code", "resource_id"]

    country_code: str
    resource_id: str
    facility_name: str
    region: str
    fuel_tech: str
    capacity_mw: float = 0.0
    is_renewable: bool = False
    emissions_factor: float = 0.0
    status: str = "ACTIVE"


@dataclass(frozen=True)
class EnergyIntervalRecord:
    """Represents high-resolution electricity generation and price in the energy_interval table."""

    __table_name__: ClassVar[str] = "energy_interval"
    __primary_key__: ClassVar[List[str]] = [
        "country_code",
        "interval_start",
        "region",
        "fuel_tech",
    ]

    country_code: str
    interval_start: datetime  # Timezone-aware datetime (e.g. +08:00)
    region: str
    fuel_tech: str
    generation_mw: float
    energy_mwh: float
    price_local: Optional[float] = None
    price_dollar: Optional[float] = None


@dataclass(frozen=True)
class EnergyDailyRecord:
    """Represents aggregated daily fuel mix generation and prices in the energy_daily table."""

    __table_name__: ClassVar[str] = "energy_daily"
    __primary_key__: ClassVar[List[str]] = [
        "country_code",
        "date",
        "region",
        "fuel_tech",
    ]

    country_code: str
    date: date
    region: str
    fuel_tech: str
    energy_mwh: float
    avg_generation_mw: float
    peak_generation_mw: float
    vwap_price_local: Optional[float] = None
    twap_price_local: Optional[float] = None
    vwap_price_dollar: Optional[float] = None
    twap_price_dollar: Optional[float] = None


@dataclass(frozen=True)
class ExchangeRateRecord:
    """Represents a daily foreign exchange rate in the exchange_rates table."""

    __table_name__: ClassVar[str] = "exchange_rates"
    __primary_key__: ClassVar[List[str]] = ["date", "currency"]

    date: date
    currency: str
    rate_to_usd: float


@dataclass(frozen=True)
class IngestRunReport:
    """Represents execution results of a pipeline ingestion run."""

    country_code: str
    facilities_synced: int
    intervals_synced: int
    daily_rollups_updated: bool
    status: str = "success"
    error: Optional[str] = None


TABLE_MODELS = [
    FacilityRecord,
    EnergyIntervalRecord,
    EnergyDailyRecord,
    ExchangeRateRecord,
]
