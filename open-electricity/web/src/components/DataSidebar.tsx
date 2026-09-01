"use client";

import React, { useState } from "react";
import {
  FuelBreakdownRow,
  SummaryMetrics,
  InterconnectorFlow,
  TimeRange,
  TimeInterval,
} from "@/lib/types";
import { ChevronDown, PieChart as PieIcon, List, Zap, Globe } from "lucide-react";
import ReactECharts from "echarts-for-react";

interface DataSidebarProps {
  breakdown: FuelBreakdownRow[];
  summary: SummaryMetrics | null;
  interconnectors: InterconnectorFlow[];
  currencySymbol?: string;
  currencyCode?: string;
  unit?: "MW" | "GWh";
}

export function DataSidebar({
  breakdown,
  summary,
  interconnectors,
  currencySymbol = "₱",
  currencyCode = "PHP",
  unit = "MW",
}: DataSidebarProps) {
  const [activeView, setActiveView] = useState<"table" | "donut">("table");

  const totalGWh = summary?.totalGenerationGWh || 0;
  const renewablesPct = summary?.renewablesPct || 0;
  const avgPrice = summary?.avgPricePHPMWh || 0;

  // Donut chart option
  const donutOption = {
    backgroundColor: "#FFFFFF",
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} GWh ({d}%)",
    },
    series: [
      {
        name: "Fuel Mix",
        type: "pie",
        radius: ["45%", "72%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 2,
          borderColor: "#fff",
          borderWidth: 1,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 11,
            fontWeight: "bold",
          },
        },
        data: breakdown.map((b) => ({
          name: b.label,
          value: b.energyGWh,
          itemStyle: { color: b.color },
        })),
      },
    ],
  };

  return (
    <aside className="bg-white border border-neutral-200 rounded-sm flex flex-col h-full text-neutral-800 text-xs">
      {/* Sidebar Header: Date range display */}
      <div className="p-3 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center space-x-1.5 font-medium text-neutral-600">
          <span className="font-semibold text-neutral-900">Summary</span>
          <span className="text-neutral-400">&bull;</span>
          <span className="text-[11px] text-neutral-500">Live Breakdown</span>
        </div>

        {/* Toggle between Table & Donut */}
        <div className="flex items-center border border-neutral-200 rounded p-0.5">
          <button
            onClick={() => setActiveView("table")}
            className={`p-1 rounded transition ${
              activeView === "table" ? "bg-neutral-100 text-neutral-900 font-bold" : "text-neutral-400 hover:text-neutral-700"
            }`}
            title="Table View"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setActiveView("donut")}
            className={`p-1 rounded transition ${
              activeView === "donut" ? "bg-neutral-100 text-neutral-900 font-bold" : "text-neutral-400 hover:text-neutral-700"
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
              <tr className="border-b border-neutral-200 text-[11px] font-semibold text-neutral-500 bg-neutral-50/50">
                <th className="py-2 px-3">
                  <div className="flex items-center space-x-1 cursor-pointer">
                    <span>Detailed</span>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-2 px-2 text-right font-mono">
                  Energy<br />
                  <span className="font-normal text-[10px] text-neutral-400">GWh</span>
                </th>
                <th className="py-2 px-2 text-right font-mono">
                  Contrib.<br />
                  <span className="font-normal text-[10px] text-neutral-400">%</span>
                </th>
                <th className="py-2 px-3 text-right font-mono">
                  Av. Value<br />
                  <span className="font-normal text-[10px] text-neutral-400">{currencySymbol}/MWh</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100 text-neutral-800">
              {/* Sources Section Header */}
              <tr className="bg-neutral-50/80 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                <td colSpan={4} className="py-1 px-3">
                  Sources
                </td>
              </tr>

              {breakdown.map((row) => {
                const estimatedPrice = Math.round(
                  row.fuelTech === "solar"
                    ? avgPrice * 0.75
                    : row.fuelTech === "wind"
                    ? avgPrice * 0.85
                    : row.fuelTech === "hydro"
                    ? avgPrice * 1.05
                    : row.fuelTech === "coal"
                    ? avgPrice * 0.95
                    : row.fuelTech === "gas"
                    ? avgPrice * 1.15
                    : avgPrice * 1.30
                );

                return (
                  <tr
                    key={row.fuelTech}
                    className="hover:bg-neutral-50/80 transition-colors group cursor-default"
                  >
                    <td className="py-1.5 px-3 flex items-center space-x-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="font-medium text-neutral-800 text-[11px] group-hover:text-neutral-950">
                        {row.label}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-medium text-[11px] text-neutral-900">
                      {row.energyGWh.toLocaleString()}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[11px] text-neutral-600">
                      {row.percentage.toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-[11px] text-neutral-500">
                      {currencySymbol}{estimatedPrice.toLocaleString()}
                    </td>
                  </tr>
                );
              })}

              {/* Summary Totals */}
              <tr className="border-t-2 border-neutral-200 bg-neutral-50/40 font-bold text-neutral-900">
                <td className="py-2 px-3 text-[11px] flex items-center space-x-1.5">
                  <span className="text-neutral-400 font-normal">—</span>
                  <span>Net Generation</span>
                </td>
                <td className="py-2 px-2 text-right font-mono text-[11px]">
                  {totalGWh.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right font-mono text-[11px]">100%</td>
                <td className="py-2 px-3 text-right font-mono text-[11px]">
                  {currencySymbol}{avgPrice.toLocaleString()}
                </td>
              </tr>

              <tr className="bg-emerald-50/30 text-emerald-950 font-bold">
                <td className="py-2 px-3 text-[11px] flex items-center space-x-1.5">
                  <span className="text-emerald-500 font-normal">—</span>
                  <span>Renewables</span>
                </td>
                <td className="py-2 px-2 text-right font-mono text-[11px] text-emerald-700">
                  {Math.round((totalGWh * renewablesPct) / 100).toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right font-mono text-[11px] text-emerald-700">
                  {renewablesPct}%
                </td>
                <td className="py-2 px-3 text-right font-mono text-[11px] text-emerald-700">
                  {currencySymbol}{Math.round(avgPrice * 0.9).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 flex-1 flex flex-col justify-center items-center">
          <ReactECharts option={donutOption} style={{ height: "260px", width: "100%" }} />
          <div className="text-center text-[11px] text-neutral-500 mt-2 font-mono">
            Total Output: <strong className="text-neutral-900">{totalGWh.toLocaleString()} GWh</strong> &bull; Renewables:{" "}
            <strong className="text-emerald-600">{renewablesPct}%</strong>
          </div>
        </div>
      )}

      {/* Bottom Sub-panel: Interconnectors & Grid Flow */}
      {interconnectors.length > 0 && (
        <div className="p-3 border-t border-neutral-100 bg-neutral-50/30 text-[11px]">
          <div className="font-semibold text-neutral-700 mb-2 flex items-center space-x-1.5">
            <Globe className="h-3 w-3 text-neutral-500" />
            <span>Interconnectors &amp; Grid Flows</span>
          </div>
          <div className="space-y-1.5">
            {interconnectors.map((flow, i) => (
              <div key={i} className="flex items-center justify-between text-neutral-600">
                <span className="truncate max-w-[180px]">{flow.name}</span>
                <span className="font-mono font-medium text-neutral-900">
                  {flow.flowMW} MW <span className="text-[10px] text-neutral-400">/ {flow.capacityMW}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
