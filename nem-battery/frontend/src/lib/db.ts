/**
 * DuckDB / MotherDuck query layer for the nem-battery dashboard.
 *
 * Database selection (via environment variables):
 *   Local dev:   DATABASE_URL=../nem_battery.db   (relative to frontend/)
 *   Production:  DATABASE_URL=md:nem_battery  +  MOTHERDUCK_TOKEN=<token>
 *
 * The MOTHERDUCK_TOKEN is appended to the URL, matching the approach used by
 * the Python pipeline in pipeline.py::connect_target().
 */

import path from "path";
import type { BatteryDailyRow, BatteryIntervalRow, BatterySummaryRow, BatteryMonthlyRow, BatteryStatsRow, BatteryOracleRow, ClusterSummaryRow } from "./types";
import { KNOWN_BATTERIES } from "./types";
import type { StrategyPoint } from "./strategy-types";
import type { DuckDBConnection } from "@duckdb/node-api";

function redactUrl(url: string): string {
  return url.replace(/(motherduck_token=)[^&]+/i, "$1<redacted>");
}

function resolveHomeDirectory(): string {
  const home = process.env.HOME?.trim();
  if (home) return home;
  return "/tmp";
}

function ensureProcessHome(homeDirectory: string): void {
  if (!process.env.HOME || process.env.HOME.trim() === "") {
    process.env.HOME = homeDirectory;
  }
}

