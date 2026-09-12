"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CountryCode,
  TimeRange,
  ViewMode,
  PaletteMode,
  FuelGenerationPoint,
  COUNTRIES_METADATA,
} from "@/lib/types";
import { GenerationChart } from "@/components/GenerationChart";
import { PriceChart } from "@/components/PriceChart";
import { Loader2, Percent, AreaChart as AreaIcon, Leaf, Palette, AlertCircle } from "lucide-react";

interface BlogEnergyChartProps {
  country?: CountryCode;
  region?: string;
  startDate?: string;
  endDate?: string;
  range?: TimeRange;
  type?: "generation" | "price" | "both";
  viewMode?: ViewMode;
  paletteMode?: PaletteMode;
  unit?: "MW" | "GWh";
  title?: string;
  caption?: string;
  snapshotData?: FuelGenerationPoint[];
  showControls?: boolean;
  height?: string;
}

export function BlogEnergyChart({
  country = "PH",
  region = "ALL",
  startDate,
  endDate,
  range = "7d",
  type = "generation",
  viewMode: initialViewMode = "stacked",
  paletteMode: initialPaletteMode = "clean-fossil",
  unit = "MW",
  title,
  caption,
  snapshotData,
  showControls = true,
  height,
}: BlogEnergyChartProps) {
  const [data, setData] = useState<FuelGenerationPoint[]>(snapshotData || []);
  const [loading, setLoading] = useState<boolean>(!snapshotData);
  const [error, setError] = useState<string | null>(null);

  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(initialViewMode);
  const [currentPaletteMode, setCurrentPaletteMode] = useState<PaletteMode>(initialPaletteMode);
  const [activeTab, setActiveTab] = useState<"generation" | "price">(
    type === "price" ? "price" : "generation"
  );

  const countryMeta = COUNTRIES_METADATA[country] || COUNTRIES_METADATA["PH"];

  useEffect(() => {
    if (snapshotData && snapshotData.length > 0) {
      setData(snapshotData);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("country", country);
    if (region) params.set("region", region);
    if (range) params.set("range", range);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    fetch(`/api/energy?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load energy data (${res.status})`);
        }
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          if (json.history && Array.isArray(json.history)) {
            setData(json.history);
          } else {
            setData([]);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load chart data");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [country, region, range, startDate, endDate, snapshotData]);

  const hasSpotMarket = countryMeta.hasSpotMarket !== false;

  return (
    <figure className="my-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0d0d10] shadow-sm overflow-hidden not-prose">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 bg-neutral-50/50 dark:bg-[#121215]/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{countryMeta.flag}</span>
            <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              {title || `${countryMeta.name} Generation & Market Mix`}
            </span>
          </div>
          {startDate && endDate && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-mono">
              {startDate} → {endDate}
            </p>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex items-center gap-2 text-xs">
            {type === "both" && (
              <div className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-md p-0.5 bg-white dark:bg-[#18181b]">
                <button
                  type="button"
                  onClick={() => setActiveTab("generation")}
                  className={`px-2 py-0.5 rounded transition ${activeTab === "generation"
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold"
                      : "text-neutral-600 dark:text-neutral-400"
                    }`}
                >
                  Generation
                </button>
                {hasSpotMarket && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("price")}
                    className={`px-2 py-0.5 rounded transition ${activeTab === "price"
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold"
                        : "text-neutral-600 dark:text-neutral-400"
                      }`}
                  >
                    Price
                  </button>
                )}
              </div>
            )}

            {/* Percentage vs Stacked Toggle */}
            {activeTab === "generation" && (
              <div className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-md p-0.5 bg-white dark:bg-[#18181b]">
                <button
                  type="button"
                  onClick={() => setCurrentViewMode("stacked")}
                  title="Absolute Value (MW)"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${currentViewMode === "stacked"
                      ? "bg-emerald-600 text-white font-bold"
                      : "text-neutral-600 dark:text-neutral-400"
                    }`}
                >
                  <AreaIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">MW</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentViewMode("percentage")}
                  title="Percentage Share (%)"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${currentViewMode === "percentage"
                      ? "bg-emerald-600 text-white font-bold"
                      : "text-neutral-600 dark:text-neutral-400"
                    }`}
                >
                  <Percent className="h-3 w-3" />
                  <span className="hidden sm:inline">%</span>
                </button>
              </div>
            )}

            {/* Clean vs Detailed Palette Toggle */}
            {activeTab === "generation" && (
              <div className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-md p-0.5 bg-white dark:bg-[#18181b]">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPaletteMode(
                      currentPaletteMode === "clean-fossil" ? "detailed" : "clean-fossil"
                    )
                  }
                  title={`Current: ${currentPaletteMode}`}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
                >
                  {currentPaletteMode === "clean-fossil" ? (
                    <>
                      <Leaf className="h-3 w-3 text-emerald-500" />
                      <span className="hidden sm:inline">Clean/Fossil</span>
                    </>
                  ) : (
                    <>
                      <Palette className="h-3 w-3 text-amber-500" />
                      <span className="hidden sm:inline">Detailed</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Canvas Area */}
      <div className="p-3 sm:p-4 min-h-[280px] flex items-center justify-center relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 text-neutral-500 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <span className="text-xs">Loading grid telemetry...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 text-rose-500 py-12">
            <AlertCircle className="h-6 w-6" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-xs text-neutral-400 py-12">
            No telemetry records available for this timeframe.
          </div>
        ) : (
          <div className="w-full space-y-4">
            {type === "both" ? (
              activeTab === "generation" ? (
                <GenerationChart
                  data={data}
                  range={range}
                  viewMode={currentViewMode}
                  paletteMode={currentPaletteMode}
                  unit={unit}
                  height={height || "300px"}
                />
              ) : (
                <PriceChart
                  data={data}
                  range={range}
                  country={country}
                  currencySymbol={countryMeta.currencySymbol}
                  currencyCode={countryMeta.currencyCode}
                  hasSpotMarket={hasSpotMarket}
                  height={height || "220px"}
                />
              )
            ) : type === "generation" ? (
              <GenerationChart
                data={data}
                range={range}
                viewMode={currentViewMode}
                paletteMode={currentPaletteMode}
                unit={unit}
                height={height || "300px"}
              />
            ) : (
              <PriceChart
                data={data}
                range={range}
                country={country}
                currencySymbol={countryMeta.currencySymbol}
                currencyCode={countryMeta.currencyCode}
                hasSpotMarket={hasSpotMarket}
                height={height || "220px"}
              />
            )}
          </div>
        )}
      </div>

      {/* Caption footer */}
      {caption && (
        <figcaption className="px-4 py-2 text-xs text-neutral-500 dark:text-neutral-400 border-t border-neutral-100 dark:border-neutral-800/80 italic bg-neutral-50/30 dark:bg-[#121215]/30">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

