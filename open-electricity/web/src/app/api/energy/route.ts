import { NextRequest, NextResponse } from "next/server";
import { generateMockEnergyData } from "@/lib/mockData";
import { Region, TimeRange, TimeInterval } from "@/lib/types";
import { queryDuckDB } from "@/lib/duckdb";
import { queryLocalSQLite } from "@/lib/sqlite";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = (searchParams.get("region") || "ALL").toUpperCase() as Region;
  const range = (searchParams.get("range") || "7d").toLowerCase() as TimeRange;
  const interval = (searchParams.get("interval") || "30m").toLowerCase() as TimeInterval;

  // 1. Try DuckDB / MotherDuck first (Primary Database)
  try {
    const duckResult = await queryDuckDB(region, range, interval);
    if (duckResult && duckResult.points.length > 0) {
      return NextResponse.json({
        region,
        range,
        interval,
        source: process.env.MOTHERDUCK_TOKEN ? "motherduck_cloud" : "duckdb_local",
        ...duckResult,
      });
    }
  } catch (err) {
    console.warn("[API] DuckDB query error, trying SQLite fallback:", err);
  }

  // 2. Try local SQLite fallback
  try {
    const sqliteResult = queryLocalSQLite(region, range, interval);
    if (sqliteResult && sqliteResult.points.length > 0) {
      return NextResponse.json({
        region,
        range,
        interval,
        source: "sqlite_local",
        ...sqliteResult,
      });
    }
  } catch (err) {
    console.warn("[API] SQLite query fallback error:", err);
  }

  // 3. Fallback to generated dataset
  const data = generateMockEnergyData(region, range, interval);
  return NextResponse.json({
    region,
    range,
    interval,
    source: "simulation_dataset",
    ...data,
  });
}
