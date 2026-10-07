import { getBatterySummaries } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getBatterySummaries();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api] /api/batteries/summary failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
