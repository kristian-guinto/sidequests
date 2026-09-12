"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus, Info, AlertTriangle, Lightbulb, CheckCircle2 } from "lucide-react";
import { CountryCode, COUNTRIES_METADATA } from "@/lib/types";

interface StatCalloutProps {
  value: string;
  label: string;
  trend?: "up" | "down" | "neutral";
  change?: string;
  note?: string;
  variant?: "emerald" | "amber" | "blue" | "rose";
}

export function StatCallout({
  value,
  label,
  trend,
  change,
  note,
  variant = "emerald",
}: StatCalloutProps) {
  const variantStyles = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100",
    blue: "border-blue-500/30 bg-blue-500/5 text-blue-950 dark:text-blue-100",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-950 dark:text-rose-100",
  };

  const trendIcon = {
    up: <TrendingUp className="h-4 w-4 text-emerald-500 inline" />,
    down: <TrendingDown className="h-4 w-4 text-rose-500 inline" />,
    neutral: <Minus className="h-4 w-4 text-neutral-400 inline" />,
  };

  return (
    <div className={`my-6 p-4 rounded-xl border ${variantStyles[variant]} shadow-xs`}>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <span className="text-3xl font-black tracking-tight">{value}</span>
          {change && (
            <span className="ml-2 text-sm font-semibold flex-inline items-center gap-1">
              {trend && trendIcon[trend]}
              {change}
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </div>
      {note && (
        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {note}
        </div>
      )}
    </div>
  );
}

interface DataCalloutProps {
  type?: "insight" | "warning" | "methodology" | "takeaway";
  title?: string;
  children: React.ReactNode;
}

export function DataCallout({
  type = "insight",
  title,
  children,
}: DataCalloutProps) {
  const configs = {
    insight: {
      icon: <Lightbulb className="h-5 w-5 text-amber-500 shrink-0" />,
      border: "border-amber-500/30",
      bg: "bg-amber-50/50 dark:bg-amber-950/10",
      defaultTitle: "Key Insight",
    },
    warning: {
      icon: <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />,
      border: "border-rose-500/30",
      bg: "bg-rose-50/50 dark:bg-rose-950/10",
      defaultTitle: "Market Notice",
    },
    methodology: {
      icon: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
      border: "border-blue-500/30",
      bg: "bg-blue-50/50 dark:bg-blue-950/10",
      defaultTitle: "Data Methodology",
    },
    takeaway: {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
      border: "border-emerald-500/30",
      bg: "bg-emerald-50/50 dark:bg-emerald-950/10",
      defaultTitle: "Conclusion & Takeaway",
    },
  };

  const config = configs[type];

  return (
    <aside className={`my-6 p-4 rounded-xl border ${config.border} ${config.bg} text-neutral-800 dark:text-neutral-200`}>
      <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
        {config.icon}
        <span>{title || config.defaultTitle}</span>
      </div>
      <div className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 [&>p]:my-1">
        {children}
      </div>
    </aside>
  );
}

export function GridBadge({ country, region }: { country: CountryCode; region?: string }) {
  const meta = COUNTRIES_METADATA[country];
  if (!meta) return null;

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 align-middle">
      <span>{meta.flag}</span>
      <span>{meta.name}</span>
      {region && <span className="text-neutral-400 font-normal">({region})</span>}
    </span>
  );
}

