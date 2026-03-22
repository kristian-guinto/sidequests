"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BatteryOracleRow } from "@/lib/types";

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

type OracleDatum = BatteryOracleRow & { dateLabel: string };

function OracleTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: OracleDatum }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md space-y-1">
      <p className="font-medium">{d.dateLabel}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-muted-foreground">Actual</span>
        <span className={`text-right font-mono ${d.actual >= 0 ? "text-green-500" : "text-red-500"}`}>
          {fmtDollar(d.actual)}
        </span>
        <span className="text-muted-foreground">Oracle ceiling</span>
        <span className="text-right font-mono text-zinc-400">{fmtDollar(d.oracle)}</span>
        {d.efficiency_pct != null && (
          <>
            <span className="text-muted-foreground">Efficiency</span>
            <span className="text-right font-mono">{d.efficiency_pct.toFixed(0)}%</span>
          </>
        )}
      </div>
    </div>
  );
}

interface Props {
  rows: BatteryOracleRow[];
}

export function OracleChart({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No price data available to compute oracle revenue
      </div>
    );
  }

  // Reverse to chronological for display
  const data: OracleDatum[] = [...rows].reverse().map((r) => ({
    ...r,
    dateLabel: new Date(r.date + "T00:00:00").toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
    }),
  }));

  // Summary stats
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalOracle = rows.reduce((s, r) => s + r.oracle, 0);
  const overallEfficiency = totalOracle > 0 ? (totalActual / totalOracle) * 100 : null;
  const effPcts = rows.filter((r) => r.efficiency_pct != null).map((r) => r.efficiency_pct!);
  const avgEfficiency = effPcts.length > 0 ? effPcts.reduce((a, b) => a + b, 0) / effPcts.length : null;
  const bestEfficiency = effPcts.length > 0 ? Math.max(...effPcts) : null;

  const summaryStats = [
    { label: "Overall efficiency", value: overallEfficiency != null ? `${overallEfficiency.toFixed(0)}%` : "—" },
    { label: "Avg daily efficiency", value: avgEfficiency != null ? `${avgEfficiency.toFixed(0)}%` : "—" },
    { label: "Best day", value: bestEfficiency != null ? `${bestEfficiency.toFixed(0)}%` : "—" },
    { label: "Actual total", value: fmtDollar(totalActual) },
    { label: "Oracle total", value: fmtDollar(totalOracle) },
  ];

  return (
    <div className="space-y-4">
      {/* Summary stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {summaryStats.map(({ label, value }) => (
          <div key={label} className="rounded-md border bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-mono font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground px-1">
          Green bars = actual revenue · Dashed line = oracle ceiling (perfect-hindsight energy arbitrage)
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.06} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<OracleTooltip />} />
            <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} />
            <Bar dataKey="actual" maxBarSize={8} isAnimationActive={false}>
              {data.map((entry, i) => (
                <Cell
                  key={`oracle-cell-${i}`}
                  fill={entry.actual >= 0 ? "rgb(34 197 94)" : "rgb(239 68 68)"}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
            <Line
              dataKey="oracle"
              type="linear"
              stroke="rgb(161 161 170)"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
