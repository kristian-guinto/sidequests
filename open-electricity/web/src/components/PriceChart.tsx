"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint } from "@/lib/types";
import { format, parseISO } from "date-fns";

interface PriceChartProps {
  data: FuelGenerationPoint[];
  height?: string;
}

export function PriceChart({ data, height = "180px" }: PriceChartProps) {
  const timestamps = useMemo(() => {
    return data.map((d) => {
      try {
        return format(parseISO(d.timestamp), "dd MMM HH:mm");
      } catch {
        return d.timestamp;
      }
    });
  }, [data]);

  const prices = useMemo(() => {
    return data.map((d) => d.price || 0);
  }, [data]);

  const option = useMemo(() => {
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          label: { backgroundColor: "#374151" },
        },
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        borderColor: "#374151",
        textStyle: { color: "#F3F4F6", fontSize: 12 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const p = params[0];
          const val = Number(p.value) || 0;
          return `<div class="p-1 font-sans">
            <div class="text-slate-400 text-xs mb-1">${p.axisValue}</div>
            <div class="flex items-center justify-between space-x-3 text-xs">
              <span class="font-semibold text-rose-400">Spot Price (LMP):</span>
              <span class="font-mono font-bold text-white">₱${Math.round(val).toLocaleString()} /MWh</span>
            </div>
          </div>`;
        },
      },
      grid: {
        left: "3%",
        right: "3%",
        bottom: "8%",
        top: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: timestamps,
        axisLine: { lineStyle: { color: "#4B5563" } },
        axisLabel: { show: false }, // synchronized with above chart
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "Price (₱/MWh)",
        nameTextStyle: { color: "#9CA3AF", fontSize: 10 },
        axisLine: { lineStyle: { color: "#4B5563" } },
        axisLabel: {
          color: "#9CA3AF",
          fontSize: 10,
          formatter: (v: number) => `₱${v}`,
        },
        splitLine: { lineStyle: { color: "#1F2937", type: "dashed" } },
      },
      series: [
        {
          name: "Spot Price (LMP)",
          type: "line",
          lineStyle: {
            width: 1.8,
            color: "#EF4444",
          },
          itemStyle: {
            color: "#EF4444",
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(239, 68, 68, 0.25)" },
                { offset: 1, color: "rgba(239, 68, 68, 0.0)" },
              ],
            },
          },
          showSymbol: false,
          data: prices,
          smooth: true,
        },
      ],
    };
  }, [timestamps, prices]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm mt-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-bold text-slate-300 tracking-tight flex items-center space-x-2">
          <span>Wholesale Spot Price (WESM Average LMP)</span>
          <span className="text-[11px] font-normal text-slate-400">(PHP / MWh)</span>
        </h3>
      </div>
      <ReactECharts option={option} style={{ height, width: "100%" }} notMerge={true} lazyUpdate={true} />
    </div>
  );
}

