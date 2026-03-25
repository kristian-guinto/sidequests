/**
 * A single point in 2D strategy space — one battery, one day.
 *
 * Schema (DuckDB table `battery_strategy_embedding_2d`):
 *   trading_day DATE        -- the trading day
 *   battery_key VARCHAR     -- e.g. "hornsdale"
 *   x           DOUBLE      -- UMAP dim 1
 *   y           DOUBLE      -- UMAP dim 2
 *   daily_revenue DOUBLE    -- net AUD for the day
 *   cluster_id  INTEGER     -- 0-indexed cluster label from KMeans
 */
export interface StrategyPoint {
  id: string           // `${battery_key}_${date}` — synthetic join key
  battery_key: string
  date: string         // YYYY-MM-DD
  x: number
  y: number
  daily_revenue: number   // AUD
  cluster_id: number
}

export const BATTERY_COLORS: Record<string, string> = {
  hornsdale: "#fb923c",
  victorian_big_battery: "#60a5fa",
  wallgrove: "#4ade80",
  lake_bonney: "#c084fc",
  gannawarra: "#f472b6",
  dalrymple_north: "#2dd4bf",
  wandoan: "#facc15",
  torrens_island: "#ef4444",
  blyth: "#7c3aed",
  templers: "#059669",
  capital_battery: "#b45309",
  rangebank: "#4f46e5",
  hazelwood: "#be185d",
  koorangie: "#0891b2",
  tarong: "#65a30d",
  western_downs: "#78716c",
  greenbank: "#0ea5e9",
}

/** One color per cluster — exact colours from the interval chart. */
export const CLUSTER_COLORS = [
  "rgb(34 197 94)",   // green-500 — Cluster 0: Smart Profit Maximiser
  "rgb(239 68 68)",   // red-500   — Cluster 1: Cheap Energy Buyer
  "rgb(99 102 241)",  // indigo-500— Cluster 2: Grid Stabiliser
]

/** Short display names for the 3 clusters, as interpreted in cluster-analysis.ipynb. */
export const CLUSTER_NAMES = [
  "Smart Profit Maximiser",
  "Cheap Energy Buyer",
  "Grid Stabiliser",
]

export interface ClusterDescription {
  name: string
  color: string
  tagline: string
  traits: string[]
}

/**
 * Rich descriptions for each cluster, derived from KMeans analysis.
 * Index matches cluster_id (0, 1, 2).
 */
export const CLUSTER_DESCRIPTIONS: ClusterDescription[] = [
  {
    name: "Smart Profit Maximiser",
    color: CLUSTER_COLORS[0],
    tagline:
      "Actively optimises across both energy and FCAS to maximise total revenue using precise, highly selective dispatch decisions.",
    traits: [
      "Dispatches selectively — high price correlation means it targets the best intervals",
      "Strongest evening peak discharge (17:00–21:00) and solar-hour charging (10:00–15:00)",
      "Co-optimises energy and regulation FCAS simultaneously most often",
      "Smooth, sustained operation with the highest utilisation factor",
    ],
  },
  {
    name: "Cheap Energy Buyer",
    color: CLUSTER_COLORS[1],
    tagline:
      "Simple energy arbitrage focused on charging during negative or very low price periods, with minimal FCAS participation.",
    traits: [
      "Specialises in negative-price charging — earns money by absorbing surplus generation",
      "Lowest FCAS revenue share — almost entirely energy-driven revenue",
      "Charges overnight and through the solar soak window",
      "More rule-based operation; less dynamic interval-to-interval dispatch",
    ],
  },
  {
    name: "Grid Stabiliser",
    color: CLUSTER_COLORS[2],
    tagline:
      "Prioritises FCAS and grid support services over energy arbitrage, reserving capacity to respond to system frequency events.",
    traits: [
      "Highest normalised output variation — rapid, frequent MW changes for AGC signals",
      "Highest state-reversal count — charge/discharge transitions far exceed other clusters",
      "Largest FCAS revenue share with a diverse mix of raise and lower services",
      "Weaker price-tracking correlation — energy dispatch is secondary to ancillary obligations",
    ],
  },
]

export interface FeatureGroup {
  label: string
  features: string[]
}

/**
 * The 15 features fed into the UMAP algorithm, grouped by theme.
 * Used in the methodology explanation section.
 */
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    label: "Operational Complexity",
    features: [
      "State reversal count — charge/discharge/idle transitions per day",
      "Normalised total variation — MW \"choppiness\" relative to total output",
      "Utilisation factor — fraction of intervals with non-zero dispatch",
    ],
  },
  {
    label: "Market Reactivity",
    features: [
      "Energy/price Pearson correlation — linear tracking of spot price",
      "Energy/price Spearman correlation — rank-based price responsiveness",
      "Price selectivity index — spread between export and import average prices",
      "Negative-price capture — average charge rate during sub-zero price intervals",
    ],
  },
  {
    label: "Value Stacking",
    features: [
      "FCAS revenue share — fraction of daily revenue from ancillary services",
      "Reg vs contingency ratio — regulatory FCAS dominance within FCAS mix",
      "Revenue diversity index — Shannon entropy across 5 revenue streams",
      "Co-optimisation frequency — intervals with both energy and FCAS active",
    ],
  },
  {
    label: "Temporal Strategy",
    features: [
      "Evening peak weight — discharge fraction between 17:00–21:00",
      "Morning peak weight — discharge fraction between 06:00–09:00",
      "Solar soak charge weight — charge fraction between 10:00–15:00",
      "Overnight charge weight — charge fraction between 00:00–04:00",
    ],
  },
]
