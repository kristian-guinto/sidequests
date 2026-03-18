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

import { Database } from "duckdb-async";
import path from "path";
import type { BatteryDailyRow, BatteryIntervalRow } from "./types";

function buildUrl(): string {
  let url =
    process.env.DATABASE_URL ?? path.resolve(process.cwd(), "../nem_battery.db");
  if (url.startsWith("md:") && !url.includes("motherduck_token")) {
    const token = process.env.MOTHERDUCK_TOKEN;
    if (token) {
      const sep = url.includes("?") ? "&" : "?";
      url = `${url}${sep}motherduck_token=${token}`;
    }
  }
  return url;
}

let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) {
    _db = await Database.create(buildUrl());
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
    const rows = await db.all(sql, ...params);
    return rows.map((r) =>
      normalizeRow(r as Record<string, unknown>)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any as T[];
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes("does not exist")) {
      return [];
    }
    throw err;
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
