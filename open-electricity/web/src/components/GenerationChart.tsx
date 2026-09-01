"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint, ViewMode } from "@/lib/types";
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
import { Zap, Percent } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface GenerationChartProps {
  data: FuelGenerationPoint[];
  viewMode: ViewMode;
  unit?: "MW" | "GWh";
  height?: string;
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
  unit = "MW",
  height = "330px",
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
    const series = FUEL_ORDER.map((fuel) => {
      const meta = getFuelMeta(fuel, isDark);

      const seriesData = data.map((d) => {
        const rawVal = Number(d[fuel] || 0);
        if (isPercentage) {
          const tot = d.totalGeneration || 1;
          return tot > 0 ? Math.round((rawVal / tot) * 1000) / 10 : 0;
        }
        return rawVal;
      });

      return {
        name: meta.label,
        type: "line",
        stack: "TotalGeneration",
        areaStyle: {
          color: meta.color,
          opacity: 0.98,
        },
        lineStyle: {
          width: 0.5,
          color: isDark ? "#3F3F46" : "#ffffff33",
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
            } catch {}
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

              html += `<div class="flex justify-between items-center py-0.5 text-xs">
                <span class="flex items-center ${textSecondary}">
                  <span class="w-2.5 h-2.5 rounded-[3px] mr-2" style="background-color:${r.color}"></span>
                  ${r.name}
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
  }, [data, isPercentage, isEnergy, xAxisConfig, tooltipConfig, isDark]);

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

  return (
    <ChartCard onMouseLeave={() => onHoverPoint?.(null)}>
      <ChartCardHeader>
        <ChartCardTitle>
          <div className="flex items-center space-x-2">
            {isPercentage ? (
              <Percent className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            )}
            <span>
              {isPercentage ? "Generation Fuel Mix Share" : "Generation & Fuel Mix"}
            </span>
            <span className="text-xs font-normal text-neutral-400 dark:text-neutral-500 font-mono">
              ({isPercentage ? "% Share" : unit})
            </span>
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
        <ChartCardDescription>
          {isPercentage
            ? "100% normalized contribution by fuel technology to total grid electricity demand"
            : "Real-time electricity dispatch aggregated across all connected power facilities"}
        </ChartCardDescription>
      </ChartCardHeader>

      <ChartCardContent>
        <ReactECharts
          option={option}
          onEvents={onEvents}
          style={{ height, width: "100%" }}
          notMerge={true}
          lazyUpdate={false}
        />
      </ChartCardContent>
    </ChartCard>
  );
}
