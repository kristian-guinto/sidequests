"""Provider Template for National Electricity Market Ingestion.

Replace <CountryName> and <CC> with the target country details (e.g. Vietnam / VN).
Subclass BaseProvider to implement facilities sync and interval generation fetching.
"""

import logging
from datetime import datetime, date, timedelta
from typing import List, Optional, Any, Callable
from zoneinfo import ZoneInfo

from pipeline.providers.base import BaseProvider
from pipeline.models import FacilityRecord, EnergyIntervalRecord
from pipeline.fx import get_fx_rate, ExchangeRateNotFoundError

logger = logging.getLogger(__name__)

# Define local timezone using ZoneInfo (NEVER import pytz)
LOCAL_TZ = ZoneInfo(
    "Asia/Bangkok"
)  # Example: UTC+7 for Thailand / Vietnam / Western Indonesia

# Set MARKET_HAS_SPOT_PRICES:
# True for wholesale spot markets (PH WESM, SG EMC, MY SMP).
# False for Single Buyer / regulated tariffs (TH EGAT, VN EVN, ID PLN).
MARKET_HAS_SPOT_PRICES = False
LOCAL_CURRENCY = "THB"  # Replace with target currency code (e.g. VND, IDR)


class CountryProvider(BaseProvider):
    """
    <CountryName> National Electricity Market Provider.
    Ingests facilities catalog and time-series generation dispatch by fuel technology.
    """

    def __init__(self, country_code: str = "<CC>"):
        super().__init__(country_code=country_code.upper())

    def fetch_facilities(self, conn: Optional[Any] = None) -> List[FacilityRecord]:
        """
        Fetches or defines national generator capacity catalog.
        Can load from a static JSON registry or scrape from an official market registry.
        """
        facilities: List[FacilityRecord] = []

        # Example manual / master facility record
        # In production, either parse from an official registry or pipeline/data/<cc>_generators.json
        example_plant = FacilityRecord(
            resource_id="<CC>_PLANT_01",
            facility_name="Sample Power Plant",
            region="ALL",
            country_code=self.country_code,
            fuel_tech="gas",
            capacity_mw=600.0,
            is_renewable=False,
            emissions_factor=0.38,
            status="ACTIVE",
        )
        facilities.append(example_plant)
        return facilities

    def fetch_energy_intervals(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        days: int = 2,
        conn: Optional[Any] = None,
        max_files: Optional[int] = None,
        on_batch: Optional[Callable[[List[EnergyIntervalRecord]], None]] = None,
        **kwargs: Any,
    ) -> List[EnergyIntervalRecord]:
        """
        Fetches dispatch intervals and spot prices.
        Downsamples or aligns to standard 5-minute, 30-minute, or 60-minute boundaries.
        Streams batches via `on_batch` callback for DuckDB bulk ingestion.
        """
        end = end_date or date.today()
        start = start_date or (end - timedelta(days=days))

        logger.info(f"Ingesting {self.country_code} intervals from {start} to {end}")

        records: List[EnergyIntervalRecord] = []
        batch_size = 500

        # Loop through dates or fetch from upstream API/telemetry feed
        current_date = start
        while current_date <= end:
            # 1. Fetch FX rate if the market publishes spot prices
            fx_rate = 1.0
            if MARKET_HAS_SPOT_PRICES and conn:
                try:
                    fx_rate = get_fx_rate(current_date, LOCAL_CURRENCY, conn=conn)
                except ExchangeRateNotFoundError:
                    logger.warning(
                        f"FX rate missing for {LOCAL_CURRENCY} on {current_date}"
                    )

            # 2. Extract intervals (e.g. 288 for 5m, 48 for 30m, 24 for 1h)
            # Timestamp must be a timezone-aware datetime
            dt = datetime(
                current_date.year,
                current_date.month,
                current_date.day,
                0,
                0,
                tzinfo=LOCAL_TZ,
            )

            # Construct EnergyIntervalRecord (canonical fuel generation)
            rec = EnergyIntervalRecord(
                country_code=self.country_code,
                interval_start=dt,
                region="ALL",
                fuel_tech="gas",
                generation_mw=500.0,
                energy_mwh=500.0 * (5.0 / 60.0),  # Adjust interval duration in hours
            )
            records.append(rec)

            # Note: For competitive wholesale spot markets, prices are stored in prices_interval
            # via PriceIntervalRecord(country_code=..., interval_start=dt, region="ALL",
            #                         price_local=50.0, price_dollar=50.0 / fx_rate)
            _ = fx_rate  # Reference to avoid unused variable warning

            # Flush batch if on_batch callback is provided
            if on_batch and len(records) >= batch_size:
                on_batch(records)
                records.clear()

            current_date += timedelta(days=1)

        # Flush any remaining records
        if on_batch and records:
            on_batch(records)
            records.clear()

        return records
