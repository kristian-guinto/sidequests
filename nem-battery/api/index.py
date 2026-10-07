import math
import os
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import duckdb
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

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
load_dotenv(BASE_DIR / ".env.local")

# Battery Metadata
KNOWN_BATTERIES: Dict[str, Dict[str, Any]] = {
    "hornsdale": {"name": "Hornsdale Power Reserve", "region": "SA1", "mw": 150.0, "mwh": 193.5},
    "victorian_big_battery": {"name": "Victorian Big Battery", "region": "VIC1", "mw": 300.0, "mwh": 450.0},
    "wallgrove": {"name": "Wallgrove BESS", "region": "NSW1", "mw": 50.0, "mwh": 75.0},
    "lake_bonney": {"name": "Lake Bonney BESS", "region": "SA1", "mw": 25.0, "mwh": 52.0},
    "gannawarra": {"name": "Gannawarra ESS", "region": "VIC1", "mw": 25.0, "mwh": 50.0},
    "dalrymple_north": {"name": "Dalrymple North BESS", "region": "SA1", "mw": 30.0, "mwh": 8.0},
    "wandoan": {"name": "Wandoan Power BESS", "region": "QLD1", "mw": 100.0, "mwh": 150.0},
    "torrens_island": {"name": "Torrens Island BESS", "region": "SA1", "mw": 250.0, "mwh": 250.0},
    "blyth": {"name": "Blyth BESS", "region": "SA1", "mw": 237.5, "mwh": 477.0},
    "templers": {"name": "Templers BESS", "region": "SA1", "mw": 138.0, "mwh": 330.0},
    "capital_battery": {"name": "Capital Battery", "region": "NSW1", "mw": 100.0, "mwh": 200.0},
    "rangebank": {"name": "Rangebank BESS", "region": "VIC1", "mw": 200.0, "mwh": 400.0},
    "hazelwood": {"name": "Hazelwood BESS", "region": "VIC1", "mw": 150.0, "mwh": 150.0},
    "koorangie": {"name": "Koorangie BESS", "region": "VIC1", "mw": 185.0, "mwh": 370.0},
    "tarong": {"name": "Tarong BESS", "region": "QLD1", "mw": 300.0, "mwh": 600.0},
    "western_downs": {"name": "Western Downs BESS", "region": "QLD1", "mw": 540.0, "mwh": 1080.0},
    "greenbank": {"name": "Greenbank BESS", "region": "QLD1", "mw": 200.0, "mwh": 400.0},
}

app = FastAPI(
    title="NEM Battery API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_connection: Optional[duckdb.DuckDBPyConnection] = None


def get_db() -> duckdb.DuckDBPyConnection:
    """Returns a singleton DuckDB connection."""
    global _connection
    if _connection is not None:
        return _connection

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        candidates = [
            BASE_DIR / "nem_battery.db",
            BASE_DIR.parent / "nem_battery.db",
            Path.home() / "nem-battery" / "nem_battery.db",
        ]
        for c in candidates:
            if c.exists():
                database_url = str(c)
                break
        if not database_url:
            database_url = str(BASE_DIR / "nem_battery.db")

    token = os.getenv("MOTHERDUCK_TOKEN")
    if database_url.startswith("md:") and "motherduck_token" not in database_url:
        if token:
            sep = "&" if "?" in database_url else "?"
            database_url = f"{database_url}{sep}motherduck_token={token}"

    config = {
        "extension_directory": "/tmp/.duckdb/extensions",
    }
    if database_url.startswith("md:") and token and "motherduck_token" not in database_url:
        config["motherduck_token"] = token

    try:
        if database_url.startswith("md:"):
            _connection = duckdb.connect(database_url, config=config)
        else:
            _connection = duckdb.connect(database_url, read_only=True)
    except Exception as e:
        print(f"[db] DuckDB connection failed: {e}")
        raise

    return _connection


def normalize_val(v: Any) -> Any:
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, date):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {k: normalize_val(v) for k, v in row.items()}


