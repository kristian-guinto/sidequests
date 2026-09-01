import { NextRequest, NextResponse } from "next/server";
import { queryDuckDBFacilities } from "@/lib/duckdb";
import masterFacilities from "../../../../../pipeline/data/generators_master.json";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const country = (searchParams.get("country") || "PH").toUpperCase();
  const region = searchParams.get("region");

  // 1. Try DuckDB / MotherDuck first
  try {
    const duckData = await queryDuckDBFacilities(country, region);
    if (duckData && duckData.length > 0) {
      return NextResponse.json({
        country,
        facilities: duckData,
        count: duckData.length,
        source: process.env.MOTHERDUCK_TOKEN ? "motherduck_cloud" : "duckdb_local",
      });
    }
  } catch (err) {
    console.warn("[API] DuckDB facilities query error:", err);
  }

  // 2. Fallback to static catalog (for PH)
  if (country === "PH") {
    let filtered = masterFacilities;
    if (region && region !== "ALL") {
      filtered = masterFacilities.filter((f) => f.region === region.toUpperCase());
    }

    return NextResponse.json({
      country: "PH",
      facilities: filtered,
      count: filtered.length,
      source: "static_catalog",
    });
  }

  return NextResponse.json({
    country,
    facilities: [],
    count: 0,
    source: "empty",
  });
}
