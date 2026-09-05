import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any

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
# Metadata & Configurations
# ---------------------------------------------------------

COUNTRIES_METADATA = {
    "PH": {
        "name": "Philippines",
        "currencyCode": "PHP",
        "currencySymbol": "₱",
        "defaultRegion": "ALL",
        "minInterval": "5m",
    },
    "SG": {
        "name": "Singapore",
        "currencyCode": "SGD",
        "currencySymbol": "S$",
        "defaultRegion": "SINGAPORE",
        "minInterval": "30m",
    },
    "MY": {
        "name": "Malaysia",
        "currencyCode": "MYR",
        "currencySymbol": "RM",
        "defaultRegion": "PENINSULAR",
        "minInterval": "30m",
    },
    "TH": {
        "name": "Thailand",
        "currencyCode": "THB",
        "currencySymbol": "฿",
        "defaultRegion": "THAILAND",
        "minInterval": "30m",
    },
    "VN": {
        "name": "Vietnam",
        "currencyCode": "VND",
        "currencySymbol": "₫",
        "defaultRegion": "VIETNAM",
        "minInterval": "30m",
    },
}

FUEL_META = {
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

RANGE_CONFIG = {
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
    demand: Optional[float] = None
    price: Optional[float] = None
    priceDollar: Optional[float] = None
    totalGeneration: Optional[float] = None
    renewablesPct: Optional[float] = None


class SummaryMetrics(BaseModel):
    renewablesPct: float
    totalGenerationGWh: float
    peakDemandMW: float
    minDemandMW: float
    avgPricePHPMWh: float
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


class InterconnectorFlow(BaseModel):
    name: str
    fromRegion: str
    toRegion: str
    flowMW: float
    capacityMW: float


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
    interconnectors: List[InterconnectorFlow]


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
            config = {
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


@app.get("/api/energy", response_model=EnergyResponse)
def get_energy(
    response: Response,
    country: str = Query(default="PH"),
    region: str = Query(default="ALL"),
    range: str = Query(default="7d"),
    interval: Optional[str] = Query(default=None),
):
    response.headers["Cache-Control"] = (
        "public, s-maxage=60, stale-while-revalidate=300"
    )

    country = (country if isinstance(country, str) else "PH").upper()
    region = region if isinstance(region, str) else "ALL"
    range_val = (range if isinstance(range, str) else "7d").lower()
    c_meta = COUNTRIES_METADATA.get(country, COUNTRIES_METADATA["PH"])
    cfg = RANGE_CONFIG.get(range_val, RANGE_CONFIG["7d"])
    active_interval = (
        interval.lower()
        if isinstance(interval, str) and interval
        else cfg["defaultInterval"]
    )
    if c_meta.get("minInterval") == "30m" and active_interval == "5m":
        active_interval = "30m"
    unit = cfg["unit"]

    conn, source = get_duckdb_connection()
    if not conn:
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        )

    try:
        use_daily = cfg["days"] >= 30 or active_interval in ("1d", "1w", "1M")

        reg_clause = ""
        reg_params: List[Any] = []
        if region != "ALL" and region != c_meta["defaultRegion"]:
            reg_clause = " AND region = ?"
            reg_params.append(region)
        elif region == "ALL" and country == "PH":
            reg_clause = " AND region = 'ALL'"

        if use_daily:
            is_weekly = active_interval in ("1w", "1M") or cfg["days"] > 30
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
                      SELECT MAX(date) - INTERVAL '{cfg["days"]} days'
                      FROM energy_daily
                      WHERE country_code = ? {reg_clause}
                  )
                GROUP BY {group_time}, fuel_tech
                ORDER BY {group_time} ASC
            """
        else:
            if active_interval == "5m":
                time_expr = "strftime(interval_start, '%Y-%m-%dT%H:%M:00+08:00')"
                group_time = "interval_start"
            elif active_interval in ("30m", "1h"):
                dur = "30 minutes" if active_interval == "30m" else "1 hour"
                time_expr = f"strftime(time_bucket(INTERVAL '{dur}', interval_start), '%Y-%m-%dT%H:%M:00+08:00')"
                group_time = f"time_bucket(INTERVAL '{dur}', interval_start)"
            else:
                time_expr = "strftime(time_bucket(INTERVAL '1 day', interval_start), '%Y-%m-%d')"
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
                      SELECT MAX(interval_start) - INTERVAL '{cfg["days"]} days'
                      FROM energy_interval
                      WHERE country_code = ? {reg_clause}
                  )
                GROUP BY {group_time}, fuel_tech
                ORDER BY {group_time} ASC
            """

        params = [country] + reg_params + [country] + reg_params
        dispatch_rows = conn.execute(dispatch_sql, params).fetchall()

        if not dispatch_rows:
            raise HTTPException(
                status_code=404,
                detail=f"No energy data available for country '{country}' in range '{range_val}'",
            )

        time_buckets: Dict[str, Dict[str, Any]] = {}
        fuel_totals_overall_mwh = {f: 0.0 for f in FUEL_META.keys()}
        grand_price_sum = 0.0
        grand_price_cnt = 0
        grand_usd_sum = 0.0
        grand_usd_cnt = 0
        is_energy_unit = unit == "GWh"

        for b_time, fuel_raw, mw_val, mwh_val, p_val, p_usd in dispatch_rows:
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

        points: List[FuelGenerationPoint] = []
        peak_demand = 0.0
        min_demand = float("inf")

        for b_time, b in time_buckets.items():
            b_tot_gen = sum(b["fuels_val"].values())
            b_ren_gen = sum(
                b["fuels_val"][f]
                for f in b["fuels_val"]
                if FUEL_META[f]["isRenewable"]
            )
            ren_pct = (b_ren_gen / b_tot_gen * 100.0) if b_tot_gen > 0 else 0.0

            peak_demand = max(peak_demand, b_tot_gen)
            min_demand = min(min_demand, b_tot_gen)

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
                    demand=None,
                    price=round(b["price"], 2) if b["price"] is not None else None,
                    priceDollar=round(b["price_dollar"], 2)
                    if b["price_dollar"] is not None
                    else None,
                    totalGeneration=round(b_tot_gen, 1 if not is_energy_unit else 2),
                    renewablesPct=round(ren_pct, 1),
                )
            )

        tot_mwh = sum(fuel_totals_overall_mwh.values())
        tot_ren_mwh = sum(
            fuel_totals_overall_mwh[f]
            for f in fuel_totals_overall_mwh
            if FUEL_META[f]["isRenewable"]
        )
        tot_emissions = sum(
            fuel_totals_overall_mwh[f] * FUEL_META[f]["emissionsFactor"]
            for f in fuel_totals_overall_mwh
        )

        summary = SummaryMetrics(
            renewablesPct=round((tot_ren_mwh / tot_mwh * 100.0), 1)
            if tot_mwh > 0
            else 0.0,
            totalGenerationGWh=round(tot_mwh / 1000.0, 1),
            peakDemandMW=round(peak_demand),
            minDemandMW=round(min_demand) if min_demand != float("inf") else 0,
            avgPricePHPMWh=round(grand_price_sum / grand_price_cnt)
            if grand_price_cnt > 0
            else 0,
            avgPriceUSD=round(grand_usd_sum / grand_usd_cnt, 2)
            if grand_usd_cnt > 0
            else 0.0,
            currencySymbol=c_meta["currencySymbol"],
            currencyCode=c_meta["currencyCode"],
            emissionsIntensityGPerKWh=round(tot_emissions / tot_mwh * 1000.0)
            if tot_mwh > 0
            else 0,
            totalEmissionsTonnes=round(tot_emissions),
        )

        latest_pt = points[-1] if points else None
        breakdown = []
        for f, mwh in fuel_totals_overall_mwh.items():
            meta = FUEL_META[f]
            pct = round((mwh / tot_mwh * 100.0), 1) if tot_mwh > 0 else 0.0
            cur_val = getattr(latest_pt, f, 0.0) if latest_pt else 0.0
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

        interconnectors = []
        if country == "PH":
            interconnectors = [
                InterconnectorFlow(
                    name="Luzon - Visayas HVDC",
                    fromRegion="LUZON",
                    toRegion="VISAYAS",
                    flowMW=180,
                    capacityMW=440,
                ),
                InterconnectorFlow(
                    name="Mindanao - Visayas (MVIP)",
                    fromRegion="MINDANAO",
                    toRegion="VISAYAS",
                    flowMW=220,
                    capacityMW=450,
                ),
            ]

        return EnergyResponse(
            country=country,
            region=region,
            range=range_val,
            interval=active_interval,
            source=source,
            unit=unit,
            points=points,
            summary=summary,
            breakdown=breakdown,
            interconnectors=interconnectors,
        )
    finally:
        try:
            conn.close()
        except Exception:
            pass
