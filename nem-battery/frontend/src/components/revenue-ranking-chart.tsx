"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { KNOWN_BATTERIES, type BatterySummaryRow } from "@/lib/types";

type Metric = "total" | "permwh";

interface ChartDatum {
  key: string;
  name: string;
  value: number;
}

function buildData(summaries: BatterySummaryRow[], metric: Metric): ChartDatum[] {
  return summaries
    .map((s) => {
      const mwh = KNOWN_BATTERIES[s.battery_key]?.mwh ?? null;
      const name = KNOWN_BATTERIES[s.battery_key]?.name ?? s.battery_key;
      const value =
        metric === "permwh" && mwh != null && mwh > 0
          ? s.avg_daily_revenue / mwh
          : s.total_revenue;
      return { key: s.battery_key, name, value };
    })
    .filter((d) => d.value !== 0)
    .sort((a, b) => b.value - a.value);
}

function fmtAxis(v: number, metric: Metric): string {
  const abs = Math.abs(v);
  if (metric === "permwh") {
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}k`;
    return `$${abs.toFixed(0)}`;
  }
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}k`;
  return `$${abs.toFixed(0)}`;
}

function RankingTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: { payload?: ChartDatum }[];
  metric: Metric;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const label = metric === "permwh" ? "Avg daily revenue / MWh" : "Total revenue";
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium mb-1">{d.name}</p>
      <p className="text-muted-foreground">
        {label}:{" "}
        <span className="font-mono text-foreground">{fmtAxis(d.value, metric)}</span>
      </p>
    </div>
  );
}

interface Props {
  summaries: BatterySummaryRow[];
  /** Battery key to highlight (used on detail page) */
  highlightKey?: string;
  /** Compact mode — less padding, smaller labels */
  compact?: boolean;
  /** Controlled metric — if provided the chart uses this instead of internal state */
  metric?: Metric;
  /** Called when the user toggles the metric toggle */
  onMetricChange?: (m: Metric) => void;
}

export function RevenueRankingChart({ summaries, highlightKey, compact = false, metric: metricProp, onMetricChange }: Props) {
  const [internalMetric, setInternalMetric] = useState<Metric>("total");
  const metric = metricProp ?? internalMetric;
  const setMetric = onMetricChange ?? setInternalMetric;

  const data = buildData(summaries, metric);
  const barHeight = compact ? 18 : 22;
  const chartHeight = Math.max(data.length * (barHeight + 4) + 16, 60);

  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        No revenue data yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {metricProp === undefined && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {metric === "total" ? "Total all-time revenue" : "Avg daily revenue per MWh (active days only)"}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant={metric === "total" ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setMetric("total")}
            >
              Revenue
            </Button>
            <Button
              variant={metric === "permwh" ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setMetric("permwh")}
            >
              Revenue efficiency
            </Button>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
          barSize={barHeight - 4}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmtAxis(v, metric)}
            width={48}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: compact ? 10 : 11 }}
            tickLine={false}
            axisLine={false}
            width={compact ? 100 : 140}
          />
          <Tooltip content={<RankingTooltip metric={metric} />} cursor={{ fill: "currentColor", fillOpacity: 0.05 }} />
          <Bar dataKey="value" radius={[0, 2, 2, 0]} isAnimationActive animationDuration={350} animationEasing="ease-out">
            {data.map((entry) => {
              const isHighlighted = highlightKey === entry.key;
              return (
                <Cell
                  key={entry.key}
                  fill={isHighlighted ? "rgb(99 102 241)" : "rgb(34 197 94)"}
                  fillOpacity={isHighlighted ? 0.9 : 0.7}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
