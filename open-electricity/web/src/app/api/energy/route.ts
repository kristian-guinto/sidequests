import { NextRequest, NextResponse } from "next/server";
import { generateMockEnergyData } from "@/lib/mockData";
import { CountryCode, Region, TimeRange, TimeInterval, COUNTRIES_METADATA } from "@/lib/types";
import { queryDuckDB } from "@/lib/duckdb";
import { queryLocalSQLite } from "@/lib/sqlite";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const countryParam = (searchParams.get("country") || "PH").toUpperCase() as CountryCode;
  const country = (COUNTRIES_METADATA[countryParam] ? countryParam : "PH") as CountryCode;

  const defaultReg = COUNTRIES_METADATA[country]?.defaultRegion || "ALL";
  const region = (searchParams.get("region") || defaultReg).toUpperCase() as Region;
  const range = (searchParams.get("range") || "7d").toLowerCase() as TimeRange;
  const interval = (searchParams.get("interval") || "30m").toLowerCase() as TimeInterval;

  // 1. Try DuckDB / MotherDuck first (Primary Multi-Country Database)
  try {
    const duckResult = await queryDuckDB(country, region, range, interval);
    if (duckResult && duckResult.points.length > 0) {
      return NextResponse.json({
        country,
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

  // 2. Try local SQLite fallback (only for PH)
  if (country === "PH") {
    try {
      const sqliteResult = queryLocalSQLite(region as any, range, interval);
      if (sqliteResult && sqliteResult.points.length > 0) {
        return NextResponse.json({
          country,
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
  }

  // 3. Fallback to generated simulation dataset
  const data = generateMockEnergyData(country, region, range, interval);
  return NextResponse.json({
    country,
    region,
    range,
    interval,
    source: "simulation_dataset",
    ...data,
  });
}
