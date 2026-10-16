'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, Archive, Compass, Waves } from 'lucide-react';
import { SubmarineSprite } from '@/components/sprites/PixelSprites';

interface HeaderProps {
  onOpenHowToPlay?: () => void;
  dayNumber?: number;
  dateStr?: string;
}

export function Header({ onOpenHowToPlay, dayNumber, dateStr }: HeaderProps) {
  const pathname = usePathname();

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

        {/* Navigation & Controls with Arcade Badges */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-arcade font-bold tracking-wider flex items-center gap-1.5 transition-all select-none touch-manipulation ${
              pathname === '/'
                ? 'bg-cyan-950/60 text-krillion-cyan border border-krillion-cyan/60 glow-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-krillion-cyan flex-shrink-0" />
            <span className="hidden sm:inline">DAILY DIVE</span>
            {dayNumber && <span className="text-xs font-mono text-krillion-gold">#{dayNumber}</span>}
          </Link>

          <Link
            href="/unlimited"
            className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-arcade font-bold tracking-wider flex items-center gap-1.5 transition-all select-none touch-manipulation ${
              pathname === '/unlimited'
                ? 'bg-purple-950/60 text-krillion-purple border border-krillion-purple/60 glow-purple'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-krillion-purple flex-shrink-0" />
            <span className="hidden sm:inline">UNLIMITED</span>
          </Link>

          <Link
            href="/archive"
            className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-arcade font-bold tracking-wider flex items-center gap-1.5 transition-all select-none touch-manipulation ${
              pathname.startsWith('/archive')
                ? 'bg-amber-950/60 text-krillion-gold border border-krillion-gold/60 glow-gold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-krillion-orange flex-shrink-0" />
            <span className="hidden sm:inline">ARCHIVE</span>
          </Link>

          {onOpenHowToPlay && (
            <button
              onClick={onOpenHowToPlay}
              aria-label="How to play"
              className="min-h-[38px] min-w-[38px] p-2 rounded-lg text-slate-400 hover:text-krillion-cyan hover:bg-slate-900/60 transition-colors border border-transparent hover:border-slate-800 flex items-center justify-center select-none touch-manipulation"
            >
              <HelpCircle className="w-4 h-4 flex-shrink-0" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
