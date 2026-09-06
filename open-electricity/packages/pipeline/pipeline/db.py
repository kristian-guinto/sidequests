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
)
from pipeline.fx import get_fx_rate, COUNTRY_TO_CURRENCY

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

        default_dur = 5 if country_code.upper() == "PH" else 30
        curr = COUNTRY_TO_CURRENCY.get(country_code.upper(), "PHP")

        data = []
        for r in records:
            mw = float(r.get("generation_mw", 0.0) or 0.0)
            dur = int(r.get("interval_duration_mins") or default_dur)
            raw_energy = r.get("energy_mwh")
            mwh = (
                float(raw_energy)
                if raw_energy is not None
                else round(mw * (dur / 60.0), 4)
            )
            fuel = str(r.get("fuel_tech") or "").lower()
            price_local = (
                float(r.get("price_local", r.get("price_php_mwh")))
                if (
                    r.get("price_local") is not None
                    or r.get("price_php_mwh") is not None
                )
                else None
            )
            price_dollar = None
            if price_local is not None:
                fx = get_fx_rate(
                    r["timestamp"], r.get("currency", curr), conn=self.conn
                )
                price_dollar = round(price_local / fx, 2) if fx > 0 else None

            data.append(
                (
                    r.get("country_code", country_code).upper(),
                    r["timestamp"],
                    r["region"],
                    fuel,
                    mw,
                    mwh,
                    price_local,
                    price_dollar,
                )
            )

        self.conn.executemany(
            """
            INSERT INTO energy_interval (
                country_code, interval_start, region, fuel_tech,
                generation_mw, energy_mwh, price_local, price_dollar
            )
            VALUES (?, ?::TIMESTAMPTZ, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (country_code, interval_start, region, fuel_tech) DO UPDATE SET
                generation_mw = EXCLUDED.generation_mw,
                energy_mwh = EXCLUDED.energy_mwh,
                price_local = EXCLUDED.price_local,
                price_dollar = EXCLUDED.price_dollar;
        """,
            data,
        )
        return len(records)

    upsert_dispatch_5m = upsert_energy_interval

    def upsert_network_interval(
        self, records: List[Dict[str, Any]], country_code: str = "PH"
    ) -> int:
        """Backward compatibility no-op."""
        return len(records)

    upsert_regional_summary_5m = upsert_network_interval

    def upsert_energy_daily(
        self, records: List[Dict[str, Any]], country_code: str = "PH"
    ) -> int:
        if not records:
            return 0

        curr = COUNTRY_TO_CURRENCY.get(country_code.upper(), "PHP")

        data = []
        for r in records:
            p_local = (
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
                else None
            )
            t_local = (
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
                else None
            )
            fx = get_fx_rate(r["date"], r.get("currency", curr), conn=self.conn)
            vwap_dollar_val = r.get("vwap_price_dollar")
            p_dollar = (
                float(vwap_dollar_val)
                if vwap_dollar_val is not None
                else (
                    round(p_local / fx, 2) if p_local is not None and fx > 0 else None
                )
            )
            twap_dollar_val = r.get("twap_price_dollar")
            t_dollar = (
                float(twap_dollar_val)
                if twap_dollar_val is not None
                else (
                    round(t_local / fx, 2) if t_local is not None and fx > 0 else None
                )
            )

            data.append(
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
                        r.get("peak_generation_mw", r.get("peak_demand_mw", 0.0)) or 0.0
                    ),
                    p_local,
                    t_local,
                    p_dollar,
                    t_dollar,
                )
            )

        self.conn.executemany(
            """
            INSERT INTO energy_daily (
                country_code, date, region, fuel_tech, energy_mwh,
                avg_generation_mw, peak_generation_mw,
                vwap_price_local, twap_price_local, vwap_price_dollar, twap_price_dollar
            )
            VALUES (?, ?::DATE, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (country_code, date, region, fuel_tech) DO UPDATE SET
                energy_mwh = EXCLUDED.energy_mwh,
                avg_generation_mw = EXCLUDED.avg_generation_mw,
                peak_generation_mw = EXCLUDED.peak_generation_mw,
                vwap_price_local = EXCLUDED.vwap_price_local,
                twap_price_local = EXCLUDED.twap_price_local,
                vwap_price_dollar = EXCLUDED.vwap_price_dollar,
                twap_price_dollar = EXCLUDED.twap_price_dollar;
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
        """Aggregates energy_interval into energy_daily table with VWAP, TWAP, and USD conversions."""
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

        energy_sql = f"""
            INSERT INTO energy_daily (
                country_code, date, region, fuel_tech, energy_mwh,
                avg_generation_mw, peak_generation_mw,
                vwap_price_local, twap_price_local,
                vwap_price_dollar, twap_price_dollar
            )
            SELECT
                country_code,
                interval_start::DATE AS date,
                region,
                fuel_tech,
                round(sum(energy_mwh), 2) AS energy_mwh,
                round(avg(generation_mw), 2) AS avg_generation_mw,
                round(max(generation_mw), 2) AS peak_generation_mw,
                CASE
                    WHEN sum(energy_mwh) > 0 AND count(price_local) > 0
                    THEN round(sum(COALESCE(price_local, 0.0) * energy_mwh) / sum(energy_mwh), 2)
                    ELSE round(avg(price_local), 2)
                END AS vwap_price_local,
                round(avg(price_local), 2) AS twap_price_local,
                CASE
                    WHEN sum(energy_mwh) > 0 AND count(price_dollar) > 0
                    THEN round(sum(COALESCE(price_dollar, 0.0) * energy_mwh) / sum(energy_mwh), 2)
                    ELSE round(avg(price_dollar), 2)
                END AS vwap_price_dollar,
                round(avg(price_dollar), 2) AS twap_price_dollar
            FROM energy_interval
            WHERE country_code = ? {date_cond}
            GROUP BY country_code, interval_start::DATE, region, fuel_tech
            ON CONFLICT (country_code, date, region, fuel_tech) DO UPDATE SET
                energy_mwh = EXCLUDED.energy_mwh,
                avg_generation_mw = EXCLUDED.avg_generation_mw,
                peak_generation_mw = EXCLUDED.peak_generation_mw,
                vwap_price_local = EXCLUDED.vwap_price_local,
                twap_price_local = EXCLUDED.twap_price_local,
                vwap_price_dollar = EXCLUDED.vwap_price_dollar,
                twap_price_dollar = EXCLUDED.twap_price_dollar;
        """
        self.conn.execute(energy_sql, params)
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
            ("energy_interval", "Interval Fuel Mix Generation & Prices (Local & USD)"),
            ("energy_daily", "Daily Fuel Mix Rollups, VWAP & TWAP"),
            ("exchange_rates", "Daily Reference FX Rates to USD"),
        ]

        print(f"\n📊 TABLE OVERVIEW ({country}):")
        print(f"  {'-' * 76}")
        print(
            f"  {'Table Name':<24} | {'Rows':<8} | {'Date / Time Span':<22} | {'Description'}"
        )
        print(f"  {'-' * 76}")

        for tbl, desc in tables_info:
            try:
                cnt_row = self.conn.execute(
                    f"SELECT COUNT(*) FROM {tbl}{country_filter if tbl != 'exchange_rates' else ''}",
                    c_params if tbl != "exchange_rates" else [],
                ).fetchone()
                cnt = cnt_row[0] if cnt_row is not None else 0
                time_span = "—"
                if tbl == "energy_interval" and cnt > 0:
                    span_row = self.conn.execute(
                        f"SELECT MIN(interval_start), MAX(interval_start) FROM {tbl}{country_filter}",
                        c_params,
                    ).fetchone()
                    if span_row and span_row[0] and span_row[1]:
                        time_span = (
                            f"{str(span_row[0])[:10]} -> {str(span_row[1])[:10]}"
                        )
                elif tbl in ("energy_daily", "exchange_rates") and cnt > 0:
                    span_row = self.conn.execute(
                        f"SELECT MIN(date), MAX(date) FROM {tbl}{country_filter if tbl != 'exchange_rates' else ''}",
                        c_params if tbl != "exchange_rates" else [],
                    ).fetchone()
                    if span_row and span_row[0] and span_row[1]:
                        time_span = f"{span_row[0]} -> {span_row[1]}"

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
