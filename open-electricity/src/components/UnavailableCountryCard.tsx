"use client";

import React from "react";
import { CountryCode, COUNTRIES_METADATA } from "@/lib/types";
import { Lock, ShieldAlert, Activity, ExternalLink } from "lucide-react";

interface UnavailableCountryCardProps {
  country: CountryCode;
}

export function UnavailableCountryCard({ country }: UnavailableCountryCardProps) {
  const countryInfo = COUNTRIES_METADATA[country];
  if (!countryInfo) return null;

  return (
    <div className="rounded-xl border border-neutral-200/60 dark:border-[#1E1E21] bg-white dark:bg-[#0C0C0E] flex flex-col justify-between transition-all duration-200 overflow-hidden">
      {/* Card Header */}
      <div>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl leading-none select-none">
              {countryInfo.flag}
            </span>
            <div>
              <h3 className="font-semibold text-[15px] text-neutral-900 dark:text-neutral-50 tracking-tight">
                {countryInfo.name}
              </h3>
              <p className="text-[10px] text-neutral-400 font-mono">
                {countryInfo.gridOperator || "National Grid"}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono">
            <Lock className="w-2.5 h-2.5" />
            <span>Observation Mode</span>
          </span>
        </div>

        {/* Unavailable Explanation */}
        <div className="px-4 py-3 space-y-2.5">
          <div className="flex items-start space-x-2 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-[#121215] p-3 rounded-lg border border-neutral-200/60 dark:border-[#1E1E22]">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              {countryInfo.unavailableReason ||
                "Real-time grid dispatch and generation telemetry are not published via public APIs."}
            </p>
          </div>

          {/* Grid Metadata */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-neutral-50 dark:bg-[#121215] p-2.5 rounded-lg border border-neutral-200/50 dark:border-[#1E1E22]">
              <span className="text-neutral-400 block text-[10px] uppercase font-mono tracking-wider">
                Installed Cap.
              </span>
              <span className="font-semibold font-mono text-neutral-800 dark:text-neutral-200 text-xs">
                {countryInfo.installedCapacityGw || "N/A"}
              </span>
            </div>
            <div className="bg-neutral-50 dark:bg-[#121215] p-2.5 rounded-lg border border-neutral-200/50 dark:border-[#1E1E22]">
              <span className="text-neutral-400 block text-[10px] uppercase font-mono tracking-wider">
                SCADA Telemetry
              </span>
              <span className="font-semibold text-neutral-500 dark:text-neutral-400 flex items-center space-x-1 text-xs">
                <Activity className="w-3 h-3 text-amber-500" />
                <span>Offline</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer Info */}
      <div className="px-4 py-2.5 border-t border-neutral-100/60 dark:border-[#1E1E21]/60 flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
        <span>Available via Monthly Reports</span>
        <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400">
          Observation
        </span>
      </div>
    </div>
  );
}

