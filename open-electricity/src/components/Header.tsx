"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CountryCode,
  Region,
  TimeRange,
  ViewMode,
  PaletteMode,
  COUNTRIES_METADATA,
} from "@/lib/types";
import {
  Share2,
  AreaChart as AreaIcon,
  RotateCw,
  Check,
  Percent,
  Palette,
  Leaf,
  Sun,
  Moon,
  LayoutGrid,
  MapPin,
  Clock,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface HeaderProps {
  country: CountryCode;
  onCountryChange: (c: CountryCode) => void;
  region: Region;
  onRegionChange: (r: Region) => void;
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  paletteMode: PaletteMode;
  onPaletteModeChange: (p: PaletteMode) => void;
  onRefresh: () => void;
  isLoading: boolean;
  dataSource?: string;
}

const RANGES: { id: TimeRange; label: string }[] = [
  { id: "1d", label: "1D" },
  { id: "3d", label: "3D" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "1y", label: "1Y" },
];

export function Header({
  country,
  onCountryChange,
  region,
  onRegionChange,
  range,
  onRangeChange,
  viewMode,
  onViewModeChange,
  paletteMode,
  onPaletteModeChange,
  onRefresh,
  isLoading,
  dataSource = "connected",
}: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  const currentCountry = COUNTRIES_METADATA[country] || COUNTRIES_METADATA["PH"];
  const currentRegionObj =
    currentCountry.regions.find((r) => r.id === region) || currentCountry.regions[0];

  const handleCountrySelect = (newCountry: CountryCode) => {
    onCountryChange(newCountry);
    const info = COUNTRIES_METADATA[newCountry];
    if (info) {
      onRegionChange(info.defaultRegion);
    }
  };

  const handleRegionSelect = (regId: string) => {
    onRegionChange(regId);
  };

  const handleRangeClick = (newRange: TimeRange) => {
    onRangeChange(newRange);
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasMultipleRegions = currentCountry.regions.length > 1;

  return (
    <header className="bg-white dark:bg-[#000000] border-b border-neutral-200 dark:border-[#27272A] sticky top-0 z-50 text-neutral-800 dark:text-neutral-200 transition-colors">
      {/* Top Bar: Brand & Live Status / Global Actions */}
      <div className="w-full px-3 sm:px-6 lg:px-8 border-b border-neutral-100 dark:border-[#27272A]/80">
        <div className="flex items-center justify-between h-13 py-2">
          {/* Logo Mark & Name */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-2.5 cursor-pointer group min-w-0">
            <div className="h-7.5 w-7.5 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-xs shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
              <svg
                className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-white fill-white"
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
            </div>
          </Link>

          {/* Right Status & Action Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs text-neutral-600 dark:text-neutral-400 shrink-0">
            {/* Data Source Indicator */}
            {dataSource === "duckdb_local" || dataSource === "local" ? (
              <div
                className="flex items-center space-x-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-blue-500/20 text-[10px] sm:text-[11px] font-medium"
                title="Connected to local DuckDB database"
              >
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-blue-500" />
                <span>local</span>
              </div>
            ) : dataSource === "motherduck" || dataSource === "motherduck_cloud" ? (
              <div
                className="flex items-center space-x-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-emerald-500/20 text-[10px] sm:text-[11px] font-medium"
                title="Connected to MotherDuck Cloud"
              >
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500" />
                <span>cloud</span>
              </div>
            ) : null}

            {/* 48h Operational Lag Indicator Pill */}
            <div
              className="flex items-center space-x-1 sm:space-x-1.5 bg-neutral-100 dark:bg-[#18181B] text-neutral-600 dark:text-neutral-300 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-neutral-200 dark:border-[#27272A] text-[10px] sm:text-[11px] font-medium"
              title="Consolidated market telemetry is displayed with a 48-hour (2-day) operational lag to ensure fully finalized operational days"
            >
              <Clock className="h-3 w-3 text-neutral-500 dark:text-neutral-400 shrink-0" />
              <span>48h lag</span>
            </div>

            {/* Country Currency Pill */}
            <div className="hidden md:flex items-center space-x-1.5 bg-neutral-50 dark:bg-[#121215] px-2.5 py-1 rounded-md border border-neutral-200 dark:border-[#27272A] text-[11px] font-medium">
              <span className="text-neutral-800 dark:text-neutral-200">
                {currentCountry.name} ({currentCountry.currencyCode})
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center p-1.5 rounded border border-neutral-200 dark:border-[#27272A] hover:bg-neutral-50 dark:hover:bg-[#121215] text-neutral-700 dark:text-neutral-300 text-xs transition"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-neutral-600" />
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded border border-neutral-200 dark:border-[#27272A] hover:bg-neutral-50 dark:hover:bg-[#121215] text-neutral-700 dark:text-neutral-300 text-xs font-medium transition disabled:opacity-50"
              title="Refresh Data"
            >
              <RotateCw
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-500" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Share Link Button */}
            <button
              onClick={handleShare}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded border border-neutral-200 dark:border-[#27272A] hover:bg-neutral-50 dark:hover:bg-[#121215] text-neutral-700 dark:text-neutral-300 text-xs font-medium transition"
              title="Copy Page Link"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-semibold hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Toolbar: Navigation & Controls */}
      <div className="w-full px-3 sm:px-6 lg:px-8 py-2 bg-white dark:bg-[#000000] space-y-2">
        {/* Row 1: Country Navigation Bar (Flag Buttons) */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Back to Overview */}
          <Link
            href="/"
            className="flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 bg-neutral-50 dark:bg-[#121215] hover:bg-neutral-100 dark:hover:bg-[#18181B] border border-neutral-200 dark:border-[#27272A] rounded text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition shadow-xs group shrink-0"
            title="Return to Southeast Asia Overview"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-neutral-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors" />
            <span className="hidden sm:inline">All Countries</span>
            <span className="sm:hidden">All</span>
          </Link>

          <div className="h-4 w-px bg-neutral-200 dark:bg-[#27272A] shrink-0" />

          {/* Segmented Flag Icon Country Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0">
            {(Object.keys(COUNTRIES_METADATA) as CountryCode[]).map((cCode) => {
              const cInfo = COUNTRIES_METADATA[cCode];
              const isSelected = country === cCode;
              const isAvailable = Boolean(cInfo.hasLivePipeline);

              if (!isAvailable) {
                return (
                  <button
                    key={cCode}
                    disabled
                    aria-disabled="true"
                    title={`${cInfo.name} (Data telemetry unavailable)`}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium shrink-0 bg-neutral-100/50 dark:bg-[#121215]/40 text-neutral-400 dark:text-neutral-600 border border-neutral-200/40 dark:border-[#27272A]/40 cursor-not-allowed grayscale opacity-40 select-none"
                  >
                    <span className="text-base leading-none select-none">{cInfo.flag}</span>
                    <span className="hidden md:inline">{cInfo.name}</span>
                    <span className="md:hidden font-semibold">{cInfo.code}</span>
                  </button>
                );
              }

              return (
                <button
                  key={cCode}
                  onClick={() => handleCountrySelect(cCode)}
                  title={cInfo.name}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition shrink-0 ${isSelected
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold shadow-xs border border-neutral-900 dark:border-white"
                    : "bg-neutral-50 dark:bg-[#121215] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-[#18181B] border border-neutral-200/80 dark:border-[#27272A]"
                    }`}
                >
                  <span className="text-base leading-none select-none">{cInfo.flag}</span>
                  <span className="hidden md:inline">{cInfo.name}</span>
                  <span className="md:hidden font-semibold">{cInfo.code}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Secondary Bar: Regions & Controls */}
        <div className={`flex flex-col md:flex-row md:items-center ${hasMultipleRegions ? "md:justify-between" : "md:justify-end"} gap-2 pt-1 border-t border-neutral-100 dark:border-[#27272A]/60`}>
          {/* Left: Region Selection (Visible when country has > 1 region) */}
          {hasMultipleRegions ? (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 py-0.5">
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-0.5">
                <MapPin className="h-3 w-3 text-neutral-400" />
                Region
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {currentCountry.regions.map((reg) => {
                  const isRegSelected = region === reg.id;
                  return (
                    <button
                      key={reg.id}
                      onClick={() => handleRegionSelect(reg.id)}
                      className={`px-2.5 py-0.5 rounded text-xs transition shrink-0 ${isRegSelected
                        ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950 font-bold shadow-xs"
                        : "bg-neutral-100 dark:bg-[#121215] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-[#1C1C20] hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-[#27272A]"
                        }`}
                    >
                      {reg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="hidden md:flex items-center space-x-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
              <span>Grid: {currentRegionObj.label}</span>
            </div>
          )}

          {/* Right / Row 3 (on mobile): View Mode, Palette, and Range controls in horizontal scroll container */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            {/* Palette Mode Toggle (Clean / Fossil vs Detailed) */}
            <div className="flex items-center border border-neutral-200 dark:border-[#27272A] rounded-md p-0.5 bg-neutral-50/70 dark:bg-[#121215] shrink-0">
              <button
                onClick={() => onPaletteModeChange("clean-fossil")}
                className={`flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 rounded text-xs font-medium transition ${paletteMode === "clean-fossil"
                  ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold border border-neutral-300 dark:border-neutral-600 shadow-2xs"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white border border-transparent"
                  }`}
                title="2-Tone Clean vs. Fossil Mode"
              >
                <Leaf className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                <span className="hidden sm:inline">Clean / Fossil</span>
              </button>
              <button
                onClick={() => onPaletteModeChange("detailed")}
                className={`flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 rounded text-xs font-medium transition ${paletteMode === "detailed"
                  ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold border border-neutral-300 dark:border-neutral-600 shadow-2xs"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white border border-transparent"
                  }`}
                title="Full Multi-Color Fuel Mix"
              >
                <Palette className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                <span className="hidden sm:inline">Detailed</span>
              </button>
            </div>

            {/* Chart Mode Toggle (Percentage vs Value) */}
            <div className="flex items-center border border-neutral-200 dark:border-[#27272A] rounded-md p-0.5 bg-neutral-50/70 dark:bg-[#121215] shrink-0">
              <button
                onClick={() => onViewModeChange("percentage")}
                className={`flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 rounded text-xs font-medium transition ${viewMode === "percentage"
                  ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold border border-neutral-300 dark:border-neutral-600 shadow-2xs"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white border border-transparent"
                  }`}
                title="Percentage Contribution Share (%)"
              >
                <Percent className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                <span className="hidden sm:inline">Percentage</span>
              </button>
              <button
                onClick={() => onViewModeChange("stacked")}
                className={`flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 rounded text-xs font-medium transition ${viewMode === "stacked" || viewMode === "cumulative"
                  ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold border border-neutral-300 dark:border-neutral-600 shadow-2xs"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white border border-transparent"
                  }`}
                title="Absolute Value (MW / GWh)"
              >
                <AreaIcon className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                <span className="hidden sm:inline">Value</span>
              </button>
            </div>

            {/* Range Pills (1D, 3D, 7D, 30D, 1Y) */}
            <div className="flex border border-neutral-200 dark:border-[#27272A] rounded-md p-0.5 text-xs font-medium bg-neutral-50/70 dark:bg-[#121215] shrink-0">
              {RANGES.map((rng) => (
                <button
                  key={rng.id}
                  onClick={() => handleRangeClick(rng.id)}
                  className={`px-2 sm:px-2.5 py-0.5 rounded transition ${range === rng.id
                    ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold border border-neutral-300 dark:border-neutral-600 shadow-2xs"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-transparent"
                    }`}
                >
                  {rng.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
