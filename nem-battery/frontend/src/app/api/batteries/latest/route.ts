import { getLatestIntervals } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getLatestIntervals();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api] /api/batteries/latest failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
