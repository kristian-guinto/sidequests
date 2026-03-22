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

/** Static battery metadata generated from nem_battery/battery.py. */
export { KNOWN_BATTERIES } from "./known-batteries.generated";

/** Analytics summary per battery — from /api/batteries/summary. */
export interface BatterySummaryRow {
  battery_key: string;
  total_revenue: number;
  avg_monthly_revenue: number;
  fcas_share_pct: number;
  /** Average daily revenue over days with recorded activity (excludes non-operating days). */
  avg_daily_revenue: number;
  sparkline: { month: string; net_energy: number; fcas: number }[];
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

/** Oracle (perfect-hindsight) comparison row — from /api/batteries/[key]/oracle. */
export interface BatteryOracleRow {
  date: string; // YYYY-MM-DD
  actual: number;
  oracle: number;
  /** null when oracle = 0 (e.g. flat price day) */
  efficiency_pct: number | null;
}
