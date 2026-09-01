"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CountryCode,
  Region,
  TimeRange,
  TimeInterval,
  ViewMode,
  FuelGenerationPoint,
  FuelTech,
  SummaryMetrics,
  FuelBreakdownRow,
  InterconnectorFlow,
  RANGE_CONFIG,
  COUNTRIES_METADATA,
} from "@/lib/types";
import { Header } from "@/components/Header";
import { GenerationChart } from "@/components/GenerationChart";
import { EmissionsChart } from "@/components/EmissionsChart";
import { PriceChart } from "@/components/PriceChart";
import { DataSidebar } from "@/components/DataSidebar";
import { generateMockEnergyData } from "@/lib/mockData";

export default function DashboardPage() {
  const [country, setCountry] = useState<CountryCode>("PH");
  const [region, setRegion] = useState<Region>("ALL");
  const [range, setRange] = useState<TimeRange>("7d");
  const [interval, setInterval] = useState<TimeInterval>("30m");
  const [viewMode, setViewMode] = useState<ViewMode>("stacked");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [points, setPoints] = useState<FuelGenerationPoint[]>([]);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [breakdown, setBreakdown] = useState<FuelBreakdownRow[]>([]);
  const [interconnectors, setInterconnectors] = useState<InterconnectorFlow[]>([]);
  const [dataSource, setDataSource] = useState<string>("live");

  // Real-time hover cursor interaction state
  const [hoveredPoint, setHoveredPoint] = useState<FuelGenerationPoint | null>(null);
  const [hoveredFuel, setHoveredFuel] = useState<FuelTech | null>(null);

  const countryInfo = COUNTRIES_METADATA[country] || COUNTRIES_METADATA["PH"];
  const unit = RANGE_CONFIG[range]?.unit || "MW";

  const timeSpan = useMemo(() => {
    if (!points || points.length === 0) return undefined;
    return {
      start: points[0].timestamp,
      end: points[points.length - 1].timestamp,
    };
  }, [points]);

  const handleCountryChange = (newCountry: CountryCode) => {
    setCountry(newCountry);
    const info = COUNTRIES_METADATA[newCountry];
    if (info) {
      setRegion(info.defaultRegion);
    }
    setHoveredPoint(null);
  };

  const handleRangeChange = (newRange: TimeRange) => {
    setRange(newRange);
    const cfg = RANGE_CONFIG[newRange];
    if (cfg) {
      setInterval(cfg.defaultInterval);
    }
    setHoveredPoint(null);
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/energy?country=${country}&region=${region}&range=${range}&interval=${interval}`
      );
      if (res.ok) {
        const json = await res.json();
        setPoints(json.points || []);
        setSummary(json.summary || null);
        setBreakdown(json.breakdown || []);
        setInterconnectors(json.interconnectors || []);
        setDataSource(json.source || "api");
      } else {
        throw new Error("Failed to fetch API data");
      }
    } catch (e) {
      console.warn("Using fallback dataset:", e);
      const fallback = generateMockEnergyData(country, region, range, interval);
      setPoints(fallback.points);
      setSummary(fallback.summary);
      setBreakdown(fallback.breakdown);
      setInterconnectors(fallback.interconnectors);
      setDataSource("simulation_dataset");
    } finally {
      setIsLoading(false);
    }
  }, [country, region, range, interval]);

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
        onRegionChange={setRegion}
        range={range}
        onRangeChange={handleRangeChange}
        interval={interval}
        onIntervalChange={setInterval}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={fetchData}
        isLoading={isLoading}
      />

      {/* Main Full-Width Two-Column Workspace */}
      <main className="flex-1 w-full px-3 sm:px-4 lg:px-6 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* Left Column (8 cols ~ 67% width): Synchronized Chart Stack */}
          <div className="lg:col-span-8 space-y-2.5">
            {/* Chart 1: Generation by Fuel Tech (MW / GWh) */}
            <GenerationChart
              data={points}
              viewMode={viewMode}
              unit={unit}
              height="310px"
              hoveredFuel={hoveredFuel}
              onHoverPoint={setHoveredPoint}
            />

            {/* Chart 2: Emissions Volume (tCO2e/interval) */}
            <EmissionsChart
              data={points}
              viewMode={viewMode}
              height="170px"
              hoveredFuel={hoveredFuel}
              onHoverPoint={setHoveredPoint}
            />

            {/* Chart 3: Spot Market Price */}
            <PriceChart
              data={points}
              currencySymbol={countryInfo.currencySymbol}
              currencyCode={countryInfo.currencyCode}
              height="150px"
              onHoverPoint={setHoveredPoint}
            />
          </div>

          {/* Right Column (4 cols ~ 33% width): Sticky Fuel & Emissions Sidebar */}
          <div className="lg:col-span-4 lg:sticky lg:top-[105px]">
            <DataSidebar
              breakdown={breakdown}
              summary={summary}
              interconnectors={interconnectors}
              hoveredPoint={hoveredPoint}
              hoveredFuel={hoveredFuel}
              onHoverFuel={setHoveredFuel}
              timeSpan={timeSpan}
              currencySymbol={countryInfo.currencySymbol}
              currencyCode={countryInfo.currencyCode}
              unit={unit}
            />
          </div>
        </div>
      </main>

      {/* Sleek Bottom OpenNEM Status Bar */}
      <footer className="border-t border-neutral-200 dark:border-[#27272A] bg-neutral-900 dark:bg-[#09090B] text-neutral-300 py-1 px-4 text-[11px] font-mono select-none">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-3 text-neutral-400">
            <span className="text-neutral-200 font-semibold">v4.54.10</span>
            <span>&bull;</span>
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Engine: DuckDB OLAP</span>
            </span>
            <span>&bull;</span>
            <span>API: 4.5.11</span>
          </div>

          <div className="flex items-center space-x-4 text-neutral-400">
            <span>Sources: IEMOP (PH), EMA (SG), Single Buyer (MY), EGAT (TH)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
