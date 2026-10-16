'use client';

import React, { useState, useEffect } from 'react';
import { ClientPromptItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { HowToPlayModal } from '@/components/HowToPlayModal';
import { GameContainer } from '@/components/game/GameContainer';
import { Compass, RefreshCw } from 'lucide-react';

export default function UnlimitedPage() {
  const [prompts, setPrompts] = useState<ClientPromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameKey, setGameKey] = useState(0);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  const fetchUnlimitedPrompts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/unlimited?count=7');
      if (res.ok) {
        const data = await res.json();
        setPrompts(data.prompts || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnlimitedPrompts();
  }, [gameKey]);

  const handlePlayAgain = () => {
    setGameKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-trench-abyss text-slate-100">
      <Header onOpenHowToPlay={() => setHowToPlayOpen(true)} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col items-center">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/40 border border-purple-800/60 text-xs text-krillion-purple mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Unlimited Practice Mode</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Infinite Trench Diving
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Test your deepest Pinoy pulls anytime without touching your daily streak.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-krillion-cyan" />
            <p className="text-sm">Submerging sonar sensors into the trench...</p>
          </div>
        ) : prompts.length > 0 ? (
          <GameContainer
            key={gameKey}
            dayNumber={0}
            dateStr="unlimited"
            prompts={prompts}
            title="Unlimited Practice Dive"
            isUnlimited={true}
            onPlayAgain={handlePlayAgain}
          />
        ) : (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
            <p className="text-slate-400 text-sm mb-4">No prompts returned from trench pool.</p>
            <button
              onClick={handlePlayAgain}
              className="px-4 py-2 bg-krillion-cyan text-slate-950 font-bold text-xs rounded-xl"
            >
              Retry
            </button>
          </div>
        )}
      </main>

      <footer className="w-full border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <p>Krillion PH · Unlimited Practice Facility</p>
      </footer>

      <HowToPlayModal
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </div>
  );
}
