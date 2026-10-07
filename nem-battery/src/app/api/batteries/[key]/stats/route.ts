import { getBatteryStats } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  try {
    const data = await getBatteryStats(key);
    return NextResponse.json(
      data ?? {
        battery_key: key,
        total_revenue: 0,
        last_30d_revenue: 0,
        fcas_share_pct: 0,
        best_day_revenue: 0,
        avg_daily_revenue: 0,
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api] /api/batteries/[key]/stats failed", { key, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
