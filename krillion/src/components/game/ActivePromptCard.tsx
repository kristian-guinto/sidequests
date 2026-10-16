'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ClientPromptItem, EvaluationResult, TIERS, TierId } from '@/lib/types';
import { Send, FastForward, HelpCircle, ArrowRight, Sparkles } from 'lucide-react';

interface ActivePromptCardProps {
  prompt: ClientPromptItem;
  promptNumber: number;
  totalPrompts: number;
  onEvaluate: (rawAnswer: string) => Promise<EvaluationResult>;
  onNext: () => void;
}

export function ActivePromptCard({
  prompt,
  promptNumber,
  totalPrompts,
  onEvaluate,
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

    // Auto-focus input
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

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
      setResult(evalResult);
    } catch {
      setResult({
        matched: false,
        tier: 'miss',
        score: 0,
        canonicalAnswer: null,
        quip: 'Communication severed with surface buoy! Counted as miss.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePass = async () => {
    if (isSubmitting || result) return;
    setIsSubmitting(true);
    try {
      const evalResult = await onEvaluate('');
      setResult(evalResult);
    } catch {
      setResult({
        matched: false,
        tier: 'miss',
        score: 0,
        canonicalAnswer: null,
        quip: 'You drifted along without answering.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const timerFraction = timeLeft / 25;
  const isTimeCritical = timeLeft <= 5;

  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur shadow-2xl relative overflow-hidden transition-all">
      {/* Top Bar: Prompt progress & Category badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-krillion-gold">
            Depth {promptNumber} of {totalPrompts}
          </span>
          <span className="text-slate-600">/</span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 border border-slate-700/60 text-slate-300">
            {prompt.category === 'filipino' ? '🇵🇭 Pinoy Culture' : '🌐 Universal'}
          </span>
        </div>

        {/* 25s Countdown display */}
        {!result && (
          <div className="flex items-center gap-1.5 font-mono">
            <span
              className={`text-sm font-black transition-colors ${
                isTimeCritical
                  ? 'text-red-400 animate-pulse scale-110'
                  : 'text-slate-400'
              }`}
            >
              {timeLeft}s
            </span>
          </div>
        )}
      </div>

      {/* Timer Bar */}
      {!result && (
        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mb-6">
          <div
            className={`h-full transition-all duration-1000 ease-linear rounded-full ${
              isTimeCritical
                ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                : 'bg-krillion-cyan'
            }`}
            style={{ width: `${Math.max(0, timerFraction * 100)}%` }}
          />
        </div>
      )}

      {/* Prompt Question */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-black text-white leading-snug">
          {prompt.text}
        </h2>

        {prompt.hint && (
          <div className="mt-2 flex items-center gap-2">
            {!showHint ? (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                className="text-xs text-slate-500 hover:text-krillion-cyan flex items-center gap-1 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Show hint</span>
              </button>
            ) : (
              <p className="text-xs text-slate-400 bg-slate-800/40 border border-slate-800 px-3 py-1.5 rounded-lg italic">
                💡 {prompt.hint}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Input or Result Feedback */}
      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSubmitting}
              placeholder="Type your deepest pull here..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className="w-full px-5 py-4 rounded-2xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-krillion-cyan focus:border-transparent transition-all shadow-inner"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !input.trim()}
              className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-krillion-cyan to-blue-600 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-950/40"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Diving...' : 'Submit Dive'}</span>
            </button>

            <button
              type="button"
              onClick={handlePass}
              disabled={isSubmitting}
              className="py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-slate-700/50"
            >
              <FastForward className="w-3.5 h-3.5 text-slate-400" />
              <span>Float / Pass</span>
            </button>
          </div>
        </form>
      ) : (
        /* Instant Feedback Card */
        <div className="animate-in fade-in zoom-in-95 duration-200">
          <div
            className={`p-5 rounded-2xl border mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              result.matched
                ? 'bg-slate-800/80 border-slate-700 shadow-xl'
                : 'bg-red-950/20 border-red-900/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-4xl">
                {result.matched && result.tier !== 'miss'
                  ? TIERS[result.tier]?.emoji
                  : '💨'}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-black uppercase tracking-wider"
                    style={{
                      color:
                        result.matched && result.tier !== 'miss'
                          ? TIERS[result.tier]?.color
                          : '#ef4444',
                    }}
                  >
                    {result.matched && result.tier !== 'miss'
                      ? TIERS[result.tier]?.name
                      : 'Miss / Floated'}
                  </span>
                  {result.canonicalAnswer && (
                    <span className="text-xs text-slate-400">
                      ({result.canonicalAnswer})
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-200 mt-1 italic">
                  &ldquo;{result.quip}&rdquo;
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 text-left sm:text-right">
              <div
                className="text-2xl font-black font-mono"
                style={{
                  color:
                    result.matched && result.tier !== 'miss'
                      ? TIERS[result.tier]?.color
                      : '#64748b',
                }}
              >
                +{result.score} PTS
              </div>
              <div className="text-xs font-mono text-slate-400">
                -{result.score * 10}m depth
              </div>
            </div>
          </div>

          <button
            onClick={onNext}
            autoFocus
            className="w-full py-4 rounded-xl bg-gradient-to-r from-krillion-gold to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-lg shadow-amber-950/40"
          >
            <span>{promptNumber < totalPrompts ? 'Next Depth' : 'Complete Dive & View Results'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
