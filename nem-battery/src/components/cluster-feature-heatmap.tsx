"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import type { ClusterSummaryRow } from "@/lib/types";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "@/lib/strategy-types";

// ── feature metadata ──────────────────────────────────────────────────────

type FeatureKey = keyof Omit<ClusterSummaryRow, "cluster_id">;

const FEATURES: { key: FeatureKey; label: string; description: string }[] = [
    { key: "utilization_factor", label: "Utilisation", description: "Fraction of 5-minute intervals in the day with non-zero dispatch." },
    { key: "state_reversal_count", label: "State reversals", description: "Number of charge/discharge/idle transitions per day — higher means more frequent switching." },
    { key: "normalised_total_variation", label: "Activity variation", description: "MW 'choppiness' (total variation) relative to total output — measures how erratic the dispatch profile is." },
    { key: "energy_price_pearson_correlation", label: "Price correlation", description: "Pearson correlation between dispatch MW and spot price — how linearly the battery tracks price signals." },
    { key: "price_selectivity_index", label: "Price selectivity", description: "Spread between the average export price and average import price — higher means better buy-low/sell-high execution." },
    { key: "co_optimization_frequency", label: "Co-optimisation", description: "Fraction of intervals where both energy and FCAS are active simultaneously." },
    { key: "fcas_revenue_share", label: "FCAS revenue share", description: "Fraction of daily revenue earned from ancillary services (FCAS) rather than energy arbitrage." },
    { key: "reg_vs_contingency_ratio", label: "Reg / contingency", description: "Regulation FCAS revenue as a share of total FCAS revenue — high values mean the battery focuses on frequency regulation." },
    { key: "revenue_diversity_index", label: "Revenue diversity", description: "Shannon entropy across the 5 revenue streams — higher means revenue is spread across more service types." },
    { key: "evening_peak_weight", label: "Evening peak", description: "Fraction of total daily discharge occurring between 17:00–21:00 AEST (the evening demand peak)." },
    { key: "morning_peak_weight", label: "Morning peak", description: "Fraction of total daily discharge occurring between 06:00–09:00 AEST." },
    { key: "solar_soak_charge_weight", label: "Solar soak charge", description: "Fraction of total daily charging occurring between 10:00–15:00 AEST (solar generation window)." },
    { key: "overnight_charge_weight", label: "Overnight charge", description: "Fraction of total daily charging occurring between 00:00–04:00 AEST (overnight low-demand window)." },
    { key: "negative_price_capture", label: "Negative price capture", description: "Average charge rate during intervals with sub-zero spot prices — measures opportunistic surplus absorption." },
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
                        {FEATURES.map(({ key, label, description }) => (
                            <tr key={key} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="py-1.5 px-3 text-muted-foreground whitespace-nowrap font-medium">
                                    <span className="inline-flex items-center gap-1">
                                        {label}
                                        <span title={description} className="cursor-help">
                                            <Info className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                                        </span>
                                    </span>
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
