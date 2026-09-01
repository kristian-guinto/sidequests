export type CountryCode = "PH" | "SG" | "MY" | "TH" | "VN";

export interface CountryInfo {
  code: CountryCode;
  name: string;
  flag: string;
  currencyCode: string;
  currencySymbol: string;
  defaultRegion: string;
  regions: { id: string; label: string }[];
}

export const COUNTRIES_METADATA: Record<CountryCode, CountryInfo> = {
  PH: {
    code: "PH",
    name: "Philippines",
    flag: "🇵🇭",
    currencyCode: "PHP",
    currencySymbol: "₱",
    defaultRegion: "ALL",
    regions: [
      { id: "ALL", label: "All PH" },
      { id: "LUZON", label: "Luzon" },
      { id: "VISAYAS", label: "Visayas" },
      { id: "MINDANAO", label: "Mindanao" },
    ],
  },
  SG: {
    code: "SG",
    name: "Singapore",
    flag: "🇸🇬",
    currencyCode: "SGD",
    currencySymbol: "S$",
    defaultRegion: "SINGAPORE",
    regions: [{ id: "SINGAPORE", label: "National Grid" }],
  },
  MY: {
    code: "MY",
    name: "Malaysia",
    flag: "🇲🇾",
    currencyCode: "MYR",
    currencySymbol: "RM",
    defaultRegion: "PENINSULAR",
    regions: [
      { id: "PENINSULAR", label: "Peninsular" },
      { id: "SARAWAK", label: "Sarawak" },
      { id: "SABAH", label: "Sabah" },
    ],
  },
  TH: {
    code: "TH",
    name: "Thailand",
    flag: "🇹🇭",
    currencyCode: "THB",
    currencySymbol: "฿",
    defaultRegion: "THAILAND",
    regions: [
      { id: "THAILAND", label: "All Thailand" },
      { id: "CENTRAL", label: "Central" },
      { id: "NORTH", label: "North" },
      { id: "NORTHEAST", label: "Northeast" },
      { id: "SOUTH", label: "South" },
    ],
  },
  VN: {
    code: "VN",
    name: "Vietnam",
    flag: "🇻🇳",
    currencyCode: "VND",
    currencySymbol: "₫",
    defaultRegion: "VIETNAM",
    regions: [
      { id: "VIETNAM", label: "All Vietnam" },
      { id: "NORTH", label: "Northern" },
      { id: "CENTRAL", label: "Central" },
      { id: "SOUTH", label: "Southern" },
    ],
  },
};

export type Region = string;

export type TimeRange = "1d" | "3d" | "7d" | "30d" | "1y";

export type TimeInterval = "5m" | "30m" | "1h" | "1d" | "1w" | "1M";

export const RANGE_CONFIG: Record<
  TimeRange,
  {
    label: string;
    defaultInterval: TimeInterval;
    allowedIntervals: { id: TimeInterval; label: string }[];
    unit: "MW" | "GWh";
  }
> = {
  "1d": {
    label: "1D",
    defaultInterval: "5m",
    allowedIntervals: [
      { id: "5m", label: "5m" },
      { id: "30m", label: "30m" },
    ],
    unit: "MW",
  },
  "3d": {
    label: "3D",
    defaultInterval: "30m",
    allowedIntervals: [
      { id: "30m", label: "30m" },
      { id: "1h", label: "1h" },
    ],
    unit: "MW",
  },
  "7d": {
    label: "7D",
    defaultInterval: "30m",
    allowedIntervals: [
      { id: "30m", label: "30m" },
      { id: "1h", label: "1h" },
      { id: "1d", label: "1d" },
    ],
    unit: "MW",
  },
  "30d": {
    label: "30D",
    defaultInterval: "1d",
    allowedIntervals: [
      { id: "1d", label: "1d" },
      { id: "1w", label: "1w" },
    ],
    unit: "GWh",
  },
  "1y": {
    label: "1Y",
    defaultInterval: "1w",
    allowedIntervals: [
      { id: "1w", label: "1w" },
      { id: "1M", label: "1M" },
    ],
    unit: "GWh",
  },
};

export type ViewMode = "stacked" | "percentage" | "cumulative" | "discrete";

export type FuelTech =
  | "solar"
  | "wind"
  | "hydro"
  | "geothermal"
  | "biomass"
  | "gas"
  | "coal"
  | "oil"
  | "battery";

export interface FuelGenerationPoint {
  timestamp: string;
  solar: number;
  wind: number;
  hydro: number;
  geothermal: number;
  biomass: number;
  gas: number;
  coal: number;
  oil: number;
  battery: number;
  demand?: number;
  price?: number;
  totalGeneration?: number;
  renewablesPct?: number;
}

export interface SummaryMetrics {
  renewablesPct: number;
  totalGenerationGWh: number;
  peakDemandMW: number;
  minDemandMW: number;
  avgPricePHPMWh: number;
  currencySymbol?: string;
  currencyCode?: string;
  emissionsIntensityGPerKWh: number;
  totalEmissionsTonnes: number;
}

export interface FuelBreakdownRow {
  fuelTech: FuelTech;
  label: string;
  color: string;
  generationMW: number;
  energyGWh: number;
  percentage: number;
  isRenewable: boolean;
  emissionsTonnes: number;
}

export interface Facility {
  country_code?: string;
  resource_id: string;
  facility_name: string;
  region: string;
  fuel_tech: FuelTech;
  capacity_mw: number;
  is_renewable: boolean;
  emissions_factor: number;
  status: string;
}

export interface InterconnectorFlow {
  name: string;
  fromRegion: string;
  toRegion: string;
  flowMW: number;
  capacityMW: number;
}
