import os
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, TypedDict
from zoneinfo import ZoneInfo

import duckdb
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Ensure DuckDB temp files and extensions use writable /tmp on serverless environments
if (
    not os.getenv("HOME")
    or os.getenv("HOME") == "/"
    or not os.access(os.getenv("HOME", ""), os.W_OK)
):
    os.environ["HOME"] = "/tmp"

os.environ.setdefault("DUCKDB_EXTENSION_DIRECTORY", "/tmp/.duckdb/extensions")

# Load environment variables
load_dotenv(BASE_DIR / ".env")

MOTHERDUCK_TOKEN = os.getenv("MOTHERDUCK_TOKEN", "")
MOTHERDUCK_DATABASE = os.getenv("MOTHERDUCK_DATABASE", "open_electricity_db")
DUCKDB_PATH = BASE_DIR / "open_nem_ph.duckdb"

app = FastAPI(
    title="OpenElectricity API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Metadata & Fuel Constants
# ---------------------------------------------------------

COUNTRIES_METADATA = {
    "PH": {
        "name": "Philippines",
        "currencySymbol": "₱",
        "currencyCode": "PHP",
        "defaultRegion": "ALL",
        "minInterval": "5m",
        "timezone": "Asia/Manila",
        "tzOffset": "+08:00",
    },
    "SG": {
        "name": "Singapore",
        "currencySymbol": "S$",
        "currencyCode": "SGD",
        "defaultRegion": "SINGAPORE",
        "minInterval": "30m",
        "timezone": "Asia/Singapore",
        "tzOffset": "+08:00",
    },
    "MY": {
        "name": "Malaysia",
        "currencySymbol": "RM",
        "currencyCode": "MYR",
        "defaultRegion": "PENINSULAR",
        "minInterval": "30m",
        "timezone": "Asia/Kuala_Lumpur",
        "tzOffset": "+08:00",
    },
    "TH": {
        "name": "Thailand",
        "currencySymbol": "฿",
        "currencyCode": "THB",
        "defaultRegion": "THAILAND",
        "minInterval": "5m",
        "timezone": "Asia/Bangkok",
        "tzOffset": "+07:00",
    },
    "VN": {
        "name": "Vietnam",
        "currencySymbol": "₫",
        "currencyCode": "VND",
        "defaultRegion": "VIETNAM",
        "minInterval": "30m",
        "timezone": "Asia/Ho_Chi_Minh",
        "tzOffset": "+07:00",
    },
    "ID": {
        "name": "Indonesia",
        "currencySymbol": "Rp",
        "currencyCode": "IDR",
        "defaultRegion": "ALL",
        "minInterval": "1h",
        "timezone": "Asia/Jakarta",
        "tzOffset": "+07:00",
    },
}


class FuelMetaInfo(TypedDict):
    label: str
    color: str
    isRenewable: bool
    emissionsFactor: float


class RangeConfigInfo(TypedDict):
    unit: str
    defaultInterval: str
    days: int


FUEL_META: Dict[str, FuelMetaInfo] = {
    "solar": {
        "label": "Solar",
        "color": "#FDB813",
        "isRenewable": True,
        "emissionsFactor": 0.0,
    },
    "wind": {
        "label": "Wind",
        "color": "#417505",
        "isRenewable": True,
        "emissionsFactor": 0.0,
    },
    "hydro": {
        "label": "Hydro",
        "color": "#4A90E2",
        "isRenewable": True,
        "emissionsFactor": 0.0,
    },
    "geothermal": {
        "label": "Geothermal",
        "color": "#E35205",
        "isRenewable": True,
        "emissionsFactor": 0.05,
    },
    "biomass": {
        "label": "Biomass",
        "color": "#8B572A",
        "isRenewable": True,
        "emissionsFactor": 0.02,
    },
    "gas": {
        "label": "Gas",
        "color": "#50E3C2",
        "isRenewable": False,
        "emissionsFactor": 0.38,
    },
    "coal": {
        "label": "Coal",
        "color": "#333333",
        "isRenewable": False,
        "emissionsFactor": 0.90,
    },
    "oil": {
        "label": "Liquid Fuel / Oil",
        "color": "#9B9B9B",
        "isRenewable": False,
        "emissionsFactor": 0.75,
    },
    "battery": {
        "label": "Battery (Discharging)",
        "color": "#7ED321",
        "isRenewable": True,
        "emissionsFactor": 0.0,
    },
}

RANGE_CONFIG: Dict[str, RangeConfigInfo] = {
    "1d": {"unit": "MW", "defaultInterval": "5m", "days": 1},
    "3d": {"unit": "MW", "defaultInterval": "30m", "days": 3},
    "7d": {"unit": "MW", "defaultInterval": "30m", "days": 7},
    "30d": {"unit": "GWh", "defaultInterval": "1d", "days": 30},
    "1y": {"unit": "GWh", "defaultInterval": "1w", "days": 365},
}

# ---------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------


class FuelGenerationPoint(BaseModel):
    timestamp: str
    solar: Optional[float] = None
    wind: Optional[float] = None
    hydro: Optional[float] = None
    geothermal: Optional[float] = None
    biomass: Optional[float] = None
    gas: Optional[float] = None
    coal: Optional[float] = None
    oil: Optional[float] = None
    battery: Optional[float] = None
    price: Optional[float] = None
    priceDollar: Optional[float] = None
    totalGeneration: Optional[float] = None
    renewablesPct: Optional[float] = None
    hasData: Optional[bool] = True


class SummaryMetrics(BaseModel):
    renewablesPct: float
    totalGenerationGWh: float
    peakGenerationMW: float
    avgPriceLocal: float
    avgPriceUSD: Optional[float] = None
    currencySymbol: Optional[str] = "₱"
    currencyCode: Optional[str] = "PHP"
    emissionsIntensityGPerKWh: float
    totalEmissionsTonnes: float


class FuelBreakdownRow(BaseModel):
    fuelTech: str
    label: str
    color: str
    generationMW: float
    energyGWh: float
    percentage: float
    isRenewable: bool
    emissionsTonnes: float


class EnergyResponse(BaseModel):
    country: str
    region: str
    range: str
    interval: str
    source: str
    unit: str
    points: List[FuelGenerationPoint]
    summary: SummaryMetrics
    breakdown: List[FuelBreakdownRow]


# ---------------------------------------------------------
# Database Helper
# ---------------------------------------------------------


def get_duckdb_connection():
    """Returns a DuckDB connection to local file (or MotherDuck only if DB_MODE=motherduck)."""
    mode = os.getenv("DB_MODE", "local").lower()

    if mode != "motherduck":
        if DUCKDB_PATH.exists():
            try:
                conn = duckdb.connect(str(DUCKDB_PATH), read_only=True)
                return conn, "duckdb_local"
            except Exception as e:
                print(f"[DuckDB] Local DuckDB connection failed: {e}")

    token = os.getenv("MOTHERDUCK_TOKEN", MOTHERDUCK_TOKEN)
    database = os.getenv("MOTHERDUCK_DATABASE", MOTHERDUCK_DATABASE)

    if token and mode == "motherduck":
        try:
            config: dict[str, str | float | list[str]] = {
                "motherduck_token": token,
                "extension_directory": "/tmp/.duckdb/extensions",
            }
            conn = duckdb.connect(f"md:{database}", config=config)
            return conn, "motherduck_cloud"
        except Exception as e:
            print(f"[DuckDB] MotherDuck connection failed: {e}")

    if DUCKDB_PATH.exists():
        try:
            conn = duckdb.connect(str(DUCKDB_PATH), read_only=True)
            return conn, "duckdb_local"
        except Exception as e:
            print(f"[DuckDB] Local DuckDB connection failed: {e}")

    return None, "none"


# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------


@app.get("/api")
def get_root():
    return {
        "status": "healthy",
        "service": "OpenElectricity API",
        "version": "1.0.0",
        "docs": "/api/docs",
    }


@app.get("/api/health")
def get_health(response: Response):
    """Health check endpoint and active database connection inspector."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    conn, source = get_duckdb_connection()
    tables_count = {}

    if conn:
        try:
            for tbl in [
                "facilities",
                "energy_interval",
                "energy_daily",
                "exchange_rates",
            ]:
                try:
                    c = conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
                    tables_count[tbl] = c
                except Exception:
                    tables_count[tbl] = 0
        except Exception as e:
            tables_count["error"] = str(e)
        finally:
            try:
                conn.close()
            except Exception:
                pass

    return {
        "status": "healthy",
        "active_source": source,
        "motherduck_configured": bool(os.getenv("MOTHERDUCK_TOKEN", MOTHERDUCK_TOKEN)),
        "database": os.getenv("MOTHERDUCK_DATABASE", MOTHERDUCK_DATABASE),
        "tables": tables_count,
        "time": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------
# Energy Endpoint Helpers
# ---------------------------------------------------------


@dataclass
class EnergyQueryParams:
    country: str
    region: str
    start_date: date
    end_date: date
    active_interval: str
    range_val: str
    unit: str
    country_meta: Dict[str, Any]
    tz: ZoneInfo
    tz_offset: str
    start_utc: datetime
    end_utc: datetime
    use_daily: bool


@dataclass
class AggregatedEnergyData:
    time_buckets: Dict[str, Dict[str, Any]]
    fuel_totals_mwh: Dict[str, float]
    grand_price_sum: float
    grand_price_cnt: int
    grand_usd_sum: float
    grand_usd_cnt: int


def resolve_energy_query_params(
    country: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    interval: Optional[str] = None,
    region: Optional[str] = "ALL",
    range_val: Optional[str] = None,
) -> EnergyQueryParams:
    norm_country = (country if isinstance(country, str) and country else "PH").upper()
    if norm_country not in COUNTRIES_METADATA:
        raise HTTPException(
            status_code=404,
            detail=f"Unsupported country code '{norm_country}'",
        )
    c_meta = COUNTRIES_METADATA[norm_country]
    tz_name = c_meta.get("timezone", "Asia/Manila")
    tz = ZoneInfo(tz_name)
    tz_offset = c_meta.get("tzOffset", "+08:00")
    norm_region = region if isinstance(region, str) and region.strip() else "ALL"
    s_end_date = end_date if isinstance(end_date, str) and end_date.strip() else None
    s_start_date = (
        start_date if isinstance(start_date, str) and start_date.strip() else None
    )
    s_interval = interval if isinstance(interval, str) and interval.strip() else None
    s_range = range_val if isinstance(range_val, str) and range_val.strip() else None

    # The API server does not guess dates; the frontend client explicitly specifies start_date and end_date.
    if not s_start_date:
        raise HTTPException(
            status_code=400,
            detail="start_date query parameter is required (format: YYYY-MM-DD).",
        )
    if not s_end_date:
        raise HTTPException(
            status_code=400,
            detail="end_date query parameter is required (format: YYYY-MM-DD).",
        )

    try:
        parsed_start = datetime.strptime(s_start_date, "%Y-%m-%d").date()
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid start_date format '{start_date}'. Must be YYYY-MM-DD.",
        ) from e

    try:
        parsed_end = datetime.strptime(s_end_date, "%Y-%m-%d").date()
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid end_date format '{end_date}'. Must be YYYY-MM-DD.",
        ) from e

    if parsed_start > parsed_end:
        raise HTTPException(
            status_code=400,
            detail=f"start_date ({parsed_start}) must be on or before end_date ({parsed_end}).",
        )

    span_days = (parsed_end - parsed_start).days + 1

    # Determine range_val label
    computed_range = (
        s_range.lower() if s_range and s_range.lower() in RANGE_CONFIG else None
    )
    if not computed_range:
        if span_days == 1:
            computed_range = "1d"
        elif span_days <= 3:
            computed_range = "3d"
        elif span_days <= 7:
            computed_range = "7d"
        elif span_days <= 180:
            computed_range = "30d"
        else:
            computed_range = "1y"

    is_yearly = computed_range == "1y" or s_range == "1y" or span_days >= 360

    # Determine default interval if not explicitly provided
    if s_interval:
        raw_inv = s_interval.strip()
        if raw_inv.lower() in ("1m", "1month", "month"):
            active_interval = "1m"
        elif raw_inv.lower() in ("1w", "7d", "week"):
            active_interval = "1w"
        else:
            active_interval = raw_inv
    else:
        if span_days == 1:
            active_interval = c_meta.get("minInterval", "5m")
        elif span_days <= 3:
            active_interval = "30m"
        elif span_days <= 7:
            active_interval = "30m"
        elif not is_yearly:
            active_interval = "1d"
        else:
            active_interval = "1w"

    # Enforce strict interval restrictions
    if active_interval not in ("5m", "30m", "1h", "1d", "1w", "1m", "1M", "7d"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported interval '{active_interval}'. Supported: 5m, 30m, 1h, 1d, 1w, 1m.",
        )
    if is_yearly and active_interval in ("5m", "30m", "1h", "1d"):
        raise HTTPException(
            status_code=400,
            detail=f"For yearly queries (requested {span_days} days), minimum allowed interval is '1w'. Got '{active_interval}'.",
        )
    if span_days > 7 and active_interval in ("5m", "30m", "1h"):
        raise HTTPException(
            status_code=400,
            detail=f"For date ranges greater than 7 days (requested {span_days} days), minimum allowed interval is '1d'. Got '{active_interval}'.",
        )
    if span_days > 3 and active_interval == "5m":
        raise HTTPException(
            status_code=400,
            detail=f"For date ranges greater than 3 days (requested {span_days} days), minimum allowed interval is '30m'. Got '5m'.",
        )
    if c_meta.get("minInterval") == "30m" and active_interval == "5m":
        active_interval = "30m"

    use_daily = active_interval in ("1d", "7d", "1w", "1m", "1M") or span_days >= 30
    unit = "GWh" if span_days >= 30 or use_daily else "MW"

    # Calculate UTC datetime boundaries
    start_local = datetime.combine(parsed_start, time(0, 0, 0), tzinfo=tz)
    end_local = datetime.combine(parsed_end, time(23, 59, 59, 999999), tzinfo=tz)
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)

    return EnergyQueryParams(
        country=norm_country,
        region=norm_region,
        start_date=parsed_start,
        end_date=parsed_end,
        active_interval=active_interval,
        range_val=computed_range,
        unit=unit,
        country_meta=c_meta,
        tz=tz,
        tz_offset=tz_offset,
        start_utc=start_utc,
        end_utc=end_utc,
        use_daily=use_daily,
    )


def build_energy_query(params: EnergyQueryParams) -> tuple[str, List[Any]]:
    reg_clause = ""
    reg_params: List[Any] = []
    if params.region != "ALL" and params.region != params.country_meta["defaultRegion"]:
        reg_clause = " AND region = ?"
        reg_params.append(params.region)
    elif params.region == "ALL" and params.country == "PH":
        reg_clause = " AND region = 'ALL'"

    if params.use_daily:
        if params.active_interval in ("7d", "1w"):
            time_expr = "time_bucket(INTERVAL '1 week', date)::VARCHAR"
            group_time = "time_bucket(INTERVAL '1 week', date)"
        elif params.active_interval in ("1M", "1m"):
            time_expr = "strftime(date, '%Y-%m')"
            group_time = "strftime(date, '%Y-%m')"
        else:
            time_expr = "date::VARCHAR"
            group_time = "date"

        dispatch_sql = f"""
            SELECT
                {time_expr} AS b_time,
                fuel_tech,
                round(avg(avg_generation_mw), 1) AS mw,
                round(sum(energy_mwh), 2) AS mwh,
                round(avg(vwap_price_local), 2) AS price,
                round(avg(vwap_price_dollar), 2) AS price_dollar
            FROM energy_daily
            WHERE country_code = ? {reg_clause}
              AND date >= ?
              AND date <= ?
            GROUP BY {group_time}, fuel_tech
            ORDER BY {group_time} ASC
        """
        query_params = (
            [params.country] + reg_params + [params.start_date, params.end_date]
        )
    else:
        if params.active_interval == "5m":
            time_expr = "interval_start"
            group_time = "interval_start"
        elif params.active_interval == "30m":
            time_expr = "time_bucket(INTERVAL '30 minutes', interval_start)"
            group_time = "time_bucket(INTERVAL '30 minutes', interval_start)"
        elif params.active_interval == "1h":
            time_expr = "time_bucket(INTERVAL '1 hour', interval_start)"
            group_time = "time_bucket(INTERVAL '1 hour', interval_start)"
        else:
            time_expr = "time_bucket(INTERVAL '1 day', interval_start)"
            group_time = "time_bucket(INTERVAL '1 day', interval_start)"

        dispatch_sql = f"""
            SELECT
                {time_expr} AS b_time,
                fuel_tech,
                round(avg(generation_mw), 1) AS mw,
                round(sum(energy_mwh), 2) AS mwh,
                round(avg(price_local), 2) AS price,
                round(avg(price_dollar), 2) AS price_dollar
            FROM energy_interval
            WHERE country_code = ? {reg_clause}
              AND interval_start >= ?
              AND interval_start <= ?
            GROUP BY {group_time}, fuel_tech
            ORDER BY {group_time} ASC
        """
        query_params = (
            [params.country] + reg_params + [params.start_utc, params.end_utc]
        )

    return dispatch_sql, query_params


def fetch_energy_data(
    conn: duckdb.DuckDBPyConnection,
    sql: str,
    params: List[Any],
    country: str,
    start_date: date,
    end_date: date,
) -> List[tuple[Any, ...]]:
    dispatch_rows = conn.execute(sql, params).fetchall()
    if not dispatch_rows:
        raise HTTPException(
            status_code=404,
            detail=f"No energy data available for country '{country}' between {start_date} and {end_date}",
        )
    return dispatch_rows


def aggregate_energy_data(
    rows: List[tuple[Any, ...]],
    is_energy_unit: bool,
    params: EnergyQueryParams,
) -> AggregatedEnergyData:
    time_buckets: Dict[str, Dict[str, Any]] = {}
    fuel_totals_overall_mwh = {f: 0.0 for f in FUEL_META.keys()}
    grand_price_sum = 0.0
    grand_price_cnt = 0
    grand_usd_sum = 0.0
    grand_usd_cnt = 0

    for b_time, fuel_raw, mw_val, mwh_val, p_val, p_usd in rows:
        if isinstance(b_time, datetime):
            local_dt = b_time.astimezone(params.tz)
            b_str = local_dt.strftime(f"%Y-%m-%dT%H:%M:00{params.tz_offset}")
        else:
            b_str = str(b_time)

        if b_str not in time_buckets:
            time_buckets[b_str] = {
                "fuels_val": {f: 0.0 for f in FUEL_META.keys()},
                "price": p_val,
                "price_dollar": p_usd,
            }
        fuel = str(fuel_raw or "").lower()
        val = (mwh_val / 1000.0) if is_energy_unit else mw_val
        if fuel in time_buckets[b_str]["fuels_val"]:
            time_buckets[b_str]["fuels_val"][fuel] = round(
                val, 2 if is_energy_unit else 1
            )

        if fuel in fuel_totals_overall_mwh:
            fuel_totals_overall_mwh[fuel] += mwh_val

        if p_val is not None:
            grand_price_sum += float(p_val)
            grand_price_cnt += 1
        if p_usd is not None:
            grand_usd_sum += float(p_usd)
            grand_usd_cnt += 1

    return AggregatedEnergyData(
        time_buckets=time_buckets,
        fuel_totals_mwh=fuel_totals_overall_mwh,
        grand_price_sum=grand_price_sum,
        grand_price_cnt=grand_price_cnt,
        grand_usd_sum=grand_usd_sum,
        grand_usd_cnt=grand_usd_cnt,
    )


def build_fuel_generation_points(
    time_buckets: Dict[str, Dict[str, Any]],
    is_energy_unit: bool,
    params: EnergyQueryParams,
) -> tuple[List[FuelGenerationPoint], float]:
    points: List[FuelGenerationPoint] = []
    peak_gen = 0.0

    expected_slots: List[str] = []
    if params.active_interval in ("5m", "30m", "1h"):
        mins = (
            5
            if params.active_interval == "5m"
            else 30
            if params.active_interval == "30m"
            else 60
        )
        step = timedelta(minutes=mins)
        curr = datetime.combine(params.start_date, time(0, 0, 0), tzinfo=params.tz)
        end_curr = datetime.combine(params.end_date, time(23, 59, 59), tzinfo=params.tz)
        while curr <= end_curr:
            expected_slots.append(curr.strftime(f"%Y-%m-%dT%H:%M:00{params.tz_offset}"))
            curr += step
    elif params.active_interval == "1d":
        curr_d = params.start_date
        while curr_d <= params.end_date:
            expected_slots.append(curr_d.strftime("%Y-%m-%d"))
            curr_d += timedelta(days=1)
    elif params.active_interval in ("7d", "1w"):
        curr_d = params.start_date - timedelta(days=params.start_date.weekday())
        while curr_d <= params.end_date:
            expected_slots.append(curr_d.strftime("%Y-%m-%d"))
            curr_d += timedelta(days=7)
    elif params.active_interval in ("1M", "1m"):
        curr_d = params.start_date.replace(day=1)
        end_m = params.end_date.replace(day=1)
        while curr_d <= end_m:
            expected_slots.append(curr_d.strftime("%Y-%m"))
            if curr_d.month == 12:
                curr_d = curr_d.replace(year=curr_d.year + 1, month=1)
            else:
                curr_d = curr_d.replace(month=curr_d.month + 1)
    else:
        expected_slots = sorted(time_buckets.keys())

    for slot in expected_slots:
        if slot in time_buckets:
            b = time_buckets[slot]
            b_tot_gen = sum(b["fuels_val"].values())
            b_ren_gen = sum(
                b["fuels_val"][f] for f in b["fuels_val"] if FUEL_META[f]["isRenewable"]
            )
            ren_pct = (b_ren_gen / b_tot_gen * 100.0) if b_tot_gen > 0 else 0.0
            peak_gen = max(peak_gen, b_tot_gen)

            points.append(
                FuelGenerationPoint(
                    timestamp=slot,
                    solar=b["fuels_val"].get("solar", 0.0),
                    wind=b["fuels_val"].get("wind", 0.0),
                    hydro=b["fuels_val"].get("hydro", 0.0),
                    geothermal=b["fuels_val"].get("geothermal", 0.0),
                    biomass=b["fuels_val"].get("biomass", 0.0),
                    gas=b["fuels_val"].get("gas", 0.0),
                    coal=b["fuels_val"].get("coal", 0.0),
                    oil=b["fuels_val"].get("oil", 0.0),
                    battery=b["fuels_val"].get("battery", 0.0),
                    price=round(b["price"], 2) if b["price"] is not None else None,
                    priceDollar=round(b["price_dollar"], 2)
                    if b["price_dollar"] is not None
                    else None,
                    totalGeneration=round(b_tot_gen, 1 if not is_energy_unit else 2),
                    renewablesPct=round(ren_pct, 1),
                    hasData=True,
                )
            )
        else:
            points.append(
                FuelGenerationPoint(
                    timestamp=slot,
                    solar=None,
                    wind=None,
                    hydro=None,
                    geothermal=None,
                    biomass=None,
                    gas=None,
                    coal=None,
                    oil=None,
                    battery=None,
                    price=None,
                    priceDollar=None,
                    totalGeneration=None,
                    renewablesPct=None,
                    hasData=False,
                )
            )

    return points, peak_gen


def build_summary_metrics(
    agg_data: AggregatedEnergyData,
    peak_gen: float,
    country_meta: Dict[str, Any],
) -> SummaryMetrics:
    tot_mwh = sum(agg_data.fuel_totals_mwh.values())
    tot_ren_mwh = sum(
        agg_data.fuel_totals_mwh[f]
        for f in agg_data.fuel_totals_mwh
        if FUEL_META[f]["isRenewable"]
    )
    tot_emissions = sum(
        agg_data.fuel_totals_mwh[f] * FUEL_META[f]["emissionsFactor"]
        for f in agg_data.fuel_totals_mwh
    )

    return SummaryMetrics(
        renewablesPct=round((tot_ren_mwh / tot_mwh * 100.0), 1) if tot_mwh > 0 else 0.0,
        totalGenerationGWh=round(tot_mwh / 1000.0, 1),
        peakGenerationMW=round(peak_gen),
        avgPriceLocal=round(agg_data.grand_price_sum / agg_data.grand_price_cnt)
        if agg_data.grand_price_cnt > 0
        else 0,
        avgPriceUSD=round(agg_data.grand_usd_sum / agg_data.grand_usd_cnt, 2)
        if agg_data.grand_usd_cnt > 0
        else 0.0,
        currencySymbol=country_meta["currencySymbol"],
        currencyCode=country_meta["currencyCode"],
        emissionsIntensityGPerKWh=round(tot_emissions / tot_mwh * 1000.0)
        if tot_mwh > 0
        else 0,
        totalEmissionsTonnes=round(tot_emissions),
    )


def build_fuel_breakdown(
    fuel_totals_mwh: Dict[str, float],
    latest_point: Optional[FuelGenerationPoint],
) -> List[FuelBreakdownRow]:
    tot_mwh = sum(fuel_totals_mwh.values())
    breakdown: List[FuelBreakdownRow] = []

    for f, mwh in fuel_totals_mwh.items():
        meta = FUEL_META[f]
        pct = round((mwh / tot_mwh * 100.0), 1) if tot_mwh > 0 else 0.0
        cur_val = (
            getattr(latest_point, f, 0.0)
            if latest_point and getattr(latest_point, f, None) is not None
            else 0.0
        )
        breakdown.append(
            FuelBreakdownRow(
                fuelTech=f,
                label=meta["label"],
                color=meta["color"],
                generationMW=cur_val,
                energyGWh=round(mwh / 1000.0, 2),
                percentage=pct,
                isRenewable=meta["isRenewable"],
                emissionsTonnes=round(mwh * meta["emissionsFactor"]),
            )
        )

    breakdown.sort(key=lambda x: x.energyGWh, reverse=True)
    return breakdown


@app.get("/api/energy", response_model=EnergyResponse)
def get_energy(
    response: Response,
    country: str = Query(
        default="PH", description="Country code (PH, SG, MY, TH, VN, ID)"
    ),
    start_date: Optional[str] = Query(
        default=None, description="Start date (YYYY-MM-DD)"
    ),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    interval: Optional[str] = Query(
        default=None, description="Aggregation interval (5m, 30m, 1h, 1d, 1w, 1m)"
    ),
    region: str = Query(default="ALL", description="Region filter"),
    range: Optional[str] = Query(
        default=None, description="Preset range shorthand (1d, 3d, 7d, 30d, 1y)"
    ),
) -> EnergyResponse:
    response.headers["Cache-Control"] = (
        "public, s-maxage=60, stale-while-revalidate=300"
    )

    conn, source = get_duckdb_connection()
    if not conn:
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        )

    try:
        query_params = resolve_energy_query_params(
            country=country,
            start_date=start_date,
            end_date=end_date,
            interval=interval,
            region=region,
            range_val=range,
        )

        dispatch_sql, sql_params = build_energy_query(query_params)
        dispatch_rows = fetch_energy_data(
            conn,
            dispatch_sql,
            sql_params,
            query_params.country,
            query_params.start_date,
            query_params.end_date,
        )

        is_energy_unit = query_params.unit == "GWh"
        agg_data = aggregate_energy_data(
            dispatch_rows, is_energy_unit=is_energy_unit, params=query_params
        )
        points, peak_gen = build_fuel_generation_points(
            agg_data.time_buckets,
            is_energy_unit=is_energy_unit,
            params=query_params,
        )
        summary = build_summary_metrics(agg_data, peak_gen, query_params.country_meta)
        latest_point = next((p for p in reversed(points) if p.hasData), None)
        breakdown = build_fuel_breakdown(agg_data.fuel_totals_mwh, latest_point)

        return EnergyResponse(
            country=query_params.country,
            region=query_params.region,
            range=query_params.range_val,
            interval=query_params.active_interval,
            source=source,
            unit=query_params.unit,
            points=points,
            summary=summary,
            breakdown=breakdown,
        )
    finally:
        try:
            conn.close()
        except Exception:
            pass
