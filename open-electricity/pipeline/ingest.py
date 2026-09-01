import sys
import argparse
from datetime import datetime, date, timedelta
from typing import Optional
from pipeline.config import TIMEZONE
from pipeline.generator_registry import GeneratorRegistry
from pipeline.iemop_client import IEMOPClient
from pipeline.data_processor import DataProcessor
from pipeline.db import Database
from pipeline.providers.sg_emc import SingaporeEMCProvider
from pipeline.providers.my_singlebuyer import MalaysiaSingleBuyerProvider


def run_ph_sync(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    max_files: Optional[int] = None,
):
    print(f"==================================================")
    print(f"  OpenNEM-SEA: 🇵🇭 Philippines Pipeline (IEMOP/WESM)")
    print(f"  Date Range: {start_date or 'Latest'} -> {end_date or 'Latest'}")
    print(f"==================================================")

    registry = GeneratorRegistry()
    client = IEMOPClient()
    processor = DataProcessor(registry)
    db = Database()

    # 1. Facilities
    print(f"\n[1/4] Syncing Generator Catalog (PH)...")
    facilities = registry.get_all_facilities()
    for f in facilities:
        f["country_code"] = "PH"
    synced_fac = db.upsert_facilities(facilities, country_code="PH")
    print(f"  ✓ Synced {synced_fac} facilities to database.")

    # 2. Regional Summaries
    print(f"\n[2/4] Fetching RTD Regional Summaries (Macro Grid)...")
    reg_files = client.get_rtd_regional_summary_files(start_date, end_date)
    total_reg = len(reg_files)
    if max_files:
        reg_files = reg_files[:max_files]
    print(f"  Found {total_reg} regional summary files (Processing {len(reg_files)}).")

    all_regional_records = []
    total_reg_synced = 0

    for idx, f_info in enumerate(reg_files, 1):
        pct = (idx / len(reg_files)) * 100
        print(
            f"  -> [{idx}/{len(reg_files)}] ({pct:4.1f}%) Downloading {f_info['filename']}..."
        )
        try:
            csv_lines = client.download_regional_summary_csv(f_info["file_id"])
            records = processor.process_regional_summary(csv_lines)
            for r in records:
                r["country_code"] = "PH"
            all_regional_records.extend(records)

            if len(all_regional_records) >= 5000 or idx == len(reg_files):
                synced = db.upsert_regional_summary_5m(all_regional_records, country_code="PH")
                total_reg_synced += synced
                all_regional_records = []
        except Exception as e:
            print(f"    ⚠️ Failed to process {f_info['filename']}: {e}")

    print(f"  ✓ Synced {total_reg_synced} 5-minute regional balance records.")

    # 3. Unit Dispatch & Prices
    print(f"\n[3/4] Fetching RTD Unit Dispatch Files (Fuel Mix & Prices)...")
    disp_files = client.get_rtd_dispatch_files(start_date, end_date)
    total_disp = len(disp_files)
    if max_files:
        disp_files = disp_files[:max_files]
    print(f"  Found {total_disp} dispatch archive files (Processing {len(disp_files)}).")

    all_dispatch_records = []
    batch_records = []
    total_disp_synced = 0

    for idx, f_info in enumerate(disp_files, 1):
        pct = (idx / len(disp_files)) * 100
        print(
            f"  -> [{idx}/{len(disp_files)}] ({pct:4.1f}%) Unpacking {f_info['filename']}..."
        )
        try:
            csv_lines = client.download_rtd_dispatch_csv(f_info["file_id"])
            records = processor.process_rtd_dispatch(csv_lines)
            for r in records:
                r["country_code"] = "PH"
            batch_records.extend(records)
            all_dispatch_records.extend(records)

            if idx % 24 == 0 or idx == len(disp_files):
                synced = db.upsert_dispatch_5m(batch_records, country_code="PH")
                total_disp_synced += synced
                print(f"     [Saved batch: +{synced} dispatch records (Total: {total_disp_synced})]")
                batch_records = []
        except Exception as e:
            print(f"    ⚠️ Failed to process {f_info['filename']}: {e}")

    print(f"  ✓ Synced total {total_disp_synced} 5-minute fuel generation records.")

    # 4. Daily Rollups
    print(f"\n[4/4] Computing Daily Rollups & Emissions...")
    total_daily_synced = 0
    if all_dispatch_records:
        daily_stats = processor.compute_daily_rollups(all_dispatch_records, [])
        for d in daily_stats:
            d["country_code"] = "PH"
        total_daily_synced = db.upsert_daily_stats(daily_stats, country_code="PH")
    print(f"  ✓ Synced {total_daily_synced} daily rollup records.")


