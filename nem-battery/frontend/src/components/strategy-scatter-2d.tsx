"use client";

import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "next-themes";
import type { StrategyPoint } from "@/lib/strategy-types";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "@/lib/strategy-types";

function clusterColor(clusterId: number): string {
  if (clusterId < 0) return "rgb(113 113 122)"; // zinc-500 for noise
  return CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
}

function clusterLabel(clusterId: number): string {
  if (clusterId < 0) return "Unclustered";
  return CLUSTER_NAMES[clusterId % CLUSTER_NAMES.length] ?? `Cluster ${clusterId}`;
}

function fmtRevenue(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: StrategyPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md space-y-1">
      <p className="font-medium">{d.date}</p>
      <p className="text-muted-foreground">
        Revenue:{" "}
        <span className={`font-mono ${d.daily_revenue >= 0 ? "text-green-500" : "text-red-500"}`}>
          {fmtRevenue(d.daily_revenue)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Strategy:{" "}
        <span style={{ color: clusterColor(d.cluster_id) }}>
          {clusterLabel(d.cluster_id)}
        </span>
      </p>
    </div>
  );
}

interface Props {
  thisPoints: StrategyPoint[];
  otherPoints: StrategyPoint[];
}

export function StrategyScatter2D({ thisPoints, otherPoints }: Props) {
  const { resolvedTheme } = useTheme();
  const edgeStroke = resolvedTheme === "dark" ? "#ffffff" : "#1a1a1a";
  if (thisPoints.length === 0 && otherPoints.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No strategy embeddings available — run{" "}
        <code className="mx-1 font-mono bg-muted px-1 py-0.5 rounded">
          python -m nem_battery.strategy_map
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
          <XAxis
            type="number"
            dataKey="x"
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={() => ""}
            label={{ value: "UMAP 1", position: "insideBottom", fontSize: 9, fill: "currentColor", fillOpacity: 0.4, offset: 0 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={() => ""}
            label={{ value: "UMAP 2", angle: -90, position: "insideLeft", fontSize: 9, fill: "currentColor", fillOpacity: 0.4 }}
          />
          {/* Tooltip disabled - no hover information */}

          {/* Background: other batteries — hollow circles in cluster colour */}
          <Scatter data={otherPoints} isAnimationActive={false} shape="circle">
            {otherPoints.map((p, i) => (
              <Cell key={`bg-${i}`} fill="none" stroke={clusterColor(p.cluster_id)} strokeWidth={1} r={1.5} />
            ))}
          </Scatter>

          {/* Foreground: selected battery — amber with white edge, stands out from cluster colours */}
          <Scatter data={thisPoints} isAnimationActive={false} shape="circle">
            {thisPoints.map((_, i) => (
              <Cell key={`fg-${i}`} fill="#F59E0B" fillOpacity={1} r={3} stroke={edgeStroke} strokeWidth={1.5} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
          <span className="text-muted-foreground font-medium">This battery</span>
        </div>
        <span className="text-muted-foreground/30 text-xs">·</span>
        {[0, 1, 2].map((cid) => (
          <div key={cid} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ border: `2px solid ${clusterColor(cid)}`, background: "transparent" }}
            />
            <span className="text-muted-foreground">{clusterLabel(cid)}</span>
          </div>
        ))}
      </div>
      {thisPoints.length > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          {thisPoints.length} trading days · each dot = one day&apos;s strategy
        </p>
      )}
    </div>
  );
}
