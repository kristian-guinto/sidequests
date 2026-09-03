"use client";

import React, { useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { FuelGenerationPoint, ViewMode, FuelTech, PaletteMode } from "@/lib/types";
import { getFuelMeta } from "@/lib/colors";
import { computeXAxisConfig, getShadcnTooltipConfig } from "@/lib/chartUtils";
import {
  ChartCard,
  ChartCardHeader,
  ChartCardTitle,
  ChartCardDescription,
  ChartCardContent,
} from "@/components/ui/ChartCard";
import { format, parseISO } from "date-fns";
import { Zap, Percent, Leaf } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface GenerationChartProps {
  data: FuelGenerationPoint[];
  viewMode: ViewMode;
  paletteMode?: PaletteMode;
  unit?: "MW" | "GWh";
  height?: string;
  hoveredFuel?: FuelTech | null;
  onHoverPoint?: (pt: FuelGenerationPoint | null) => void;
}

// Exact bottom-to-top stacking order from OpenElectricity diagram
const FUEL_ORDER = [
  "coal",
  "oil",
  "gas",
  "biomass",
  "geothermal",
  "battery",
  "hydro",
  "wind",
  "solar",
] as const;

export function GenerationChart({
  data,
  viewMode,
  paletteMode = "clean-fossil",
  unit = "MW",
  height = "330px",
  hoveredFuel,
  onHoverPoint,
}: GenerationChartProps) {
  const { isDark } = useTheme();
  const isPercentage = viewMode === "percentage";
  const isEnergy = unit === "GWh";

  const avgGeneration = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const totalSum = data.reduce((acc, d) => acc + (d.totalGeneration || 0), 0);
    return Math.round(totalSum / data.length);
  }, [data]);

  const avgRenewablesPct = useMemo(() => {
    if (!data || data.length === 0) return 0;
    let renSum = 0;
    let totSum = 0;
    for (const d of data) {
      const tot = d.totalGeneration || 0;
      totSum += tot;
      const ren =
        (d.solar || 0) +
        (d.wind || 0) +
        (d.hydro || 0) +
        (d.geothermal || 0) +
        (d.biomass || 0) +
        (d.battery || 0);
      renSum += ren;
    }
    return totSum > 0 ? Math.round((renSum / totSum) * 1000) / 10 : 0;
  }, [data]);

  const xAxisConfig = useMemo(() => computeXAxisConfig(data, isDark), [data, isDark]);
  const tooltipConfig = useMemo(() => getShadcnTooltipConfig(isDark), [isDark]);

  const option = useMemo(() => {
    const isAnyFuelFocused = Boolean(hoveredFuel);

    const series = FUEL_ORDER.map((fuel) => {
      const meta = getFuelMeta(fuel, isDark, paletteMode);
      const isFocused = hoveredFuel === fuel;

      const seriesData = data.map((d) => {
        const rawVal = Number(d[fuel] || 0);
        if (isPercentage) {
          const tot = d.totalGeneration || 1;
          return tot > 0 ? Math.round((rawVal / tot) * 1000) / 10 : 0;
        }
        return rawVal;
      });

      let areaColor = meta.color;
      let areaOpacity = 0.98;
      let lineWidth = 0.5;
      let lineColor = isDark ? "#3F3F46" : "#ffffff33";
      let zLevel = 2;

      if (paletteMode === "clean-fossil") {
        if (fuel === "gas") {
          // Prominent line marking the boundary between fossil base and clean canopy
          lineWidth = 1.8;
          lineColor = isDark ? "#10B981" : "#059669";
          zLevel = 6;
        } else {
          lineWidth = 0.5;
          lineColor = isDark ? "rgba(0, 0, 0, 0.35)" : "rgba(255, 255, 255, 0.45)";
        }
      }

      if (isAnyFuelFocused) {
        if (isFocused) {
          areaColor = meta.color;
          areaOpacity = 1.0;
          lineWidth = 2.0;
          lineColor = isDark ? "#FFFFFF" : "#0F172A";
          zLevel = 10;
        } else {
          areaColor = isDark ? "#27272A" : "#CBD5E1";
          areaOpacity = isDark ? 0.15 : 0.22;
          lineWidth = 0;
          lineColor = "transparent";
          zLevel = 1;
        }
      }

      return {
        name: meta.label,
        type: "line",
        stack: "TotalGeneration",
        z: zLevel,
        areaStyle: {
          color: areaColor,
          opacity: areaOpacity,
        },
        lineStyle: {
          width: lineWidth,
          color: lineColor,
        },
        itemStyle: {
          color: meta.color,
        },
        showSymbol: false,
        data: seriesData,
        smooth: false,
      };
    });

    const gridLineColor = isDark ? "rgba(255, 255, 255, 0.07)" : "#F1F5F9";

    return {
      backgroundColor: "transparent",
      animation: false,
      tooltip: {
        ...tooltipConfig,
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const idx = params[0].dataIndex;
          const rawPt = data[idx];
          let formattedTime = params[0].axisValue;
          if (rawPt?.timestamp) {
            try {
              formattedTime = format(parseISO(rawPt.timestamp), "d MMM yyyy, h:mm a");
            } catch { }
          }

          let total = rawPt?.totalGeneration || 0;
          if (total === 0) {
            total = params.reduce((acc, p) => acc + (Number(p.value) || 0), 0);
          }

          const unitStr = isEnergy ? "GWh" : "MW";
          const formattedTotal = isEnergy
            ? total.toFixed(2)
            : Math.round(total).toLocaleString();

          const rows = params.map((p) => {
            const val = Number(p.value) || 0;
            const rawVal = rawPt ? Number((rawPt as any)[p.seriesName.toLowerCase()] || 0) : 0;
            const pct = isPercentage ? val : total > 0 ? (val / total) * 100 : 0;
            return {
              name: p.seriesName,
              val,
              rawVal,
              pct,
              color: p.color,
            };
          });

          const borderCls = isDark ? "border-[#27272A]" : "border-neutral-100";
          const textMuted = isDark ? "text-neutral-400" : "text-neutral-500";
          const pillBg = isDark
            ? "bg-[#27272A] text-neutral-100 border border-neutral-700"
            : "bg-neutral-100 text-neutral-900";
          const textPrimary = isDark ? "text-neutral-100" : "text-neutral-900";
          const textSecondary = isDark ? "text-neutral-300" : "text-neutral-600";
          const textSubPct = isDark ? "text-neutral-500" : "text-neutral-400";

          let html = `<div class="font-sans min-w-[210px]">
            <div class="border-b ${borderCls} pb-1.5 mb-2 flex justify-between items-center text-xs">
              <span class="${textMuted} font-medium">${formattedTime}</span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded ${pillBg} font-bold font-mono">${isPercentage ? "100%" : `${formattedTotal} ${unitStr}`}</span>
            </div>`;

          rows.sort((a, b) => b.pct - a.pct).forEach((r) => {
            if (r.pct > 0 || r.val > 0) {
              const displayVal = isPercentage
                ? `${r.pct.toFixed(1)}%`
                : `${isEnergy ? r.val.toFixed(2) : Math.round(r.val).toLocaleString()} ${unitStr}`;
              const subPct = !isPercentage ? `<span class="${textSubPct} text-[10px] ml-1">(${r.pct.toFixed(1)}%)</span>` : "";

              const isClean = ["solar", "wind", "hydro", "geothermal", "biomass", "battery", "bioenergy"].some(
                (f) => r.name.toLowerCase().includes(f)
              );
              const cleanBadge = paletteMode === "clean-fossil"
                ? isClean
                  ? `<span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-mono ml-1.5 font-semibold">Clean</span>`
                  : `<span class="text-[9px] px-1 py-0.2 rounded bg-neutral-700/30 text-neutral-400 font-mono ml-1.5 font-semibold">Fossil</span>`
                : "";

              html += `<div class="flex justify-between items-center py-0.5 text-xs">
                <span class="flex items-center ${textSecondary}">
                  <span class="w-2.5 h-2.5 rounded-[3px] mr-2 shrink-0" style="background-color:${r.color}"></span>
                  ${r.name}
                  ${cleanBadge}
                </span>
                <span class="font-mono ${textPrimary} font-medium">${displayVal} ${subPct}</span>
              </div>`;
            }
          });

          html += `</div>`;
          return html;
        },
      },
      grid: xAxisConfig.grid,
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: xAxisConfig.timestamps,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: xAxisConfig.axisLabel,
        splitLine: {
          show: true,
          lineStyle: { color: gridLineColor, type: "dashed" },
        },
      },
      yAxis: {
        type: "value",
        min: isPercentage ? 0 : undefined,
        max: isPercentage ? 100 : undefined,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: isDark ? "#A1A1AA" : "#64748B",
          fontSize: 10,
          margin: 12,
          formatter: (v: number) =>
            isPercentage ? `${v}%` : isEnergy ? `${v}` : `${v.toLocaleString()}`,
        },
        splitLine: {
          lineStyle: { color: gridLineColor, type: "dashed" },
        },
      },
      series,
    };
  }, [data, isPercentage, isEnergy, xAxisConfig, tooltipConfig, isDark, hoveredFuel, paletteMode]);

  const onEvents = useMemo(() => {
    return {
      updateAxisPointer: (event: any) => {
        const idx = event.dataIndex != null ? event.dataIndex : event.dataIndexInside;
        if (idx != null && idx >= 0 && idx < data.length) {
          onHoverPoint?.(data[idx]);
        }
      },
      globalout: () => {
        onHoverPoint?.(null);
      },
    };
  }, [data, onHoverPoint]);

  const onChartReady = useCallback((echartsInstance: any) => {
    echartsInstance.group = "opennem_sync_group";
    echarts.connect("opennem_sync_group");
  }, []);

  return (
    <ChartCard onMouseLeave={() => onHoverPoint?.(null)}>
      <ChartCardHeader className="py-2.5 px-3 sm:px-4">
        <ChartCardTitle>
          <div className="flex items-center space-x-2">
            {isPercentage ? (
              <Percent className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            )}
            <span>
              Generation ({isPercentage ? "%" : unit})
            </span>
            {paletteMode === "clean-fossil" && (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-sans">
                <Leaf className="h-3 w-3" />
                Clean vs Fossil
              </span>
            )}
          </div>
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-[#18181B] text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-800 font-mono shadow-xs">
            {isPercentage ? (
              <>
                Renewables:{" "}
                <strong className="ml-1 text-emerald-600 dark:text-emerald-400 font-bold">
                  {avgRenewablesPct}%
                </strong>
              </>
            ) : (
              <>
                Av.{" "}
                <strong className="ml-1 text-neutral-950 dark:text-white font-bold">
                  {avgGeneration.toLocaleString()} {unit}
                </strong>
              </>
            )}
          </div>
        </ChartCardTitle>
      </ChartCardHeader>

      <ChartCardContent>
        <ReactECharts
          option={option}
          onEvents={onEvents}
          onChartReady={onChartReady}
          style={{ height, width: "100%" }}
          notMerge={true}
          lazyUpdate={false}
        />
      </ChartCardContent>
    </ChartCard>
  );
}
