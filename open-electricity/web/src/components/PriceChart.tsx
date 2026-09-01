"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { Menu } from "lucide-react";

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
  height = "160px",
}: PriceChartProps) {
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

  const prices = useMemo(() => {
    return data.map((d) => d.price || 0);
  }, [data]);

  const avgPrice = useMemo(() => {
    if (!prices || prices.length === 0) return 0;
    const total = prices.reduce((acc, p) => acc + p, 0);
    return Math.round(total / prices.length);
  }, [prices]);

  const option = useMemo(() => {
    return {
      backgroundColor: "#FFFFFF",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
          lineStyle: { color: "#64748B", width: 1, type: "dashed" },
        },
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        borderColor: "#E2E8F0",
        borderWidth: 1,
        padding: [6, 10],
        extraCssText: "box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;",
        textStyle: { color: "#0F172A", fontSize: 11 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const p = params[0];
          const val = Number(p.value) || 0;
          return `<div class="font-sans min-w-[150px]">
            <div class="text-neutral-500 text-[10px] mb-1">${p.axisValue}</div>
            <div class="flex items-center justify-between space-x-3 text-xs">
              <span class="font-semibold text-rose-600">Spot Price:</span>
              <span class="font-mono font-bold text-neutral-900">${currencySymbol}${Math.round(val).toLocaleString()} /MWh</span>
            </div>
          </div>`;
        },
      },
      grid: {
        left: 50,
        right: 20,
        bottom: 25,
        top: 10,
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
          formatter: (v: number) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}`,
        },
        splitLine: {
          lineStyle: { color: "#F1F5F9", type: "dashed" },
        },
      },
      series: [
        {
          name: "Wholesale Spot Price",
          type: "line",
          data: prices,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 1.6,
            color: "#E11D48",
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(225, 29, 72, 0.15)" },
                { offset: 1, color: "rgba(225, 29, 72, 0.00)" },
              ],
            },
          },
        },
      ],
    };
  }, [timestamps, prices, currencySymbol, currencyCode]);

  return (
    <div className="bg-white border border-neutral-200 rounded-sm">
      {/* Chart Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 bg-neutral-50/50">
        <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-800">
          <Menu className="h-3.5 w-3.5 text-neutral-400" />
          <span>Wholesale Spot Price</span>
          <span className="text-[11px] font-normal text-neutral-500 font-mono">
            ({currencyCode} / MWh)
          </span>
        </div>
        <div className="text-[11px] font-medium text-neutral-500 font-mono">
          Av. <strong className="text-neutral-900 font-bold">{currencySymbol}{avgPrice.toLocaleString()} /MWh</strong>
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
