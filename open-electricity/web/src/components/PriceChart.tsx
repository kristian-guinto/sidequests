"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint } from "@/lib/types";
import { computeXAxisConfig, createShadcnGradient, SHADCN_TOOLTIP_CONFIG } from "@/lib/chartUtils";
import {
  ChartCard,
  ChartCardHeader,
  ChartCardTitle,
  ChartCardDescription,
  ChartCardContent,
} from "@/components/ui/ChartCard";
import { format, parseISO } from "date-fns";
import { TrendingUp } from "lucide-react";

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
  const xAxisConfig = useMemo(() => computeXAxisConfig(data), [data]);

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

          const val = Number(params[0].value) || 0;
          return `<div class="font-sans min-w-[180px]">
            <div class="text-neutral-500 font-medium text-xs mb-1.5">${formattedTime}</div>
            <div class="flex items-center justify-between space-x-3 text-xs border-t border-neutral-100 pt-1.5">
              <span class="font-semibold text-rose-600 flex items-center">
                <span class="w-2 h-2 rounded-full mr-1.5 bg-rose-500"></span>
                Spot Price:
              </span>
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
            width: 2.0,
            color: "#E11D48",
          },
          areaStyle: {
            color: createShadcnGradient("#E11D48", 0.35, 0.02),
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
    <ChartCard onMouseLeave={() => onHoverPoint?.(null)}>
      <ChartCardHeader>
        <ChartCardTitle>
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-rose-500" />
            <span>Wholesale Spot Price</span>
            <span className="text-xs font-normal text-neutral-400 font-mono">
              ({currencyCode} / MWh)
            </span>
          </div>
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200/60 font-mono shadow-xs">
            Av.{" "}
            <strong className="ml-1 text-neutral-950 font-bold">
              {currencySymbol}
              {avgPrice.toLocaleString()} /MWh
            </strong>
          </div>
        </ChartCardTitle>
        <ChartCardDescription>
          Interval clearing market settlement price for wholesale electricity dispatch
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
