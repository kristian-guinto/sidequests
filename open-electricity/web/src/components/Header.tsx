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
  Moon,
  Share2,
  AreaChart as AreaIcon,
  TrendingUp,
  RotateCw,
} from "lucide-react";

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
  const [isRegionMenuOpen, setIsRegionMenuOpen] = useState(false);
  const [isMetricMenuOpen, setIsMetricMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

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

  const allowedIntervals = RANGE_CONFIG[range]?.allowedIntervals || [
    { id: "5m", label: "5m" },
    { id: "30m", label: "30m" },
  ];

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-50 text-neutral-800">
      {/* Top Level Nav Bar */}
      <div className="w-full px-4 sm:px-6 lg:px-8 border-b border-neutral-100">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex items-baseline space-x-1.5 cursor-pointer">
              <span className="font-serif font-bold text-xl tracking-tight text-neutral-900">
                Open
              </span>
              <span className="text-emerald-600 font-sans font-light text-xl">~</span>
              <span className="font-sans font-bold text-xl tracking-tight text-neutral-900">
                Electricity
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-xs font-medium text-neutral-600">
            <button className="text-neutral-950 font-bold border-b-2 border-neutral-900 pb-4 pt-4 -mb-[1px] transition">
              Tracker
            </button>
            <button className="hover:text-neutral-900 transition py-4">Facilities</button>
            <button className="hover:text-neutral-900 transition py-4">Scenarios</button>
            <button className="hover:text-neutral-900 transition py-4">Records</button>
            <button className="hover:text-neutral-900 transition py-4">Analysis</button>
            <button className="hover:text-neutral-900 transition py-4">About</button>
          </nav>
        </div>
      </div>

      {/* Sub Toolbar */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 bg-white">
        {/* Left Controls: Metric, Country/Region, Chart Type, Range, Interval */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Metric Dropdown (Energy / Emissions / Price) */}
          <div className="relative">
            <button
              onClick={() => setIsMetricMenuOpen(!isMetricMenuOpen)}
              className="flex items-center space-x-1 text-sm font-semibold text-neutral-900 hover:text-neutral-600 py-1"
            >
              <span>Energy</span>
              <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
            </button>

            {isMetricMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-36 bg-white rounded-md shadow-lg border border-neutral-200 py-1 z-50 text-xs">
                <button
                  onClick={() => setIsMetricMenuOpen(false)}
                  className="w-full text-left px-3 py-1.5 font-semibold text-neutral-900 bg-neutral-50"
                >
                  Energy
                </button>
                <button
                  onClick={() => setIsMetricMenuOpen(false)}
                  className="w-full text-left px-3 py-1.5 text-neutral-600 hover:bg-neutral-50"
                >
                  Emissions
                </button>
                <button
                  onClick={() => setIsMetricMenuOpen(false)}
                  className="w-full text-left px-3 py-1.5 text-neutral-600 hover:bg-neutral-50"
                >
                  Prices
                </button>
              </div>
            )}
          </div>

          {/* Country / Region Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsRegionMenuOpen(!isRegionMenuOpen)}
              className="flex items-center space-x-1.5 text-sm font-semibold text-neutral-900 hover:text-neutral-600 py-1"
            >
              <span className="text-base">{currentCountry.flag}</span>
              <span>
                {currentCountry.name} ({currentRegionObj.label})
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
            </button>

            {isRegionMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-lg shadow-xl border border-neutral-200 py-2 z-50 text-xs">
                <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  Southeast Asia Grids
                </div>
                {(Object.keys(COUNTRIES_METADATA) as CountryCode[]).map((cCode) => {
                  const cInfo = COUNTRIES_METADATA[cCode];
                  const isCurrentC = country === cCode;
                  return (
                    <div key={cCode} className="border-b border-neutral-100 last:border-0 py-1">
                      <button
                        onClick={() => handleCountrySelect(cCode)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition ${
                          isCurrentC ? "font-bold text-neutral-950 bg-neutral-50" : "text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <span className="flex items-center space-x-2">
                          <span className="text-base">{cInfo.flag}</span>
                          <span>{cInfo.name}</span>
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {cInfo.currencyCode}
                        </span>
                      </button>

                      {isCurrentC && (
                        <div className="pl-8 pr-3 py-1 space-y-0.5">
                          {cInfo.regions.map((reg) => (
                            <button
                              key={reg.id}
                              onClick={() => handleRegionSelect(reg.id)}
                              className={`w-full text-left px-2 py-1 rounded text-xs transition ${
                                region === reg.id
                                  ? "bg-neutral-900 text-white font-medium"
                                  : "text-neutral-600 hover:bg-neutral-100"
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

          <div className="h-4 w-[1px] bg-neutral-200 mx-1 hidden sm:block" />

          {/* Chart Style Toggle (Area / Line) */}
          <div className="flex items-center border border-neutral-200 rounded p-0.5">
            <button
              onClick={() => onViewModeChange("cumulative")}
              className={`p-1 rounded transition ${
                viewMode === "cumulative"
                  ? "bg-neutral-100 text-neutral-900 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-700"
              }`}
              title="Stacked Area View"
            >
              <AreaIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange("discrete")}
              className={`p-1 rounded transition ${
                viewMode === "discrete"
                  ? "bg-neutral-100 text-neutral-900 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-700"
              }`}
              title="Discrete Line View"
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Range Pills (1D, 3D, 7D, 30D, 1Y) */}
          <div className="flex border border-neutral-200 rounded p-0.5 text-xs font-medium">
            {RANGES.map((rng) => (
              <button
                key={rng.id}
                onClick={() => handleRangeClick(rng.id)}
                className={`px-2.5 py-0.5 rounded transition ${
                  range === rng.id
                    ? "bg-white text-neutral-950 font-bold border border-neutral-300 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {rng.label}
              </button>
            ))}
          </div>

          {/* Interval Resolution Pills (5m, 30m) */}
          <div className="flex border border-neutral-200 rounded p-0.5 text-xs font-medium">
            {allowedIntervals.map((inv) => (
              <button
                key={inv.id}
                onClick={() => onIntervalChange(inv.id)}
                className={`px-2.5 py-0.5 rounded transition ${
                  interval === inv.id
                    ? "bg-white text-neutral-950 font-bold border border-neutral-300 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {inv.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Controls: View (Consumption/Generation), Refresh, Dark Mode, Share */}
        <div className="flex items-center space-x-2.5">
          {/* View Dropdown (Consumption / Generation) */}
          <div className="relative">
            <button
              onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
              className="flex items-center space-x-1 text-xs font-medium text-neutral-700 border border-neutral-200 rounded px-2.5 py-1 hover:bg-neutral-50 transition"
            >
              <span>Consumption</span>
              <ChevronDown className="h-3 w-3 text-neutral-400" />
            </button>

            {isViewMenuOpen && (
              <div className="absolute right-0 mt-1 w-32 bg-white rounded shadow-lg border border-neutral-200 py-1 z-50 text-xs">
                <button
                  onClick={() => setIsViewMenuOpen(false)}
                  className="w-full text-left px-3 py-1 font-semibold text-neutral-900 bg-neutral-50"
                >
                  Consumption
                </button>
                <button
                  onClick={() => setIsViewMenuOpen(false)}
                  className="w-full text-left px-3 py-1 text-neutral-600 hover:bg-neutral-50"
                >
                  Generation
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-600 transition"
            title="Refresh Data"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <button
            className="p-1.5 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-600 transition"
            title="Toggle Dark Mode"
          >
            <Moon className="h-3.5 w-3.5" />
          </button>

          <button
            className="p-1.5 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-600 transition"
            title="Share View"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
