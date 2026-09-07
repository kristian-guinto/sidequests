"""Singapore Energy Market Company (EMC) & Energy Market Authority (EMA) Provider."""

import logging
from typing import List, Optional, Any, Dict, Callable
from datetime import datetime, date, timedelta, timezone
from pipeline.providers.base import BaseProvider
from pipeline.models import FacilityRecord, EnergyIntervalRecord
from pipeline.emc_client import EMCClient
from pipeline.parsers.emc import EMCParser

logger = logging.getLogger(__name__)
SGT = timezone(timedelta(hours=8))


class SingaporeEMCProvider(BaseProvider):
    """
    Singapore Energy Market Company (EMC) & Energy Market Authority (EMA) Provider.
    Tracks 30-minute USEP (Uniform Singapore Energy Price), electricity demand, and generation mix.
    """

    MAJOR_FACILITIES = [
        {
            "resource_id": "SG_TUAS_CCGT",
            "facility_name": "Tuas Power Station (CCGT)",
            "region": "SINGAPORE",
            "fuel_tech": "gas",
            "capacity_mw": 2670.0,
            "is_renewable": False,
            "emissions_factor": 0.38,
            "status": "ACTIVE",
        },
        {
            "resource_id": "SG_SENOKO_CCGT",
            "facility_name": "Senoko Power Station (CCGT)",
            "region": "SINGAPORE",
            "fuel_tech": "gas",
            "capacity_mw": 2807.0,
            "is_renewable": False,
            "emissions_factor": 0.38,
            "status": "ACTIVE",
        },
        {
            "resource_id": "SG_YTL_SERAYA",
            "facility_name": "YTL PowerSeraya (CCGT & Co-gen)",
            "region": "SINGAPORE",
            "fuel_tech": "gas",
            "capacity_mw": 3040.0,
            "is_renewable": False,
            "emissions_factor": 0.38,
            "status": "ACTIVE",
        },
        {
            "resource_id": "SG_KEPPEL_MERLIMAU",
            "facility_name": "Keppel Merlimau Cogen",
            "region": "SINGAPORE",
            "fuel_tech": "gas",
            "capacity_mw": 1300.0,
            "is_renewable": False,
            "emissions_factor": 0.38,
            "status": "ACTIVE",
        },
        {
            "resource_id": "SG_SEMBCORP_COGEN",
            "facility_name": "Sembcorp Cogen (Jurong Island)",
            "region": "SINGAPORE",
            "fuel_tech": "gas",
            "capacity_mw": 1215.0,
            "is_renewable": False,
            "emissions_factor": 0.38,
            "status": "ACTIVE",
        },
        {
            "resource_id": "SG_TENGEH_SOLAR",
            "facility_name": "Sembcorp Floating Solar (Tengeh)",
            "region": "SINGAPORE",
            "fuel_tech": "solar",
            "capacity_mw": 60.0,
            "is_renewable": True,
            "emissions_factor": 0.0,
            "status": "ACTIVE",
        },
        {
            "resource_id": "SG_ROOFTOP_SOLAR",
            "facility_name": "Singapore SolarNova Distributed PV",
            "region": "SINGAPORE",
            "fuel_tech": "solar",
            "capacity_mw": 980.0,
            "is_renewable": True,
            "emissions_factor": 0.0,
            "status": "ACTIVE",
        },
        {
            "resource_id": "SG_TUAS_WTE",
            "facility_name": "Tuas South Waste-to-Energy Plant",
            "region": "SINGAPORE",
            "fuel_tech": "biomass",
            "capacity_mw": 120.0,
            "is_renewable": True,
            "emissions_factor": 0.02,
            "status": "ACTIVE",
        },
        {
            "resource_id": "SG_SEMBCORP_ESS",
            "facility_name": "Jurong Island Energy Storage System",
            "region": "SINGAPORE",
            "fuel_tech": "battery",
            "capacity_mw": 200.0,
            "is_renewable": True,
            "emissions_factor": 0.0,
            "status": "ACTIVE",
        },
        {
            "resource_id": "SG_LTMS_IMPORT",
            "facility_name": "Lao-Thailand-Malaysia-Singapore Interconnector",
            "region": "SINGAPORE",
            "fuel_tech": "hydro",
            "capacity_mw": 100.0,
            "is_renewable": True,
            "emissions_factor": 0.0,
            "status": "ACTIVE",
        },
    ]

    def __init__(self, conn: Optional[Any] = None, client: Optional[EMCClient] = None):
        super().__init__("SG")
        self.client = client or EMCClient()
        self.parser = EMCParser()

    def fetch_facilities(self, conn: Optional[Any] = None) -> List[FacilityRecord]:
        """
        Fetches registered power plant and generator capacity catalog.
        Attempts live download from EMC NEMS portal, falling back to curated registry if unreachable.
        """
        try:
            csv_text = self.client.download_facilities_csv()
            facs = self.parser.parse_registered_facilities(csv_text)
            if facs:
                logger.info("Fetched %d registered facilities from EMC.", len(facs))
                return facs
        except Exception as e:
            logger.warning(
                "Failed to fetch facilities from EMC portal: %s. Using curated baseline.",
                e,
            )

        return [
            FacilityRecord(
                country_code="SG",
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
        Fetches 30-minute interval generation and USEP price records for Singapore.
        Combines historical metered generation with USEP prices, and provisional real-time feeds for current days.
        """
        end_d = end_date or datetime.now(SGT).date()
        start_d = start_date or (end_d - timedelta(days=days))

        all_records: List[EnergyIntervalRecord] = []

        # 1. Try fetching historical USEP and metered generation for dates <= today - 6 days
        # (or for the requested range if finalized)
        price_map: Dict[datetime, float] = {}
        try:
            usep_csv = self.client.download_usep_demand_csv(start_d, end_d)
            parsed_usep = self.parser.parse_usep_demand(usep_csv)
            for dt, val in parsed_usep.items():
                price_map[dt] = val["usep"]
        except Exception as e:
            logger.debug("USEP download error: %s", e)

        # Try metered generation
        try:
            mg_csv = self.client.download_metered_generation_csv(start_d, end_d)
            mg_records = self.parser.parse_metered_generation(
                mg_csv, price_map=price_map
            )
            all_records.extend(mg_records)
            logger.info(
                "Ingested %d metered generation records for Singapore.", len(mg_records)
            )
        except Exception as e:
            logger.debug("Metered generation download error: %s", e)

        # 2. For dates where finalized metered generation is not yet published by EMC,
        # fetch the daily 48-period dataset (value=10 / RT48_EGO) per day
        dates_with_data = {r.interval_start.date() for r in all_records}
        curr_d = start_d
        now_sgt = datetime.now(SGT)
        while curr_d <= end_d:
            if curr_d not in dates_with_data:
                try:
                    rt_csv = self.client.download_realtime_csv(curr_d)
                    rt_records = self.parser.parse_realtime(rt_csv)
                    valid_recs = [r for r in rt_records if r.interval_start <= now_sgt]
                    if valid_recs:
                        all_records.extend(valid_recs)
                        print(
                            f"  -> [{curr_d}] Synced {len(valid_recs)} provisional intervals for Singapore."
                        )
                except Exception as e:
                    logger.warning("Real-time EMC download error for %s: %s", curr_d, e)
            curr_d += timedelta(days=1)

        if not all_records:
            logger.warning(
                "No energy interval records found for Singapore in date range %s to %s.",
                start_d,
                end_d,
            )

        return all_records
