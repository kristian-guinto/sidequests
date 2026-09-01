"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint, ViewMode } from "@/lib/types";
import { FUEL_META } from "@/lib/colors";
import { computeXAxisConfig, SHADCN_TOOLTIP_CONFIG } from "@/lib/chartUtils";
import {
  ChartCard,
  ChartCardHeader,
  ChartCardTitle,
  ChartCardDescription,
  ChartCardContent,
} from "@/components/ui/ChartCard";
import { format, parseISO } from "date-fns";
import { CloudFog } from "lucide-react";

interface EmissionsChartProps {
  data: FuelGenerationPoint[];
  viewMode?: ViewMode;
  height?: string;
  onHoverPoint?: (pt: FuelGenerationPoint | null) => void;
}

export function EmissionsChart({
  data,
  viewMode = "stacked",
  height = "180px",
  onHoverPoint,
}: EmissionsChartProps) {
  const isPercentage = viewMode === "percentage";
  const xAxisConfig = useMemo(() => computeXAxisConfig(data), [data]);

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
    return {
      backgroundColor: "transparent",
      animation: false,
      tooltip: {
        ...SHADCN_TOOLTIP_CONFIG,
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const idx = params[0].dataIndex;
          const rawPt = data[idx];
          const item = emissionsData[idx];
          let formattedTime = params[0].axisValue;
          if (rawPt?.timestamp) {
            try {
              formattedTime = format(parseISO(rawPt.timestamp), "d MMM yyyy, h:mm a");
            } catch {}
          }

          const rows = params.map((p) => {
            const val = Number(p.value) || 0;
            return { name: p.seriesName, val, color: p.color };
          });

          let html = `<div class="font-sans min-w-[190px]">
            <div class="border-b border-neutral-100 pb-1.5 mb-2 flex justify-between items-center text-xs">
              <span class="text-neutral-500 font-medium">${formattedTime}</span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 font-bold text-neutral-900 font-mono">${isPercentage ? "100%" : `${item.total.toFixed(1)} tCO₂e`}</span>
            </div>`;

          rows.reverse().forEach((r) => {
            if (r.val > 0) {
              const displayVal = isPercentage ? `${r.val.toFixed(1)}%` : `${r.val.toFixed(1)} tCO₂e`;
              html += `<div class="flex justify-between items-center py-0.5 text-xs">
                <span class="flex items-center text-neutral-600">
                  <span class="w-2.5 h-2.5 rounded-[3px] mr-2" style="background-color:${r.color}"></span>
                  ${r.name}
                </span>
                <span class="font-mono text-neutral-900 font-medium">${displayVal}</span>
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
          lineStyle: { color: "#F1F5F9", type: "dashed" },
        },
      },
      yAxis: {
        type: "value",
        min: isPercentage ? 0 : undefined,
        max: isPercentage ? 100 : undefined,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748B",
          fontSize: 10,
          margin: 12,
          formatter: (v: number) => (isPercentage ? `${v}%` : `${v.toLocaleString()}`),
        },
        splitLine: {
          lineStyle: { color: "#F1F5F9", type: "dashed" },
        },
      },
      series: [
        {
          name: "Coal",
          type: "line",
          stack: "Emissions",
          areaStyle: { color: FUEL_META.coal.color, opacity: 0.98 },
          lineStyle: { width: 0.3, color: "#ffffff33" },
          itemStyle: { color: FUEL_META.coal.color },
          showSymbol: false,
          data: emissionsData.map((d) => d.coal),
        },
        {
          name: "Distillate",
          type: "line",
          stack: "Emissions",
          areaStyle: { color: FUEL_META.oil.color, opacity: 0.98 },
          lineStyle: { width: 0.3, color: "#ffffff33" },
          itemStyle: { color: FUEL_META.oil.color },
          showSymbol: false,
          data: emissionsData.map((d) => d.oil),
        },
        {
          name: "Gas",
          type: "line",
          stack: "Emissions",
          areaStyle: { color: FUEL_META.gas.color, opacity: 0.98 },
          lineStyle: { width: 0.3, color: "#ffffff33" },
          itemStyle: { color: FUEL_META.gas.color },
          showSymbol: false,
          data: emissionsData.map((d) => d.gas),
        },
      ],
    };
  }, [data, emissionsData, isPercentage, xAxisConfig]);

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
            <CloudFog className="h-4 w-4 text-neutral-500" />
            <span>
              {isPercentage ? "Emissions Contribution Share" : "Emissions Volume"}
            </span>
            <span className="text-xs font-normal text-neutral-400 font-mono">
              ({isPercentage ? "% Share" : "tCO₂e/5m"})
            </span>
          </div>
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200/60 font-mono shadow-xs">
            Av.{" "}
            <strong className="ml-1 text-neutral-950 font-bold">
              {avgEmissions.toLocaleString()} tCO₂e
            </strong>
          </div>
        </ChartCardTitle>
        <ChartCardDescription>
          {isPercentage
            ? "100% relative emissions contribution breakdown by thermal fossil fuel source"
            : "Estimated greenhouse gas emissions volume generated from thermal fossil fuels"}
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
