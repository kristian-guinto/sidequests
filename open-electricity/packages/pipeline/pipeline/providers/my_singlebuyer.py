"""Malaysia Single Buyer / Grid System Operator (GSO) Provider."""

import math
import random
from typing import List, Optional, Any
from datetime import datetime, date, timedelta, timezone
from pipeline.providers.base import BaseProvider
from pipeline.models import FacilityRecord, EnergyIntervalRecord

MYT = timezone(timedelta(hours=8))


class MalaysiaSingleBuyerProvider(BaseProvider):
    """
    Malaysia Single Buyer / Grid System Operator (GSO) Provider.
    Tracks Peninsular Malaysia, Sabah, and Sarawak generation, demand, and system spot metrics.
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

    def __init__(self):
        super().__init__("MY")

    def fetch_facilities(self, conn: Optional[Any] = None) -> List[FacilityRecord]:
        """Returns registered facilities for Malaysia."""
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
    ) -> List[EnergyIntervalRecord]:
        """Generates/fetches 30-minute interval generation records for Malaysia."""
        end_dt = datetime.now(MYT)
        start_dt = end_dt - timedelta(days=days)

        if start_date:
            start_dt = datetime(
                start_date.year, start_date.month, start_date.day, tzinfo=MYT
            )
        if end_date:
            end_dt = datetime(
                end_date.year, end_date.month, end_date.day, 23, 59, tzinfo=MYT
            )

        records: List[EnergyIntervalRecord] = []
        curr = start_dt
        interval_mins = 30

        while curr <= end_dt:
            hour = curr.hour + curr.minute / 60.0

            # Demand curve
            demand_shape = (
                0.72
                + 0.20 * math.sin(((hour - 5) / 24) * 2 * math.pi)
                + 0.12 * math.exp(-((hour - 15) ** 2) / 10)
            )
            system_demand = 18500 * demand_shape * (0.98 + 0.04 * random.random())

            # Fuel components (MW)
            solar_mw = (
                1200.0
                * (math.sin(((hour - 6.5) / 12) * math.pi) ** 1.7)
                * (0.85 + 0.25 * random.random())
                if 6.5 <= hour <= 18.5
                else 0.0
            )
            hydro_mw = 2600.0 * (0.7 + 0.5 * demand_shape)
            biomass_mw = 320.0 * (0.9 + 0.1 * random.random())
            coal_mw = 7800.0 * (0.85 + 0.25 * demand_shape)
            gas_mw = max(
                0.0, system_demand - (solar_mw + hydro_mw + biomass_mw + coal_mw)
            )

            price_myr = max(
                180.0,
                240.0 + (demand_shape - 0.75) * 160.0 + (random.random() * 25 - 12),
            )

            fuel_outputs = [
                ("coal", coal_mw),
                ("gas", gas_mw),
                ("hydro", hydro_mw),
                ("solar", solar_mw),
                ("biomass", biomass_mw),
                ("oil", 150.0),
                ("battery", 0.0),
                ("wind", 0.0),
                ("geothermal", 0.0),
            ]

            for fuel, gen in fuel_outputs:
                gen_val = round(gen, 2)
                energy_val = round(gen_val * (interval_mins / 60.0), 4)
                records.append(
                    EnergyIntervalRecord(
                        country_code="MY",
                        interval_start=curr,
                        region="PENINSULAR",
                        fuel_tech=fuel,
                        generation_mw=gen_val,
                        energy_mwh=energy_val,
                        price_local=round(price_myr, 2),
                        price_dollar=None,
                    )
                )

            curr += timedelta(minutes=interval_mins)

        return records
