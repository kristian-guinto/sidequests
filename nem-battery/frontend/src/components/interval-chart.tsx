"use client";

import {
  Area,
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BatteryIntervalRow } from "@/lib/types";

function toTime(isoStr: string): string {
  // NEM timestamps arrive as "YYYY-MM-DD HH:MM:SS" (AEST naive).
  // Split directly to avoid UTC timezone shifts.
  const sep = isoStr.includes(" ") ? " " : "T";
  return isoStr.split(sep)[1]?.slice(0, 5) ?? isoStr;
}

function fmtDollar(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${abs.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// IntervalChart — Interval revenue bars + cumulative revenue + RRP line
// ---------------------------------------------------------------------------

type RevenueRow = BatteryIntervalRow & { time: string };
type RevenueChartRow = RevenueRow & {
  cumulative_revenue: number;
  cumulative_revenue_pos: number;
  cumulative_revenue_neg: number;
};

function RevenueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: RevenueChartRow }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-xs shadow-md space-y-1">
      <p className="font-medium">{d.time}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span>Net</span>
        <span className={`text-right font-mono ${d.net >= 0 ? "text-green-500" : "text-red-500"}`}>
          {fmtDollar(d.net)}
        </span>
        <span>Cumulative</span>
        <span className={`text-right font-mono ${d.cumulative_revenue >= 0 ? "text-green-500" : "text-red-500"}`}>
          {fmtDollar(d.cumulative_revenue)}
        </span>
        <span>RRP</span>
        <span className="text-right font-mono">${d.rrp.toFixed(2)}/MWh</span>
        {d.total_fcas !== 0 && (
          <>
            <span>FCAS</span>
            <span className="text-right font-mono">{fmtDollar(d.total_fcas)}</span>
          </>
        )}
      </div>
    </div>
  );
}

interface Props {
  rows: BatteryIntervalRow[];
}

export function IntervalChart({ rows }: Props) {
  const data: RevenueChartRow[] = rows.reduce<RevenueChartRow[]>((acc, r) => {
    const previous = acc[acc.length - 1];
    const cumulative = (previous?.cumulative_revenue ?? 0) + r.net;
    acc.push({
      ...r,
      time: toTime(r.settlement_date),
      cumulative_revenue: cumulative,
      cumulative_revenue_pos: Math.max(cumulative, 0),
      cumulative_revenue_neg: Math.min(cumulative, 0),
    });
    return acc;
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No interval data for this date
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 60, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(data.length / 8)}
        />
        <YAxis
          yAxisId="cum"
          orientation="left"
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <YAxis
          yAxisId="rrp"
          orientation="right"
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <YAxis yAxisId="net" hide />
        <Tooltip content={<RevenueTooltip />} />
        <ReferenceLine yAxisId="net" y={0} stroke="currentColor" strokeOpacity={0.2} />
        <ReferenceLine yAxisId="cum" y={0} stroke="currentColor" strokeOpacity={0.2} />
        <Bar yAxisId="net" dataKey="net" radius={[1, 1, 0, 0]} maxBarSize={6}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.net >= 0 ? "rgb(34 197 94)" : "rgb(239 68 68)"}
              fillOpacity={0.45}
            />
          ))}
        </Bar>
        <Area
          yAxisId="cum"
          dataKey="cumulative_revenue_pos"
          type="monotone"
          fill="rgb(34 197 94)"
          fillOpacity={0.12}
          stroke="none"
          isAnimationActive={false}
        />
        <Area
          yAxisId="cum"
          dataKey="cumulative_revenue_neg"
          type="monotone"
          fill="rgb(239 68 68)"
          fillOpacity={0.12}
          stroke="none"
          isAnimationActive={false}
        />
        <Line
          yAxisId="cum"
          dataKey="cumulative_revenue"
          type="monotone"
          stroke="hsl(var(--foreground))"
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="rrp"
          dataKey="rrp"
          type="monotone"
          stroke="rgb(99 102 241)"
          strokeWidth={1.25}
          strokeOpacity={0.85}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// IntervalPowerChart — Discharge / Charge MW bars + cumulative MWh area
// ---------------------------------------------------------------------------

type PowerRow = BatteryIntervalRow & {
  time: string;
  charge_mw_neg: number;
  cumulative_mwh: number;
};

function PowerTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: PowerRow }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-xs shadow-md space-y-1">
      <p className="font-medium">{d.time}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-green-500">Discharge</span>
        <span className="text-right font-mono">{d.discharge_mw.toFixed(1)} MW</span>
        <span className="text-orange-400">Charge</span>
        <span className="text-right font-mono">{d.charge_mw.toFixed(1)} MW</span>
        <span className="text-indigo-400">Throughput</span>
        <span className="text-right font-mono">{d.cumulative_mwh.toFixed(1)} MWh</span>
      </div>
    </div>
  );
}

export function IntervalPowerChart({ rows }: Props) {
  const data: PowerRow[] = rows.reduce<PowerRow[]>((acc, r) => {
    const previous = acc[acc.length - 1];
    const cumulativeMwh = (previous?.cumulative_mwh ?? 0) + (r.charge_mw - r.discharge_mw) * (5 / 60);
    acc.push({
      ...r,
      time: toTime(r.settlement_date),
      charge_mw_neg: -r.charge_mw,
      cumulative_mwh: cumulativeMwh,
    });
    return acc;
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No interval data for this date
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 60, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(data.length / 8)}
        />
        {/* Left axis: MW (discharge positive, charge negative) */}
        <YAxis
          yAxisId="mw"
          orientation="left"
          tickFormatter={(v: number) => `${v.toFixed(0)} MW`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        {/* Right axis: cumulative MWh */}
        <YAxis
          yAxisId="mwh"
          orientation="right"
          tickFormatter={(v: number) => `${v.toFixed(0)} MWh`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={68}
        />
        <Tooltip content={<PowerTooltip />} />
        <ReferenceLine yAxisId="mw" y={0} stroke="currentColor" strokeOpacity={0.2} />
        {/* Discharge: positive green bars */}
        <Bar yAxisId="mw" dataKey="discharge_mw" fill="rgb(34 197 94)" fillOpacity={0.75} radius={[1, 1, 0, 0]} maxBarSize={8} />
        {/* Charge: negative orange bars */}
        <Bar yAxisId="mw" dataKey="charge_mw_neg" fill="rgb(251 146 60)" fillOpacity={0.75} radius={[0, 0, 1, 1]} maxBarSize={8} />
        {/* Cumulative throughput area */}
        <Area
          yAxisId="mwh"
          dataKey="cumulative_mwh"
          type="monotone"
          fill="rgb(99 102 241)"
          fillOpacity={0.1}
          stroke="rgb(99 102 241)"
          strokeWidth={1.5}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

