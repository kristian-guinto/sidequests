import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BatteryIntervalRow, BatteryMeta } from "@/lib/types";

function fmt$(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "+";
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtMw(mw: number): string {
  return `${mw.toFixed(1)} MW`;
}

function fmtPrice(rrp: number): string {
  return `$${rrp.toFixed(2)}/MWh`;
}

function fmtTime(isoStr: string): string {
  // NEM timestamps arrive as "YYYY-MM-DD HH:MM:SS" (AEST naive).
  // Split directly instead of using Date() to avoid UTC timezone shifts.
  const sep = isoStr.includes(" ") ? " " : "T";
  return isoStr.split(sep)[1]?.slice(0, 5) ?? isoStr;
}

interface Props {
  batteryKey: string;
  meta: BatteryMeta;
  row: BatteryIntervalRow | undefined;
}

export function BatteryCard({ batteryKey, meta, row }: Props) {
  const isPositive = row ? row.net >= 0 : true;

  return (
    <Link href={`/battery/${batteryKey}`} className="block group">
      <Card className="h-full transition-colors hover:border-primary/50 cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">{meta.name}</CardTitle>
            <Badge variant="outline" className="shrink-0 text-xs">
              {meta.region}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {meta.mw != null ? `${meta.mw} MW` : "—"}
            {meta.mwh != null ? ` / ${meta.mwh} MWh` : ""}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {row ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Interval</span>
                <span>{fmtTime(row.settlement_date)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">Net</span>
                <span
                  className={`text-right font-mono font-semibold ${isPositive ? "text-green-500" : "text-red-500"
                    }`}
                >
                  {fmt$(row.net)}
                </span>

                <span className="text-muted-foreground">RRP</span>
                <span className="text-right font-mono">{fmtPrice(row.rrp)}</span>

                <span className="text-muted-foreground">Discharge</span>
                <span className="text-right font-mono">{fmtMw(row.discharge_mw)}</span>

                <span className="text-muted-foreground">Charge</span>
                <span className="text-right font-mono">{fmtMw(row.charge_mw)}</span>

                {row.total_fcas !== 0 && (
                  <>
                    <span className="text-muted-foreground">FCAS</span>
                    <span className="text-right font-mono">{fmt$(row.total_fcas)}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No data — run ingest first</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
