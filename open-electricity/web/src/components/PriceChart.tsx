"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint } from "@/lib/types";
import { computeXAxisConfig } from "@/lib/chartUtils";
import { format, parseISO } from "date-fns";
import { Menu } from "lucide-react";

interface PriceChartProps {
  data: FuelGenerationPoint[];
  currencySymbol?: string;
  currencyCode?: string;
  height?: string;
  onHoverPoint?: (pt: FuelGenerationPoint | null) => void;
}

export function PriceChart({
  data,
  currencySymbol = "₱",
  currencyCode = "PHP",
  height = "180px",
  onHoverPoint,
}: PriceChartProps) {
  const xAxisConfig = useMemo(() => computeXAxisConfig(data, true), [data]);

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
      animation: false,
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
        extraCssText: "box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px; z-index: 100;",
        textStyle: { color: "#0F172A", fontSize: 11 },
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

          const val = Number(params[0].value) || 0;
          return `<div class="font-sans min-w-[170px]">
            <div class="text-neutral-500 font-medium text-[11px] mb-1">${formattedTime}</div>
            <div class="flex items-center justify-between space-x-3 text-xs border-t border-neutral-100 pt-1">
              <span class="font-semibold text-rose-600">Spot Price:</span>
              <span class="font-mono font-bold text-neutral-900">${currencySymbol}${Math.round(
            val
          ).toLocaleString()} /MWh</span>
            </div>
          </div>`;
        },
      },
      grid: xAxisConfig.grid,
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: xAxisConfig.timestamps,
        axisLine: { lineStyle: { color: "#E2E8F0" } },
        axisTick: { show: false },
        axisLabel: xAxisConfig.axisLabel,
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
          margin: 12,
          formatter: (v: number) =>
            `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}`,
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
                { offset: 0, color: "rgba(225, 29, 72, 0.12)" },
                { offset: 1, color: "rgba(225, 29, 72, 0.00)" },
              ],
            },
          },
        },
      ],
    };
  }, [data, prices, currencySymbol, xAxisConfig]);

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
    <div
      className="bg-white border border-neutral-200 rounded-sm overflow-hidden"
      onMouseLeave={() => onHoverPoint?.(null)}
    >
      {/* Chart Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-neutral-100 bg-neutral-50/50">
        <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-800">
          <Menu className="h-3.5 w-3.5 text-neutral-400" />
          <span>Wholesale Spot Price</span>
          <span className="text-[11px] font-normal text-neutral-500 font-mono">
            ({currencyCode} / MWh)
          </span>
        </div>
        <div className="text-[11px] font-medium text-neutral-500 font-mono">
          Av.{" "}
          <strong className="text-neutral-900 font-bold">
            {currencySymbol}
            {avgPrice.toLocaleString()} /MWh
          </strong>
        </div>
      </div>

      {/* Chart Canvas with proper vertical spacing */}
      <div className="pt-2 pb-2 px-1">
        <ReactECharts
          option={option}
          onEvents={onEvents}
          style={{ height, width: "100%" }}
          notMerge={true}
          lazyUpdate={false}
        />
      </div>
    </div>
  );
}
