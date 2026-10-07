import { NextResponse } from "next/server"
import { getStrategyEmbeddings } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const points = await getStrategyEmbeddings()
    return NextResponse.json(points)
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load strategy embeddings" },
      { status: 500 }
    )
  }
}
