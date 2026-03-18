"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { DailyRevenueChart } from "@/components/daily-revenue-chart";
import { IntervalChart } from "@/components/interval-chart";
import { KNOWN_BATTERIES, type BatteryDailyRow, type BatteryIntervalRow } from "@/lib/types";

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "+";
  return `${sign}$${abs.toLocaleString("en-AU", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function fmtDate(s: string): string {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

interface DailyTableProps {
  rows: BatteryDailyRow[];
}

function DailyTable({ rows }: DailyTableProps) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="pb-2 text-left font-medium">Date</th>
            <th className="pb-2 text-right font-medium">Net energy</th>
            <th className="pb-2 text-right font-medium">FCAS</th>
            <th className="pb-2 text-right font-medium">Total net</th>
            <th className="pb-2 text-right font-medium hidden sm:table-cell">Intervals</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-1.5">{fmtDate(r.date)}</td>
              <td className={`py-1.5 text-right font-mono ${r.net_energy >= 0 ? "text-green-500" : "text-red-500"}`}>
                {fmtDollar(r.net_energy)}
              </td>
              <td className={`py-1.5 text-right font-mono ${r.total_fcas_revenue >= 0 ? "text-green-500" : "text-red-500"}`}>
                {fmtDollar(r.total_fcas_revenue)}
              </td>
              <td className={`py-1.5 text-right font-mono font-semibold ${r.net >= 0 ? "text-green-500" : "text-red-500"}`}>
                {fmtDollar(r.net)}
              </td>
              <td className="py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                {r.interval_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BatteryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batteryKey = typeof params.key === "string" ? params.key : "";
  const meta = KNOWN_BATTERIES[batteryKey];

  const [dailyRows, setDailyRows] = useState<BatteryDailyRow[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);

  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [intervalRows, setIntervalRows] = useState<BatteryIntervalRow[]>([]);
  const [intervalLoading, setIntervalLoading] = useState(false);

  const loadDaily = useCallback(async () => {
    if (!batteryKey) return;
    setDailyLoading(true);
    try {
      const res = await fetch(`/api/batteries/${batteryKey}/daily`, { cache: "no-store" });
      if (res.ok) setDailyRows(await res.json());
    } finally {
      setDailyLoading(false);
    }
  }, [batteryKey]);

  const loadDates = useCallback(async () => {
    if (!batteryKey) return;
    const res = await fetch(`/api/batteries/${batteryKey}/interval`, { cache: "no-store" });
    if (res.ok) {
      const dates: string[] = await res.json();
      setAvailableDates(dates);
      if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0]);
    }
  }, [batteryKey, selectedDate]);

  useEffect(() => {
    loadDaily();
    loadDates();
  }, [loadDaily, loadDates]);

  const loadIntervals = useCallback(async (date: string) => {
    if (!date) return;
    setIntervalLoading(true);
    try {
      const res = await fetch(
        `/api/batteries/${batteryKey}/interval?date=${date}`,
        { cache: "no-store" }
      );
      if (res.ok) setIntervalRows(await res.json());
    } finally {
      setIntervalLoading(false);
    }
  }, [batteryKey]);

  useEffect(() => {
    if (selectedDate) loadIntervals(selectedDate);
  }, [selectedDate, loadIntervals]);

  if (!meta) {
    router.push("/");
    return null;
  }

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
                <Badge variant="outline" className="text-xs">{meta.region}</Badge>
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
        <Tabs defaultValue="daily">
          <TabsList className="mb-6">
            <TabsTrigger value="daily">Daily Revenue</TabsTrigger>
            <TabsTrigger value="intervals">By Interval</TabsTrigger>
          </TabsList>

          {/* Daily tab */}
          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">30-Day Net Revenue</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadDaily}
                    disabled={dailyLoading}
                    className="h-7 gap-1 text-xs"
                  >
                    <RefreshCw className={`h-3 w-3 ${dailyLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DailyRevenueChart rows={dailyRows} />
              </CardContent>
            </Card>

            {dailyRows.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Daily Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <DailyTable rows={dailyRows} />
                </CardContent>
              </Card>
            )}

            {dailyRows.length === 0 && !dailyLoading && (
              <div className="text-center text-sm text-muted-foreground py-8">
                No daily data yet — run{" "}
                <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                  nem-battery ingest-daily
                </code>
              </div>
            )}
          </TabsContent>

          {/* Intervals tab */}
          <TabsContent value="intervals" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-sm font-medium">
                    5-min Intervals — Net Revenue &amp; RRP
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {availableDates.length > 0 ? (
                      <Select value={selectedDate} onValueChange={(v) => v && setSelectedDate(v)}>
                        <SelectTrigger className="h-8 w-[148px] text-xs">
                          <SelectValue placeholder="Select date" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDates.map((d) => (
                            <SelectItem key={d} value={d} className="text-xs">
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">No dates available</span>
                    )}
                    {selectedDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadIntervals(selectedDate)}
                        disabled={intervalLoading}
                        className="h-7 gap-1 text-xs"
                      >
                        <RefreshCw className={`h-3 w-3 ${intervalLoading ? "animate-spin" : ""}`} />
                      </Button>
                    )}
                  </div>
                </div>
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

            {intervalRows.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Interval Summary</CardTitle>
                </CardHeader>
                <CardContent className="text-xs grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {(() => {
                    const totalNet = intervalRows.reduce((s, r) => s + r.net, 0);
                    const totalFcas = intervalRows.reduce((s, r) => s + r.total_fcas, 0);
                    const peakDis = Math.max(...intervalRows.map((r) => r.discharge_mw));
                    const peakChg = Math.max(...intervalRows.map((r) => r.charge_mw));
                    return (
                      <>
                        <div>
                          <p className="text-muted-foreground">Total net</p>
                          <p className={`font-mono font-semibold ${totalNet >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {fmtDollar(totalNet)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">FCAS total</p>
                          <p className="font-mono">{fmtDollar(totalFcas)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Peak discharge</p>
                          <p className="font-mono">{peakDis.toFixed(1)} MW</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Peak charge</p>
                          <p className="font-mono">{peakChg.toFixed(1)} MW</p>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
