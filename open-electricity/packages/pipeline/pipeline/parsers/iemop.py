"""Parser for Philippine IEMOP / WESM Real-Time Dispatch (RTD) market data."""

import csv
import functools
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import List, Dict, Tuple, Optional
from pipeline.generator_registry import GeneratorRegistry
from pipeline.models import (
    EnergyIntervalRecord,
    PriceIntervalRecord,
    NodalDispatchRecord,
)
from pipeline.classifiers.ph_wesm import REGION_MAP

MANILA_TZ = timezone(timedelta(hours=8))


class IEMOPParser:
    """Parses Philippine IEMOP RTD Prices & Schedules CSV lines into EnergyIntervalRecord and PriceIntervalRecord objects."""

    def __init__(self, registry: GeneratorRegistry):
        self.registry = registry

    _last_format: Optional[str] = None

    @staticmethod
    @functools.lru_cache(maxsize=4096)
    def parse_timestamp(time_str: str) -> datetime:
        """Parses IEMOP timestamp string into timezone-aware datetime (UTC+8)."""
        time_str = time_str.strip()
        formats = (
            "%m/%d/%Y %I:%M:%S %p",
            "%m/%d/%Y %I:%M %p",
            "%m/%d/%Y %H:%M:%S %p",
            "%m/%d/%Y %H:%M %p",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M",
            "%m/%d/%Y",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
        )
        # Try the last successful format first if available
        if IEMOPParser._last_format:
            try:
                dt = datetime.strptime(time_str, IEMOPParser._last_format)
                return dt.replace(tzinfo=MANILA_TZ)
            except ValueError:
                pass

        for fmt in formats:
            try:
                dt = datetime.strptime(time_str, fmt)
                IEMOPParser._last_format = fmt
                return dt.replace(tzinfo=MANILA_TZ)
            except ValueError:
                continue
        raise ValueError(f"Unparseable IEMOP timestamp: '{time_str}'")

    def parse_rtd_dispatch_with_nodal(
        self, csv_lines: List[str]
    ) -> Tuple[
        List[EnergyIntervalRecord],
        List[PriceIntervalRecord],
        List[NodalDispatchRecord],
    ]:
        """
        Parses raw unit dispatch CSV lines and produces 5-minute fuel mix aggregations
        as EnergyIntervalRecord dataclasses, regional GWAP/LWAP prices as PriceIntervalRecord,
        and raw nodal generation/load dispatch as NodalDispatchRecord.
        """
        reader = csv.DictReader(csv_lines)

        # Bucket generation: (interval_dt, region, fuel_tech) -> generation_mw
        gen_buckets: Dict[Tuple[datetime, str, str], float] = defaultdict(float)
        gen_rev_buckets: Dict[Tuple[datetime, str, str], float] = defaultdict(float)
        gen_lmp_buckets: Dict[Tuple[datetime, str, str], Dict[str, float]] = (
            defaultdict(lambda: {"lmp_sum": 0.0, "count": 0.0})
        )

        # Bucket GWAP price from generators: (interval_dt, region) -> {rev_sum, mw_sum, lmp_sum, count}
        price_buckets: Dict[Tuple[datetime, str], Dict[str, float]] = defaultdict(
            lambda: {"rev_sum": 0.0, "mw_sum": 0.0, "lmp_sum": 0.0, "count": 0.0}
        )

        # Bucket LWAP price and demand from loads: (interval_dt, region) -> {rev_sum, mw_sum, lmp_sum, count}
        load_buckets: Dict[Tuple[datetime, str], Dict[str, float]] = defaultdict(
            lambda: {"rev_sum": 0.0, "mw_sum": 0.0, "lmp_sum": 0.0, "count": 0.0}
        )

        nodal_records: List[NodalDispatchRecord] = []

        for row in reader:
            if not row:
                continue

            time_raw = (row.get("TIME_INTERVAL") or "").strip()
            res_name = (row.get("RESOURCE_NAME") or "").strip().upper()
            res_type = (row.get("RESOURCE_TYPE") or "").strip().upper()
            region_raw = (row.get("REGION_NAME") or "").strip().upper()

            if not res_name or not time_raw:
                continue

            try:
                interval_dt = self.parse_timestamp(time_raw)
            except ValueError:
                continue

            try:
                sched_mw = float(row.get("SCHED_MW", 0.0) or 0.0)
            except (ValueError, TypeError):
                sched_mw = 0.0

            try:
                lmp = float(row.get("LMP", 0.0) or 0.0)
            except (ValueError, TypeError):
                lmp = 0.0

            if res_type == "G":
                gen_info = self.registry.resolve_generator(res_name, region_raw)
                fuel_tech = gen_info["fuel_tech"]
                region = gen_info["region"]
                mw_val = max(0.0, sched_mw)

                # Aggregate generation per region and total 'ALL'
                gen_buckets[(interval_dt, region, fuel_tech)] += mw_val
                gen_buckets[(interval_dt, "ALL", fuel_tech)] += mw_val

                # Track revenue and LMP for fuel capture price
                rev = mw_val * lmp
                gen_rev_buckets[(interval_dt, region, fuel_tech)] += rev
                gen_rev_buckets[(interval_dt, "ALL", fuel_tech)] += rev
                gen_lmp_buckets[(interval_dt, region, fuel_tech)]["lmp_sum"] += lmp
                gen_lmp_buckets[(interval_dt, region, fuel_tech)]["count"] += 1.0
                gen_lmp_buckets[(interval_dt, "ALL", fuel_tech)]["lmp_sum"] += lmp
                gen_lmp_buckets[(interval_dt, "ALL", fuel_tech)]["count"] += 1.0

                # Aggregate WESM GWAP components per region and total 'ALL'
                p_reg = price_buckets[(interval_dt, region)]
                p_reg["rev_sum"] += rev
                p_reg["mw_sum"] += mw_val
                p_reg["lmp_sum"] += lmp
                p_reg["count"] += 1.0

                p_all = price_buckets[(interval_dt, "ALL")]
                p_all["rev_sum"] += rev
                p_all["mw_sum"] += mw_val
                p_all["lmp_sum"] += lmp
                p_all["count"] += 1.0

                nodal_records.append(
                    NodalDispatchRecord(
                        country_code="PH",
                        interval_start=interval_dt,
                        resource_id=res_name,
                        resource_type="G",
                        region=region,
                        fuel_tech=fuel_tech,
                        sched_mw=round(sched_mw, 2),
                        lmp=round(lmp, 2),
                    )
                )

            elif res_type in ("L", "LD"):
                region = REGION_MAP.get(region_raw, "LUZON")
                load_mw = abs(sched_mw)
                l_rev = load_mw * lmp

                # Accumulate into load_buckets
                l_reg = load_buckets[(interval_dt, region)]
                l_reg["rev_sum"] += l_rev
                l_reg["mw_sum"] += load_mw
                l_reg["lmp_sum"] += lmp
                l_reg["count"] += 1.0

                l_all = load_buckets[(interval_dt, "ALL")]
                l_all["rev_sum"] += l_rev
                l_all["mw_sum"] += load_mw
                l_all["lmp_sum"] += lmp
                l_all["count"] += 1.0

                nodal_records.append(
                    NodalDispatchRecord(
                        country_code="PH",
                        interval_start=interval_dt,
                        resource_id=res_name,
                        resource_type=res_type,
                        region=region,
                        fuel_tech="load",
                        sched_mw=round(load_mw, 2),
                        lmp=round(lmp, 2),
                    )
                )

        records: List[EnergyIntervalRecord] = []
        for (interval_dt, region, fuel_tech), mw_val in gen_buckets.items():
            gen_mw = round(mw_val, 2)
            # 5-minute interval energy MWh = MW * (5 / 60)
            energy_mwh = round(gen_mw * (5.0 / 60.0), 4)

            rev_sum = gen_rev_buckets.get((interval_dt, region, fuel_tech), 0.0)
            lmp_info = gen_lmp_buckets.get(
                (interval_dt, region, fuel_tech), {"lmp_sum": 0.0, "count": 0.0}
            )
            if mw_val > 0:
                cap_price = round(rev_sum / mw_val, 2)
            elif lmp_info["count"] > 0:
                cap_price = round(lmp_info["lmp_sum"] / lmp_info["count"], 2)
            else:
                cap_price = None

            records.append(
                EnergyIntervalRecord(
                    country_code="PH",
                    interval_start=interval_dt,
                    region=region,
                    fuel_tech=fuel_tech,
                    generation_mw=gen_mw,
                    energy_mwh=energy_mwh,
                    capture_price_local=cap_price,
                    capture_price_dollar=None,
                )
            )

        price_records: List[PriceIntervalRecord] = []
        all_price_keys = set(price_buckets.keys()) | set(load_buckets.keys())
        for interval_dt, region in sorted(all_price_keys):
            price_local: Optional[float] = None
            if (interval_dt, region) in price_buckets:
                p_data = price_buckets[(interval_dt, region)]
                count = p_data["count"]
                gwap = (
                    p_data["rev_sum"] / p_data["mw_sum"]
                    if p_data["mw_sum"] > 0
                    else p_data["lmp_sum"] / count
                    if count > 0
                    else None
                )
                price_local = round(gwap, 2) if gwap is not None else None

            lwap_local: Optional[float] = None
            demand_mw: Optional[float] = None
            if (interval_dt, region) in load_buckets:
                l_data = load_buckets[(interval_dt, region)]
                l_cnt = l_data["count"]
                l_mw = l_data["mw_sum"]
                l_rev = l_data["rev_sum"]
                l_lmp = l_data["lmp_sum"]
                lwap = (
                    round(l_rev / l_mw, 2)
                    if l_mw > 0
                    else round(l_lmp / l_cnt, 2)
                    if l_cnt > 0
                    else None
                )
                lwap_local = lwap
                demand_mw = round(l_mw, 2) if l_cnt > 0 else None

            price_records.append(
                PriceIntervalRecord(
                    country_code="PH",
                    interval_start=interval_dt,
                    region=region,
                    price_local=price_local,
                    price_dollar=None,  # Populated during DB upsert with exchange rate
                    lwap_local=lwap_local,
                    lwap_dollar=None,
                    demand_mw=demand_mw,
                )
            )

        return records, price_records, nodal_records

    def parse_rtd_dispatch(
        self, csv_lines: List[str]
    ) -> Tuple[List[EnergyIntervalRecord], List[PriceIntervalRecord]]:
        """
        Parses raw unit dispatch CSV lines and produces 5-minute fuel mix aggregations
        as EnergyIntervalRecord dataclasses, and market/regional GWAP prices as PriceIntervalRecord.
        """
        records, price_records, _ = self.parse_rtd_dispatch_with_nodal(csv_lines)
        return records, price_records
