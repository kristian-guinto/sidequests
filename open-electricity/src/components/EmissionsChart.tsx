"use client";

import React, { useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { FuelGenerationPoint, ViewMode, FuelTech } from "@/lib/types";
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
import { CloudFog } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface EmissionsChartProps {
  data: FuelGenerationPoint[];
  viewMode?: ViewMode;
  height?: string;
  hoveredFuel?: FuelTech | null;
  onHoverPoint?: (pt: FuelGenerationPoint | null) => void;
}

export function EmissionsChart({
  data,
  viewMode = "stacked",
  height = "180px",
  hoveredFuel,
  onHoverPoint,
}: EmissionsChartProps) {
  const { isDark } = useTheme();
  const isPercentage = viewMode === "percentage";
  const xAxisConfig = useMemo(() => computeXAxisConfig(data, isDark), [data, isDark]);
  const tooltipConfig = useMemo(() => getShadcnTooltipConfig(isDark), [isDark]);

  const emissionsData = useMemo(() => {
    return data.map((d) => {
      const coalT = (d.coal || 0) * (5.0 / 60.0) * 0.9;
      const gasT = (d.gas || 0) * (5.0 / 60.0) * 0.38;
      const oilT = (d.oil || 0) * (5.0 / 60.0) * 0.75;
      const total = coalT + gasT + oilT;

      if (isPercentage) {
        const cPct = total > 0 ? (coalT / total) * 100 : 0;
        const gPct = total > 0 ? (gasT / total) * 100 : 0;
        const oPct = total > 0 ? (oilT / total) * 100 : 0;
        return {
          coal: Math.round(cPct * 10) / 10,
          gas: Math.round(gPct * 10) / 10,
          oil: Math.round(oPct * 10) / 10,
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
    const total = emissionsData.reduce((acc, d) => acc + d.rawTotal, 0);
    return Math.round(total / emissionsData.length);
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
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const idx = params[0].dataIndex;
          const rawPt = data[idx];
          const item = emissionsData[idx];
          let formattedTime = params[0].axisValue;
          if (rawPt?.timestamp) {
            try {
              formattedTime = format(parseISO(rawPt.timestamp), "d MMM yyyy, h:mm a");
            } catch { }
          }

          const rows = params.map((p) => {
            const val = Number(p.value) || 0;
            return { name: p.seriesName, val, color: p.color };
          });

          const borderCls = isDark ? "border-[#27272A]" : "border-neutral-100";
          const textMuted = isDark ? "text-neutral-400" : "text-neutral-500";
          const pillBg = isDark
            ? "bg-[#27272A] text-neutral-100 border border-neutral-700"
            : "bg-neutral-100 text-neutral-900";
          const textPrimary = isDark ? "text-neutral-100" : "text-neutral-900";
          const textSecondary = isDark ? "text-neutral-300" : "text-neutral-600";

          let html = `<div class="font-sans min-w-[190px]">
            <div class="border-b ${borderCls} pb-1.5 mb-2 flex justify-between items-center text-xs">
              <span class="${textMuted} font-medium">${formattedTime}</span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded ${pillBg} font-bold font-mono">${isPercentage ? "100%" : `${item.total.toFixed(1)} tCO₂e`}</span>
            </div>`;

          rows.reverse().forEach((r) => {
            if (r.val > 0) {
              const displayVal = isPercentage ? `${r.val.toFixed(1)}%` : `${r.val.toFixed(1)} tCO₂e`;
              html += `<div class="flex justify-between items-center py-0.5 text-xs">
                <span class="flex items-center ${textSecondary}">
                  <span class="w-2.5 h-2.5 rounded-[3px] mr-2" style="background-color:${r.color}"></span>
                  ${r.name}
                </span>
                <span class="font-mono ${textPrimary} font-medium">${displayVal}</span>
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
          formatter: (v: number) => (isPercentage ? `${v}%` : `${v.toLocaleString()}`),
        },
        splitLine: {
          lineStyle: { color: gridLineColor, type: "dashed" },
        },
      },
      series: [
        {
          name: "Coal",
          type: "line",
          stack: "Emissions",
          z: coalStyle.z,
          areaStyle: { color: coalStyle.color, opacity: coalStyle.opacity },
          lineStyle: { width: coalStyle.lineWidth, color: coalStyle.lineColor },
          itemStyle: { color: coalMeta.color },
          showSymbol: false,
          data: emissionsData.map((d) => d.coal),
        },
        {
          name: "Distillate",
          type: "line",
          stack: "Emissions",
          z: oilStyle.z,
          areaStyle: { color: oilStyle.color, opacity: oilStyle.opacity },
          lineStyle: { width: oilStyle.lineWidth, color: oilStyle.lineColor },
          itemStyle: { color: oilMeta.color },
          showSymbol: false,
          data: emissionsData.map((d) => d.oil),
        },
        {
          name: "Gas",
          type: "line",
          stack: "Emissions",
          z: gasStyle.z,
          areaStyle: { color: gasStyle.color, opacity: gasStyle.opacity },
          lineStyle: { width: gasStyle.lineWidth, color: gasStyle.lineColor },
          itemStyle: { color: gasMeta.color },
          showSymbol: false,
          data: emissionsData.map((d) => d.gas),
        },
      ],
    };
  }, [data, emissionsData, isPercentage, xAxisConfig, tooltipConfig, isDark, hoveredFuel]);

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
      <ChartCardHeader className="py-2 px-3 sm:px-4">
        <ChartCardTitle>
          <div className="flex items-center space-x-2">
            <CloudFog className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            <span>
              Emissions ({isPercentage ? "%" : "tCO₂e/5m"})
            </span>
          </div>
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-[#18181B] text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-800 font-mono shadow-xs">
            Av.{" "}
            <strong className="ml-1 text-neutral-950 dark:text-white font-bold">
              {avgEmissions.toLocaleString()} tCO₂e
            </strong>
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
