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
    <div className="rounded-xl border border-dashed border-neutral-300 dark:border-[#27272A] bg-neutral-50/50 dark:bg-[#0A0A0C] p-5 flex flex-col justify-between transition-all duration-200">
      {/* Card Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200/60 dark:border-[#1E1E22]">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl leading-none select-none">
              {countryInfo.flag}
            </span>
            <div>
              <h3 className="font-semibold text-[15px] text-neutral-900 dark:text-neutral-100 tracking-tight">
                {countryInfo.name}
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                {countryInfo.gridOperator || "National Grid"}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Lock className="w-2.5 h-2.5" />
            <span>No Public SCADA</span>
          </span>
        </div>

        {/* Unavailable Explanation */}
        <div className="mt-4 space-y-3">
          <div className="flex items-start space-x-2 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-white dark:bg-[#121215] p-3 rounded-lg border border-neutral-200/50 dark:border-[#222226]">
            <ShieldAlert className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0 mt-0.5" />
            <p>
              {countryInfo.unavailableReason ||
                "Real-time grid dispatch and generation telemetry are not published via public APIs."}
            </p>
          </div>

          {/* Grid Metadata */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white/60 dark:bg-[#121215]/60 p-2 rounded border border-neutral-200/40 dark:border-[#1E1E22]">
              <span className="text-neutral-400 block text-[10px] uppercase font-mono tracking-wider">
                Installed Capacity
              </span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {countryInfo.installedCapacityGw || "N/A"}
              </span>
            </div>
            <div className="bg-white/60 dark:bg-[#121215]/60 p-2 rounded border border-neutral-200/40 dark:border-[#1E1E22]">
              <span className="text-neutral-400 block text-[10px] uppercase font-mono tracking-wider">
                Telemetry Status
              </span>
              <span className="font-semibold text-neutral-500 dark:text-neutral-400 flex items-center space-x-1">
                <Activity className="w-3 h-3 text-neutral-400" />
                <span>Offline</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer Info */}
      <div className="mt-5 pt-3 border-t border-neutral-200/60 dark:border-[#1E1E22] flex items-center justify-between text-[11px] text-neutral-400">
        <span>Available via Monthly Reports</span>
        <span className="text-neutral-400 dark:text-neutral-500 italic text-[10px]">
          Observation Mode
        </span>
      </div>
    </div>
  );
}