def run_query(sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
    con = get_db()
    try:
        rel = con.execute(sql, params or [])
        cols = [desc[0] for desc in rel.description] if rel.description else []
        rows = rel.fetchall()
        result = []
        for r in rows:
            row_dict = dict(zip(cols, r))
            result.append(normalize_row(row_dict))
        return result
    except Exception as err:
        msg = str(err)
        if "does not exist" in msg.lower():
            print(f"[db] table not found, returning []: {sql[:80]}")
            return []
        print(f"[db] query failed: {err}")
        raise


@app.get("/api")
def get_root():
    return {
        "name": "nem-battery-api",
        "status": "online",
        "documentation": "/api/docs",
    }


@app.get("/api/health")
def get_health(response: Response):
    try:
        con = get_db()
        tables = [t[0] for t in con.execute("SHOW TABLES").fetchall()]
        counts = {}
        for t in ["battery_revenue_daily", "battery_revenue_interval"]:
            if t in tables:
                counts[t] = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        return {
            "status": "healthy",
            "database_url_configured": bool(os.getenv("DATABASE_URL")),
            "motherduck_configured": bool(os.getenv("MOTHERDUCK_TOKEN")),
            "tables": tables,
            "counts": counts,
        }
    except Exception as e:
        response.status_code = 503
        return {
            "status": "unhealthy",
            "error": str(e),
        }


@app.get("/api/batteries")
def get_batteries_metadata():
    return KNOWN_BATTERIES


@app.get("/api/batteries/latest")
def get_latest_intervals():
    sql = """
        SELECT bri.*
        FROM battery_revenue_interval bri
        INNER JOIN (
          SELECT battery_key, MAX(settlement_date) AS latest
          FROM battery_revenue_interval
          GROUP BY battery_key
        ) t ON bri.battery_key = t.battery_key
           AND bri.settlement_date = t.latest
        ORDER BY bri.battery_key
    """
    return run_query(sql)


@app.get("/api/batteries/summary")
def get_battery_summaries():
    sql_stats = """
        SELECT
          battery_key,
          COALESCE(SUM(net), 0) AS total_revenue,
          COALESCE(
            SUM(net) / NULLIF(COUNT(DISTINCT DATE_TRUNC('month', date)), 0),
            0
          ) AS avg_monthly_revenue,
          CASE
            WHEN SUM(net) > 0
            THEN 100.0 * COALESCE(SUM(total_fcas_revenue), 0) / NULLIF(SUM(net), 0)
            ELSE 0
          END AS fcas_share_pct,
          COALESCE(AVG(net), 0) AS avg_daily_revenue
        FROM battery_revenue_daily
        GROUP BY battery_key
    """
    sql_sparkline = """
        SELECT
          battery_key,
          LEFT(CAST(date AS VARCHAR), 7) AS month,
          SUM(net_energy) AS net_energy,
          SUM(total_fcas_revenue) AS fcas
        FROM battery_revenue_daily
        GROUP BY battery_key, LEFT(CAST(date AS VARCHAR), 7)
        ORDER BY battery_key, month
    """
    sql_cluster = """
        SELECT battery_key, MODE(cluster_id) AS dominant_cluster
        FROM battery_strategy_embedding_2d
        WHERE cluster_id >= 0
        GROUP BY battery_key
    """

    stats_rows = run_query(sql_stats)
    sparkline_rows = run_query(sql_sparkline)
    cluster_rows = run_query(sql_cluster)

    sparkline_by_key: Dict[str, List[Dict[str, Any]]] = {}
    for r in sparkline_rows:
        b_key = r["battery_key"]
        if b_key not in sparkline_by_key:
            sparkline_by_key[b_key] = []
        sparkline_by_key[b_key].append({
            "month": r["month"],
            "net_energy": r["net_energy"],
            "fcas": r["fcas"],
        })

    stats_by_key = {r["battery_key"]: r for r in stats_rows}
    cluster_by_key = {r["battery_key"]: r["dominant_cluster"] for r in cluster_rows}

    results = []
    for key in KNOWN_BATTERIES.keys():
        s = stats_by_key.get(key)
        results.append({
            "battery_key": key,
            "total_revenue": s["total_revenue"] if s else 0.0,
            "avg_monthly_revenue": s["avg_monthly_revenue"] if s else 0.0,
            "fcas_share_pct": s["fcas_share_pct"] if s else 0.0,
            "avg_daily_revenue": s["avg_daily_revenue"] if s else 0.0,
            "sparkline": sparkline_by_key.get(key, []),
            "dominant_cluster": cluster_by_key.get(key),
        })
    return results


@app.get("/api/batteries/{key}/daily")
def get_daily_revenue(key: str, days: Optional[str] = None):
    limit_clause = ""
    if days is not None and str(days) != "all":
        try:
            d_val = max(1, int(days))
            limit_clause = f"LIMIT {d_val}"
        except ValueError:
            pass

    sql = f"""
        SELECT *
        FROM battery_revenue_daily
        WHERE battery_key = ?
        ORDER BY date DESC
        {limit_clause}
    """
    return run_query(sql, [key])


@app.get("/api/batteries/{key}/interval")
def get_intervals(key: str, date: Optional[str] = None):
    if not date:
        # Return available dates
        sql = """
            SELECT DISTINCT (settlement_date - INTERVAL '5 minutes')::DATE::VARCHAR AS date
            FROM battery_revenue_interval
            WHERE battery_key = ?
            ORDER BY date DESC
        """
        rows = run_query(sql, [key])
        return [r["date"] for r in rows]

    if not isinstance(date, str) or not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        raise HTTPException(status_code=400, detail="Invalid date format")

    sql = """
        SELECT *
        FROM battery_revenue_interval
        WHERE battery_key = ?
          AND settlement_date > ?::DATE
          AND settlement_date <= (?::DATE + INTERVAL '1 day')
        ORDER BY settlement_date
    """
    return run_query(sql, [key, date, date])


@app.get("/api/batteries/{key}/monthly")
def get_monthly_revenue(key: str, months: Optional[str] = None):
    limit_clause = ""
    if months is not None and str(months) != "all":
        try:
            m_val = max(1, int(months))
            limit_clause = f"LIMIT {m_val}"
        except ValueError:
            pass

    sql = f"""
        SELECT
           LEFT(CAST(date AS VARCHAR), 7) AS month,
           COALESCE(SUM(net_energy), 0) AS net_energy,
           COALESCE(SUM(total_fcas_revenue), 0) AS total_fcas_revenue,
           COALESCE(SUM(net), 0) AS net
        FROM battery_revenue_daily
        WHERE battery_key = ?
        GROUP BY LEFT(CAST(date AS VARCHAR), 7)
        ORDER BY month DESC
        {limit_clause}
    """
    return run_query(sql, [key])


@app.get("/api/batteries/{key}/stats")
def get_battery_stats(key: str):
    sql = """
        SELECT
           battery_key,
           COALESCE(SUM(net), 0) AS total_revenue,
           COALESCE(SUM(CASE
             WHEN date >= CURRENT_DATE - INTERVAL '30 days'
             THEN net ELSE 0 END), 0) AS last_30d_revenue,
           CASE
             WHEN SUM(net) > 0
             THEN 100.0 * COALESCE(SUM(total_fcas_revenue), 0) / NULLIF(SUM(net), 0)
             ELSE 0
           END AS fcas_share_pct,
           COALESCE(MAX(net), 0) AS best_day_revenue,
           COALESCE(AVG(net), 0) AS avg_daily_revenue
        FROM battery_revenue_daily
        WHERE battery_key = ?
        GROUP BY battery_key
    """
    rows = run_query(sql, [key])
    if rows:
        return rows[0]
    return {
        "battery_key": key,
        "total_revenue": 0.0,
        "last_30d_revenue": 0.0,
        "fcas_share_pct": 0.0,
        "best_day_revenue": 0.0,
        "avg_daily_revenue": 0.0,
    }


@app.get("/api/batteries/{key}/oracle")
def get_oracle_comparison(key: str, days: Optional[str] = None):
    meta = KNOWN_BATTERIES.get(key)
    if not meta or meta.get("mw") is None or meta.get("mwh") is None:
        raise HTTPException(status_code=404, detail="Unknown battery or missing capacity data")

    mw = meta["mw"]
    mwh = meta["mwh"]
    region = meta["region"]
    n_cycles = math.floor((mwh / mw) * 12)

    limit_clause = ""
    if days is not None and days != "all":
        try:
            d_val = max(1, int(days))
            limit_clause = f"LIMIT {d_val}"
        except ValueError:
            pass

    sql = f"""
        WITH ranked AS (
          SELECT
            (settlement_date - INTERVAL '4 hours')::DATE AS trading_day,
            rrp,
            ROW_NUMBER() OVER (
              PARTITION BY (settlement_date - INTERVAL '4 hours')::DATE
              ORDER BY rrp DESC
            ) AS dis_rank,
            ROW_NUMBER() OVER (
              PARTITION BY (settlement_date - INTERVAL '4 hours')::DATE
              ORDER BY rrp ASC
            ) AS chg_rank
          FROM dispatch_prices
          WHERE region = ?
        ),
        oracle_daily AS (
          SELECT
            trading_day,
            GREATEST(0.0,
              {mw} * (5.0 / 60) * (
                COALESCE(SUM(rrp) FILTER (WHERE dis_rank <= {n_cycles}), 0) -
                COALESCE(SUM(rrp) FILTER (WHERE chg_rank <= {n_cycles}), 0)
              )
            ) AS oracle_revenue
          FROM ranked
          GROUP BY trading_day
        )
        SELECT
          CAST(a.date AS VARCHAR) AS date,
          COALESCE(a.net, 0) AS actual,
          COALESCE(o.oracle_revenue, 0) AS oracle,
          CASE
            WHEN o.oracle_revenue > 0
            THEN LEAST(100.0 * COALESCE(a.net, 0) / o.oracle_revenue, 200)
            ELSE NULL
          END AS efficiency_pct
        FROM battery_revenue_daily a
        LEFT JOIN oracle_daily o ON o.trading_day = a.date
        WHERE a.battery_key = ?
        ORDER BY a.date DESC
        {limit_clause}
    """
    return run_query(sql, [region, key])


@app.get("/api/strategy/points")
def get_strategy_embeddings():
    sql = """
        SELECT
           trading_day::VARCHAR AS trading_day,
           battery_key,
           x, y,
           cluster_id,
           daily_revenue
        FROM battery_strategy_embedding_2d
        ORDER BY trading_day DESC, battery_key
    """
    rows = run_query(sql)
    return [
        {
            "id": f"{r['battery_key']}_{r['trading_day']}",
            "battery_key": r["battery_key"],
            "date": r["trading_day"],
            "x": float(r["x"]),
            "y": float(r["y"]),
            "cluster_id": r["cluster_id"] if r["cluster_id"] is not None else -1,
            "daily_revenue": float(r["daily_revenue"]) if r["daily_revenue"] is not None else 0.0,
        }
        for r in rows
    ]


@app.get("/api/strategy/cluster-summary")
def get_cluster_summaries():
    sql = """
        SELECT
           cluster_id,
           state_reversal_count,
           normalised_total_variation,
           utilization_factor,
           energy_price_pearson_correlation,
           energy_price_spearman_correlation,
           price_selectivity_index,
           fcas_revenue_share,
           reg_vs_contingency_ratio,
           revenue_diversity_index,
           co_optimization_frequency,
           evening_peak_weight,
           morning_peak_weight,
           solar_soak_charge_weight,
           overnight_charge_weight,
           negative_price_capture
        FROM battery_strategy_cluster_summary
        ORDER BY cluster_id
    """
    return run_query(sql)
