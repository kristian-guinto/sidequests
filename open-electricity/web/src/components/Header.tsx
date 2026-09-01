"use client";

import React from "react";
import { Region, TimeRange, TimeInterval, ViewMode, RANGE_CONFIG } from "@/lib/types";
import { Zap, RefreshCw, BarChart2, Layers } from "lucide-react";

interface HeaderProps {
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

const REGIONS: { id: Region; label: string }[] = [
  { id: "ALL", label: "Philippines (NEM)" },
  { id: "LUZON", label: "Luzon" },
  { id: "VISAYAS", label: "Visayas" },
  { id: "MINDANAO", label: "Mindanao" },
];

const RANGES: { id: TimeRange; label: string }[] = [
  { id: "1d", label: "1D" },
  { id: "3d", label: "3D" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "1y", label: "1Y" },
];

export function Header({
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
                  PH
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium -mt-0.5">Philippine Power System Tracker</p>
            </div>
          </div>

          {/* Region Tabs (Desktop) */}
          <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            {REGIONS.map((r) => (
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

          {/* Actions & Status */}
          <div className="flex items-center space-x-2.5">
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium">WESM Live</span>
            </div>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition disabled:opacity-50 shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile Region Tabs */}
        <div className="flex md:hidden py-2 border-t border-slate-100 overflow-x-auto space-x-1.5">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => onRegionChange(r.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                region === r.id ? "bg-slate-900 text-white font-semibold" : "text-slate-600 bg-slate-100"
              }`}
            >
              {r.label}
            </button>
          ))}
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
                    range === rng.id ? "bg-white text-slate-900 font-semibold shadow-sm" : "hover:text-slate-900"
                  }`}
                >
                  {rng.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Interval Resolution (Filtered by current Range) */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Interval:</span>
            <div className="flex bg-slate-100 rounded-md p-0.5 border border-slate-200/80">
              {allowedIntervals.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => onIntervalChange(inv.id)}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    interval === inv.id ? "bg-white text-slate-900 font-semibold shadow-sm" : "hover:text-slate-900"
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
                  viewMode === "discrete" ? "bg-white text-slate-900 font-semibold shadow-sm" : "hover:text-slate-900"
                }`}
              >
                <BarChart2 className="h-3 w-3" />
                <span>Discrete</span>
              </button>
              <button
                onClick={() => onViewModeChange("cumulative")}
                className={`flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs transition ${
                  viewMode === "cumulative" ? "bg-white text-slate-900 font-semibold shadow-sm" : "hover:text-slate-900"
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
