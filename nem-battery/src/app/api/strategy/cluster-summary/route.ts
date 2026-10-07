import { NextResponse } from "next/server"
import { getClusterSummaries } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const rows = await getClusterSummaries()
        return NextResponse.json(rows)
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to load cluster summaries" },
            { status: 500 }
        )
    }
}
