"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
  Zap,
  Flame,
  BarChart3,
  ArrowRight,
  Leaf,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  X,
} from "lucide-react";

interface RegionalBenchmarkStripProps {
  countryData: Record<
    CountryCode,
    {
      breakdown: FuelBreakdownRow[];
      summary: SummaryMetrics | null;
    }
  >;
  range: TimeRange;
  paletteMode: PaletteMode;
  isLoading?: boolean;
}

const LIVE_COUNTRIES: CountryCode[] = ["MY", "TH", "PH", "SG"];

const RANGE_LABELS: Record<TimeRange, string> = {
  "1d": "Past 24 Hours",
  "3d": "Past 3 Days",
  "7d": "Past 7 Days",
  "30d": "Past 30 Days",
  "1y": "Past 1 Year",
};

type SortField = "intensity" | "renewables";
type SortDirection = "asc" | "desc";

export function RegionalBenchmarkStrip({
  countryData,
  range,
  paletteMode,
  isLoading = false,
}: RegionalBenchmarkStripProps) {
  // Sort state for the emissions/renewables comparison table
  const [sortField, setSortField] = useState<SortField>("intensity");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Info popover/modal state for methodology
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isInfoHovered, setIsInfoHovered] = useState(false);
  const infoContainerRef = useRef<HTMLDivElement>(null);

  // Close info panel when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        infoContainerRef.current &&
        !infoContainerRef.current.contains(e.target as Node)
      ) {
        setIsInfoOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsInfoOpen(false);
        setIsInfoHovered(false);
      }
    }

    if (isInfoOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isInfoOpen]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // For intensity, lower is cleaner, so default ascending
      // For renewables, higher is cleaner, so default descending
      setSortDir(field === "intensity" ? "asc" : "desc");
    }
  };

  // Aggregate stats across tracked countries
  const {
    countryRows,
    totalRegionalGWh,
    weightedAvgIntensity,
    hasAnyData,
  } = useMemo(() => {
    let totalGWh = 0;
    let totalEmissionsTonnes = 0;
    const rows: {
      code: CountryCode;
      name: string;
      flag: string;
      genGWh: number;
      peakMW: number;
      intensity: number;
      dominantFuel: string;
      dominantPct: number;
      cleanPct: number;
    }[] = [];

    for (const code of LIVE_COUNTRIES) {
      const data = countryData[code];
      const summary = data?.summary;
      const breakdown = data?.breakdown || [];
      const info = COUNTRIES_METADATA[code];

      const genGWh = summary?.totalGenerationGWh || 0;
      const peakMW = summary?.peakGenerationMW || 0;
      const intensity = summary?.emissionsIntensityGPerKWh || 0;
      const emissionsTonnes = summary?.totalEmissionsTonnes || 0;
      const cleanPct = summary?.renewablesPct != null ? Math.round(summary.renewablesPct) : 0;

      // Find top fuel
      const topFuelRow = [...breakdown].sort((a, b) => b.percentage - a.percentage)[0];
      const dominantFuel = topFuelRow ? topFuelRow.label : "Grid Mix";
      const dominantPct = topFuelRow ? Math.round(topFuelRow.percentage) : 0;

      if (genGWh > 0) {
        totalGWh += genGWh;
        totalEmissionsTonnes += emissionsTonnes;
      }

      rows.push({
        code,
        name: info?.name || code,
        flag: info?.flag || "⚡",
        genGWh,
        peakMW,
        intensity,
        dominantFuel,
        dominantPct,
        cleanPct,
      });
    }

    const weightedAvg =
      totalGWh > 0 ? Math.round((totalEmissionsTonnes / (totalGWh * 1000)) * 1000) : 0;

    return {
      countryRows: rows,
      totalRegionalGWh: totalGWh,
      weightedAvgIntensity: weightedAvg,
      hasAnyData: totalGWh > 0,
    };
  }, [countryData]);

  // Countries sorted by market volume (generation GWh) descending for the treemap
  const sortedByVolume = useMemo(() => {
    return [...countryRows]
      .filter((r) => r.genGWh > 0)
      .sort((a, b) => b.genGWh - a.genGWh);
  }, [countryRows]);

  // Countries sorted dynamically for the table
  const sortedTableRows = useMemo(() => {
    const valid = countryRows.filter((r) => r.genGWh > 0);
    return [...valid].sort((a, b) => {
      if (sortField === "intensity") {
        return sortDir === "asc" ? a.intensity - b.intensity : b.intensity - a.intensity;
      } else {
        return sortDir === "asc" ? a.cleanPct - b.cleanPct : b.cleanPct - a.cleanPct;
      }
    });
  }, [countryRows, sortField, sortDir]);

  // Treemap column partition for up to 4 countries
  const treemapLayout = useMemo(() => {
    if (sortedByVolume.length === 0) return null;
    if (sortedByVolume.length <= 2) {
      return {
        leftColumn: sortedByVolume,
        rightColumn: [],
        leftWidthPct: 100,
        rightWidthPct: 0,
      };
    }
    // 3 or 4 countries: divide into Left (top 2) and Right (remaining)
    const leftCol = sortedByVolume.slice(0, 2);
    const rightCol = sortedByVolume.slice(2);

    const leftVol = leftCol.reduce((acc, c) => acc + c.genGWh, 0);
    const rightVol = rightCol.reduce((acc, c) => acc + c.genGWh, 0);
    const totalVol = leftVol + rightVol || 1;

    // Proportional column split clamped between 54% and 65% for readability
    const naturalLeftPct = (leftVol / totalVol) * 100;
    const clampedLeftPct = Math.min(65, Math.max(54, Math.round(naturalLeftPct)));
    const clampedRightPct = 100 - clampedLeftPct;

    return {
      leftColumn: leftCol,
      rightColumn: rightCol,
      leftWidthPct: clampedLeftPct,
      rightWidthPct: clampedRightPct,
    };
  }, [sortedByVolume]);

  const formatEnergy = (gwh: number) => {
    if (gwh >= 1000) {
      return `${(gwh / 1000).toFixed(1)} TWh`;
    }
    return `${Math.round(gwh).toLocaleString()} GWh`;
  };

  const formatPeak = (mw: number) => {
    if (mw >= 1000) {
      return `${(mw / 1000).toFixed(1)} GW`;
    }
    return `${Math.round(mw).toLocaleString()} MW`;
  };

  const getIntensityBadge = (intensity: number) => {
    if (intensity < 250) {
      return {
        bg: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
        label: "Clean",
      };
    }
    if (intensity < 500) {
      return {
        bg: "bg-teal-500/10 dark:bg-teal-500/15 border-teal-500/20 text-teal-700 dark:text-teal-400",
        label: "Gas",
      };
    }
    if (intensity < 650) {
      return {
        bg: "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20 text-amber-700 dark:text-amber-400",
        label: "Mixed",
      };
    }
    return {
      bg: "bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20 text-rose-700 dark:text-rose-400",
      label: "Coal",
    };
  };

  return (
    <div className="mb-6 rounded-xl border border-neutral-200/80 dark:border-[#1E1E21] bg-white dark:bg-[#0C0C0E] shadow-xs transition-all relative overflow-hidden">
      {/* Benchmark Header Banner */}
      <div className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-t-xl border-b border-neutral-100 dark:border-[#1E1E21] flex flex-wrap items-center justify-between gap-2 bg-neutral-50/50 dark:bg-[#121215]/50">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <h2 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-neutral-50 tracking-tight">
            Regional Benchmark
          </h2>
          <span className="text-[10px] sm:text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-200/60 dark:bg-[#1C1C20] text-neutral-600 dark:text-neutral-400">
            {RANGE_LABELS[range] || "7D Window"}
          </span>
        </div>

        {/* Combined Tracked Aggregates */}
        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-[11px] font-mono">
          {isLoading ? (
            <div className="h-4 w-44 bg-neutral-200/60 dark:bg-neutral-800 animate-pulse rounded" />
          ) : hasAnyData ? (
            <>
              <div className="flex items-center space-x-1 text-neutral-600 dark:text-neutral-400">
                <span>Combined Tracked:</span>
                <span className="font-bold text-neutral-950 dark:text-white">
                  {formatEnergy(totalRegionalGWh)}
                </span>
              </div>
              <span className="text-neutral-300 dark:text-neutral-700 hidden sm:inline">&bull;</span>
              <div className="flex items-center space-x-1 text-neutral-600 dark:text-neutral-400">
                <span>Weighted Avg:</span>
                <span className="font-bold text-neutral-950 dark:text-white">
                  {weightedAvgIntensity} <span className="text-[10px] font-normal">g/kWh</span>
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* 2-Column Comparative Layout: Treemap Tiles vs Carbon & Renewables Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-b-xl divide-y lg:divide-y-0 lg:divide-x divide-neutral-100 dark:divide-[#1E1E21] min-w-0">
        {/* Left Column (7 cols): Proportional Treemap Area Tiles */}
        <div className="lg:col-span-7 min-w-0 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 mb-3">
            <div className="flex items-center space-x-1.5">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Energy Market Scale</span>
            </div>
          </div>

          {isLoading ? (
            <div className="h-48 rounded-lg bg-neutral-100 dark:bg-[#121215] animate-pulse" />
          ) : treemapLayout ? (
            <div className="h-48 sm:h-52 w-full flex gap-2">
              {/* Left Treemap Column (Top 2 markets) */}
              <div
                className="flex flex-col gap-2 h-full"
                style={{ width: `${treemapLayout.leftWidthPct}%` }}
              >
                {treemapLayout.leftColumn.map((c) => {
                  const leftColTotal = treemapLayout.leftColumn.reduce(
                    (acc, item) => acc + item.genGWh,
                    0
                  );
                  const flexGrowth = Math.max(1, Math.round((c.genGWh / (leftColTotal || 1)) * 100));

                  return (
                    <Link
                      key={c.code}
                      href={`/country/${c.code}?range=${range}&palette=${paletteMode}`}
                      style={{ flex: `${flexGrowth} 1 0%` }}
                      className="group p-2.5 sm:p-3 rounded-lg border border-neutral-200/80 dark:border-[#222226] bg-neutral-50/70 dark:bg-[#121215] hover:border-emerald-500/40 dark:hover:border-emerald-500/40 hover:bg-neutral-100/80 dark:hover:bg-[#18181D] transition-all flex flex-col justify-between overflow-hidden shadow-2xs cursor-pointer min-h-0"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <span className="text-base sm:text-lg leading-none select-none shrink-0">
                            {c.flag}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                            {c.name}
                          </span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-neutral-300 dark:text-neutral-600 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>

                      <div className="mt-1">
                        <div className="font-mono font-bold text-xs sm:text-sm text-neutral-950 dark:text-white">
                          {formatEnergy(c.genGWh)}
                        </div>
                        {c.peakMW > 0 && (
                          <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                            {formatPeak(c.peakMW)} peak
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Right Treemap Column (Smaller markets) */}
              {treemapLayout.rightColumn.length > 0 && (
                <div
                  className="flex flex-col gap-2 h-full"
                  style={{ width: `${treemapLayout.rightWidthPct}%` }}
                >
                  {treemapLayout.rightColumn.map((c) => {
                    const rightColTotal = treemapLayout.rightColumn.reduce(
                      (acc, item) => acc + item.genGWh,
                      0
                    );
                    const flexGrowth = Math.max(
                      1,
                      Math.round((c.genGWh / (rightColTotal || 1)) * 100)
                    );

                    return (
                      <Link
                        key={c.code}
                        href={`/country/${c.code}?range=${range}&palette=${paletteMode}`}
                        style={{ flex: `${flexGrowth} 1 0%` }}
                        className="group p-2.5 sm:p-3 rounded-lg border border-neutral-200/80 dark:border-[#222226] bg-neutral-50/70 dark:bg-[#121215] hover:border-emerald-500/40 dark:hover:border-emerald-500/40 hover:bg-neutral-100/80 dark:hover:bg-[#18181D] transition-all flex flex-col justify-between overflow-hidden shadow-2xs cursor-pointer min-h-0"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="text-base sm:text-lg leading-none select-none shrink-0">
                              {c.flag}
                            </span>
                            <span className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                              {c.name}
                            </span>
                          </div>
                          <ArrowRight className="w-3 h-3 text-neutral-300 dark:text-neutral-600 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>

                        <div className="mt-1">
                          <div className="font-mono font-bold text-xs sm:text-sm text-neutral-950 dark:text-white">
                            {formatEnergy(c.genGWh)}
                          </div>
                          {c.peakMW > 0 && (
                            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                              {formatPeak(c.peakMW)} peak
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-neutral-400">
              No market telemetry reported
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Sortable Carbon & Renewables Table */}
        <div className="lg:col-span-5 min-w-0 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 mb-2">
              <div className="flex items-center space-x-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>Decarbonization</span>
              </div>

              {/* Information Icon & Desktop Popover */}
              <div
                ref={infoContainerRef}
                className="relative"
                onMouseEnter={() => setIsInfoHovered(true)}
                onMouseLeave={() => setIsInfoHovered(false)}
              >
                <button
                  type="button"
                  onClick={() => setIsInfoOpen((prev) => !prev)}
                  className={`p-1 rounded-md transition-colors flex items-center justify-center ${isInfoOpen || isInfoHovered
                    ? "bg-neutral-200/80 dark:bg-[#27272A] text-neutral-900 dark:text-white"
                    : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#1E1E22]"
                    }`}
                  title="How intensity and clean numbers are calculated"
                  aria-label="How intensity and clean numbers are calculated"
                  aria-expanded={isInfoOpen || isInfoHovered}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>

                {/* Desktop Hover / Pinned Popover (Screens >= 640px) */}
                {(isInfoOpen || isInfoHovered) && (
                  <div className="hidden sm:block absolute right-0 top-full mt-1.5 w-96 bg-white dark:bg-[#121215] border border-neutral-200/90 dark:border-[#27272A] rounded-xl shadow-2xl p-4 z-50 text-left normal-case tracking-normal">
                    {/* Popover Header */}
                    <div className="flex items-start justify-between pb-2 border-b border-neutral-100 dark:border-[#202024]">
                      <div>
                        <h3 className="font-bold text-xs text-neutral-950 dark:text-white">
                          Decarbonization Methodology
                        </h3>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          Formulas and emission factors for grid comparison
                        </p>
                      </div>
                      {isInfoOpen && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsInfoOpen(false);
                            setIsInfoHovered(false);
                          }}
                          className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#1C1C20] transition-colors"
                          aria-label="Close methodology panel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Popover Content */}
                    <div className="py-2.5 space-y-3 text-xs text-neutral-600 dark:text-neutral-300">
                      {/* Metric 1: Carbon Intensity */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
                            Carbon Intensity
                          </span>
                          <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            &darr; Lower is cleaner
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-1.5">
                          Grams of greenhouse gases emitted per kilowatt-hour of electricity generated on the grid (<span className="font-mono">gCO₂e/kWh</span>).
                        </p>
                        <div className="bg-neutral-50 dark:bg-[#18181C] rounded-lg p-2.5 border border-neutral-100 dark:border-[#222226] text-[10px] font-mono space-y-1.5">
                          <div>
                            <span className="text-neutral-400">Calculation: </span>
                            <span className="text-neutral-800 dark:text-neutral-200 font-semibold">
                              &sum; (Fuel Gen &times; Factor) &divide; Total Gen
                            </span>
                          </div>
                          <div className="pt-1 border-t border-neutral-200/50 dark:border-[#27272A] grid grid-cols-2 gap-x-2 gap-y-0.5 text-neutral-600 dark:text-neutral-400">
                            <div>Coal: <span className="font-medium text-neutral-900 dark:text-neutral-200">900 g/kWh</span></div>
                            <div>Oil: <span className="font-medium text-neutral-900 dark:text-neutral-200">750 g/kWh</span></div>
                            <div>Gas: <span className="font-medium text-neutral-900 dark:text-neutral-200">380 g/kWh</span></div>
                            <div>Geothermal: <span className="font-medium text-neutral-900 dark:text-neutral-200">50 g/kWh</span></div>
                            <div>Biomass: <span className="font-medium text-neutral-900 dark:text-neutral-200">20 g/kWh</span></div>
                            <div>Solar/Wind/Hydro: <span className="font-medium text-emerald-600 dark:text-emerald-400">0 g/kWh</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Metric 2: Clean % */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
                            Clean % (Renewables)
                          </span>
                          <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            &uarr; Higher is cleaner
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-1.5">
                          Share of total electricity generation supplied by zero- and low-carbon renewable sources.
                        </p>
                        <div className="bg-neutral-50 dark:bg-[#18181C] rounded-lg p-2.5 border border-neutral-100 dark:border-[#222226] text-[10px] font-mono space-y-1">
                          <div>
                            <span className="text-neutral-400">Calculation: </span>
                            <span className="text-neutral-800 dark:text-neutral-200 font-semibold">
                              Renewable Gen &divide; Total Gen &times; 100%
                            </span>
                          </div>
                          <div className="text-neutral-500 dark:text-neutral-400">
                            Includes Solar, Wind, Hydro, Geothermal, Biomass, and Battery storage dispatch.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Popover Footer */}
                    <div className="pt-2 border-t border-neutral-100 dark:border-[#202024] text-[10px] text-neutral-400 dark:text-neutral-500 flex items-center justify-between font-mono">
                      <span>Window: Past 30 Days</span>
                      <span>Verified Dispatch Telemetry</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Table Header Row with Interactive Sort Controls */}
            <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 pb-1.5 border-b border-neutral-200/70 dark:border-[#202024] select-none">
              <div className="col-span-5 flex items-center">
                <span>Country</span>
              </div>

              {/* Intensity Sort Button */}
              <div className="col-span-4 flex justify-end">
                <button
                  onClick={() => handleSort("intensity")}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded border text-xs transition cursor-pointer ${sortField === "intensity"
                    ? "text-neutral-950 dark:text-white font-bold bg-neutral-100 dark:bg-[#1E1E22] border-neutral-300 dark:border-neutral-700 shadow-2xs"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 border-transparent hover:border-neutral-200 dark:hover:border-[#27272A] hover:bg-neutral-100/70 dark:hover:bg-[#1E1E22]/60"
                    }`}
                  title="Sort by Carbon Intensity (lower is cleaner)"
                >
                  <span>Intensity</span>
                  {sortField === "intensity" ? (
                    sortDir === "asc" ? (
                      <ArrowUp className="w-3 h-3 text-emerald-500 shrink-0" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-amber-500 shrink-0" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                  )}
                </button>
              </div>

              {/* Renewables Sort Button */}
              <div className="col-span-3 flex justify-end">
                <button
                  onClick={() => handleSort("renewables")}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded border text-xs transition cursor-pointer ${sortField === "renewables"
                    ? "text-neutral-950 dark:text-white font-bold bg-neutral-100 dark:bg-[#1E1E22] border-neutral-300 dark:border-neutral-700 shadow-2xs"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 border-transparent hover:border-neutral-200 dark:hover:border-[#27272A] hover:bg-neutral-100/70 dark:hover:bg-[#1E1E22]/60"
                    }`}
                  title="Sort by Renewable Share (higher is cleaner)"
                >
                  <span>Clean %</span>
                  {sortField === "renewables" ? (
                    sortDir === "desc" ? (
                      <ArrowDown className="w-3 h-3 text-emerald-500 shrink-0" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-amber-500 shrink-0" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                  )}
                </button>
              </div>
            </div>

            {/* Sub-header cue: Lower is cleaner vs Higher is cleaner */}
            <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 py-1 font-mono">
              <span>Primary fuel</span>
              <div className="flex items-center space-x-3">
                <span className={sortField === "intensity" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}>
                  &darr; lower is cleaner
                </span>
                <span className={sortField === "renewables" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}>
                  &uarr; higher is cleaner
                </span>
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-neutral-100 dark:divide-[#18181B] mt-0.5">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="py-2 flex justify-between items-center animate-pulse">
                    <div className="h-3 w-28 bg-neutral-100 dark:bg-[#18181B] rounded" />
                    <div className="h-3 w-16 bg-neutral-100 dark:bg-[#18181B] rounded" />
                    <div className="h-3 w-12 bg-neutral-100 dark:bg-[#18181B] rounded" />
                  </div>
                ))
              ) : (
                sortedTableRows.map((row) => {
                  const badge = getIntensityBadge(row.intensity);

                  return (
                    <Link
                      key={row.code}
                      href={`/country/${row.code}?range=${range}&palette=${paletteMode}`}
                      className="grid grid-cols-12 gap-2 items-center py-2 px-1 rounded-md hover:bg-neutral-50 dark:hover:bg-[#141417] transition-colors group cursor-pointer"
                    >
                      {/* Country & Dominant Fuel */}
                      <div className="col-span-5 flex items-center space-x-1.5 min-w-0">
                        <span className="text-base select-none shrink-0">{row.flag}</span>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                            {row.name}
                          </div>
                          <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                            {row.dominantFuel} {row.dominantPct}%
                          </div>
                        </div>
                      </div>

                      {/* Carbon Intensity Column */}
                      <div className="col-span-4 flex items-center justify-end space-x-1 font-mono text-xs text-right">
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded border font-semibold hidden sm:inline ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                        <span className="font-bold text-neutral-900 dark:text-neutral-50">
                          {row.intensity > 0 ? (
                            <>
                              {row.intensity}{" "}
                              <span className="text-[10px] font-normal text-neutral-400">g/kWh</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>

                      {/* Clean % Column */}
                      <div className="col-span-3 flex items-center justify-end font-mono text-xs text-right">
                        <span
                          className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${row.cleanPct >= 25
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : row.cleanPct >= 10
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                            }`}
                        >
                          <Leaf className="w-2.5 h-2.5" />
                          <span>{row.cleanPct}%</span>
                        </span>
                        <ArrowRight className="w-3 h-3 text-neutral-300 dark:text-neutral-600 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all ml-1 shrink-0" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Modal Dialog (Screens < 640px) */}
      {isInfoOpen && (
        <div
          className="sm:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsInfoOpen(false)}
        >
          <div
            className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-white dark:bg-[#121215] border border-neutral-200 dark:border-[#27272A] rounded-2xl p-4 shadow-2xl text-left normal-case tracking-normal space-y-3 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-2 border-b border-neutral-100 dark:border-[#202024]">
              <div>
                <h3 className="font-bold text-sm text-neutral-950 dark:text-white">
                  Decarbonization Methodology
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Formulas and emission factors for grid comparison
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#1C1C20] transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-300">
              {/* Carbon Intensity */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
                    Carbon Intensity
                  </span>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    &darr; Lower is cleaner
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-1.5">
                  Measures grams of greenhouse gases emitted per kilowatt-hour of electricity generated on the grid (<span className="font-mono">gCO₂e/kWh</span>).
                </p>
                <div className="bg-neutral-50 dark:bg-[#18181C] rounded-lg p-2.5 border border-neutral-100 dark:border-[#222226] text-[10px] font-mono space-y-1.5">
                  <div>
                    <span className="text-neutral-400">Calculation: </span>
                    <span className="text-neutral-800 dark:text-neutral-200 font-semibold">
                      &sum; (Fuel Gen &times; Factor) &divide; Total Gen
                    </span>
                  </div>
                  <div className="pt-1 border-t border-neutral-200/50 dark:border-[#27272A] grid grid-cols-2 gap-1 text-neutral-600 dark:text-neutral-400">
                    <div>Coal: <span className="font-medium text-neutral-900 dark:text-neutral-200">900 g/kWh</span></div>
                    <div>Oil: <span className="font-medium text-neutral-900 dark:text-neutral-200">750 g/kWh</span></div>
                    <div>Gas: <span className="font-medium text-neutral-900 dark:text-neutral-200">380 g/kWh</span></div>
                    <div>Geothermal: <span className="font-medium text-neutral-900 dark:text-neutral-200">50 g/kWh</span></div>
                    <div>Biomass: <span className="font-medium text-neutral-900 dark:text-neutral-200">20 g/kWh</span></div>
                    <div>Solar/Wind/Hydro: <span className="font-medium text-emerald-600 dark:text-emerald-400">0 g/kWh</span></div>
                  </div>
                </div>
              </div>

              {/* Clean % */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
                    Clean % (Renewables)
                  </span>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    &uarr; Higher is cleaner
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-1.5">
                  Share of total electricity generation supplied by zero- and low-carbon renewable sources.
                </p>
                <div className="bg-neutral-50 dark:bg-[#18181C] rounded-lg p-2.5 border border-neutral-100 dark:border-[#222226] text-[10px] font-mono space-y-1">
                  <div>
                    <span className="text-neutral-400">Calculation: </span>
                    <span className="text-neutral-800 dark:text-neutral-200 font-semibold">
                      Renewable Gen &divide; Total Gen &times; 100%
                    </span>
                  </div>
                  <div className="text-neutral-500 dark:text-neutral-400">
                    Includes Solar, Wind, Hydro, Geothermal, Biomass, and Battery storage dispatch.
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setIsInfoOpen(false)}
              className="w-full py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
