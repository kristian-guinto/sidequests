import duckdb
from typing import List, Dict, Any, Optional
from pathlib import Path
from pipeline.config import DUCKDB_PATH, MOTHERDUCK_TOKEN, MOTHERDUCK_DATABASE, DB_MODE


class Database:
    def __init__(self):
        self.is_motherduck = bool(MOTHERDUCK_TOKEN and DB_MODE != "duckdb")

        if self.is_motherduck:
            self.conn_str = f"md:{MOTHERDUCK_DATABASE}"
            try:
                self.conn = duckdb.connect(
                    self.conn_str, config={"motherduck_token": MOTHERDUCK_TOKEN}
                )
                print(f"[DB] Connected to MotherDuck Cloud: {self.conn_str}")
            except Exception as e:
                print(f"[DB] MotherDuck connection failed ({e}), falling back to local DuckDB.")
                self.is_motherduck = False
                self.conn_str = str(DUCKDB_PATH)
                self.conn = duckdb.connect(self.conn_str)
        else:
            self.conn_str = str(DUCKDB_PATH)
            self.conn = duckdb.connect(self.conn_str)
            print(f"[DB] Connected to Local DuckDB: {DUCKDB_PATH.name}")

        self._init_schema()

    def _init_schema(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS facilities (
                resource_id VARCHAR PRIMARY KEY,
                facility_name VARCHAR NOT NULL,
                region VARCHAR NOT NULL,
                fuel_tech VARCHAR NOT NULL,
                capacity_mw DOUBLE DEFAULT 0.0,
                is_renewable BOOLEAN DEFAULT false,
                emissions_factor DOUBLE DEFAULT 0.0,
                status VARCHAR DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS energy_dispatch_5m (
                timestamp VARCHAR NOT NULL,
                region VARCHAR NOT NULL,
                fuel_tech VARCHAR NOT NULL,
                generation_mw DOUBLE NOT NULL DEFAULT 0.0,
                price_php_mwh DOUBLE,
                PRIMARY KEY (timestamp, region, fuel_tech)
            );
        """)

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS regional_summary_5m (
                timestamp VARCHAR NOT NULL,
                region VARCHAR NOT NULL,
                demand_mw DOUBLE NOT NULL DEFAULT 0.0,
                generation_mw DOUBLE NOT NULL DEFAULT 0.0,
                losses_mw DOUBLE NOT NULL DEFAULT 0.0,
                import_mw DOUBLE NOT NULL DEFAULT 0.0,
                export_mw DOUBLE NOT NULL DEFAULT 0.0,
                net_interconnector_mw DOUBLE NOT NULL DEFAULT 0.0,
                price_php_mwh DOUBLE,
                renewables_pct DOUBLE,
                PRIMARY KEY (timestamp, region)
            );
        """)

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS energy_daily_stats (
                date VARCHAR NOT NULL,
                region VARCHAR NOT NULL,
                fuel_tech VARCHAR NOT NULL,
                energy_mwh DOUBLE NOT NULL DEFAULT 0.0,
                avg_price_php_mwh DOUBLE,
                peak_demand_mw DOUBLE,
                min_demand_mw DOUBLE,
                emissions_tco2 DOUBLE DEFAULT 0.0,
                PRIMARY KEY (date, region, fuel_tech)
            );
        """)

    def upsert_facilities(self, facilities: List[Dict[str, Any]]) -> int:
        if not facilities:
            return 0

        data = [
            (
                f["resource_id"],
                f["facility_name"],
                f["region"],
                f["fuel_tech"],
                float(f.get("capacity_mw", 0.0) or 0.0),
                bool(f.get("is_renewable")),
                float(f.get("emissions_factor", 0.0) or 0.0),
                f.get("status", "ACTIVE"),
            )
            for f in facilities
        ]

        self.conn.executemany("""
            INSERT INTO facilities (resource_id, facility_name, region, fuel_tech, capacity_mw, is_renewable, emissions_factor, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (resource_id) DO UPDATE SET
                facility_name = EXCLUDED.facility_name,
                region = EXCLUDED.region,
                fuel_tech = EXCLUDED.fuel_tech,
                capacity_mw = EXCLUDED.capacity_mw,
                is_renewable = EXCLUDED.is_renewable,
                emissions_factor = EXCLUDED.emissions_factor,
                status = EXCLUDED.status,
                updated_at = now();
        """, data)
        return len(facilities)

    def upsert_dispatch_5m(self, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0

        data = [
            (
                r["timestamp"],
                r["region"],
                r["fuel_tech"],
                float(r["generation_mw"] or 0.0),
                float(r["price_php_mwh"]) if r.get("price_php_mwh") is not None else None,
            )
            for r in records
        ]

        self.conn.executemany("""
            INSERT INTO energy_dispatch_5m (timestamp, region, fuel_tech, generation_mw, price_php_mwh)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (timestamp, region, fuel_tech) DO UPDATE SET
                generation_mw = EXCLUDED.generation_mw,
                price_php_mwh = EXCLUDED.price_php_mwh;
        """, data)
        return len(records)

    def upsert_regional_summary_5m(self, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0

        data = [
            (
                r["timestamp"],
                r["region"],
                float(r.get("demand_mw", 0.0) or 0.0),
                float(r.get("generation_mw", 0.0) or 0.0),
                float(r.get("losses_mw", 0.0) or 0.0),
                float(r.get("import_mw", 0.0) or 0.0),
                float(r.get("export_mw", 0.0) or 0.0),
                float(r.get("net_interconnector_mw", 0.0) or 0.0),
                float(r["price_php_mwh"]) if r.get("price_php_mwh") is not None else None,
                float(r["renewables_pct"]) if r.get("renewables_pct") is not None else None,
            )
            for r in records
        ]

        self.conn.executemany("""
            INSERT INTO regional_summary_5m (timestamp, region, demand_mw, generation_mw, losses_mw, import_mw, export_mw, net_interconnector_mw, price_php_mwh, renewables_pct)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (timestamp, region) DO UPDATE SET
                demand_mw = EXCLUDED.demand_mw,
                generation_mw = EXCLUDED.generation_mw,
                losses_mw = EXCLUDED.losses_mw,
                import_mw = EXCLUDED.import_mw,
                export_mw = EXCLUDED.export_mw,
                net_interconnector_mw = EXCLUDED.net_interconnector_mw,
                price_php_mwh = EXCLUDED.price_php_mwh,
                renewables_pct = EXCLUDED.renewables_pct;
        """, data)
        return len(records)

    def upsert_daily_stats(self, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0

        data = [
            (
                r["date"],
                r["region"],
                r["fuel_tech"],
                float(r.get("energy_mwh", 0.0) or 0.0),
                float(r["avg_price_php_mwh"]) if r.get("avg_price_php_mwh") is not None else None,
                float(r.get("peak_demand_mw", 0.0) or 0.0),
                float(r.get("min_demand_mw", 0.0) or 0.0),
                float(r.get("emissions_tco2", 0.0) or 0.0),
            )
            for r in records
        ]

        self.conn.executemany("""
            INSERT INTO energy_daily_stats (date, region, fuel_tech, energy_mwh, avg_price_php_mwh, peak_demand_mw, min_demand_mw, emissions_tco2)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (date, region, fuel_tech) DO UPDATE SET
                energy_mwh = EXCLUDED.energy_mwh,
                avg_price_php_mwh = EXCLUDED.avg_price_php_mwh,
                peak_demand_mw = EXCLUDED.peak_demand_mw,
                min_demand_mw = EXCLUDED.min_demand_mw,
                emissions_tco2 = EXCLUDED.emissions_tco2;
        """, data)
        return len(records)

    def inspect_database(
        self, table: Optional[str] = None, region: Optional[str] = None, limit: int = 15
    ):
        """Inspects database tables, counts, and sample records."""
        print(f"================================================================================")
        print(f"  OpenNEM-PH Database Inspector (DuckDB: {self.conn_str})")
        print(f"================================================================================")

        tables_info = [
            ("facilities", "Generator & Power Plant Catalog"),
            ("energy_dispatch_5m", "5-Min Fuel Mix Generation & Spot Prices"),
            ("regional_summary_5m", "5-Min Regional Demand, Losses & Interconnectors"),
            ("energy_daily_stats", "Daily Rollups & Emissions"),
        ]

        print(f"\n📊 TABLE OVERVIEW:")
        print(f"  {'-'*76}")
        print(f"  {'Table Name':<24} | {'Rows':<8} | {'Date / Time Span':<22} | {'Description'}")
        print(f"  {'-'*76}")

        for tbl, desc in tables_info:
            try:
                cnt = self.conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
                time_span = "—"
                if tbl in ("energy_dispatch_5m", "regional_summary_5m") and cnt > 0:
                    min_t, max_t = self.conn.execute(f"SELECT MIN(timestamp), MAX(timestamp) FROM {tbl}").fetchone()
                    if min_t and max_t:
                        time_span = f"{min_t[:10]} -> {max_t[:10]}"
                elif tbl == "energy_daily_stats" and cnt > 0:
                    min_d, max_d = self.conn.execute(f"SELECT MIN(date), MAX(date) FROM {tbl}").fetchone()
                    if min_d and max_d:
                        time_span = f"{min_d} -> {max_d}"

                print(f"  {tbl:<24} | {cnt:<8} | {time_span:<22} | {desc}")
            except Exception:
                print(f"  {tbl:<24} | {'0':<8} | {'—':<22} | (Table not created yet)")

        print(f"  {'-'*76}")

        target_table = (table or "").lower()

        if target_table in ("facilities", "facility", "all"):
            print(f"\n🏭 FACILITIES SAMPLE (Top {limit}):")
            filter_sql = " WHERE region = ?" if region else ""
            params = [region.upper()] if region else []
            rows = self.conn.execute(
                f"SELECT resource_id, facility_name, region, fuel_tech, capacity_mw, is_renewable FROM facilities{filter_sql} ORDER BY capacity_mw DESC LIMIT ?",
                params + [limit],
            ).fetchall()
            print(f"  {'ID':<16} | {'Facility Name':<32} | {'Region':<8} | {'Fuel':<10} | {'Cap(MW)':<8} | {'RE?'}")
            print(f"  {'-'*88}")
            for r in rows:
                print(f"  {r[0]:<16} | {r[1][:32]:<32} | {r[2]:<8} | {r[3]:<10} | {r[4] or 0:<8.1f} | {'Yes' if r[5] else 'No'}")

        if target_table in ("dispatch", "energy_dispatch_5m", "all") or not table:
            print(f"\n⚡ 5-MINUTE DISPATCH SAMPLE (Latest {limit} entries{f' for {region}' if region else ''}):")
            filter_sql = " WHERE region = ?" if region else ""
            params = [region.upper()] if region else []
            rows = self.conn.execute(
                f"SELECT timestamp, region, fuel_tech, generation_mw, price_php_mwh FROM energy_dispatch_5m{filter_sql} ORDER BY timestamp DESC, region ASC LIMIT ?",
                params + [limit],
            ).fetchall()
            print(f"  {'Timestamp':<25} | {'Region':<8} | {'Fuel Tech':<12} | {'Output (MW)':<12} | {'LMP Price (₱/MWh)'}")
            print(f"  {'-'*78}")
            for r in rows:
                p_str = f"₱{r[4]:.2f}" if r[4] is not None else "—"
                print(f"  {r[0]:<25} | {r[1]:<8} | {r[2]:<12} | {r[3]:<12.1f} | {p_str}")

        if target_table in ("regional", "regional_summary_5m", "summary"):
            print(f"\n🌐 REGIONAL SYSTEM BALANCE (Latest {limit} entries{f' for {region}' if region else ''}):")
            filter_sql = " WHERE region = ?" if region else ""
            params = [region.upper()] if region else []
            rows = self.conn.execute(
                f"SELECT timestamp, region, demand_mw, generation_mw, losses_mw, net_interconnector_mw FROM regional_summary_5m{filter_sql} ORDER BY timestamp DESC LIMIT ?",
                params + [limit],
            ).fetchall()
            print(f"  {'Timestamp':<25} | {'Region':<8} | {'Demand (MW)':<12} | {'Gen (MW)':<10} | {'Losses':<8} | {'Net Flow'}")
            print(f"  {'-'*78}")
            for r in rows:
                print(f"  {r[0]:<25} | {r[1]:<8} | {r[2]:<12.1f} | {r[3]:<10.1f} | {r[4]:<8.1f} | {r[5]:.1f} MW")

        if target_table in ("daily", "energy_daily_stats"):
            print(f"\n📅 DAILY ROLLUPS SAMPLE (Latest {limit} entries{f' for {region}' if region else ''}):")
            filter_sql = " WHERE region = ?" if region else ""
            params = [region.upper()] if region else []
            rows = self.conn.execute(
                f"SELECT date, region, fuel_tech, energy_mwh, avg_price_php_mwh, emissions_tco2 FROM energy_daily_stats{filter_sql} ORDER BY date DESC, energy_mwh DESC LIMIT ?",
                params + [limit],
            ).fetchall()
            print(f"  {'Date':<12} | {'Region':<8} | {'Fuel Tech':<12} | {'Energy (MWh)':<14} | {'Avg Price':<12} | {'Emissions'}")
            print(f"  {'-'*78}")
            for r in rows:
                p_str = f"₱{r[4]:.2f}" if r[4] is not None else "—"
                print(f"  {r[0]:<12} | {r[1]:<8} | {r[2]:<12} | {r[3]:<14.1f} | {p_str:<12} | {r[5]:.1f} tCO₂")

        print(f"\n================================================================================\n")
