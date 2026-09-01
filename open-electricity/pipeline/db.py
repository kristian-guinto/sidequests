import duckdb
from typing import List, Dict, Any, Optional
from pipeline.config import (
    DUCKDB_PATH,
    MOTHERDUCK_TOKEN,
    MOTHERDUCK_DATABASE,
    DB_MODE,
    COUNTRIES_CONFIG,
)


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
                print(
                    f"[DB] MotherDuck connection failed ({e}), falling back to local DuckDB."
                )
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
                country_code VARCHAR NOT NULL DEFAULT 'PH',
                resource_id VARCHAR NOT NULL,
                facility_name VARCHAR NOT NULL,
                region VARCHAR NOT NULL,
                fuel_tech VARCHAR NOT NULL,
                capacity_mw DOUBLE DEFAULT 0.0,
                is_renewable BOOLEAN DEFAULT false,
                emissions_factor DOUBLE DEFAULT 0.0,
                status VARCHAR DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (country_code, resource_id)
            );
        """)

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS energy_dispatch_5m (
                country_code VARCHAR NOT NULL DEFAULT 'PH',
                timestamp VARCHAR NOT NULL,
                region VARCHAR NOT NULL,
                fuel_tech VARCHAR NOT NULL,
                generation_mw DOUBLE NOT NULL DEFAULT 0.0,
                price_local DOUBLE,
                currency VARCHAR DEFAULT 'PHP',
                PRIMARY KEY (country_code, timestamp, region, fuel_tech)
            );
        """)

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS regional_summary_5m (
                country_code VARCHAR NOT NULL DEFAULT 'PH',
                timestamp VARCHAR NOT NULL,
                region VARCHAR NOT NULL,
                demand_mw DOUBLE NOT NULL DEFAULT 0.0,
                generation_mw DOUBLE NOT NULL DEFAULT 0.0,
                losses_mw DOUBLE NOT NULL DEFAULT 0.0,
                import_mw DOUBLE NOT NULL DEFAULT 0.0,
                export_mw DOUBLE NOT NULL DEFAULT 0.0,
                net_interconnector_mw DOUBLE NOT NULL DEFAULT 0.0,
                price_local DOUBLE,
                currency VARCHAR DEFAULT 'PHP',
                renewables_pct DOUBLE,
                PRIMARY KEY (country_code, timestamp, region)
            );
        """)

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS energy_daily_stats (
                country_code VARCHAR NOT NULL DEFAULT 'PH',
                date VARCHAR NOT NULL,
                region VARCHAR NOT NULL,
                fuel_tech VARCHAR NOT NULL,
                energy_mwh DOUBLE NOT NULL DEFAULT 0.0,
                avg_price_local DOUBLE,
                currency VARCHAR DEFAULT 'PHP',
                peak_demand_mw DOUBLE,
                min_demand_mw DOUBLE,
                emissions_tco2 DOUBLE DEFAULT 0.0,
                PRIMARY KEY (country_code, date, region, fuel_tech)
            );
        """)

    def upsert_facilities(
        self, facilities: List[Dict[str, Any]], country_code: str = "PH"
    ) -> int:
        if not facilities:
            return 0

        data = [
            (
                f.get("country_code", country_code).upper(),
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

        self.conn.executemany(
            """
            INSERT INTO facilities (country_code, resource_id, facility_name, region, fuel_tech, capacity_mw, is_renewable, emissions_factor, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (country_code, resource_id) DO UPDATE SET
                facility_name = EXCLUDED.facility_name,
                region = EXCLUDED.region,
                fuel_tech = EXCLUDED.fuel_tech,
                capacity_mw = EXCLUDED.capacity_mw,
                is_renewable = EXCLUDED.is_renewable,
                emissions_factor = EXCLUDED.emissions_factor,
                status = EXCLUDED.status,
                updated_at = now();
        """,
            data,
        )
        return len(facilities)

    def upsert_dispatch_5m(
        self, records: List[Dict[str, Any]], country_code: str = "PH"
    ) -> int:
        if not records:
            return 0

        currency = COUNTRIES_CONFIG.get(country_code, {}).get("currency", "PHP")

        data = [
            (
                r.get("country_code", country_code).upper(),
                r["timestamp"],
                r["region"],
                r["fuel_tech"],
                float(r["generation_mw"] or 0.0),
                float(r.get("price_local", r.get("price_php_mwh")))
                if (
                    r.get("price_local") is not None
                    or r.get("price_php_mwh") is not None
                )
                else None,
                r.get("currency", currency),
            )
            for r in records
        ]

        self.conn.executemany(
            """
            INSERT INTO energy_dispatch_5m (country_code, timestamp, region, fuel_tech, generation_mw, price_local, currency)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (country_code, timestamp, region, fuel_tech) DO UPDATE SET
                generation_mw = EXCLUDED.generation_mw,
                price_local = EXCLUDED.price_local,
                currency = EXCLUDED.currency;
        """,
            data,
        )
        return len(records)

    def upsert_regional_summary_5m(
        self, records: List[Dict[str, Any]], country_code: str = "PH"
    ) -> int:
        if not records:
            return 0

        currency = COUNTRIES_CONFIG.get(country_code, {}).get("currency", "PHP")

        data = [
            (
                r.get("country_code", country_code).upper(),
                r["timestamp"],
                r["region"],
                float(r.get("demand_mw", 0.0) or 0.0),
                float(r.get("generation_mw", 0.0) or 0.0),
                float(r.get("losses_mw", 0.0) or 0.0),
                float(r.get("import_mw", 0.0) or 0.0),
                float(r.get("export_mw", 0.0) or 0.0),
                float(r.get("net_interconnector_mw", 0.0) or 0.0),
                float(r.get("price_local", r.get("price_php_mwh")))
                if (
                    r.get("price_local") is not None
                    or r.get("price_php_mwh") is not None
                )
                else None,
                r.get("currency", currency),
                float(r["renewables_pct"])
                if r.get("renewables_pct") is not None
                else None,
            )
            for r in records
        ]

        self.conn.executemany(
            """
            INSERT INTO regional_summary_5m (country_code, timestamp, region, demand_mw, generation_mw, losses_mw, import_mw, export_mw, net_interconnector_mw, price_local, currency, renewables_pct)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (country_code, timestamp, region) DO UPDATE SET
                demand_mw = EXCLUDED.demand_mw,
                generation_mw = EXCLUDED.generation_mw,
                losses_mw = EXCLUDED.losses_mw,
                import_mw = EXCLUDED.import_mw,
                export_mw = EXCLUDED.export_mw,
                net_interconnector_mw = EXCLUDED.net_interconnector_mw,
                price_local = EXCLUDED.price_local,
                currency = EXCLUDED.currency,
                renewables_pct = EXCLUDED.renewables_pct;
        """,
            data,
        )
        return len(records)

    def upsert_daily_stats(
        self, records: List[Dict[str, Any]], country_code: str = "PH"
    ) -> int:
        if not records:
            return 0

        currency = COUNTRIES_CONFIG.get(country_code, {}).get("currency", "PHP")

        data = [
            (
                r.get("country_code", country_code).upper(),
                r["date"],
                r["region"],
                r["fuel_tech"],
                float(r.get("energy_mwh", 0.0) or 0.0),
                float(r.get("avg_price_local", r.get("avg_price_php_mwh")))
                if (
                    r.get("avg_price_local") is not None
                    or r.get("avg_price_php_mwh") is not None
                )
                else None,
                r.get("currency", currency),
                float(r.get("peak_demand_mw", 0.0) or 0.0),
                float(r.get("min_demand_mw", 0.0) or 0.0),
                float(r.get("emissions_tco2", 0.0) or 0.0),
            )
            for r in records
        ]

        self.conn.executemany(
            """
            INSERT INTO energy_daily_stats (country_code, date, region, fuel_tech, energy_mwh, avg_price_local, currency, peak_demand_mw, min_demand_mw, emissions_tco2)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (country_code, date, region, fuel_tech) DO UPDATE SET
                energy_mwh = EXCLUDED.energy_mwh,
                avg_price_local = EXCLUDED.avg_price_local,
                currency = EXCLUDED.currency,
                peak_demand_mw = EXCLUDED.peak_demand_mw,
                min_demand_mw = EXCLUDED.min_demand_mw,
                emissions_tco2 = EXCLUDED.emissions_tco2;
        """,
            data,
        )
        return len(records)

    def inspect_database(
        self,
        country_code: Optional[str] = None,
        table: Optional[str] = None,
        region: Optional[str] = None,
        limit: int = 15,
    ):
        """Inspects database tables, counts, and sample records across Southeast Asian countries."""
        country = (country_code or "ALL").upper()
        country_filter = " WHERE country_code = ?" if country != "ALL" else ""
        c_params = [country] if country != "ALL" else []

        print(
            "================================================================================"
        )
        print(f"  OpenNEM-SEA Database Inspector (DuckDB: {self.conn_str})")
        print(f"  Scope: Country = [{country}]")
        print(
            "================================================================================"
        )

        tables_info = [
            ("facilities", "Generator & Power Plant Catalog"),
            ("energy_dispatch_5m", "5-Min / 30-Min Fuel Mix Generation & Spot Prices"),
            ("regional_summary_5m", "Regional Demand, Losses & Interconnectors"),
            ("energy_daily_stats", "Daily Rollups & Emissions"),
        ]

        print(f"\n📊 TABLE OVERVIEW ({country}):")
        print(f"  {'-' * 76}")
        print(
            f"  {'Table Name':<24} | {'Rows':<8} | {'Date / Time Span':<22} | {'Description'}"
        )
        print(f"  {'-' * 76}")

        for tbl, desc in tables_info:
            try:
                cnt = self.conn.execute(
                    f"SELECT COUNT(*) FROM {tbl}{country_filter}", c_params
                ).fetchone()[0]
                time_span = "—"
                if tbl in ("energy_dispatch_5m", "regional_summary_5m") and cnt > 0:
                    min_t, max_t = self.conn.execute(
                        f"SELECT MIN(timestamp), MAX(timestamp) FROM {tbl}{country_filter}",
                        c_params,
                    ).fetchone()
                    if min_t and max_t:
                        time_span = f"{min_t[:10]} -> {max_t[:10]}"
                elif tbl == "energy_daily_stats" and cnt > 0:
                    min_d, max_d = self.conn.execute(
                        f"SELECT MIN(date), MAX(date) FROM {tbl}{country_filter}",
                        c_params,
                    ).fetchone()
                    if min_d and max_d:
                        time_span = f"{min_d} -> {max_d}"

                print(f"  {tbl:<24} | {cnt:<8} | {time_span:<22} | {desc}")
            except Exception as e:
                print(f"  {tbl:<24} | {'0':<8} | {'—':<22} | (Error: {e})")

        print(f"  {'-' * 76}")

        target_table = (table or "").lower()

        if target_table in ("facilities", "facility", "all"):
            print(f"\n🏭 FACILITIES SAMPLE (Top {limit}):")
            filter_clauses = []
            params = []
            if country != "ALL":
                filter_clauses.append("country_code = ?")
                params.append(country)
            if region:
                filter_clauses.append("region = ?")
                params.append(region.upper())

            where_str = (
                f" WHERE {' AND '.join(filter_clauses)}" if filter_clauses else ""
            )
            rows = self.conn.execute(
                f"SELECT country_code, resource_id, facility_name, region, fuel_tech, capacity_mw, is_renewable FROM facilities{where_str} ORDER BY capacity_mw DESC LIMIT ?",
                params + [limit],
            ).fetchall()
            print(
                f"  {'CT':<4} | {'ID':<14} | {'Facility Name':<30} | {'Region':<8} | {'Fuel':<10} | {'Cap(MW)':<8} | {'RE?'}"
            )
            print(f"  {'-' * 92}")
            for r in rows:
                print(
                    f"  {r[0]:<4} | {r[1]:<14} | {r[2][:30]:<30} | {r[3]:<8} | {r[4]:<10} | {r[5] or 0:<8.1f} | {'Yes' if r[6] else 'No'}"
                )

        if target_table in ("dispatch", "energy_dispatch_5m", "all") or not table:
            print(f"\n⚡ DISPATCH & MARKET SAMPLE (Latest {limit} entries):")
            filter_clauses = []
            params = []
            if country != "ALL":
                filter_clauses.append("country_code = ?")
                params.append(country)
            if region:
                filter_clauses.append("region = ?")
                params.append(region.upper())

            where_str = (
                f" WHERE {' AND '.join(filter_clauses)}" if filter_clauses else ""
            )
            rows = self.conn.execute(
                f"SELECT country_code, timestamp, region, fuel_tech, generation_mw, price_local, currency FROM energy_dispatch_5m{where_str} ORDER BY timestamp DESC, region ASC LIMIT ?",
                params + [limit],
            ).fetchall()
            print(
                f"  {'CT':<4} | {'Timestamp':<24} | {'Region':<8} | {'Fuel Tech':<12} | {'Output(MW)':<11} | {'Spot Price'}"
            )
            print(f"  {'-' * 82}")
            for r in rows:
                p_curr = r[6] or "PHP"
                p_sym = COUNTRIES_CONFIG.get(r[0], {}).get("currency_symbol", "$")
                p_str = f"{p_sym}{r[5]:.2f} {p_curr}" if r[5] is not None else "—"
                print(
                    f"  {r[0]:<4} | {r[1]:<24} | {r[2]:<8} | {r[3]:<12} | {r[4]:<11.1f} | {p_str}"
                )

        print(
            "\n================================================================================\n"
        )
