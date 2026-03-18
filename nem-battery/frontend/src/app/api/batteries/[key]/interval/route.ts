import { getAvailableDates, getIntervalsForDay } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  try {
    if (!date) {
      // Return available dates instead
      const dates = await getAvailableDates(key);
      return NextResponse.json(dates);
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const data = await getIntervalsForDay(key, date);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
