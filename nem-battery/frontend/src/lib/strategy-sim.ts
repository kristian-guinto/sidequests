import type { StrategyPoint } from "./strategy-types"

export const BATTERIES = [
  "hornsdale",
  "victorian_big_battery",
  "wallgrove",
  "lake_bonney",
  "gannawarra",
  "dalrymple_north",
  "wandoan",
]

// 5 clusters — each with a 3D centroid and revenue distribution
const CLUSTER_DEFS = [
  { x: 2.5, y: 1.5, z: 0.8, avgRevenue: 48000, stdRevenue: 8000 }, // Peak Arbitrage
  { x: -1.5, y: 2.0, z: 1.5, avgRevenue: 30000, stdRevenue: 6000 }, // FCAS Dominant
  { x: -2.0, y: -1.5, z: -0.5, avgRevenue: 8000, stdRevenue: 5000 }, // Low Utilisation
  { x: 1.0, y: -2.0, z: 1.0, avgRevenue: 20000, stdRevenue: 10000 }, // Mixed Strategy
  { x: 0.5, y: 0.5, z: -2.5, avgRevenue: 38000, stdRevenue: 14000 }, // Negative-Price Events
]

// Each battery has a propensity to land in each cluster (rows sum to 1)
const BATTERY_WEIGHTS: Record<string, number[]> = {
  hornsdale: [0.50, 0.20, 0.05, 0.10, 0.15],
  victorian_big_battery: [0.10, 0.10, 0.05, 0.40, 0.35],
  wallgrove: [0.15, 0.40, 0.10, 0.25, 0.10],
  lake_bonney: [0.20, 0.05, 0.30, 0.20, 0.25],
  gannawarra: [0.10, 0.30, 0.20, 0.30, 0.10],
  dalrymple_north: [0.30, 0.15, 0.10, 0.10, 0.35],
  wandoan: [0.05, 0.15, 0.40, 0.30, 0.10],
}

// Box-Muller normal sample
function randn(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function sampleCluster(weights: number[]): number {
  const r = Math.random()
  let cum = 0
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i]
    if (r < cum) return i
  }
  return weights.length - 1
}

function isoDate(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

export function generateSimulatedData(): StrategyPoint[] {
  const points: StrategyPoint[] = []
  const start = new Date("2025-10-01")

  for (const battery of BATTERIES) {
    const weights = BATTERY_WEIGHTS[battery]
    for (let d = 0; d < 90; d++) {
      const cluster_id = sampleCluster(weights)
      const def = CLUSTER_DEFS[cluster_id]
      const spread = 0.65
      const date = isoDate(start, d)
      points.push({
        id: `${battery}_${date}`,
        battery_key: battery,
        date,
        x: def.x + randn() * spread,
        y: def.y + randn() * spread,
        z: def.z + randn() * spread,
        daily_revenue: Math.max(-8000, def.avgRevenue + randn() * def.stdRevenue),
        cluster_id,
      })
    }
  }

  return points
}
