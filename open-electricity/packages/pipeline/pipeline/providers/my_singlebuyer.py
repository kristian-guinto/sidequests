"""Malaysia Single Buyer / Grid System Operator (GSO) Provider."""

import logging
from typing import List, Optional, Any, Dict, Callable
from datetime import datetime, date, timedelta, timezone
from pipeline.providers.base import BaseProvider
from pipeline.models import FacilityRecord, EnergyIntervalRecord
from pipeline.singlebuyer_client import SingleBuyerClient
from pipeline.parsers.singlebuyer import SingleBuyerParser

logger = logging.getLogger(__name__)
MYT = timezone(timedelta(hours=8))


class MalaysiaSingleBuyerProvider(BaseProvider):
    """
    Malaysia Single Buyer / Grid System Operator (GSO) Provider.
    Tracks Peninsular Malaysia generation mix, demand, and System Marginal Price (SMP).
    """

    MAJOR_FACILITIES = [
        {
            "resource_id": "MY_JIMAH_EAST",
            "facility_name": "Jimah East Power (Coal)",
            "region": "PENINSULAR",
            "fuel_tech": "coal",
            "capacity_mw": 2000.0,
            "is_renewable": False,
            "emissions_factor": 0.90,
            "status": "ACTIVE",
        },
        {
            "resource_id": "MY_MANJUNG",
            "facility_name": "Sultan Azlan Shah Manjung (Coal)",
            "region": "PENINSULAR",
            "fuel_tech": "coal",
            "capacity_mw": 4100.0,
            "is_renewable": False,
            "emissions_factor": 0.90,
            "status": "ACTIVE",
        },
        {
            "resource_id": "MY_TANJUNG_BIN",
            "facility_name": "Tanjung Bin Power Plant (Coal)",
            "region": "PENINSULAR",
            "fuel_tech": "coal",
            "capacity_mw": 3100.0,
            "is_renewable": False,
            "emissions_factor": 0.90,
            "status": "ACTIVE",
        },
        {
            "resource_id": "MY_EDRA_ALOR_GAJAH",
            "facility_name": "Edra Melaka Power Plant (CCGT Gas)",
            "region": "PENINSULAR",
            "fuel_tech": "gas",
            "capacity_mw": 2242.0,
            "is_renewable": False,
            "emissions_factor": 0.38,
            "status": "ACTIVE",
        },
        {
            "resource_id": "MY_SULTAN_ISMAIL",
            "facility_name": "Sultan Ismail Paka (Gas)",
            "region": "PENINSULAR",
            "fuel_tech": "gas",
            "capacity_mw": 1400.0,
            "is_renewable": False,
            "emissions_factor": 0.38,
            "status": "ACTIVE",
        },
        {
            "resource_id": "MY_BAKUN_HYDRO",
            "facility_name": "Bakun Hydroelectric Dam",
            "region": "SARAWAK",
            "fuel_tech": "hydro",
            "capacity_mw": 2400.0,
            "is_renewable": True,
            "emissions_factor": 0.0,
            "status": "ACTIVE",
        },
        {
            "resource_id": "MY_MURUM_HYDRO",
            "facility_name": "Murum Hydroelectric Dam",
            "region": "SARAWAK",
            "fuel_tech": "hydro",
            "capacity_mw": 944.0,
            "is_renewable": True,
            "emissions_factor": 0.0,
            "status": "ACTIVE",
        },
        {
            "resource_id": "MY_KENYIR_HYDRO",
            "facility_name": "Sultan Mahmud Kenyir Hydro",
            "region": "PENINSULAR",
            "fuel_tech": "hydro",
            "capacity_mw": 400.0,
            "is_renewable": True,
            "emissions_factor": 0.0,
            "status": "ACTIVE",
        },
        {
            "resource_id": "MY_LSS_KUALA_LANGAT",
            "facility_name": "Kuala Langat Large Scale Solar",
            "region": "PENINSULAR",
            "fuel_tech": "solar",
            "capacity_mw": 50.0,
            "is_renewable": True,
            "emissions_factor": 0.0,
            "status": "ACTIVE",
        },
        {
            "resource_id": "MY_LSS_MARANG",
            "facility_name": "Marang Solar Park",
            "region": "PENINSULAR",
            "fuel_tech": "solar",
            "capacity_mw": 116.0,
            "is_renewable": True,
            "emissions_factor": 0.0,
            "status": "ACTIVE",
        },
    ]

    def __init__(
        self,
        conn: Optional[Any] = None,
        client: Optional[SingleBuyerClient] = None,
    ):
        super().__init__("MY")
        self.client = client or SingleBuyerClient()
        self.parser = SingleBuyerParser()

    def fetch_facilities(self, conn: Optional[Any] = None) -> List[FacilityRecord]:
        """
        Fetches registered power plant catalog for Malaysia.
        Attempts live fetch from GSO PowerStation endpoint, falling back to curated list if unreachable.
        """
        try:
            plants = self.client.get_power_stations()
            facs = self.parser.parse_power_stations(plants)
            if facs:
                logger.info("Fetched %d registered facilities from GSO.", len(facs))
                return facs
        except Exception as e:
            logger.warning(
                "Failed to fetch facilities from GSO: %s. Using curated baseline.", e
            )

        return [
            FacilityRecord(
                country_code="MY",
                resource_id=str(f["resource_id"]),
                facility_name=str(f["facility_name"]),
                region=str(f["region"]),
                fuel_tech=str(f["fuel_tech"]),
                capacity_mw=float(f["capacity_mw"]),
                is_renewable=bool(f["is_renewable"]),
                emissions_factor=float(f["emissions_factor"]),
                status=str(f["status"]),
            )
            for f in self.MAJOR_FACILITIES
        ]

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
        Fetches 30-minute interval generation and SMP price records for Malaysia.
        Combines Single Buyer 30-minute day generation mix with SMP spot prices,
        falling back to GSO real-time dispatch if needed.
        """
        end_d = end_date or datetime.now(MYT).date()
        start_d = start_date or (end_d - timedelta(days=days))

        all_records: List[EnergyIntervalRecord] = []

        # 1. Fetch SMP prices across the date range
        smp_lookup: Dict[datetime, float] = {}
        try:
            smp_json = self.client.get_smp_prices(start_d, end_d)
            smp_lookup = self.parser.parse_smp_prices(smp_json)
            if smp_lookup:
                logger.info(
                    "Fetched %d SMP price points for Malaysia.", len(smp_lookup)
                )
        except Exception as e:
            logger.warning("Failed to fetch Single Buyer SMP prices: %s", e)

        # 2. Fetch Single Buyer 30-minute Day Generation Mix per day (with per-day GSO fallback)
        curr_d = start_d
        now_myt = datetime.now(MYT)
        while curr_d <= end_d:
            day_records = []
            try:
                mix_json = self.client.get_day_generation_mix(curr_d)
                day_records = self.parser.parse_day_generation_mix(
                    mix_json, smp_lookup=smp_lookup
                )
            except Exception as e:
                logger.warning(
                    "Failed to fetch Single Buyer generation mix for %s: %s",
                    curr_d,
                    e,
                )

            # Fallback to GSO 10-minute dispatch if Single Buyer had no records for this date (e.g. holidays / weekends)
            if not day_records:
                try:
                    gso_rows = self.client.get_gso_current_gen(curr_d, curr_d)
                    day_records = self.parser.parse_gso_current_gen(
                        gso_rows, smp_lookup=smp_lookup
                    )
                except Exception as e:
                    logger.warning("Failed GSO fallback for %s: %s", curr_d, e)

            if day_records:
                valid_recs = [r for r in day_records if r.interval_start <= now_myt]
                if valid_recs:
                    all_records.extend(valid_recs)
                    print(
                        f"  -> [{curr_d}] Ingested {len(valid_recs)} intervals for Malaysia."
                    )

            curr_d += timedelta(days=1)

        if not all_records:
            logger.warning(
                "No energy interval records found for Malaysia in date range %s to %s.",
                start_d,
                end_d,
            )

        return all_records
