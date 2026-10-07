"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { MonthlyRevenueChart } from "@/components/monthly-revenue-chart";
import { RevenueHeatmap } from "@/components/revenue-heatmap";
import { OracleChart } from "@/components/oracle-chart";
import { StrategyScatter2D } from "@/components/strategy-scatter-2d";
import { StrategyClusterGuide } from "@/components/strategy-cluster-guide";
import { StrategyMethodNote } from "@/components/strategy-method-note";
import { IntervalChart, IntervalPowerChart } from "@/components/interval-chart";
import {
  KNOWN_BATTERIES,
  type BatteryDailyRow,
  type BatteryIntervalRow,
  type BatteryMonthlyRow,
  type BatteryOracleRow,
  type BatteryStatsRow,
  type BatterySummaryRow,
} from "@/lib/types";
import type { StrategyPoint } from "@/lib/strategy-types";
import { CLUSTER_NAMES, CLUSTER_COLORS } from "@/lib/strategy-types";

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "+";
  return `${sign}$${abs.toLocaleString("en-AU", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function fmtStat(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtDate(s: string): string {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtWeekday(s: string): string {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "long" });
}

const FCAS_SERVICE_KEYS: { key: keyof BatteryIntervalRow; label: string }[] = [
  { key: "raise6sec", label: "Raise 6s" },
  { key: "raise60sec", label: "Raise 60s" },
  { key: "raise5min", label: "Raise 5m" },
  { key: "raisereg", label: "Raise Reg" },
  { key: "lower6sec", label: "Lower 6s" },
  { key: "lower60sec", label: "Lower 60s" },
  { key: "lower5min", label: "Lower 5m" },
  { key: "lowerreg", label: "Lower Reg" },
];

function FcasBreakdown({ rows }: { rows: BatteryIntervalRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No interval data for this date.
      </p>
    );
  }

  const energyRevenue = rows.reduce((s, r) => s + r.energy_revenue, 0);
  const energyCost = rows.reduce((s, r) => s + r.energy_cost, 0);
  const netEnergy = energyRevenue - energyCost;
  const totalFcas = rows.reduce((s, r) => s + r.total_fcas, 0);
  const net = netEnergy + totalFcas;
  const intervalCount = rows.length;

  const fcasByKey: Record<string, number> = {};
  for (const { key } of FCAS_SERVICE_KEYS) {
    fcasByKey[key] = rows.reduce((s, r) => s + (r[key] as number), 0);
  }

  const sharePct = (v: number) =>
    Math.abs(net) > 0 ? ((v / net) * 100).toFixed(0) + "%" : "—";

  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-muted-foreground mb-2">
        {intervalCount} × 5-min intervals
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="pb-2 text-left font-medium">Source</th>
            <th className="pb-2 text-right font-medium">Revenue</th>
            <th className="pb-2 text-right font-medium">% of total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/40 hover:bg-muted/20 font-medium">
            <td className="py-1.5 text-green-600 dark:text-green-400">Energy</td>
            <td
              className={`py-1.5 text-right font-mono ${netEnergy >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {fmtDollar(netEnergy)}
            </td>
            <td className="py-1.5 text-right text-muted-foreground">
              {sharePct(netEnergy)}
            </td>
          </tr>
          {FCAS_SERVICE_KEYS.map(({ key, label }) => {
            const v = fcasByKey[key];
            return (
              <tr key={key} className="border-b border-border/40 hover:bg-muted/20">
                <td className="py-1.5 pl-3 text-muted-foreground">{label}</td>
                <td
                  className={`py-1.5 text-right font-mono ${v < 0 ? "text-red-500" : ""}`}
                >
                  {fmtDollar(v)}
                </td>
                <td className="py-1.5 text-right text-muted-foreground">
                  {sharePct(v)}
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-border font-semibold">
            <td className="pt-2 pb-1">Total</td>
            <td
              className={`pt-2 pb-1 text-right font-mono ${net >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {fmtDollar(net)}
            </td>
            <td className="pt-2 pb-1 text-right text-muted-foreground">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function BatteryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const batteryKey = typeof params.key === "string" ? params.key : "";
  const meta = KNOWN_BATTERIES[batteryKey];

  const [stats, setStats] = useState<BatteryStatsRow | null>(null);
  const [dailyRows, setDailyRows] = useState<BatteryDailyRow[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);

  const [monthlyRows, setMonthlyRows] = useState<BatteryMonthlyRow[]>([]);
  const [monthlyLoaded, setMonthlyLoaded] = useState(false);

  const [oracleRows, setOracleRows] = useState<BatteryOracleRow[]>([]);
  const [oracleLoaded, setOracleLoaded] = useState(false);
  const [oracleRange, setOracleRange] = useState<"30" | "90" | "365" | "all">("all");

  const [strategyPoints, setStrategyPoints] = useState<StrategyPoint[]>([]);
  const [strategyLoaded, setStrategyLoaded] = useState(false);

  const [allSummaries, setAllSummaries] = useState<BatterySummaryRow[]>([]);

  const tabParam = searchParams.get("tab");
  const validTabs = ["monthly", "intervals", "strategy", "potential"];
  const initialTab = tabParam && validTabs.includes(tabParam) ? tabParam : "monthly";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [intervalRows, setIntervalRows] = useState<BatteryIntervalRow[]>([]);
  const [intervalLoading, setIntervalLoading] = useState(false);
  const [dateStripAnimClass, setDateStripAnimClass] = useState("animate-date-strip-left");

  const loadDates = useCallback(async () => {
    if (!batteryKey) return;
    const res = await fetch(`/api/batteries/${batteryKey}/interval`, { cache: "no-store" });
    if (res.ok) {
      const dates: string[] = await res.json();
      setAvailableDates(dates);
      if (dates.length > 0) {
        setSelectedDate((prev) => prev || dates[0]);
      }
    }
  }, [batteryKey]);

  // Fetch stats once on mount; loadDates is independent of range
  useEffect(() => {
    if (!batteryKey) return;
    fetch(`/api/batteries/${batteryKey}/stats`, { cache: "no-store" })
      .then((r) => r.ok ? (r.json() as Promise<BatteryStatsRow>) : null)
      .then(setStats);
    fetch("/api/batteries/summary", { cache: "no-store" })
      .then((r) => r.ok ? (r.json() as Promise<BatterySummaryRow[]>) : [])
      .then(setAllSummaries);
    loadDates();
  }, [batteryKey, loadDates]);

  // Fetch all daily rows once on mount
  useEffect(() => {
    if (!batteryKey) return;
    setDailyLoading(true);
    fetch(`/api/batteries/${batteryKey}/daily?days=all`, { cache: "no-store" })
      .then((r) => r.ok ? (r.json() as Promise<BatteryDailyRow[]>) : [])
      .then(setDailyRows)
      .finally(() => setDailyLoading(false));
  }, [batteryKey]);

  useEffect(() => {
    if (activeTab !== "monthly" || monthlyLoaded || !batteryKey) return;
    fetch(`/api/batteries/${batteryKey}/monthly`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<BatteryMonthlyRow[]>) : []))
      .then((data) => {
        setMonthlyRows(data);
        setMonthlyLoaded(true);
      });
  }, [activeTab, monthlyLoaded, batteryKey]);

  // Lazy-load oracle whenever Potential tab is active OR oracleRange changes
  useEffect(() => {
    if (activeTab !== "potential" || !batteryKey) return;
    const param = oracleRange === "all" ? "all" : oracleRange;
    fetch(`/api/batteries/${batteryKey}/oracle?days=${param}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<BatteryOracleRow[]>) : []))
      .then((data) => {
        setOracleRows(data);
        setOracleLoaded(true);
      });
  }, [activeTab, batteryKey, oracleRange]);

  // Lazy-load strategy points on first Strategy tab visit
  useEffect(() => {
    if (activeTab !== "strategy" || strategyLoaded || !batteryKey) return;
    fetch("/api/strategy/points", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<StrategyPoint[]>) : []))
      .then((data) => {
        setStrategyPoints(data);
        setStrategyLoaded(true);
      });
  }, [activeTab, strategyLoaded, batteryKey]);

  const loadIntervals = useCallback(
    async (date: string) => {
      if (!date) return;
      setIntervalLoading(true);
      try {
        const res = await fetch(`/api/batteries/${batteryKey}/interval?date=${date}`, {
          cache: "no-store",
        });
        if (res.ok) setIntervalRows(await res.json());
      } finally {
        setIntervalLoading(false);
      }
    },
    [batteryKey]
  );

  useEffect(() => {
    if (selectedDate) loadIntervals(selectedDate);
  }, [selectedDate, loadIntervals]);

  if (!meta) {
    router.push("/");
    return null;
  }

  const selectedDayRow = dailyRows.find((r) => r.date === selectedDate);

  // Compute ranks among batteries that have data
  const activeSummaries = allSummaries.filter((s) => s.total_revenue !== 0);
  const rankedCount = activeSummaries.length;

  const revenueRank =
    rankedCount > 0
      ? [...activeSummaries]
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .findIndex((s) => s.battery_key === batteryKey) + 1
      : 0;

  const efficiencyRank =
    rankedCount > 0
      ? [...activeSummaries]
        .sort((a, b) => {
          const mwhA = KNOWN_BATTERIES[a.battery_key]?.mwh ?? 0;
          const mwhB = KNOWN_BATTERIES[b.battery_key]?.mwh ?? 0;
          return mwhB > 0 && mwhA > 0
            ? b.avg_daily_revenue / mwhB - a.avg_daily_revenue / mwhA
            : 0;
        })
        .findIndex((s) => s.battery_key === batteryKey) + 1
      : 0;

  const fmtRank = (rank: number) => (rank > 0 ? `#${rank}` : "—");
  const fmtRankSubtext = (rank: number, total: number) =>
    rank > 0 && total > 0 ? `${fmtRank(rank)} of ${total}` : "No ranking yet";

  const rankedByPower = Object.entries(KNOWN_BATTERIES)
    .filter(([, b]) => b.mw != null && b.mw > 0)
    .sort(([, a], [, b]) => (b.mw ?? 0) - (a.mw ?? 0));

  const rankedByEnergy = Object.entries(KNOWN_BATTERIES)
    .filter(([, b]) => b.mwh != null && b.mwh > 0)
    .sort(([, a], [, b]) => (b.mwh ?? 0) - (a.mwh ?? 0));

  const powerRank = rankedByPower.findIndex(([key]) => key === batteryKey) + 1;
  const energyRank = rankedByEnergy.findIndex(([key]) => key === batteryKey) + 1;

  const efficiencyPerMwh =
    meta.mwh != null && meta.mwh > 0 && stats != null
      ? stats.avg_daily_revenue / meta.mwh
      : null;

  const efficiencyValue =
    efficiencyPerMwh != null
      ? fmtStat(efficiencyPerMwh)
      : "—";

  const summaryLoading = stats == null;

  const statCards: { label: string; value: string; subtext: string }[] = [
    {
      label: "All-time revenue",
      value: fmtStat(stats?.total_revenue ?? 0),
      subtext: fmtRankSubtext(revenueRank, rankedCount),
    },
    {
      label: "Revenue efficiency",
      value: efficiencyValue,
      subtext: fmtRankSubtext(efficiencyRank, rankedCount),
    },
    {
      label: "Power capacity",
      value: meta.mw != null ? `${meta.mw} MW` : "—",
      subtext: fmtRankSubtext(powerRank, rankedByPower.length),
    },
    {
      label: "Energy capacity",
      value: meta.mwh != null ? `${meta.mwh} MWh` : "—",
      subtext: fmtRankSubtext(energyRank, rankedByEnergy.length),
    },
  ];

  const sortedDates = [...availableDates].sort((a, b) => a.localeCompare(b));
  const selectedDateIndex = sortedDates.findIndex((d) => d === selectedDate);

  const handleSelectDate = useCallback(
    (date: string) => {
      if (!date || date === selectedDate) return;
      const nextIndex = sortedDates.findIndex((d) => d === date);
      if (selectedDateIndex >= 0 && nextIndex >= 0) {
        setDateStripAnimClass(
          nextIndex > selectedDateIndex
            ? "animate-date-strip-left"
            : "animate-date-strip-right"
        );
      }
      setSelectedDate(date);

      // If selection comes from outside the interval date list (e.g. heatmap),
      // keep it visible in the strip so the highlighted day matches the chart.
      setAvailableDates((prev) => (prev.includes(date) ? prev : [...prev, date]));
    },
    [selectedDate, selectedDateIndex, sortedDates]
  );

  const maxVisibleDates = 5;
  const halfWindow = Math.floor(maxVisibleDates / 2);
  const windowSize = Math.min(maxVisibleDates, sortedDates.length);
  const maxStart = Math.max(0, sortedDates.length - windowSize);
  const centeredStart = selectedDateIndex >= 0 ? selectedDateIndex - halfWindow : 0;
  const windowStart = Math.min(Math.max(0, centeredStart), maxStart);
  const windowEnd = windowStart + windowSize;
  const visibleDates =
    selectedDateIndex >= 0
      ? sortedDates.slice(windowStart, windowEnd)
      : sortedDates.slice(0, maxVisibleDates);

  const thisStrategyPoints = strategyPoints.filter((p) => p.battery_key === batteryKey);
  const otherStrategyPoints = strategyPoints.filter((p) => p.battery_key !== batteryKey);

  // Compute dominant cluster (most days) for the cluster guide highlight
  const clusterCounts: Record<number, number> = {};
  for (const p of thisStrategyPoints) {
    clusterCounts[p.cluster_id] = (clusterCounts[p.cluster_id] ?? 0) + 1;
  }
  const dominantCluster =
    thisStrategyPoints.length > 0
      ? Number(Object.entries(clusterCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0)
      : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">{meta.name}</h1>
                <Badge variant="outline" className="text-xs">
                  {meta.region}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {meta.mw != null ? `${meta.mw} MW` : ""}
                {meta.mwh != null ? ` / ${meta.mwh} MWh` : ""}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Summary card */}
        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {statCards.map(({ label, value, subtext }) => (
                <div
                  key={label}
                  className="border-b border-border/60 p-4 odd:border-r sm:border-r sm:[&:nth-child(4n)]:border-r-0 sm:[&:nth-last-child(-n+4)]:border-b-0 [&:nth-last-child(-n+2)]:border-b-0"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p
                    className={`mt-1 text-lg font-mono font-semibold tabular-nums ${summaryLoading ? "opacity-40" : ""}`}
                  >
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="monthly">Overview</TabsTrigger>
            <TabsTrigger value="intervals">Intervals</TabsTrigger>
            <TabsTrigger value="strategy">Strategy</TabsTrigger>
            <TabsTrigger value="potential">Potential</TabsTrigger>
          </TabsList>

          {/* Overview tab — monthly chart + calendar heatmap */}
          <TabsContent value="monthly" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Revenue by Month — Energy vs FCAS
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!monthlyLoaded ? (
                  <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
                    Loading…
                  </div>
                ) : (
                  <MonthlyRevenueChart rows={monthlyRows} height={180} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Daily Revenue Calendar
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyLoading ? (
                  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                    Loading…
                  </div>
                ) : (
                  <RevenueHeatmap
                    rows={dailyRows}
                    onDayClick={(date) => {
                      handleSelectDate(date);
                      setActiveTab("intervals");
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Strategy tab — 2D UMAP scatter + cluster guide + method note */}
          <TabsContent value="strategy" className="space-y-6">
            <StrategyMethodNote />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Strategy Map — where does this battery sit in strategy space?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!strategyLoaded ? (
                  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                    Loading…
                  </div>
                ) : (
                  <>
                    <StrategyScatter2D
                      thisPoints={thisStrategyPoints}
                      otherPoints={otherStrategyPoints}
                    />
                    {thisStrategyPoints.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t">
                        <p className="text-xs font-medium">Days by strategy cluster</p>
                        {Object.entries(clusterCounts)
                          .map(([cid, n]) => ({ cid: Number(cid), n }))
                          .sort((a, b) => b.n - a.n)
                          .map(({ cid, n }) => {
                            const pct = Math.round((n / thisStrategyPoints.length) * 100);
                            const color = CLUSTER_COLORS[cid] ?? "#71717a";
                            const name = CLUSTER_NAMES[cid] ?? `Cluster ${cid}`;
                            return (
                              <div key={cid} className="flex items-center gap-2">
                                <div className="w-40 text-xs text-muted-foreground truncate">{name}</div>
                                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${pct}%`, backgroundColor: color }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground tabular-nums w-24 text-right">
                                  {n} days ({pct}%)
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            {strategyLoaded && thisStrategyPoints.length > 0 && (
              <StrategyClusterGuide dominantCluster={dominantCluster} />
            )}
          </TabsContent>

          {/* Potential tab — oracle comparison */}
          <TabsContent value="potential" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-medium">Earning Potential</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Oracle = perfect-hindsight energy arbitrage · one charge-discharge cycle per day
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(["30", "90", "365", "all"] as const).map((r) => (
                      <Button
                        key={r}
                        variant={oracleRange === r ? "secondary" : "ghost"}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => { setOracleRange(r); setOracleLoaded(false); }}
                      >
                        {r === "30" ? "30d" : r === "90" ? "90d" : r === "365" ? "1yr" : "All"}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!oracleLoaded ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                    Loading…
                  </div>
                ) : (
                  <OracleChart rows={oracleRows} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Intervals tab */}
          <TabsContent value="intervals" className="space-y-4">
            {/* Date navigator */}
            <div className="rounded-lg border bg-card p-2 min-h-[4.5rem] flex items-center">
              {availableDates.length > 0 ? (
                <div className="w-full overflow-x-auto pb-1">
                  <div
                    key={selectedDate || "initial-date-strip"}
                    className={`flex min-w-full items-center justify-center gap-1.5 ${dateStripAnimClass}`}
                  >
                    {visibleDates.map((date) =>
                      date === selectedDate ? (
                        <Button
                          key={date}
                          variant="default"
                          size="sm"
                          className="h-auto px-2 py-1 text-xs font-semibold"
                          aria-current="date"
                        >
                          <span className="flex flex-col items-center text-center leading-tight">
                            <span>{date}</span>
                            <span className="text-[10px] font-medium opacity-90">{fmtWeekday(date)}</span>
                          </span>
                        </Button>
                      ) : (
                        <Button
                          key={date}
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleSelectDate(date)}
                        >
                          <span className="flex flex-col items-center text-center leading-tight">
                            <span>{date}</span>
                            <span className="text-[10px] opacity-80">{fmtWeekday(date)}</span>
                          </span>
                        </Button>
                      )
                    )}

                    {selectedDate && !visibleDates.includes(selectedDate) && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-auto px-2 py-1 text-xs font-semibold"
                        aria-current="date"
                        onClick={() => handleSelectDate(selectedDate)}
                      >
                        <span className="flex flex-col items-center text-center leading-tight">
                          <span>{selectedDate}</span>
                          <span className="text-[10px] opacity-80">{fmtWeekday(selectedDate)}</span>
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <span className="px-1 text-xs text-muted-foreground">No dates available</span>
              )}
            </div>

            {/* Daily revenue breakdown for the selected date */}
            {/* Sub-tabs: Revenue vs Power */}
            <Tabs defaultValue="revenue">
              <TabsList className="mb-4">
                <TabsTrigger value="revenue">Revenue &amp; Price</TabsTrigger>
                <TabsTrigger value="power">Power &amp; Throughput</TabsTrigger>
              </TabsList>

              <TabsContent value="revenue">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Interval Revenue, Cumulative Revenue &amp; RRP — 5-min intervals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {intervalLoading ? (
                      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                        Loading…
                      </div>
                    ) : (
                      <IntervalChart rows={intervalRows} />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="power">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Charge / Discharge &amp; Daily Throughput
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {intervalLoading ? (
                      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                        Loading…
                      </div>
                    ) : (
                      <IntervalPowerChart rows={intervalRows} />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Revenue breakdown derived directly from interval rows */}
            {selectedDate && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Revenue Breakdown — {fmtDate(selectedDate)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {intervalLoading ? (
                    <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
                      Loading…
                    </div>
                  ) : (
                    <FcasBreakdown rows={intervalRows} />
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
