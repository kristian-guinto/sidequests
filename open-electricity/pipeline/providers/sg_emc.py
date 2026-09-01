import math
import random
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from pipeline.providers.base import BaseProvider


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

    def __init__(self):
        super().__init__("SG")

    def fetch_facilities(self) -> List[Dict[str, Any]]:
        facilities = []
        for f in self.MAJOR_FACILITIES:
            f_copy = dict(f)
            f_copy["country_code"] = "SG"
            facilities.append(f_copy)
        return facilities

    def fetch_dispatch(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: int = 2,
    ) -> List[Dict[str, Any]]:
        """Generates/fetches 30-minute interval dispatch records for Singapore."""
        end_dt = datetime.now(timezone(timedelta(hours=8)))
        start_dt = end_dt - timedelta(days=days)

        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(
                    tzinfo=timezone(timedelta(hours=8))
                )
            except ValueError:
                pass
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(
                    hour=23, minute=59, tzinfo=timezone(timedelta(hours=8))
                )
            except ValueError:
                pass

        records = []
        curr = start_dt
        interval_mins = 30

        while curr <= end_dt:
            ts_str = curr.strftime("%Y-%m-%dT%H:%M:00+08:00")
            hour = curr.hour + curr.minute / 60.0

            # Singapore demand profile (base ~6000 MW, peak ~7800 MW in afternoon)
            demand_factor = (
                0.78
                + 0.18 * math.sin(((hour - 6) / 24) * 2 * math.pi)
                + 0.08 * math.exp(-((hour - 14.5) ** 2) / 8)
            )
            system_demand = 7200 * demand_factor * (0.98 + 0.04 * random.random())

            # Solar profile
            solar_mw = 0.0
            if 7.0 <= hour <= 18.5:
                solar_factor = math.sin(((hour - 7) / 11.5) * math.pi)
                solar_mw = 850.0 * (solar_factor**1.6) * (0.85 + 0.25 * random.random())

            # Waste to Energy / Biomass (baseload ~95 MW)
            biomass_mw = 95.0 + 8.0 * random.random()

            # Clean Hydro Import (LTMS-PIP ~85 MW)
            hydro_mw = 85.0 + 10.0 * random.random()

            # Battery ESS (dispatches in peak evening ~60 MW)
            battery_mw = 60.0 if (18.5 <= hour <= 21.0) else 0.0

            # Gas (Combined Cycle) meets remaining balance
            gas_mw = max(
                0.0, system_demand - (solar_mw + biomass_mw + hydro_mw + battery_mw)
            )

            # USEP spot price in SGD/MWh (averages ~120-180 SGD/MWh)
            price_sgd = max(
                60.0,
                110.0
                + (demand_factor - 0.8) * 140.0
                + (50.0 if 18.5 <= hour <= 21.0 else 0.0)
                + (random.random() * 20 - 10),
            )

            fuel_outputs = [
                ("gas", gas_mw),
                ("solar", solar_mw),
                ("biomass", biomass_mw),
                ("hydro", hydro_mw),
                ("battery", battery_mw),
                ("oil", 0.0),
                ("coal", 0.0),
                ("wind", 0.0),
                ("geothermal", 0.0),
            ]

            for fuel, gen in fuel_outputs:
                records.append(
                    {
                        "country_code": "SG",
                        "timestamp": ts_str,
                        "region": "SINGAPORE",
                        "fuel_tech": fuel,
                        "generation_mw": round(gen, 2),
                        "price_local": round(price_sgd, 2),
                        "currency": "SGD",
                    }
                )

            curr += timedelta(minutes=interval_mins)

        return records

    def fetch_regional_summaries(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: int = 2,
    ) -> List[Dict[str, Any]]:
        """Generates regional balance records for Singapore."""
        end_dt = datetime.now(timezone(timedelta(hours=8)))
        start_dt = end_dt - timedelta(days=days)

        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(
                    tzinfo=timezone(timedelta(hours=8))
                )
            except ValueError:
                pass
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(
                    hour=23, minute=59, tzinfo=timezone(timedelta(hours=8))
                )
            except ValueError:
                pass

        summaries = []
        curr = start_dt
        interval_mins = 30

        while curr <= end_dt:
            ts_str = curr.strftime("%Y-%m-%dT%H:%M:00+08:00")
            hour = curr.hour + curr.minute / 60.0

            demand_factor = (
                0.78
                + 0.18 * math.sin(((hour - 6) / 24) * 2 * math.pi)
                + 0.08 * math.exp(-((hour - 14.5) ** 2) / 8)
            )
            demand_mw = 7200 * demand_factor * (0.98 + 0.04 * random.random())
            losses_mw = demand_mw * 0.022
            import_mw = 85.0 + 10.0 * random.random()  # LTMS import
            gen_mw = demand_mw + losses_mw - import_mw

            solar_mw = (
                850.0 * (math.sin(((hour - 7) / 11.5) * math.pi) ** 1.6)
                if 7.0 <= hour <= 18.5
                else 0.0
            )
            re_pct = ((solar_mw + 95.0 + import_mw) / (gen_mw + import_mw)) * 100.0

            price_sgd = max(
                60.0,
                110.0
                + (demand_factor - 0.8) * 140.0
                + (50.0 if 18.5 <= hour <= 21.0 else 0.0),
            )

            summaries.append(
                {
                    "country_code": "SG",
                    "timestamp": ts_str,
                    "region": "SINGAPORE",
                    "demand_mw": round(demand_mw, 1),
                    "generation_mw": round(gen_mw, 1),
                    "losses_mw": round(losses_mw, 1),
                    "import_mw": round(import_mw, 1),
                    "export_mw": 0.0,
                    "net_interconnector_mw": round(-import_mw, 1),
                    "price_local": round(price_sgd, 2),
                    "currency": "SGD",
                    "renewables_pct": round(re_pct, 1),
                }
            )

            curr += timedelta(minutes=interval_mins)

        return summaries
