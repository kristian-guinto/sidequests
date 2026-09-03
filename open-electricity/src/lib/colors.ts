import { FuelTech, PaletteMode } from "./types";

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

export const CLEAN_FOSSIL_DARK_META: Record<FuelTech, FuelMeta> = {
  // Clean Energy - Coordinated Luminous Green Shades (Top Canopy)
  solar: {
    label: "Solar",
    color: "#86EFAC", // Light Lime / Sunlit Mint
    isRenewable: true,
    order: 1,
  },
  wind: {
    label: "Wind",
    color: "#4ADE80", // Crisp Emerald Mint
    isRenewable: true,
    order: 2,
  },
  hydro: {
    label: "Hydro",
    color: "#22C55E", // Vivid Emerald Green
    isRenewable: true,
    order: 3,
  },
  battery: {
    label: "Battery (Discharging)",
    color: "#16A34A", // Pure Grass Green
    isRenewable: true,
    order: 4,
  },
  geothermal: {
    label: "Geothermal",
    color: "#15803D", // Deep Forest Green
    isRenewable: true,
    order: 5,
  },
  biomass: {
    label: "Bioenergy",
    color: "#14532D", // Earthy Moss Green
    isRenewable: true,
    order: 6,
  },
  // Fossil Energy - Coordinated Dark Charcoal / Slate Shades (Base Foundation)
  gas: {
    label: "Gas",
    color: "#52525B", // Slate Gray (Zinc 600)
    isRenewable: false,
    order: 7,
  },
  oil: {
    label: "Distillate",
    color: "#3F3F46", // Dark Slate (Zinc 700)
    isRenewable: false,
    order: 8,
  },
  coal: {
    label: "Coal",
    color: "#18181B", // Deep Carbon Charcoal (Zinc 900)
    isRenewable: false,
    order: 9,
  },
};

export const CLEAN_FOSSIL_LIGHT_META: Record<FuelTech, FuelMeta> = {
  // Clean Energy - Richer Greens for Light Background
  solar: {
    label: "Solar",
    color: "#34D399",
    isRenewable: true,
    order: 1,
  },
  wind: {
    label: "Wind",
    color: "#10B981",
    isRenewable: true,
    order: 2,
  },
  hydro: {
    label: "Hydro",
    color: "#059669",
    isRenewable: true,
    order: 3,
  },
  battery: {
    label: "Battery (Discharging)",
    color: "#047857",
    isRenewable: true,
    order: 4,
  },
  geothermal: {
    label: "Geothermal",
    color: "#065F46",
    isRenewable: true,
    order: 5,
  },
  biomass: {
    label: "Bioenergy",
    color: "#064E3B",
    isRenewable: true,
    order: 6,
  },
  // Fossil Energy - Charcoal / Slate on Light
  gas: {
    label: "Gas",
    color: "#64748B",
    isRenewable: false,
    order: 7,
  },
  oil: {
    label: "Distillate",
    color: "#475569",
    isRenewable: false,
    order: 8,
  },
  coal: {
    label: "Coal",
    color: "#1E293B",
    isRenewable: false,
    order: 9,
  },
};

export function getFuelMeta(
  fuel: FuelTech,
  isDark: boolean = true,
  paletteMode: PaletteMode = "detailed"
): FuelMeta {
  if (paletteMode === "clean-fossil") {
    return isDark ? CLEAN_FOSSIL_DARK_META[fuel] : CLEAN_FOSSIL_LIGHT_META[fuel];
  }
  return isDark ? DARK_FUEL_META[fuel] : LIGHT_FUEL_META[fuel];
}

// Default export uses dark-calibrated palette
export const FUEL_META = DARK_FUEL_META;
