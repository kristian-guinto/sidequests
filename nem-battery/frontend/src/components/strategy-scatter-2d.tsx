"use client";

import {
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

  // Derive present clusters from thisPoints for legend
  const presentClusters = [...new Set(thisPoints.map((p) => p.cluster_id))].sort(
    (a, b) => a - b
  );

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
          <Tooltip content={<ScatterTooltip />} cursor={false} />

          {/* Background: all other batteries */}
          <Scatter
            data={otherPoints}
            isAnimationActive={false}
            shape="circle"
          >
            {otherPoints.map((_, i) => (
              <Cell key={`bg-${i}`} fill="rgb(113 113 122)" fillOpacity={0.15} />
            ))}
          </Scatter>

          {/* Foreground: this battery, colored by cluster */}
          <Scatter
            data={thisPoints}
            isAnimationActive={false}
            shape="circle"
          >
            {thisPoints.map((p, i) => (
              <Cell
                key={`fg-${i}`}
                fill={clusterColor(p.cluster_id)}
                fillOpacity={0.85}
                r={4}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Cluster legend */}
      {presentClusters.length > 0 && (
        <div className="flex flex-wrap gap-3 px-1">
          {presentClusters.map((cid) => (
            <div key={cid} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: clusterColor(cid) }}
              />
              <span className="text-muted-foreground">{clusterLabel(cid)}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs">
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-500 opacity-30" />
            <span className="text-muted-foreground">Other batteries</span>
          </div>
        </div>
      )}
      {thisPoints.length > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          {thisPoints.length} trading days plotted · each dot = one day&apos;s strategy
        </p>
      )}
    </div>
  );
}
