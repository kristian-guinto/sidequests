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
    <div className="min-h-screen flex flex-col bg-transparent text-slate-100 relative">
      <Header onOpenHowToPlay={() => setHowToPlayOpen(true)} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 flex flex-col items-center relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-700/60 text-xs font-arcade font-bold text-krillion-purple mb-2 glow-purple tracking-wider uppercase">
            <Compass className="w-3.5 h-3.5" />
            <span>UNLIMITED PRACTICE SIMULATOR</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-arcade font-black text-white tracking-wider uppercase glow-purple">
            INFINITE TRENCH DIVING
          </h1>
          <p className="text-xs sm:text-sm font-mono text-slate-400 mt-1 max-w-md mx-auto">
            Test your deepest Pinoy pulls anytime without touching your daily streak.
          </p>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 font-arcade">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-krillion-cyan glow-cyan" />
            <p className="text-base tracking-widest uppercase text-krillion-cyan">
              SUBMERGING SONAR SENSORS INTO THE TRENCH...
            </p>
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
          <div className="p-8 text-center bg-slate-900/80 border border-slate-800 rounded-2xl">
            <p className="text-slate-400 font-mono text-sm mb-4">No prompts returned from trench pool.</p>
            <button
              onClick={handlePlayAgain}
              className="px-5 py-2.5 bg-krillion-cyan text-slate-950 font-arcade font-bold text-sm tracking-wider uppercase rounded-xl glow-cyan"
            >
              RETRY SUBMERSION
            </button>
          </div>
        )}
      </main>

      <footer className="w-full border-t border-slate-900/80 py-5 text-center text-xs font-mono text-slate-500 bg-slate-950/60 backdrop-blur-sm relative z-10">
        <p>KRILLION PH · UNLIMITED PRACTICE FACILITY</p>
      </footer>

      <HowToPlayModal
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </div>
  );
}
