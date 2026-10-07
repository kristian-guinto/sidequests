"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLUSTER_DESCRIPTIONS } from "@/lib/strategy-types";
import { ClusterFeatureHeatmap } from "@/components/cluster-feature-heatmap";

interface Props {
  /** cluster_id this battery spent the most days in; used to highlight that card. */
  dominantCluster?: number;
}

export function StrategyClusterGuide({ dominantCluster }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground px-1">Strategy clusters</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CLUSTER_DESCRIPTIONS.map((cluster, idx) => {
          const isThis = dominantCluster === idx;
          return (
            <Card
              key={idx}
              className={isThis ? "ring-2 ring-inset" : ""}
              style={isThis ? { "--tw-ring-color": cluster.color, boxShadow: `inset 0 0 0 2px ${cluster.color}` } as object : undefined}
            >
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cluster.color }}
                  />
                  {cluster.name}
                  {isThis && (
                    <span
                      className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${cluster.color}22`, color: cluster.color }}
                    >
                      this battery
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {cluster.tagline}
                </p>
                <ul className="space-y-1.5">
                  {cluster.traits.map((trait, ti) => (
                    <li key={ti} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span
                        className="mt-1.5 h-1 w-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cluster.color }}
                      />
                      {trait}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ClusterFeatureHeatmap />
    </div>
  );
}
