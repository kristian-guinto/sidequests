'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ClientPromptItem, EvaluationResult, TIERS, TierId } from '@/lib/types';
import { DepthOdometer } from './DepthOdometer';
import { TierPixelSprite } from '@/components/sprites/PixelSprites';
import { Send, FastForward, HelpCircle, ArrowRight, Gauge, AlertCircle, Sparkles } from 'lucide-react';

interface ActivePromptCardProps {
  prompt: ClientPromptItem;
  promptNumber: number;
  totalPrompts: number;
  onEvaluate: (rawAnswer: string) => Promise<EvaluationResult>;
  onPlungeStart?: (evalResult: EvaluationResult) => void;
  onNext: () => void;
}

export function ActivePromptCard({
  prompt,
  promptNumber,
  totalPrompts,
  onEvaluate,
  onPlungeStart,
  onNext,
}: ActivePromptCardProps) {
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(25);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [showHint, setShowHint] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input and reset state on new prompt
  useEffect(() => {
    setInput('');
    setTimeLeft(25);
    setIsSubmitting(false);
    setResult(null);
    setShowHint(false);

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => clearTimeout(timer);
  }, [prompt.id]);

  // 25-second countdown timer
  useEffect(() => {
    if (result || isSubmitting) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handlePass(); // auto-pass when timer runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [result, isSubmitting, prompt.id]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || result) return;

    const trimmed = input.trim();
    if (!trimmed) {
      handlePass();
      return;
    }

    setIsSubmitting(true);
    try {
      const evalResult = await onEvaluate(trimmed);
      if (onPlungeStart) onPlungeStart(evalResult);
      setResult(evalResult);
    } catch {
      const fallbackResult: EvaluationResult = {
        matched: false,
        tier: 'miss',
        score: 0,
        canonicalAnswer: null,
        quip: 'Communication severed with surface buoy! Counted as miss.',
      };
      if (onPlungeStart) onPlungeStart(fallbackResult);
      setResult(fallbackResult);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePass = async () => {
    if (isSubmitting || result) return;
    setIsSubmitting(true);
    try {
      const evalResult = await onEvaluate('');
      if (onPlungeStart) onPlungeStart(evalResult);
      setResult(evalResult);
    } catch {
      const fallbackResult: EvaluationResult = {
        matched: false,
        tier: 'miss',
        score: 0,
        canonicalAnswer: null,
        quip: 'You drifted along without answering.',
      };
      if (onPlungeStart) onPlungeStart(fallbackResult);
      setResult(fallbackResult);
    } finally {
      setIsSubmitting(false);
    }
  };

  const timerFraction = timeLeft / 25;
  const isTimeCritical = timeLeft <= 5;
  const isKrillion = result?.tier === 'krillion';
  const isDeepcut = result?.tier === 'deepcut';
  const isTooClever = result?.tier === 'tooclever';

  return (
    <div
      className={`w-full bg-slate-950/90 border-2 rounded-2xl p-5 sm:p-7 backdrop-blur-md shadow-2xl relative overflow-hidden transition-all duration-300 crt-scanlines ${
        isKrillion
          ? 'border-krillion-gold shadow-[0_0_50px_rgba(255,209,102,0.35)] animate-krillion-shockwave'
          : isDeepcut
          ? 'border-krillion-purple shadow-[0_0_40px_rgba(157,123,255,0.3)]'
          : isTooClever
          ? 'border-krillion-orange shadow-[0_0_35px_rgba(255,159,67,0.3)]'
          : result && result.matched
          ? 'border-krillion-cyan/80 shadow-[0_0_35px_rgba(77,227,255,0.25)]'
          : 'border-slate-800'
      }`}
    >
      {/* Pixel Corner Brackets (Submarine Console Aesthetic) */}
      <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-krillion-cyan/70 pointer-events-none" />
      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-krillion-cyan/70 pointer-events-none" />
      <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-krillion-cyan/70 pointer-events-none" />
      <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-krillion-cyan/70 pointer-events-none" />

      {/* Top Console Bar */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-arcade font-bold tracking-widest uppercase text-krillion-cyan glow-cyan">
            DEPTH CHAMBER #{promptNumber} OF {totalPrompts}
          </span>
          <span className="text-slate-700">|</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-arcade tracking-wider bg-slate-900 border border-slate-700 text-slate-300 uppercase">
            {prompt.category === 'filipino' ? '🇵🇭 PINOY CONTEXT' : '🌐 UNIVERSAL'}
          </span>
        </div>

        {/* Oxygen / Sonar Timer Display */}
        {!result && (
          <div className="flex items-center gap-1.5 font-arcade">
            <Gauge className={`w-3.5 h-3.5 ${isTimeCritical ? 'text-red-400 animate-spin' : 'text-slate-400'}`} />
            <span
              className={`text-base font-black tracking-wider tabular-nums ${
                isTimeCritical ? 'text-red-400 animate-pulse glow-coral' : 'text-krillion-cyan glow-cyan'
              }`}
            >
              OXYGEN: {timeLeft}s
            </span>
          </div>
        )}
      </div>

      {/* Oxygen / Sonar Segmented Power Bar */}
      {!result && (
        <div className="w-full mb-6">
          <div className="relative w-full h-3 bg-slate-900 rounded border border-slate-800 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-sm transition-all duration-1000 ease-linear ${
                isTimeCritical
                  ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse'
                  : timeLeft <= 10
                  ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                  : 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_10px_rgba(77,227,255,0.7)]'
              }`}
              style={{ width: `${Math.max(0, timerFraction * 100)}%` }}
            />
          </div>
          {isTimeCritical && (
            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] font-arcade text-red-400 animate-pulse">
              <AlertCircle className="w-3 h-3" />
              <span>OXYGEN CRITICAL — ACT FAST!</span>
            </div>
          )}
        </div>
      )}

      {/* Prompt Question */}
      <div className="mb-6">
        <h2 className="text-lg sm:text-2xl font-black text-white leading-snug tracking-tight">
          {prompt.text}
        </h2>

        {prompt.hint && (
          <div className="mt-2.5 flex items-center gap-2">
            {!showHint ? (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                className="text-xs font-arcade tracking-wider text-slate-400 hover:text-krillion-cyan flex items-center gap-1.5 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>[REQUEST TACTICAL HINT]</span>
              </button>
            ) : (
              <p className="text-xs font-mono text-slate-300 bg-cyan-950/30 border border-cyan-800/40 px-3 py-1.5 rounded-lg">
                💡 <span className="text-krillion-cyan font-bold font-arcade tracking-wider">HINT:</span> {prompt.hint}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Input Form or Plunge Celebration Feedback */}
      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="relative cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              enterKeyHint="send"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSubmitting}
              placeholder="Type your deepest pull here..."
              className="w-full px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl bg-slate-900/90 border-2 border-slate-700 text-white placeholder-slate-500 text-base sm:text-lg font-mono focus:outline-none focus:ring-2 focus:ring-krillion-cyan focus:border-krillion-cyan transition-all shadow-inner touch-manipulation"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !input.trim()}
              className="flex-1 min-h-[48px] py-3 px-3 sm:px-6 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-slate-950 font-arcade font-bold text-sm sm:text-lg tracking-wider uppercase flex items-center justify-center gap-1.5 sm:gap-2 btn-arcade hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all select-none touch-manipulation"
            >
              <Send className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{isSubmitting ? 'TRANSMITTING...' : 'LAUNCH PLUNGE'}</span>
            </button>

            <button
              type="button"
              onClick={handlePass}
              disabled={isSubmitting}
              className="min-h-[48px] py-3 px-3 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-arcade font-bold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-1 sm:gap-1.5 transition-colors border border-slate-700 btn-arcade flex-shrink-0 select-none touch-manipulation whitespace-nowrap"
            >
              <FastForward className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>FLOAT / PASS</span>
            </button>
          </div>
        </form>
      ) : (
        /* Dramatic Plunge Reveal & Arcade Tier Celebration */
        <div className="animate-in fade-in zoom-in-95 duration-300">
          {/* Sonar Ping Shockwave Header */}
          <div
            className={`p-5 sm:p-6 rounded-2xl border-2 mb-6 flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden ${
              isKrillion
                ? 'bg-amber-950/40 border-krillion-gold shadow-[0_0_30px_rgba(255,209,102,0.3)]'
                : isDeepcut
                ? 'bg-purple-950/40 border-krillion-purple shadow-[0_0_25px_rgba(157,123,255,0.25)]'
                : isTooClever
                ? 'bg-orange-950/40 border-krillion-orange shadow-[0_0_25px_rgba(255,159,67,0.25)]'
                : result.matched
                ? 'bg-slate-900/90 border-slate-700 shadow-xl'
                : 'bg-red-950/30 border-red-900/60'
            }`}
          >
            {/* Pulsing Sonar Ring Background Effect */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="w-64 h-64 rounded-full border-2 border-krillion-cyan animate-ping" />
            </div>

            <div className="flex items-center gap-4 z-10 w-full sm:w-auto">
              {/* Giant Pixel Creature Sprite */}
              <div className="flex-shrink-0 flex items-center justify-center">
                <TierPixelSprite
                  tier={result.tier}
                  size={isKrillion ? 72 : isDeepcut ? 64 : isTooClever ? 64 : 56}
                  animate={true}
                  className={isTooClever ? 'animate-clown-wobble' : ''}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-base sm:text-lg font-black font-arcade tracking-wider uppercase"
                    style={{
                      color:
                        result.matched && result.tier !== 'miss'
                          ? TIERS[result.tier]?.color
                          : '#ef4444',
                    }}
                  >
                    {result.matched && result.tier !== 'miss'
                      ? TIERS[result.tier]?.name
                      : 'MISSED / DRIFTED'}
                  </span>
                  {result.canonicalAnswer && (
                    <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                      {result.canonicalAnswer}
                    </span>
                  )}
                </div>

                {/* Quip Box */}
                <p className="text-xs sm:text-sm font-mono text-slate-200 mt-1.5 italic bg-black/40 border border-slate-800 px-3 py-1.5 rounded-lg leading-relaxed">
                  &ldquo;{result.quip}&rdquo;
                </p>
              </div>
            </div>

            {/* Depth & Points Odometer Readout */}
            <div className="flex-shrink-0 text-right z-10 w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
              <div>
                <DepthOdometer
                  value={result.score}
                  prefix="+"
                  suffix=" PTS"
                  className="text-2xl sm:text-4xl font-black font-arcade"
                  glowColor={result.matched && result.tier !== 'miss' ? TIERS[result.tier]?.color : '#64748b'}
                />
              </div>
              <div className="text-xs font-arcade tracking-widest text-krillion-cyan">
                <DepthOdometer
                  value={result.score * 10}
                  prefix="-"
                  suffix="m DIVE"
                  className="font-bold font-arcade"
                  glowColor="#4de3ff"
                />
              </div>
            </div>
          </div>

          <button
            onClick={onNext}
            autoFocus
            className="w-full min-h-[50px] py-3.5 sm:py-4 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-krillion-gold to-amber-500 text-slate-950 font-arcade font-black text-base sm:text-xl uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 btn-arcade transition-all shadow-[0_0_20px_rgba(255,209,102,0.4)] select-none touch-manipulation"
          >
            <span className="truncate">{promptNumber < totalPrompts ? 'SUBMARINE DIVE TO NEXT DEPTH' : 'SURFACE & VIEW EXPEDITION LOG'}</span>
            <ArrowRight className="w-5 h-5 flex-shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}
