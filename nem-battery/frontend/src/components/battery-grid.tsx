"use client";

import { useEffect, useMemo, useState } from "react";
import { Orbit } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { BatteryCard } from "@/components/battery-card";
import { RevenueRankingChart } from "@/components/revenue-ranking-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KNOWN_BATTERIES, type BatterySummaryRow } from "@/lib/types";

type Metric = "total" | "permwh";

export function BatteryGrid() {
  const [summaries, setSummaries] = useState<BatterySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("total");

  useEffect(() => {
    fetch("/api/batteries/summary", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<BatterySummaryRow[]>;
      })
      .then(setSummaries)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load data")
      )
      .finally(() => setLoading(false));
  }, []);

  const byKey = Object.fromEntries(summaries.map((s) => [s.battery_key, s]));

  const sortedEntries = useMemo(() => {
    const entries = Object.entries(KNOWN_BATTERIES);
    return entries.sort(([keyA], [keyB]) => {
      const sA = byKey[keyA];
      const sB = byKey[keyB];
      const valA = sA
        ? metric === "permwh" && (KNOWN_BATTERIES[keyA]?.mwh ?? 0) > 0
          ? sA.avg_daily_revenue / (KNOWN_BATTERIES[keyA]!.mwh as number)
          : sA.total_revenue
        : 0;
      const valB = sB
        ? metric === "permwh" && (KNOWN_BATTERIES[keyB]?.mwh ?? 0) > 0
          ? sB.avg_daily_revenue / (KNOWN_BATTERIES[keyB]!.mwh as number)
          : sB.total_revenue
        : 0;
      return valB - valA;
    });
  }, [byKey, metric]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">NEM Battery Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Australian battery storage revenue · AEMO NEM
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/strategy"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <Orbit className="h-3.5 w-3.5" />
              Strategy Map
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && summaries.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-medium">Revenue Ranking</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {metric === "total" ? "Total all-time revenue" : "Avg daily revenue per MWh (active days only)"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant={metric === "total" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setMetric("total")}
                  >
                    Revenue
                  </Button>
                  <Button
                    variant={metric === "permwh" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setMetric("permwh")}
                  >
                    Revenue efficiency
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <RevenueRankingChart summaries={summaries} metric={metric} onMetricChange={setMetric} />
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.keys(KNOWN_BATTERIES).map((key) => (
              <div key={key} className="h-40 rounded-lg border bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedEntries.map(([key, meta]) => (
              <BatteryCard key={key} batteryKey={key} meta={meta} summary={byKey[key]} />
            ))}
          </div>
        )}

        {!loading && summaries.length === 0 && !error && (
          <div className="mt-8 text-center text-muted-foreground text-sm">
            <p>No data in the database yet.</p>
            <p className="mt-1">
              Run{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                nem-battery ingest-daily
              </code>{" "}
              to populate it.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
