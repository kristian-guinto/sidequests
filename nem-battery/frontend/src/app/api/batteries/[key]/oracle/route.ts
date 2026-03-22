import { getOracleComparison } from "@/lib/db";
import { KNOWN_BATTERIES } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const { searchParams } = new URL(request.url);

  const meta = KNOWN_BATTERIES[key];
  if (!meta || meta.mw == null || meta.mwh == null) {
    return NextResponse.json({ error: "Unknown battery or missing capacity data" }, { status: 404 });
  }

  const daysParam = searchParams.get("days");
  const days =
    daysParam === null || daysParam === "all"
      ? undefined
      : Math.max(1, parseInt(daysParam, 10));

  try {
    const data = await getOracleComparison(key, meta.region, meta.mw, meta.mwh, days);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api] /api/batteries/[key]/oracle failed", { key, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
