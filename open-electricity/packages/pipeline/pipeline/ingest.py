"""Main CLI and runner for OpenElectricity data ingestion pipeline."""

import argparse
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict
from pipeline.config import DUCKDB_PATH
from pipeline.db import Database
from pipeline.models import IngestRunReport
from pipeline.fx import sync_exchange_rates, COUNTRY_TO_CURRENCY
from pipeline.providers.base import BaseProvider
from pipeline.providers.ph_iemop import PhilippinesIEMOPProvider
from pipeline.providers.sg_emc import SingaporeEMCProvider
from pipeline.providers.my_singlebuyer import MalaysiaSingleBuyerProvider

PROVIDERS: Dict[str, type] = {
    "PH": PhilippinesIEMOPProvider,
    "SG": SingaporeEMCProvider,
    "MY": MalaysiaSingleBuyerProvider,
}


def run_country_pipeline(
    provider: BaseProvider,
    db: Database,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    days: int = 2,
    sync_facilities_flag: bool = True,
    max_files: Optional[int] = None,
) -> IngestRunReport:
    """Executes the standard 4-step pipeline lifecycle for a single market provider."""
    country = provider.country_code
    print("==================================================")
    print(f"  OpenNEM-SEA: Country [{country}] Pipeline")
    print(f"  Date Range: {start_date or f'Past {days} days'} -> {end_date or 'Today'}")
    print("==================================================")

    fac_count = 0
    if sync_facilities_flag:
        print(f"\n[1/4] Syncing Generator Catalog ({country})...")
        facilities = provider.fetch_facilities(conn=db.conn)
        fac_count = db.upsert_facilities(facilities, country_code=country)
        print(f"  ✓ Synced {fac_count} facilities.")
    else:
        print(f"\n[1/4] Skipping Generator Catalog Sync ({country}).")

    print("\n[2/4] Verifying Exchange Rates (USD Reference)...")
    curr = COUNTRY_TO_CURRENCY.get(country, "PHP")
    s_d = start_date or (date.today() - timedelta(days=days))
    e_d = end_date or date.today()
    existing_cnt_row = db.conn.execute(
        "SELECT count(*) FROM exchange_rates WHERE currency = ? AND date >= ?::DATE AND date <= ?::DATE",
        [curr, s_d, e_d],
    ).fetchone()
    existing_cnt = existing_cnt_row[0] if existing_cnt_row else 0

    if existing_cnt == 0:
        print(f"  Missing FX rates for {curr} ({s_d} -> {e_d}). Fetching online...")
        synced_fx = sync_exchange_rates(db, start_date=s_d, end_date=e_d)
        print(f"  ✓ Synced {synced_fx} FX rate records.")
    else:
        print(f"  ✓ Verified {existing_cnt} existing FX rate records for {curr}.")

    print(f"\n[3/4] Ingesting Energy Intervals & Spot Prices ({country})...")
    # For PH provider, pass max_files if provided
    if country == "PH" and hasattr(provider, "fetch_energy_intervals") and max_files:
        intervals = provider.fetch_energy_intervals(
            start_date=start_date,
            end_date=end_date,
            days=days,
            conn=db.conn,
            max_files=max_files,
        )
    else:
        intervals = provider.fetch_energy_intervals(
            start_date=start_date, end_date=end_date, days=days, conn=db.conn
        )

    synced_intervals = db.upsert_energy_interval(intervals, country_code=country)
    print(f"  ✓ Synced {synced_intervals} interval records into energy_interval.")

    print(f"\n[4/4] Populating energy_daily Rollups ({country})...")
    db.populate_energy_daily(country, start_date=start_date, end_date=end_date)
    print("  ✓ Populated daily rollup records in energy_daily.")

    return IngestRunReport(
        country_code=country,
        facilities_synced=fac_count,
        intervals_synced=synced_intervals,
        daily_rollups_updated=True,
    )


def resolve_countries(country_arg: str) -> List[str]:
    """Resolves target country codes from CLI argument."""
    c = country_arg.upper()
    if c == "ALL":
        return ["PH", "SG", "MY"]
    if c in PROVIDERS:
        return [c]
    raise ValueError(
        f"Unsupported country code: {country_arg}. Choose from: ALL, PH, SG, MY."
    )


