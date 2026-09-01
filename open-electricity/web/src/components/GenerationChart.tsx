"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint, ViewMode } from "@/lib/types";
import { FUEL_META } from "@/lib/colors";
import { format, parseISO } from "date-fns";

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
  height = "420px",
}: GenerationChartProps) {
  const timestamps = useMemo(() => {
    return data.map((d) => {
      try {
        if (d.timestamp.includes("T")) {
          return format(parseISO(d.timestamp), "dd MMM HH:mm");
        } else if (d.timestamp.includes("-") && d.timestamp.length === 10) {
          return format(parseISO(d.timestamp), "dd MMM");
        }
        return d.timestamp;
      } catch {
        return d.timestamp;
      }
    });
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
          opacity: 0.92,
        },
        lineStyle: {
          width: 0.5,
          color: "#ffffff66",
        },
        itemStyle: {
          color: meta.color,
        },
        showSymbol: false,
        data: seriesData,
        smooth: true,
      };
    });

    // Overlaid Demand Line (discrete mode)
    if (!isCumulative) {
      series.push({
        name: "Total Demand",
        type: "line",
        stack: undefined as any,
        areaStyle: undefined as any,
        lineStyle: {
          width: 2.2,
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
          type: "cross",
          lineStyle: {
            color: "#94A3B8",
            type: "dashed",
          },
          label: {
            backgroundColor: "#0F172A",
            color: "#FFFFFF",
          },
        },
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        borderColor: "#E2E8F0",
        borderWidth: 1,
        extraCssText:
          "box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border-radius: 8px;",
        textStyle: {
          color: "#0F172A",
          fontSize: 12,
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

          const unitStr = isEnergy ? "GWh" : "MW";
          const formattedTotal = isEnergy
            ? total.toFixed(2)
            : Math.round(total).toLocaleString();

          let tooltipHtml = `<div class="p-1 font-sans min-w-[210px]">
            <div class="font-semibold text-slate-800 border-b border-slate-200 pb-1.5 mb-1.5 flex justify-between items-center text-xs">
              <span class="text-slate-500">${time}</span>
              <span>Total: <strong class="text-slate-900 font-bold">${formattedTotal} ${unitStr}</strong></span>
            </div>`;

          if (demandVal > 0) {
            const formattedDemand = isEnergy
              ? demandVal.toFixed(2)
              : Math.round(demandVal).toLocaleString();
            tooltipHtml += `<div class="flex justify-between items-center py-0.5 text-xs text-slate-700 font-medium">
              <span class="flex items-center"><span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5 bg-slate-900"></span>Total Demand:</span>
              <span class="font-bold text-slate-900">${formattedDemand} ${unitStr}</span>
            </div><div class="border-b border-slate-100 my-1"></div>`;
          }

          rows
            .sort((a, b) => b.val - a.val)
            .forEach((r) => {
              if (r.val > 0) {
                const pct = total > 0 ? ((r.val / total) * 100).toFixed(1) : "0";
                const valStr = isEnergy
                  ? r.val.toFixed(2)
                  : Math.round(r.val).toLocaleString();
                tooltipHtml += `<div class="flex justify-between items-center py-0.5 text-xs">
                  <span class="flex items-center text-slate-600"><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 flex-shrink-0" style="background-color:${r.color}"></span>${r.name}:</span>
                  <span class="font-mono text-slate-800 font-medium">${valStr} ${unitStr} <span class="text-slate-400 text-[10px]">(${pct}%)</span></span>
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
          color: "#475569",
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
        axisLine: { lineStyle: { color: "#CBD5E1" } },
        axisLabel: { color: "#64748B", fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: isEnergy ? "Energy (GWh)" : "Generation (MW)",
        nameTextStyle: { color: "#64748B", fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748B",
          fontSize: 11,
          formatter: (v: number) => {
            if (isEnergy) return `${v}`;
            return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;
          },
        },
        splitLine: { lineStyle: { color: "#F1F5F9", type: "solid" } },
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
          height: 14,
          borderColor: "#E2E8F0",
          fillerColor: "rgba(16, 185, 129, 0.15)",
          textStyle: { color: "#64748B", fontSize: 10 },
          handleStyle: { color: "#10B981" },
        },
      ],
      series,
    };
  }, [data, timestamps, viewMode, unit]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <span>
            {unit === "GWh"
              ? "Electricity Energy by Fuel Technology"
              : "Electricity Generation by Fuel Technology"}
          </span>
          <span className="text-xs font-normal text-slate-500">({unit})</span>
        </h3>
      </div>
      <ReactECharts option={option} style={{ height, width: "100%" }} notMerge={true} lazyUpdate={true} />
    </div>
  );
}
