import { getMonthlyRevenue } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const { searchParams } = new URL(request.url);
  const monthsParam = searchParams.get("months");
  const months = monthsParam === null || monthsParam === "all"
    ? undefined
    : Math.max(1, parseInt(monthsParam, 10));

  try {
    const data = await getMonthlyRevenue(key, months);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api] /api/batteries/[key]/monthly failed", { key, months, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
