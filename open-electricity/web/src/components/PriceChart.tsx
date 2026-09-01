"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint } from "@/lib/types";
import { format, parseISO } from "date-fns";

interface PriceChartProps {
  data: FuelGenerationPoint[];
  height?: string;
}

export function PriceChart({ data, height = "170px" }: PriceChartProps) {
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
      backgroundColor: "#FFFFFF",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          lineStyle: { color: "#94A3B8", type: "dashed" },
          label: { backgroundColor: "#0F172A", color: "#FFFFFF" },
        },
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        borderColor: "#E2E8F0",
        borderWidth: 1,
        extraCssText: "box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border-radius: 8px;",
        textStyle: { color: "#0F172A", fontSize: 12 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const p = params[0];
          const val = Number(p.value) || 0;
          return `<div class="p-1 font-sans">
            <div class="text-slate-500 text-xs mb-1">${p.axisValue}</div>
            <div class="flex items-center justify-between space-x-3 text-xs">
              <span class="font-semibold text-rose-600">Spot Price (LMP):</span>
              <span class="font-mono font-bold text-slate-900">₱${Math.round(val).toLocaleString()} /MWh</span>
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
        axisLine: { lineStyle: { color: "#CBD5E1" } },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "Price (₱/MWh)",
        nameTextStyle: { color: "#64748B", fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748B",
          fontSize: 10,
          formatter: (v: number) => `₱${v}`,
        },
        splitLine: { lineStyle: { color: "#F1F5F9", type: "solid" } },
      },
      series: [
        {
          name: "Spot Price (LMP)",
          type: "line",
          lineStyle: {
            width: 1.8,
            color: "#DC2626",
          },
          itemStyle: {
            color: "#DC2626",
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(220, 38, 38, 0.15)" },
                { offset: 1, color: "rgba(220, 38, 38, 0.0)" },
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
    <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm mt-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center space-x-2">
          <span>Wholesale Spot Price (WESM Average LMP)</span>
          <span className="text-[11px] font-normal text-slate-500">(PHP / MWh)</span>
        </h3>
      </div>
      <ReactECharts option={option} style={{ height, width: "100%" }} notMerge={true} lazyUpdate={true} />
    </div>
  );
}
