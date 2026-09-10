"use client";

import React, { useState, useMemo } from "react";
import {
  FuelBreakdownRow,
  FuelGenerationPoint,
  SummaryMetrics,
  FuelTech,
  PaletteMode,
} from "@/lib/types";
import { getFuelMeta } from "@/lib/colors";
import { ChevronDown, Zap, CloudFog, TrendingUp } from "lucide-react";
import ReactECharts from "echarts-for-react";
import { format, parseISO } from "date-fns";
import { formatMarketDate } from "@/lib/chartUtils";
import { useTheme } from "@/components/ThemeProvider";

interface DataSidebarProps {
  breakdown: FuelBreakdownRow[];
  summary: SummaryMetrics | null;
  hoveredPoint: FuelGenerationPoint | null;
  hoveredFuel?: FuelTech | null;
  onHoverFuel?: (fuel: FuelTech | null) => void;
  timeSpan?: { start: string; end: string };
  currencySymbol?: string;
  currencyCode?: string;
  unit?: "MW" | "GWh";
  paletteMode?: PaletteMode;
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
  hoveredPoint,
  hoveredFuel,
  onHoverFuel,
  timeSpan,
  currencySymbol = "₱",
  currencyCode = "PHP",
  unit = "MW",
  paletteMode = "clean-fossil",
}: DataSidebarProps) {
  const { isDark } = useTheme();
  const isHovered = Boolean(hoveredPoint);
  const isEnergy = unit === "GWh";

  // Format header time text
  const formattedTimeHeader = useMemo(() => {
    if (isHovered && hoveredPoint?.timestamp) {
      return formatMarketDate(hoveredPoint.timestamp, "d MMM yyyy, h:mm a");
    }
    if (timeSpan?.start && timeSpan?.end) {
      try {
        const sFormatted = formatMarketDate(timeSpan.start, "d MMM yyyy");
        const eFormatted = formatMarketDate(timeSpan.end, "d MMM yyyy");
        if (sFormatted === eFormatted) {
          return sFormatted;
        }
        return `${sFormatted} – ${eFormatted}`;
      } catch {
        return "Selected Range";
      }
    }
    return "Summary (Total Range)";
  }, [isHovered, hoveredPoint, timeSpan]);

  // Compute table rows based on hover or aggregate
  const tableData = useMemo(() => {
    if (isHovered && hoveredPoint) {
      const pt = hoveredPoint;
      if (pt.hasData === false) {
        const rows = FUEL_DISPLAY_ORDER.map((fKey) => {
          const meta = getFuelMeta(fKey, isDark, paletteMode);
          return {
            fuelTech: fKey,
            label: meta.label,
            color: meta.color,
            valueDisplay: "—",
            rawVal: 0,
            pct: 0,
            isRenewable: meta.isRenewable,
          };
        });
        return {
          rows,
          totalDisplay: "—",
          renValDisplay: "—",
          renPctDisplay: "—",
          emissionsDisplay: "—",
          peakDisplay: null,
          columnUnit: "Power",
          unitSub: "MW",
        };
      }

      const totalGen = pt.totalGeneration || 1;

      // Calculate emissions for point in time (5-minute interval)
      const coalT = (pt.coal || 0) * (5.0 / 60.0) * 0.9;
      const gasT = (pt.gas || 0) * (5.0 / 60.0) * 0.38;
      const oilT = (pt.oil || 0) * (5.0 / 60.0) * 0.75;
      const totalEmissionsT = coalT + gasT + oilT;

      const rows = FUEL_DISPLAY_ORDER.map((fKey) => {
        const meta = getFuelMeta(fKey, isDark, paletteMode);
        const val = Number((pt as any)[fKey]) || 0;
        const pct = totalGen > 0 ? (val / totalGen) * 100 : 0;
        return {
          fuelTech: fKey,
          label: meta.label,
          color: meta.color,
          valueDisplay: `${val.toLocaleString()} MW`,
          rawVal: val,
          pct: pct,
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
        emissionsDisplay: `${totalEmissionsT.toFixed(1)} tCO₂e`,
        peakDisplay: null,
        columnUnit: "Power",
        unitSub: "MW",
      };
    } else {
      const isEnergy = unit === "GWh";
      const totalGWh = summary?.totalGenerationGWh || 0;
      const totalEmissions = summary?.totalEmissionsTonnes || 0;
      const peakGen = summary?.peakGenerationMW || 0;

      const rows = FUEL_DISPLAY_ORDER.map((fKey) => {
        const meta = getFuelMeta(fKey, isDark, paletteMode);
        const b = breakdown.find((item) => item.fuelTech === fKey);
        const gwh = b?.energyGWh || 0;
        const mw = b?.generationMW || 0;
        const pct = b?.percentage || 0;

        return {
          fuelTech: fKey,
          label: meta.label,
          color: meta.color,
          valueDisplay: isEnergy
            ? `${gwh.toFixed(1)} GWh`
            : `${Math.round(mw).toLocaleString()} MW`,
          rawVal: isEnergy ? gwh : mw,
          pct: pct,
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
        emissionsDisplay: totalEmissions > 0 ? `${Math.round(totalEmissions).toLocaleString()} tCO₂e` : null,
        peakDisplay: peakGen > 0 ? `Peak ${Math.round(peakGen).toLocaleString()} MW` : null,
        columnUnit: isEnergy ? "Energy" : "Power",
        unitSub: isEnergy ? "GWh" : "MW",
      };
    }
  }, [isHovered, hoveredPoint, breakdown, summary, unit, isDark, paletteMode]);

  // Donut chart option
  const donutOption = useMemo(() => {
    const isAnyHovered = hoveredFuel != null;
    let dataItems = tableData.rows
      .filter((r) => r.rawVal > 0)
      .map((r) => {
        const isHovered = hoveredFuel === r.fuelTech;
        return {
          name: r.label,
          fuelTech: r.fuelTech,
          value: Math.round(r.rawVal * 10) / 10,
          itemStyle: {
            color: r.color,
            opacity: isAnyHovered ? (isHovered ? 1.0 : 0.35) : 0.92,
            borderColor: isDark ? "#09090B" : "#FFFFFF",
            borderWidth: isHovered ? 2.0 : 1.0,
          },
        };
      });

    const hasData = dataItems.length > 0;
    if (!hasData) {
      dataItems = [
        {
          name: "No Data",
          fuelTech: "solar" as FuelTech,
          value: 1,
          itemStyle: {
            color: isDark ? "#27272A" : "#E2E8F0",
            opacity: 0.5,
            borderColor: "transparent",
            borderWidth: 0,
          },
        },
      ];
    }

    return {
      backgroundColor: "transparent",
      animation: false,
      tooltip: hasData
        ? {
          trigger: "item",
          backgroundColor: isDark
            ? "rgba(15, 15, 18, 0.96)"
            : "rgba(255, 255, 255, 0.96)",
          borderColor: isDark ? "#27272A" : "rgba(226, 232, 240, 0.8)",
          textStyle: { color: isDark ? "#F8FAFC" : "#0F172A", fontSize: 11 },
          formatter: (params: any) => {
            const val =
              params.value != null
                ? Number(params.value).toLocaleString()
                : "0";
            return `<div class="font-sans font-medium text-xs">
                <span class="inline-block w-2 h-2 rounded-xs mr-1.5" style="background-color: ${params.color};"></span>
                <strong>${params.name}</strong>: ${val} ${tableData.unitSub} (${params.percent}%)
              </div>`;
          },
        }
        : { show: false },
      graphic: [
        {
          type: "text",
          left: "center",
          top: "40%",
          style: {
            text: hasData ? tableData.renPctDisplay || "0%" : "—",
            textAlign: "center",
            fill: isDark ? "#34D399" : "#059669",
            fontSize: 16,
            fontWeight: "bold",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          },
        },
        {
          type: "text",
          left: "center",
          top: "55%",
          style: {
            text: "Renewables",
            textAlign: "center",
            fill: isDark ? "#A1A1AA" : "#71717A",
            fontSize: 10,
            fontWeight: "500",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          },
        },
      ],
      series: [
        {
          type: "pie",
          radius: ["55%", "78%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: {
            scale: hasData,
            scaleSize: 4,
            label: { show: false },
          },
          data: dataItems,
        },
      ],
    };
  }, [tableData, hoveredFuel, isDark]);

  const onDonutEvents = useMemo(() => {
    return {
      mouseover: (params: any) => {
        if (params.data?.fuelTech) {
          onHoverFuel?.(params.data.fuelTech);
        }
      },
      mouseout: () => {
        onHoverFuel?.(null);
      },
    };
  }, [onHoverFuel]);

  return (
    <aside className="bg-white dark:bg-[#09090B] border border-neutral-200 dark:border-[#27272A] rounded-xl flex flex-col h-full text-neutral-800 dark:text-neutral-200 text-xs shadow-sm transition-all overflow-hidden">
      {/* Sidebar Header: Date range / Hovered Time display */}
      <div className="p-3 border-b border-neutral-100 dark:border-[#27272A] flex items-center justify-between bg-neutral-50/60 dark:bg-[#121215]/80">
        <div className="flex flex-col">
          <span className="font-semibold text-neutral-900 dark:text-white text-xs sm:text-[13px] truncate max-w-[240px]">
            {formattedTimeHeader}
          </span>
        </div>

        {isHovered ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            Interval
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 dark:bg-[#27272A] text-neutral-600 dark:text-neutral-400">
            Period Total
          </span>
        )}
      </div>

      {/* Top: Donut Chart */}
      <div className="pt-2 pb-1 px-3 flex flex-col items-center bg-white dark:bg-[#09090B]">
        <ReactECharts
          option={donutOption}
          onEvents={onDonutEvents}
          style={{ height: "165px", width: "100%" }}
          notMerge={true}
          lazyUpdate={false}
        />
      </div>

      {/* Summary Metrics Strip */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-50/70 dark:bg-[#121215]/60 border-t border-b border-neutral-100 dark:border-[#27272A] text-[11px] font-mono">
        <span className="text-neutral-500 dark:text-neutral-400">
          Total:{" "}
          <strong className="text-neutral-900 dark:text-white font-semibold">
            {tableData.totalDisplay}
          </strong>
        </span>
        <span className="text-neutral-500 dark:text-neutral-400">
          Renewables:{" "}
          <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {tableData.renValDisplay} ({tableData.renPctDisplay})
          </strong>
        </span>
      </div>

      {/* Bottom: Breakdown Table */}
      <div className="flex-1 overflow-x-auto no-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-[#27272A] text-[10.5px] sm:text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-[#121215]/50">
              <th className="py-1.5 px-2.5 sm:px-3">
                <div className="flex items-center space-x-1 cursor-pointer">
                  <span>Detailed</span>
                  <ChevronDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-1.5 px-2 sm:px-2.5 text-right font-mono">
                {tableData.columnUnit}
                <br />
                <span className="font-normal text-[9.5px] sm:text-[10px] text-neutral-400 dark:text-neutral-500">
                  {tableData.unitSub}
                </span>
              </th>
              <th className="py-1.5 px-2.5 sm:px-3 text-right font-mono">
                Contrib.
                <br />
                <span className="font-normal text-[9.5px] sm:text-[10px] text-neutral-400 dark:text-neutral-500">%</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100 dark:divide-[#27272A]/70 text-neutral-800 dark:text-neutral-200">
            {/* Sources Section Header */}
            <tr className="bg-neutral-50/80 dark:bg-[#18181B]/80 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              <td colSpan={3} className="py-1 px-2.5 sm:px-3">
                Sources
              </td>
            </tr>

            {tableData.rows.map((row) => {
              const isThisRowHovered = hoveredFuel === row.fuelTech;
              const isAnyRowHovered = hoveredFuel !== null && hoveredFuel !== undefined;
              return (
                <tr
                  key={row.fuelTech}
                  onMouseEnter={() => onHoverFuel?.(row.fuelTech)}
                  onMouseLeave={() => onHoverFuel?.(null)}
                  className={`transition-all duration-150 cursor-pointer ${isThisRowHovered
                    ? "bg-neutral-100 dark:bg-[#27272A] font-bold shadow-xs scale-[1.005]"
                    : isAnyRowHovered
                      ? "opacity-40 hover:opacity-100 hover:bg-neutral-50/90 dark:hover:bg-[#18181B]/70"
                      : row.rawVal === 0
                        ? "opacity-40 hover:bg-neutral-50/90 dark:hover:bg-[#18181B]/70"
                        : "hover:bg-neutral-50/90 dark:hover:bg-[#18181B]/70"
                    }`}
                >
                  <td className="py-1.5 px-2.5 sm:px-3 flex items-center space-x-1.5 sm:space-x-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 transition-transform ${isThisRowHovered ? "scale-125 ring-1 ring-neutral-400" : ""
                        }`}
                      style={{ backgroundColor: row.color }}
                    />
                    <span
                      className={`text-[11px] truncate ${isThisRowHovered
                        ? "text-neutral-950 dark:text-white font-bold"
                        : "font-medium text-neutral-800 dark:text-neutral-200"
                        }`}
                    >
                      {row.label}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 sm:px-2.5 text-right font-mono font-medium text-[11px] tabular-nums text-neutral-900 dark:text-neutral-100">
                    {row.valueDisplay}
                  </td>
                  <td className="py-1.5 px-2.5 sm:px-3 text-right font-mono text-[11px] tabular-nums text-neutral-600 dark:text-neutral-400">
                    {row.pct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}

            {/* Summary Totals: Net Generation */}
            <tr className="border-t-2 border-neutral-200 dark:border-[#27272A] bg-neutral-50/40 dark:bg-[#121215]/50 font-bold text-neutral-900 dark:text-white">
              <td className="py-2 px-2.5 sm:px-3 text-[11px] flex items-center space-x-1.5">
                <Zap className="h-3 w-3 text-amber-500" />
                <span>Net {isHovered ? "Power" : "Generation"}</span>
              </td>
              <td className="py-2 px-2 sm:px-2.5 text-right font-mono text-[11px]">
                {tableData.totalDisplay}
              </td>
              <td className="py-2 px-2.5 sm:px-3 text-right font-mono text-[11px]">100%</td>
            </tr>

            {/* Renewables Row */}
            <tr className="bg-emerald-50/30 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-300 font-bold">
              <td className="py-2 px-2.5 sm:px-3 text-[11px] flex items-center space-x-1.5">
                <span className="text-emerald-500 font-normal">—</span>
                <span>Renewables</span>
              </td>
              <td className="py-2 px-2 sm:px-2.5 text-right font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                {tableData.renValDisplay}
              </td>
              <td className="py-2 px-2.5 sm:px-3 text-right font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                {tableData.renPctDisplay}
              </td>
            </tr>

            {/* Emissions Row */}
            {tableData.emissionsDisplay && (
              <tr className="bg-neutral-50/20 dark:bg-[#121215]/30 text-neutral-700 dark:text-neutral-300 font-medium">
                <td className="py-1.5 px-2.5 sm:px-3 text-[11px] flex items-center space-x-1.5">
                  <CloudFog className="h-3 w-3 text-neutral-400" />
                  <span>Emissions</span>
                </td>
                <td className="py-1.5 px-2 sm:px-2.5 text-right font-mono text-[11px] text-neutral-800 dark:text-neutral-200">
                  {tableData.emissionsDisplay}
                </td>
                <td className="py-1.5 px-2.5 sm:px-3 text-right font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                  {isHovered ? "Interval" : "Total Period"}
                </td>
              </tr>
            )}

            {/* Peak Generation Row */}
            {tableData.peakDisplay && (
              <tr className="bg-neutral-50/20 dark:bg-[#121215]/30 text-neutral-700 dark:text-neutral-300 font-medium">
                <td className="py-1.5 px-2.5 sm:px-3 text-[11px] flex items-center space-x-1.5">
                  <TrendingUp className="h-3 w-3 text-neutral-400" />
                  <span>Peak Generation</span>
                </td>
                <td colSpan={2} className="py-1.5 px-2.5 sm:px-3 text-right font-mono text-[11px] text-neutral-800 dark:text-neutral-200">
                  {tableData.peakDisplay}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
