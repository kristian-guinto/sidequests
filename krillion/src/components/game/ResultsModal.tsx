'use client';

import React, { useState, useEffect } from 'react';
import {
  ClientPromptItem,
  CompletionStats,
  GroupedAnswersPrompt,
  SCORE_BANDS,
  TIERS,
  UserAnswerRecord,
  getScoreBand,
} from '@/lib/types';
import { Share2, Check, Trophy, Sparkles, Radio, Timer } from 'lucide-react';
import { SubmarineSprite, TierPixelSprite } from '@/components/sprites/PixelSprites';
import { DepthOdometer } from './DepthOdometer';
import { AnswerExplorer } from './AnswerExplorer';
import { getNextManilaMidnight } from '@/lib/date';

interface ResultsModalProps {
  dayNumber?: number;
  dateStr?: string;
  totalScore: number;
  userAnswers: UserAnswerRecord[];
  prompts?: ClientPromptItem[];
  stats?: CompletionStats | null;
  answersPrompts?: GroupedAnswersPrompt[] | null;
}

export function ResultsModal({
  dayNumber = 1,
  dateStr,
  totalScore,
  userAnswers,
  prompts,
  stats,
  answersPrompts,
}: ResultsModalProps) {
  const [copied, setCopied] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState('--:--:--');

  const totalPossible = (userAnswers.length || 7) * 100;
  const depthMeters = totalScore * 10;
  const band = getScoreBand(totalScore);

  // Live countdown to next midnight Manila Time (PST / UTC+8)
  useEffect(() => {
    const updateCountdown = () => {
      const nextMidnightIso = getNextManilaMidnight();
      const target = new Date(nextMidnightIso).getTime();
      const diff = Math.max(0, target - Date.now());

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const hStr = hours.toString().padStart(2, '0');
      const mStr = minutes.toString().padStart(2, '0');
      const sStr = seconds.toString().padStart(2, '0');

      setTimeLeftStr(`${hStr}:${mStr}:${sStr}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate tier emoji row
  const emojiRow = userAnswers
    .map((a) => {
      if (a.tier === 'miss') return '💨';
      return TIERS[a.tier]?.emoji || '🐟';
    })
    .join('');

  const shareText = `Krillion PH #${dayNumber} 🦐\nDepth: -${depthMeters.toLocaleString()}m (${totalScore}/${totalPossible} pts)\n${emojiRow}\nhttps://krillion.guinto.org`;

  const handleShare = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const betterThan = stats?.betterThan ?? 82;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300 relative z-10">
      {/* Primary Results Expedition Card */}
      <div className="bg-slate-950/90 border-2 border-slate-700/80 rounded-2xl p-5 sm:p-8 backdrop-blur-md shadow-[0_0_40px_rgba(4,7,20,0.9)] text-center relative overflow-hidden crt-scanlines">
        {/* Pixel Corner Brackets */}
        <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-krillion-gold/80 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-krillion-gold/80 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-krillion-gold/80 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-krillion-gold/80 pointer-events-none" />

        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-28 bg-krillion-gold/15 blur-3xl pointer-events-none rounded-full" />

        {/* Top Header Badge */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-krillion-cyan animate-pulse" />
            <span className="text-xs font-arcade font-bold tracking-widest text-krillion-cyan uppercase glow-cyan">
              EXPEDITION LOG · SECTOR 07
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-950/40 border border-krillion-gold/40 text-xs font-arcade font-bold text-krillion-gold">
            <Trophy className="w-3.5 h-3.5" />
            <span>{`DAILY DIVE #${dayNumber} COMPLETED`}</span>
          </div>
        </div>

        {/* Submarine & Depth Odometer Display */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 my-4">
          <div className="relative flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border border-krillion-cyan/30 flex items-center justify-center bg-slate-900/80 shadow-[0_0_25px_rgba(77,227,255,0.2)]">
              <SubmarineSprite size={52} depthMeters={depthMeters} animate={true} />
            </div>
            <div className="absolute inset-0 rounded-full border border-krillion-cyan/20 animate-ping opacity-30 pointer-events-none" />
          </div>

          <div className="text-center sm:text-left">
            <div className="text-xs font-arcade tracking-widest text-slate-400 uppercase mb-1">
              FINAL BATHYMETRIC DEPTH
            </div>
            <div className="flex items-baseline justify-center sm:justify-start gap-1">
              <DepthOdometer
                value={depthMeters}
                prefix="-"
                suffix="m"
                className="text-4xl sm:text-5xl font-black font-arcade text-krillion-cyan glow-cyan tracking-wider"
                glowColor="#4de3ff"
              />
            </div>
            <div className="text-xs font-mono text-slate-400 mt-1">
              Total Points: <strong className="text-krillion-gold glow-gold font-arcade">{totalScore}</strong> / {totalPossible} PTS
            </div>
          </div>
        </div>

        {/* Rank & Score Band Celebration Badge */}
        <div className="my-5 p-4 rounded-xl bg-slate-900/80 border border-slate-700/80 inline-block w-full max-w-md mx-auto shadow-inner">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-2xl">{band.emoji}</span>
            <span className="text-lg font-black font-arcade tracking-wider uppercase text-krillion-gold glow-gold">
              {band.name}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-300 italic">
            &ldquo;{band.description}&rdquo;
          </p>
        </div>

        {/* 7 Chambers Round Breakdown Badges */}
        <div className="mb-6">
          <div className="text-[11px] font-arcade font-bold tracking-wider text-slate-400 uppercase mb-2 text-left">
            CHAMBER TELEMETRY SUMMARY
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {userAnswers.map((ans, idx) => {
              const tierInfo = ans.tier !== 'miss' ? TIERS[ans.tier] : null;
              return (
                <div
                  key={idx}
                  className="rounded-lg bg-slate-900/80 border border-slate-800 p-1 flex flex-col items-center justify-between h-16 sm:h-20"
                  style={{
                    borderColor: tierInfo ? tierInfo.color : '#7f1d1d',
                  }}
                >
                  <span className="text-[9px] font-mono text-slate-500">#{idx + 1}</span>
                  <div className="my-0.5">
                    <TierPixelSprite tier={ans.tier} size={24} />
                  </div>
                  <div className="text-center w-full">
                    <div
                      className="text-[8px] font-arcade font-bold truncate"
                      style={{ color: tierInfo ? tierInfo.color : '#ef4444' }}
                    >
                      {ans.tier === 'krillion' ? '★ KRILLION' : ans.tier.toUpperCase()}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {ans.score > 0 ? `+${ans.score} PTS` : '0 PTS'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Percentile Stats */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 mb-6 text-left">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-slate-300 font-arcade text-sm tracking-wide">
              OUT-DIVED <strong className="text-krillion-cyan glow-cyan">{betterThan}%</strong> OF TRENCH EXPLORERS TODAY
            </span>
            <span className="text-slate-500 font-mono text-xs">
              {stats?.totalPlayers ? `${stats.totalPlayers.toLocaleString()} players` : '2,480 players'}
            </span>
          </div>

          <div className="relative w-full h-3 bg-slate-950 rounded border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-amber-400 rounded transition-all duration-700"
              style={{ width: `${Math.max(5, betterThan)}%` }}
            />
          </div>

          {stats?.dist && (
            <div className="grid grid-cols-5 gap-1 mt-3 text-[10px] text-center font-mono text-slate-400">
              {SCORE_BANDS.map((sb, idx) => (
                <div key={idx} className="truncate">
                  <div className="text-slate-500">{sb.name}</div>
                  <div className="font-bold text-slate-300">{stats.dist[idx] || 0}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Retro Submarine Next Dive Countdown HUD */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-slate-700/80 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-950/80 border border-krillion-cyan/60 flex-shrink-0">
              <Timer className="w-5 h-5 text-krillion-cyan animate-pulse" />
              <span className="absolute inset-0 rounded-xl border border-krillion-cyan/40 animate-ping opacity-30 pointer-events-none" />
            </div>
            <div className="text-left">
              <div className="text-[11px] font-arcade font-bold tracking-widest text-slate-300 uppercase">
                NEXT TRENCH EXPEDITION
              </div>
              <div className="text-xs font-mono text-slate-400">
                Chambers reset at 00:00 Manila Time (PST / UTC+8)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/70 border border-krillion-cyan/50 shadow-[0_0_20px_rgba(77,227,255,0.15)]">
            <span className="text-xs font-arcade text-slate-400">IN:</span>
            <span className="font-arcade font-black text-2xl sm:text-3xl text-krillion-cyan tracking-widest glow-cyan">
              {timeLeftStr}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleShare}
            className="w-full sm:flex-1 min-h-[48px] py-3.5 px-6 rounded-xl bg-gradient-to-r from-krillion-gold to-amber-500 text-slate-950 font-arcade font-bold text-base sm:text-lg tracking-wider uppercase flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-lg shadow-amber-950/40 glow-gold cursor-pointer select-none touch-manipulation"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 text-slate-950 flex-shrink-0" />
                <span>COPIED TO CLIPBOARD!</span>
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5 text-slate-950 flex-shrink-0" />
                <span>TRANSMIT DIVE LOG (SHARE)</span>
              </>
            )}
          </button>

          {answersPrompts && answersPrompts.length > 0 && (
            <button
              onClick={() => setShowExplorer(!showExplorer)}
              className="w-full sm:w-auto min-h-[48px] py-3.5 px-5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-krillion-cyan font-arcade font-bold text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-2 transition-colors border border-slate-700 glow-cyan select-none touch-manipulation"
            >
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span>{showExplorer ? 'HIDE ANSWERS' : 'EXPLORE ALL ANSWERS'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Answer Explorer Expansion */}
      {showExplorer && answersPrompts && answersPrompts.length > 0 && (
        <AnswerExplorer prompts={answersPrompts} />
      )}
    </div>
  );
}
