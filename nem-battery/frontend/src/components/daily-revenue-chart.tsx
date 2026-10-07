"use client";

import {
  Bar,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BatteryDailyRow } from "@/lib/types";

function fmtDate(dateStr: string): string {
  // dateStr: "2026-03-18" or similar
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${abs.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

interface TooltipPayload {
  payload?: BatteryDailyRow & { dateLabel: string };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-xs shadow-md space-y-1">
      <p className="font-medium">{d.dateLabel}</p>
      <p className="text-muted-foreground">Intervals: {d.interval_count}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span>Net energy</span><span className="text-right font-mono">{fmtDollar(d.net_energy)}</span>
        <span>FCAS</span><span className="text-right font-mono">{fmtDollar(d.total_fcas_revenue)}</span>
        <span className="font-semibold">Total net</span>
        <span className={`text-right font-mono font-semibold ${d.net >= 0 ? "text-green-500" : "text-red-500"}`}>
          {fmtDollar(d.net)}
        </span>
      </div>
    </div>
  );
}

interface Props {
  rows: BatteryDailyRow[];
}

export function DailyRevenueChart({ rows }: Props) {
  const data = [...rows].reverse().map((r) => ({
    ...r,
    dateLabel: fmtDate(r.date),
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No daily data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs">{value === "net_energy" ? "Energy" : "FCAS"}</span>
          )}
        />
        <Bar
          stackId="daily"
          dataKey="net_energy"
          fill="rgb(34 197 94)"
          fillOpacity={0.85}
          maxBarSize={32}
          name="net_energy"
        />
        <Bar
          stackId="daily"
          dataKey="total_fcas_revenue"
          fill="rgb(99 102 241)"
          fillOpacity={0.85}
          radius={[2, 2, 0, 0]}
          maxBarSize={32}
          name="total_fcas_revenue"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
