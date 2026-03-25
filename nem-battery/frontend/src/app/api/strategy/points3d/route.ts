import { NextResponse } from "next/server"
import { getStrategyEmbeddings3D } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const points = await getStrategyEmbeddings3D()
        return NextResponse.json(points)
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to load 3D strategy embeddings" },
            { status: 500 }
        )
    }
}
