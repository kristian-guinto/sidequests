"use client";

import React, { useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { FuelGenerationPoint, ViewMode, FuelTech, TimeRange } from "@/lib/types";
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
import { CloudFog } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface EmissionsChartProps {
  data: FuelGenerationPoint[];
  range?: TimeRange;
  viewMode?: ViewMode;
  height?: string;
  hoveredFuel?: FuelTech | null;
  onHoverPoint?: (pt: FuelGenerationPoint | null) => void;
}

export function EmissionsChart({
  data,
  range = "7d",
  viewMode = "stacked",
  height,
  hoveredFuel,
  onHoverPoint,
}: EmissionsChartProps) {
  const { isDark } = useTheme();
  const isMobile = useIsMobile();
  const isPercentage = viewMode === "percentage";
  const isBarView = range === "30d" || range === "1y";

  const chartHeight = height || (isMobile ? "145px" : "170px");

  const xAxisConfig = useMemo(
    () => computeXAxisConfig(data, isDark, range, undefined, isMobile),
    [data, isDark, range, isMobile]
  );
  const tooltipConfig = useMemo(() => getShadcnTooltipConfig(isDark), [isDark]);

  const emissionsData = useMemo(() => {
    return data.map((d) => {
      if (d.hasData === false) {
        return {
          coal: null,
          gas: null,
          oil: null,
          rawCoal: 0,
          rawGas: 0,
          rawOil: 0,
          total: 0,
          rawTotal: 0,
        };
      }
      let coalT = 0;
      let gasT = 0;
      let oilT = 0;

      if (isBarView) {
        // Data is in GWh (30d / 1y) -> 1 GWh = 1000 MWh
        coalT = (d.coal || 0) * 1000 * 0.90;
        gasT = (d.gas || 0) * 1000 * 0.38;
        oilT = (d.oil || 0) * 1000 * 0.75;
      } else {
        // Data is in MW (1d / 3d / 7d)
        const intervalHours = range === "1d" ? 5.0 / 60.0 : 0.5;
        coalT = (d.coal || 0) * intervalHours * 0.90;
        gasT = (d.gas || 0) * intervalHours * 0.38;
        oilT = (d.oil || 0) * intervalHours * 0.75;
      }
      const total = coalT + gasT + oilT;

      if (isPercentage) {
        const cPct = total > 0 ? (coalT / total) * 100 : 0;
        const gPct = total > 0 ? (gasT / total) * 100 : 0;
        const oPct = total > 0 ? (oilT / total) * 100 : 0;
        return {
          coal: total > 0 ? Math.round(cPct * 10) / 10 : null,
          gas: total > 0 ? Math.round(gPct * 10) / 10 : null,
          oil: total > 0 ? Math.round(oPct * 10) / 10 : null,
          rawCoal: Math.round(coalT * 10) / 10,
          rawGas: Math.round(gasT * 10) / 10,
          rawOil: Math.round(oilT * 10) / 10,
          total: 100,
          rawTotal: Math.round(total * 10) / 10,
        };
      }

      return {
        coal: Math.round(coalT * 10) / 10,
        gas: Math.round(gasT * 10) / 10,
        oil: Math.round(oilT * 10) / 10,
        rawCoal: Math.round(coalT * 10) / 10,
        rawGas: Math.round(gasT * 10) / 10,
        rawOil: Math.round(oilT * 10) / 10,
        total: Math.round(total * 10) / 10,
        rawTotal: Math.round(total * 10) / 10,
      };
    });
  }, [data, isPercentage]);

  const avgEmissions = useMemo(() => {
    if (!emissionsData || emissionsData.length === 0) return 0;
    const validData = emissionsData.filter((d) => d.rawTotal > 0);
    if (validData.length === 0) return 0;
    const total = validData.reduce((acc, d) => acc + d.rawTotal, 0);
    return Math.round(total / validData.length);
  }, [emissionsData]);

  const option = useMemo(() => {
    const coalMeta = getFuelMeta("coal", isDark);
    const oilMeta = getFuelMeta("oil", isDark);
    const gasMeta = getFuelMeta("gas", isDark);

    const gridLineColor = isDark ? "rgba(255, 255, 255, 0.07)" : "#F1F5F9";

    const isAnyFuelFocused = Boolean(hoveredFuel);

    const getSeriesStyle = (fuel: "coal" | "oil" | "gas", defaultColor: string) => {
      if (!isAnyFuelFocused) {
        return {
          color: defaultColor,
          opacity: 0.98,
          lineWidth: 0.5,
          lineColor: isDark ? "#3F3F46" : "#ffffff33",
          z: 2,
        };
      }
      if (hoveredFuel === fuel) {
        return {
          color: defaultColor,
          opacity: 1.0,
          lineWidth: 2.0,
          lineColor: isDark ? "#FFFFFF" : "#0F172A",
          z: 10,
        };
      }
      return {
        color: isDark ? "#27272A" : "#CBD5E1",
        opacity: isDark ? 0.15 : 0.22,
        lineWidth: 0,
        lineColor: "transparent",
        z: 1,
      };
    };

    const coalStyle = getSeriesStyle("coal", coalMeta.color);
    const oilStyle = getSeriesStyle("oil", oilMeta.color);
    const gasStyle = getSeriesStyle("gas", gasMeta.color);

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
            isPercentage ? `${v}%` : isMobile ? formatCompactValue(v) : `${v.toLocaleString()}`,
        },
        splitLine: {
          lineStyle: { color: gridLineColor, type: "dashed" },
        },
      },
      series: [
        {
          name: "Coal",
          type: isBarView ? "bar" : "line",
          stack: "Emissions",
          barCategoryGap: "0%",
          barWidth: "100%",
          z: coalStyle.z,
          ...(isBarView
            ? {
              itemStyle: {
                color: coalStyle.color,
                opacity: coalStyle.opacity,
                borderColor: isDark ? "rgba(0, 0, 0, 0.35)" : "rgba(255, 255, 255, 0.45)",
                borderWidth: 0.4,
              },
            }
            : {
              areaStyle: { color: coalStyle.color, opacity: coalStyle.opacity },
              lineStyle: { width: coalStyle.lineWidth, color: coalStyle.lineColor },
              itemStyle: { color: coalMeta.color },
            }),
          showSymbol: false,
          data: emissionsData.map((d) => d.coal),
        },
        {
          name: "Distillate",
          type: isBarView ? "bar" : "line",
          stack: "Emissions",
          barCategoryGap: "0%",
          barWidth: "100%",
          z: oilStyle.z,
          ...(isBarView
            ? {
              itemStyle: {
                color: oilStyle.color,
                opacity: oilStyle.opacity,
                borderColor: isDark ? "rgba(0, 0, 0, 0.35)" : "rgba(255, 255, 255, 0.45)",
                borderWidth: 0.4,
              },
            }
            : {
              areaStyle: { color: oilStyle.color, opacity: oilStyle.opacity },
              lineStyle: { width: oilStyle.lineWidth, color: oilStyle.lineColor },
              itemStyle: { color: oilMeta.color },
            }),
          showSymbol: false,
          data: emissionsData.map((d) => d.oil),
        },
        {
          name: "Gas",
          type: isBarView ? "bar" : "line",
          stack: "Emissions",
          barCategoryGap: "0%",
          barWidth: "100%",
          z: gasStyle.z,
          ...(isBarView
            ? {
              itemStyle: {
                color: gasStyle.color,
                opacity: gasStyle.opacity,
                borderColor: isDark ? "rgba(0, 0, 0, 0.35)" : "rgba(255, 255, 255, 0.45)",
                borderWidth: 0.4,
              },
            }
            : {
              areaStyle: { color: gasStyle.color, opacity: gasStyle.opacity },
              lineStyle: { width: gasStyle.lineWidth, color: gasStyle.lineColor },
              itemStyle: { color: gasMeta.color },
            }),
          showSymbol: false,
          data: emissionsData.map((d) => d.gas),
        },
      ],
    };
  }, [data, emissionsData, range, isPercentage, isBarView, xAxisConfig, tooltipConfig, isDark, hoveredFuel, isMobile]);

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

  const emissionsUnitLabel = useMemo(() => {
    if (isPercentage) return "%";
    if (range === "30d") return "tCO₂e/day";
    if (range === "1y") return "tCO₂e/week";
    if (range === "1d") return "tCO₂e/5m";
    return "tCO₂e/30m";
  }, [isPercentage, range]);

  return (
    <ChartCard onMouseLeave={() => onHoverPoint?.(null)}>
      <ChartCardHeader className="py-2 px-3 sm:px-4">
        <ChartCardTitle className="flex-wrap gap-1.5 sm:gap-2">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <CloudFog className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 dark:text-neutral-400" />
            <span className="text-xs sm:text-sm">
              Emissions ({emissionsUnitLabel})
            </span>
          </div>
          <div className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-neutral-100 dark:bg-[#18181B] text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-800 font-mono shadow-xs">
            Av.{" "}
            <strong className="ml-1 text-neutral-950 dark:text-white font-bold">
              {avgEmissions.toLocaleString()} tCO₂e
            </strong>
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
