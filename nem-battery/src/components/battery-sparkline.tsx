"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface SparklineDatum {
  month: string;
  net_energy: number;
  fcas: number;
}

function fmtRevenue(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function SparkTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: SparklineDatum }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const net = d.net_energy + d.fcas;
  const fcasPct = net > 0 ? Math.round((d.fcas / net) * 100) : 0;
  return (
    <div className="rounded border bg-popover px-2 py-1.5 text-xs shadow-sm space-y-0.5">
      <p className="font-medium text-foreground">{d.month}</p>
      <p className="text-muted-foreground">
        Total: <span className={`font-mono ${net >= 0 ? "text-foreground" : "text-red-500"}`}>{fmtRevenue(net)}</span>
      </p>
      <p className="text-muted-foreground">
        Energy: <span className="font-mono text-green-500">{fmtRevenue(d.net_energy)}</span>
      </p>
      <p className="text-muted-foreground">
        FCAS: <span className="font-mono text-indigo-400">{fmtRevenue(d.fcas)}</span>
        {net > 0 && <span className="ml-1 text-muted-foreground">({fcasPct}%)</span>}
      </p>
    </div>
  );
}

interface Props {
  data: SparklineDatum[];
}

export function BatterySparkline({ data }: Props) {
  if (data.length === 0) {
    return <div className="h-10 w-full rounded bg-muted/20" />;
  }

  return (
    <ResponsiveContainer width="100%" height={40}>
      <BarChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }} stackOffset="sign">
        <Tooltip
          content={<SparkTooltip />}
          cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
          wrapperStyle={{ zIndex: 50 }}
        />
        <Bar dataKey="net_energy" stackId="a" isAnimationActive={false} maxBarSize={16}>
          {data.map((entry, i) => (
            <Cell
              key={`e-${i}`}
              fill={entry.net_energy >= 0 ? "rgb(34 197 94)" : "rgb(239 68 68)"}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
        <Bar dataKey="fcas" stackId="a" isAnimationActive={false} maxBarSize={16} radius={[1, 1, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={`f-${i}`} fill="rgb(99 102 241)" fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
