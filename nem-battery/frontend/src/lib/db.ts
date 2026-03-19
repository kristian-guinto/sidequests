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
import type { BatteryDailyRow, BatteryIntervalRow } from "./types";
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

/** Daily summary rows for one battery, most recent first. */
export async function getDailyRevenue(key: string, days = 30): Promise<BatteryDailyRow[]> {
  return query<BatteryDailyRow>(
    `SELECT *
     FROM battery_revenue_daily
     WHERE battery_key = ?
     ORDER BY date DESC
     LIMIT ?`,
    key,
    days
  );
}

/** All 5-min interval rows for one battery on a given date (YYYY-MM-DD). */
export async function getIntervalsForDay(
  key: string,
  date: string
): Promise<BatteryIntervalRow[]> {
  return query<BatteryIntervalRow>(
    `SELECT *
     FROM battery_revenue_interval
     WHERE battery_key = ?
       AND settlement_date::DATE = ?::DATE
     ORDER BY settlement_date`,
    key,
    date
  );
}

/** Distinct dates available for a battery in the interval table (last 30 days). */
export async function getAvailableDates(key: string): Promise<string[]> {
  const rows = await query<{ date: string }>(
    `SELECT DISTINCT settlement_date::DATE::VARCHAR AS date
     FROM battery_revenue_interval
     WHERE battery_key = ?
     ORDER BY date DESC
     LIMIT 30`,
    key
  );
  return rows.map((r) => r.date);
}

/** All 3-D UMAP embeddings from battery_strategy_embedding, most recent first. */
export async function getStrategyEmbeddings(): Promise<StrategyPoint[]> {
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
