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
import { CountryWaffleCard } from "@/components/CountryWaffleCard";
import { UnavailableCountryCard } from "@/components/UnavailableCountryCard";
import { useTheme } from "@/components/ThemeProvider";
import { getDateRangeParams } from "@/lib/chartUtils";
import {
  Palette,
  Leaf,
  Sun,
  Moon,
  RotateCw,
} from "lucide-react";

const COUNTRY_CODES: CountryCode[] = ["PH", "SG", "MY", "TH", "VN", "ID"];

const TIME_RANGES: { id: TimeRange; label: string; sub: string }[] = [
  { id: "1d", label: "24 Hours", sub: "Daily dispatch" },
  { id: "7d", label: "7 Days", sub: "Weekly average" },
  { id: "30d", label: "30 Days", sub: "Monthly mix" },
];

export default function SoutheastAsiaOverviewPage() {
  const { isDark, toggleTheme } = useTheme();
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("clean-fossil");
  const [range, setRange] = useState<TimeRange>("7d");
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
        const interval =
          range === "1d"
            ? "30m"
            : range === "7d"
              ? "1h"
              : range === "1y"
                ? "1w"
                : "1d";
        const res = await fetch(
          `/api/energy?country=${code}&region=ALL&start_date=${startDate}&end_date=${endDate}&range=${range}&interval=${interval}`
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-xs shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <svg
                  className="h-4.5 w-4.5 text-white fill-white"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div className="flex items-baseline">
                <span className="font-sans font-extrabold text-xl tracking-tight text-neutral-950 dark:text-white">
                  Open<span className="text-emerald-600 dark:text-emerald-400 font-black">Electricity</span>
                </span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hidden sm:inline-block">
                  Southeast Asia
                </span>
              </div>
            </Link>

            {/* Controls Bar */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Palette Mode Toggle */}
              <div className="flex items-center border border-neutral-200 dark:border-[#27272A] rounded p-0.5 bg-neutral-50/50 dark:bg-[#121215]">
                <button
                  onClick={() => setPaletteMode("clean-fossil")}
                  className={`flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 rounded text-xs font-medium transition ${paletteMode === "clean-fossil"
                    ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
                    }`}
                  title="Clean (Green) vs. Fossil (Slate)"
                >
                  <Leaf className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Clean / Fossil</span>
                </button>
                <button
                  onClick={() => setPaletteMode("detailed")}
                  className={`flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 rounded text-xs font-medium transition ${paletteMode === "detailed"
                    ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
                    }`}
                  title="Full Multi-Color Palette"
                >
                  <Palette className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  <span className="hidden sm:inline">Detailed</span>
                </button>
              </div>

              {/* Time Range Selector */}
              <div className="flex border border-neutral-200 dark:border-[#27272A] rounded p-0.5 text-xs font-medium bg-neutral-50/50 dark:bg-[#121215]">
                {TIME_RANGES.map((rng) => (
                  <button
                    key={rng.id}
                    onClick={() => setRange(rng.id)}
                    className={`px-2 sm:px-2.5 py-0.5 rounded transition ${range === rng.id
                      ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold border border-neutral-300 dark:border-neutral-700 shadow-sm"
                      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      }`}
                  >
                    {rng.label}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchAllCountriesData}
                disabled={isLoading}
                className="p-1.5 rounded border border-neutral-200 dark:border-[#27272A] hover:bg-neutral-50 dark:hover:bg-[#121215] text-neutral-700 dark:text-neutral-300 text-xs transition disabled:opacity-50"
                title="Refresh datasets"
              >
                <RotateCw
                  className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-500" : ""}`}
                />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded border border-neutral-200 dark:border-[#27272A] hover:bg-neutral-50 dark:hover:bg-[#121215] text-neutral-700 dark:text-neutral-300 text-xs transition"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle Theme"
              >
                {isDark ? (
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-neutral-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Minimal page heading */}
        <div className="mb-6">
          <h1 className="text-lg sm:text-xl font-bold text-neutral-950 dark:text-white tracking-tight">
            Southeast Asia Electricity Mix
          </h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
            Generation by fuel source &bull; Click to explore
          </p>
        </div>

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
                isLoading={isLoading && !data}
              />
            );
          })}
        </div>
      </main>

      {/* Sleek Bottom OpenNEM Status Bar */}
      <footer className="border-t border-neutral-200 dark:border-[#27272A] bg-neutral-900 dark:bg-[#09090B] text-neutral-300 py-2.5 px-4 sm:px-8 text-[11px] font-mono select-none mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-3 text-neutral-400">
            <span className="text-neutral-200 font-semibold">v4.54.10</span>
            <span>&bull;</span>
            <span>4 Live Grids &bull; 2 Under Observation (VN, ID)</span>
          </div>

          <div className="flex items-center space-x-4 text-neutral-400">
            <span>Sources: IEMOP (PH), EMA (SG), Single Buyer (MY), EGAT (TH)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
