'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, Archive, Compass, Flame, Waves } from 'lucide-react';

interface HeaderProps {
  onOpenHowToPlay?: () => void;
  dayNumber?: number;
  dateStr?: string;
}

export function Header({ onOpenHowToPlay, dayNumber, dateStr }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-slate-800/80 bg-trench-abyss/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo and Tagline */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl transform group-hover:scale-110 transition-transform">🦐</span>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black text-xl tracking-tight text-white group-hover:text-krillion-gold transition-colors">
                  KRILLION
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-krillion-gold/20 text-krillion-gold border border-krillion-gold/40">
                  PH
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide hidden sm:inline-block">
                Philippine Trench Daily Dive · Emden Deep
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              pathname === '/'
                ? 'bg-slate-800 text-krillion-gold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-krillion-cyan" />
            <span className="hidden sm:inline">Daily Dive</span>
            {dayNumber && <span className="text-[11px] font-mono text-krillion-cyan">#{dayNumber}</span>}
          </Link>

          <Link
            href="/unlimited"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              pathname === '/unlimited'
                ? 'bg-slate-800 text-krillion-gold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-krillion-purple" />
            <span className="hidden sm:inline">Unlimited</span>
          </Link>

          <Link
            href="/archive"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              pathname.startsWith('/archive')
                ? 'bg-slate-800 text-krillion-gold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-krillion-orange" />
            <span className="hidden sm:inline">Archive</span>
          </Link>

          {onOpenHowToPlay && (
            <button
              onClick={onOpenHowToPlay}
              aria-label="How to play"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
