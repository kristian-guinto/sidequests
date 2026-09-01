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
import { Zap, RefreshCw, BarChart2, Layers, ChevronDown, Globe } from "lucide-react";

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
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const currentCountry = COUNTRIES_METADATA[country] || COUNTRIES_METADATA["PH"];
  const availableRegions = currentCountry.regions;

  const handleCountrySelect = (newCountry: CountryCode) => {
    onCountryChange(newCountry);
    const info = COUNTRIES_METADATA[newCountry];
    if (info) {
      onRegionChange(info.defaultRegion);
    }
    setIsCountryMenuOpen(false);
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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 text-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <Zap className="h-4 w-4 fill-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-slate-900">
                  Open<span className="text-emerald-600">Electricity</span>
                </span>
                <span className="text-[11px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.5 rounded border border-emerald-200">
                  SEA
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium -mt-0.5">
                Southeast Asia Energy Market Tracker
              </p>
            </div>
          </div>

          {/* Center: Country Selector & Regional Tabs */}
          <div className="hidden lg:flex items-center space-x-3">
            {/* Country Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsCountryMenuOpen(!isCountryMenuOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 transition shadow-sm"
              >
                <span className="text-base">{currentCountry.flag}</span>
                <span>{currentCountry.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              </button>

              {isCountryMenuOpen && (
                <div className="absolute left-0 mt-1.5 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Country
                  </div>
                  {(Object.keys(COUNTRIES_METADATA) as CountryCode[]).map((cCode) => {
                    const cInfo = COUNTRIES_METADATA[cCode];
                    const isSelected = country === cCode;
                    return (
                      <button
                        key={cCode}
                        onClick={() => handleCountrySelect(cCode)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition ${
                          isSelected ? "bg-emerald-50 text-emerald-900 font-bold" : "text-slate-700"
                        }`}
                      >
                        <span className="flex items-center space-x-2">
                          <span className="text-base">{cInfo.flag}</span>
                          <span>{cInfo.name}</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {cInfo.currencyCode}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Region Tabs (Desktop) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              {availableRegions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onRegionChange(r.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    region === r.id
                      ? "bg-white text-slate-900 font-semibold shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Actions & Status */}
          <div className="flex items-center space-x-2.5">
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium">{currentCountry.currencyCode} Market</span>
            </div>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition disabled:opacity-50 shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin text-emerald-600" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Mobile Country & Region Bar */}
        <div className="flex lg:hidden py-2 border-t border-slate-100 items-center justify-between gap-2 overflow-x-auto">
          {/* Mobile Country Selector */}
          <select
            value={country}
            onChange={(e) => handleCountrySelect(e.target.value as CountryCode)}
            className="text-xs bg-slate-100 border border-slate-200 rounded-md px-2 py-1 font-semibold text-slate-800"
          >
            {(Object.keys(COUNTRIES_METADATA) as CountryCode[]).map((cCode) => (
              <option key={cCode} value={cCode}>
                {COUNTRIES_METADATA[cCode].flag} {COUNTRIES_METADATA[cCode].name}
              </option>
            ))}
          </select>

          {/* Mobile Region Tabs */}
          <div className="flex space-x-1 overflow-x-auto">
            {availableRegions.map((r) => (
              <button
                key={r.id}
                onClick={() => onRegionChange(r.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                  region === r.id
                    ? "bg-slate-900 text-white font-semibold"
                    : "text-slate-600 bg-slate-100"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Control Sub-bar: Range, Interval, View Mode */}
        <div className="flex flex-wrap items-center justify-between py-2 border-t border-slate-100 text-xs text-slate-600 gap-2">
          {/* Time Range */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Range:</span>
            <div className="flex bg-slate-100 rounded-md p-0.5 border border-slate-200/80">
              {RANGES.map((rng) => (
                <button
                  key={rng.id}
                  onClick={() => handleRangeClick(rng.id)}
                  className={`px-2.5 py-0.5 rounded text-xs transition ${
                    range === rng.id
                      ? "bg-white text-slate-900 font-semibold shadow-sm"
                      : "hover:text-slate-900"
                  }`}
                >
                  {rng.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Interval Resolution */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Interval:</span>
            <div className="flex bg-slate-100 rounded-md p-0.5 border border-slate-200/80">
              {allowedIntervals.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => onIntervalChange(inv.id)}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    interval === inv.id
                      ? "bg-white text-slate-900 font-semibold shadow-sm"
                      : "hover:text-slate-900"
                  }`}
                >
                  {inv.label}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">View:</span>
            <div className="flex bg-slate-100 rounded-md p-0.5 border border-slate-200/80">
              <button
                onClick={() => onViewModeChange("discrete")}
                className={`flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs transition ${
                  viewMode === "discrete"
                    ? "bg-white text-slate-900 font-semibold shadow-sm"
                    : "hover:text-slate-900"
                }`}
              >
                <BarChart2 className="h-3 w-3" />
                <span>Discrete</span>
              </button>
              <button
                onClick={() => onViewModeChange("cumulative")}
                className={`flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs transition ${
                  viewMode === "cumulative"
                    ? "bg-white text-slate-900 font-semibold shadow-sm"
                    : "hover:text-slate-900"
                }`}
              >
                <Layers className="h-3 w-3" />
                <span>Cumulative</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