function buildUrl(): string {
  let url =
    process.env.DATABASE_URL ?? path.resolve(process.cwd(), "../nem_battery.db");
  if (url.startsWith("md:") && !url.includes("motherduck_token")) {
    const token = process.env.MOTHERDUCK_TOKEN;
    if (!token) {
      throw new Error("MOTHERDUCK_TOKEN is required when DATABASE_URL starts with md:");
    }
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}motherduck_token=${encodeURIComponent(token)}`;
  }
  return url;
}

let _db: DuckDBConnection | null = null;

async function getDb(): Promise<DuckDBConnection> {
  if (!_db) {
    const url = buildUrl();
    const homeDirectory = resolveHomeDirectory();
    ensureProcessHome(homeDirectory);
    // Load native bindings lazily so build analysis can import this module
    // without immediately attempting to dlopen native binaries.
    try {
      const { DuckDBInstance } = await import("@duckdb/node-api");
      const instance = await DuckDBInstance.create(url);
      _db = await instance.connect();
      console.info("[db] connected", {
        databaseUrl: redactUrl(url),
        isMotherDuck: url.startsWith("md:"),
        hasMotherDuckToken: Boolean(process.env.MOTHERDUCK_TOKEN),
        processHome: process.env.HOME,
        homeDirectory,
      });
    } catch (err: unknown) {
      console.error("[db] failed to initialize", {
        databaseUrl: redactUrl(url),
        isMotherDuck: url.startsWith("md:"),
        hasMotherDuckToken: Boolean(process.env.MOTHERDUCK_TOKEN),
        processHome: process.env.HOME,
        homeDirectory,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
  return _db;
}

/**
 * Normalise a DuckDB row: convert JS Date objects to plain strings.
 *
 * DuckDB TIMESTAMP / DATE columns come back as JS Date objects
 * (interpreted as UTC) from duckdb-async.  NEM timestamps are AEST naive
 * (no tz info) so we strip the "Z" suffix to return them as-is, preventing
 * unintended timezone shifts in the frontend.
 *
 * DATE columns arrive as midnight UTC (T00:00:00.000Z) → "YYYY-MM-DD".
 * TIMESTAMP columns → "YYYY-MM-DD HH:MM:SS" (preserving the original value).
 */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      const iso = v.toISOString();
      out[k] = iso.endsWith("T00:00:00.000Z")
        ? iso.slice(0, 10)                          // "YYYY-MM-DD"
        : iso.slice(0, 19).replace("T", " ");       // "YYYY-MM-DD HH:MM:SS"
    } else {
      out[k] = v;
    }
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function query<T>(sql: string, ...params: any[]): Promise<T[]> {
  const db = await getDb();
  try {
    const result = await db.runAndReadAll(sql, params);
    const rows = result.getRowObjectsJS();
    return rows.map((r) => normalizeRow(r as Record<string, unknown>)) as any as T[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isExpectedMissing = msg.toLowerCase().includes("does not exist")
    if (isExpectedMissing) {
      console.warn("[db] table not found, returning []:", sql.replace(/\s+/g, " ").trim().slice(0, 80))
      return []
    }
    console.error("[db] query failed", {
      sqlPreview: sql.replace(/\s+/g, " ").trim().slice(0, 120),
      paramsCount: params.length,
      error: msg,
    })
    throw err
  }
}

/** One row per battery key for the latest settlement date in the interval table. */
export async function getLatestIntervals(): Promise<BatteryIntervalRow[]> {
  return query<BatteryIntervalRow>(`
    SELECT bri.*
    FROM battery_revenue_interval bri
    INNER JOIN (
      SELECT battery_key, MAX(settlement_date) AS latest
      FROM battery_revenue_interval
      GROUP BY battery_key
    ) t ON bri.battery_key = t.battery_key
       AND bri.settlement_date = t.latest
    ORDER BY bri.battery_key
  `);
}

/** Daily summary rows for one battery, most recent first. Omit days for all history. */
export async function getDailyRevenue(key: string, days?: number): Promise<BatteryDailyRow[]> {
  const limit = days != null ? `LIMIT ${days}` : "";
  return query<BatteryDailyRow>(
    `SELECT *
     FROM battery_revenue_daily
     WHERE battery_key = ?
     ORDER BY date DESC
     ${limit}`,
    key
  );
}

/** All 5-min interval rows for one battery on a given date (YYYY-MM-DD).
 *
 * NEM dispatch days run from 00:05 to 00:00 the next day (288 intervals).
 * The midnight interval (settlement_date = (date+1) 00:00:00) belongs to this
 * trading day, so we use a range query instead of a DATE equality check.
 */
export async function getIntervalsForDay(
  key: string,
  date: string
): Promise<BatteryIntervalRow[]> {
  return query<BatteryIntervalRow>(
    `SELECT *
     FROM battery_revenue_interval
     WHERE battery_key = ?
       AND settlement_date > ?::DATE
       AND settlement_date <= (?::DATE + INTERVAL '1 day')
     ORDER BY settlement_date`,
    key,
    date,
    date
  );
}

/** Distinct dates available for a battery in the interval table.
 *
 * Subtracts 5 minutes before extracting the date so that the midnight interval
 * (settlement_date = (date+1) 00:00:00) is correctly attributed to its trading
 * day (date) rather than creating a ghost entry for the next calendar day.
 */
export async function getAvailableDates(key: string): Promise<string[]> {
  const rows = await query<{ date: string }>(
    `SELECT DISTINCT (settlement_date - INTERVAL '5 minutes')::DATE::VARCHAR AS date
     FROM battery_revenue_interval
     WHERE battery_key = ?
     ORDER BY date DESC`,
    key
  );
  return rows.map((r) => r.date);
}

/** Analytics summary for all batteries: all-time totals + 30-day sparkline. */
export async function getBatterySummaries(): Promise<BatterySummaryRow[]> {
  const [statsRows, sparklineRows, clusterRows] = await Promise.all([
    query<{
      battery_key: string;
      total_revenue: number;
      avg_monthly_revenue: number;
      fcas_share_pct: number;
      avg_daily_revenue: number;
    }>(`
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
    `),
    query<{ battery_key: string; month: string; net_energy: number; fcas: number }>(`
      SELECT
        battery_key,
        LEFT(CAST(date AS VARCHAR), 7) AS month,
        SUM(net_energy) AS net_energy,
        SUM(total_fcas_revenue) AS fcas
      FROM battery_revenue_daily
      GROUP BY battery_key, LEFT(CAST(date AS VARCHAR), 7)
      ORDER BY battery_key, month
    `),
    query<{ battery_key: string; dominant_cluster: number }>(`
      SELECT battery_key, MODE(cluster_id) AS dominant_cluster
      FROM battery_strategy_embedding_2d
      WHERE cluster_id >= 0
      GROUP BY battery_key
    `),
  ]);

  const sparklineByKey: Record<string, { month: string; net_energy: number; fcas: number }[]> = {};
  for (const r of sparklineRows) {
    if (!sparklineByKey[r.battery_key]) sparklineByKey[r.battery_key] = [];
    sparklineByKey[r.battery_key].push({ month: r.month, net_energy: r.net_energy, fcas: r.fcas });
  }

  const statsByKey = Object.fromEntries(statsRows.map((r) => [r.battery_key, r]));
  const clusterByKey = Object.fromEntries(clusterRows.map((r) => [r.battery_key, r.dominant_cluster]));

  return Object.keys(KNOWN_BATTERIES).map((key) => {
    const s = statsByKey[key];
    return {
      battery_key: key,
      total_revenue: s?.total_revenue ?? 0,
      avg_monthly_revenue: s?.avg_monthly_revenue ?? 0,
      fcas_share_pct: s?.fcas_share_pct ?? 0,
      avg_daily_revenue: s?.avg_daily_revenue ?? 0,
      sparkline: sparklineByKey[key] ?? [],
      dominant_cluster: clusterByKey[key] ?? null,
    };
  });
}

/** Monthly aggregate revenue for one battery, most recent first. Omit months for all history. */
export async function getMonthlyRevenue(
  key: string,
  months?: number
): Promise<BatteryMonthlyRow[]> {
  const limit = months != null ? `LIMIT ${months}` : "";
  return query<BatteryMonthlyRow>(
    `SELECT
       LEFT(CAST(date AS VARCHAR), 7) AS month,
       COALESCE(SUM(net_energy), 0) AS net_energy,
       COALESCE(SUM(total_fcas_revenue), 0) AS total_fcas_revenue,
       COALESCE(SUM(net), 0) AS net
     FROM battery_revenue_daily
     WHERE battery_key = ?
     GROUP BY LEFT(CAST(date AS VARCHAR), 7)
     ORDER BY month DESC
     ${limit}`,
    key
  );
}

/** Aggregated stats for one battery (all-time + derived metrics). */
export async function getBatteryStats(key: string): Promise<BatteryStatsRow | null> {
  const rows = await query<BatteryStatsRow>(
    `SELECT
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
     GROUP BY battery_key`,
    key
  );
  return rows[0] ?? null;
}

/** All 2-D UMAP embeddings from battery_strategy_embedding_2d, most recent first. */
export async function getStrategyEmbeddings(): Promise<StrategyPoint[]> {
  const rows = await query<{
    trading_day: string
    battery_key: string
    x: number
    y: number
    cluster_id: number
    daily_revenue: number | null
  }>(
    `SELECT
       trading_day::VARCHAR AS trading_day,
       battery_key,
       x, y,
       cluster_id,
       daily_revenue
     FROM battery_strategy_embedding_2d
     ORDER BY trading_day DESC, battery_key`
  );
  return rows.map((r) => ({
    id: `${r.battery_key}_${r.trading_day}`,
    battery_key: r.battery_key,
    date: r.trading_day,
    x: Number(r.x),
    y: Number(r.y),
    z: 0,
    cluster_id: r.cluster_id ?? -1,
    daily_revenue: r.daily_revenue ?? 0,
  }));
}

/** All 3-D UMAP embeddings from battery_strategy_embedding (x, y, z). */
export async function getStrategyEmbeddings3D(): Promise<StrategyPoint[]> {
  const rows = await query<{
    trading_day: string
    battery_key: string
    x: number
    y: number
    z: number
    cluster_id: number
    daily_revenue: number | null
  }>(
    `SELECT
       trading_day::VARCHAR AS trading_day,
       battery_key,
       x, y, z,
       cluster_id,
       daily_revenue
     FROM battery_strategy_embedding
     ORDER BY trading_day DESC, battery_key`
  );
  return rows.map((r) => ({
    id: `${r.battery_key}_${r.trading_day}`,
    battery_key: r.battery_key,
    date: r.trading_day,
    x: Number(r.x),
    y: Number(r.y),
    z: Number(r.z),
    cluster_id: r.cluster_id ?? -1,
    daily_revenue: r.daily_revenue ?? 0,
  }));
}

/** Mean feature values per cluster from battery_strategy_cluster_summary. */
export async function getClusterSummaries(): Promise<ClusterSummaryRow[]> {
  const rows = await query<ClusterSummaryRow>(
    `SELECT
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
     ORDER BY cluster_id`
  );
  return rows;
}

/**
 * Oracle (perfect-hindsight) revenue comparison.
 * Computes the theoretical maximum single-cycle energy arbitrage revenue per day
 * using actual dispatch prices, then joins with actual daily revenue.
 *
 * mw, mwh, region come from KNOWN_BATTERIES (server-side) and are interpolated
 * as numeric/string literals — NOT user input — so this is safe from injection.
 */
export async function getOracleComparison(
  key: string,
  region: string,
  mw: number,
  mwh: number,
  days?: number
): Promise<BatteryOracleRow[]> {
  // Number of 5-min intervals to fully charge or discharge at the rated MW
  const nCycles = Math.floor((mwh / mw) * 12);
  const limitClause = days != null ? `LIMIT ${days}` : "";

  const rows = await query<{ date: string; actual: number; oracle: number; efficiency_pct: number | null }>(
    `WITH ranked AS (
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
           ${mw} * (5.0 / 60) * (
             COALESCE(SUM(rrp) FILTER (WHERE dis_rank <= ${nCycles}), 0) -
             COALESCE(SUM(rrp) FILTER (WHERE chg_rank <= ${nCycles}), 0)
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
     ${limitClause}`,
    region,
    key
  );
  return rows;
}
