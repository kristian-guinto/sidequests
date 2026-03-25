import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BatterySparkline } from "@/components/battery-sparkline";
import type { BatteryMeta, BatterySummaryRow } from "@/lib/types";
import { CLUSTER_NAMES, CLUSTER_COLORS } from "@/lib/strategy-types";

function fmtRevenue(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

interface Props {
  batteryKey: string;
  meta: BatteryMeta;
  summary: BatterySummaryRow | undefined;
}

export function BatteryCard({ batteryKey, meta, summary }: Props) {
  const hasData =
    summary != null &&
    (summary.total_revenue !== 0 || summary.sparkline.length > 0);

  return (
    <Link href={`/battery/${batteryKey}`} className="block group">
      <Card className="h-full transition-colors hover:border-primary/50 cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">{meta.name}</CardTitle>
            <div className="flex items-center gap-1 shrink-0">
              {summary?.dominant_cluster != null && (
                <Badge
                  className="text-xs border-0"
                  style={{
                    backgroundColor: CLUSTER_COLORS[summary.dominant_cluster],
                    color: "#fff",
                  }}
                >
                  {CLUSTER_NAMES[summary.dominant_cluster]}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {meta.region}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {meta.mw != null ? `${meta.mw} MW` : "—"}
            {meta.mwh != null ? ` / ${meta.mwh} MWh` : ""}
          </p>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {hasData ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">All-time</p>
                  <p className="text-sm font-mono font-semibold tabular-nums">
                    {fmtRevenue(summary.total_revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg/mo</p>
                  <p className="text-sm font-mono font-semibold tabular-nums">
                    {fmtRevenue(summary.avg_monthly_revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">FCAS</p>
                  <p className="text-sm font-mono font-semibold tabular-nums">
                    {summary.fcas_share_pct.toFixed(0)}%
                  </p>
                </div>
              </div>
              <BatterySparkline data={summary.sparkline} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">No data yet</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
