"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FuelGenerationPoint } from "@/lib/types";
import { FUEL_META } from "@/lib/colors";
import { format, parseISO } from "date-fns";
import { Menu } from "lucide-react";

interface EmissionsChartProps {
  data: FuelGenerationPoint[];
  height?: string;
  onHoverPoint?: (pt: FuelGenerationPoint | null) => void;
}

export function EmissionsChart({
  data,
  height = "180px",
  onHoverPoint,
}: EmissionsChartProps) {
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

  const emissionsData = useMemo(() => {
    return data.map((d) => {
      const coalT = (d.coal || 0) * (5.0 / 60.0) * 0.9;
      const gasT = (d.gas || 0) * (5.0 / 60.0) * 0.38;
      const oilT = (d.oil || 0) * (5.0 / 60.0) * 0.75;
      return {
        coal: Math.round(coalT * 10) / 10,
        gas: Math.round(gasT * 10) / 10,
        oil: Math.round(oilT * 10) / 10,
        total: Math.round((coalT + gasT + oilT) * 10) / 10,
      };
    });
  }, [data]);

  const avgEmissions = useMemo(() => {
    if (!emissionsData || emissionsData.length === 0) return 0;
    const total = emissionsData.reduce((acc, d) => acc + d.total, 0);
    return Math.round(total / emissionsData.length);
  }, [emissionsData]);

  const option = useMemo(() => {
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
        padding: [6, 10],
        extraCssText: "box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;",
        textStyle: { color: "#0F172A", fontSize: 11 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const time = params[0].axisValue;
          let total = 0;
          const rows = params.map((p) => {
            const val = Number(p.value) || 0;
            total += val;
            return { name: p.seriesName, val, color: p.color };
          });

          let html = `<div class="font-sans min-w-[170px]">
            <div class="border-b border-neutral-200 pb-1 mb-1 flex justify-between items-center text-[11px]">
              <span class="text-neutral-500">${time}</span>
              <span class="font-bold text-neutral-900">${total.toFixed(1)} tCO₂e</span>
            </div>`;

          rows.forEach((r) => {
            if (r.val > 0) {
              html += `<div class="flex justify-between items-center py-0.5 text-[11px]">
                <span class="flex items-center text-neutral-600">
                  <span class="w-2 h-2 rounded-sm mr-1.5" style="background-color:${r.color}"></span>
                  ${r.name}:
                </span>
                <span class="font-mono text-neutral-800 font-medium">${r.val.toFixed(1)} tCO₂e</span>
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
          formatter: (v: number) => `${v.toLocaleString()}`,
        },
        splitLine: {
          lineStyle: { color: "#F1F5F9", type: "dashed" },
        },
      },
      series: [
        {
          name: "Distillate / Oil",
          type: "line",
          stack: "Emissions",
          areaStyle: { color: FUEL_META.oil.color, opacity: 0.95 },
          lineStyle: { width: 0.3, color: "#fff" },
          itemStyle: { color: FUEL_META.oil.color },
          showSymbol: false,
          data: emissionsData.map((d) => d.oil),
        },
        {
          name: "Gas",
          type: "line",
          stack: "Emissions",
          areaStyle: { color: FUEL_META.gas.color, opacity: 0.95 },
          lineStyle: { width: 0.3, color: "#fff" },
          itemStyle: { color: FUEL_META.gas.color },
          showSymbol: false,
          data: emissionsData.map((d) => d.gas),
        },
        {
          name: "Coal",
          type: "line",
          stack: "Emissions",
          areaStyle: { color: FUEL_META.coal.color, opacity: 0.95 },
          lineStyle: { width: 0.3, color: "#fff" },
          itemStyle: { color: FUEL_META.coal.color },
          showSymbol: false,
          data: emissionsData.map((d) => d.coal),
        },
      ],
    };
  }, [timestamps, emissionsData]);

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
      className="bg-white border border-neutral-200 rounded-sm"
      onMouseLeave={() => onHoverPoint?.(null)}
    >
      {/* Chart Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 bg-neutral-50/50">
        <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-800">
          <Menu className="h-3.5 w-3.5 text-neutral-400" />
          <span>Emissions Volume</span>
          <span className="text-[11px] font-normal text-neutral-500 font-mono">
            (tCO₂e / interval)
          </span>
        </div>
        <div className="text-[11px] font-medium text-neutral-500 font-mono">
          Av.{" "}
          <strong className="text-neutral-900 font-bold">
            {avgEmissions.toLocaleString()} tCO₂e
          </strong>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="p-2">
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
