"use client";

import { useMemo, useState } from "react";
import type { BatteryDailyRow } from "@/lib/types";

function fmtRevenue(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "+";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function getCellColor(net: number | undefined, maxNet: number): string {
  if (net === undefined) return "rgba(120, 120, 120, 0.08)";
  if (net < 0) {
    const intensity = Math.min(1, Math.sqrt(Math.abs(net) / maxNet));
    return `rgba(239, 68, 68, ${(0.3 + intensity * 0.5).toFixed(2)})`;
  }
  if (net === 0) return "rgba(120, 120, 120, 0.12)";
  // sqrt scale so moderate days are clearly visible
  const pct = Math.sqrt(net / maxNet);
  const alpha = 0.15 + pct * 0.82;
  return `rgba(34, 197, 94, ${alpha.toFixed(2)})`;
}

interface Props {
  rows: BatteryDailyRow[];
  onDayClick?: (date: string) => void;
}

export function RevenueHeatmap({ rows, onDayClick }: Props) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const { byDate, maxNet, months } = useMemo(() => {
    const byDate: Record<string, number> = {};
    let maxNet = 1;
    for (const r of rows) {
      byDate[r.date] = r.net;
      const abs = Math.abs(r.net);
      if (abs > maxNet) maxNet = abs;
    }

    const dates = Object.keys(byDate).sort();
    if (dates.length === 0) return { byDate, maxNet: 1, months: [] as { year: number; month: number }[] };

    const [startY, startM] = dates[0].split("-").map(Number);
    const [endY, endM] = dates[dates.length - 1].split("-").map(Number);

    const months: { year: number; month: number }[] = [];
    let y = startY, m = startM;
    while (y < endY || (y === endY && m <= endM)) {
      months.push({ year: y, month: m });
      m++;
      if (m > 12) { m = 1; y++; }
    }

    return { byDate, maxNet, months };
  }, [rows]);

  if (months.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No daily data available
      </div>
    );
  }

  const hoveredNet = hoveredDate !== null ? byDate[hoveredDate] : undefined;

  return (
    <div className="space-y-4">
      {/* Hover info */}
      <div className="h-5">
        {hoveredDate ? (
          <p className="text-xs">
            <span className="font-medium text-foreground">{hoveredDate}</span>
            {hoveredNet !== undefined ? (
              <span
                className={`ml-2 font-mono ${hoveredNet >= 0 ? "text-green-500" : "text-red-500"
                  }`}
              >
                {fmtRevenue(hoveredNet)}
              </span>
            ) : (
              <span className="ml-2 text-muted-foreground">No data</span>
            )}
            {hoveredNet !== undefined && onDayClick && (
              <span className="ml-2 text-muted-foreground text-xs">
                — click to view intervals
              </span>
            )}
          </p>
        ) : null}
      </div>

      {/* Month grids */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-5">
        {months.map(({ year, month }) => {
          const daysInMonth = new Date(year, month, 0).getDate();
          // Convert Sun=0 to Mon=0 offset
          const firstDow = new Date(year, month - 1, 1).getDay();
          const offset = firstDow === 0 ? 6 : firstDow - 1;

          const cells: Array<number | null> = Array<null>(offset).fill(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);
          while (cells.length % 7 !== 0) cells.push(null);

          return (
            <div key={`${year}-${month}`}>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {MONTH_NAMES[month - 1]} {year}
              </p>
              <div className="grid grid-cols-7 gap-[3px]">
                {DAY_LABELS.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[9px] text-muted-foreground/50 leading-none pb-0.5"
                  >
                    {d}
                  </div>
                ))}
                {cells.map((day, i) => {
                  if (day === null) {
                    return <div key={`pad-${i}`} />;
                  }
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const net = byDate[dateStr];
                  const isHovered = hoveredDate === dateStr;
                  const isClickable = net !== undefined && onDayClick != null;

                  return (
                    <div
                      key={dateStr}
                      onMouseEnter={() => setHoveredDate(dateStr)}
                      onMouseLeave={() => setHoveredDate(null)}
                      onClick={() => isClickable && onDayClick(dateStr)}
                      style={{ backgroundColor: getCellColor(net, maxNet) }}
                      className={`aspect-square rounded-[2px] transition-transform ${isClickable ? "cursor-pointer hover:scale-110" : ""
                        } ${isHovered ? "ring-1 ring-foreground/40 ring-offset-[1px]" : ""}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Low</span>
        <div className="flex gap-[3px]">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((pct) => (
            <div
              key={pct}
              className="h-3 w-3 rounded-[2px]"
              style={{
                backgroundColor: `rgba(34, 197, 94, ${(0.15 + pct * 0.82).toFixed(2)})`,
              }}
            />
          ))}
        </div>
        <span>High</span>
        <span className="mx-1">·</span>
        <div
          className="h-3 w-3 rounded-[2px]"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.6)" }}
        />
        <span>Negative</span>
      </div>
    </div>
  );
}
