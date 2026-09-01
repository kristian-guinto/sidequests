"use client";

import React, { useState, useMemo } from "react";
import {
  FuelBreakdownRow,
  FuelGenerationPoint,
  SummaryMetrics,
  InterconnectorFlow,
  FuelTech,
} from "@/lib/types";
import { getFuelMeta } from "@/lib/colors";
import { ChevronDown, PieChart as PieIcon, List, Globe, Zap, CloudFog, TrendingUp } from "lucide-react";
import ReactECharts from "echarts-for-react";
import { format, parseISO } from "date-fns";
import { useTheme } from "@/components/ThemeProvider";

interface DataSidebarProps {
  breakdown: FuelBreakdownRow[];
  summary: SummaryMetrics | null;
  interconnectors: InterconnectorFlow[];
  hoveredPoint: FuelGenerationPoint | null;
  timeSpan?: { start: string; end: string };
  currencySymbol?: string;
  currencyCode?: string;
  unit?: "MW" | "GWh";
}

const FUEL_DISPLAY_ORDER: FuelTech[] = [
  "solar",
  "wind",
  "hydro",
  "battery",
  "gas",
  "oil",
  "biomass",
  "geothermal",
  "coal",
];

export function DataSidebar({
  breakdown,
  summary,
  interconnectors,
  hoveredPoint,
  timeSpan,
  currencySymbol = "₱",
  currencyCode = "PHP",
  unit = "MW",
}: DataSidebarProps) {
  const { isDark } = useTheme();
  const [activeView, setActiveView] = useState<"table" | "donut">("table");

  const isHovered = hoveredPoint !== null;

  // Format header time text
  const formattedTimeHeader = useMemo(() => {
    if (isHovered && hoveredPoint?.timestamp) {
      try {
        const d = parseISO(hoveredPoint.timestamp);
        return format(d, "d MMM yyyy, h:mm a");
      } catch {
        return hoveredPoint.timestamp;
      }
    }
    if (timeSpan?.start && timeSpan?.end) {
      try {
        const s = parseISO(timeSpan.start);
        const e = parseISO(timeSpan.end);
        return `${format(s, "d MMM yyyy")} – ${format(e, "d MMM yyyy")}`;
      } catch {
        return "Live Selected Range";
      }
    }
    return "Summary (Total Range)";
  }, [isHovered, hoveredPoint, timeSpan]);

  // Compute table rows based on hover or aggregate
  const tableData = useMemo(() => {
    if (isHovered && hoveredPoint) {
      const pt = hoveredPoint;
      const totalGen = pt.totalGeneration || 1;
      const ptPrice = pt.price || summary?.avgPricePHPMWh || 0;
      const demandVal = pt.demand || 0;

      // Calculate emissions for point in time (5-minute interval)
      const coalT = (pt.coal || 0) * (5.0 / 60.0) * 0.9;
      const gasT = (pt.gas || 0) * (5.0 / 60.0) * 0.38;
      const oilT = (pt.oil || 0) * (5.0 / 60.0) * 0.75;
      const totalEmissionsT = coalT + gasT + oilT;

      const rows = FUEL_DISPLAY_ORDER.map((fKey) => {
        const meta = getFuelMeta(fKey, isDark);
        const val = Number((pt as any)[fKey]) || 0;
        const pct = totalGen > 0 ? (val / totalGen) * 100 : 0;
        return {
          fuelTech: fKey,
          label: meta.label,
          color: meta.color,
          valueDisplay: `${val.toLocaleString()} MW`,
          rawVal: val,
          pct: pct,
          priceDisplay: `${currencySymbol}${Math.round(ptPrice).toLocaleString()}`,
          isRenewable: meta.isRenewable,
        };
      });

      let renVal = 0;
      rows.forEach((r) => {
        if (r.isRenewable) renVal += r.rawVal;
      });
      const renPct = totalGen > 0 ? (renVal / totalGen) * 100 : 0;

      return {
        rows,
        totalDisplay: `${Math.round(totalGen).toLocaleString()} MW`,
        renValDisplay: `${Math.round(renVal).toLocaleString()} MW`,
        renPctDisplay: `${renPct.toFixed(1)}%`,
        priceDisplay: `${currencySymbol}${Math.round(ptPrice).toLocaleString()}`,
        emissionsDisplay: `${totalEmissionsT.toFixed(1)} tCO₂e`,
        demandDisplay: demandVal > 0 ? `${Math.round(demandVal).toLocaleString()} MW` : null,
        columnUnit: "Power",
        unitSub: "MW",
      };
    } else {
      const isEnergy = unit === "GWh";
      const totalGWh = summary?.totalGenerationGWh || 0;
      const avgPrice = summary?.avgPricePHPMWh || 0;
      const totalEmissions = summary?.totalEmissionsTonnes || 0;
      const peakDemand = summary?.peakDemandMW || 0;

      const rows = FUEL_DISPLAY_ORDER.map((fKey) => {
        const meta = getFuelMeta(fKey, isDark);
        const b = breakdown.find((item) => item.fuelTech === fKey);
        const gwh = b?.energyGWh || 0;
        const mw = b?.generationMW || 0;
        const pct = b?.percentage || 0;
        const price = avgPrice;

        return {
          fuelTech: fKey,
          label: meta.label,
          color: meta.color,
          valueDisplay: isEnergy
            ? `${gwh.toFixed(1)} GWh`
            : `${Math.round(mw).toLocaleString()} MW`,
          rawVal: isEnergy ? gwh : mw,
          pct: pct,
          priceDisplay: `${currencySymbol}${Math.round(price).toLocaleString()}`,
          isRenewable: meta.isRenewable,
        };
      });

      let renVal = 0;
      rows.forEach((r) => {
        if (r.isRenewable) renVal += r.rawVal;
      });
      const renPct = summary?.renewablesPct || 0;

      return {
        rows,
        totalDisplay: isEnergy
          ? `${totalGWh.toFixed(1)} GWh`
          : `${Math.round(
              rows.reduce((acc, r) => acc + (isEnergy ? 0 : r.rawVal), 0)
            ).toLocaleString()} MW`,
        renValDisplay: isEnergy
          ? `${renVal.toFixed(1)} GWh`
          : `${Math.round(renVal).toLocaleString()} MW`,
        renPctDisplay: `${renPct.toFixed(1)}%`,
        priceDisplay: `${currencySymbol}${Math.round(avgPrice).toLocaleString()}`,
        emissionsDisplay: totalEmissions > 0 ? `${Math.round(totalEmissions).toLocaleString()} tCO₂e` : null,
        demandDisplay: peakDemand > 0 ? `Peak ${Math.round(peakDemand).toLocaleString()} MW` : null,
        columnUnit: isEnergy ? "Energy" : "Power",
        unitSub: isEnergy ? "GWh" : "MW",
      };
    }
  }, [isHovered, hoveredPoint, breakdown, summary, currencySymbol, unit, isDark]);

  // Donut chart option
  const donutOption = useMemo(() => {
    const dataItems = tableData.rows
      .filter((r) => r.rawVal > 0)
      .map((r) => ({
        name: r.label,
        value: Math.round(r.rawVal * 10) / 10,
        itemStyle: { color: r.color },
      }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: isDark ? "rgba(15, 15, 18, 0.96)" : "rgba(255, 255, 255, 0.96)",
        borderColor: isDark ? "#27272A" : "rgba(226, 232, 240, 0.8)",
        textStyle: { color: isDark ? "#F8FAFC" : "#0F172A", fontSize: 11 },
        formatter: "{b}: {c} ({d}%)",
      },
      series: [
        {
          type: "pie",
          radius: ["48%", "72%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: "bold",
              color: isDark ? "#F8FAFC" : "#0F172A",
            },
          },
          data: dataItems,
        },
      ],
    };
  }, [tableData, isDark]);

  return (
    <aside className="bg-white dark:bg-[#09090B] border border-neutral-200 dark:border-[#27272A] rounded-xl flex flex-col h-full text-neutral-800 dark:text-neutral-200 text-xs shadow-sm transition-all overflow-hidden">
      {/* Sidebar Header: Date range / Hovered Time display */}
      <div className="p-3 border-b border-neutral-100 dark:border-[#27272A] flex items-center justify-between bg-neutral-50/60 dark:bg-[#121215]/80">
        <div className="flex flex-col">
          <span className="font-semibold text-neutral-900 dark:text-white text-xs sm:text-[13px] truncate max-w-[240px]">
            {formattedTimeHeader}
          </span>
        </div>

        {/* Toggle between Table & Donut */}
        <div className="flex items-center border border-neutral-200 dark:border-[#27272A] rounded p-0.5 bg-white dark:bg-[#121215]">
          <button
            onClick={() => setActiveView("table")}
            className={`p-1 rounded transition ${
              activeView === "table"
                ? "bg-neutral-100 dark:bg-[#27272A] text-neutral-900 dark:text-white font-bold"
                : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            }`}
            title="Table View"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setActiveView("donut")}
            className={`p-1 rounded transition ${
              activeView === "donut"
                ? "bg-neutral-100 dark:bg-[#27272A] text-neutral-900 dark:text-white font-bold"
                : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            }`}
            title="Donut Chart View"
          >
            <PieIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {activeView === "table" ? (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-[#27272A] text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-[#121215]/50">
                <th className="py-2 px-3">
                  <div className="flex items-center space-x-1 cursor-pointer">
                    <span>Detailed</span>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-2 px-2 text-right font-mono">
                  {tableData.columnUnit}
                  <br />
                  <span className="font-normal text-[10px] text-neutral-400 dark:text-neutral-500">
                    {tableData.unitSub}
                  </span>
                </th>
                <th className="py-2 px-2 text-right font-mono">
                  Contrib.
                  <br />
                  <span className="font-normal text-[10px] text-neutral-400 dark:text-neutral-500">%</span>
                </th>
                <th className="py-2 px-3 text-right font-mono">
                  {isHovered ? "Spot Price" : "Av. Value"}
                  <br />
                  <span className="font-normal text-[10px] text-neutral-400 dark:text-neutral-500">
                    {currencySymbol}/MWh
                  </span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100 dark:divide-[#27272A]/70 text-neutral-800 dark:text-neutral-200">
              {/* Sources Section Header */}
              <tr className="bg-neutral-50/80 dark:bg-[#18181B]/80 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                <td colSpan={4} className="py-1 px-3">
                  Sources
                </td>
              </tr>

              {tableData.rows.map((row) => (
                <tr
                  key={row.fuelTech}
                  className={`hover:bg-neutral-50/90 dark:hover:bg-[#18181B]/70 transition-colors group cursor-default ${
                    row.rawVal === 0 ? "opacity-40" : ""
                  }`}
                >
                  <td className="py-1.5 px-3 flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 text-[11px] group-hover:text-neutral-950 dark:group-hover:text-white">
                      {row.label}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-medium text-[11px] text-neutral-900 dark:text-neutral-100">
                    {row.valueDisplay}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                    {row.pct.toFixed(1)}%
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                    {row.priceDisplay}
                  </td>
                </tr>
              ))}

              {/* Summary Totals: Net Generation */}
              <tr className="border-t-2 border-neutral-200 dark:border-[#27272A] bg-neutral-50/40 dark:bg-[#121215]/50 font-bold text-neutral-900 dark:text-white">
                <td className="py-2 px-3 text-[11px] flex items-center space-x-1.5">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span>Net {isHovered ? "Power" : "Generation"}</span>
                </td>
                <td className="py-2 px-2 text-right font-mono text-[11px]">
                  {tableData.totalDisplay}
                </td>
                <td className="py-2 px-2 text-right font-mono text-[11px]">100%</td>
                <td className="py-2 px-3 text-right font-mono text-[11px]">
                  {tableData.priceDisplay}
                </td>
              </tr>

              {/* Renewables Row */}
              <tr className="bg-emerald-50/30 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-300 font-bold">
                <td className="py-2 px-3 text-[11px] flex items-center space-x-1.5">
                  <span className="text-emerald-500 font-normal">—</span>
                  <span>Renewables</span>
                </td>
                <td className="py-2 px-2 text-right font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                  {tableData.renValDisplay}
                </td>
                <td className="py-2 px-2 text-right font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                  {tableData.renPctDisplay}
                </td>
                <td className="py-2 px-3 text-right font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                  {tableData.priceDisplay}
                </td>
              </tr>

              {/* Emissions Row */}
              {tableData.emissionsDisplay && (
                <tr className="bg-neutral-50/20 dark:bg-[#121215]/30 text-neutral-700 dark:text-neutral-300 font-medium">
                  <td className="py-1.5 px-3 text-[11px] flex items-center space-x-1.5">
                    <CloudFog className="h-3 w-3 text-neutral-400" />
                    <span>Emissions</span>
                  </td>
                  <td colSpan={2} className="py-1.5 px-2 text-right font-mono text-[11px] text-neutral-800 dark:text-neutral-200">
                    {tableData.emissionsDisplay}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                    {isHovered ? "Interval" : "Total Period"}
                  </td>
                </tr>
              )}

              {/* Demand Row */}
              {tableData.demandDisplay && (
                <tr className="bg-neutral-50/20 dark:bg-[#121215]/30 text-neutral-700 dark:text-neutral-300 font-medium">
                  <td className="py-1.5 px-3 text-[11px] flex items-center space-x-1.5">
                    <TrendingUp className="h-3 w-3 text-neutral-400" />
                    <span>Demand</span>
                  </td>
                  <td colSpan={3} className="py-1.5 px-3 text-right font-mono text-[11px] text-neutral-800 dark:text-neutral-200">
                    {tableData.demandDisplay}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 flex-1 flex flex-col justify-center items-center">
          <ReactECharts option={donutOption} style={{ height: "250px", width: "100%" }} />
          <div className="text-center text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 font-mono">
            Total: <strong className="text-neutral-900 dark:text-white">{tableData.totalDisplay}</strong> &bull;
            Renewables: <strong className="text-emerald-600 dark:text-emerald-400">{tableData.renPctDisplay}</strong>
          </div>
        </div>
      )}

      {/* Bottom Sub-panel: Interconnectors & Grid Flow */}
      {interconnectors.length > 0 && (
        <div className="p-3 border-t border-neutral-100 dark:border-[#27272A] bg-neutral-50/30 dark:bg-[#121215]/40 text-[11px]">
          <div className="font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center space-x-1.5">
            <Globe className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
            <span>Interconnectors &amp; Grid Flows</span>
          </div>
          <div className="space-y-1.5">
            {interconnectors.map((flow, i) => (
              <div key={i} className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                <span className="truncate max-w-[180px]">{flow.name}</span>
                <span className="font-mono font-medium text-neutral-900 dark:text-white">
                  {flow.flowMW} MW{" "}
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">/ {flow.capacityMW}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
