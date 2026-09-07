"""Parser for Malaysia Single Buyer and Grid System Operator (GSO) market data."""

import re
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Any
from pipeline.config import DEFAULT_EMISSIONS_FACTOR, RENEWABLE_FUELS
from pipeline.models import FacilityRecord, EnergyIntervalRecord

MYT = timezone(timedelta(hours=8))

GSO_FUEL_MAP = {
    "COAL": "coal",
    "GAS": "gas",
    "WATER": "hydro",
    "HYDRO": "hydro",
    "SOLAR": "solar",
    "OIL": "oil",
    "BIOMASS": "biomass",
    "COGEN": "biomass",
}

SB_SERIES_FUEL_MAP = {
    "coal": "coal",
    "gas": "gas",
    "solar": "solar",
    "hydro": "hydro",
    "others": "biomass",
}


class SingleBuyerParser:
    """Parses Single Buyer and GSO electricity data into canonical DTO models."""

    @staticmethod
    def parse_power_stations(plants: List[Dict[str, Any]]) -> List[FacilityRecord]:
        """
        Parses registered power stations list from GSO PowerStation endpoint.
        Returns a list of FacilityRecord dataclasses.
        """
        if not plants:
            return []

        records: List[FacilityRecord] = []
        for p in plants:
            name = str(p.get("Name", "")).strip()
            if not name:
                continue

            raw_fuel = str(p.get("Fuel", "")).strip().upper()
            fuel_tech = GSO_FUEL_MAP.get(raw_fuel, "unclassified")

            raw_cap = p.get("Capacity (MW)", p.get("Capacity", 0.0))
            try:
                capacity_mw = float(raw_cap or 0.0)
            except (ValueError, TypeError):
                capacity_mw = 0.0

            res_id_clean = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_").upper()
            res_id = f"MY_{res_id_clean}"

            is_renewable = fuel_tech in RENEWABLE_FUELS
            emissions = DEFAULT_EMISSIONS_FACTOR.get(fuel_tech, 0.0)

            records.append(
                FacilityRecord(
                    country_code="MY",
                    resource_id=res_id,
                    facility_name=name,
                    region="PENINSULAR",
                    fuel_tech=fuel_tech,
                    capacity_mw=round(capacity_mw, 2),
                    is_renewable=is_renewable,
                    emissions_factor=emissions,
                    status="ACTIVE",
                )
            )

        return records

    @staticmethod
    def parse_smp_prices(smp_json: Dict[str, Any]) -> Dict[datetime, float]:
        """
        Parses half-hourly System Marginal Price (SMP) from Single Buyer API.
        Extracts prices in RM/MWh (API provides RM/kWh, multiplied by 1000).
        Prefers settled 'actual' SMP, falling back to 'forecast' SMP.
        """
        results: Dict[datetime, float] = {}
        data_block = smp_json.get("meta", {}).get("data", {})
        forecast_list = data_block.get("forecast", [])
        actual_list = data_block.get("actual", [])

        # Process forecast first
        for item in forecast_list:
            t_str = item.get("t")
            v_val = item.get("v")
            if not t_str or v_val is None:
                continue
            try:
                # ISO format e.g. 2026-08-01T00:00:00 or 2026-08-01 00:00:00
                dt_naive = datetime.fromisoformat(t_str.replace(" ", "T"))
                dt = datetime(
                    dt_naive.year,
                    dt_naive.month,
                    dt_naive.day,
                    dt_naive.hour,
                    dt_naive.minute,
                    tzinfo=MYT,
                )
                price_myr_mwh = round(float(v_val) * 1000.0, 2)
                results[dt] = price_myr_mwh
            except (ValueError, TypeError):
                continue

        # Overwrite with settled actual when available
        for item in actual_list:
            t_str = item.get("t")
            v_val = item.get("v")
            if not t_str or v_val is None:
                continue
            try:
                dt_naive = datetime.fromisoformat(t_str.replace(" ", "T"))
                dt = datetime(
                    dt_naive.year,
                    dt_naive.month,
                    dt_naive.day,
                    dt_naive.hour,
                    dt_naive.minute,
                    tzinfo=MYT,
                )
                price_myr_mwh = round(float(v_val) * 1000.0, 2)
                results[dt] = price_myr_mwh
            except (ValueError, TypeError):
                continue

        return results

    @staticmethod
    def parse_day_generation_mix(
        gen_mix_json: Dict[str, Any],
        smp_lookup: Optional[Dict[datetime, float]] = None,
    ) -> List[EnergyIntervalRecord]:
        """
        Parses 30-minute day generation mix series from Single Buyer API.
        series: {'coal': {'data': [{'t': '2026-09-06 00:00', 'v': 10638.34}, ...]}, ...}
        """
        records: List[EnergyIntervalRecord] = []
        series_dict = gen_mix_json.get("series", {})
        prices = smp_lookup or {}

        for raw_fuel_key, fuel_data in series_dict.items():
            fuel_tech = SB_SERIES_FUEL_MAP.get(raw_fuel_key.lower(), "unclassified")
            points = fuel_data.get("data", [])

            for pt in points:
                t_str = pt.get("t")
                v_val = pt.get("v")
                if not t_str or v_val is None:
                    continue

                try:
                    dt_naive = datetime.fromisoformat(t_str.replace(" ", "T"))
                    dt = datetime(
                        dt_naive.year,
                        dt_naive.month,
                        dt_naive.day,
                        dt_naive.hour,
                        dt_naive.minute,
                        tzinfo=MYT,
                    )
                    gen_mw = round(float(v_val), 2)
                    # 30-minute interval
                    energy_mwh = round(gen_mw * 0.5, 4)
                    price = prices.get(dt)

                    records.append(
                        EnergyIntervalRecord(
                            country_code="MY",
                            interval_start=dt,
                            region="PENINSULAR",
                            fuel_tech=fuel_tech,
                            generation_mw=gen_mw,
                            energy_mwh=energy_mwh,
                            price_local=price,
                            price_dollar=None,
                        )
                    )
                except (ValueError, TypeError):
                    continue

        return records

    @staticmethod
    def parse_gso_current_gen(
        gso_rows: List[Dict[str, Any]],
        smp_lookup: Optional[Dict[datetime, float]] = None,
    ) -> List[EnergyIntervalRecord]:
        """
        Parses 10-minute real-time generation dispatch from GSO CurrentGen endpoint.
        Example row: {'DT': '2026-09-07T00:00:00', 'Coal': 9852, 'Gas': 8682, 'CoGen': 5, 'Oil': 0, 'Hydro': 663, 'Solar': 1}
        """
        records: List[EnergyIntervalRecord] = []
        prices = smp_lookup or {}

        fuel_keys = [
            ("Coal", "coal"),
            ("Gas", "gas"),
            ("CoGen", "biomass"),
            ("Oil", "oil"),
            ("Hydro", "hydro"),
            ("Solar", "solar"),
        ]

        for row in gso_rows:
            dt_str = row.get("DT")
            if not dt_str:
                continue

            try:
                dt_naive = datetime.fromisoformat(dt_str.replace(" ", "T"))
                dt = datetime(
                    dt_naive.year,
                    dt_naive.month,
                    dt_naive.day,
                    dt_naive.hour,
                    dt_naive.minute,
                    tzinfo=MYT,
                )

                # For 10-minute dispatch, match nearest half-hour SMP price
                half_hour_dt = dt.replace(minute=(dt.minute // 30) * 30, second=0)
                price = prices.get(dt, prices.get(half_hour_dt))

                for gso_key, canonical_fuel in fuel_keys:
                    raw_mw = row.get(gso_key, 0.0)
                    gen_mw = round(max(0.0, float(raw_mw or 0.0)), 2)
                    # 10-minute interval -> energy MWh = MW * (10 / 60)
                    energy_mwh = round(gen_mw * (10.0 / 60.0), 4)

                    records.append(
                        EnergyIntervalRecord(
                            country_code="MY",
                            interval_start=dt,
                            region="PENINSULAR",
                            fuel_tech=canonical_fuel,
                            generation_mw=gen_mw,
                            energy_mwh=energy_mwh,
                            price_local=price,
                            price_dollar=None,
                        )
                    )
            except (ValueError, TypeError):
                continue

        return records
