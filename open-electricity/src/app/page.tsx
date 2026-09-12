"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CountryCode,
  TimeRange,
  PaletteMode,
  FuelBreakdownRow,
  SummaryMetrics,
  COUNTRIES_METADATA,
} from "@/lib/types";
import {
  PREFERENCE_KEYS,
  getStoredPreference,
  setStoredPreference,
} from "@/lib/preferences";
import { CountryWaffleCard } from "@/components/CountryWaffleCard";
import { UnavailableCountryCard } from "@/components/UnavailableCountryCard";
import { RegionalBenchmarkStrip } from "@/components/RegionalBenchmarkStrip";
import { useTheme } from "@/components/ThemeProvider";
import { getDateRangeParams } from "@/lib/chartUtils";
import {
  Palette,
  Leaf,
  Sun,
  Moon,
  RotateCw,
  Clock,
} from "lucide-react";

const COUNTRY_CODES: CountryCode[] = ["PH", "SG", "MY", "TH", "VN", "ID"];

const VALID_PALETTES: readonly PaletteMode[] = ["clean-fossil", "detailed"];

export default function SoutheastAsiaOverviewPage() {
  const { isDark, toggleTheme } = useTheme();
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("clean-fossil");
  const range: TimeRange = "30d";
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Client-side hydration of palette from localStorage
  useEffect(() => {
    const storedPalette = getStoredPreference<PaletteMode>(
      PREFERENCE_KEYS.PALETTE_MODE,
      VALID_PALETTES,
      "clean-fossil"
    );
    if (storedPalette !== "clean-fossil") {
      setPaletteMode(storedPalette);
    }
  }, []);

  const handlePaletteModeChange = (newPalette: PaletteMode) => {
    setPaletteMode(newPalette);
    setStoredPreference(PREFERENCE_KEYS.PALETTE_MODE, newPalette);
  };

  // Country datasets populated strictly from database API
  const [countryData, setCountryData] = useState<
    Record<
      CountryCode,
      {
        breakdown: FuelBreakdownRow[];
        summary: SummaryMetrics | null;
      }
    >
  >({} as any);

  // Fetch or update data whenever time range changes
  const fetchAllCountriesData = useCallback(async () => {
    setIsLoading(true);

    const liveCountries = COUNTRY_CODES.filter(
      (code) => COUNTRIES_METADATA[code]?.hasLivePipeline !== false
    );

    const { startDate, endDate } = getDateRangeParams(range);
    const promises = liveCountries.map(async (code) => {
      try {
        const res = await fetch(
          `/api/energy?country=${code}&region=ALL&start_date=${startDate}&end_date=${endDate}&range=${range}`
        );
        if (res.ok) {
          const json = await res.json();
          return {
            code,
            breakdown: json.breakdown || [],
            summary: json.summary || null,
          };
        }
        throw new Error("API not ok");
      } catch {
        return {
          code,
          breakdown: [],
          summary: null,
        };
      }
    });

    const results = await Promise.all(promises);
    setCountryData((prev) => {
      const updated = { ...prev };
      for (const res of results) {
        updated[res.code] = {
          breakdown: res.breakdown,
          summary: res.summary,
        };
      }
      return updated;
    });

    setIsLoading(false);
  }, [range]);

  useEffect(() => {
    fetchAllCountriesData();
  }, [fetchAllCountriesData]);

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAFA] dark:bg-[#000000] text-neutral-900 dark:text-neutral-100 font-sans transition-colors duration-150">
      {/* Top Global Navigation Bar */}
      <header className="bg-white dark:bg-[#000000] border-b border-neutral-200 dark:border-[#27272A] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between py-2 sm:py-0 sm:h-14 gap-y-2">
            {/* 1. Logo (order-1) */}
            <Link href="/" className="order-1 flex items-center space-x-2.5 group min-w-0">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-xs shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                <svg
                  className="h-4.5 w-4.5 text-white fill-white"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div className="flex items-baseline min-w-0">
                <span className="font-sans font-extrabold text-lg sm:text-xl tracking-tight text-neutral-950 dark:text-white truncate">
                  Open<span className="text-emerald-600 dark:text-emerald-400 font-black">Electricity</span>
                </span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hidden sm:inline-block">
                  Southeast Asia
                </span>
              </div>
            </Link>

            {/* 2. Global Actions: Refresh & Theme (order-2 on mobile, order-3 on desktop) */}
            <div className="order-2 sm:order-3 flex items-center space-x-1.5 sm:space-x-2">
              <button
                onClick={fetchAllCountriesData}
                disabled={isLoading}
                className="p-1.5 sm:p-2 rounded-md border border-neutral-200 dark:border-[#27272A] hover:bg-neutral-50 dark:hover:bg-[#121215] text-neutral-700 dark:text-neutral-300 transition disabled:opacity-50 shadow-xs"
                title="Refresh datasets"
                aria-label="Refresh datasets"
              >
                <RotateCw
                  className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLoading ? "animate-spin text-emerald-500" : ""}`}
                />
              </button>

              <button
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 rounded-md border border-neutral-200 dark:border-[#27272A] hover:bg-neutral-50 dark:hover:bg-[#121215] text-neutral-700 dark:text-neutral-300 transition shadow-xs"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle Theme"
              >
                {isDark ? (
                  <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
                ) : (
                  <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-600" />
                )}
              </button>
            </div>

            {/* 3. Controls: Palette Mode & Past 30 Days (order-3 on mobile row 2, order-2 on desktop inline) */}
            <div className="order-3 sm:order-2 w-full sm:w-auto flex items-center justify-between sm:justify-start space-x-2 sm:space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-[#27272A]/80">
              {/* Palette Mode Toggle */}
              <div className="flex items-center border border-neutral-200 dark:border-[#27272A] rounded-md p-0.5 bg-neutral-50/70 dark:bg-[#121215]">
                <button
                  onClick={() => handlePaletteModeChange("clean-fossil")}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 sm:py-0.5 rounded text-xs font-medium transition ${paletteMode === "clean-fossil"
                    ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold border border-neutral-300 dark:border-neutral-600 shadow-xs"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white border border-transparent"
                    }`}
                  title="Clean (Green) vs. Fossil (Slate)"
                >
                  <Leaf className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Clean / Fossil</span>
                </button>
                <button
                  onClick={() => handlePaletteModeChange("detailed")}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 sm:py-0.5 rounded text-xs font-medium transition ${paletteMode === "detailed"
                    ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold border border-neutral-300 dark:border-neutral-600 shadow-xs"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white border border-transparent"
                    }`}
                  title="Full Multi-Color Palette"
                >
                  <Palette className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span>Detailed</span>
                </button>
              </div>

              {/* Static Time Window Indicator & 48h Lag Pill */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 px-2.5 py-1 sm:py-0.5 rounded-md bg-neutral-100 dark:bg-[#18181B] border border-neutral-200 dark:border-[#27272A]">
                  Past 30 Days
                </span>
                <div
                  className="flex items-center space-x-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 px-2 py-1 sm:py-0.5 rounded-md bg-neutral-100 dark:bg-[#18181B] border border-neutral-200 dark:border-[#27272A]"
                  title="Consolidated market telemetry is displayed with a 48-hour (2-day) operational lag to ensure fully finalized operational days"
                >
                  <Clock className="h-3 w-3 text-neutral-500 dark:text-neutral-400 shrink-0" />
                  <span>48h lag</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Minimal page heading */}
        <div className="mb-4 sm:mb-5">
          <h1 className="text-lg sm:text-xl font-bold text-neutral-950 dark:text-white tracking-tight">
            Southeast Asia Electricity Mix
          </h1>
          <p className="text-xs sm:text-[13px] text-neutral-600 dark:text-neutral-400 mt-0.5">
            Electricity generation, grid scale, and carbon intensity across tracked markets (48-hour operational lag)
          </p>
        </div>

        {/* Regional Market Scale & Carbon Intensity Benchmark Strip */}
        <RegionalBenchmarkStrip
          countryData={countryData}
          range={range}
          paletteMode={paletteMode}
          isLoading={isLoading}
        />

        {/* 6-Country Grid — 3 cols */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {COUNTRY_CODES.map((code) => {
            const isLive = COUNTRIES_METADATA[code]?.hasLivePipeline !== false;
            if (!isLive) {
              return <UnavailableCountryCard key={code} country={code} />;
            }
            const data = countryData[code];
            return (
              <CountryWaffleCard
                key={code}
                country={code}
                breakdown={data?.breakdown || []}
                summary={data?.summary || null}
                paletteMode={paletteMode}
                range={range}
                isLoading={isLoading && !data}
              />
            );
          })}
        </div>
      </main>

      {/* Sleek Bottom OpenNEM Status Bar */}
      <footer className="border-t border-neutral-200 dark:border-[#27272A] bg-neutral-900 dark:bg-[#09090B] text-neutral-300 py-2.5 px-4 sm:px-8 text-[11px] font-mono select-none mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-neutral-400">
            <span className="text-neutral-200 font-semibold">v4.54.10</span>
            <span>&bull;</span>
            <span>4 Live Grids &bull; 2 Under Observation (VN, ID)</span>
          </div>

          <div className="text-neutral-400 text-[10px] sm:text-[11px]">
            <span>Sources: IEMOP (PH), EMA (SG), Single Buyer (MY), EGAT (TH)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
