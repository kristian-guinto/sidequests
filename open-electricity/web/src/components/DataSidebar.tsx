"use client";

import React, { useState, useMemo } from "react";
import {
  FuelBreakdownRow,
  FuelGenerationPoint,
  SummaryMetrics,
  InterconnectorFlow,
  FuelTech,
} from "@/lib/types";
import { FUEL_META } from "@/lib/colors";
import { ChevronDown, PieChart as PieIcon, List, Globe } from "lucide-react";
import ReactECharts from "echarts-for-react";
import { format, parseISO } from "date-fns";

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

      const rows = FUEL_DISPLAY_ORDER.map((fKey) => {
        const meta = FUEL_META[fKey];
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
        columnUnit: "Power",
        unitSub: "MW",
        isInstant: true,
      };
    }

    // Default range summary
    const totalGWh = summary?.totalGenerationGWh || 0;
    const renPct = summary?.renewablesPct || 0;
    const avgPrice = summary?.avgPricePHPMWh || 0;

    const rows = FUEL_DISPLAY_ORDER.map((fKey) => {
      const meta = FUEL_META[fKey];
      const match = breakdown.find((b) => b.fuelTech === fKey);
      const energyGWh = match ? match.energyGWh : 0;
      const pct = match ? match.percentage : 0;

      const estimatedPrice = Math.round(
        fKey === "solar"
          ? avgPrice * 0.75
          : fKey === "wind"
          ? avgPrice * 0.85
          : fKey === "hydro"
          ? avgPrice * 1.05
          : fKey === "coal"
          ? avgPrice * 0.95
          : fKey === "gas"
          ? avgPrice * 1.15
          : avgPrice * 1.3
      );

      return {
        fuelTech: fKey,
        label: meta.label,
        color: meta.color,
        valueDisplay: energyGWh.toLocaleString(),
        rawVal: energyGWh,
        pct: pct,
        priceDisplay: `${currencySymbol}${estimatedPrice.toLocaleString()}`,
        isRenewable: meta.isRenewable,
      };
    });

    return {
      rows,
      totalDisplay: `${totalGWh.toLocaleString()} GWh`,
      renValDisplay: `${Math.round((totalGWh * renPct) / 100).toLocaleString()} GWh`,
      renPctDisplay: `${renPct}%`,
      priceDisplay: `${currencySymbol}${avgPrice.toLocaleString()}`,
      columnUnit: "Energy",
      unitSub: "GWh",
      isInstant: false,
    };
  }, [isHovered, hoveredPoint, summary, breakdown, currencySymbol]);

  // Donut chart option
  const donutOption = useMemo(() => {
    const dataItems = tableData.rows
      .filter((r) => r.rawVal > 0)
      .map((r) => ({
        name: r.label,
        value: r.rawVal,
        itemStyle: { color: r.color },
      }));

    return {
      backgroundColor: "#FFFFFF",
      tooltip: {
        trigger: "item",
        formatter: `{b}: {c} ${tableData.unitSub} ({d}%)`,
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
          data: dataItems,
        },
      ],
    };
  }, [tableData]);

  return (
    <aside className="bg-white border border-neutral-200 rounded-sm flex flex-col h-full text-neutral-800 text-xs shadow-sm transition-all">
      {/* Sidebar Header: Date range / Hovered Time display */}
      <div className="p-2.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            {isHovered ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                POINT IN TIME
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-200 text-neutral-800">
                AGGREGATE
              </span>
            )}
            <span className="font-semibold text-neutral-900 text-xs truncate max-w-[200px]">
              {formattedTimeHeader}
            </span>
          </div>
        </div>

        {/* Toggle between Table & Donut */}
        <div className="flex items-center border border-neutral-200 rounded p-0.5 bg-white">
          <button
            onClick={() => setActiveView("table")}
            className={`p-1 rounded transition ${
              activeView === "table"
                ? "bg-neutral-100 text-neutral-900 font-bold"
                : "text-neutral-400 hover:text-neutral-700"
            }`}
            title="Table View"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setActiveView("donut")}
            className={`p-1 rounded transition ${
              activeView === "donut"
                ? "bg-neutral-100 text-neutral-900 font-bold"
                : "text-neutral-400 hover:text-neutral-700"
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
                  {tableData.columnUnit}
                  <br />
                  <span className="font-normal text-[10px] text-neutral-400">
                    {tableData.unitSub}
                  </span>
                </th>
                <th className="py-2 px-2 text-right font-mono">
                  Contrib.
                  <br />
                  <span className="font-normal text-[10px] text-neutral-400">%</span>
                </th>
                <th className="py-2 px-3 text-right font-mono">
                  {isHovered ? "Spot Price" : "Av. Value"}
                  <br />
                  <span className="font-normal text-[10px] text-neutral-400">
                    {currencySymbol}/MWh
                  </span>
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

              {tableData.rows.map((row) => (
                <tr
                  key={row.fuelTech}
                  className={`hover:bg-neutral-50/90 transition-colors group cursor-default ${
                    row.rawVal === 0 ? "opacity-40" : ""
                  }`}
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
                    {row.valueDisplay}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-[11px] text-neutral-600">
                    {row.pct.toFixed(1)}%
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-[11px] text-neutral-500">
                    {row.priceDisplay}
                  </td>
                </tr>
              ))}

              {/* Summary Totals */}
              <tr className="border-t-2 border-neutral-200 bg-neutral-50/40 font-bold text-neutral-900">
                <td className="py-2 px-3 text-[11px] flex items-center space-x-1.5">
                  <span className="text-neutral-400 font-normal">—</span>
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

              <tr className="bg-emerald-50/30 text-emerald-950 font-bold">
                <td className="py-2 px-3 text-[11px] flex items-center space-x-1.5">
                  <span className="text-emerald-500 font-normal">—</span>
                  <span>Renewables</span>
                </td>
                <td className="py-2 px-2 text-right font-mono text-[11px] text-emerald-700">
                  {tableData.renValDisplay}
                </td>
                <td className="py-2 px-2 text-right font-mono text-[11px] text-emerald-700">
                  {tableData.renPctDisplay}
                </td>
                <td className="py-2 px-3 text-right font-mono text-[11px] text-emerald-700">
                  {tableData.priceDisplay}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 flex-1 flex flex-col justify-center items-center">
          <ReactECharts option={donutOption} style={{ height: "250px", width: "100%" }} />
          <div className="text-center text-[11px] text-neutral-500 mt-2 font-mono">
            Total: <strong className="text-neutral-900">{tableData.totalDisplay}</strong> &bull;
            Renewables: <strong className="text-emerald-600">{tableData.renPctDisplay}</strong>
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
                  {flow.flowMW} MW{" "}
                  <span className="text-[10px] text-neutral-400">/ {flow.capacityMW}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
