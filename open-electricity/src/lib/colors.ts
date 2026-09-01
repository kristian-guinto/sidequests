import { FuelTech } from "./types";

export interface FuelMeta {
  label: string;
  color: string;
  isRenewable: boolean;
  order: number;
}

export const LIGHT_FUEL_META: Record<FuelTech, FuelMeta> = {
  solar: {
    label: "Solar",
    color: "#FED130", // OpenElectricity Solar Yellow
    isRenewable: true,
    order: 1,
  },
  wind: {
    label: "Wind",
    color: "#417505", // OpenElectricity Wind Green
    isRenewable: true,
    order: 2,
  },
  hydro: {
    label: "Hydro",
    color: "#4582EC", // OpenElectricity Hydro Blue
    isRenewable: true,
    order: 3,
  },
  geothermal: {
    label: "Geothermal",
    color: "#E91E63", // OpenElectricity Geothermal Ruby
    isRenewable: true,
    order: 4,
  },
  biomass: {
    label: "Bioenergy",
    color: "#16A34A", // OpenElectricity Bioenergy Green
    isRenewable: true,
    order: 5,
  },
  gas: {
    label: "Gas",
    color: "#F98825", // OpenElectricity Gas Orange
    isRenewable: false,
    order: 6,
  },
  oil: {
    label: "Distillate",
    color: "#E11D48", // OpenElectricity Distillate Red
    isRenewable: false,
    order: 7,
  },
  coal: {
    label: "Coal",
    color: "#18181B", // OpenElectricity Black Coal
    isRenewable: false,
    order: 8,
  },
  battery: {
    label: "Battery (Discharging)",
    color: "#6366F1", // OpenElectricity Battery Purple
    isRenewable: true,
    order: 9,
  },
};

export const DARK_FUEL_META: Record<FuelTech, FuelMeta> = {
  solar: {
    label: "Solar",
    color: "#FED130", // Radiant Gold Yellow
    isRenewable: true,
    order: 1,
  },
  wind: {
    label: "Wind",
    color: "#4ADE80", // Crisp Emerald Green
    isRenewable: true,
    order: 2,
  },
  hydro: {
    label: "Hydro",
    color: "#60A5FA", // Electric Cobalt Blue
    isRenewable: true,
    order: 3,
  },
  geothermal: {
    label: "Geothermal",
    color: "#F43F5E", // Neon Ruby Pink
    isRenewable: true,
    order: 4,
  },
  biomass: {
    label: "Bioenergy",
    color: "#22C55E", // Vivid Forest Green
    isRenewable: true,
    order: 5,
  },
  gas: {
    label: "Gas",
    color: "#FB923C", // Warm Amber Orange
    isRenewable: false,
    order: 6,
  },
  oil: {
    label: "Distillate",
    color: "#FDA4AF", // Peaker Crimson / Coral
    isRenewable: false,
    order: 7,
  },
  coal: {
    label: "Coal",
    color: "#27272A", // Elevated Slate Charcoal (Zinc 800) visible on Pure Black
    isRenewable: false,
    order: 8,
  },
  battery: {
    label: "Battery (Discharging)",
    color: "#818CF8", // Electric Indigo Purple
    isRenewable: true,
    order: 9,
  },
};

export function getFuelMeta(fuel: FuelTech, isDark: boolean = true): FuelMeta {
  return isDark ? DARK_FUEL_META[fuel] : LIGHT_FUEL_META[fuel];
}

// Default export uses dark-calibrated palette
export const FUEL_META = DARK_FUEL_META;
