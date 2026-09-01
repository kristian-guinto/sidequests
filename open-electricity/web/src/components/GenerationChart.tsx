"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint, ViewMode } from "@/lib/types";
import { FUEL_META } from "@/lib/colors";
import { computeXAxisConfig, createShadcnGradient, SHADCN_TOOLTIP_CONFIG } from "@/lib/chartUtils";
import {
  ChartCard,
  ChartCardHeader,
  ChartCardTitle,
  ChartCardDescription,
  ChartCardContent,
} from "@/components/ui/ChartCard";
import { format, parseISO } from "date-fns";
import { Zap } from "lucide-react";

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
  const avgGeneration = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const totalSum = data.reduce((acc, d) => acc + (d.totalGeneration || 0), 0);
    return Math.round(totalSum / data.length);
  }, [data]);

  const xAxisConfig = useMemo(() => computeXAxisConfig(data), [data]);

  const option = useMemo(() => {
    const isCumulative = viewMode === "cumulative";
    const isEnergy = unit === "GWh";

    const series = FUEL_ORDER.map((fuel) => {
      const meta = FUEL_META[fuel];
      const seriesData = data.map((d) => d[fuel] || 0);

      return {
        name: meta.label,
        type: "line",
        stack: isCumulative ? "TotalGeneration" : undefined,
        areaStyle: {
          color: isCumulative ? meta.color : createShadcnGradient(meta.color, 0.4, 0.02),
          opacity: isCumulative ? 0.98 : 1.0,
        },
        lineStyle: {
          width: isCumulative ? 0.3 : 1.8,
          color: isCumulative ? "#ffffff33" : meta.color,
        },
        itemStyle: {
          color: meta.color,
        },
        showSymbol: false,
        data: seriesData,
        smooth: !isCumulative,
      };
    });

    if (!isCumulative) {
      series.push({
        name: "Total Demand",
        type: "line",
        stack: undefined as any,
        areaStyle: undefined as any,
        lineStyle: {
          width: 2.0,
          color: "#0F172A",
        } as any,
        itemStyle: {
          color: "#0F172A",
        },
        showSymbol: false,
        data: data.map((d) => d.demand || 0),
        smooth: true,
      });
    }

    return {
      backgroundColor: "transparent",
      animation: false,
      tooltip: {
        ...SHADCN_TOOLTIP_CONFIG,
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

          let total = 0;
          let demandVal = 0;

          const rows = params
            .filter((p) => p.seriesName !== "Total Demand")
            .map((p) => {
              const val = Number(p.value) || 0;
              total += val;
              return { name: p.seriesName, val, color: p.color };
            });

          const demandItem = params.find((p) => p.seriesName === "Total Demand");
          if (demandItem) demandVal = Number(demandItem.value) || 0;

          const unitStr = isEnergy ? "GWh" : "MW";
          const formattedTotal = isEnergy ? total.toFixed(2) : Math.round(total).toLocaleString();

          let html = `<div class="font-sans min-w-[210px]">
            <div class="border-b border-neutral-100 pb-1.5 mb-2 flex justify-between items-center text-xs">
              <span class="text-neutral-500 font-medium">${formattedTime}</span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 font-bold text-neutral-900 font-mono">${formattedTotal} ${unitStr}</span>
            </div>`;

          if (demandVal > 0) {
            const formattedDemand = isEnergy ? demandVal.toFixed(2) : Math.round(demandVal).toLocaleString();
            html += `<div class="flex justify-between items-center py-0.5 text-xs text-neutral-700 font-medium">
              <span class="flex items-center"><span class="w-2 h-2 rounded-full mr-2 bg-neutral-900"></span>Demand:</span>
              <span class="font-bold text-neutral-900 font-mono">${formattedDemand} ${unitStr}</span>
            </div><div class="border-b border-neutral-100 my-1"></div>`;
          }

          rows.sort((a, b) => b.val - a.val).forEach((r) => {
            if (r.val > 0) {
              const pct = total > 0 ? ((r.val / total) * 100).toFixed(1) : "0";
              const valStr = isEnergy ? r.val.toFixed(2) : Math.round(r.val).toLocaleString();
              html += `<div class="flex justify-between items-center py-0.5 text-xs">
                <span class="flex items-center text-neutral-600">
                  <span class="w-2.5 h-2.5 rounded-[3px] mr-2" style="background-color:${r.color}"></span>
                  ${r.name}
                </span>
                <span class="font-mono text-neutral-900 font-medium">${valStr} ${unitStr} <span class="text-neutral-400 text-[10px] ml-1">(${pct}%)</span></span>
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
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748B",
          fontSize: 10,
          margin: 12,
          formatter: (v: number) => (isEnergy ? `${v}` : `${v.toLocaleString()}`),
        },
        splitLine: {
          lineStyle: { color: "#F1F5F9", type: "dashed" },
        },
      },
      series,
    };
  }, [data, viewMode, unit, xAxisConfig]);

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
            <Zap className="h-4 w-4 text-amber-500" />
            <span>Generation &amp; Fuel Mix</span>
            <span className="text-xs font-normal text-neutral-400 font-mono">({unit})</span>
          </div>
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200/60 font-mono shadow-xs">
            Av. <strong className="ml-1 text-neutral-950 font-bold">{avgGeneration.toLocaleString()} {unit}</strong>
          </div>
        </ChartCardTitle>
        <ChartCardDescription>
          Real-time electricity dispatch aggregated across all connected power facilities
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
