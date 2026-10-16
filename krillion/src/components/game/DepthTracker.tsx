'use client';

import React from 'react';
import { TIERS, TierId, UserAnswerRecord } from '@/lib/types';

interface DepthTrackerProps {
  currentPromptIndex: number;
  totalPrompts: number;
  userAnswers: UserAnswerRecord[];
  currentScore: number;
}

export function DepthTracker({
  currentPromptIndex,
  totalPrompts,
  userAnswers,
  currentScore,
}: DepthTrackerProps) {
  const currentDepthMeters = currentScore * 10;
  const maxPossibleDepthMeters = totalPrompts * 1000;
  const depthPercentage = Math.min(100, Math.round((currentDepthMeters / maxPossibleDepthMeters) * 100));

  // Determine ocean depth zone
  const getZoneName = (depth: number) => {
    if (depth < 1000) return 'Epipelagic (Sunlit Waters)';
    if (depth < 3000) return 'Mesopelagic (Twilight Zone)';
    if (depth < 5000) return 'Bathypelagic (Midnight Zone)';
    if (depth < 6500) return 'Abyssopelagic (The Abyss)';
    return 'Hadal Zone (Emden Deep Floor)';
  };

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold tracking-wider text-krillion-cyan uppercase">
            Current Depth
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
            {getZoneName(currentDepthMeters)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-base font-black font-mono text-krillion-gold">
            -{currentDepthMeters.toLocaleString()}m
          </span>
          <span className="text-xs font-mono text-slate-500 ml-1">
            ({currentScore} pts)
          </span>
        </div>
      </div>

      {/* Depth progress bar */}
      <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80 mb-3">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-blue-600 to-amber-400 transition-all duration-500 ease-out rounded-full shadow-[0_0_12px_rgba(77,227,255,0.4)]"
          style={{ width: `${Math.max(4, depthPercentage)}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: totalPrompts }).map((_, idx) => {
          const ans = userAnswers[idx];
          const isCurrent = idx === currentPromptIndex && !ans;
          const isUpcoming = idx > currentPromptIndex;

          let emoji = '•';
          let bgColor = 'bg-slate-950/60 border-slate-800';

          if (ans) {
            if (ans.tier === 'miss') {
              emoji = '💨';
              bgColor = 'bg-slate-900 border-slate-700 text-slate-500';
            } else {
              emoji = TIERS[ans.tier]?.emoji || '🐟';
              bgColor = 'bg-slate-800 border-slate-700 shadow-sm';
            }
          } else if (isCurrent) {
            bgColor = 'bg-krillion-cyan/10 border-krillion-cyan/60 animate-pulse text-krillion-cyan';
          }

          return (
            <div
              key={idx}
              className={`h-9 rounded-xl border flex flex-col items-center justify-center text-xs transition-all ${bgColor}`}
            >
              <span className="text-sm leading-none">{emoji}</span>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                {ans ? (ans.score > 0 ? `+${ans.score}` : '0') : `#${idx + 1}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
