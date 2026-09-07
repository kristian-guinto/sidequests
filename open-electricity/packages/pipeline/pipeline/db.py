"""Database storage layer and SQL rollups for OpenElectricity pipeline."""

import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Union, Sequence, Tuple
from enum import Enum
import duckdb
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from ducklembic import DuckDB as DucklembicDB
from pipeline.config import (
    DUCKDB_PATH,
    MOTHERDUCK_TOKEN,
    MOTHERDUCK_DATABASE,
    COUNTRIES_CONFIG,
)
from pipeline.schema import validate_database_schema
from pipeline.models import FacilityRecord, EnergyIntervalRecord, ExchangeRateRecord
from pipeline.fx import get_fx_rate, COUNTRY_TO_CURRENCY


class DatabaseTarget(str, Enum):
    LOCAL = "local"
    MOTHERDUCK = "motherduck"


class DatabaseLockError(Exception):
    """Raised when a local DuckDB file cannot be opened because another process holds a write lock."""

    pass


class Database:
    """
    DuckDB and MotherDuck database storage engine for pipeline data ingestion.
    Provides idempotent upserts and in-database SQL rollups without running migrations.
    """

    def __init__(
        self,
        target: Optional[Union[str, DatabaseTarget]] = None,
        local_path: Optional[Any] = None,
        motherduck_token: Optional[str] = None,
        motherduck_database: Optional[str] = None,
        validate_schema: bool = True,
        max_lock_retries: int = 3,
    ):
        target_str = str(
            target.value if isinstance(target, DatabaseTarget) else (target or "local")
        ).lower()
        self.target = (
            DatabaseTarget.MOTHERDUCK
            if "motherduck" in target_str
            else DatabaseTarget.LOCAL
        )

        self.local_path = Path(local_path) if local_path is not None else DUCKDB_PATH
        self.md_token = motherduck_token or MOTHERDUCK_TOKEN
        self.md_db = motherduck_database or MOTHERDUCK_DATABASE

        self._ducklembic_db: Optional[DucklembicDB] = None
        self.conn: duckdb.DuckDBPyConnection

        self._connect(max_lock_retries=max_lock_retries)

        if validate_schema:
            validate_database_schema(self.conn)

    def _connect(self, max_lock_retries: int = 3) -> None:
        delays = (1.0, 2.0, 4.0)

        if self.target == DatabaseTarget.MOTHERDUCK:
            if not self.md_token:
                raise ValueError(
                    "MotherDuck target selected but no MOTHERDUCK_TOKEN provided."
                )
            self._ducklembic_db = DucklembicDB(
                motherduck_token=self.md_token,
                motherduck_database=self.md_db,
                mode="motherduck",
            )
            self.conn = self._ducklembic_db.conn
            self.conn_str = self._ducklembic_db.conn_str
            self.is_motherduck = True
            print(f"[DB] Connected to MotherDuck Cloud: {self.conn_str}")
            return

        # Local DuckDB connection with lock retry logic
        for attempt in range(max_lock_retries):
            try:
                self._ducklembic_db = DucklembicDB(
                    local_path=self.local_path,
                    mode="local",
                )
                self.conn = self._ducklembic_db.conn
                self.conn_str = str(self.local_path)
                self.is_motherduck = False
                p_name = (
                    self.local_path
                    if isinstance(self.local_path, str)
                    else self.local_path.name
                )
                print(f"[DB] Connected to Local DuckDB: {p_name}")
                return
            except (duckdb.IOException, Exception) as e:
                err_str = str(e).lower()
                is_lock = "lock" in err_str or "used by another process" in err_str
                if is_lock and attempt < max_lock_retries - 1:
                    sleep_sec = delays[attempt]
                    print(
                        f"[DB] Database file locked. Retrying in {sleep_sec}s (attempt {attempt + 1}/{max_lock_retries})..."
                    )
                    time.sleep(sleep_sec)
                    continue
                if is_lock:
                    raise DatabaseLockError(
                        f"Database '{self.local_path}' is currently locked by another process (e.g. API server or another terminal). "
                        "Please close other connections and retry."
                    ) from e
                raise

    def close(self) -> None:
        if self._ducklembic_db is not None:
            self._ducklembic_db.close()
            self._ducklembic_db = None

    def upsert_facilities(
        self,
        facilities: Sequence[Union[FacilityRecord, Dict[str, Any]]],
        country_code: str = "PH",
    ) -> int:
        """Idempotently upserts power plant catalog entries into facilities table."""
        if not facilities:
            return 0

        data = []
        for f in facilities:
            if isinstance(f, FacilityRecord):
                data.append(
                    (
                        f.country_code.upper(),
                        f.resource_id.upper(),
                        f.facility_name,
                        f.region,
                        f.fuel_tech,
                        f.capacity_mw,
                        f.is_renewable,
                        f.emissions_factor,
                        f.status,
                    )
                )
            else:
                data.append(
                    (
                        f.get("country_code", country_code).upper(),
                        f["resource_id"].upper(),
                        f["facility_name"],
                        f["region"],
                        f["fuel_tech"],
                        float(f.get("capacity_mw", 0.0) or 0.0),
                        bool(f.get("is_renewable")),
                        float(f.get("emissions_factor", 0.0) or 0.0),
                        f.get("status", "ACTIVE"),
                    )
                )

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
        self,
        records: Sequence[Union[EnergyIntervalRecord, Dict[str, Any]]],
        country_code: str = "PH",
    ) -> int:
        """Idempotently upserts generation interval records into energy_interval table inside a transaction."""
        if not records:
            return 0

        curr = COUNTRY_TO_CURRENCY.get(country_code.upper(), "PHP")
        default_dur = 5 if country_code.upper() == "PH" else 30

        data = []
        fx_cache: Dict[Tuple[str, str], float] = {}
        for r in records:
            if isinstance(r, EnergyIntervalRecord):
                c_code = r.country_code.upper()
                start_dt = r.interval_start
                reg = r.region
                fuel = r.fuel_tech.lower()
                mw = r.generation_mw
                mwh = r.energy_mwh
                p_local = r.price_local
                p_dollar = r.price_dollar
                if p_local is not None and p_dollar is None:
                    d_val = (
                        start_dt.date()
                        if hasattr(start_dt, "date")
                        else str(start_dt)[:10]
                    )
                    cache_key = (str(d_val)[:10], curr)
                    if cache_key not in fx_cache:
                        fx_cache[cache_key] = get_fx_rate(d_val, curr, conn=self.conn)
                    fx = fx_cache[cache_key]
                    p_dollar = round(p_local / fx, 2) if fx > 0 else None
                data.append((c_code, start_dt, reg, fuel, mw, mwh, p_local, p_dollar))
            else:
                c_code = r.get("country_code", country_code).upper()
                start_raw = r["timestamp"]
                reg = r["region"]
                fuel = str(r.get("fuel_tech") or "").lower()
                mw = float(r.get("generation_mw", 0.0) or 0.0)
                dur = int(r.get("interval_duration_mins") or default_dur)
                raw_energy = r.get("energy_mwh")
                mwh = (
                    float(raw_energy)
                    if raw_energy is not None
                    else round(mw * (dur / 60.0), 4)
                )
                p_local = (
                    float(r.get("price_local", r.get("price_php_mwh")))
                    if (
                        r.get("price_local") is not None
                        or r.get("price_php_mwh") is not None
                    )
                    else None
                )
                p_dollar = r.get("price_dollar")
                if p_local is not None and p_dollar is None:
                    d_val = str(start_raw)[:10]
                    target_curr = r.get("currency", curr)
                    cache_key = (d_val, target_curr)
                    if cache_key not in fx_cache:
                        fx_cache[cache_key] = get_fx_rate(
                            d_val, target_curr, conn=self.conn
                        )
                    fx = fx_cache[cache_key]
                    p_dollar = round(p_local / fx, 2) if fx > 0 else None
                data.append((c_code, start_raw, reg, fuel, mw, mwh, p_local, p_dollar))

        self.conn.execute("BEGIN TRANSACTION")
        try:
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
            self.conn.execute("COMMIT")
        except Exception:
            self.conn.execute("ROLLBACK")
            raise

        return len(records)

    upsert_dispatch_5m = upsert_energy_interval

    def populate_energy_daily(
        self,
        country_code: str = "PH",
        start_date: Optional[Any] = None,
        end_date: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Executes in-database SQL aggregation from energy_interval into energy_daily table,
        calculating VWAP, TWAP, and USD price conversions.
        """
        country = country_code.upper()
        tz = COUNTRIES_CONFIG.get(country, {}).get("timezone", "UTC")
        self.conn.execute(f"SET TimeZone = '{tz}'")
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
        self.conn.execute("BEGIN TRANSACTION")
        try:
            self.conn.execute(energy_sql, params)
            self.conn.execute("COMMIT")
        except Exception:
            self.conn.execute("ROLLBACK")
            raise

        return {"status": "success"}

    compute_daily_rollups = populate_energy_daily

    def upsert_exchange_rates(self, records: Sequence[ExchangeRateRecord]) -> int:
        """Idempotently upserts daily currency exchange rates."""
        if not records:
            return 0

        data = [(str(r.date)[:10], r.currency.upper(), r.rate_to_usd) for r in records]
        self.conn.executemany(
            """
            INSERT INTO exchange_rates (date, currency, rate_to_usd)
            VALUES (?::DATE, ?, ?)
            ON CONFLICT (date, currency) DO UPDATE SET rate_to_usd = EXCLUDED.rate_to_usd;
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
    ) -> None:
        """Inspects database tables, counts, and sample records."""
        country = (country_code or "ALL").upper()
        country_filter = " WHERE country_code = ?" if country != "ALL" else ""
        c_params = [country] if country != "ALL" else []

        console = Console()
        console.print(
            Panel(
                f"[bold yellow]OpenNEM-SEA Database Inspector[/bold yellow] ([dim]{self.conn_str}[/dim])\n"
                f"[dim]Target:[/dim] \\[{self.target.value}\\] | [dim]Scope:[/dim] Country = \\[{country}\\]",
                border_style="cyan",
                expand=False,
            )
        )

        tables_info = [
            ("facilities", "Generator & Power Plant Catalog"),
            ("energy_interval", "Interval Fuel Mix Generation & Prices (Local & USD)"),
            ("energy_daily", "Daily Fuel Mix Rollups, VWAP & TWAP"),
            ("exchange_rates", "Daily Reference FX Rates to USD"),
        ]

        overview_tbl = Table(title=f"Table Overview ({country})", border_style="blue")
        overview_tbl.add_column("Table Name", style="bold cyan")
        overview_tbl.add_column("Rows", justify="right")
        overview_tbl.add_column("Date / Time Span", style="dim")
        overview_tbl.add_column("Description")

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

                overview_tbl.add_row(tbl, f"{cnt:,}", time_span, desc)
            except Exception as e:
                overview_tbl.add_row(tbl, "0", "—", f"[red]Error: {e}[/red]")

        console.print(overview_tbl)

        target_table = (table or "").lower()
        if target_table in ("facilities", "facility", "all"):
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

            fac_tbl = Table(
                title=f"Facilities Sample (Top {limit})", border_style="magenta"
            )
            fac_tbl.add_column("CT", style="bold", justify="center")
            fac_tbl.add_column("ID", style="cyan")
            fac_tbl.add_column("Facility Name")
            fac_tbl.add_column("Region")
            fac_tbl.add_column("Fuel")
            fac_tbl.add_column("Cap (MW)", justify="right")
            fac_tbl.add_column("RE?", justify="center")

            for r in rows:
                fac_tbl.add_row(
                    r[0],
                    r[1],
                    r[2][:30],
                    r[3],
                    r[4],
                    f"{r[5] or 0:.1f}",
                    "[green]Yes[/green]" if r[6] else "[dim]No[/dim]",
                )
            console.print()
            console.print(fac_tbl)

        if target_table in ("energy_interval", "dispatch", "all") or not table:
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
                f"SELECT country_code, interval_start, region, fuel_tech, generation_mw, price_local, price_dollar FROM energy_interval{where_str} ORDER BY interval_start DESC, region ASC LIMIT ?",
                params + [limit],
            ).fetchall()

            int_tbl = Table(
                title=f"Energy Interval Sample (Latest {limit} entries)",
                border_style="green",
            )
            int_tbl.add_column("CT", style="bold", justify="center")
            int_tbl.add_column("Interval Start", style="dim")
            int_tbl.add_column("Region")
            int_tbl.add_column("Fuel Tech")
            int_tbl.add_column("Output (MW)", justify="right")
            int_tbl.add_column("Local Price", justify="right")
            int_tbl.add_column("USD Price", justify="right")

            for r in rows:
                p_sym = COUNTRIES_CONFIG.get(r[0], {}).get("currency_symbol", "$")
                p_local_str = f"{p_sym}{r[5]:.2f}" if r[5] is not None else "—"
                p_dollar_str = f"${r[6]:.2f}" if r[6] is not None else "—"
                int_tbl.add_row(
                    r[0],
                    str(r[1]),
                    r[2],
                    r[3],
                    f"{r[4]:.1f}",
                    p_local_str,
                    p_dollar_str,
                )
            console.print()
            console.print(int_tbl)

        console.print()
