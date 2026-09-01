"use client";

import React from "react";
import { Region, TimeRange, TimeInterval, ViewMode } from "@/lib/types";
import { Zap, Activity, Globe, RefreshCw, BarChart2, Layers } from "lucide-react";

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

const INTERVALS: { id: TimeInterval; label: string }[] = [
  { id: "5m", label: "5m" },
  { id: "30m", label: "30m" },
  { id: "1h", label: "1h" },
  { id: "1d", label: "1d" },
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
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  Open<span className="text-emerald-400">Electricity</span>
                </span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-1.5 py-0.5 rounded border border-emerald-500/30">
                  PH
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Philippines Power Market Tracker</p>
            </div>
          </div>

          {/* Region Tabs */}
          <div className="hidden md:flex items-center bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => onRegionChange(r.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${region === r.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                  }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Actions & Live Indicator */}
          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center space-x-2 text-xs font-medium text-slate-400 bg-slate-800/60 px-2.5 py-1.5 rounded-md border border-slate-700/60">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>WESM Live Data</span>
            </div>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile Region Bar */}
        <div className="flex md:hidden py-2 border-t border-slate-800 overflow-x-auto space-x-2">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => onRegionChange(r.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${region === r.id ? "bg-emerald-600 text-white" : "text-slate-400 bg-slate-800"
                }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Control Sub-bar: Range, Interval, View Mode */}
        <div className="flex flex-wrap items-center justify-between py-2.5 border-t border-slate-800/80 text-xs text-slate-300 gap-2">
          {/* Time Range */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 font-medium mr-1">Range:</span>
            <div className="flex bg-slate-800 rounded-md p-0.5 border border-slate-700">
              {RANGES.map((rng) => (
                <button
                  key={rng.id}
                  onClick={() => onRangeChange(rng.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${range === rng.id ? "bg-slate-700 text-emerald-400 font-semibold shadow-sm" : "hover:text-white"
                    }`}
                >
                  {rng.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Interval Resolution */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 font-medium mr-1">Interval:</span>
            <div className="flex bg-slate-800 rounded-md p-0.5 border border-slate-700">
              {INTERVALS.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => onIntervalChange(inv.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${interval === inv.id ? "bg-slate-700 text-emerald-400 font-semibold shadow-sm" : "hover:text-white"
                    }`}
                >
                  {inv.label}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Toggle (Discrete vs Cumulative) */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 font-medium mr-1">View:</span>
            <div className="flex bg-slate-800 rounded-md p-0.5 border border-slate-700">
              <button
                onClick={() => onViewModeChange("discrete")}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition ${viewMode === "discrete" ? "bg-slate-700 text-emerald-400 font-semibold shadow-sm" : "hover:text-white"
                  }`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                <span>Discrete</span>
              </button>
              <button
                onClick={() => onViewModeChange("cumulative")}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition ${viewMode === "cumulative" ? "bg-slate-700 text-emerald-400 font-semibold shadow-sm" : "hover:text-white"
                  }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Cumulative</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

