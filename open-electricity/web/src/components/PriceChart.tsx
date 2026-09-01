"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint } from "@/lib/types";
import { format, parseISO } from "date-fns";

interface PriceChartProps {
  data: FuelGenerationPoint[];
  currencySymbol?: string;
  currencyCode?: string;
  height?: string;
}

export function PriceChart({
  data,
  currencySymbol = "₱",
  currencyCode = "PHP",
  height = "170px",
}: PriceChartProps) {
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
        extraCssText:
          "box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border-radius: 8px;",
        textStyle: { color: "#0F172A", fontSize: 12 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const p = params[0];
          const val = Number(p.value) || 0;
          return `<div class="p-1 font-sans">
            <div class="text-slate-500 text-xs mb-1">${p.axisValue}</div>
            <div class="flex items-center justify-between space-x-3 text-xs">
              <span class="font-semibold text-rose-600">Spot Market Price:</span>
              <span class="font-mono font-bold text-slate-900">${currencySymbol}${Math.round(val).toLocaleString()} /MWh</span>
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
        axisLabel: { color: "#64748B", fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: `Price (${currencyCode}/MWh)`,
        nameTextStyle: { color: "#64748B", fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748B",
          fontSize: 10,
          formatter: (v: number) => `${currencySymbol}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}`,
        },
        splitLine: { lineStyle: { color: "#F1F5F9", type: "solid" } },
      },
      series: [
        {
          name: "Wholesale Spot Price",
          type: "line",
          data: prices,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 1.8,
            color: "#E11D48", // rose-600
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(225, 29, 72, 0.20)" },
                { offset: 1, color: "rgba(225, 29, 72, 0.01)" },
              ],
            },
          },
        },
      ],
    };
  }, [timestamps, prices, currencySymbol, currencyCode]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm mt-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center space-x-2">
          <span>Wholesale Spot Electricity Price</span>
          <span className="text-[11px] font-normal text-slate-500">
            ({currencySymbol} {currencyCode} / MWh)
          </span>
        </h3>
      </div>
      <ReactECharts option={option} style={{ height, width: "100%" }} notMerge={true} lazyUpdate={false} />
    </div>
  );
}
