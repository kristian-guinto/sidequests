import {
  FuelGenerationPoint,
  Region,
  CountryCode,
  TimeRange,
  TimeInterval,
  SummaryMetrics,
  FuelBreakdownRow,
  InterconnectorFlow,
  RANGE_CONFIG,
  COUNTRIES_METADATA,
} from "./types";
import { FUEL_META } from "./colors";

export function generateMockEnergyData(
  country: CountryCode = "PH",
  region: Region = "ALL",
  range: TimeRange = "7d",
  interval?: TimeInterval
): {
  points: FuelGenerationPoint[];
  summary: SummaryMetrics;
  breakdown: FuelBreakdownRow[];
  interconnectors: InterconnectorFlow[];
  unit: "MW" | "GWh";
} {
  const activeInterval = interval || RANGE_CONFIG[range]?.defaultInterval || "30m";
  const unit = RANGE_CONFIG[range]?.unit || "MW";
  const countryInfo = COUNTRIES_METADATA[country] || COUNTRIES_METADATA["PH"];

  let pointsCount = 288;
  let intervalMinutes = 5;

  if (range === "1d") {
    intervalMinutes = activeInterval === "30m" ? 30 : 5;
    pointsCount = activeInterval === "30m" ? 48 : 288;
  } else if (range === "3d") {
    intervalMinutes = activeInterval === "1h" ? 60 : 30;
    pointsCount = activeInterval === "1h" ? 72 : 144;
  } else if (range === "7d") {
    intervalMinutes = activeInterval === "1d" ? 1440 : activeInterval === "1h" ? 60 : 30;
    pointsCount = activeInterval === "1d" ? 7 : activeInterval === "1h" ? 168 : 336;
  } else if (range === "30d") {
    intervalMinutes = activeInterval === "1w" ? 10080 : 1440;
    pointsCount = activeInterval === "1w" ? 4 : 30;
  } else if (range === "1y") {
    intervalMinutes = activeInterval === "1M" ? 43200 : 10080;
    pointsCount = activeInterval === "1M" ? 12 : 52;
  }

  const now = new Date();
  const startTime = new Date(now.getTime() - pointsCount * intervalMinutes * 60 * 1000);

  // Country-specific baseload and peaks
  let baseDemand = 13500;
  let baseCoal = 7200;
  let baseGas = 2800;
  let baseGeo = 900;
  let baseHydro = 1100;
  let baseWind = 280;
  let peakSolar = 1800;
  let baseOil = 450;
  let baseBiomass = 150;
  let basePrice = 4200;

  if (country === "SG") {
    baseDemand = 7200;
    baseCoal = 0;
    baseGas = 6100;
    baseGeo = 0;
    baseHydro = 90;
    baseWind = 0;
    peakSolar = 850;
    baseOil = 0;
    baseBiomass = 110;
    basePrice = 145;
  } else if (country === "MY") {
    baseDemand = 18500;
    baseCoal = 7800;
    baseGas = 6200;
    baseGeo = 0;
    baseHydro = 2800;
    baseWind = 0;
    peakSolar = 1400;
    baseOil = 150;
    baseBiomass = 320;
    basePrice = 280;
  } else if (country === "TH") {
    baseDemand = 32000;
    baseCoal = 5800;
    baseGas = 17500;
    baseGeo = 0;
    baseHydro = 3500;
    baseWind = 900;
    peakSolar = 3200;
    baseOil = 200;
    baseBiomass = 1800;
    basePrice = 3800;
  } else if (country === "VN") {
    baseDemand = 44000;
    baseCoal = 17000;
    baseGas = 6500;
    baseGeo = 0;
    baseHydro = 13000;
    baseWind = 2500;
    peakSolar = 6500;
    baseOil = 300;
    baseBiomass = 600;
    basePrice = 2100;
  }

  const points: FuelGenerationPoint[] = [];
  let totalGenerationMWh = 0;
  let totalRenewableMWh = 0;
  let peakDemand = 0;
  let minDemand = Infinity;
  let priceSum = 0;
  let emissionsTonnesTotal = 0;

  const fuelEnergyMWh: Record<string, number> = {
    solar: 0,
    wind: 0,
    hydro: 0,
    geothermal: 0,
    biomass: 0,
    gas: 0,
    coal: 0,
    oil: 0,
    battery: 0,
  };

  const isDailyOrLonger = intervalMinutes >= 1440;

  for (let i = 0; i < pointsCount; i++) {
    const pointTime = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);
    const hour = isDailyOrLonger ? 12 : pointTime.getHours() + pointTime.getMinutes() / 60;

    let solarMW = 0;
    if (isDailyOrLonger) {
      solarMW = peakSolar * 0.32 * (0.85 + 0.3 * Math.sin(i / 5));
    } else if (hour >= 6 && hour <= 18) {
      const solarFactor = Math.sin(((hour - 6) / 12) * Math.PI);
      solarMW = peakSolar * Math.pow(solarFactor, 1.8) * (0.9 + Math.random() * 0.2);
    }

    const demandShape = isDailyOrLonger
      ? 0.85 + 0.12 * Math.sin((i / 7) * 2 * Math.PI)
      : 0.65 +
        0.22 * Math.sin(((hour - 4) / 24) * 2 * Math.PI) +
        0.15 * Math.exp(-Math.pow((hour - 14) / 3, 2)) +
        0.18 * Math.exp(-Math.pow((hour - 19.5) / 2.5, 2));

    const totalSystemDemandMW = baseDemand * demandShape * (0.98 + Math.random() * 0.04);
    peakDemand = Math.max(peakDemand, totalSystemDemandMW);
    minDemand = Math.min(minDemand, totalSystemDemandMW);

    const windMW = baseWind * (0.6 + 0.6 * Math.sin(i / 20 + 1.2));
    const geoMW = baseGeo * (0.95 + 0.08 * Math.random());
    const bioMW = baseBiomass * (0.9 + 0.1 * Math.random());
    const hydroMW = baseHydro * (0.6 + 0.8 * demandShape);
    const coalMW = baseCoal * (0.85 + 0.25 * demandShape);
    const gasMW = Math.max(0, totalSystemDemandMW - (solarMW + windMW + geoMW + bioMW + hydroMW + coalMW));
    const oilMW = isDailyOrLonger ? baseOil * 0.5 : hour >= 18 && hour <= 21 ? baseOil * 1.5 : baseOil * 0.3;
    const batteryMW = country === "SG" && hour >= 18 && hour <= 21 ? 60 : 0;

    const totalGenMW = solarMW + windMW + hydroMW + geoMW + bioMW + gasMW + coalMW + oilMW + batteryMW;
    const renGenMW = solarMW + windMW + hydroMW + geoMW + bioMW;
    const renPct = totalGenMW > 0 ? (renGenMW / totalGenMW) * 100 : 0;

    const price = Math.max(
      basePrice * 0.5,
      basePrice +
        (demandShape - 0.75) * basePrice * 0.7 +
        (!isDailyOrLonger && hour >= 18 && hour <= 21 ? basePrice * 0.3 : 0) +
        (Math.random() * basePrice * 0.1 - basePrice * 0.05)
    );
    priceSum += price;

    const intervalHours = intervalMinutes / 60;
    fuelEnergyMWh.solar += solarMW * intervalHours;
    fuelEnergyMWh.wind += windMW * intervalHours;
    fuelEnergyMWh.hydro += hydroMW * intervalHours;
    fuelEnergyMWh.geothermal += geoMW * intervalHours;
    fuelEnergyMWh.biomass += bioMW * intervalHours;
    fuelEnergyMWh.gas += gasMW * intervalHours;
    fuelEnergyMWh.coal += coalMW * intervalHours;
    fuelEnergyMWh.oil += oilMW * intervalHours;
    fuelEnergyMWh.battery += batteryMW * intervalHours;

    totalGenerationMWh += totalGenMW * intervalHours;
    totalRenewableMWh += renGenMW * intervalHours;
    emissionsTonnesTotal += (coalMW * 0.9 + gasMW * 0.38 + oilMW * 0.75) * intervalHours;

    const pointMultiplier = unit === "GWh" ? intervalHours / 1000 : 1;

    points.push({
      timestamp: pointTime.toISOString(),
      solar: Math.round(solarMW * pointMultiplier * 10) / 10,
      wind: Math.round(windMW * pointMultiplier * 10) / 10,
      hydro: Math.round(hydroMW * pointMultiplier * 10) / 10,
      geothermal: Math.round(geoMW * pointMultiplier * 10) / 10,
      biomass: Math.round(bioMW * pointMultiplier * 10) / 10,
      gas: Math.round(gasMW * pointMultiplier * 10) / 10,
      coal: Math.round(coalMW * pointMultiplier * 10) / 10,
      oil: Math.round(oilMW * pointMultiplier * 10) / 10,
      battery: Math.round(batteryMW * pointMultiplier * 10) / 10,
      demand: Math.round(totalSystemDemandMW * pointMultiplier * 10) / 10,
      price: Math.round(price * 10) / 10,
      totalGeneration: Math.round(totalGenMW * pointMultiplier * 10) / 10,
      renewablesPct: Math.round(renPct * 10) / 10,
    });
  }

  const avgPrice = Math.round(priceSum / pointsCount);
  const totalGenGWh = Math.round((totalGenerationMWh / 1000) * 10) / 10;
  const overallRenewablesPct = totalGenerationMWh > 0 ? Math.round((totalRenewableMWh / totalGenerationMWh) * 1000) / 10 : 0;
  const emissionsIntensity = totalGenerationMWh > 0 ? Math.round((emissionsTonnesTotal / totalGenerationMWh) * 1000) : 0;

  const summary: SummaryMetrics = {
    renewablesPct: overallRenewablesPct,
    totalGenerationGWh: totalGenGWh,
    peakDemandMW: Math.round(peakDemand),
    minDemandMW: Math.round(minDemand),
    avgPricePHPMWh: avgPrice,
    currencySymbol: countryInfo.currencySymbol,
    currencyCode: countryInfo.currencyCode,
    emissionsIntensityGPerKWh: emissionsIntensity,
    totalEmissionsTonnes: Math.round(emissionsTonnesTotal),
  };

  const breakdown: FuelBreakdownRow[] = Object.entries(fuelEnergyMWh)
    .map(([fuel, mwh]) => {
      const fuelKey = fuel as keyof typeof FUEL_META;
      const meta = FUEL_META[fuelKey] || { label: fuel, color: "#888888", isRenewable: false };
      const gwh = Math.round((mwh / 1000) * 100) / 100;
      const pct = totalGenerationMWh > 0 ? Math.round((mwh / totalGenerationMWh) * 1000) / 10 : 0;
      const latestPoint = points[points.length - 1];
      const currentVal = latestPoint ? (latestPoint[fuelKey as keyof FuelGenerationPoint] as number) : 0;
      const emFactor = fuel === "coal" ? 0.9 : fuel === "gas" ? 0.38 : fuel === "oil" ? 0.75 : 0.0;

      return {
        fuelTech: fuelKey,
        label: meta.label,
        color: meta.color,
        generationMW: currentVal,
        energyGWh: gwh,
        percentage: pct,
        isRenewable: meta.isRenewable,
        emissionsTonnes: Math.round(mwh * emFactor),
      };
    })
    .sort((a, b) => b.energyGWh - a.energyGWh);

  let interconnectors: InterconnectorFlow[] = [];
  if (country === "PH") {
    interconnectors = [
      { name: "Luzon - Visayas HVDC", fromRegion: "LUZON", toRegion: "VISAYAS", flowMW: 180, capacityMW: 440 },
      { name: "Mindanao - Visayas (MVIP)", fromRegion: "MINDANAO", toRegion: "VISAYAS", flowMW: 220, capacityMW: 450 },
    ];
  } else if (country === "SG") {
    interconnectors = [
      { name: "LTMS-PIP (Lao PDR Clean Hydro)", fromRegion: "LAOS/MY", toRegion: "SINGAPORE", flowMW: 85, capacityMW: 100 },
      { name: "Plentong - Woodlands Intertie", fromRegion: "MALAYSIA", toRegion: "SINGAPORE", flowMW: 0, capacityMW: 200 },
    ];
  } else if (country === "MY") {
    interconnectors = [
      { name: "Malaysia - Singapore Intertie", fromRegion: "PENINSULAR", toRegion: "SINGAPORE", flowMW: 85, capacityMW: 200 },
      { name: "EGAT - TNB HVDC (Thailand)", fromRegion: "THAILAND", toRegion: "PENINSULAR", flowMW: 120, capacityMW: 300 },
    ];
  }

  return { points, summary, breakdown, interconnectors, unit };
}
