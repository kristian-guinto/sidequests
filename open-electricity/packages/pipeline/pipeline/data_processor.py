import csv
from datetime import datetime
from collections import defaultdict
from typing import List, Dict, Any
from pipeline.generator_registry import GeneratorRegistry, REGION_MAP
from pipeline.config import (
    DEFAULT_EMISSIONS_FACTOR,
)


class DataProcessor:
    def __init__(self, registry: GeneratorRegistry):
        self.registry = registry

    def parse_time_interval(self, time_str: str) -> str:
        """Parse IEMOP datetime format to standard ISO 8601 string."""
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
                return dt.strftime("%Y-%m-%dT%H:%M:%S+08:00")
            except ValueError:
                continue
        return time_str

    def process_rtd_dispatch(self, csv_lines: List[str]) -> List[Dict[str, Any]]:
        """Processes unit dispatch CSV and produces 5-minute fuel mix aggregations."""
        reader = csv.DictReader(csv_lines)

        # Aggregation bucket: (timestamp_iso, region, fuel_tech) -> {gen_mw, weighted_price_sum, price_weight}
        buckets = defaultdict(
            lambda: {"generation_mw": 0.0, "price_sum": 0.0, "count": 0}
        )
        # Regional price bucket: (timestamp_iso, region) -> {price_sum, count}
        region_prices = defaultdict(lambda: {"price_sum": 0.0, "count": 0})

        for row in reader:
            if not row:
                continue
            res_type = (row.get("RESOURCE_TYPE") or "").strip().upper()
            if res_type != "G":
                # Only include generators, skip non-generators / node load
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

            time_iso = self.parse_time_interval(time_raw)
            gen_info = self.registry.resolve_generator(res_name, region_raw)
            fuel_tech = gen_info["fuel_tech"]
            region = gen_info["region"]

            # Aggregate per specific region
            key = (time_iso, region, fuel_tech)
            buckets[key]["generation_mw"] += max(0.0, sched_mw)
            buckets[key]["price_sum"] += lmp
            buckets[key]["count"] += 1

            # Aggregate for Total Philippines ('ALL')
            key_all = (time_iso, "ALL", fuel_tech)
            buckets[key_all]["generation_mw"] += max(0.0, sched_mw)
            buckets[key_all]["price_sum"] += lmp
            buckets[key_all]["count"] += 1

            # Track regional average prices
            region_prices[(time_iso, region)]["price_sum"] += lmp
            region_prices[(time_iso, region)]["count"] += 1
            region_prices[(time_iso, "ALL")]["price_sum"] += lmp
            region_prices[(time_iso, "ALL")]["count"] += 1

        results = []
        for (time_iso, region, fuel_tech), data in buckets.items():
            avg_price = data["price_sum"] / data["count"] if data["count"] > 0 else None
            results.append(
                {
                    "timestamp": time_iso,
                    "region": region,
                    "fuel_tech": fuel_tech,
                    "generation_mw": round(data["generation_mw"], 2),
                    "price_php_mwh": round(avg_price, 2)
                    if avg_price is not None
                    else None,
                }
            )
        return results

    def process_regional_summary(self, csv_lines: List[str]) -> List[Dict[str, Any]]:
        """Processes RTD regional summaries (demand, losses, imports, exports)."""
        reader = csv.DictReader(csv_lines)

        # Bucket: (timestamp_iso, region) -> {demand, gen, losses, import, export}
        buckets = defaultdict(
            lambda: {
                "demand_mw": 0.0,
                "generation_mw": 0.0,
                "losses_mw": 0.0,
                "import_mw": 0.0,
                "export_mw": 0.0,
            }
        )

        for row in reader:
            if not row:
                continue
            commodity = (row.get("COMMODITY_TYPE") or "").strip()
            # 'En' stands for Energy commodity
            if commodity and commodity.lower() != "en":
                continue

            region_raw = (row.get("REGION_NAME") or "").strip().upper()
            time_raw = (row.get("TIME_INTERVAL") or "").strip()
            if not region_raw or not time_raw:
                continue

            region = REGION_MAP.get(region_raw, region_raw)
            time_iso = self.parse_time_interval(time_raw)

            def safe_float(key: str) -> float:
                try:
                    val = row.get(key)
                    return float(val or 0.0)
                except (ValueError, TypeError):
                    return 0.0

            demand = safe_float("LOAD_BID")
            gen = safe_float("GENERATION")
            losses = safe_float("LOSSES")
            imp = safe_float("MKT_IMPORT")
            exp = safe_float("MKT_EXPORT")

            b = buckets[(time_iso, region)]
            b["demand_mw"] += demand
            b["generation_mw"] += gen
            b["losses_mw"] += losses
            b["import_mw"] += imp
            b["export_mw"] += exp

            # Also aggregate Total PH ('ALL')
            b_all = buckets[(time_iso, "ALL")]
            b_all["demand_mw"] += demand
            b_all["generation_mw"] += gen
            b_all["losses_mw"] += losses
            b_all["import_mw"] += imp
            b_all["export_mw"] += exp

        results = []
        for (time_iso, region), data in buckets.items():
            net_flow = data["import_mw"] - data["export_mw"]
            results.append(
                {
                    "timestamp": time_iso,
                    "region": region,
                    "demand_mw": round(data["demand_mw"], 2),
                    "generation_mw": round(data["generation_mw"], 2),
                    "losses_mw": round(data["losses_mw"], 2),
                    "import_mw": round(data["import_mw"], 2),
                    "export_mw": round(data["export_mw"], 2),
                    "net_interconnector_mw": round(net_flow, 2),
                }
            )
        return results

    def compute_daily_rollups(
        self,
        dispatch_records: List[Dict[str, Any]],
        regional_records: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Computes daily MWh, peak demand, and carbon emissions from 5-minute dispatch intervals."""
        # Key: (date_str, region, fuel_tech) -> {mwh, price_sum, count}
        daily_fuels = defaultdict(
            lambda: {"energy_mwh": 0.0, "price_sum": 0.0, "count": 0}
        )
        # Key: (date_str, region) -> {peak_demand, min_demand}
        daily_demand = defaultdict(
            lambda: {"peak_demand": 0.0, "min_demand": float("inf")}
        )

        for rec in dispatch_records:
            date_str = rec["timestamp"][:10]
            region = rec["region"]
            fuel_tech = rec["fuel_tech"]
            gen_mw = rec["generation_mw"]
            price = rec.get("price_php_mwh")

            # 5-minute interval energy MWh = MW * (5 / 60)
            mwh = gen_mw * (5.0 / 60.0)
            key = (date_str, region, fuel_tech)
            daily_fuels[key]["energy_mwh"] += mwh
            if price is not None:
                daily_fuels[key]["price_sum"] += price
                daily_fuels[key]["count"] += 1

        for rec in regional_records:
            date_str = rec["timestamp"][:10]
            region = rec["region"]
            demand = rec["demand_mw"]
            d = daily_demand[(date_str, region)]
            if demand > d["peak_demand"]:
                d["peak_demand"] = demand
            if demand < d["min_demand"]:
                d["min_demand"] = demand

        results = []
        for (date_str, region, fuel_tech), data in daily_fuels.items():
            mwh = round(data["energy_mwh"], 2)
            avg_price = (
                round(data["price_sum"] / data["count"], 2)
                if data["count"] > 0
                else None
            )
            emission_factor = DEFAULT_EMISSIONS_FACTOR.get(fuel_tech, 0.0)
            emissions = round(mwh * emission_factor, 2)

            d_info = daily_demand.get((date_str, region), {})
            peak_d = round(d_info.get("peak_demand", 0.0), 2) if d_info else None
            min_d = (
                round(d_info.get("min_demand", 0.0), 2)
                if d_info and d_info.get("min_demand") != float("inf")
                else None
            )

            results.append(
                {
                    "date": date_str,
                    "region": region,
                    "fuel_tech": fuel_tech,
                    "energy_mwh": mwh,
                    "avg_price_php_mwh": avg_price,
                    "peak_demand_mw": peak_d,
                    "min_demand_mw": min_d,
                    "emissions_tco2": emissions,
                }
            )
        return results
