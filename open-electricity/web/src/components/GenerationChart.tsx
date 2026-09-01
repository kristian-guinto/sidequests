"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint, ViewMode } from "@/lib/types";
import { FUEL_META } from "@/lib/colors";
import { format, parseISO } from "date-fns";

interface GenerationChartProps {
  data: FuelGenerationPoint[];
  viewMode: ViewMode;
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

export function GenerationChart({ data, viewMode, height = "420px" }: GenerationChartProps) {
  const timestamps = useMemo(() => {
    return data.map((d) => {
      try {
        return format(parseISO(d.timestamp), "dd MMM HH:mm");
      } catch {
        return d.timestamp;
      }
    });
  }, [data]);

  const option = useMemo(() => {
    const isCumulative = viewMode === "cumulative";

    const series = FUEL_ORDER.map((fuel) => {
      const meta = FUEL_META[fuel];
      const seriesData = data.map((d) => d[fuel] || 0);

      return {
        name: meta.label,
        type: "line",
        stack: "TotalGeneration",
        areaStyle: {
          color: meta.color,
          opacity: 0.9,
        },
        lineStyle: {
          width: 0.5,
          color: "#ffffff33",
        },
        itemStyle: {
          color: meta.color,
        },
        showSymbol: false,
        data: seriesData,
        smooth: true,
      };
    });

    // Overlaid Demand Line (only in discrete view)
    if (!isCumulative) {
      series.push({
        name: "Total Demand",
        type: "line",
        stack: undefined as any,
        areaStyle: undefined as any,
        lineStyle: {
          width: 2.2,
          color: "#F3F4F6", // bright white-gray
          type: "solid",
        },
        itemStyle: {
          color: "#F3F4F6",
        },
        showSymbol: false,
        data: data.map((d) => d.demand || 0),
        smooth: true,
      });
    }

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          label: {
            backgroundColor: "#374151",
          },
        },
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        borderColor: "#374151",
        textStyle: {
          color: "#F3F4F6",
          fontSize: 12,
        },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          let time = params[0].axisValue;
          let total = 0;
          let demandVal = 0;

          const rows = params
            .filter((p) => p.seriesName !== "Total Demand")
            .map((p) => {
              const val = Number(p.value) || 0;
              total += val;
              return {
                name: p.seriesName,
                val,
                color: p.color,
              };
            });

          const demandItem = params.find((p) => p.seriesName === "Total Demand");
          if (demandItem) {
            demandVal = Number(demandItem.value) || 0;
          }

          let tooltipHtml = `<div class="p-1 font-sans">
            <div class="font-semibold text-slate-300 border-b border-slate-700 pb-1 mb-1.5 flex justify-between">
              <span>${time}</span>
              <span>Total: <strong class="text-white">${Math.round(total).toLocaleString()} MW</strong></span>
            </div>`;

          if (demandVal > 0) {
            tooltipHtml += `<div class="flex justify-between items-center py-0.5 text-xs text-slate-300 font-medium">
              <span class="flex items-center"><span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5 bg-white border"></span>Total Demand:</span>
              <span class="font-semibold text-white">${Math.round(demandVal).toLocaleString()} MW</span>
            </div><div class="border-b border-slate-700/50 my-1"></div>`;
          }

          rows
            .sort((a, b) => b.val - a.val)
            .forEach((r) => {
              if (r.val > 0) {
                const pct = total > 0 ? ((r.val / total) * 100).toFixed(1) : "0";
                tooltipHtml += `<div class="flex justify-between items-center py-0.5 text-xs">
                  <span class="flex items-center"><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style="background-color:${r.color}"></span>${r.name}:</span>
                  <span class="font-mono text-slate-200">${Math.round(r.val).toLocaleString()} MW <span class="text-slate-400 text-[10px]">(${pct}%)</span></span>
                </div>`;
              }
            });

          tooltipHtml += `</div>`;
          return tooltipHtml;
        },
      },
      legend: {
        data: [...FUEL_ORDER.map((f) => FUEL_META[f].label), "Total Demand"],
        top: 0,
        right: 10,
        textStyle: {
          color: "#9CA3AF",
          fontSize: 11,
        },
        icon: "circle",
        itemGap: 12,
      },
      grid: {
        left: "3%",
        right: "3%",
        bottom: "8%",
        top: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: timestamps,
        axisLine: { lineStyle: { color: "#4B5563" } },
        axisLabel: { color: "#9CA3AF", fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "Generation (MW)",
        nameTextStyle: { color: "#9CA3AF", fontSize: 11 },
        axisLine: { lineStyle: { color: "#4B5563" } },
        axisLabel: {
          color: "#9CA3AF",
          fontSize: 11,
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`),
        },
        splitLine: { lineStyle: { color: "#1F2937", type: "dashed" } },
      },
      dataZoom: [
        {
          type: "inside",
          start: 0,
          end: 100,
        },
        {
          type: "slider",
          show: true,
          bottom: 0,
          height: 16,
          borderColor: "#374151",
          fillerColor: "rgba(16, 185, 129, 0.15)",
          textStyle: { color: "#9CA3AF", fontSize: 10 },
          handleStyle: { color: "#10B981" },
        },
      ],
      series,
    };
  }, [data, timestamps, viewMode]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-slate-200 tracking-tight flex items-center space-x-2">
          <span>Electricity Generation by Fuel Technology</span>
          <span className="text-xs font-normal text-slate-400">(MW)</span>
        </h3>
      </div>
      <ReactECharts option={option} style={{ height, width: "100%" }} notMerge={true} lazyUpdate={true} />
    </div>
  );
}

