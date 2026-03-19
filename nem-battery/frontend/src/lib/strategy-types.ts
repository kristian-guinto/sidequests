/**
 * A single point in 3D strategy space — one battery, one day.
 *
 * Future schema (MotherDuck table `battery_strategy_embedding`):
 *   settlement_date DATE        -- the trading day
 *   battery_key     VARCHAR     -- e.g. "hornsdale"
 *   x               DOUBLE      -- embedding dim 1
 *   y               DOUBLE      -- embedding dim 2
 *   z               DOUBLE      -- embedding dim 3
 *   daily_revenue   DOUBLE      -- net AUD for the day (from battery_revenue_daily)
 *   cluster_id      INTEGER     -- 0-indexed cluster label from clustering algorithm
 */
export interface StrategyPoint {
  id: string           // `${battery_key}_${date}` — synthetic join key
  battery_key: string
  date: string         // YYYY-MM-DD
  x: number
  y: number
  z: number
  daily_revenue: number   // AUD
  cluster_id: number
}

export type ColorMode = "revenue" | "battery" | "cluster"

export const BATTERY_COLORS: Record<string, string> = {
  hornsdale: "#fb923c",
  victorian_big_battery: "#60a5fa",
  wallgrove: "#4ade80",
  lake_bonney: "#c084fc",
  gannawarra: "#f472b6",
  dalrymple_north: "#2dd4bf",
  wandoan: "#facc15",
}

export const CLUSTER_COLORS = [
  "#f97316",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f43f5e",
]

export const CLUSTER_NAMES = [
  "Peak Arbitrage",
  "FCAS Dominant",
  "Low Utilisation",
  "Mixed Strategy",
  "Negative-Price Events",
]

export const BATTERY_DISPLAY_NAMES: Record<string, string> = {
  hornsdale: "Hornsdale",
  victorian_big_battery: "Victorian Big Battery",
  wallgrove: "Wallgrove",
  lake_bonney: "Lake Bonney",
  gannawarra: "Gannawarra",
  dalrymple_north: "Dalrymple North",
  wandoan: "Wandoan",
}

/** Nameplate MWh capacity — used to normalise revenue to $/MWh for fair cross-site comparison. */
export const BATTERY_MWH_CAPACITY: Record<string, number> = {
  hornsdale: 193.5,
  victorian_big_battery: 450.0,
  wallgrove: 75.0,
  lake_bonney: 52.0,
  gannawarra: 50.0,
  dalrymple_north: 8.0,
  wandoan: 150.0,
}
