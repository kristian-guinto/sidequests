"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BatteryCard } from "@/components/battery-card";
import { KNOWN_BATTERIES, type BatteryIntervalRow } from "@/lib/types";

function fmtUpdated(d: Date): string {
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function BatteryGrid() {
  const [rows, setRows] = useState<BatteryIntervalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/batteries/latest", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BatteryIntervalRow[] = await res.json();
      setRows(data);
      setUpdatedAt(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byKey = Object.fromEntries(rows.map((r) => [r.battery_key, r]));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">NEM Battery Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Latest 5-minute dispatch interval · Australian Energy Market Operator
            </p>
          </div>
          <div className="flex items-center gap-2">
            {updatedAt && (
              <span className="hidden sm:block text-xs text-muted-foreground">
                Updated {fmtUpdated(updatedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(KNOWN_BATTERIES).map(([key, meta]) => (
            <BatteryCard key={key} batteryKey={key} meta={meta} row={byKey[key]} />
          ))}
        </div>

        {rows.length === 0 && !loading && !error && (
          <div className="mt-8 text-center text-muted-foreground text-sm">
            <p>No data in the database yet.</p>
            <p className="mt-1">
              Run <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                nem-battery ingest-interval
              </code>{" "}
              to populate it.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
