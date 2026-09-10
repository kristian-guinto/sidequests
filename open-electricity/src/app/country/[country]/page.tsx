"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CountryCode,
  Region,
  TimeRange,
  ViewMode,
  PaletteMode,
  FuelGenerationPoint,
  FuelTech,
  SummaryMetrics,
  FuelBreakdownRow,
  RANGE_CONFIG,
  COUNTRIES_METADATA,
} from "@/lib/types";
import {
  PREFERENCE_KEYS,
  getStoredPreference,
  setStoredPreference,
} from "@/lib/preferences";
import { Header } from "@/components/Header";
import { GenerationChart } from "@/components/GenerationChart";
import { EmissionsChart } from "@/components/EmissionsChart";
import { PriceChart } from "@/components/PriceChart";
import { DataSidebar } from "@/components/DataSidebar";
import { alignPointsToTimeGrid, getDateRangeParams, formatMarketDate } from "@/lib/chartUtils";

interface CountryPageProps {
  params: {
    country: string;
  };
  searchParams?: { [key: string]: string | string[] | undefined };
}

const VALID_RANGES: readonly TimeRange[] = ["1d", "3d", "7d", "30d", "1y"];
const VALID_VIEWS: readonly ViewMode[] = ["percentage", "stacked"];
const VALID_PALETTES: readonly PaletteMode[] = ["clean-fossil", "detailed"];

