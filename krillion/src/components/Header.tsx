'use client';

import React from 'react';
import Link from 'next/link';
import { HelpCircle, Waves } from 'lucide-react';
import { SubmarineSprite } from '@/components/sprites/PixelSprites';

interface HeaderProps {
  onOpenHowToPlay?: () => void;
  dayNumber?: number;
  dateStr?: string;
}

export function Header({ onOpenHowToPlay, dayNumber, dateStr }: HeaderProps) {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md sticky top-0 z-40 crt-scanlines">
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Logo and Tagline with Pixel Submarine */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative flex items-center justify-center p-1 rounded-lg bg-cyan-950/40 border border-krillion-cyan/30 group-hover:border-krillion-gold/60 transition-colors">
              <SubmarineSprite size={28} depthMeters={0} animate={true} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-arcade font-black text-2xl tracking-wider text-white group-hover:text-krillion-gold transition-colors glow-cyan">
                  KRILLION
                </span>
                <span className="px-1.5 py-0.5 rounded text-[11px] font-arcade font-bold bg-amber-950/50 text-krillion-gold border border-krillion-gold/40 glow-gold">
                  PH
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider hidden sm:inline-block">
                PHILIPPINE TRENCH BATHYMETRIC TRIVIA
              </span>
            </div>
          </Link>
        </div>

        {/* Status Badge & How To Play Button */}
        <div className="flex items-center gap-2">
          {dayNumber && (
            <div className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-arcade font-bold tracking-wider flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 text-slate-200 select-none">
              <Waves className="w-3.5 h-3.5 text-krillion-cyan flex-shrink-0" />
              <span className="text-krillion-gold">DAY #{dayNumber}</span>
              {dateStr && (
                <span className="hidden sm:inline text-slate-400 font-mono text-[11px]">
                  · {dateStr}
                </span>
              )}
            </div>
          )}

          {onOpenHowToPlay && (
            <button
              onClick={onOpenHowToPlay}
              aria-label="How to play"
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-arcade font-bold tracking-wider text-krillion-cyan hover:text-white bg-cyan-950/40 hover:bg-cyan-900/50 border border-krillion-cyan/40 hover:border-krillion-cyan transition-all flex items-center justify-center gap-1.5 select-none touch-manipulation glow-cyan"
            >
              <HelpCircle className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">HOW TO PLAY</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
