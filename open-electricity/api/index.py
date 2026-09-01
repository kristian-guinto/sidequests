import os
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any

import duckdb
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dotenv import load_dotenv

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables
load_dotenv(BASE_DIR / ".env")

MOTHERDUCK_TOKEN = os.getenv("MOTHERDUCK_TOKEN", "")
MOTHERDUCK_DATABASE = os.getenv("MOTHERDUCK_DATABASE", "open_electricity_db")
DUCKDB_PATH = BASE_DIR / "open_nem_ph.duckdb"
GENERATORS_JSON = BASE_DIR / "pipeline" / "data" / "generators_master.json"

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
    },
    "SG": {
        "name": "Singapore",
        "currencyCode": "SGD",
        "currencySymbol": "S$",
        "defaultRegion": "SINGAPORE",
    },
    "MY": {
        "name": "Malaysia",
        "currencyCode": "MYR",
        "currencySymbol": "RM",
        "defaultRegion": "PENINSULAR",
    },
    "TH": {
        "name": "Thailand",
        "currencyCode": "THB",
        "currencySymbol": "฿",
        "defaultRegion": "THAILAND",
    },
    "VN": {
        "name": "Vietnam",
        "currencyCode": "VND",
        "currencySymbol": "₫",
        "defaultRegion": "VIETNAM",
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
    totalGeneration: Optional[float] = None
    renewablesPct: Optional[float] = None


class SummaryMetrics(BaseModel):
    renewablesPct: float
    totalGenerationGWh: float
    peakDemandMW: float
    minDemandMW: float
    avgPricePHPMWh: float
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


class FacilitiesResponse(BaseModel):
    country: str
    facilities: List[Dict[str, Any]]
    count: int
    source: str


# ---------------------------------------------------------
# Database Helper
# ---------------------------------------------------------


def get_duckdb_connection():
    """Returns a DuckDB connection to MotherDuck (if token set) or local file."""
    token = os.getenv("MOTHERDUCK_TOKEN", MOTHERDUCK_TOKEN)
    database = os.getenv("MOTHERDUCK_DATABASE", MOTHERDUCK_DATABASE)

    if token:
        try:
            conn = duckdb.connect(f"md:{database}", config={"motherduck_token": token})
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


def format_bucket_timestamp(ts_str: str, interval: str) -> str:
    """Formats timestamp into the target interval bucket."""
    try:
        clean_ts = ts_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_ts)
    except Exception:
        return ts_str

    if interval == "5m":
        b_min = (dt.minute // 5) * 5
        dt = dt.replace(minute=b_min, second=0, microsecond=0)
        return dt.strftime("%Y-%m-%dT%H:%M:00+08:00")
    elif interval == "30m":
        b_min = 0 if dt.minute < 30 else 30
        dt = dt.replace(minute=b_min, second=0, microsecond=0)
        return dt.strftime("%Y-%m-%dT%H:%M:00+08:00")
    elif interval == "1h":
        dt = dt.replace(minute=0, second=0, microsecond=0)
        return dt.strftime("%Y-%m-%dT%H:00:00+08:00")
    elif interval == "1d":
        return dt.strftime("%Y-%m-%d")
    elif interval == "1w":
        monday = dt - timedelta(days=dt.weekday())
        return f"Week of {monday.strftime('%Y-%m-%d')}"
    elif interval == "1M":
        return dt.strftime("%Y-%m")

    return ts_str


# ---------------------------------------------------------
# Mock Simulation Generator (Fallback)
# ---------------------------------------------------------


def generate_simulation_data(
    country: str = "PH",
    region: str = "ALL",
    range_val: str = "7d",
    interval: Optional[str] = None,
) -> Dict[str, Any]:
    cfg = RANGE_CONFIG.get(range_val, RANGE_CONFIG["7d"])
    active_interval = interval or cfg["defaultInterval"]
    unit = cfg["unit"]
    c_info = COUNTRIES_METADATA.get(country, COUNTRIES_METADATA["PH"])

    if range_val == "1d":
        interval_min = 30 if active_interval == "30m" else 5
        pts_count = 48 if active_interval == "30m" else 288
    elif range_val == "3d":
        interval_min = 60 if active_interval == "1h" else 30
        pts_count = 72 if active_interval == "1h" else 144
    elif range_val == "7d":
        interval_min = (
            1440 if active_interval == "1d" else (60 if active_interval == "1h" else 30)
        )
        pts_count = (
            7 if active_interval == "1d" else (168 if active_interval == "1h" else 336)
        )
    elif range_val == "30d":
        interval_min = 10080 if active_interval == "1w" else 1440
        pts_count = 4 if active_interval == "1w" else 30
    else:
        interval_min = 43200 if active_interval == "1M" else 10080
        pts_count = 12 if active_interval == "1M" else 52

    now = datetime.now(timezone.utc)
    start_time = now - timedelta(minutes=pts_count * interval_min)

    base_demand = 13500
    base_coal = 7200
    base_gas = 2800
    base_geo = 900
    base_hydro = 1100
    base_wind = 280
    peak_solar = 1800
    base_oil = 450
    base_biomass = 150
    base_price = 4200

    if country == "SG":
        (
            base_demand,
            base_coal,
            base_gas,
            base_hydro,
            peak_solar,
            base_biomass,
            base_price,
        ) = 7200, 0, 6100, 90, 850, 110, 145
    elif country == "MY":
        (
            base_demand,
            base_coal,
            base_gas,
            base_hydro,
            peak_solar,
            base_biomass,
            base_price,
        ) = 18500, 7800, 6200, 2800, 1400, 320, 280
    elif country == "TH":
        (
            base_demand,
            base_coal,
            base_gas,
            base_hydro,
            peak_solar,
            base_biomass,
            base_price,
        ) = 32000, 5800, 17500, 3500, 3200, 1800, 3800
    elif country == "VN":
        (
            base_demand,
            base_coal,
            base_gas,
            base_hydro,
            peak_solar,
            base_biomass,
            base_price,
        ) = 44000, 17000, 6500, 13000, 6500, 600, 2100

    points = []
    tot_mwh = 0.0
    tot_ren_mwh = 0.0
    peak_demand = 0.0
    min_demand = float("inf")
    price_sum = 0.0
    emissions_tot = 0.0

    fuel_totals_mwh = {f: 0.0 for f in FUEL_META.keys()}
    is_daily_or_longer = interval_min >= 1440
    duration_hrs = interval_min / 60.0

    for i in range(pts_count):
        pt_time = start_time + timedelta(minutes=i * interval_min)
        hour = 12.0 if is_daily_or_longer else pt_time.hour + pt_time.minute / 60.0

        solar_mw = 0.0
        if is_daily_or_longer:
            solar_mw = peak_solar * 0.32 * (0.85 + 0.3 * math.sin(i / 5.0))
        elif 6 <= hour <= 18:
            s_factor = math.sin(((hour - 6) / 12) * math.pi)
            solar_mw = peak_solar * math.pow(s_factor, 1.8) * 0.95

        demand_shape = (
            0.85 + 0.12 * math.sin((i / 7.0) * 2 * math.pi)
            if is_daily_or_longer
            else 0.65
            + 0.22 * math.sin(((hour - 4) / 24) * 2 * math.pi)
            + 0.15 * math.exp(-math.pow((hour - 14) / 3, 2))
        )
        sys_demand = base_demand * demand_shape
        peak_demand = max(peak_demand, sys_demand)
        min_demand = min(min_demand, sys_demand)

        wind_mw = base_wind * (0.6 + 0.4 * math.sin(i / 20.0 + 1.2))
        geo_mw = base_geo * 0.98
        bio_mw = base_biomass * 0.95
        hydro_mw = base_hydro * (0.6 + 0.8 * demand_shape)
        coal_mw = base_coal * (0.85 + 0.25 * demand_shape)
        gas_mw = max(
            0.0,
            sys_demand - (solar_mw + wind_mw + geo_mw + bio_mw + hydro_mw + coal_mw),
        )
        oil_mw = base_oil * (
            0.5 if is_daily_or_longer else (1.5 if 18 <= hour <= 21 else 0.3)
        )
        battery_mw = 60.0 if (country == "SG" and 18 <= hour <= 21) else 0.0

        total_gen_mw = (
            solar_mw
            + wind_mw
            + hydro_mw
            + geo_mw
            + bio_mw
            + gas_mw
            + coal_mw
            + oil_mw
            + battery_mw
        )
        ren_gen_mw = solar_mw + wind_mw + hydro_mw + geo_mw + bio_mw
        ren_pct = (ren_gen_mw / total_gen_mw * 100.0) if total_gen_mw > 0 else 0.0

        price = max(
            base_price * 0.5, base_price + (demand_shape - 0.75) * base_price * 0.7
        )
        price_sum += price

        for f, val in [
            ("solar", solar_mw),
            ("wind", wind_mw),
            ("hydro", hydro_mw),
            ("geothermal", geo_mw),
            ("biomass", bio_mw),
            ("gas", gas_mw),
            ("coal", coal_mw),
            ("oil", oil_mw),
            ("battery", battery_mw),
        ]:
            fuel_totals_mwh[f] += val * duration_hrs

        tot_mwh += total_gen_mw * duration_hrs
        tot_ren_mwh += ren_gen_mw * duration_hrs
        emissions_tot += (coal_mw * 0.90 + gas_mw * 0.38 + oil_mw * 0.75) * duration_hrs

        mult = duration_hrs / 1000.0 if unit == "GWh" else 1.0

        points.append(
            FuelGenerationPoint(
                timestamp=pt_time.isoformat(),
                solar=round(solar_mw * mult, 1),
                wind=round(wind_mw * mult, 1),
                hydro=round(hydro_mw * mult, 1),
                geothermal=round(geo_mw * mult, 1),
                biomass=round(bio_mw * mult, 1),
                gas=round(gas_mw * mult, 1),
                coal=round(coal_mw * mult, 1),
                oil=round(oil_mw * mult, 1),
                battery=round(battery_mw * mult, 1),
                demand=round(sys_demand * mult, 1),
                price=round(price, 1),
                totalGeneration=round(total_gen_mw * mult, 1),
                renewablesPct=round(ren_pct, 1),
            )
        )

    overall_ren_pct = round((tot_ren_mwh / tot_mwh * 100.0), 1) if tot_mwh > 0 else 0.0
    em_intensity = round((emissions_tot / tot_mwh * 1000.0)) if tot_mwh > 0 else 0

    summary = SummaryMetrics(
        renewablesPct=overall_ren_pct,
        totalGenerationGWh=round(tot_mwh / 1000.0, 1),
        peakDemandMW=round(peak_demand),
        minDemandMW=round(min_demand),
        avgPricePHPMWh=round(price_sum / pts_count),
        currencySymbol=c_info["currencySymbol"],
        currencyCode=c_info["currencyCode"],
        emissionsIntensityGPerKWh=em_intensity,
        totalEmissionsTonnes=round(emissions_tot),
    )

    breakdown = []
    latest_pt = points[-1] if points else None
    for f, mwh in fuel_totals_mwh.items():
        meta = FUEL_META.get(
            f, {"label": f.capitalize(), "color": "#888888", "isRenewable": False}
        )
        pct = round((mwh / tot_mwh * 100.0), 1) if tot_mwh > 0 else 0.0
        cur_gen = getattr(latest_pt, f, 0.0) if latest_pt else 0.0
        em_factor = FUEL_META.get(f, {}).get("emissionsFactor", 0.0)
        breakdown.append(
            FuelBreakdownRow(
                fuelTech=f,
                label=meta["label"],
                color=meta["color"],
                generationMW=cur_gen,
                energyGWh=round(mwh / 1000.0, 2),
                percentage=pct,
                isRenewable=meta["isRenewable"],
                emissionsTonnes=round(mwh * em_factor),
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

    return {
        "points": points,
        "summary": summary,
        "breakdown": breakdown,
        "interconnectors": interconnectors,
        "unit": unit,
    }


# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------


@app.get("/api/health")
def get_health():
    """Health check endpoint and active database connection inspector."""
    conn, source = get_duckdb_connection()
    tables_count = {}

    if conn:
        try:
            for tbl in [
                "facilities",
                "energy_dispatch_5m",
                "regional_summary_5m",
                "energy_daily_stats",
            ]:
                try:
                    c = conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
                    tables_count[tbl] = c
                except Exception:
                    tables_count[tbl] = 0
            conn.close()
        except Exception as e:
            tables_count["error"] = str(e)

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
    country: str = Query(default="PH"),
    region: str = Query(default="ALL"),
    range: str = Query(default="7d"),
    interval: Optional[str] = Query(default=None),
):
    country = country.upper()
    range_val = range.lower()
    c_meta = COUNTRIES_METADATA.get(country, COUNTRIES_METADATA["PH"])
    cfg = RANGE_CONFIG.get(range_val, RANGE_CONFIG["7d"])
    active_interval = interval.lower() if interval else cfg["defaultInterval"]
    unit = cfg["unit"]

    # 1. Try DuckDB / MotherDuck
    conn, source = get_duckdb_connection()
    if conn:
        try:
            # Check maximum timestamp in table
            max_row = conn.execute(
                "SELECT MAX(timestamp) FROM energy_dispatch_5m WHERE country_code = ?",
                [country],
            ).fetchone()

            if max_row and max_row[0]:
                max_str = str(max_row[0])
                try:
                    max_dt = datetime.fromisoformat(max_str.replace("Z", "+00:00"))
                except Exception:
                    max_dt = datetime.now(timezone.utc)

                cutoff_dt = max_dt - timedelta(days=cfg["days"])
                cutoff_iso = cutoff_dt.isoformat()

                # Query 5m dispatch
                dispatch_sql = """
                    SELECT timestamp, region, fuel_tech, generation_mw, price_local, currency
                    FROM energy_dispatch_5m
                    WHERE country_code = ? AND timestamp >= ?
                """
                params = [country, cutoff_iso]

                if region != "ALL" and region != c_meta["defaultRegion"]:
                    dispatch_sql += " AND region = ?"
                    params.append(region)
                elif region == "ALL" and country == "PH":
                    dispatch_sql += " AND region = 'ALL'"

                dispatch_sql += " ORDER BY timestamp ASC"
                dispatch_rows = conn.execute(dispatch_sql, params).fetchall()

                if dispatch_rows:
                    # Query regional summary
                    reg_sql = """
                        SELECT timestamp, region, demand_mw, generation_mw, losses_mw, import_mw, export_mw, net_interconnector_mw, price_local, currency, renewables_pct
                        FROM regional_summary_5m
                        WHERE country_code = ? AND timestamp >= ?
                    """
                    reg_params = [country, cutoff_iso]
                    if region != "ALL" and region != c_meta["defaultRegion"]:
                        reg_sql += " AND region = ?"
                        reg_params.append(region)
                    elif region == "ALL" and country == "PH":
                        reg_sql += " AND region = 'ALL'"

                    reg_sql += " ORDER BY timestamp ASC"
                    reg_rows = conn.execute(reg_sql, reg_params).fetchall()
                    reg_map = {r[0]: r for r in reg_rows}

                    # Bucket downsampling
                    buckets: Dict[str, Dict[str, Any]] = {}
                    fuel_totals_overall_mwh = {f: 0.0 for f in FUEL_META.keys()}
                    grand_price_sum = 0.0
                    grand_price_cnt = 0

                    duration_hrs = (5.0 / 60.0) if country == "PH" else (30.0 / 60.0)

                    for row in dispatch_rows:
                        ts, reg_val, fuel_raw, mw_val, p_val, curr_val = row
                        fuel = str(fuel_raw or "").lower()
                        mw = float(mw_val or 0.0)
                        mwh = mw * duration_hrs

                        b_key = format_bucket_timestamp(ts, active_interval)
                        if b_key not in buckets:
                            buckets[b_key] = {
                                "fuelMWh": {f: 0.0 for f in FUEL_META.keys()},
                                "fuelMWSum": {f: 0.0 for f in FUEL_META.keys()},
                                "fuelCount": {f: 0 for f in FUEL_META.keys()},
                                "priceSum": 0.0,
                                "priceCount": 0,
                                "demandSum": 0.0,
                                "demandCount": 0,
                            }

                        b = buckets[b_key]
                        if fuel in b["fuelMWh"]:
                            b["fuelMWh"][fuel] += mwh
                            b["fuelMWSum"][fuel] += mw
                            b["fuelCount"][fuel] += 1

                        if fuel in fuel_totals_overall_mwh:
                            fuel_totals_overall_mwh[fuel] += mwh

                        if p_val is not None:
                            b["priceSum"] += float(p_val)
                            b["priceCount"] += 1
                            grand_price_sum += float(p_val)
                            grand_price_cnt += 1

                        if ts in reg_map:
                            reg_r = reg_map[ts]
                            if reg_r[2] is not None:
                                b["demandSum"] += float(reg_r[2])
                                b["demandCount"] += 1

                    points: List[FuelGenerationPoint] = []
                    peak_demand = 0.0
                    min_demand = float("inf")
                    is_energy_unit = unit == "GWh"

                    for key, b in buckets.items():
                        avg_price = (
                            round(b["priceSum"] / b["priceCount"])
                            if b["priceCount"] > 0
                            else None
                        )
                        avg_demand = (
                            (b["demandSum"] / b["demandCount"])
                            if b["demandCount"] > 0
                            else 0.0
                        )

                        pt_fuel = {}
                        b_tot_gen = 0.0
                        b_ren_gen = 0.0

                        for f in FUEL_META.keys():
                            if is_energy_unit:
                                gwh = b["fuelMWh"][f] / 1000.0
                                pt_fuel[f] = round(gwh, 2)
                                b_tot_gen += gwh
                                if FUEL_META[f]["isRenewable"]:
                                    b_ren_gen += gwh
                            else:
                                cnt = b["fuelCount"][f] or 1
                                avg_mw = b["fuelMWSum"][f] / cnt
                                pt_fuel[f] = round(avg_mw, 1)
                                b_tot_gen += avg_mw
                                if FUEL_META[f]["isRenewable"]:
                                    b_ren_gen += avg_mw

                        ren_pct = (
                            (b_ren_gen / b_tot_gen * 100.0) if b_tot_gen > 0 else 0.0
                        )
                        if avg_demand > 0:
                            peak_demand = max(peak_demand, avg_demand)
                            min_demand = min(min_demand, avg_demand)

                        points.append(
                            FuelGenerationPoint(
                                timestamp=key,
                                solar=pt_fuel.get("solar", 0.0),
                                wind=pt_fuel.get("wind", 0.0),
                                hydro=pt_fuel.get("hydro", 0.0),
                                geothermal=pt_fuel.get("geothermal", 0.0),
                                biomass=pt_fuel.get("biomass", 0.0),
                                gas=pt_fuel.get("gas", 0.0),
                                coal=pt_fuel.get("coal", 0.0),
                                oil=pt_fuel.get("oil", 0.0),
                                battery=pt_fuel.get("battery", 0.0),
                                demand=round(avg_demand) if avg_demand > 0 else None,
                                price=avg_price,
                                totalGeneration=round(b_tot_gen, 1),
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
                        minDemandMW=round(min_demand)
                        if min_demand != float("inf")
                        else 0,
                        avgPricePHPMWh=round(grand_price_sum / grand_price_cnt)
                        if grand_price_cnt > 0
                        else 0,
                        currencySymbol=c_meta["currencySymbol"],
                        currencyCode=c_meta["currencyCode"],
                        emissionsIntensityGPerKWh=round(
                            tot_emissions / tot_mwh * 1000.0
                        )
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

                    conn.close()
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
        except Exception as e:
            print(f"[API] DuckDB execution error: {e}")
            try:
                conn.close()
            except Exception:
                pass

    # 2. Simulation dataset fallback
    sim = generate_simulation_data(country, region, range_val, active_interval)
    return EnergyResponse(
        country=country,
        region=region,
        range=range_val,
        interval=active_interval,
        source="simulation_dataset",
        unit=unit,
        **sim,
    )


@app.get("/api/facilities", response_model=FacilitiesResponse)
def get_facilities(
    country: str = Query(default="PH"),
    region: Optional[str] = Query(default=None),
):
    country = country.upper()
    conn, source = get_duckdb_connection()

    if conn:
        try:
            sql = "SELECT country_code, resource_id, facility_name, region, fuel_tech, capacity_mw, is_renewable, emissions_factor, status FROM facilities WHERE country_code = ?"
            params = [country]
            if region and region != "ALL":
                sql += " AND region = ?"
                params.append(region.upper())

            rows = conn.execute(sql, params).fetchall()
            conn.close()

            if rows:
                facilities = [
                    {
                        "country_code": r[0],
                        "resource_id": r[1],
                        "facility_name": r[2],
                        "region": r[3],
                        "fuel_tech": r[4],
                        "capacity_mw": r[5] or 0.0,
                        "is_renewable": bool(r[6]),
                        "emissions_factor": r[7] or 0.0,
                        "status": r[8] or "ACTIVE",
                    }
                    for r in rows
                ]
                return FacilitiesResponse(
                    country=country,
                    facilities=facilities,
                    count=len(facilities),
                    source=source,
                )
        except Exception as e:
            print(f"[API] Facilities DuckDB error: {e}")

    # Fallback to static JSON catalog
    if country == "PH" and GENERATORS_JSON.exists():
        try:
            with open(GENERATORS_JSON, "r") as f:
                master = json.load(f)
            if region and region != "ALL":
                master = [f for f in master if f.get("region") == region.upper()]
            return FacilitiesResponse(
                country="PH",
                facilities=master,
                count=len(master),
                source="static_catalog",
            )
        except Exception:
            pass

    return FacilitiesResponse(country=country, facilities=[], count=0, source="empty")
