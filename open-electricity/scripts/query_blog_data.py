#!/usr/bin/env python3
"""
Blog Telemetry Data Assistant for OpenElectricity.

Allows querying local DuckDB or MotherDuck to extract peak events,
fuel breakdowns, and price spikes for writing blog articles,
or dumping static JSON snapshots for blog posts.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime

import duckdb

BASE_DIR = Path(__file__).resolve().parent.parent
DUCKDB_PATH = BASE_DIR / "open_nem_ph.duckdb"


def get_db_connection():
    if not DUCKDB_PATH.exists():
        print(f"Error: DuckDB database not found at {DUCKDB_PATH}", file=sys.stderr)
        sys.exit(1)
    return duckdb.connect(str(DUCKDB_PATH), read_only=True)


def list_available_ranges(conn):
    print("\n=== Available Country Telemetry Ranges ===")
    try:
        rows = conn.execute(
            """
            SELECT 
                country_code, 
                MIN(interval_start) as min_ts, 
                MAX(interval_start) as max_ts, 
                COUNT(*) as total_intervals
            FROM energy_interval 
            GROUP BY country_code
            ORDER BY country_code
        """
        ).fetchall()
        for r in rows:
            print(
                f"Country: {r[0]} | Range: {r[1]} -> {r[2]} | Total Records: {r[3]:,}"
            )
    except Exception as e:
        print(f"Error listing ranges: {e}", file=sys.stderr)


def query_market_summary(conn, country_code: str, start_date: str, end_date: str):
    print(
        f"\n=== Market Telemetry Summary: {country_code} ({start_date} to {end_date}) ==="
    )

    # 1. Total Generation & Fuel Breakdown
    gen_query = """
        SELECT 
            fuel_tech,
            ROUND(SUM(energy_mwh), 2) as total_mwh,
            ROUND(AVG(energy_mwh * 12), 2) as avg_mw,
            ROUND(MAX(energy_mwh * 12), 2) as peak_mw
        FROM energy_interval
        WHERE country_code = ?
          AND interval_start >= ?::TIMESTAMP
          AND interval_start <= ?::TIMESTAMP
        GROUP BY fuel_tech
        ORDER BY total_mwh DESC
    """
    gen_rows = conn.execute(
        gen_query, [country_code, f"{start_date} 00:00:00", f"{end_date} 23:59:59"]
    ).fetchall()

    if not gen_rows:
        print("No generation records found for specified dates.")
        return

    total_grid_mwh = sum(r[1] for r in gen_rows)
    print(f"Total Grid Generation: {total_grid_mwh:,.1f} MWh\n")
    print(
        f"{'Fuel Technology':<16} | {'Total MWh':<12} | {'Share (%)':<10} | {'Avg MW':<10} | {'Peak MW':<10}"
    )
    print("-" * 68)
    for r in gen_rows:
        share = (r[1] / total_grid_mwh * 100) if total_grid_mwh > 0 else 0
        print(
            f"{r[0]:<16} | {r[1]:<12,.1f} | {share:<9.1f}% | {r[2]:<10,.1f} | {r[3]:<10,.1f}"
        )

    # 2. Price Statistics (if spot market exists)
    try:
        price_query = """
            SELECT 
                ROUND(AVG(price_local), 2) as avg_price,
                ROUND(MIN(price_local), 2) as min_price,
                ROUND(MAX(price_local), 2) as max_price,
                COUNT(*) as interval_count
            FROM prices_interval
            WHERE country_code = ?
              AND interval_start >= ?::TIMESTAMP
              AND interval_start <= ?::TIMESTAMP
        """
        price_row = conn.execute(
            price_query,
            [country_code, f"{start_date} 00:00:00", f"{end_date} 23:59:59"],
        ).fetchone()

        if price_row and price_row[3] > 0:
            print("\n=== Wholesale Spot Price Dynamics ===")
            print(f"Average Price (Local Currency): {price_row[0]:,}")
            print(f"Minimum Price (Local Currency): {price_row[1]:,}")
            print(f"Maximum Price (Local Currency): {price_row[2]:,}")
            print(f"Total Price Intervals: {price_row[3]:,}")
    except Exception as e:
        print(f"Notice: Price query unavailable or not a spot market: {e}")


def export_chart_snapshot(
    conn, country_code: str, start_date: str, end_date: str, output_path: str
):
    """
    Exports 5-minute or aggregated intervals into standard JSON format
    that can be passed as `snapshotData` into `<BlogEnergyChart snapshotData={...} />`.
    """
    query = """
        SELECT 
            strftime(interval_start, '%Y-%m-%dT%H:%M:00+08:00') as ts,
            fuel_tech,
            ROUND(energy_mwh * 12, 2) as mw
        FROM energy_interval
        WHERE country_code = ?
          AND interval_start >= ?::TIMESTAMP
          AND interval_start <= ?::TIMESTAMP
        ORDER BY interval_start ASC, fuel_tech ASC
    """
    rows = conn.execute(
        query, [country_code, f"{start_date} 00:00:00", f"{end_date} 23:59:59"]
    ).fetchall()

    points_by_time = {}
    for ts, fuel, mw in rows:
        if ts not in points_by_time:
            points_by_time[ts] = {"timestamp": ts, "fuels": {}}
        points_by_time[ts]["fuels"][fuel] = mw

    history = []
    for ts in sorted(points_by_time.keys()):
        pt = points_by_time[ts]
        fuels = pt["fuels"]
        total = sum(fuels.values())
        history.append(
            {
                "timestamp": ts,
                "totalGeneration": round(total, 2),
                "fuels": fuels,
            }
        )

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w") as f:
        json.dump(history, f, indent=2)

    print(f"\nSuccessfully exported {len(history)} intervals to {out_file.resolve()}")


def main():
    parser = argparse.ArgumentParser(
        description="Extract electricity market telemetry for OpenElectricity blog posts."
    )
    parser.add_argument(
        "--list-ranges",
        action="store_true",
        help="List available country dates and interval counts",
    )
    parser.add_argument(
        "--country",
        type=str,
        default="PH",
        help="Country code (PH, SG, MY, TH, VN, ID)",
    )
    parser.add_argument("--start-date", type=str, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, help="End date (YYYY-MM-DD)")
    parser.add_argument(
        "--export-snapshot",
        type=str,
        help="Path to export JSON snapshot (e.g. src/content/blog/data/ph-solar.json)",
    )

    args = parser.parse_args()
    conn = get_db_connection()

    try:
        if args.list_ranges or not (args.start_date and args.end_date):
            list_available_ranges(conn)
            if not (args.start_date and args.end_date):
                print(
                    "\nTip: Specify --country, --start-date YYYY-MM-DD, and --end-date YYYY-MM-DD to view summary metrics."
                )
                return

        query_market_summary(conn, args.country, args.start_date, args.end_date)

        if args.export_snapshot:
            export_chart_snapshot(
                conn, args.country, args.start_date, args.end_date, args.export_snapshot
            )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
