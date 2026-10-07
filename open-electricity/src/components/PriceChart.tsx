"use client";

import React, { useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { FuelGenerationPoint, TimeRange, CountryCode } from "@/lib/types";
import { computeXAxisConfig, createShadcnGradient, formatMarketDate, getShadcnTooltipConfig } from "@/lib/chartUtils";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  ChartCard,
  ChartCardHeader,
  ChartCardTitle,
  ChartCardDescription,
  ChartCardContent,
} from "@/components/ui/ChartCard";
import { format, parseISO } from "date-fns";
import { TrendingUp, Info } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface PriceChartProps {
  data: FuelGenerationPoint[];
  range?: TimeRange;
  currencySymbol?: string;
  currencyCode?: string;
  height?: string;
  onHoverPoint?: (pt: FuelGenerationPoint | null) => void;
  country?: CountryCode;
  hasSpotMarket?: boolean;
  spotMarketNote?: string;
}

export function PriceChart({
  data,
  range = "7d",
  currencySymbol = "₱",
  currencyCode = "PHP",
  height,
  onHoverPoint,
  country,
  hasSpotMarket = true,
  spotMarketNote,
}: PriceChartProps) {
  const { isDark } = useTheme();
  const isMobile = useIsMobile();
  const isBarView = range === "30d" || range === "1y";
  const chartHeight = height || (isMobile ? "135px" : "150px");
  const xAxisConfig = useMemo(
    () => computeXAxisConfig(data, isDark, range, undefined, isMobile),
    [data, isDark, range, isMobile]
  );
  const tooltipConfig = useMemo(() => getShadcnTooltipConfig(isDark), [isDark]);

  const hasDistribution = useMemo(() => {
    return data.some(
      (d) => d.priceMedian != null && d.priceP5 != null && d.hasData !== false
    );
  }, [data]);

  const hasNegativePrice = useMemo(() => {
    return data.some(
      (d) =>
        (d.price != null && d.price < 0) ||
        (d.priceMin != null && d.priceMin < 0) ||
        (d.priceMedian != null && d.priceMedian < 0)
    );
  }, [data]);

  const prices = useMemo(() => {
    return data.map((d) => (d.price != null && d.hasData !== false ? d.price : null));
  }, [data]);

  const avgPrice = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const validPrices = data
      .filter((d) => d.hasData !== false)
      .map((d) => d.price ?? d.priceMedian)
      .filter((p): p is number => p != null);
    if (validPrices.length === 0) return 0;
    const total = validPrices.reduce((acc, p) => acc + p, 0);
    return Math.round(total / validPrices.length);
  }, [data]);

  const option = useMemo(() => {
    const gridLineColor = isDark ? "rgba(255, 255, 255, 0.07)" : "#F1F5F9";
    const zeroMarkLine = hasNegativePrice
      ? {
        symbol: "none",
        silent: true,
        data: [
          {
            yAxis: 0,
            lineStyle: {
              color: isDark ? "rgba(255, 255, 255, 0.45)" : "rgba(0, 0, 0, 0.4)",
              width: 1.5,
              type: "dashed",
            },
            label: {
              show: true,
              position: "end",
              formatter: "0",
              color: isDark ? "#A1A1AA" : "#64748B",
              fontSize: 9,
              fontFamily: "monospace",
            },
          },
        ],
      }
      : undefined;

    return {
      backgroundColor: "transparent",
      animation: false,
      tooltip: {
        ...tooltipConfig,
        formatter: (params: any) => {
          const pList = Array.isArray(params) ? params : [params];
          if (!pList || pList.length === 0) return "";
          const idx = pList[0].dataIndex;
          const rawPt = data[idx];
          let formattedTime = pList[0].axisValue;
          if (rawPt?.timestamp) {
            formattedTime = formatMarketDate(rawPt.timestamp, "d MMM yyyy, h:mm a");
          }

          const borderCls = isDark ? "border-[#27272A]" : "border-neutral-100";
          const textMuted = isDark ? "text-neutral-400" : "text-neutral-500";
          const textPrimary = isDark ? "text-neutral-100" : "text-neutral-900";

          if (rawPt?.hasData === false || (rawPt?.price == null && rawPt?.priceMedian == null)) {
            return `<div class="font-sans min-w-[180px]">
              <div class="${textMuted} font-medium text-xs mb-1.5">${formattedTime}</div>
              <div class="flex items-center justify-between space-x-3 text-xs border-t ${borderCls} pt-1.5">
                <span class="font-semibold text-rose-500 flex items-center">
                  <span class="w-2 h-2 rounded-full mr-1.5 bg-rose-500"></span>
                  Spot Price:
                </span>
                <span class="font-mono text-neutral-400">No data</span>
              </div>
            </div>`;
          }

          if (isBarView) {
            const barVal = rawPt.price ?? rawPt.priceMedian ?? 0;
            return `<div class="font-sans min-w-[200px]">
              <div class="${textMuted} font-medium text-xs mb-1.5">${formattedTime}</div>
              <div class="flex items-center justify-between space-x-3 text-xs border-t ${borderCls} pt-1.5">
                <span class="font-semibold text-rose-500 flex items-center">
                  <span class="w-2 h-2 rounded-xs mr-1.5 bg-rose-500"></span>
                  Average Price:
                </span>
                <span class="font-mono font-bold ${textPrimary}">${currencySymbol}${Math.round(
              barVal
            ).toLocaleString()} /MWh</span>
              </div>
              ${rawPt.priceMedian != null &&
                rawPt.price != null &&
                Math.round(rawPt.priceMedian) !== Math.round(rawPt.price)
                ? `<div class="flex items-center justify-between space-x-3 text-xs pt-1">
                      <span class="${textMuted} flex items-center pl-3.5">
                        Median Price:
                      </span>
                      <span class="font-mono ${textPrimary}">${currencySymbol}${Math.round(
                  rawPt.priceMedian
                ).toLocaleString()} /MWh</span>
                    </div>`
                : ""
              }
              ${rawPt.priceP5 != null && rawPt.priceP95 != null
                ? `<div class="flex items-center justify-between space-x-3 text-xs pt-1">
                      <span class="${textMuted} flex items-center pl-3.5">
                        5%–95% Range:
                      </span>
                      <span class="font-mono ${textPrimary}">${currencySymbol}${Math.round(
                  rawPt.priceP5
                ).toLocaleString()} – ${currencySymbol}${Math.round(
                  rawPt.priceP95
                ).toLocaleString()}</span>
                    </div>`
                : ""
              }
              ${rawPt.priceMin != null && rawPt.priceMax != null
                ? `<div class="flex items-center justify-between space-x-3 text-xs pt-1">
                      <span class="${textMuted} flex items-center pl-3.5">
                        Min–Max Range:
                      </span>
                      <span class="font-mono text-neutral-400">${currencySymbol}${Math.round(
                  rawPt.priceMin
                ).toLocaleString()} – ${currencySymbol}${Math.round(
                  rawPt.priceMax
                ).toLocaleString()}</span>
                    </div>`
                : ""
              }
              ${barVal < 0
                ? `<div class="pt-1.5 mt-1 border-t ${borderCls} text-[10px] text-amber-500 font-sans leading-tight">
                    Negative price: curtailment / surplus dispatch
                  </div>`
                : ""
              }
            </div>`;
          }

          if (hasDistribution && rawPt?.priceMedian != null) {
            return `<div class="font-sans min-w-[210px]">
              <div class="${textMuted} font-medium text-xs mb-1.5">${formattedTime}</div>
              <div class="flex items-center justify-between space-x-3 text-xs border-t ${borderCls} pt-1.5">
                <span class="font-semibold text-rose-500 flex items-center">
                  <span class="w-2 h-2 rounded-full mr-1.5 bg-rose-500"></span>
                  Median Price:
                </span>
                <span class="font-mono font-bold ${textPrimary}">${currencySymbol}${Math.round(
              rawPt.priceMedian
            ).toLocaleString()} /MWh</span>
              </div>
              ${rawPt.priceP5 != null && rawPt.priceP95 != null
                ? `<div class="flex items-center justify-between space-x-3 text-xs pt-1">
                      <span class="${textMuted} flex items-center pl-3.5">
                        5%–95% Range:
                      </span>
                      <span class="font-mono ${textPrimary}">${currencySymbol}${Math.round(
                  rawPt.priceP5
                ).toLocaleString()} – ${currencySymbol}${Math.round(
                  rawPt.priceP95
                ).toLocaleString()}</span>
                    </div>`
                : ""
              }
              ${rawPt.priceMin != null && rawPt.priceMax != null
                ? `<div class="flex items-center justify-between space-x-3 text-xs pt-1">
                      <span class="${textMuted} flex items-center pl-3.5">
                        Min–Max Range:
                      </span>
                      <span class="font-mono text-neutral-400">${currencySymbol}${Math.round(
                  rawPt.priceMin
                ).toLocaleString()} – ${currencySymbol}${Math.round(
                  rawPt.priceMax
                ).toLocaleString()}</span>
                    </div>`
                : ""
              }
              ${rawPt.priceMedian < 0
                ? `<div class="pt-1.5 mt-1 border-t ${borderCls} text-[10px] text-amber-500 font-sans leading-tight">
                    Negative price: curtailment / surplus dispatch
                  </div>`
                : ""
              }
            </div>`;
          }

          const val = Number(rawPt?.price ?? pList[0].value) || 0;
          const isNegative = val < 0 || (rawPt?.price != null && rawPt.price < 0);

          return `<div class="font-sans min-w-[180px]">
            <div class="${textMuted} font-medium text-xs mb-1.5">${formattedTime}</div>
            <div class="flex items-center justify-between space-x-3 text-xs border-t ${borderCls} pt-1.5">
              <span class="font-semibold text-rose-500 flex items-center">
                <span class="w-2 h-2 rounded-full mr-1.5 bg-rose-500"></span>
                Spot Price:
              </span>
              <span class="font-mono font-bold ${textPrimary}">${currencySymbol}${Math.round(
            val
          ).toLocaleString()} /MWh</span>
            </div>
            ${isNegative
              ? `<div class="pt-1.5 mt-1 border-t ${borderCls} text-[10px] text-amber-500 font-sans leading-tight">
                  Negative price: curtailment / surplus dispatch
                </div>`
              : ""
            }
          </div>`;
        },
        axisPointer: {
          type: isBarView ? "shadow" : "line",
          shadowStyle: {
            color: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
          },
          lineStyle: {
            color: isDark ? "#71717A" : "#94A3B8",
            width: 1.5,
            type: "dashed",
          },
        },
      },
      grid: xAxisConfig.grid,
      xAxis: {
        type: "category",
        boundaryGap: isBarView ? true : false,
        data: xAxisConfig.timestamps,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: xAxisConfig.axisLabel,
        splitLine: {
          show: true,
          lineStyle: { color: gridLineColor, type: "dashed" },
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: isDark ? "#A1A1AA" : "#64748B",
          fontSize: isMobile ? 9 : 10,
          margin: isMobile ? 6 : 12,
          formatter: (v: number) => {
            if (Math.abs(v) >= 1000) {
              return `${(v / 1000).toFixed(0)}k`;
            }
            return `${v}`;
          },
        },
        splitLine: {
          lineStyle: { color: gridLineColor, type: "dashed" },
        },
      },
      series: isBarView
        ? hasDistribution
          ? [
            {
              name: "Spot Price Distribution",
              type: "custom",
              renderItem: (params: any, api: any) => {
                const i = params.dataIndex;
                const pt = data[i];
                if (!pt || pt.hasData === false) return;

                const coordCenter = api.coord([i, 0]);
                if (!coordCenter || isNaN(coordCenter[0])) return;
                const cx = coordCenter[0];

                let slotWidth = 20;
                try {
                  const sz = api.size([1, 0]);
                  if (sz && sz[0] > 0) slotWidth = sz[0];
                } catch {
                  slotWidth = 20;
                }

                const boxWidth = Math.max(5, Math.min(slotWidth * 0.65, 20));
                const capWidth = boxWidth >= 8 ? Math.max(4, boxWidth * 0.5) : 0;

                const hasPtDist =
                  pt.priceMin != null &&
                  pt.priceMax != null &&
                  pt.priceP5 != null &&
                  pt.priceP95 != null &&
                  pt.priceMedian != null &&
                  !isNaN(pt.priceMin) &&
                  !isNaN(pt.priceMax) &&
                  !isNaN(pt.priceP5) &&
                  !isNaN(pt.priceP95) &&
                  !isNaN(pt.priceMedian);

                if (!hasPtDist) {
                  const pVal = pt.price ?? pt.priceMedian;
                  if (pVal == null || isNaN(pVal)) return;
                  const cVal = api.coord([i, pVal]);
                  const cZero = api.coord([i, 0]);
                  const yTop = Math.min(cVal[1], cZero[1]);
                  const h = Math.max(2, Math.abs(cVal[1] - cZero[1]));
                  return {
                    type: "rect",
                    shape: {
                      x: cx - boxWidth / 2,
                      y: yTop,
                      width: boxWidth,
                      height: h,
                      r: [2, 2, 0, 0],
                    },
                    style: {
                      fill: isDark ? "#FB7185" : "#F43F5E",
                      opacity: 0.85,
                    },
                  };
                }

                const cMin = api.coord([i, pt.priceMin]);
                const cMax = api.coord([i, pt.priceMax]);
                const cP5 = api.coord([i, pt.priceP5]);
                const cP95 = api.coord([i, pt.priceP95]);
                const cMed = api.coord([i, pt.priceMedian]);

                if (!cMin || !cMax || !cP5 || !cP95 || !cMed) return;

                const yBoxTop = Math.min(cP5[1], cP95[1]);
                const yBoxBottom = Math.max(cP5[1], cP95[1]);
                const boxHeight = Math.max(3, yBoxBottom - yBoxTop);

                const whiskerColor = isDark
                  ? "rgba(251, 113, 133, 0.65)"
                  : "rgba(225, 29, 72, 0.60)";
                const boxFill = isDark
                  ? "rgba(244, 63, 94, 0.35)"
                  : "rgba(244, 63, 94, 0.25)";
                const boxBorder = isDark
                  ? "rgba(251, 113, 133, 0.90)"
                  : "rgba(225, 29, 72, 0.85)";
                const medianColor = isDark ? "#FFFFFF" : "#881337";

                const children: any[] = [];

                // 1. Min-Max Whisker Line
                children.push({
                  type: "line",
                  shape: {
                    x1: cx,
                    y1: cMin[1],
                    x2: cx,
                    y2: cMax[1],
                  },
                  style: {
                    stroke: whiskerColor,
                    lineWidth: 1.5,
                  },
                });

                // Horizontal cap at Min
                if (capWidth > 0) {
                  children.push({
                    type: "line",
                    shape: {
                      x1: cx - capWidth / 2,
                      y1: cMin[1],
                      x2: cx + capWidth / 2,
                      y2: cMin[1],
                    },
                    style: {
                      stroke: whiskerColor,
                      lineWidth: 1.5,
                    },
                  });

                  // Horizontal cap at Max
                  children.push({
                    type: "line",
                    shape: {
                      x1: cx - capWidth / 2,
                      y1: cMax[1],
                      x2: cx + capWidth / 2,
                      y2: cMax[1],
                    },
                    style: {
                      stroke: whiskerColor,
                      lineWidth: 1.5,
                    },
                  });
                }

                // 2. 5%-95% Range Box
                children.push({
                  type: "rect",
                  shape: {
                    x: cx - boxWidth / 2,
                    y: yBoxTop,
                    width: boxWidth,
                    height: boxHeight,
                    r: [2, 2, 2, 2],
                  },
                  style: {
                    fill: boxFill,
                    stroke: boxBorder,
                    lineWidth: 1.2,
                  },
                });

                // 3. Median Notch Line across the box
                children.push({
                  type: "line",
                  shape: {
                    x1: cx - boxWidth / 2,
                    y1: cMed[1],
                    x2: cx + boxWidth / 2,
                    y2: cMed[1],
                  },
                  style: {
                    stroke: medianColor,
                    lineWidth: 2.5,
                  },
                });

                return {
                  type: "group",
                  children,
                };
              },
              encode: { x: 0, y: [1, 2, 3, 4, 5] },
              data: data.map((d, i) => [
                i,
                d.priceMin ?? d.price,
                d.priceMax ?? d.price,
                d.priceP5 ?? d.price,
                d.priceP95 ?? d.price,
                d.priceMedian ?? d.price,
              ]),
              z: 2,
            },
          ]
          : [
            {
              name: "Wholesale Spot Price",
              type: "bar",
              barCategoryGap: "0%",
              barWidth: "100%",
              data: data.map((d) =>
                d.hasData !== false ? (d.price ?? d.priceMedian) : null
              ),
              itemStyle: {
                color: isDark ? "#FB7185" : "#F43F5E",
                opacity: 0.85,
                borderColor: isDark
                  ? "rgba(0, 0, 0, 0.35)"
                  : "rgba(255, 255, 255, 0.45)",
                borderWidth: 0.4,
              },
            },
          ]
        : hasDistribution
          ? [
            {
              name: "Min–Max Range",
              type: "custom",
              renderItem: (params: any, api: any) => {
                const i = params.dataIndex;
                if (i === 0) {
                  if (data.length === 1) {
                    const vMin = api.value(1, 0);
                    const vMax = api.value(2, 0);
                    if (
                      vMin != null &&
                      vMax != null &&
                      !isNaN(vMin) &&
                      !isNaN(vMax)
                    ) {
                      const p1 = api.coord([0, vMin]);
                      const p2 = api.coord([0, vMax]);
                      return {
                        type: "line",
                        shape: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] },
                        style: {
                          stroke: isDark
                            ? "rgba(244, 63, 94, 0.25)"
                            : "rgba(244, 63, 94, 0.20)",
                          lineWidth: 6,
                        },
                      };
                    }
                  }
                  return;
                }
                const prevMin = api.value(1, i - 1);
                const prevMax = api.value(2, i - 1);
                const currMin = api.value(1, i);
                const currMax = api.value(2, i);
                if (
                  prevMin == null ||
                  prevMax == null ||
                  currMin == null ||
                  currMax == null ||
                  isNaN(prevMin) ||
                  isNaN(prevMax) ||
                  isNaN(currMin) ||
                  isNaN(currMax)
                ) {
                  return;
                }
                const pt0 = api.coord([i - 1, prevMin]);
                const pt1 = api.coord([i, currMin]);
                const pt2 = api.coord([i, currMax]);
                const pt3 = api.coord([i - 1, prevMax]);
                return {
                  type: "polygon",
                  shape: { points: [pt0, pt1, pt2, pt3] },
                  style: {
                    fill: isDark
                      ? "rgba(244, 63, 94, 0.12)"
                      : "rgba(244, 63, 94, 0.10)",
                  },
                };
              },
              encode: { x: 0, y: [1, 2] },
              data: data.map((d, i) => [i, d.priceMin, d.priceMax]),
              z: 1,
            },
            {
              name: "5%–95% Range",
              type: "custom",
              renderItem: (params: any, api: any) => {
                const i = params.dataIndex;
                if (i === 0) {
                  if (data.length === 1) {
                    const vLow = api.value(1, 0);
                    const vHigh = api.value(2, 0);
                    if (
                      vLow != null &&
                      vHigh != null &&
                      !isNaN(vLow) &&
                      !isNaN(vHigh)
                    ) {
                      const p1 = api.coord([0, vLow]);
                      const p2 = api.coord([0, vHigh]);
                      return {
                        type: "line",
                        shape: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] },
                        style: {
                          stroke: isDark
                            ? "rgba(244, 63, 94, 0.40)"
                            : "rgba(244, 63, 94, 0.35)",
                          lineWidth: 6,
                        },
                      };
                    }
                  }
                  return;
                }
                const prevLow = api.value(1, i - 1);
                const prevHigh = api.value(2, i - 1);
                const currLow = api.value(1, i);
                const currHigh = api.value(2, i);
                if (
                  prevLow == null ||
                  prevHigh == null ||
                  currLow == null ||
                  currHigh == null ||
                  isNaN(prevLow) ||
                  isNaN(prevHigh) ||
                  isNaN(currLow) ||
                  isNaN(currHigh)
                ) {
                  return;
                }
                const pt0 = api.coord([i - 1, prevLow]);
                const pt1 = api.coord([i, currLow]);
                const pt2 = api.coord([i, currHigh]);
                const pt3 = api.coord([i - 1, prevHigh]);
                return {
                  type: "polygon",
                  shape: { points: [pt0, pt1, pt2, pt3] },
                  style: {
                    fill: isDark
                      ? "rgba(244, 63, 94, 0.22)"
                      : "rgba(244, 63, 94, 0.18)",
                  },
                };
              },
              encode: { x: 0, y: [1, 2] },
              data: data.map((d, i) => [i, d.priceP5, d.priceP95]),
              z: 2,
            },
            {
              name: "Median Price",
              type: "line",
              data: data.map((d) =>
                d.priceMedian != null && d.hasData !== false
                  ? d.priceMedian
                  : null
              ),
              smooth: false,
              showSymbol: false,
              lineStyle: {
                width: 2.0,
                color: "#E11D48",
              },
              markLine: zeroMarkLine,
              z: 3,
            },
          ]
          : [
            {
              name: "Wholesale Spot Price",
              type: "line",
              data: prices,
              smooth: true,
              showSymbol: false,
              lineStyle: {
                width: 2.0,
                color: "#FB7185",
              },
              areaStyle: {
                color: createShadcnGradient("#E11D48", isDark ? 0.25 : 0.35, 0.01),
              },
              markLine: zeroMarkLine,
            },
          ],
    };
  }, [
    data,
    prices,
    hasDistribution,
    hasNegativePrice,
    isBarView,
    currencySymbol,
    xAxisConfig,
    tooltipConfig,
    isDark,
  ]);

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

  const onChartReady = useCallback((echartsInstance: any) => {
    echartsInstance.group = "opennem_sync_group";
    echarts.connect("opennem_sync_group");
  }, []);

  if (hasSpotMarket === false || country === "TH") {
    return (
      <aside
        className="rounded-xl border border-neutral-200/70 dark:border-[#202024] bg-neutral-50/60 dark:bg-[#101012] p-3.5 sm:p-4 text-xs shadow-2xs transition-colors"
        aria-label="Spot market status"
      >
        <div className="flex items-start space-x-3">
          <div className="w-7 h-7 shrink-0 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mt-0.5">
            <Info className="h-4 w-4" />
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className="font-semibold text-xs sm:text-[13px] text-neutral-900 dark:text-neutral-100">
                Regulated Tariff Structure ({currencyCode})
              </h4>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono">
                No Spot Market
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {spotMarketNote ||
                "Thailand operates under an Enhanced Single Buyer (ESB) model managed by EGAT. Generation is procured via long-term PPAs with regulated tariffs approved by the ERC, rather than an open wholesale spot exchange."}
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <ChartCard onMouseLeave={() => onHoverPoint?.(null)}>
      <ChartCardHeader className="py-2 px-3 sm:px-4">
        <ChartCardTitle className="flex-wrap gap-1.5 sm:gap-2">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-500" />
            <span className="text-xs sm:text-sm">
              Price ({currencyCode} / MWh)
            </span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {hasDistribution && (
              <div className="hidden sm:flex items-center space-x-3 text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                <span className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-[2px] bg-rose-500 rounded-full inline-block"></span>
                  <span>Median</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/25 border border-rose-500/50 inline-block"></span>
                  <span>5%–95%</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/10 border border-rose-500/30 inline-block"></span>
                  <span>Min–Max</span>
                </span>
              </div>
            )}
            <div className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-neutral-100 dark:bg-[#18181B] text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-800 font-mono shadow-xs">
              Av.{" "}
              <strong className="ml-1 text-neutral-950 dark:text-white font-bold">
                {currencySymbol}
                {avgPrice.toLocaleString()} /MWh
              </strong>
            </div>
          </div>
        </ChartCardTitle>
      </ChartCardHeader>

      <ChartCardContent className="p-1 sm:p-3 pt-2">
        <ReactECharts
          option={option}
          onEvents={onEvents}
          onChartReady={onChartReady}
          style={{ height: chartHeight, width: "100%" }}
          notMerge={true}
          lazyUpdate={false}
        />
      </ChartCardContent>
    </ChartCard>
  );
}
