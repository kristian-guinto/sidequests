"use client";

import React, { useState } from "react";
import {
  CountryCode,
  Region,
  TimeRange,
  TimeInterval,
  ViewMode,
  RANGE_CONFIG,
  COUNTRIES_METADATA,
} from "@/lib/types";
import {
  ChevronDown,
  Share2,
  AreaChart as AreaIcon,
  RotateCw,
  Check,
  Percent,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface HeaderProps {
  country: CountryCode;
  onCountryChange: (c: CountryCode) => void;
  region: Region;
  onRegionChange: (r: Region) => void;
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
  interval: TimeInterval;
  onIntervalChange: (i: TimeInterval) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  onRefresh: () => void;
  isLoading: boolean;
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
  interval,
  onIntervalChange,
  viewMode,
  onViewModeChange,
  onRefresh,
  isLoading,
}: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const [isRegionMenuOpen, setIsRegionMenuOpen] = useState(false);
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
    setIsRegionMenuOpen(false);
  };

  const handleRegionSelect = (regId: string) => {
    onRegionChange(regId);
    setIsRegionMenuOpen(false);
  };

  const handleRangeClick = (newRange: TimeRange) => {
    onRangeChange(newRange);
    const config = RANGE_CONFIG[newRange];
    if (config) {
      onIntervalChange(config.defaultInterval);
    }
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const allowedIntervals = RANGE_CONFIG[range]?.allowedIntervals || [
    { id: "5m", label: "5m" },
    { id: "30m", label: "30m" },
  ];

  return (
    <header className="bg-white dark:bg-[#000000] border-b border-neutral-200 dark:border-[#27272A] sticky top-0 z-50 text-neutral-800 dark:text-neutral-200 transition-colors">
      {/* Top Bar: Brand & Live Status */}
      <div className="w-full px-4 sm:px-6 lg:px-8 border-b border-neutral-100 dark:border-[#27272A]/80">
        <div className="flex items-center justify-between h-13 py-2.5">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex items-baseline space-x-1.5 cursor-pointer">
              <span className="font-serif font-bold text-xl tracking-tight text-neutral-900 dark:text-white">
                Open
              </span>
              <span className="text-emerald-500 font-sans font-light text-xl">~</span>
              <span className="font-sans font-bold text-xl tracking-tight text-neutral-900 dark:text-white">
                Electricity
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#18181B] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-[#27272A] uppercase tracking-wider">
              SEA Tracker
            </span>
          </div>

          {/* Right Status Pill */}
          <div className="flex items-center space-x-2 text-xs text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center space-x-1.5 bg-neutral-50 dark:bg-[#121215] px-2.5 py-1 rounded-md border border-neutral-200 dark:border-[#27272A] text-[11px] font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-neutral-800 dark:text-neutral-200">
                {currentCountry.name} ({currentCountry.currencyCode})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Toolbar: Controls */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#000000]">
        {/* Left: Country / Region Dropdown */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Country & Region Menu */}
          <div className="relative">
            <button
              onClick={() => setIsRegionMenuOpen(!isRegionMenuOpen)}
              className="flex items-center space-x-2 px-2.5 py-1 bg-neutral-50 dark:bg-[#121215] hover:bg-neutral-100 dark:hover:bg-[#18181B] border border-neutral-200 dark:border-[#27272A] rounded text-xs font-semibold text-neutral-900 dark:text-neutral-100 transition shadow-sm"
            >
              <span className="text-sm">{currentCountry.flag}</span>
              <span>
                {currentCountry.name} &bull; {currentRegionObj.label}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
            </button>

            {isRegionMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-[#09090B] rounded-lg shadow-xl border border-neutral-200 dark:border-[#27272A] py-2 z-50 text-xs">
                <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  Select Country &amp; Region
                </div>
                {(Object.keys(COUNTRIES_METADATA) as CountryCode[]).map((cCode) => {
                  const cInfo = COUNTRIES_METADATA[cCode];
                  const isCurrentC = country === cCode;
                  return (
                    <div key={cCode} className="border-b border-neutral-100 dark:border-[#27272A]/60 last:border-0 py-1">
                      <button
                        onClick={() => handleCountrySelect(cCode)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition ${
                          isCurrentC
                            ? "font-bold text-neutral-950 dark:text-white bg-neutral-50 dark:bg-[#18181B]"
                            : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#121215]"
                        }`}
                      >
                        <span className="flex items-center space-x-2">
                          <span className="text-sm">{cInfo.flag}</span>
                          <span>{cInfo.name}</span>
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {cInfo.currencyCode}
                        </span>
                      </button>

                      {isCurrentC && (
                        <div className="pl-7 pr-3 py-1 space-y-0.5">
                          {cInfo.regions.map((reg) => (
                            <button
                              key={reg.id}
                              onClick={() => handleRegionSelect(reg.id)}
                              className={`w-full text-left px-2 py-1 rounded text-xs transition ${
                                region === reg.id
                                  ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium"
                                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#18181B]"
                              }`}
                            >
                              {reg.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="h-4 w-[1px] bg-neutral-200 dark:bg-[#27272A] mx-1 hidden sm:block" />

          {/* Chart Mode Toggle (Stacked vs 100% Stacked Area) */}
          <div className="flex items-center border border-neutral-200 dark:border-[#27272A] rounded p-0.5 bg-neutral-50/50 dark:bg-[#121215]">
            <button
              onClick={() => onViewModeChange("stacked")}
              className={`flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-medium transition ${
                viewMode === "stacked" || viewMode === "cumulative"
                  ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold shadow-sm"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
              }`}
              title="Standard Stacked Area Chart (MW / GWh)"
            >
              <AreaIcon className="h-3.5 w-3.5" />
              <span>Stacked</span>
            </button>
            <button
              onClick={() => onViewModeChange("percentage")}
              className={`flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-medium transition ${
                viewMode === "percentage"
                  ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold shadow-sm"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
              }`}
              title="100% Stacked Area Chart (%)"
            >
              <Percent className="h-3.5 w-3.5" />
              <span>100% Stacked</span>
            </button>
          </div>

          {/* Range Pills (1D, 3D, 7D, 30D, 1Y) */}
          <div className="flex border border-neutral-200 dark:border-[#27272A] rounded p-0.5 text-xs font-medium bg-neutral-50/50 dark:bg-[#121215]">
            {RANGES.map((rng) => (
              <button
                key={rng.id}
                onClick={() => handleRangeClick(rng.id)}
                className={`px-2.5 py-0.5 rounded transition ${
                  range === rng.id
                    ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold border border-neutral-300 dark:border-neutral-700 shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                {rng.label}
              </button>
            ))}
          </div>

          {/* Interval Resolution Pills */}
          <div className="flex border border-neutral-200 dark:border-[#27272A] rounded p-0.5 text-xs font-medium bg-neutral-50/50 dark:bg-[#121215]">
            {allowedIntervals.map((inv) => (
              <button
                key={inv.id}
                onClick={() => onIntervalChange(inv.id)}
                className={`px-2.5 py-0.5 rounded transition ${
                  interval === inv.id
                    ? "bg-white dark:bg-[#27272A] text-neutral-950 dark:text-white font-bold border border-neutral-300 dark:border-neutral-700 shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                {inv.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Controls: Theme Switcher, Refresh & Share */}
        <div className="flex items-center space-x-2">
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

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-neutral-200 dark:border-[#27272A] hover:bg-neutral-50 dark:hover:bg-[#121215] text-neutral-700 dark:text-neutral-300 text-xs font-medium transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RotateCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-500" : ""}`}
            />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-neutral-200 dark:border-[#27272A] hover:bg-neutral-50 dark:hover:bg-[#121215] text-neutral-700 dark:text-neutral-300 text-xs font-medium transition"
            title="Copy Page Link"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