def run_provider_sync(provider, start_date: Optional[str] = None, end_date: Optional[str] = None, days: int = 7):
    country = provider.country_code
    print(f"==================================================")
    print(f"  OpenNEM-SEA: Country [{country}] Pipeline")
    print(f"==================================================")

    db = Database()

    # 1. Facilities
    print(f"\n[1/3] Syncing Generator Catalog ({country})...")
    facilities = provider.fetch_facilities()
    synced_fac = db.upsert_facilities(facilities, country_code=country)
    print(f"  ✓ Synced {synced_fac} facilities.")

    # 2. Regional Summaries
    print(f"\n[2/3] Syncing Regional Summaries & Macro Balances ({country})...")
    summaries = provider.fetch_regional_summaries(start_date, end_date, days=days)
    synced_sum = db.upsert_regional_summary_5m(summaries, country_code=country)
    print(f"  ✓ Synced {synced_sum} interval balance records.")

    # 3. Fuel Dispatch & Spot Prices
    print(f"\n[3/3] Syncing Fuel Mix Generation & Spot Prices ({country})...")
    dispatch = provider.fetch_dispatch(start_date, end_date, days=days)
    synced_disp = db.upsert_dispatch_5m(dispatch, country_code=country)
    print(f"  ✓ Synced {synced_disp} interval dispatch records.")

    # 4. Compute Daily Stats
    if dispatch:
        fuel_daily = {}
        for row in dispatch:
            dt_key = row["timestamp"][:10]
            region = row["region"]
            fuel = row["fuel_tech"]
            key = (dt_key, region, fuel)
            if key not in fuel_daily:
                fuel_daily[key] = {"mwh": 0.0, "price_sum": 0.0, "price_cnt": 0, "max_mw": 0.0, "min_mw": float("inf")}
            b = fuel_daily[key]
            # 30-min interval: mwh = mw * 0.5
            mw = row["generation_mw"]
            b["mwh"] += mw * 0.5
            b["max_mw"] = max(b["max_mw"], mw)
            b["min_mw"] = min(b["min_mw"], mw)
            if row.get("price_local") is not None:
                b["price_sum"] += row["price_local"]
                b["price_cnt"] += 1

        daily_records = []
        em_factors = {"coal": 0.90, "gas": 0.38, "oil": 0.75, "biomass": 0.02, "geothermal": 0.05}

        for (d_str, reg, fuel), v in fuel_daily.items():
            avg_p = (v["price_sum"] / v["price_cnt"]) if v["price_cnt"] > 0 else None
            em_t = v["mwh"] * em_factors.get(fuel, 0.0)
            daily_records.append({
                "country_code": country,
                "date": d_str,
                "region": reg,
                "fuel_tech": fuel,
                "energy_mwh": round(v["mwh"], 2),
                "avg_price_local": round(avg_p, 2) if avg_p is not None else None,
                "peak_demand_mw": round(v["max_mw"], 1),
                "min_demand_mw": round(v["min_mw"], 1) if v["min_mw"] != float("inf") else 0.0,
                "emissions_tco2": round(em_t, 2),
            })

        synced_daily = db.upsert_daily_stats(daily_records, country_code=country)
        print(f"  ✓ Computed and synced {synced_daily} daily rollup records.")


def app():
    """Main CLI entrypoint for uv run ingest."""
    parser = argparse.ArgumentParser(
        description="OpenNEM Southeast Asia (OpenNEM-SEA) Data Ingestion CLI"
    )
    parser.add_argument(
        "command",
        nargs="?",
        default=None,
        help="Command to run: 'daily', 'backfill', 'inspect', 'migrate', or 'sync-facilities'",
    )
    parser.add_argument(
        "--mode",
        choices=["daily", "backfill", "sync-facilities", "inspect", "migrate"],
        default=None,
        help="Run mode (daily, backfill, sync-facilities, inspect, migrate)",
    )
    parser.add_argument(
        "--country",
        type=str,
        default="PH",
        help="Target country code (e.g. PH, SG, MY, ALL). Default: PH",
    )
    parser.add_argument(
        "--table",
        choices=["facilities", "dispatch", "regional", "daily", "all"],
        default=None,
        help="Table to inspect (facilities, dispatch, regional, daily, all)",
    )
    parser.add_argument(
        "--region",
        type=str,
        default=None,
        help="Filter inspection by region",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=15,
        help="Number of records to display in inspection (default: 15)",
    )
    parser.add_argument(
        "--start-date", type=str, default=None, help="Start date (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--end-date", type=str, default=None, help="End date (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--days", type=int, default=7, help="Number of past days for daily sync"
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=None,
        help="Optional max files limit for testing",
    )

    args = parser.parse_args()

    mode = args.command or args.mode or "daily"
    country = (args.country or "PH").upper()

    if mode == "migrate":
        from pipeline.migrate_sqlite_to_duckdb import migrate
        migrate()
        return

    if mode == "inspect":
        db = Database()
        db.inspect_database(country_code=country, table=args.table, region=args.region, limit=args.limit)
        return

    if mode == "sync-facilities":
        if country in ("PH", "ALL"):
            registry = GeneratorRegistry()
            db = Database()
            db.upsert_facilities(registry.get_all_facilities(), country_code="PH")
        if country in ("SG", "ALL"):
            db = Database()
            db.upsert_facilities(SingaporeEMCProvider().fetch_facilities(), country_code="SG")
        if country in ("MY", "ALL"):
            db = Database()
            db.upsert_facilities(MalaysiaSingleBuyerProvider().fetch_facilities(), country_code="MY")
        print("Facilities synced successfully.")
        return

    # Ingestion Modes
    if country in ("PH", "ALL"):
        start_d = None
        end_d = None
        if args.start_date:
            start_d = datetime.strptime(args.start_date, "%Y-%m-%d").date()
        if args.end_date:
            end_d = datetime.strptime(args.end_date, "%Y-%m-%d").date()
        if mode == "daily" and not start_d:
            today = date.today()
            start_d = today - timedelta(days=args.days)
            end_d = today
        run_ph_sync(start_d, end_d, max_files=args.max_files)

    if country in ("SG", "ALL"):
        sg_provider = SingaporeEMCProvider()
        run_provider_sync(sg_provider, args.start_date, args.end_date, days=args.days)

    if country in ("MY", "ALL"):
        my_provider = MalaysiaSingleBuyerProvider()
        run_provider_sync(my_provider, args.start_date, args.end_date, days=args.days)

    print(f"\n==================================================")
    print(f"  ✓ OpenNEM-SEA Pipeline Run Complete!")
    print(f"==================================================")


if __name__ == "__main__":
    app()
