"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CountryCode,
  Region,
  TimeRange,
  TimeInterval,
  ViewMode,
  PaletteMode,
  FuelGenerationPoint,
  FuelTech,
  SummaryMetrics,
  FuelBreakdownRow,
  RANGE_CONFIG,
  COUNTRIES_METADATA,
} from "@/lib/types";
import { Header } from "@/components/Header";
import { GenerationChart } from "@/components/GenerationChart";
import { EmissionsChart } from "@/components/EmissionsChart";
import { PriceChart } from "@/components/PriceChart";
import { DataSidebar } from "@/components/DataSidebar";
import { alignPointsToTimeGrid, getDateRangeParams } from "@/lib/chartUtils";

interface CountryPageProps {
  params: {
    country: string;
  };
}

export default function CountryDetailPage({ params }: CountryPageProps) {
  const router = useRouter();

  // Validate initial country from URL params
  const rawCountry = (params?.country || "PH").toUpperCase() as CountryCode;
  const initialCountry: CountryCode = COUNTRIES_METADATA[rawCountry] ? rawCountry : "PH";

  const [country, setCountry] = useState<CountryCode>(initialCountry);
  const [region, setRegion] = useState<Region>(
    COUNTRIES_METADATA[initialCountry]?.defaultRegion || "ALL"
  );
  const [range, setRange] = useState<TimeRange>("7d");
  const [interval, setInterval] = useState<TimeInterval>("30m");
  const [viewMode, setViewMode] = useState<ViewMode>("percentage");
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("clean-fossil");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [points, setPoints] = useState<FuelGenerationPoint[]>([]);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [breakdown, setBreakdown] = useState<FuelBreakdownRow[]>([]);
  const [dataSource, setDataSource] = useState<string>("connected");

  // Real-time hover cursor interaction state
  const [hoveredPoint, setHoveredPoint] = useState<FuelGenerationPoint | null>(null);
  const [hoveredFuel, setHoveredFuel] = useState<FuelTech | null>(null);

  // Sync if URL param updates
  useEffect(() => {
    const updated = (params?.country || "PH").toUpperCase() as CountryCode;
    if (COUNTRIES_METADATA[updated]) {
      setCountry(updated);
      setRegion(COUNTRIES_METADATA[updated].defaultRegion);
    }
  }, [params?.country]);

  const countryInfo = COUNTRIES_METADATA[country] || COUNTRIES_METADATA["PH"];
  const unit = RANGE_CONFIG[range]?.unit || "MW";

  const timeSpan = useMemo(() => {
    if (!points || points.length === 0) return undefined;
    return {
      start: points[0].timestamp,
      end: points[points.length - 1].timestamp,
    };
  }, [points]);

  const handleCountryChange = (newCountry: CountryCode) => {
    setCountry(newCountry);
    const info = COUNTRIES_METADATA[newCountry];
    if (info) {
      setRegion(info.defaultRegion);
    }
    setHoveredPoint(null);
    router.push(`/country/${newCountry}`);
  };

  const handleRangeChange = (newRange: TimeRange) => {
    setRange(newRange);
    const cfg = RANGE_CONFIG[newRange];
    if (cfg) {
      setInterval(cfg.defaultInterval);
    }
    setHoveredPoint(null);
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { startDate, endDate } = getDateRangeParams(range);
      const res = await fetch(
        `/api/energy?country=${country}&region=${region}&start_date=${startDate}&end_date=${endDate}&range=${range}&interval=${interval}`
      );
      if (res.ok) {
        const json = await res.json();
        const alignedPoints = alignPointsToTimeGrid(json.points || [], range, interval);
        setPoints(alignedPoints);
        setBreakdown(json.breakdown || []);
        if (json.summary) {
          setSummary(json.summary);
        } else {
          setSummary(null);
        }
        setDataSource(json.source || "connected");
      } else {
        throw new Error("Failed to fetch API data");
      }
    } catch (e) {
      console.warn("No data available or error fetching:", e);
      const emptyPoints = alignPointsToTimeGrid([], range, interval);
      setPoints(emptyPoints);
      setBreakdown([]);
      setSummary(null);
      setDataSource("none");
    } finally {
      setIsLoading(false);
    }
  }, [country, region, range, interval]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAFA] dark:bg-[#000000] text-neutral-900 dark:text-neutral-100 font-sans transition-colors duration-150">
      {/* OpenNEM Two-Tier Header */}
      <Header
        country={country}
        onCountryChange={handleCountryChange}
        region={region}
        onRegionChange={setRegion}
        range={range}
        onRangeChange={handleRangeChange}
        interval={interval}
        onIntervalChange={setInterval}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        paletteMode={paletteMode}
        onPaletteModeChange={setPaletteMode}
        onRefresh={fetchData}
        isLoading={isLoading}
        dataSource={dataSource}
      />

      {/* No Public SCADA Notice Banner */}
      {!countryInfo.hasLivePipeline && (
        <div className="bg-neutral-100 dark:bg-[#121215] border-b border-neutral-200 dark:border-[#27272A] px-4 py-2 text-xs text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono">
              Observation Mode
            </span>
            <span>
              {countryInfo.unavailableReason ||
                "Official utility dispatch telemetry is not published via public APIs."}
            </span>
          </div>
        </div>
      )}

      {/* No Live Telemetry Notice Banner */}
      {countryInfo.hasLivePipeline && dataSource === "none" && !isLoading && (
        <div className="bg-neutral-100 dark:bg-[#121215] border-b border-neutral-200 dark:border-[#27272A] px-4 py-2 text-xs text-neutral-600 dark:text-neutral-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-medium">
              No live telemetry data available for this range and interval.
            </span>
          </div>
          <button
            onClick={fetchData}
            className="underline hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer text-[11px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Full-Width Two-Column Workspace */}
      <main className="flex-1 w-full px-3 sm:px-4 lg:px-6 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* Left Column (8 cols ~ 67% width): Synchronized Chart Stack */}
          <div className="lg:col-span-8 space-y-2.5">
            <GenerationChart
              data={points}
              range={range}
              viewMode={viewMode}
              paletteMode={paletteMode}
              height="310px"
              hoveredFuel={hoveredFuel}
            />

            {/* Chart 2: Emissions Volume (tCO2e/interval) */}
            <EmissionsChart
              data={points}
              range={range}
              viewMode={viewMode}
              height="170px"
              hoveredFuel={hoveredFuel}
              onHoverPoint={setHoveredPoint}
            />

            {/* Chart 3: Spot Market Price */}
            <PriceChart
              data={points}
              range={range}
              currencySymbol={countryInfo.currencySymbol}
              currencyCode={countryInfo.currencyCode}
              height="150px"
              onHoverPoint={setHoveredPoint}
            />
          </div>

          {/* Right Column (4 cols ~ 33% width): Sticky Fuel & Emissions Sidebar */}
          <div className="lg:col-span-4 lg:sticky lg:top-[105px]">
            <DataSidebar
              breakdown={breakdown}
              summary={summary}
              hoveredPoint={hoveredPoint}
              hoveredFuel={hoveredFuel}
              onHoverFuel={setHoveredFuel}
              timeSpan={timeSpan}
              currencySymbol={countryInfo.currencySymbol}
              currencyCode={countryInfo.currencyCode}
              unit={unit}
              paletteMode={paletteMode}
            />
          </div>
        </div>
      </main>

      {/* Sleek Bottom OpenNEM Status Bar */}
      <footer className="border-t border-neutral-200 dark:border-[#27272A] bg-neutral-900 dark:bg-[#09090B] text-neutral-300 py-1 px-4 text-[11px] font-mono select-none">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-3 text-neutral-400">
            <span className="text-neutral-200 font-semibold">v4.54.10</span>
            <span>&bull;</span>
            <span className="flex items-center space-x-1.5">
              {dataSource === "duckdb_local" || dataSource === "local" ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-blue-400">Engine: DuckDB (local)</span>
                </>
              ) : dataSource === "motherduck" || dataSource === "motherduck_cloud" ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400">Engine: MotherDuck Cloud</span>
                </>
              ) : (
                <>
                </>
              )}
            </span>
            <span>&bull;</span>
            <span>API: 4.5.11</span>
          </div>

          <div className="flex items-center space-x-4 text-neutral-400">
            <span>Sources: IEMOP (PH), EMA (SG), Single Buyer (MY), EGAT (TH)</span>
          </div>
        </div>
      </footer>
    </div >
  );
}
