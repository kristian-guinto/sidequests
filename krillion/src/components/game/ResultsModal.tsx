'use client';

import React, { useState } from 'react';
import {
  ClientPromptItem,
  CompletionStats,
  GroupedAnswersPrompt,
  SCORE_BANDS,
  TIERS,
  UserAnswerRecord,
  getScoreBand,
} from '@/lib/types';
import { Share2, Check, RefreshCw, Trophy, Sparkles, Radio, Anchor } from 'lucide-react';
import { SubmarineSprite, TierPixelSprite } from '@/components/sprites/PixelSprites';
import { DepthOdometer } from './DepthOdometer';
import { AnswerExplorer } from './AnswerExplorer';

interface ResultsModalProps {
  dayNumber?: number;
  dateStr?: string;
  totalScore: number;
  userAnswers: UserAnswerRecord[];
  prompts?: ClientPromptItem[];
  stats?: CompletionStats | null;
  answersPrompts?: GroupedAnswersPrompt[] | null;
  onPlayAgain?: () => void;
  isUnlimited?: boolean;
}

export function ResultsModal({
  dayNumber = 1,
  dateStr,
  totalScore,
  userAnswers,
  prompts,
  stats,
  answersPrompts,
  onPlayAgain,
  isUnlimited = false,
}: ResultsModalProps) {
  const [copied, setCopied] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);

  const totalPossible = (userAnswers.length || 7) * 100;
  const depthMeters = totalScore * 10;
  const band = getScoreBand(totalScore);

  // Generate tier emoji row
  const emojiRow = userAnswers
    .map((a) => {
      if (a.tier === 'miss') return '💨';
      return TIERS[a.tier]?.emoji || '🐟';
    })
    .join('');

  const shareText = isUnlimited
    ? `Krillion PH (Practice) 🦐\nDepth: -${depthMeters.toLocaleString()}m (${totalScore}/${totalPossible} pts)\n${emojiRow}\nhttps://krillion.guinto.org`
    : `Krillion PH #${dayNumber} 🦐\nDepth: -${depthMeters.toLocaleString()}m (${totalScore}/${totalPossible} pts)\n${emojiRow}\nhttps://krillion.guinto.org`;

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
            <span>{isUnlimited ? 'PRACTICE DIVE COMPLETED' : `DAILY DIVE #${dayNumber}`}</span>
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
            <div className="text-[11px] font-arcade tracking-widest text-slate-400 uppercase">
              FINAL BATHYMETRIC DEPTH
            </div>
            <DepthOdometer
              value={depthMeters}
              prefix="-"
              suffix="m"
              className="text-4xl sm:text-5xl font-black font-arcade text-krillion-cyan glow-cyan tracking-wider"
              glowColor="#4de3ff"
            />
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-0.5">
              <span className="text-xs font-arcade text-slate-400">TOTAL LOGGED:</span>
              <DepthOdometer
                value={totalScore}
                suffix={` / ${totalPossible} PTS`}
                className="text-base font-bold font-arcade text-krillion-gold glow-gold tracking-wide"
                glowColor="#ffd166"
              />
            </div>
          </div>
        </div>

        {/* Verdict Badge */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 mb-6 max-w-md mx-auto shadow-inner">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl">{band.emoji}</span>
            <span className="text-xl font-arcade font-bold text-white tracking-wider uppercase glow-gold">
              {band.name}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400">{band.description}</p>
        </div>

        {/* Emoji Breakdown Belt */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 inline-flex items-center gap-2 text-2xl tracking-widest font-mono mb-6">
          {userAnswers.map((a, i) => (
            <span key={i} title={`${a.answer || 'Miss'} (${a.score} pts)`}>
              {a.tier === 'miss' ? '💨' : TIERS[a.tier]?.emoji || '🐟'}
            </span>
          ))}
        </div>

        {/* 7 Chambers Detailed Log */}
        <div className="mb-6 text-left">
          <div className="text-xs font-arcade font-bold tracking-widest text-slate-400 uppercase mb-2 flex items-center justify-between">
            <span>CHAMBER TELEMETRY REPORT</span>
            <span className="text-[10px] text-slate-500 font-mono">7 ROUNDS LOGGED</span>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {userAnswers.map((ans, idx) => {
              const promptText =
                prompts?.[idx]?.text || answersPrompts?.[idx]?.text || `Question #${idx + 1}`;
              const isMiss = ans.tier === 'miss';
              const tierConfig = ans.tier !== 'miss' ? TIERS[ans.tier] : null;
              const tierColor = tierConfig?.color || '#ef4444';

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[10px] font-mono text-slate-500 w-5">#{idx + 1}</span>
                    <div className="flex-shrink-0">
                      <TierPixelSprite tier={ans.tier} size={24} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-slate-300 font-mono text-[11px] truncate max-w-[200px] sm:max-w-xs">
                        {promptText}
                      </div>
                      <div className="text-[11px] font-bold text-white truncate">
                        {ans.answer ? `"${ans.answer}"` : <span className="text-slate-500 italic">No Answer</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div
                      className="text-[11px] font-arcade font-bold tracking-wider uppercase"
                      style={{ color: tierColor }}
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleShare}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-krillion-gold to-amber-500 text-slate-950 font-arcade font-bold text-lg tracking-wider uppercase flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-lg shadow-amber-950/40 glow-gold cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 text-slate-950" />
                <span>COPIED TO CLIPBOARD!</span>
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5 text-slate-950" />
                <span>TRANSMIT DIVE LOG (SHARE)</span>
              </>
            )}
          </button>

          {isUnlimited && onPlayAgain && (
            <button
              onClick={onPlayAgain}
              className="w-full sm:w-auto py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-arcade font-bold text-base tracking-wider uppercase flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
              <RefreshCw className="w-4 h-4 text-krillion-cyan" />
              <span>DIVE AGAIN</span>
            </button>
          )}

          {answersPrompts && answersPrompts.length > 0 && (
            <button
              onClick={() => setShowExplorer(!showExplorer)}
              className="w-full sm:w-auto py-3.5 px-5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-krillion-cyan font-arcade font-bold text-base tracking-wider uppercase flex items-center justify-center gap-2 transition-colors border border-slate-700 glow-cyan"
            >
              <Sparkles className="w-4 h-4" />
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
