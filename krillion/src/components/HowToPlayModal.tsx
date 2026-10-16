'use client';

import React from 'react';
import { X, Sparkles, Anchor, Timer, Search, ShieldCheck } from 'lucide-react';
import { TIERS } from '@/lib/types';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto text-slate-200">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🦐</span>
          <h2 className="text-2xl font-black text-white tracking-tight">How to Play Krillion PH</h2>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          A daily dive into Philippine trivia and cultural obscurity.
        </p>

        {/* Core Rules */}
        <div className="space-y-4 mb-6 text-sm">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <Anchor className="w-5 h-5 text-krillion-cyan flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">7 Prompts, 1 Daily Dive</span>
              <span className="text-slate-300 text-xs leading-relaxed">
                Every day at midnight Manila time, dive through 7 prompts covering Filipino geography, street food, pop culture, history, and transit.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <Timer className="w-5 h-5 text-krillion-gold flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">25 Seconds Per Prompt</span>
              <span className="text-slate-300 text-xs leading-relaxed">
                Think fast! You have 25 seconds per prompt to enter your deepest pull. If you don’t know, you can float/pass to the next question.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <Sparkles className="w-5 h-5 text-krillion-coral flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">The Reverse Rarity Twist</span>
              <span className="text-slate-300 text-xs leading-relaxed">
                The most obvious answer everyone blurts out barely counts. The more obscure and niche your pull, the more points you earn and the deeper you sink into the Philippine Trench!
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <ShieldCheck className="w-5 h-5 text-krillion-purple flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Taglish & Typo Friendly</span>
              <span className="text-slate-300 text-xs leading-relaxed">
                Diacritics (ñ, é), common prefixes (&quot;Ang&quot;, &quot;Mt.&quot;, &quot;LRT&quot;, &quot;The&quot;), and minor typos are automatically resolved by our Taglish matcher.
              </span>
            </div>
          </div>
        </div>

        {/* Tiers Breakdown */}
        <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3">
          Depth Rarity Tiers
        </h3>
        <div className="space-y-2 mb-6">
          {Object.values(TIERS).map((t) => (
            <div
              key={t.id}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-800/30 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{t.emoji}</span>
                <div>
                  <div className="text-xs font-bold text-white">{t.name}</div>
                  <div className="text-[11px] text-slate-400">{t.blurb}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-xs font-bold font-mono" style={{ color: t.color }}>
                  +{t.score} pts
                </span>
                <span className="text-[10px] text-slate-500 block">-{t.score * 10}m</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-krillion-cyan to-blue-600 text-slate-950 font-black text-sm tracking-wide uppercase hover:opacity-95 transition-opacity"
        >
          Got It — Let&apos;s Dive
        </button>
      </div>
    </div>
  );
}
