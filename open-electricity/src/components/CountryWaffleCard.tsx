"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CountryCode,
  FuelBreakdownRow,
  SummaryMetrics,
  PaletteMode,
  FuelTech,
  COUNTRIES_METADATA,
} from "@/lib/types";
import { getFuelMeta } from "@/lib/colors";
import { WaffleMatrix } from "@/components/WaffleMatrix";
import { useTheme } from "@/components/ThemeProvider";
import { ArrowRight, Leaf, Flame } from "lucide-react";

interface CountryWaffleCardProps {
  country: CountryCode;
  breakdown: FuelBreakdownRow[];
  summary: SummaryMetrics | null;
  paletteMode: PaletteMode;
  isLoading?: boolean;
}

export function CountryWaffleCard({
  country,
  breakdown,
  summary,
  paletteMode,
  isLoading = false,
}: CountryWaffleCardProps) {
  const { isDark } = useTheme();
  const [hoveredFuel, setHoveredFuel] = useState<FuelTech | null>(null);

  const countryInfo = COUNTRIES_METADATA[country] || COUNTRIES_METADATA["PH"];

  // Calculate clean energy percentage
  const cleanPct = React.useMemo(() => {
    if (summary && summary.renewablesPct !== undefined) {
      return Math.round(summary.renewablesPct);
    }
    const sum = breakdown
      .filter((r) => r.isRenewable)
      .reduce((acc, r) => acc + r.percentage, 0);
    return Math.round(sum);
  }, [summary, breakdown]);

  // Active fuels sorted by percentage descending
  const sortedFuels = React.useMemo(() => {
    return [...breakdown]
      .filter((r) => r.percentage >= 0.5)
      .sort((a, b) => b.percentage - a.percentage);
  }, [breakdown]);

  const topFuels = React.useMemo(() => sortedFuels.slice(0, 3), [sortedFuels]);
  const otherFuels = React.useMemo(() => sortedFuels.slice(3), [sortedFuels]);
  const otherPercentage = React.useMemo(() => {
    return otherFuels.reduce((acc, r) => acc + r.percentage, 0);
  }, [otherFuels]);

  const hasData =
    Boolean(summary && summary.totalGenerationGWh > 0) ||
    breakdown.some((r) => r.percentage > 0 || (r.energyGWh && r.energyGWh > 0));

  return (
    <Link
      href={`/country/${country}`}
      className="group block rounded-xl border border-neutral-200/60 dark:border-[#1E1E21] bg-white dark:bg-[#0C0C0E] hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:shadow-lg dark:hover:shadow-emerald-950/20 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center space-x-2.5">
          <span className="text-2xl leading-none select-none">
            {countryInfo.flag}
          </span>
          <h3 className="font-semibold text-[15px] text-neutral-900 dark:text-neutral-50 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {countryInfo.name}
          </h3>
        </div>

        {/* Clean Energy Badge / Skeleton */}
        {isLoading ? (
          <div className="w-12 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800/60 animate-pulse" />
        ) : hasData ? (
          <span
            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cleanPct >= 35
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : cleanPct >= 15
                  ? "bg-amber-500/8 text-amber-600 dark:text-amber-400"
                  : "bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400"
              }`}
          >
            {cleanPct >= 20 ? (
              <Leaf className="w-3 h-3" />
            ) : (
              <Flame className="w-3 h-3" />
            )}
            <span suppressHydrationWarning>{cleanPct}%</span>
          </span>
        ) : (
          <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-[#161619] px-2 py-0.5 rounded-full border border-neutral-200/50 dark:border-[#242428]">
            No Data
          </span>
        )}
      </div>

      {/* Waffle Grid — full bleed within card padding */}
      <div className="px-4 py-2">
        {isLoading ? (
          <div className="aspect-square rounded-lg bg-neutral-100 dark:bg-[#121215] animate-pulse" />
        ) : (
          <WaffleMatrix
            breakdown={breakdown}
            paletteMode={paletteMode}
            hoveredFuel={hoveredFuel}
            onHoverFuel={setHoveredFuel}
          />
        )}
      </div>

      {/* Fuel Breakdown — compact, no table headers */}
      <div className="px-4 pt-1 pb-3 space-y-0 min-h-[75px]">
        {isLoading ? (
          <div className="space-y-2 py-2">
            <div className="h-3 rounded bg-neutral-100 dark:bg-neutral-800/60 animate-pulse w-3/4" />
            <div className="h-3 rounded bg-neutral-100 dark:bg-neutral-800/60 animate-pulse w-1/2" />
            <div className="h-3 rounded bg-neutral-100 dark:bg-neutral-800/60 animate-pulse w-2/3" />
          </div>
        ) : hasData ? (
          <>
            {topFuels.map((fuelRow) => {
              const meta = getFuelMeta(fuelRow.fuelTech, isDark, paletteMode);
              const isHovered = hoveredFuel === fuelRow.fuelTech;
              const isAnyHovered = hoveredFuel !== null;

              return (
                <div
                  key={fuelRow.fuelTech}
                  onMouseEnter={(e) => {
                    e.preventDefault();
                    setHoveredFuel(fuelRow.fuelTech);
                  }}
                  onMouseLeave={() => setHoveredFuel(null)}
                  className={`flex items-center justify-between py-1.5 cursor-pointer transition-opacity ${isHovered
                      ? "opacity-100"
                      : isAnyHovered
                        ? "opacity-30"
                        : "opacity-80 hover:opacity-100"
                    }`}
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">
                      {meta.label}
                    </span>
                  </div>
                  <span
                    suppressHydrationWarning
                    className="font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400"
                  >
                    {Math.round(fuelRow.percentage)}%
                  </span>
                </div>
              );
            })}

            {/* Other sources indicator */}
            {otherFuels.length > 0 && (
              <div
                className={`flex items-center justify-between py-1 transition-opacity ${hoveredFuel !== null ? "opacity-30" : "opacity-50"
                  }`}
              >
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  +{otherFuels.length} other
                </span>
                <span
                  suppressHydrationWarning
                  className="font-mono text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500"
                >
                  {Math.round(otherPercentage)}%
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="py-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
            No telemetry reported
          </div>
        )}
      </div>

      {/* Subtle card footer — hover reveal */}
      <div className="px-4 py-2.5 border-t border-transparent group-hover:border-neutral-100 dark:group-hover:border-[#1E1E21] flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-all">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          View detailed dispatch
        </span>
        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transform group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}
