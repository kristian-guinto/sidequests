"use client";

import { FEATURE_GROUPS } from "@/lib/strategy-types";

export function StrategyMethodNote() {
  return (
    <details className="group">
      <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors select-none list-none w-fit">
        <svg
          className="h-3 w-3 transition-transform group-open:rotate-90 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>How the strategy map works</span>
      </summary>

      <div className="mt-3 pl-1 space-y-4 border-l border-border/50 ml-1.5 pl-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each dot represents one battery&apos;s behaviour across a single NEM trading day.
          15 features — capturing how the battery operated, what prices it responded to, and
          when it acted — are computed for every day and transformed using{" "}
          <strong>UMAP</strong> to place similar days close together in 2D space.{" "}
          <strong>KMeans</strong> then partitions these points into 3 clusters, each
          corresponding to a distinct operating strategy.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">{group.label}</p>
              <ul className="space-y-1">
                {group.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground/70">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground/70">
          <span className="font-medium text-muted-foreground">Data filters:</span> only
          complete days (288 intervals), non-zero revenue days, and days below the
          95th-percentile spot price peak are included.
        </p>
      </div>
    </details>
  );
}
