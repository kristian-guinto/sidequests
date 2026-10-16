'use client';

import React, { useState } from 'react';
import {
  CompletionStats,
  GroupedAnswersPrompt,
  SCORE_BANDS,
  TIERS,
  UserAnswerRecord,
  getScoreBand,
} from '@/lib/types';
import { Share2, Check, RefreshCw, Trophy, Waves, Sparkles } from 'lucide-react';
import { AnswerExplorer } from './AnswerExplorer';

interface ResultsModalProps {
  dayNumber?: number;
  dateStr?: string;
  totalScore: number;
  userAnswers: UserAnswerRecord[];
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
  stats,
  answersPrompts,
  onPlayAgain,
  isUnlimited = false,
}: ResultsModalProps) {
  const [copied, setCopied] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);

  const totalPossible = userAnswers.length * 100;
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
    ? `Krillion PH (Practice) 🦐\nDepth: -${depthMeters.toLocaleString()}m (${totalScore}/${totalPossible})\n${emojiRow}\nhttps://krillion.guinto.org`
    : `Krillion PH #${dayNumber} 🦐\nDepth: -${depthMeters.toLocaleString()}m (${totalScore}/${totalPossible})\n${emojiRow}\nhttps://krillion.guinto.org`;

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
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Primary Results Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur shadow-2xl text-center relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-krillion-gold/10 blur-3xl pointer-events-none rounded-full" />

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-bold text-krillion-gold mb-4">
          <Trophy className="w-3.5 h-3.5" />
          <span>{isUnlimited ? 'Practice Dive Completed' : `Daily Dive #${dayNumber} Completed`}</span>
        </div>

        {/* Big Depth & Score */}
        <h2 className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight mb-1">
          -{depthMeters.toLocaleString()}m
        </h2>
        <div className="text-slate-400 font-mono text-sm mb-4">
          Total Score: <span className="text-krillion-gold font-bold">{totalScore}</span> / {totalPossible} pts
        </div>

        {/* Verdict Badge */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 mb-6 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-2xl">{band.emoji}</span>
            <span className="text-lg font-black text-white">{band.name}</span>
          </div>
          <p className="text-xs text-slate-400">{band.description}</p>
        </div>

        {/* Emoji Breakdown */}
        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 inline-flex items-center gap-2 text-2xl tracking-widest font-mono mb-6">
          {userAnswers.map((a, i) => (
            <span key={i} title={`${a.answer || 'Miss'} (${a.score} pts)`}>
              {a.tier === 'miss' ? '💨' : TIERS[a.tier]?.emoji || '🐟'}
            </span>
          ))}
        </div>

        {/* Percentile Stats */}
        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 mb-6 text-left">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-slate-300">
              Better than <strong className="text-krillion-cyan">{betterThan}%</strong> of divers today
            </span>
            <span className="text-slate-500 font-mono">
              {stats?.totalPlayers ? `${stats.totalPlayers.toLocaleString()} players` : '2,480 players'}
            </span>
          </div>

          <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-amber-400 rounded-full transition-all duration-700"
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
            className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-krillion-gold to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-lg shadow-amber-950/40"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Share Dive Result</span>
              </>
            )}
          </button>

          {isUnlimited && onPlayAgain && (
            <button
              onClick={onPlayAgain}
              className="w-full sm:w-auto py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Dive Again</span>
            </button>
          )}

          {answersPrompts && answersPrompts.length > 0 && (
            <button
              onClick={() => setShowExplorer(!showExplorer)}
              className="w-full sm:w-auto py-3.5 px-5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-krillion-cyan font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{showExplorer ? 'Hide Answers' : 'Answer Explorer'}</span>
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
