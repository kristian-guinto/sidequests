"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint, ViewMode } from "@/lib/types";
import { FUEL_META } from "@/lib/colors";
import { format, parseISO } from "date-fns";
import { Menu } from "lucide-react";

interface GenerationChartProps {
  data: FuelGenerationPoint[];
  viewMode: ViewMode;
  unit?: "MW" | "GWh";
  height?: string;
}

const FUEL_ORDER = [
  "battery",
  "oil",
  "coal",
  "gas",
  "biomass",
  "geothermal",
  "hydro",
  "wind",
  "solar",
] as const;

export function GenerationChart({
  data,
  viewMode,
  unit = "MW",
  height = "320px",
}: GenerationChartProps) {
  const timestamps = useMemo(() => {
    return data.map((d) => {
      try {
        if (d.timestamp.includes("T")) {
          return format(parseISO(d.timestamp), "EEE d MMM HH:mm");
        } else if (d.timestamp.includes("-") && d.timestamp.length === 10) {
          return format(parseISO(d.timestamp), "EEE d MMM");
        }
        return d.timestamp;
      } catch {
        return d.timestamp;
      }
    });
  }, [data]);

  const avgGeneration = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const totalSum = data.reduce((acc, d) => acc + (d.totalGeneration || 0), 0);
    return Math.round(totalSum / data.length);
  }, [data]);

  const option = useMemo(() => {
    const isCumulative = viewMode === "cumulative";
    const isEnergy = unit === "GWh";

    const series = FUEL_ORDER.map((fuel) => {
      const meta = FUEL_META[fuel];
      const seriesData = data.map((d) => d[fuel] || 0);

      return {
        name: meta.label,
        type: "line",
        stack: "TotalGeneration",
        areaStyle: {
          color: meta.color,
          opacity: 0.95,
        },
        lineStyle: {
          width: 0.4,
          color: "#ffffff55",
        },
        itemStyle: {
          color: meta.color,
        },
        showSymbol: false,
        data: seriesData,
        smooth: false,
      };
    });

    // Overlaid Demand Line in discrete mode
    if (!isCumulative) {
      series.push({
        name: "Total Demand",
        type: "line",
        stack: undefined as any,
        areaStyle: undefined as any,
        lineStyle: {
          width: 2.0,
          color: "#0F172A",
          type: "solid",
        },
        itemStyle: {
          color: "#0F172A",
        },
        showSymbol: false,
        data: data.map((d) => d.demand || 0),
        smooth: true,
      });
    }

    return {
      backgroundColor: "#FFFFFF",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
          lineStyle: {
            color: "#64748B",
            width: 1,
            type: "dashed",
          },
        },
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        borderColor: "#E2E8F0",
        borderWidth: 1,
        padding: [8, 12],
        extraCssText: "box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;",
        textStyle: {
          color: "#0F172A",
          fontSize: 11,
        },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const time = params[0].axisValue;
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

          let html = `<div class="font-sans min-w-[190px]">
            <div class="border-b border-neutral-200 pb-1 mb-1.5 flex justify-between items-center text-[11px]">
              <span class="text-neutral-500">${time}</span>
              <span class="font-bold text-neutral-900">${formattedTotal} ${unitStr}</span>
            </div>`;

          if (demandVal > 0) {
            const formattedDemand = isEnergy ? demandVal.toFixed(2) : Math.round(demandVal).toLocaleString();
            html += `<div class="flex justify-between items-center py-0.5 text-[11px] text-neutral-700 font-medium">
              <span class="flex items-center"><span class="w-2 h-2 rounded-full mr-1.5 bg-neutral-900"></span>Demand:</span>
              <span class="font-bold text-neutral-900">${formattedDemand} ${unitStr}</span>
            </div><div class="border-b border-neutral-100 my-1"></div>`;
          }

          rows.sort((a, b) => b.val - a.val).forEach((r) => {
            if (r.val > 0) {
              const pct = total > 0 ? ((r.val / total) * 100).toFixed(1) : "0";
              const valStr = isEnergy ? r.val.toFixed(2) : Math.round(r.val).toLocaleString();
              html += `<div class="flex justify-between items-center py-0.5 text-[11px]">
                <span class="flex items-center text-neutral-600">
                  <span class="w-2 h-2 rounded-sm mr-1.5" style="background-color:${r.color}"></span>
                  ${r.name}:
                </span>
                <span class="font-mono text-neutral-800 font-medium">${valStr} ${unitStr} <span class="text-neutral-400 text-[10px]">(${pct}%)</span></span>
              </div>`;
            }
          });

          html += `</div>`;
          return html;
        },
      },
      grid: {
        left: 50,
        right: 20,
        bottom: 25,
        top: 15,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: timestamps,
        axisLine: { lineStyle: { color: "#E2E8F0" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748B",
          fontSize: 10,
          interval: "auto",
          formatter: (val: string) => {
            const parts = val.split(" ");
            return parts.length >= 3 ? `${parts[0]}\n${parts[1]} ${parts[2]}` : val;
          },
        },
        splitLine: {
          show: true,
          lineStyle: { color: "#F8FAFC", type: "solid" },
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748B",
          fontSize: 10,
          formatter: (v: number) => (isEnergy ? `${v}` : `${v.toLocaleString()}`),
        },
        splitLine: {
          lineStyle: { color: "#F1F5F9", type: "dashed" },
        },
      },
      series,
    };
  }, [data, timestamps, viewMode, unit]);

  return (
    <div className="bg-white border border-neutral-200 rounded-sm">
      {/* Chart Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 bg-neutral-50/50">
        <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-800">
          <Menu className="h-3.5 w-3.5 text-neutral-400" />
          <span>Generation</span>
          <span className="text-[11px] font-normal text-neutral-500 font-mono">({unit})</span>
        </div>
        <div className="text-[11px] font-medium text-neutral-500 font-mono">
          Av. <strong className="text-neutral-900 font-bold">{avgGeneration.toLocaleString()} {unit}</strong>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="p-2">
        <ReactECharts
          option={option}
          style={{ height, width: "100%" }}
          notMerge={true}
          lazyUpdate={false}
        />
      </div>
    </div>
  );
}
