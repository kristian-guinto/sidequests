"use client";

import { FEATURE_GROUPS } from "@/lib/strategy-types";

export function StrategyMethodNote() {
  return (
    <details className="group rounded-lg border bg-card text-card-foreground">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium select-none list-none">
        <span>How the strategy map works</span>
        <svg
          className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      <div className="border-t px-4 py-4 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each dot on the scatter plot represents one battery&apos;s behaviour across a single
          NEM trading day. 15 features — capturing how the battery operated, what prices it
          responded to, and when it acted — are computed for every day and transformed using{" "}
          <strong>UMAP</strong> (Uniform Manifold Approximation and Projection) to place
          similar days close together in 2D space. <strong>KMeans</strong> then partitions
          these points into 3 clusters, each corresponding to a distinct operating strategy.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="text-xs font-semibold">{group.label}</p>
              <ul className="space-y-1">
                {group.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3">
          <span className="font-medium">Data quality filters:</span> only complete days (288
          intervals), non-zero revenue days, and days below the 95th-percentile spot price peak
          are included — to avoid distortion from price spike events.
        </p>
      </div>
    </details>
  );
}
