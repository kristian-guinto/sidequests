"""Parser for Philippine IEMOP / WESM Real-Time Dispatch (RTD) market data."""

import csv
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import List, Dict, Tuple
from pipeline.generator_registry import GeneratorRegistry
from pipeline.models import EnergyIntervalRecord

MANILA_TZ = timezone(timedelta(hours=8))


class IEMOPParser:
    """Parses Philippine IEMOP RTD Prices & Schedules CSV lines into EnergyIntervalRecord objects."""

    def __init__(self, registry: GeneratorRegistry):
        self.registry = registry

    @staticmethod
    def parse_timestamp(time_str: str) -> datetime:
        """Parses IEMOP timestamp string into timezone-aware datetime (UTC+8)."""
        time_str = time_str.strip()
        formats = (
            "%m/%d/%Y %I:%M:%S %p",
            "%m/%d/%Y %I:%M %p",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M",
            "%m/%d/%Y",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
        )
        for fmt in formats:
            try:
                dt = datetime.strptime(time_str, fmt)
                return dt.replace(tzinfo=MANILA_TZ)
            except ValueError:
                continue
        # Fallback to current time if unparseable
        return datetime.now(MANILA_TZ)

    def parse_rtd_dispatch(self, csv_lines: List[str]) -> List[EnergyIntervalRecord]:
        """
        Parses raw unit dispatch CSV lines and produces 5-minute fuel mix aggregations
        as EnergyIntervalRecord dataclasses for individual regions and total Philippines ('ALL').
        """
        reader = csv.DictReader(csv_lines)

        # Bucket: (interval_dt, region, fuel_tech) -> {generation_mw, price_sum, count}
        buckets: Dict[Tuple[datetime, str, str], Dict[str, float]] = defaultdict(
            lambda: {"generation_mw": 0.0, "price_sum": 0.0, "count": 0.0}
        )

        for row in reader:
            if not row:
                continue

            res_type = (row.get("RESOURCE_TYPE") or "").strip().upper()
            if res_type != "G":
                # Only include generator units; skip node load or interconnector bids
                continue

            res_name = (row.get("RESOURCE_NAME") or "").strip().upper()
            region_raw = (row.get("REGION_NAME") or "").strip().upper()
            time_raw = (row.get("TIME_INTERVAL") or "").strip()

            if not res_name or not time_raw:
                continue

            try:
                sched_mw = float(row.get("SCHED_MW", 0.0) or 0.0)
            except (ValueError, TypeError):
                sched_mw = 0.0

            try:
                lmp = float(row.get("LMP", 0.0) or 0.0)
            except (ValueError, TypeError):
                lmp = 0.0

            interval_dt = self.parse_timestamp(time_raw)
            gen_info = self.registry.resolve_generator(res_name, region_raw)
            fuel_tech = gen_info["fuel_tech"]
            region = gen_info["region"]

            # Aggregate per specific region
            key = (interval_dt, region, fuel_tech)
            buckets[key]["generation_mw"] += max(0.0, sched_mw)
            buckets[key]["price_sum"] += lmp
            buckets[key]["count"] += 1.0

            # Aggregate for Total Philippines ('ALL')
            key_all = (interval_dt, "ALL", fuel_tech)
            buckets[key_all]["generation_mw"] += max(0.0, sched_mw)
            buckets[key_all]["price_sum"] += lmp
            buckets[key_all]["count"] += 1.0

        records: List[EnergyIntervalRecord] = []
        for (interval_dt, region, fuel_tech), data in buckets.items():
            count = data["count"]
            avg_price = data["price_sum"] / count if count > 0 else None
            gen_mw = round(data["generation_mw"], 2)
            # 5-minute interval energy MWh = MW * (5 / 60)
            energy_mwh = round(gen_mw * (5.0 / 60.0), 4)

            records.append(
                EnergyIntervalRecord(
                    country_code="PH",
                    interval_start=interval_dt,
                    region=region,
                    fuel_tech=fuel_tech,
                    generation_mw=gen_mw,
                    energy_mwh=energy_mwh,
                    price_local=round(avg_price, 2) if avg_price is not None else None,
                    price_dollar=None,  # Populated during DB upsert with exchange rate
                )
            )

        return records
