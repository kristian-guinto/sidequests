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
import type { BatteryMonthlyRow } from "@/lib/types";

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1).toLocaleDateString("en-AU", {
    month: "short",
    year: "2-digit",
  });
}

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${abs.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

type MonthlyDatum = BatteryMonthlyRow & { monthLabel: string };

function MonthlyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: MonthlyDatum }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-xs shadow-md space-y-1">
      <p className="font-medium">{d.monthLabel}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span>Energy</span>
        <span className={`text-right font-mono ${d.net_energy >= 0 ? "text-green-500" : "text-red-500"}`}>
          {fmtDollar(d.net_energy)}
        </span>
        <span>FCAS</span>
        <span className="text-right font-mono text-indigo-400">{fmtDollar(d.total_fcas_revenue)}</span>
        <span className="font-semibold">Total net</span>
        <span className={`text-right font-mono font-semibold ${d.net >= 0 ? "text-green-500" : "text-red-500"}`}>
          {fmtDollar(d.net)}
        </span>
      </div>
    </div>
  );
}

interface Props {
  rows: BatteryMonthlyRow[];
  height?: number;
}

export function MonthlyRevenueChart({ rows, height = 260 }: Props) {
  const data: MonthlyDatum[] = [...rows].reverse().map((r) => ({
    ...r,
    monthLabel: fmtMonth(r.month),
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No monthly data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="monthLabel"
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
        <Tooltip content={<MonthlyTooltip />} />
        <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs">{value === "net_energy" ? "Energy" : "FCAS"}</span>
          )}
        />
        <Bar
          stackId="monthly"
          dataKey="net_energy"
          fill="rgb(34 197 94)"
          fillOpacity={0.85}
          maxBarSize={36}
          name="net_energy"
        />
        <Bar
          stackId="monthly"
          dataKey="total_fcas_revenue"
          fill="rgb(99 102 241)"
          fillOpacity={0.85}
          radius={[2, 2, 0, 0]}
          maxBarSize={36}
          name="total_fcas_revenue"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
