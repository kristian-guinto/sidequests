"use client";

import React from "react";
import { InterconnectorFlow } from "@/lib/types";
import { ArrowRight, Cable } from "lucide-react";

interface InterconnectorCardProps {
  interconnectors: InterconnectorFlow[];
}

export function InterconnectorCard({ interconnectors }: InterconnectorCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-200 tracking-tight flex items-center space-x-2">
          <Cable className="h-4 w-4 text-emerald-400" />
          <span>Interconnector Transfers (Submarine Grid Links)</span>
        </h3>
        <span className="text-xs text-slate-400">Physical Flow</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {interconnectors.map((flow, i) => {
          const loadPct = Math.round((flow.flowMW / flow.capacityMW) * 100);
          return (
            <div
              key={i}
              className="bg-slate-800/60 border border-slate-700/70 p-3 rounded-lg flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>{flow.name}</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  Cap: {flow.capacityMW} MW
                </span>
              </div>

              <div className="my-2.5 flex items-center justify-between">
                <span className="text-xs bg-slate-700 px-2 py-0.5 rounded font-medium text-slate-200">
                  {flow.fromRegion}
                </span>
                <div className="flex items-center space-x-1 text-emerald-400 font-mono font-bold text-sm">
                  <span>{flow.flowMW} MW</span>
                  <ArrowRight className="h-4 w-4 text-emerald-400 animate-pulse" />
                </div>
                <span className="text-xs bg-slate-700 px-2 py-0.5 rounded font-medium text-slate-200">
                  {flow.toRegion}
                </span>
              </div>

              <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, loadPct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

