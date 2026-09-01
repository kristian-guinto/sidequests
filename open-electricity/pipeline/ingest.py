import sys
import argparse
from datetime import datetime, date, timedelta
from typing import Optional
from pipeline.config import TIMEZONE
from pipeline.generator_registry import GeneratorRegistry
from pipeline.iemop_client import IEMOPClient
from pipeline.data_processor import DataProcessor
from pipeline.db import Database


def run_sync(start_date: Optional[date] = None, end_date: Optional[date] = None):
    print(f"==================================================")
    print(f"  OpenNEM-PH Ingestion Pipeline (IEMOP / WESM)")
    print(f"  Date Range: {start_date or 'Latest'} -> {end_date or 'Latest'}")
    print(f"==================================================")

    # 1. Initialize components
    registry = GeneratorRegistry()
    client = IEMOPClient()
    processor = DataProcessor(registry)
    db = Database()

    # 2. Sync facility metadata
    print(f"\n[1/4] Syncing Generator Registry...")
    facilities = registry.get_all_facilities()
    synced_fac = db.upsert_facilities(facilities)
    print(f"  ✓ Synced {synced_fac} facilities to database.")

    # 3. Process Regional Summaries (Demand, Losses, Net Flows)
    print(f"\n[2/4] Fetching RTD Regional Summaries (Macro Grid)...")
    reg_files = client.get_rtd_regional_summary_files(start_date, end_date)
    print(f"  Found {len(reg_files)} regional summary files.")

    all_regional_records = []
    for idx, f_info in enumerate(reg_files[:10], 1):  # Process batch
        print(
            f"  -> [{idx}/{min(len(reg_files), 10)}] Downloading {f_info['filename']}..."
        )
        csv_lines = client.download_regional_summary_csv(f_info["file_id"])
        records = processor.process_regional_summary(csv_lines)
        all_regional_records.extend(records)

    synced_reg = db.upsert_regional_summary_5m(all_regional_records)
    print(f"  ✓ Synced {synced_reg} 5-minute regional balance records.")

    # 4. Process RTD Prices & Schedules (Unit Dispatch & Fuel Mix)
    print(f"\n[3/4] Fetching RTD Unit Dispatch Files (Fuel Mix & Prices)...")
    disp_files = client.get_rtd_dispatch_files(start_date, end_date)
    print(f"  Found {len(disp_files)} dispatch archive files.")

    all_dispatch_records = []
    for idx, f_info in enumerate(disp_files[:24], 1):  # Process latest hours / batch
        print(
            f"  -> [{idx}/{min(len(disp_files), 24)}] Unpacking {f_info['filename']}..."
        )
        csv_lines = client.download_rtd_dispatch_csv(f_info["file_id"])
        records = processor.process_rtd_dispatch(csv_lines)
        all_dispatch_records.extend(records)

    synced_disp = db.upsert_dispatch_5m(all_dispatch_records)
    print(f"  ✓ Synced {synced_disp} 5-minute fuel generation records.")

    # 5. Compute and Save Daily Aggregations Rollup
    print(f"\n[4/4] Computing Daily Rollups & Emissions...")
    daily_stats = processor.compute_daily_rollups(
        all_dispatch_records, all_regional_records
    )
    synced_daily = db.upsert_daily_stats(daily_stats)
    print(f"  ✓ Synced {synced_daily} daily rollup records.")

    # 6. Report newly discovered plants if any
    if registry.unclassified:
        print(
            f"\n[Notice] Discovered {len(registry.unclassified)} unmapped generators (heuristically classified):"
        )
        for code, info in list(registry.unclassified.items())[:5]:
            print(f"  - {code}: {info['fuel_tech']} ({info['region']})")

    print(f"\n==================================================")
    print(f"  ✓ Pipeline Run Complete!")
    print(f"==================================================")


def app():
    """Main CLI entrypoint for uv run ingest."""
    parser = argparse.ArgumentParser(description="OpenNEM Philippines Ingestion & Database CLI")
    parser.add_argument(
        "command",
        nargs="?",
        default=None,
        help="Command to run: 'daily', 'backfill', 'inspect', or 'sync-facilities'",
    )
    parser.add_argument(
        "--mode",
        choices=["daily", "backfill", "sync-facilities", "inspect"],
        default=None,
        help="Run mode (daily, backfill, sync-facilities, inspect)",
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
        help="Filter inspection by region (e.g. LUZON, VISAYAS, MINDANAO, ALL)",
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
        "--days", type=int, default=2, help="Number of past days for daily sync"
    )

    args = parser.parse_args()

    # Allow positional or flagged mode
    mode = args.command or args.mode or "daily"

    if mode == "inspect":
        db = Database()
        db.inspect_database(table=args.table, region=args.region, limit=args.limit)
        return

    if mode == "sync-facilities":
        registry = GeneratorRegistry()
        db = Database()
        count = db.upsert_facilities(registry.get_all_facilities())
        print(f"Synced {count} facilities.")
        return

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

    run_sync(start_d, end_d)


if __name__ == "__main__":
    app()
