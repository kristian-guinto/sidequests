import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from ducklembic import DuckDB, Migrator
from pipeline.config import (
    DUCKDB_PATH,
    MOTHERDUCK_TOKEN,
    MOTHERDUCK_DATABASE,
    DB_MODE,
    COUNTRIES_CONFIG,
    BASE_DIR,
    DEFAULT_EMISSIONS_FACTOR,
)

MIGRATIONS_DIR_STR = os.getenv("DUCKLEMBIC_MIGRATIONS_DIR")
MIGRATIONS_DIR = (
    Path(MIGRATIONS_DIR_STR) if MIGRATIONS_DIR_STR else BASE_DIR / "migrations"
)


class Database:
    def __init__(self, run_migrations: bool = True, local_path: Optional[Any] = None):
        target_path = local_path if local_path is not None else DUCKDB_PATH
        self.db = DuckDB(
            local_path=target_path,
            motherduck_token=MOTHERDUCK_TOKEN,
            motherduck_database=MOTHERDUCK_DATABASE,
            mode="local" if local_path is not None else DB_MODE,
        )
        self.conn = self.db.conn
        self.is_motherduck = self.db.is_motherduck
        self.conn_str = self.db.conn_str

        if self.is_motherduck:
            print(f"[DB] Connected to MotherDuck Cloud: {self.conn_str}")
        else:
            p_name = target_path if isinstance(target_path, str) else target_path.name
            print(f"[DB] Connected to Local DuckDB: {p_name}")

        if run_migrations:
            migrator = Migrator(self.db, migrations_dir=MIGRATIONS_DIR)
            migrator.init()
            migrator.migrate()

    def close(self):
        if hasattr(self, "db") and self.db:
            self.db.close()

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

    def upsert_energy_interval(
        self, records: List[Dict[str, Any]], country_code: str = "PH"
    ) -> int:
        if not records:
            return 0

        currency = COUNTRIES_CONFIG.get(country_code, {}).get("currency", "PHP")
        default_dur = 5 if country_code.upper() == "PH" else 30

        data = []
        for r in records:
            mw = float(r.get("generation_mw", 0.0) or 0.0)
            dur = int(r.get("interval_duration_mins") or default_dur)
            mwh = float(
                r.get("energy_mwh")
                if r.get("energy_mwh") is not None
                else round(mw * (dur / 60.0), 4)
            )
            fuel = str(r.get("fuel_tech") or "").lower()
            em = float(
                r.get("emissions_tco2")
                if r.get("emissions_tco2") is not None
                else round(mwh * DEFAULT_EMISSIONS_FACTOR.get(fuel, 0.0), 4)
            )
            price = (
                float(r.get("price_local", r.get("price_php_mwh")))
                if (
                    r.get("price_local") is not None
                    or r.get("price_php_mwh") is not None
                )
                else None
            )

            data.append(
                (
                    r.get("country_code", country_code).upper(),
                    r["timestamp"],
                    dur,
                    r["region"],
                    fuel,
                    mw,
                    mwh,
                    em,
                    price,
                    r.get("currency", currency),
                )
            )

        self.conn.executemany(
            """
            INSERT INTO energy_interval (
                country_code, interval_start, interval_duration_mins, region, fuel_tech,
                generation_mw, energy_mwh, emissions_tco2, price_local, currency
            )
            VALUES (?, ?::TIMESTAMPTZ, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (country_code, interval_start, region, fuel_tech) DO UPDATE SET
                interval_duration_mins = EXCLUDED.interval_duration_mins,
                generation_mw = EXCLUDED.generation_mw,
                energy_mwh = EXCLUDED.energy_mwh,
                emissions_tco2 = EXCLUDED.emissions_tco2,
                price_local = EXCLUDED.price_local,
                currency = EXCLUDED.currency;
        """,
            data,
        )
        return len(records)

    upsert_dispatch_5m = upsert_energy_interval

    def upsert_network_interval(
        self, records: List[Dict[str, Any]], country_code: str = "PH"
    ) -> int:
        if not records:
            return 0

        currency = COUNTRIES_CONFIG.get(country_code, {}).get("currency", "PHP")
        default_dur = 5 if country_code.upper() == "PH" else 30

        data = [
            (
                r.get("country_code", country_code).upper(),
                r["timestamp"],
                int(r.get("interval_duration_mins") or default_dur),
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
            INSERT INTO network_interval (
                country_code, interval_start, interval_duration_mins, region,
                demand_mw, generation_mw, losses_mw, import_mw, export_mw,
                net_interconnector_mw, price_local, currency, renewables_pct
            )
            VALUES (?, ?::TIMESTAMPTZ, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (country_code, interval_start, region) DO UPDATE SET
                interval_duration_mins = EXCLUDED.interval_duration_mins,
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

    upsert_regional_summary_5m = upsert_network_interval

    def upsert_energy_daily(
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
                float(
                    r.get(
                        "avg_generation_mw",
                        (r.get("energy_mwh", 0.0) or 0.0) / 24.0,
                    )
                ),
                float(
                    r.get("peak_generation_mw", r.get("peak_demand_mw", 0.0))
                    or 0.0
                ),
                float(r.get("emissions_tco2", 0.0) or 0.0),
                float(
                    r.get(
                        "vwap_price_local",
                        r.get("avg_price_local", r.get("avg_price_php_mwh")),
                    )
                )
                if (
                    r.get("vwap_price_local") is not None
                    or r.get("avg_price_local") is not None
                    or r.get("avg_price_php_mwh") is not None
                )
                else None,
                float(
                    r.get(
                        "twap_price_local",
                        r.get("avg_price_local", r.get("avg_price_php_mwh")),
                    )
                )
                if (
                    r.get("twap_price_local") is not None
                    or r.get("avg_price_local") is not None
                    or r.get("avg_price_php_mwh") is not None
                )
                else None,
                r.get("currency", currency),
            )
            for r in records
        ]

        self.conn.executemany(
            """
            INSERT INTO energy_daily (
                country_code, date, region, fuel_tech, energy_mwh,
                avg_generation_mw, peak_generation_mw, emissions_tco2,
                vwap_price_local, twap_price_local, currency
            )
            VALUES (?, ?::DATE, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (country_code, date, region, fuel_tech) DO UPDATE SET
                energy_mwh = EXCLUDED.energy_mwh,
                avg_generation_mw = EXCLUDED.avg_generation_mw,
                peak_generation_mw = EXCLUDED.peak_generation_mw,
                emissions_tco2 = EXCLUDED.emissions_tco2,
                vwap_price_local = EXCLUDED.vwap_price_local,
                twap_price_local = EXCLUDED.twap_price_local,
                currency = EXCLUDED.currency;
        """,
            data,
        )
        return len(records)

    upsert_daily_stats = upsert_energy_daily

    def compute_daily_rollups(
        self,
        country_code: str = "PH",
        start_date: Optional[Any] = None,
        end_date: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Aggregates energy_interval and network_interval into energy_daily and network_daily tables."""
        country = country_code.upper()
        date_cond = ""
        params: List[Any] = [country]

        if start_date and end_date:
            date_cond = " AND interval_start::DATE >= ?::DATE AND interval_start::DATE <= ?::DATE"
            params.extend([str(start_date), str(end_date)])
        elif start_date:
            date_cond = " AND interval_start::DATE >= ?::DATE"
            params.append(str(start_date))
        else:
            date_cond = " AND interval_start >= (SELECT COALESCE(MAX(interval_start) - INTERVAL '3 days', '2000-01-01'::TIMESTAMPTZ) FROM energy_interval WHERE country_code = ?)"
            params.append(country)

        # 1. Rollup energy_daily
        energy_sql = f"""
            INSERT INTO energy_daily (
                country_code, date, region, fuel_tech, energy_mwh,
                avg_generation_mw, peak_generation_mw, emissions_tco2,
                vwap_price_local, twap_price_local, currency
            )
            SELECT
                country_code,
                interval_start::DATE AS date,
                region,
                fuel_tech,
                round(sum(energy_mwh), 2) AS energy_mwh,
                round(avg(generation_mw), 2) AS avg_generation_mw,
                round(max(generation_mw), 2) AS peak_generation_mw,
                round(sum(emissions_tco2), 2) AS emissions_tco2,
                CASE
                    WHEN sum(energy_mwh) > 0 AND count(price_local) > 0
                    THEN round(sum(COALESCE(price_local, 0.0) * energy_mwh) / sum(energy_mwh), 2)
                    ELSE round(avg(price_local), 2)
                END AS vwap_price_local,
                round(avg(price_local), 2) AS twap_price_local,
                max(currency) AS currency
            FROM energy_interval
            WHERE country_code = ? {date_cond}
            GROUP BY country_code, interval_start::DATE, region, fuel_tech
            ON CONFLICT (country_code, date, region, fuel_tech) DO UPDATE SET
                energy_mwh = EXCLUDED.energy_mwh,
                avg_generation_mw = EXCLUDED.avg_generation_mw,
                peak_generation_mw = EXCLUDED.peak_generation_mw,
                emissions_tco2 = EXCLUDED.emissions_tco2,
                vwap_price_local = EXCLUDED.vwap_price_local,
                twap_price_local = EXCLUDED.twap_price_local,
                currency = EXCLUDED.currency;
        """
        self.conn.execute(energy_sql, params)

        # 2. Rollup network_daily
        net_params = [country] + params[1:]
        network_sql = f"""
            INSERT INTO network_daily (
                country_code, date, region, demand_mwh, avg_demand_mw, peak_demand_mw,
                min_demand_mw, generation_mwh, renewables_pct, net_interconnector_mwh,
                vwap_price_local, currency
            )
            SELECT
                country_code,
                interval_start::DATE AS date,
                region,
                round(sum(demand_mw * (interval_duration_mins / 60.0)), 2) AS demand_mwh,
                round(avg(demand_mw), 2) AS avg_demand_mw,
                round(max(demand_mw), 2) AS peak_demand_mw,
                round(min(demand_mw), 2) AS min_demand_mw,
                round(sum(generation_mw * (interval_duration_mins / 60.0)), 2) AS generation_mwh,
                round(avg(renewables_pct), 2) AS renewables_pct,
                round(sum(net_interconnector_mw * (interval_duration_mins / 60.0)), 2) AS net_interconnector_mwh,
                round(avg(price_local), 2) AS vwap_price_local,
                max(currency) AS currency
            FROM network_interval
            WHERE country_code = ? {date_cond}
            GROUP BY country_code, interval_start::DATE, region
            ON CONFLICT (country_code, date, region) DO UPDATE SET
                demand_mwh = EXCLUDED.demand_mwh,
                avg_demand_mw = EXCLUDED.avg_demand_mw,
                peak_demand_mw = EXCLUDED.peak_demand_mw,
                min_demand_mw = EXCLUDED.min_demand_mw,
                generation_mwh = EXCLUDED.generation_mwh,
                renewables_pct = EXCLUDED.renewables_pct,
                net_interconnector_mwh = EXCLUDED.net_interconnector_mwh,
                vwap_price_local = EXCLUDED.vwap_price_local,
                currency = EXCLUDED.currency;
        """
        self.conn.execute(network_sql, net_params)

        return {"status": "success"}

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
