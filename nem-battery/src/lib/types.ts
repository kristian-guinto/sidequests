// TypeScript types mirroring the DuckDB pipeline schema.

export interface BatteryMeta {
  name: string;
  region: string;
  mw: number | null;
  mwh: number | null;
}

/** One row from battery_revenue_interval — 5-minute granularity. */
export interface BatteryIntervalRow {
  settlement_date: string; // ISO datetime string from DuckDB
  battery_key: string;
  battery_name: string;
  region: string;
  discharge_mw: number;
  charge_mw: number;
  rrp: number;
  energy_revenue: number;
  energy_cost: number;
  total_fcas: number;
  net: number;
  raise6sec: number;
  raise60sec: number;
  raise5min: number;
  raisereg: number;
  lower6sec: number;
  lower60sec: number;
  lower5min: number;
  lowerreg: number;
}

/** One row from battery_revenue_daily — full-day aggregates. */
export interface BatteryDailyRow {
  date: string; // YYYY-MM-DD string from DuckDB
  battery_key: string;
  battery_name: string;
  region: string;
  interval_count: number;
  total_energy_revenue: number;
  total_energy_cost: number;
  net_energy: number;
  total_fcas_revenue: number;
  net: number;
  raise6sec: number;
  raise60sec: number;
  raise5min: number;
  raisereg: number;
  lower6sec: number;
  lower60sec: number;
  lower5min: number;
  lowerreg: number;
}

/** Static battery metadata (manually maintained in frontend). */
export const KNOWN_BATTERIES: Record<string, BatteryMeta> = {
  hornsdale: {
    name: "Hornsdale Power Reserve",
    region: "SA1",
    mw: 150.0,
    mwh: 193.5,
  },
  victorian_big_battery: {
    name: "Victorian Big Battery",
    region: "VIC1",
    mw: 300.0,
    mwh: 450.0,
  },
  wallgrove: {
    name: "Wallgrove BESS",
    region: "NSW1",
    mw: 50.0,
    mwh: 75.0,
  },
  lake_bonney: {
    name: "Lake Bonney BESS",
    region: "SA1",
    mw: 25.0,
    mwh: 52.0,
  },
  gannawarra: {
    name: "Gannawarra ESS",
    region: "VIC1",
    mw: 25.0,
    mwh: 50.0,
  },
  dalrymple_north: {
    name: "Dalrymple North BESS",
    region: "SA1",
    mw: 30.0,
    mwh: 8.0,
  },
  wandoan: {
    name: "Wandoan Power BESS",
    region: "QLD1",
    mw: 100.0,
    mwh: 150.0,
  },
  torrens_island: {
    name: "Torrens Island BESS",
    region: "SA1",
    mw: 250.0,
    mwh: 250.0,
  },
  blyth: {
    name: "Blyth BESS",
    region: "SA1",
    mw: 237.5,
    mwh: 477.0,
  },
  templers: {
    name: "Templers BESS",
    region: "SA1",
    mw: 138.0,
    mwh: 330.0,
  },
  capital_battery: {
    name: "Capital Battery",
    region: "NSW1",
    mw: 100.0,
    mwh: 200.0,
  },
  rangebank: {
    name: "Rangebank BESS",
    region: "VIC1",
    mw: 200.0,
    mwh: 400.0,
  },
  hazelwood: {
    name: "Hazelwood BESS",
    region: "VIC1",
    mw: 150.0,
    mwh: 150.0,
  },
  koorangie: {
    name: "Koorangie BESS",
    region: "VIC1",
    mw: 185.0,
    mwh: 370.0,
  },
  tarong: {
    name: "Tarong BESS",
    region: "QLD1",
    mw: 300.0,
    mwh: 600.0,
  },
  western_downs: {
    name: "Western Downs BESS",
    region: "QLD1",
    mw: 540.0,
    mwh: 1080.0,
  },
  greenbank: {
    name: "Greenbank BESS",
    region: "QLD1",
    mw: 200.0,
    mwh: 400.0,
  },
};

/** Analytics summary per battery — from /api/batteries/summary. */
export interface BatterySummaryRow {
  battery_key: string;
  total_revenue: number;
  avg_monthly_revenue: number;
  fcas_share_pct: number;
  /** Average daily revenue over days with recorded activity (excludes non-operating days). */
  avg_daily_revenue: number;
  sparkline: { month: string; net_energy: number; fcas: number }[];
  /** Dominant strategy cluster (most frequent cluster_id), or null if no embedding data. */
  dominant_cluster: number | null;
}

/** Monthly aggregate — from /api/batteries/[key]/monthly. */
export interface BatteryMonthlyRow {
  month: string; // "YYYY-MM"
  net_energy: number;
  total_fcas_revenue: number;
  net: number;
}

/** Per-battery stats — from /api/batteries/[key]/stats. */
export interface BatteryStatsRow {
  battery_key: string;
  total_revenue: number;
  last_30d_revenue: number;
  fcas_share_pct: number;
  best_day_revenue: number;
  avg_daily_revenue: number;
}

/** Mean feature values per cluster — from /api/strategy/cluster-summary. */
export interface ClusterSummaryRow {
  cluster_id: number;
  state_reversal_count: number;
  normalised_total_variation: number;
  utilization_factor: number;
  energy_price_pearson_correlation: number;
  energy_price_spearman_correlation: number;
  price_selectivity_index: number;
  fcas_revenue_share: number;
  reg_vs_contingency_ratio: number;
  revenue_diversity_index: number;
  co_optimization_frequency: number;
  evening_peak_weight: number;
  morning_peak_weight: number;
  solar_soak_charge_weight: number;
  overnight_charge_weight: number;
  negative_price_capture: number;
}

/** Oracle (perfect-hindsight) comparison row — from /api/batteries/[key]/oracle. */
export interface BatteryOracleRow {
  date: string; // YYYY-MM-DD
  actual: number;
  oracle: number;
  /** null when oracle = 0 (e.g. flat price day) */
  efficiency_pct: number | null;
}
