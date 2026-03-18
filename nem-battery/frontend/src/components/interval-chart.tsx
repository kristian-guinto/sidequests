"use client";

import {
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

type ChartRow = BatteryIntervalRow & { time: string };

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: ChartRow }[];
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
        <span>RRP</span>
        <span className="text-right font-mono">${d.rrp.toFixed(2)}/MWh</span>
        <span>Discharge</span>
        <span className="text-right font-mono">{d.discharge_mw.toFixed(1)} MW</span>
        <span>Charge</span>
        <span className="text-right font-mono">{d.charge_mw.toFixed(1)} MW</span>
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
  const data: ChartRow[] = rows.map((r) => ({ ...r, time: toTime(r.settlement_date) }));

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
        {/* Left axis: net revenue */}
        <YAxis
          yAxisId="net"
          orientation="left"
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        {/* Right axis: RRP */}
        <YAxis
          yAxisId="rrp"
          orientation="right"
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine yAxisId="net" y={0} stroke="currentColor" strokeOpacity={0.2} />
        <Bar yAxisId="net" dataKey="net" radius={[1, 1, 0, 0]} maxBarSize={8}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.net >= 0 ? "rgb(34 197 94)" : "rgb(239 68 68)"}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
        <Line
          yAxisId="rrp"
          dataKey="rrp"
          type="monotone"
          stroke="rgb(99 102 241)"
          strokeWidth={1.5}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
