"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Region, TimeRange, TimeInterval, ViewMode, FuelGenerationPoint, SummaryMetrics, FuelBreakdownRow, InterconnectorFlow } from "@/lib/types";
import { Header } from "@/components/Header";
import { SummaryCards } from "@/components/SummaryCards";
import { GenerationChart } from "@/components/GenerationChart";
import { PriceChart } from "@/components/PriceChart";
import { FuelTable } from "@/components/FuelTable";
import { InterconnectorCard } from "@/components/InterconnectorCard";
import { generateMockEnergyData } from "@/lib/mockData";
import { Info, ExternalLink } from "lucide-react";

export default function DashboardPage() {
  const [region, setRegion] = useState<Region>("ALL");
  const [range, setRange] = useState<TimeRange>("7d");
  const [interval, setInterval] = useState<TimeInterval>("30m");
  const [viewMode, setViewMode] = useState<ViewMode>("discrete");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [points, setPoints] = useState<FuelGenerationPoint[]>([]);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [breakdown, setBreakdown] = useState<FuelBreakdownRow[]>([]);
  const [interconnectors, setInterconnectors] = useState<InterconnectorFlow[]>([]);
  const [dataSource, setDataSource] = useState<string>("live");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/energy?region=${region}&range=${range}&interval=${interval}`);
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
      console.warn("Using fallback local dataset:", e);
      const fallback = generateMockEnergyData(region, range);
      setPoints(fallback.points);
      setSummary(fallback.summary);
      setBreakdown(fallback.breakdown);
      setInterconnectors(fallback.interconnectors);
      setDataSource("simulation_dataset");
    } finally {
      setIsLoading(false);
    }
  }, [region, range, interval]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      <Header
        region={region}
        onRegionChange={setRegion}
        range={range}
        onRangeChange={setRange}
        interval={interval}
        onIntervalChange={setInterval}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={fetchData}
        isLoading={isLoading}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* KPI Metrics */}
        {summary && <SummaryCards metrics={summary} region={region} />}

        {/* Main Charts Area */}
        <div className="space-y-3.5">
          <GenerationChart data={points} viewMode={viewMode} height="430px" />
          <PriceChart data={points} height="170px" />
        </div>

        {/* Two-column Layout: Fuel Table + Interconnectors */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <div className="lg:col-span-2">
            <FuelTable breakdown={breakdown} />
          </div>

          <div className="space-y-4">
            <InterconnectorCard interconnectors={interconnectors} />

            {/* Information Card */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 text-xs text-slate-600 space-y-2 shadow-sm">
              <div className="flex items-center space-x-2 text-slate-900 font-semibold">
                <Info className="h-4 w-4 text-emerald-600" />
                <span>About OpenElectricity Philippines</span>
              </div>
              <p className="leading-relaxed">
                An open-source energy transition and spot market tracker for the Philippine Wholesale Electricity Spot Market (WESM), inspired by the OpenNEM platform.
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Source: <strong className="text-slate-700 font-semibold">IEMOP / WESM</strong></span>
                <a
                  href="https://www.iemop.ph/the-market/market-data/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  <span>iemop.ph</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            OpenElectricity PH &copy; {new Date().getFullYear()} &bull; Built with Next.js, Tailwind CSS &amp; ECharts.
          </span>
          <div className="flex items-center space-x-4">
            <a
              href="https://explore.openelectricity.org.au/"
              target="_blank"
              rel="noreferrer"
              className="text-slate-600 hover:text-slate-900 transition"
            >
              OpenNEM Australia
            </a>
            <a
              href="https://www.iemop.ph"
              target="_blank"
              rel="noreferrer"
              className="text-slate-600 hover:text-slate-900 transition"
            >
              IEMOP WESM
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
