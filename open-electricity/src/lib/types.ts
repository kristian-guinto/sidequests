export type CountryCode = "PH" | "SG" | "MY" | "TH" | "VN" | "ID";

export interface CountryInfo {
  code: CountryCode;
  name: string;
  flag: string;
  currencyCode: string;
  currencySymbol: string;
  defaultRegion: string;
  regions: { id: string; label: string }[];
  hasLivePipeline?: boolean;
  unavailableReason?: string;
  gridOperator?: string;
  installedCapacityGw?: string;
}

export const COUNTRIES_METADATA: Record<CountryCode, CountryInfo> = {
  PH: {
    code: "PH",
    name: "Philippines",
    flag: "🇵🇭",
    currencyCode: "PHP",
    currencySymbol: "₱",
    defaultRegion: "ALL",
    hasLivePipeline: true,
    gridOperator: "IEMOP",
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
    hasLivePipeline: true,
    gridOperator: "EMA / EMC",
    regions: [{ id: "SINGAPORE", label: "National Grid" }],
  },
  MY: {
    code: "MY",
    name: "Malaysia",
    flag: "🇲🇾",
    currencyCode: "MYR",
    currencySymbol: "RM",
    defaultRegion: "PENINSULAR",
    hasLivePipeline: true,
    gridOperator: "Single Buyer / GSO",
    regions: [{ id: "PENINSULAR", label: "Peninsular" }],
  },
  TH: {
    code: "TH",
    name: "Thailand",
    flag: "🇹🇭",
    currencyCode: "THB",
    currencySymbol: "฿",
    defaultRegion: "THAILAND",
    hasLivePipeline: true,
    gridOperator: "EGAT / SO Thailand",
    regions: [
      { id: "THAILAND", label: "All Thailand" },
    ],
  },
  VN: {
    code: "VN",
    name: "Vietnam",
    flag: "🇻🇳",
    currencyCode: "VND",
    currencySymbol: "₫",
    defaultRegion: "VIETNAM",
    hasLivePipeline: false,
    gridOperator: "EVN / NSMO",
    installedCapacityGw: "~80 GW",
    unavailableReason:
      "EVN and NSMO restrict real-time dispatch and market telemetry behind policy firewalls. No open public SCADA API is currently published.",
    regions: [
      { id: "VIETNAM", label: "All Vietnam" },
      { id: "NORTH", label: "Northern" },
      { id: "CENTRAL", label: "Central" },
      { id: "SOUTH", label: "Southern" },
    ],
  },
  ID: {
    code: "ID",
    name: "Indonesia",
    flag: "🇮🇩",
    currencyCode: "IDR",
    currencySymbol: "Rp",
    defaultRegion: "ALL",
    hasLivePipeline: false,
    gridOperator: "PT PLN (Persero)",
    installedCapacityGw: "~73 GW",
    unavailableReason:
      "PLN P2B SCADA operates on closed critical national infrastructure networks. No public real-time grid API is available.",
    regions: [
      { id: "ALL", label: "All Indonesia" },
      { id: "JAVA_BALI", label: "Java-Bali" },
      { id: "SUMATRA", label: "Sumatra" },
      { id: "KALIMANTAN", label: "Kalimantan" },
      { id: "SULAWESI", label: "Sulawesi" },
      { id: "EASTERN", label: "Eastern Indonesia" },
    ],
  },
};

export type Region = string;

export type TimeRange = "1d" | "3d" | "7d" | "30d" | "1y";

export type TimeInterval = "5m" | "30m" | "1h" | "1d" | "1w" | "1m" | "1M";

export const RANGE_CONFIG: Record<
  TimeRange,
  {
    label: string;
    unit: "MW" | "GWh";
  }
> = {
  "1d": {
    label: "1D",
    unit: "MW",
  },
  "3d": {
    label: "3D",
    unit: "MW",
  },
  "7d": {
    label: "7D",
    unit: "MW",
  },
  "30d": {
    label: "30D",
    unit: "GWh",
  },
  "1y": {
    label: "1Y",
    unit: "GWh",
  },
};

export type ViewMode = "stacked" | "percentage" | "cumulative" | "discrete";

export type PaletteMode = "detailed" | "clean-fossil";

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
  solar: number | null;
  wind: number | null;
  hydro: number | null;
  geothermal: number | null;
  biomass: number | null;
  gas: number | null;
  coal: number | null;
  oil: number | null;
  battery: number | null;
  price?: number | null;
  priceDollar?: number | null;
  totalGeneration?: number | null;
  renewablesPct?: number | null;
  hasData?: boolean;
}

export interface SummaryMetrics {
  renewablesPct: number;
  totalGenerationGWh: number;
  peakGenerationMW: number;
  avgPriceLocal: number;
  avgPriceUSD?: number;
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