export default function CountryDetailPage({ params, searchParams }: CountryPageProps) {
  const router = useRouter();

  // Validate initial country from URL params
  const rawCountry = (params?.country || "PH").toUpperCase() as CountryCode;
  const initialCountry: CountryCode = COUNTRIES_METADATA[rawCountry] ? rawCountry : "PH";
  const defaultRegion = COUNTRIES_METADATA[initialCountry]?.defaultRegion || "ALL";

  const paramRange = typeof searchParams?.range === "string" ? (searchParams.range as TimeRange) : null;
  const initialRange: TimeRange =
    paramRange && VALID_RANGES.includes(paramRange) ? paramRange : "7d";

  const paramView = typeof searchParams?.view === "string" ? (searchParams.view as ViewMode) : null;
  const initialView: ViewMode =
    paramView && VALID_VIEWS.includes(paramView) ? paramView : "percentage";

  const paramPalette = typeof searchParams?.palette === "string" ? (searchParams.palette as PaletteMode) : null;
  const initialPalette: PaletteMode =
    paramPalette && VALID_PALETTES.includes(paramPalette) ? paramPalette : "clean-fossil";

  const paramRegion = typeof searchParams?.region === "string" ? searchParams.region : null;
  const validRegions = COUNTRIES_METADATA[initialCountry]?.regions.map((r) => r.id) || [];
  const initialRegion: Region =
    paramRegion && validRegions.includes(paramRegion) ? paramRegion : defaultRegion;

  const [country, setCountry] = useState<CountryCode>(initialCountry);
  const [region, setRegion] = useState<Region>(initialRegion);
  const [range, setRange] = useState<TimeRange>(initialRange);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(initialPalette);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [points, setPoints] = useState<FuelGenerationPoint[]>([]);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [breakdown, setBreakdown] = useState<FuelBreakdownRow[]>([]);
  const [dataSource, setDataSource] = useState<string>("connected");

  // Real-time hover cursor interaction state
  const [hoveredPoint, setHoveredPoint] = useState<FuelGenerationPoint | null>(null);
  const [hoveredFuel, setHoveredFuel] = useState<FuelTech | null>(null);

  // Client-side hydration of localStorage preferences if not specified in URL search params
  useEffect(() => {
    if (!paramRange) {
      const storedRange = getStoredPreference<TimeRange>(PREFERENCE_KEYS.RANGE, VALID_RANGES, "7d");
      if (storedRange !== initialRange) {
        setRange(storedRange);
      }
    }
    if (!paramView) {
      const storedView = getStoredPreference<ViewMode>(PREFERENCE_KEYS.VIEW_MODE, VALID_VIEWS, "percentage");
      if (storedView !== initialView) {
        setViewMode(storedView);
      }
    }
    if (!paramPalette) {
      const storedPalette = getStoredPreference<PaletteMode>(PREFERENCE_KEYS.PALETTE_MODE, VALID_PALETTES, "clean-fossil");
      if (storedPalette !== initialPalette) {
        setPaletteMode(storedPalette);
      }
    }
  }, []);

  // Sync if URL country param updates
  useEffect(() => {
    const updated = (params?.country || "PH").toUpperCase() as CountryCode;
    if (COUNTRIES_METADATA[updated]) {
      setCountry(updated);
      const validCountryRegions = COUNTRIES_METADATA[updated].regions.map((r) => r.id);
      if (paramRegion && validCountryRegions.includes(paramRegion)) {
        setRegion(paramRegion);
      } else {
        setRegion(COUNTRIES_METADATA[updated].defaultRegion);
      }
    }
  }, [params?.country, paramRegion]);

  const countryInfo = COUNTRIES_METADATA[country] || COUNTRIES_METADATA["PH"];
  const unit = RANGE_CONFIG[range]?.unit || "MW";

  const timeSpan = useMemo(() => {
    if (!points || points.length === 0) return undefined;
    return {
      start: points[0].timestamp,
      end: points[points.length - 1].timestamp,
    };
  }, [points]);

  const mobilePeriodLabel = useMemo(() => {
    if (!timeSpan?.start || !timeSpan?.end) return "Period Total";
    try {
      const s = formatMarketDate(timeSpan.start, "d MMM");
      const e = formatMarketDate(timeSpan.end, "d MMM");
      return s === e ? formatMarketDate(timeSpan.start, "d MMM yyyy") : `${s} – ${e}`;
    } catch {
      return "Period Total";
    }
  }, [timeSpan]);

  const syncUrlParams = useCallback(
    (newParams: { range?: string; view?: string; palette?: string; region?: string }) => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (newParams.range !== undefined) url.searchParams.set("range", newParams.range);
      if (newParams.view !== undefined) url.searchParams.set("view", newParams.view);
      if (newParams.palette !== undefined) url.searchParams.set("palette", newParams.palette);
      if (newParams.region !== undefined) url.searchParams.set("region", newParams.region);
      window.history.replaceState(null, "", url.toString());
    },
    []
  );

  const handleCountryChange = (newCountry: CountryCode) => {
    setCountry(newCountry);
    const info = COUNTRIES_METADATA[newCountry];
    if (info) {
      setRegion(info.defaultRegion);
    }
    setHoveredPoint(null);
    router.push(`/country/${newCountry}?range=${range}&view=${viewMode}&palette=${paletteMode}`);
  };

  const handleRangeChange = (newRange: TimeRange) => {
    setRange(newRange);
    setStoredPreference(PREFERENCE_KEYS.RANGE, newRange);
    syncUrlParams({ range: newRange });
    setHoveredPoint(null);
  };

  const handleViewModeChange = (newView: ViewMode) => {
    setViewMode(newView);
    setStoredPreference(PREFERENCE_KEYS.VIEW_MODE, newView);
    syncUrlParams({ view: newView });
  };

  const handlePaletteModeChange = (newPalette: PaletteMode) => {
    setPaletteMode(newPalette);
    setStoredPreference(PREFERENCE_KEYS.PALETTE_MODE, newPalette);
    syncUrlParams({ palette: newPalette });
  };

  const handleRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
    syncUrlParams({ region: newRegion });
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { startDate, endDate } = getDateRangeParams(range);
      const res = await fetch(
        `/api/energy?country=${country}&region=${region}&start_date=${startDate}&end_date=${endDate}&range=${range}`
      );
      if (res.ok) {
        const json = await res.json();
        const alignedPoints = alignPointsToTimeGrid(json.points || [], range, json.interval);
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
      const emptyPoints = alignPointsToTimeGrid([], range);
      setPoints(emptyPoints);
      setBreakdown([]);
      setSummary(null);
      setDataSource("none");
    } finally {
      setIsLoading(false);
    }
  }, [country, region, range]);

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
        onRegionChange={handleRegionChange}
        range={range}
        onRangeChange={handleRangeChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        paletteMode={paletteMode}
        onPaletteModeChange={handlePaletteModeChange}
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
              No live telemetry data available for this range.
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
          <div className="lg:col-span-8 flex flex-col gap-2.5">
            {/* Mobile Persistent Status & Scrub Slot (Screens < 1024px) */}
            <div
              className={`lg:hidden flex items-center justify-between px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-mono shadow-2xs transition-colors duration-150 ${hoveredPoint
                  ? "bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30"
                  : "bg-neutral-100/80 dark:bg-[#18181B]/80 border border-neutral-200/80 dark:border-[#27272A]/80"
                }`}
            >
              {hoveredPoint ? (
                <>
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="text-neutral-800 dark:text-neutral-200 font-semibold truncate">
                      {formatMarketDate(hoveredPoint.timestamp, "d MMM, h:mm a")}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2.5 shrink-0">
                    <span className="text-neutral-900 dark:text-white font-bold">
                      {Math.round(hoveredPoint.totalGeneration || 0).toLocaleString()} {unit}
                    </span>
                    {hoveredPoint.renewablesPct != null && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {Math.round(hoveredPoint.renewablesPct)}% Clean
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-600 shrink-0" />
                    <span className="text-neutral-600 dark:text-neutral-400 font-medium truncate">
                      {mobilePeriodLabel}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-neutral-600 dark:text-neutral-400 font-medium shrink-0">
                    <span>
                      {unit === "GWh"
                        ? `${summary?.totalGenerationGWh?.toFixed(1) || 0} GWh`
                        : summary?.peakGenerationMW
                          ? `Peak ${Math.round(summary.peakGenerationMW).toLocaleString()} MW`
                          : "—"}
                    </span>
                    {summary?.renewablesPct != null && (
                      <>
                        <span className="text-neutral-300 dark:text-neutral-700">&bull;</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {Math.round(summary.renewablesPct)}% Clean
                        </span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <GenerationChart
              data={points}
              range={range}
              viewMode={viewMode}
              paletteMode={paletteMode}
              hoveredFuel={hoveredFuel}
              onHoverPoint={setHoveredPoint}
            />

            {/* Chart 2: Emissions Volume (tCO2e/interval) */}
            <EmissionsChart
              data={points}
              range={range}
              viewMode={viewMode}
              hoveredFuel={hoveredFuel}
              onHoverPoint={setHoveredPoint}
            />

            {/* Chart 3: Spot Market Price */}
            <PriceChart
              data={points}
              range={range}
              country={country}
              hasSpotMarket={countryInfo.hasSpotMarket}
              spotMarketNote={countryInfo.spotMarketNote}
              currencySymbol={countryInfo.currencySymbol}
              currencyCode={countryInfo.currencyCode}
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
      <footer className="border-t border-neutral-200 dark:border-[#27272A] bg-neutral-900 dark:bg-[#09090B] text-neutral-300 py-2.5 px-4 text-[11px] font-mono select-none">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-1 text-neutral-400">
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

          <div className="text-neutral-400 text-[10px] sm:text-[11px]">
            <span>Sources: IEMOP (PH), EMA (SG), Single Buyer (MY), EGAT (TH)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
