"use client";

import React from "react";
import { FuelBreakdownRow } from "@/lib/types";
import { Leaf } from "lucide-react";

interface FuelTableProps {
  breakdown: FuelBreakdownRow[];
}

export function FuelTable({ breakdown }: FuelTableProps) {
  const totalEnergyGWh = breakdown.reduce((acc, row) => acc + row.energyGWh, 0);
  const totalGenerationMW = breakdown.reduce((acc, row) => acc + row.generationMW, 0);
  const totalEmissions = breakdown.reduce((acc, row) => acc + row.emissionsTonnes, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-200 tracking-tight">
          Fuel Technology Breakdown
        </h3>
        <span className="text-xs text-slate-400">Total Contribution</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-4">Fuel Technology</th>
              <th className="py-2.5 px-3 text-right">Current Output (MW)</th>
              <th className="py-2.5 px-3 text-right">Energy (GWh)</th>
              <th className="py-2.5 px-3 text-right">Energy Share</th>
              <th className="py-2.5 px-4 text-right">Emissions (tCO₂)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {breakdown.map((row) => (
              <tr key={row.fuelTech} className="hover:bg-slate-800/40 transition">
                <td className="py-2.5 px-4 flex items-center space-x-2.5 font-medium text-slate-200">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: row.color }}
                  />
                  <span>{row.label}</span>
                  {row.isRenewable && (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      title="Renewable Energy"
                    >
                      <Leaf className="w-2.5 h-2.5 mr-0.5" />
                      RE
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-200">
                  {Math.round(row.generationMW).toLocaleString()} MW
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-200">
                  {row.energyGWh.toLocaleString()} GWh
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <span className="font-mono font-semibold text-slate-100">{row.percentage}%</span>
                    <div className="w-14 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, row.percentage)}%`,
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                  {row.emissionsTonnes > 0 ? `${Math.round(row.emissionsTonnes).toLocaleString()} t` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-800/80 font-bold text-slate-100 border-t border-slate-700">
            <tr>
              <td className="py-2.5 px-4">Total Grid Generation</td>
              <td className="py-2.5 px-3 text-right font-mono">
                {Math.round(totalGenerationMW).toLocaleString()} MW
              </td>
              <td className="py-2.5 px-3 text-right font-mono">
                {Math.round(totalEnergyGWh).toLocaleString()} GWh
              </td>
              <td className="py-2.5 px-3 text-right font-mono">100.0%</td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-300">
                {Math.round(totalEmissions).toLocaleString()} t
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

