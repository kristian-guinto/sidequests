import sys
import argparse
from datetime import datetime, date, timedelta
from typing import Optional
from pipeline.config import TIMEZONE
from pipeline.generator_registry import GeneratorRegistry
from pipeline.iemop_client import IEMOPClient
from pipeline.data_processor import DataProcessor
from pipeline.db import Database


def run_sync(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    max_files: Optional[int] = None,
):
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
            all_regional_records.extend(records)

            # Flush batch every 10 files
            if len(all_regional_records) >= 5000 or idx == len(reg_files):
                synced = db.upsert_regional_summary_5m(all_regional_records)
                total_reg_synced += synced
                all_regional_records = []
        except Exception as e:
            print(f"    ⚠️ Failed to process {f_info['filename']}: {e}")

    print(f"  ✓ Synced {total_reg_synced} 5-minute regional balance records.")

    # 4. Process RTD Prices & Schedules (Unit Dispatch & Fuel Mix)
    print(f"\n[3/4] Fetching RTD Unit Dispatch Files (Fuel Mix & Prices)...")
    disp_files = client.get_rtd_dispatch_files(start_date, end_date)
    total_disp = len(disp_files)
    if max_files:
        disp_files = disp_files[:max_files]
    print(f"  Found {total_disp} dispatch archive files (Processing {len(disp_files)}).")

    all_dispatch_records = []
    batch_records = []
    total_disp_synced = 0
    total_daily_synced = 0

    for idx, f_info in enumerate(disp_files, 1):
        pct = (idx / len(disp_files)) * 100
        print(
            f"  -> [{idx}/{len(disp_files)}] ({pct:4.1f}%) Unpacking {f_info['filename']}..."
        )
        try:
            csv_lines = client.download_rtd_dispatch_csv(f_info["file_id"])
            records = processor.process_rtd_dispatch(csv_lines)
            batch_records.extend(records)
            all_dispatch_records.extend(records)

            # Stream save to DB every 24 hourly files (1 day worth of intervals)
            if idx % 24 == 0 or idx == len(disp_files):
                synced = db.upsert_dispatch_5m(batch_records)
                total_disp_synced += synced
                print(f"     [Saved batch: +{synced} dispatch records (Total: {total_disp_synced})]")
                batch_records = []
        except Exception as e:
            print(f"    ⚠️ Failed to process {f_info['filename']}: {e}")

    print(f"  ✓ Synced total {total_disp_synced} 5-minute fuel generation records.")

    # 5. Compute and Save Daily Aggregations Rollup
    print(f"\n[4/4] Computing Daily Rollups & Emissions...")
    if all_dispatch_records:
        daily_stats = processor.compute_daily_rollups(
            all_dispatch_records, []
        )
        total_daily_synced = db.upsert_daily_stats(daily_stats)
    print(f"  ✓ Synced {total_daily_synced} daily rollup records.")

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
        help="Command to run: 'daily', 'backfill', 'inspect', 'migrate', or 'sync-facilities'",
    )
    parser.add_argument(
        "--mode",
        choices=["daily", "backfill", "sync-facilities", "inspect", "migrate"],
        default=None,
        help="Run mode (daily, backfill, sync-facilities, inspect, migrate)",
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
    parser.add_argument(
        "--max-files", type=int, default=None, help="Optional max files limit for testing"
    )

    args = parser.parse_args()

    # Allow positional or flagged mode
    mode = args.command or args.mode or "daily"

    if mode == "migrate":
        from pipeline.migrate_sqlite_to_duckdb import migrate
        migrate()
        return

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

    run_sync(start_d, end_d, max_files=args.max_files)


if __name__ == "__main__":
    app()
