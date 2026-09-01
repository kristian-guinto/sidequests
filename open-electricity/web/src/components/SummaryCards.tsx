"use client";

import React from "react";
import { SummaryMetrics, Region } from "@/lib/types";
import { Leaf, Zap, Activity, DollarSign, Cloud } from "lucide-react";

interface SummaryCardsProps {
  metrics: SummaryMetrics;
  region: Region;
}

export function SummaryCards({ metrics, region }: SummaryCardsProps) {
  const symbol = metrics.currencySymbol || "₱";

  const cards = [
    {
      title: "Renewables Share",
      value: `${metrics.renewablesPct}%`,
      subtext: "Solar, Wind, Hydro, Geo, Biomass",
      icon: Leaf,
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
      accent: "text-emerald-600",
    },
    {
      title: "Energy Generated",
      value: `${metrics.totalGenerationGWh.toLocaleString()} GWh`,
      subtext: `${region} Total Output`,
      icon: Zap,
      iconBg: "bg-amber-50 text-amber-600 border-amber-200",
      accent: "text-slate-900",
    },
    {
      title: "Peak Demand",
      value: `${metrics.peakDemandMW.toLocaleString()} MW`,
      subtext: `Min: ${metrics.minDemandMW.toLocaleString()} MW`,
      icon: Activity,
      iconBg: "bg-blue-50 text-blue-600 border-blue-200",
      accent: "text-slate-900",
    },
    {
      title: "Avg Spot Price",
      value: `${symbol}${metrics.avgPricePHPMWh.toLocaleString()} /MWh`,
      subtext: `≈ ${symbol}${(metrics.avgPricePHPMWh / 1000).toFixed(2)} /kWh wholesale`,
      icon: DollarSign,
      iconBg: "bg-rose-50 text-rose-600 border-rose-200",
      accent: "text-slate-900",
    },
    {
      title: "Emissions Intensity",
      value: `${metrics.emissionsIntensityGPerKWh} g/kWh`,
      subtext: `${(metrics.totalEmissionsTonnes / 1000).toFixed(1)}k tCO₂ total`,
      icon: Cloud,
      iconBg: "bg-purple-50 text-purple-600 border-purple-200",
      accent: "text-slate-900",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 my-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="bg-white border border-slate-200/90 p-3.5 rounded-xl shadow-sm transition hover:shadow hover:border-slate-300"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {c.title}
              </span>
              <div className={`p-1.5 rounded-lg border text-xs ${c.iconBg}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className={`text-xl font-bold tracking-tight ${c.accent}`}>{c.value}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 truncate">{c.subtext}</p>
          </div>
        );
      })}
    </div>
  );
}
