import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, TypedDict

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
    solar: float = 0.0
    wind: float = 0.0
    hydro: float = 0.0
    geothermal: float = 0.0
    biomass: float = 0.0
    gas: float = 0.0
    coal: float = 0.0
    oil: float = 0.0
    battery: float = 0.0
    price: Optional[float] = None
    priceDollar: Optional[float] = None
    totalGeneration: Optional[float] = None
    renewablesPct: Optional[float] = None


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
    range_val: str
    active_interval: str
    unit: str
    country_meta: Dict[str, Any]
    range_cfg: RangeConfigInfo


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
    region: str,
    range_val: str,
    interval: Optional[str],
) -> EnergyQueryParams:
    norm_country = (country if isinstance(country, str) else "PH").upper()
    norm_region = region if isinstance(region, str) else "ALL"
    norm_range = (range_val if isinstance(range_val, str) else "7d").lower()
    c_meta = COUNTRIES_METADATA.get(norm_country, COUNTRIES_METADATA["PH"])
    cfg = RANGE_CONFIG.get(norm_range, RANGE_CONFIG["7d"])
    active_interval = (
        interval.lower()
        if isinstance(interval, str) and interval
        else cfg["defaultInterval"]
    )
    if c_meta.get("minInterval") == "30m" and active_interval == "5m":
        active_interval = "30m"
    unit = cfg["unit"]

    return EnergyQueryParams(
        country=norm_country,
        region=norm_region,
        range_val=norm_range,
        active_interval=active_interval,
        unit=unit,
        country_meta=c_meta,
        range_cfg=cfg,
    )


def build_energy_query(params: EnergyQueryParams) -> tuple[str, List[Any]]:
    use_daily = params.range_cfg["days"] >= 30 or params.active_interval in (
        "1d",
        "1w",
        "1M",
    )

    reg_clause = ""
    reg_params: List[Any] = []
    if params.region != "ALL" and params.region != params.country_meta["defaultRegion"]:
        reg_clause = " AND region = ?"
        reg_params.append(params.region)
    elif params.region == "ALL" and params.country == "PH":
        reg_clause = " AND region = 'ALL'"

    days = params.range_cfg["days"]

    if use_daily:
        is_weekly = params.active_interval in ("1w", "1M") or days > 30
        if is_weekly:
            time_expr = "strftime(time_bucket(INTERVAL '1 week', date), '%Y-%m-%d')"
            group_time = "time_bucket(INTERVAL '1 week', date)"
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
              AND date >= (
                  SELECT MAX(date) - INTERVAL '{days} days'
                  FROM energy_daily
                  WHERE country_code = ? {reg_clause}
              )
            GROUP BY {group_time}, fuel_tech
            ORDER BY {group_time} ASC
        """
    else:
        tz_offset = params.country_meta.get("tzOffset", "+08:00")
        if params.active_interval == "5m":
            time_expr = f"strftime(interval_start, '%Y-%m-%dT%H:%M:00{tz_offset}')"
            group_time = "interval_start"
        elif params.active_interval in ("30m", "1h"):
            dur = "30 minutes" if params.active_interval == "30m" else "1 hour"
            time_expr = f"strftime(time_bucket(INTERVAL '{dur}', interval_start), '%Y-%m-%dT%H:%M:00{tz_offset}')"
            group_time = f"time_bucket(INTERVAL '{dur}', interval_start)"
        else:
            time_expr = (
                "strftime(time_bucket(INTERVAL '1 day', interval_start), '%Y-%m-%d')"
            )
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
              AND interval_start >= (
                  SELECT MAX(interval_start) - INTERVAL '{days} days'
                  FROM energy_interval
                  WHERE country_code = ? {reg_clause}
              )
            GROUP BY {group_time}, fuel_tech
            ORDER BY {group_time} ASC
        """

    query_params = [params.country] + reg_params + [params.country] + reg_params
    return dispatch_sql, query_params


def fetch_energy_data(
    conn: duckdb.DuckDBPyConnection,
    sql: str,
    params: List[Any],
    country: str,
    range_val: str,
) -> List[tuple[Any, ...]]:
    dispatch_rows = conn.execute(sql, params).fetchall()
    if not dispatch_rows:
        raise HTTPException(
            status_code=404,
            detail=f"No energy data available for country '{country}' in range '{range_val}'",
        )
    return dispatch_rows


def aggregate_energy_data(
    rows: List[tuple[Any, ...]], is_energy_unit: bool
) -> AggregatedEnergyData:
    time_buckets: Dict[str, Dict[str, Any]] = {}
    fuel_totals_overall_mwh = {f: 0.0 for f in FUEL_META.keys()}
    grand_price_sum = 0.0
    grand_price_cnt = 0
    grand_usd_sum = 0.0
    grand_usd_cnt = 0

    for b_time, fuel_raw, mw_val, mwh_val, p_val, p_usd in rows:
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
    time_buckets: Dict[str, Dict[str, Any]], is_energy_unit: bool
) -> tuple[List[FuelGenerationPoint], float]:
    points: List[FuelGenerationPoint] = []
    peak_gen = 0.0

    for b_time, b in time_buckets.items():
        b_tot_gen = sum(b["fuels_val"].values())
        b_ren_gen = sum(
            b["fuels_val"][f] for f in b["fuels_val"] if FUEL_META[f]["isRenewable"]
        )
        ren_pct = (b_ren_gen / b_tot_gen * 100.0) if b_tot_gen > 0 else 0.0

        peak_gen = max(peak_gen, b_tot_gen)

        points.append(
            FuelGenerationPoint(
                timestamp=b_time,
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
        cur_val = getattr(latest_point, f, 0.0) if latest_point else 0.0
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
    country: str = Query(default="PH"),
    region: str = Query(default="ALL"),
    range: str = Query(default="7d"),
    interval: Optional[str] = Query(default=None),
) -> EnergyResponse:
    response.headers["Cache-Control"] = (
        "public, s-maxage=60, stale-while-revalidate=300"
    )

    query_params = resolve_energy_query_params(country, region, range, interval)

    conn, source = get_duckdb_connection()
    if not conn:
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        )

    try:
        c_tz = query_params.country_meta.get("timezone", "Asia/Manila")
        conn.execute(f"SET TimeZone = '{c_tz}'")
        dispatch_sql, sql_params = build_energy_query(query_params)
        dispatch_rows = fetch_energy_data(
            conn,
            dispatch_sql,
            sql_params,
            query_params.country,
            query_params.range_val,
        )

        is_energy_unit = query_params.unit == "GWh"
        agg_data = aggregate_energy_data(dispatch_rows, is_energy_unit=is_energy_unit)
        points, peak_gen = build_fuel_generation_points(
            agg_data.time_buckets, is_energy_unit=is_energy_unit
        )
        summary = build_summary_metrics(agg_data, peak_gen, query_params.country_meta)
        breakdown = build_fuel_breakdown(
            agg_data.fuel_totals_mwh, points[-1] if points else None
        )

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
