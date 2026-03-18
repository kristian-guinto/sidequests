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

/** Static battery metadata (mirrored from nem_battery/battery.py). */
export const KNOWN_BATTERIES: Record<string, BatteryMeta> = {
  hornsdale: {
    name: "Hornsdale Power Reserve",
    region: "SA1",
    mw: 150,
    mwh: 193.5,
  },
  victorian_big_battery: {
    name: "Victorian Big Battery",
    region: "VIC1",
    mw: 300,
    mwh: 450,
  },
  wallgrove: { name: "Wallgrove BESS", region: "NSW1", mw: 50, mwh: 75 },
  lake_bonney: {
    name: "Lake Bonney BESS",
    region: "SA1",
    mw: 25,
    mwh: 52,
  },
  gannawarra: {
    name: "Gannawarra ESS",
    region: "VIC1",
    mw: 25,
    mwh: 50,
  },
  dalrymple_north: {
    name: "Dalrymple North BESS",
    region: "SA1",
    mw: 30,
    mwh: 8,
  },
  wandoan: {
    name: "Wandoan Power BESS",
    region: "QLD1",
    mw: 100,
    mwh: 150,
  },
};
