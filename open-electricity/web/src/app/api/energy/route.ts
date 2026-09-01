import { NextRequest, NextResponse } from "next/server";
import { generateMockEnergyData } from "@/lib/mockData";
import { Region, TimeRange, TimeInterval } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { queryLocalSQLite } from "@/lib/sqlite";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = (searchParams.get("region") || "ALL").toUpperCase() as Region;
  const range = (searchParams.get("range") || "7d").toLowerCase() as TimeRange;
  const interval = (searchParams.get("interval") || "30m").toLowerCase() as TimeInterval;

  // 1. Try local SQLite database first (offline local testing)
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

  // 2. Try querying Supabase if available
  if (supabase) {
    try {
      const { data: dispatchData, error: dispatchErr } = await supabase
        .from("energy_dispatch_5m")
        .select("*")
        .eq("region", region)
        .order("timestamp", { ascending: true })
        .limit(1000);

      const { data: regionalData } = await supabase
        .from("regional_summary_5m")
        .select("*")
        .eq("region", region)
        .order("timestamp", { ascending: true })
        .limit(1000);

      if (!dispatchErr && dispatchData && dispatchData.length > 0) {
        const timeMap = new Map<string, any>();

        for (const row of dispatchData) {
          const t = row.timestamp;
          if (!timeMap.has(t)) {
            timeMap.set(t, {
              timestamp: t,
              solar: 0,
              wind: 0,
              hydro: 0,
              geothermal: 0,
              biomass: 0,
              gas: 0,
              coal: 0,
              oil: 0,
              battery: 0,
              price: row.price_php_mwh || 0,
            });
          }
          const pt = timeMap.get(t);
          if (row.fuel_tech in pt) {
            pt[row.fuel_tech] = row.generation_mw;
          }
        }

        if (regionalData) {
          for (const reg of regionalData) {
            if (timeMap.has(reg.timestamp)) {
              const pt = timeMap.get(reg.timestamp);
              pt.demand = reg.demand_mw;
            }
          }
        }

        const points = Array.from(timeMap.values());
        if (points.length > 0) {
          const mockMeta = generateMockEnergyData(region, range);
          return NextResponse.json({
            region,
            range,
            interval,
            source: "supabase",
            points,
            summary: mockMeta.summary,
            breakdown: mockMeta.breakdown,
            interconnectors: mockMeta.interconnectors,
          });
        }
      }
    } catch (e) {
      console.warn("Supabase query fallback to mock data:", e);
    }
  }

  // 3. Fallback to generated simulation data
  const data = generateMockEnergyData(region, range, interval);
  return NextResponse.json({
    region,
    range,
    interval,
    source: "simulation_dataset",
    ...data,
  });
}
