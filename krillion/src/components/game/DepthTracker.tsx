'use client';

import React from 'react';
import { TIERS, UserAnswerRecord } from '@/lib/types';
import { DepthOdometer } from './DepthOdometer';
import { SubmarineSprite, TierPixelSprite } from '@/components/sprites/PixelSprites';
import { Radio } from 'lucide-react';

interface DepthTrackerProps {
  currentPromptIndex: number;
  totalPrompts: number;
  userAnswers: UserAnswerRecord[];
  currentScore: number;
  isPlunging?: boolean;
}

const BATHYMETRY_LANDMARKS = [
  { depth: 0, label: 'Manila Bay', short: 'Surface' },
  { depth: 200, label: 'Tubbataha Reef', short: '-200m' },
  { depth: 1000, label: 'Verde Island Drop', short: '-1,000m' },
  { depth: 3500, label: 'Bohol Sea Abyss', short: '-3,500m' },
  { depth: 7000, label: 'Emden Deep (Trench)', short: '-7,000m' },
];

export function DepthTracker({
  currentPromptIndex,
  totalPrompts,
  userAnswers,
  currentScore,
  isPlunging = false,
}: DepthTrackerProps) {
  const currentDepthMeters = currentScore * 10;
  const maxPossibleDepthMeters = totalPrompts * 1000;
  const depthPercentage = Math.min(100, Math.max(3, (currentDepthMeters / maxPossibleDepthMeters) * 100));

  // Determine current oceanic landmark
  const getCurrentLandmark = (depth: number) => {
    if (depth < 200) return 'Surface · Manila Bay Coral Shelf';
    if (depth < 1000) return 'Tubbataha Reef · Palawan Marine Sanctuary';
    if (depth < 3500) return 'Verde Island Passage · Abyssal Drop';
    if (depth < 6000) return 'Bohol Sea Abyss · Twilight Ridge';
    return 'Emden Deep · Philippine Trench Hadal Floor';
  };

  return (
    <div className="w-full bg-slate-950/85 border-2 border-slate-700/80 rounded-2xl p-4 sm:p-5 backdrop-blur shadow-[0_0_30px_rgba(4,7,20,0.8)] relative overflow-hidden mb-6 crt-scanlines">
      {/* HUD Top Bar: Status & Sonar Odometer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950/80 border border-krillion-cyan/60">
            <Radio className="w-3.5 h-3.5 text-krillion-cyan animate-pulse" />
            <span className="absolute inset-0 rounded-full border border-krillion-cyan/40 animate-ping opacity-40 pointer-events-none" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-arcade font-bold tracking-widest text-krillion-cyan uppercase glow-cyan">
                SONAR BATHYMETRY
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800/90 text-slate-300 border border-slate-700">
                CHAMBER {Math.min(currentPromptIndex + 1, totalPrompts)}/{totalPrompts}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 truncate max-w-[260px] sm:max-w-md">
              📍 {getCurrentLandmark(currentDepthMeters)}
            </p>
          </div>
        </div>

        {/* Live Depth Odometer Display */}
        <div className="flex items-baseline justify-between sm:justify-end gap-3 self-end sm:self-auto w-full sm:w-auto">
          <div className="text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-arcade text-slate-400">DEPTH:</span>
              <DepthOdometer
                value={currentDepthMeters}
                prefix="-"
                suffix="m"
                className="text-xl sm:text-2xl font-black font-arcade text-krillion-cyan glow-cyan tracking-wider"
                glowColor="#4de3ff"
              />
              <span className="text-[11px] font-mono text-slate-500">/ -7,000m</span>
            </div>
          </div>

          <div className="px-2.5 py-1 rounded bg-amber-950/30 border border-krillion-gold/40 text-right">
            <DepthOdometer
              value={currentScore}
              suffix=" PTS"
              className="text-xs sm:text-sm font-bold font-arcade text-krillion-gold glow-gold tracking-wide"
              glowColor="#ffd166"
            />
          </div>
        </div>
      </div>

      {/* Submarine Depth Gauge Track */}
      <div className="relative w-full pt-6 pb-4">
        {/* Landmarks along the depth rail */}
        <div className="relative w-full h-2.5 bg-slate-900 rounded-full border border-slate-700/80 overflow-visible mb-6">
          {/* Fill glow track */}
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 via-purple-600 to-amber-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_14px_rgba(77,227,255,0.6)]"
            style={{ width: `${depthPercentage}%` }}
          />

          {/* Submarine Sprite Riding the Depth Gauge */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700 ease-out z-20 pointer-events-none"
            style={{ left: `${depthPercentage}%` }}
          >
            <div className="relative flex items-center justify-center">
              {/* Expanding sonar ring when plunging or moving */}
              <div
                className={`absolute w-12 h-12 rounded-full border border-krillion-cyan/50 pointer-events-none ${
                  isPlunging ? 'animate-ping opacity-90 border-krillion-gold' : 'animate-pulse opacity-40'
                }`}
              />
              <SubmarineSprite
                size={38}
                depthMeters={currentDepthMeters}
                animate={true}
                className={isPlunging ? 'scale-125 filter drop-shadow-[0_0_12px_#ffd166]' : ''}
              />
            </div>
          </div>

          {/* Landmark tick marks */}
          <div className="absolute inset-0 flex justify-between pointer-events-none px-1">
            {BATHYMETRY_LANDMARKS.map((mark, i) => (
              <div key={i} className="relative flex flex-col items-center">
                <div className="w-0.5 h-3 bg-slate-600 -translate-y-0.5" />
                <span className="absolute top-4 text-[9px] font-mono text-slate-500 whitespace-nowrap hidden sm:inline">
                  {mark.short}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7 Chambers (Rounds) with Unlocked Pixel Sprites */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-2 border-t border-slate-900">
        {Array.from({ length: totalPrompts }).map((_, idx) => {
          const ans = userAnswers[idx];
          const isCurrent = idx === currentPromptIndex && !ans;
          const isUpcoming = idx > currentPromptIndex;

          let borderColor = 'border-slate-800';
          let bgColor = 'bg-slate-900/60';
          let tierColor = '#64748b';

          if (ans) {
            if (ans.tier !== 'miss') {
              tierColor = TIERS[ans.tier]?.color || '#4de3ff';
              borderColor = `border-[${tierColor}]/60`;
              bgColor = 'bg-slate-900/90 shadow-md';
            } else {
              bgColor = 'bg-red-950/20 border-red-900/40 text-red-400';
            }
          } else if (isCurrent) {
            borderColor = 'border-krillion-cyan animate-pulse';
            bgColor = 'bg-cyan-950/40 shadow-[0_0_12px_rgba(77,227,255,0.25)]';
          }

          return (
            <div
              key={idx}
              className={`h-14 sm:h-16 rounded-xl border flex flex-col items-center justify-between p-1 transition-all ${bgColor} ${borderColor}`}
              style={{
                borderColor: ans && ans.tier !== 'miss' ? TIERS[ans.tier]?.color : undefined,
              }}
            >
              {/* Chamber Number or Tier label */}
              <div className="w-full flex items-center justify-between px-1">
                <span className="text-[8px] font-mono text-slate-500">#{idx + 1}</span>
                {ans && (
                  <span
                    className="text-[8px] font-arcade font-bold tracking-wider uppercase truncate"
                    style={{ color: ans.tier !== 'miss' ? TIERS[ans.tier]?.color : '#ef4444' }}
                  >
                    {ans.tier === 'krillion' ? '★ 100' : ans.tier}
                  </span>
                )}
              </div>

              {/* Sprite or Pulsing Indicator */}
              <div className="flex-1 flex items-center justify-center">
                {ans ? (
                  <TierPixelSprite tier={ans.tier} size={26} animate={ans.tier === 'krillion'} />
                ) : isCurrent ? (
                  <div className="w-3.5 h-3.5 rounded-full bg-krillion-cyan/30 border border-krillion-cyan flex items-center justify-center animate-ping" />
                ) : (
                  <span className="text-[10px] font-mono text-slate-700">·</span>
                )}
              </div>

              {/* Score / Status readout */}
              <span className="text-[9px] font-arcade font-bold tracking-wider text-slate-300">
                {ans ? (ans.score > 0 ? `+${ans.score}` : 'MISS') : isCurrent ? 'READY' : '---'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
