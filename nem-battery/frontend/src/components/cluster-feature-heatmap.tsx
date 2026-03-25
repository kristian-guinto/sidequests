"use client";

import { useEffect, useState } from "react";
import type { ClusterSummaryRow } from "@/lib/types";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "@/lib/strategy-types";

// ── feature metadata ──────────────────────────────────────────────────────

type FeatureKey = keyof Omit<ClusterSummaryRow, "cluster_id">;

const FEATURES: { key: FeatureKey; label: string }[] = [
    { key: "utilization_factor", label: "Utilisation" },
    { key: "state_reversal_count", label: "State reversals" },
    { key: "normalised_total_variation", label: "Activity variation" },
    { key: "energy_price_pearson_correlation", label: "Price correlation" },
    { key: "price_selectivity_index", label: "Price selectivity" },
    { key: "co_optimization_frequency", label: "Co-optimisation" },
    { key: "fcas_revenue_share", label: "FCAS revenue share" },
    { key: "reg_vs_contingency_ratio", label: "Reg / contingency" },
    { key: "revenue_diversity_index", label: "Revenue diversity" },
    { key: "evening_peak_weight", label: "Evening peak" },
    { key: "morning_peak_weight", label: "Morning peak" },
    { key: "solar_soak_charge_weight", label: "Solar soak charge" },
    { key: "overnight_charge_weight", label: "Overnight charge" },
    { key: "negative_price_capture", label: "Negative price capture" },
];

// ── helpers ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
    // handles "rgb(r g b)" format used in CLUSTER_COLORS
    const rgb = hex.match(/\d+/g);
    if (rgb && rgb.length >= 3) return [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])];
    return [128, 128, 128];
}

/** Build a weak label: "Low" / "Mid" / "High" based on 0-1 normalised value. */
function tier(t: number): string {
    if (t < 0.35) return "Low";
    if (t < 0.65) return "Mid";
    return "High";
}

// ── component ─────────────────────────────────────────────────────────────

export function ClusterFeatureHeatmap() {
    const [rows, setRows] = useState<ClusterSummaryRow[]>([]);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch("/api/strategy/cluster-summary")
            .then((r) => (r.ok ? (r.json() as Promise<ClusterSummaryRow[]>) : Promise.reject()))
            .then(setRows)
            .catch(() => setError(true));
    }, []);

    if (error || rows.length === 0) return null;

    // min-max normalise each feature across the available clusters
    const normalised: Record<FeatureKey, number[]> = {} as Record<FeatureKey, number[]>;
    for (const { key } of FEATURES) {
        const vals = rows.map((r) => r[key] as number);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const range = max - min;
        normalised[key] = vals.map((v) => (range > 0 ? (v - min) / range : 0.5));
    }

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground px-1">
                Feature profile by cluster
            </h3>

            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="border-b">
                            <th className="py-2 px-3 text-left font-medium text-muted-foreground w-44">
                                Feature
                            </th>
                            {rows.map((row) => {
                                const name = CLUSTER_NAMES[row.cluster_id] ?? `Cluster ${row.cluster_id}`;
                                const color = CLUSTER_COLORS[row.cluster_id] ?? "#888";
                                return (
                                    <th key={row.cluster_id} className="py-2 px-3 text-center font-semibold" style={{ color }}>
                                        {name}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {FEATURES.map(({ key, label }) => (
                            <tr key={key} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="py-1.5 px-3 text-muted-foreground whitespace-nowrap font-medium">
                                    {label}
                                </td>
                                {rows.map((row, ci) => {
                                    const t = normalised[key][ci];
                                    const [r, g, b] = hexToRgb(CLUSTER_COLORS[row.cluster_id] ?? "#888");
                                    const bg = `rgba(${r},${g},${b},${0.08 + t * 0.35})`;
                                    return (
                                        <td
                                            key={row.cluster_id}
                                            className="py-1.5 px-3 text-center tabular-nums"
                                            style={{ backgroundColor: bg }}
                                        >
                                            <span className="font-medium">{tier(t)}</span>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
