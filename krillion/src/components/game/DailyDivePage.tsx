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
    <div className="min-h-screen flex flex-col bg-trench-abyss text-slate-100">
      <Header
        onOpenHowToPlay={() => setHowToPlayOpen(true)}
        dayNumber={dayNumber}
        dateStr={dateStr}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col items-center">
        {/* Subheader info */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-krillion-gold mb-2">
            <span>🇵🇭</span>
            <span>Day #{dayNumber} · {title || 'Philippine Trench Dive'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            The Daily Dive
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            7 questions. 25 seconds each. How deep can your trivia knowledge sink?
          </p>
        </div>

        <GameContainer
          dayNumber={dayNumber}
          dateStr={dateStr}
          prompts={prompts}
          title={title}
        />
      </main>

      <footer className="w-full border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <p>Krillion PH · Philippine Trench Trivia Engine</p>
      </footer>

      <HowToPlayModal
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </div>
  );
}
