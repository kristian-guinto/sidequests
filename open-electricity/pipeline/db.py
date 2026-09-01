import sqlite3
import json
from typing import List, Dict, Any, Optional
from pathlib import Path
from pipeline.config import SUPABASE_URL, SUPABASE_KEY, SQLITE_DB_PATH, DB_MODE


class Database:
    def __init__(self):
        self.is_supabase = bool(SUPABASE_URL and SUPABASE_KEY and DB_MODE != "sqlite")
        self.supabase_client = None

        if self.is_supabase:
            try:
                from supabase import create_client

                self.supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            except Exception as e:
                print(f"[DB] Supabase init failed ({e}), falling back to SQLite.")
                self.is_supabase = False

        if not self.is_supabase:
            self._init_sqlite()

    def _init_sqlite(self):
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS facilities (
                resource_id TEXT PRIMARY KEY,
                facility_name TEXT NOT NULL,
                region TEXT NOT NULL,
                fuel_tech TEXT NOT NULL,
                capacity_mw REAL,
                is_renewable INTEGER,
                emissions_factor REAL,
                status TEXT DEFAULT 'ACTIVE',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS energy_dispatch_5m (
                timestamp TEXT NOT NULL,
                region TEXT NOT NULL,
                fuel_tech TEXT NOT NULL,
                generation_mw REAL NOT NULL DEFAULT 0,
                price_php_mwh REAL,
                PRIMARY KEY (timestamp, region, fuel_tech)
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS regional_summary_5m (
                timestamp TEXT NOT NULL,
                region TEXT NOT NULL,
                demand_mw REAL NOT NULL DEFAULT 0,
                generation_mw REAL NOT NULL DEFAULT 0,
                losses_mw REAL NOT NULL DEFAULT 0,
                import_mw REAL NOT NULL DEFAULT 0,
                export_mw REAL NOT NULL DEFAULT 0,
                net_interconnector_mw REAL NOT NULL DEFAULT 0,
                price_php_mwh REAL,
                renewables_pct REAL,
                PRIMARY KEY (timestamp, region)
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS energy_daily_stats (
                date TEXT NOT NULL,
                region TEXT NOT NULL,
                fuel_tech TEXT NOT NULL,
                energy_mwh REAL NOT NULL DEFAULT 0,
                avg_price_php_mwh REAL,
                peak_demand_mw REAL,
                min_demand_mw REAL,
                emissions_tco2 REAL DEFAULT 0,
                PRIMARY KEY (date, region, fuel_tech)
            )
        """)
        conn.commit()
        conn.close()

    def upsert_facilities(self, facilities: List[Dict[str, Any]]) -> int:
        if not facilities:
            return 0

        if self.is_supabase and self.supabase_client:
            # Batch upsert via Supabase REST
            for i in range(0, len(facilities), 500):
                batch = facilities[i : i + 500]
                self.supabase_client.table("facilities").upsert(
                    batch, on_conflict="resource_id"
                ).execute()
            return len(facilities)

        # SQLite fallback
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.executemany(
            """
            INSERT INTO facilities (resource_id, facility_name, region, fuel_tech, capacity_mw, is_renewable, emissions_factor, status)
            VALUES (:resource_id, :facility_name, :region, :fuel_tech, :capacity_mw, :is_renewable, :emissions_factor, :status)
            ON CONFLICT(resource_id) DO UPDATE SET
                facility_name=excluded.facility_name,
                region=excluded.region,
                fuel_tech=excluded.fuel_tech,
                capacity_mw=excluded.capacity_mw,
                updated_at=CURRENT_TIMESTAMP
        """,
            [
                {
                    "resource_id": f["resource_id"],
                    "facility_name": f["facility_name"],
                    "region": f["region"],
                    "fuel_tech": f["fuel_tech"],
                    "capacity_mw": f.get("capacity_mw", 0.0),
                    "is_renewable": 1 if f.get("is_renewable") else 0,
                    "emissions_factor": f.get("emissions_factor", 0.0),
                    "status": f.get("status", "ACTIVE"),
                }
                for f in facilities
            ],
        )
        conn.commit()
        conn.close()
        return len(facilities)

    def upsert_dispatch_5m(self, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0

        if self.is_supabase and self.supabase_client:
            for i in range(0, len(records), 500):
                batch = records[i : i + 500]
                self.supabase_client.table("energy_dispatch_5m").upsert(
                    batch, on_conflict="timestamp,region,fuel_tech"
                ).execute()
            return len(records)

        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.executemany(
            """
            INSERT INTO energy_dispatch_5m (timestamp, region, fuel_tech, generation_mw, price_php_mwh)
            VALUES (:timestamp, :region, :fuel_tech, :generation_mw, :price_php_mwh)
            ON CONFLICT(timestamp, region, fuel_tech) DO UPDATE SET
                generation_mw=excluded.generation_mw,
                price_php_mwh=excluded.price_php_mwh
        """,
            records,
        )
        conn.commit()
        conn.close()
        return len(records)

    def upsert_regional_summary_5m(self, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0

        if self.is_supabase and self.supabase_client:
            for i in range(0, len(records), 500):
                batch = records[i : i + 500]
                self.supabase_client.table("regional_summary_5m").upsert(
                    batch, on_conflict="timestamp,region"
                ).execute()
            return len(records)

        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.executemany(
            """
            INSERT INTO regional_summary_5m (timestamp, region, demand_mw, generation_mw, losses_mw, import_mw, export_mw, net_interconnector_mw, price_php_mwh, renewables_pct)
            VALUES (:timestamp, :region, :demand_mw, :generation_mw, :losses_mw, :import_mw, :export_mw, :net_interconnector_mw, :price_php_mwh, :renewables_pct)
            ON CONFLICT(timestamp, region) DO UPDATE SET
                demand_mw=excluded.demand_mw,
                generation_mw=excluded.generation_mw,
                losses_mw=excluded.losses_mw,
                import_mw=excluded.import_mw,
                export_mw=excluded.export_mw,
                net_interconnector_mw=excluded.net_interconnector_mw,
                price_php_mwh=excluded.price_php_mwh,
                renewables_pct=excluded.renewables_pct
        """,
            [
                {
                    "timestamp": r["timestamp"],
                    "region": r["region"],
                    "demand_mw": r["demand_mw"],
                    "generation_mw": r["generation_mw"],
                    "losses_mw": r["losses_mw"],
                    "import_mw": r["import_mw"],
                    "export_mw": r["export_mw"],
                    "net_interconnector_mw": r.get("net_interconnector_mw", 0.0),
                    "price_php_mwh": r.get("price_php_mwh"),
                    "renewables_pct": r.get("renewables_pct"),
                }
                for r in records
            ],
        )
        conn.commit()
        conn.close()
        return len(records)

    def upsert_daily_stats(self, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0

        if self.is_supabase and self.supabase_client:
            for i in range(0, len(records), 500):
                batch = records[i : i + 500]
                self.supabase_client.table("energy_daily_stats").upsert(
                    batch, on_conflict="date,region,fuel_tech"
                ).execute()
            return len(records)

        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.executemany(
            """
            INSERT INTO energy_daily_stats (date, region, fuel_tech, energy_mwh, avg_price_php_mwh, peak_demand_mw, min_demand_mw, emissions_tco2)
            VALUES (:date, :region, :fuel_tech, :energy_mwh, :avg_price_php_mwh, :peak_demand_mw, :min_demand_mw, :emissions_tco2)
            ON CONFLICT(date, region, fuel_tech) DO UPDATE SET
                energy_mwh=excluded.energy_mwh,
                avg_price_php_mwh=excluded.avg_price_php_mwh,
                peak_demand_mw=excluded.peak_demand_mw,
                min_demand_mw=excluded.min_demand_mw,
                emissions_tco2=excluded.emissions_tco2
        """,
            records,
        )
        conn.commit()
        conn.close()
        return len(records)

    def inspect_database(
        self, table: Optional[str] = None, region: Optional[str] = None, limit: int = 15
    ):
        """Inspects database tables, counts, and sample records."""
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()

        print(
            f"================================================================================"
        )
        print(f"  OpenNEM-PH Database Inspector (SQLite: {SQLITE_DB_PATH.name})")
        print(
            f"================================================================================"
        )

        # Overview Table Counts & Date Ranges
        tables_info = [
            ("facilities", "Generator & Power Plant Catalog"),
            ("energy_dispatch_5m", "5-Min Fuel Mix Generation & Spot Prices"),
            ("regional_summary_5m", "5-Min Regional Demand, Losses & Interconnectors"),
            ("energy_daily_stats", "Daily Rollups & Emissions"),
        ]

        print(f"\n📊 TABLE OVERVIEW:")
        print(f"  {'-' * 76}")
        print(
            f"  {'Table Name':<24} | {'Rows':<8} | {'Date / Time Span':<22} | {'Description'}"
        )
        print(f"  {'-' * 76}")

        for tbl, desc in tables_info:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                cnt = cur.fetchone()[0]

                time_span = "—"
                if tbl in ("energy_dispatch_5m", "regional_summary_5m") and cnt > 0:
                    cur.execute(f"SELECT MIN(timestamp), MAX(timestamp) FROM {tbl}")
                    min_t, max_t = cur.fetchone()
                    if min_t and max_t:
                        time_span = f"{min_t[:10]} -> {max_t[:10]}"
                elif tbl == "energy_daily_stats" and cnt > 0:
                    cur.execute(f"SELECT MIN(date), MAX(date) FROM {tbl}")
                    min_d, max_d = cur.fetchone()
                    if min_d and max_d:
                        time_span = f"{min_d} -> {max_d}"

                print(f"  {tbl:<24} | {cnt:<8} | {time_span:<22} | {desc}")
            except sqlite3.OperationalError:
                print(f"  {tbl:<24} | {'0':<8} | {'—':<22} | (Table not created yet)")

        print(f"  {'-' * 76}")

        # If specific table requested or general sample
        target_table = (table or "").lower()

        if target_table in ("facilities", "facility", "all"):
            print(f"\n🏭 FACILITIES SAMPLE (Top {limit}):")
            filter_sql = " WHERE region = ?" if region else ""
            params = (region.upper(),) if region else ()
            cur.execute(
                f"SELECT resource_id, facility_name, region, fuel_tech, capacity_mw, is_renewable FROM facilities{filter_sql} ORDER BY capacity_mw DESC LIMIT ?",
                (*params, limit),
            )
            rows = cur.fetchall()
            print(
                f"  {'ID':<16} | {'Facility Name':<32} | {'Region':<8} | {'Fuel':<10} | {'Cap(MW)':<8} | {'RE?'}"
            )
            print(f"  {'-' * 88}")
            for r in rows:
                print(
                    f"  {r[0]:<16} | {r[1][:32]:<32} | {r[2]:<8} | {r[3]:<10} | {r[4] or 0:<8.1f} | {'Yes' if r[5] else 'No'}"
                )

        if target_table in ("dispatch", "energy_dispatch_5m", "all") or not table:
            print(
                f"\n⚡ 5-MINUTE DISPATCH SAMPLE (Latest {limit} entries{f' for {region}' if region else ''}):"
            )
            filter_sql = " WHERE region = ?" if region else ""
            params = (region.upper(),) if region else ()
            cur.execute(
                f"SELECT timestamp, region, fuel_tech, generation_mw, price_php_mwh FROM energy_dispatch_5m{filter_sql} ORDER BY timestamp DESC, region ASC LIMIT ?",
                (*params, limit),
            )
            rows = cur.fetchall()
            print(
                f"  {'Timestamp':<25} | {'Region':<8} | {'Fuel Tech':<12} | {'Output (MW)':<12} | {'LMP Price (₱/MWh)'}"
            )
            print(f"  {'-' * 78}")
            for r in rows:
                p_str = f"₱{r[4]:.2f}" if r[4] is not None else "—"
                print(
                    f"  {r[0]:<25} | {r[1]:<8} | {r[2]:<12} | {r[3]:<12.1f} | {p_str}"
                )

        if target_table in ("regional", "regional_summary_5m", "summary"):
            print(
                f"\n🌐 REGIONAL SYSTEM BALANCE (Latest {limit} entries{f' for {region}' if region else ''}):"
            )
            filter_sql = " WHERE region = ?" if region else ""
            params = (region.upper(),) if region else ()
            cur.execute(
                f"SELECT timestamp, region, demand_mw, generation_mw, losses_mw, net_interconnector_mw FROM regional_summary_5m{filter_sql} ORDER BY timestamp DESC LIMIT ?",
                (*params, limit),
            )
            rows = cur.fetchall()
            print(
                f"  {'Timestamp':<25} | {'Region':<8} | {'Demand (MW)':<12} | {'Gen (MW)':<10} | {'Losses':<8} | {'Net Flow'}"
            )
            print(f"  {'-' * 78}")
            for r in rows:
                print(
                    f"  {r[0]:<25} | {r[1]:<8} | {r[2]:<12.1f} | {r[3]:<10.1f} | {r[4]:<8.1f} | {r[5]:.1f} MW"
                )

        if target_table in ("daily", "energy_daily_stats"):
            print(
                f"\n📅 DAILY ROLLUPS SAMPLE (Latest {limit} entries{f' for {region}' if region else ''}):"
            )
            filter_sql = " WHERE region = ?" if region else ""
            params = (region.upper(),) if region else ()
            cur.execute(
                f"SELECT date, region, fuel_tech, energy_mwh, avg_price_php_mwh, emissions_tco2 FROM energy_daily_stats{filter_sql} ORDER BY date DESC, energy_mwh DESC LIMIT ?",
                (*params, limit),
            )
            rows = cur.fetchall()
            print(
                f"  {'Date':<12} | {'Region':<8} | {'Fuel Tech':<12} | {'Energy (MWh)':<14} | {'Avg Price':<12} | {'Emissions'}"
            )
            print(f"  {'-' * 78}")
            for r in rows:
                p_str = f"₱{r[4]:.2f}" if r[4] is not None else "—"
                print(
                    f"  {r[0]:<12} | {r[1]:<8} | {r[2]:<12} | {r[3]:<14.1f} | {p_str:<12} | {r[5]:.1f} tCO₂"
                )

        conn.close()
        print(
            f"\n================================================================================\n"
        )