def app():
    """Main CLI entrypoint for open-electricity / ingest CLI."""
    parser = argparse.ArgumentParser(description="OpenElectricity Data Ingestion CLI")
    subparsers = parser.add_subparsers(dest="subcommand", help="Pipeline commands")

    # Command: latest (used by GitHub Actions daily cron)
    p_latest = subparsers.add_parser(
        "latest", help="Ingest latest market data across active countries"
    )
    p_latest.add_argument(
        "--target",
        choices=["local", "motherduck"],
        default=None,
        help="Target database",
    )
    p_latest.add_argument(
        "--db-path", type=str, default=None, help="Path to local DuckDB file"
    )
    p_latest.add_argument(
        "--country",
        type=str,
        default="ALL",
        help="Target country (PH, SG, MY, ALL). Default: ALL",
    )
    p_latest.add_argument(
        "--days", type=int, default=2, help="Number of past days to ingest (default: 2)"
    )

    # Command: backfill (used for local historical backfilling)
    p_backfill = subparsers.add_parser(
        "backfill", help="Historical backfill for a custom date range"
    )
    p_backfill.add_argument(
        "--target",
        choices=["local", "motherduck"],
        default=None,
        help="Target database",
    )
    p_backfill.add_argument(
        "--db-path", type=str, default=None, help="Path to local DuckDB file"
    )
    p_backfill.add_argument(
        "--country",
        type=str,
        default="PH",
        help="Target country (PH, SG, MY). Default: PH",
    )
    p_backfill.add_argument(
        "--start-date", type=str, required=True, help="Start date (YYYY-MM-DD)"
    )
    p_backfill.add_argument(
        "--end-date", type=str, required=True, help="End date (YYYY-MM-DD)"
    )
    p_backfill.add_argument(
        "--max-files",
        type=int,
        default=None,
        help="Optional max files limit for testing",
    )
    p_backfill.add_argument(
        "--skip-facilities", action="store_true", help="Skip catalog sync"
    )

    # Command: sync-facilities
    p_fac = subparsers.add_parser(
        "sync-facilities", help="Synchronize generator facility catalog"
    )
    p_fac.add_argument(
        "--target",
        choices=["local", "motherduck"],
        default=None,
        help="Target database",
    )
    p_fac.add_argument(
        "--db-path", type=str, default=None, help="Path to local DuckDB file"
    )
    p_fac.add_argument(
        "--country",
        type=str,
        default="ALL",
        help="Target country (PH, SG, MY, ALL). Default: ALL",
    )

    # Command: inspect
    p_inspect = subparsers.add_parser(
        "inspect", help="Inspect database tables and sample rows"
    )
    p_inspect.add_argument(
        "--target",
        choices=["local", "motherduck"],
        default=None,
        help="Target database",
    )
    p_inspect.add_argument(
        "--db-path", type=str, default=None, help="Path to local DuckDB file"
    )
    p_inspect.add_argument(
        "--country", type=str, default="ALL", help="Filter by country (default: ALL)"
    )
    p_inspect.add_argument(
        "--table",
        choices=["facilities", "energy_interval", "energy_daily", "all"],
        default=None,
    )
    p_inspect.add_argument("--region", type=str, default=None, help="Filter by region")
    p_inspect.add_argument(
        "--limit",
        type=int,
        default=15,
        help="Number of records to display (default: 15)",
    )

    # Backward-compatible flags support when invoked as `ingest --mode ...`
    parser.add_argument(
        "--mode",
        choices=["latest", "daily", "backfill", "sync-facilities", "inspect"],
        default=None,
    )
    parser.add_argument("--target", choices=["local", "motherduck"], default=None)
    parser.add_argument("--db-path", type=str, default=None)
    parser.add_argument("--country", type=str, default="PH")
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    parser.add_argument("--days", type=int, default=2)
    parser.add_argument("--max-files", type=int, default=None)
    parser.add_argument("--table", type=str, default=None)
    parser.add_argument("--region", type=str, default=None)
    parser.add_argument("--limit", type=int, default=15)

    args = parser.parse_args()

    # Determine execution command
    cmd = args.subcommand or args.mode or "latest"
    if cmd == "daily":
        cmd = "latest"

    target = args.target or "local"
    local_path = args.db_path or DUCKDB_PATH

    db = Database(target=target, local_path=local_path)

    try:
        if cmd == "inspect":
            db.inspect_database(
                country_code=args.country,
                table=args.table,
                region=args.region,
                limit=args.limit,
            )
            return

        if cmd == "sync-facilities":
            countries = resolve_countries(args.country)
            for c in countries:
                prov_cls = PROVIDERS[c]
                provider = prov_cls(conn=db.conn) if c == "PH" else prov_cls()
                facs = provider.fetch_facilities(conn=db.conn)
                count = db.upsert_facilities(facs, country_code=c)
                print(f"  ✓ Synced {count} facilities for {c}.")
            print("\nFacilities catalog sync complete.")
            return

        if cmd == "latest":
            countries = resolve_countries(args.country)
            today = date.today()
            start_d = today - timedelta(days=args.days)
            end_d = today

            reports = []
            for c in countries:
                prov_cls = PROVIDERS[c]
                provider = prov_cls(conn=db.conn) if c == "PH" else prov_cls()
                report = run_country_pipeline(
                    provider=provider,
                    db=db,
                    start_date=start_d,
                    end_date=end_d,
                    days=args.days,
                    sync_facilities_flag=True,
                )
                reports.append(report)

            print("\n==================================================")
            print("  ✓ OpenElectricity 'latest' Sync Complete!")
            for r in reports:
                print(
                    f"  [{r.country_code}] Intervals: +{r.intervals_synced}, Facilities: {r.facilities_synced}"
                )
            print("==================================================")
            return

        if cmd == "backfill":
            if not args.start_date or not args.end_date:
                parser.error(
                    "backfill requires both --start-date and --end-date (YYYY-MM-DD)"
                )

            start_d = datetime.strptime(args.start_date, "%Y-%m-%d").date()
            end_d = datetime.strptime(args.end_date, "%Y-%m-%d").date()
            countries = resolve_countries(args.country)

            skip_fac = getattr(args, "skip_facilities", False)
            for c in countries:
                prov_cls = PROVIDERS[c]
                provider = prov_cls(conn=db.conn) if c == "PH" else prov_cls()
                run_country_pipeline(
                    provider=provider,
                    db=db,
                    start_date=start_d,
                    end_date=end_d,
                    sync_facilities_flag=not skip_fac,
                    max_files=args.max_files,
                )

            print("\n==================================================")
            print("  ✓ OpenElectricity Backfill Complete!")
            print("==================================================")
            return

        parser.print_help()
    finally:
        db.close()


if __name__ == "__main__":
    app()
