"use client";

import React from "react";
import { SummaryMetrics, Region } from "@/lib/types";
import { Leaf, Zap, Activity, DollarSign, Cloud } from "lucide-react";

interface SummaryCardsProps {
  metrics: SummaryMetrics;
  region: Region;
}

export function SummaryCards({ metrics, region }: SummaryCardsProps) {
  const cards = [
    {
      title: "Renewables Share",
      value: `${metrics.renewablesPct}%`,
      subtext: "Solar, Wind, Hydro, Geo, Biomass",
      icon: Leaf,
      color: "text-emerald-400",
      bg: "from-emerald-950/40 to-slate-900 border-emerald-500/30",
    },
    {
      title: "Total Energy Generated",
      value: `${metrics.totalGenerationGWh.toLocaleString()} GWh`,
      subtext: `${region === "ALL" ? "Philippines" : region} Grid Output`,
      icon: Zap,
      color: "text-amber-400",
      bg: "from-amber-950/40 to-slate-900 border-amber-500/30",
    },
    {
      title: "Peak Demand",
      value: `${metrics.peakDemandMW.toLocaleString()} MW`,
      subtext: `Min: ${metrics.minDemandMW.toLocaleString()} MW`,
      icon: Activity,
      color: "text-blue-400",
      bg: "from-blue-950/40 to-slate-900 border-blue-500/30",
    },
    {
      title: "Avg Spot Price (WESM)",
      value: `₱${metrics.avgPricePHPMWh.toLocaleString()} /MWh`,
      subtext: `≈ ₱${(metrics.avgPricePHPMWh / 1000).toFixed(2)} /kWh wholesale`,
      icon: DollarSign,
      color: "text-rose-400",
      bg: "from-rose-950/40 to-slate-900 border-rose-500/30",
    },
    {
      title: "Emissions Intensity",
      value: `${metrics.emissionsIntensityGPerKWh} gCO₂/kWh`,
      subtext: `${(metrics.totalEmissionsTonnes / 1000).toFixed(1)}k tCO₂ total`,
      icon: Cloud,
      color: "text-purple-400",
      bg: "from-purple-950/40 to-slate-900 border-purple-500/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 my-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`bg-gradient-to-b ${c.bg} border p-3.5 rounded-xl shadow-sm transition hover:border-slate-600`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
                {c.title}
              </span>
              <Icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-xl font-bold text-slate-100 tracking-tight">{c.value}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400 truncate">{c.subtext}</p>
          </div>
        );
      })}
    </div>
  );
}

