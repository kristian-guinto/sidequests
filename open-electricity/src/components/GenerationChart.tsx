"use client";

import React, { useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { FuelGenerationPoint, ViewMode, FuelTech, PaletteMode, TimeRange } from "@/lib/types";
import { getFuelMeta } from "@/lib/colors";
import { computeXAxisConfig, formatMarketDate, getShadcnTooltipConfig, formatCompactValue } from "@/lib/chartUtils";
import { useIsMobile } from "@/lib/useIsMobile";
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
  range?: TimeRange;
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
  range = "7d",
  viewMode,
  paletteMode = "clean-fossil",
  unit = "MW",
  height,
  hoveredFuel,
  onHoverPoint,
}: GenerationChartProps) {
  const { isDark } = useTheme();
  const isMobile = useIsMobile();
  const isPercentage = viewMode === "percentage";
  const isEnergy = unit === "GWh";
  const isBarView = range === "30d" || range === "1y";

  const chartHeight = height || (isMobile ? "250px" : "310px");

  const avgGeneration = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const validData = data.filter(
      (d) => d.hasData !== false && d.totalGeneration != null && d.totalGeneration > 0
    );
    if (validData.length === 0) return 0;
    const totalSum = validData.reduce((acc, d) => acc + (d.totalGeneration || 0), 0);
    return isEnergy
      ? Math.round((totalSum / validData.length) * 10) / 10
      : Math.round(totalSum / validData.length);
  }, [data, isEnergy]);

  const avgRenewablesPct = useMemo(() => {
    if (!data || data.length === 0) return 0;
    let renSum = 0;
    let totSum = 0;
    for (const d of data) {
      if (d.hasData === false) continue;
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

  const xAxisConfig = useMemo(
    () => computeXAxisConfig(data, isDark, range, undefined, isMobile),
    [data, isDark, range, isMobile]
  );
  const tooltipConfig = useMemo(() => getShadcnTooltipConfig(isDark), [isDark]);

  const option = useMemo(() => {
    const isAnyFuelFocused = Boolean(hoveredFuel);

    const series = FUEL_ORDER.map((fuel) => {
      const meta = getFuelMeta(fuel, isDark, paletteMode);
      const isFocused = hoveredFuel === fuel;

      const seriesData = data.map((d) => {
        if (d.hasData === false) {
          return null;
        }
        const rawVal = Number(d[fuel] || 0);
        if (isPercentage) {
          const tot = d.totalGeneration;
          if (!tot || tot <= 0) return null;
          return Math.round((rawVal / tot) * 1000) / 10;
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

      if (isBarView) {
        return {
          name: meta.label,
          type: "bar",
          stack: "TotalGeneration",
          barCategoryGap: "0%",
          barWidth: "100%",
          z: zLevel,
          itemStyle: {
            color: areaColor,
            opacity: areaOpacity,
            borderColor: isFocused
              ? isDark
                ? "#FFFFFF"
                : "#0F172A"
              : isDark
                ? "rgba(0, 0, 0, 0.35)"
                : "rgba(255, 255, 255, 0.45)",
            borderWidth: isFocused ? 1.5 : 0.4,
          },
          showSymbol: false,
          data: seriesData,
        };
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
        axisPointer: {
          type: isBarView ? "shadow" : "line",
          shadowStyle: {
            color: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
          },
          lineStyle: {
            color: isDark ? "#71717A" : "#94A3B8",
            width: 1.5,
            type: "dashed",
          },
        },
      },
      grid: xAxisConfig.grid,
      xAxis: {
        type: "category",
        boundaryGap: isBarView ? true : false,
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
          fontSize: isMobile ? 9 : 10,
          margin: isMobile ? 6 : 12,
          formatter: (v: number) =>
            isPercentage
              ? `${v}%`
              : isEnergy
                ? `${v}`
                : isMobile
                  ? formatCompactValue(v)
                  : `${v.toLocaleString()}`,
        },
        splitLine: {
          lineStyle: { color: gridLineColor, type: "dashed" },
        },
      },
      series,
    };
  }, [data, range, isPercentage, isEnergy, isBarView, xAxisConfig, tooltipConfig, isDark, hoveredFuel, paletteMode, isMobile]);

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
        <ChartCardTitle className="flex-wrap gap-1.5 sm:gap-2">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {isPercentage ? (
              <Percent className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 dark:text-amber-400" />
            )}
            <span className="text-xs sm:text-sm">
              Generation ({isPercentage ? "%" : unit})
            </span>
            {paletteMode === "clean-fossil" && (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-sans">
                <Leaf className="h-3 w-3" />
                Clean vs Fossil
              </span>
            )}
          </div>
          <div className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-neutral-100 dark:bg-[#18181B] text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-800 font-mono shadow-xs">
            {isPercentage ? (
              <>
                Renewables:{" "}
                <strong className="ml-1 text-emerald-600 dark:text-emerald-400 font-bold">
                  {avgRenewablesPct}%
                </strong>
              </>
            ) : isEnergy ? (
              <>
                {range === "1y" ? "Av. Weekly: " : "Av. Daily: "}
                <strong className="ml-1 text-neutral-950 dark:text-white font-bold">
                  {avgGeneration.toFixed(1)} GWh
                </strong>
              </>
            ) : (
              <>
                Av. Power:{" "}
                <strong className="ml-1 text-neutral-950 dark:text-white font-bold">
                  {avgGeneration.toLocaleString()} MW
                </strong>
              </>
            )}
          </div>
        </ChartCardTitle>
      </ChartCardHeader>

      <ChartCardContent className="p-1 sm:p-3 pt-2">
        <ReactECharts
          option={option}
          onEvents={onEvents}
          onChartReady={onChartReady}
          style={{ height: chartHeight, width: "100%" }}
          notMerge={true}
          lazyUpdate={false}
        />
      </ChartCardContent>
    </ChartCard>
  );
}
