'use client';

import React, { useState } from 'react';
import { ClientPromptItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { HowToPlayModal } from '@/components/HowToPlayModal';
import { GameContainer } from './GameContainer';

interface DailyDivePageProps {
  dayNumber: number;
  dateStr: string;
  title?: string;
  prompts: ClientPromptItem[];
}

export function DailyDivePage({
  dayNumber,
  dateStr,
  title,
  prompts,
}: DailyDivePageProps) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-100 relative">
      <Header
        onOpenHowToPlay={() => setHowToPlayOpen(true)}
        dayNumber={dayNumber}
        dateStr={dateStr}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 flex flex-col items-center relative z-10">
        {/* Subheader info with Arcade Styling */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/80 text-xs font-arcade font-bold text-krillion-gold mb-2 shadow-sm">
            <span>🇵🇭</span>
            <span className="tracking-wider uppercase">DAY #{dayNumber} · {title || 'PHILIPPINE TRENCH DIVE'}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-arcade text-white tracking-wider uppercase glow-cyan">
            THE DAILY DIVE
          </h1>
          <p className="text-xs sm:text-sm font-mono text-slate-400 mt-1 max-w-md mx-auto">
            7 chambers. 25-second sonar countdown. How deep can your Pinoy pulls sink into Emden Deep?
          </p>
        </div>

        <GameContainer
          dayNumber={dayNumber}
          dateStr={dateStr}
          prompts={prompts}
          title={title}
        />
      </main>

      <footer className="w-full border-t border-slate-900/80 py-5 text-center text-xs font-mono text-slate-500 bg-slate-950/60 backdrop-blur-sm relative z-10">
        <p>KRILLION PH · PHILIPPINE TRENCH BATHYMETRIC TRIVIA ENGINE</p>
      </footer>

      <HowToPlayModal
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </div>
  );
}
