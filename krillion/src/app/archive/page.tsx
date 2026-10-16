'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { HowToPlayModal } from '@/components/HowToPlayModal';
import { getSavedDailyState } from '@/lib/storage';
import { Archive, Calendar, CheckCircle2, ChevronRight, Waves } from 'lucide-react';

interface ArchiveDiveItem {
  dayNumber: number;
  date: string;
  title: string;
  promptCount: number;
}

export default function ArchivePage() {
  const [dives, setDives] = useState<ArchiveDiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [completedMap, setCompletedMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const fetchArchive = async () => {
      try {
        const res = await fetch('/api/archive');
        if (res.ok) {
          const data = await res.json();
          setDives(data.dives || []);

          // Check completed states from local storage
          const completed: Record<number, boolean> = {};
          for (const d of data.dives || []) {
            const saved = getSavedDailyState(d.dayNumber);
            if (saved && saved.completed) {
              completed[d.dayNumber] = true;
            }
          }
          setCompletedMap(completed);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    fetchArchive();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 relative crt-scanlines">
      <Header onOpenHowToPlay={() => setHowToPlayOpen(true)} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/50 border border-krillion-orange/60 text-xs font-arcade font-bold text-krillion-orange mb-2 glow-orange tracking-wider uppercase">
            <Archive className="w-3.5 h-3.5" />
            <span>TRENCH EXPEDITION LOG</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-arcade font-black text-white tracking-wider uppercase glow-orange">
            DIVE ARCHIVE
          </h1>
          <p className="text-xs sm:text-sm font-mono text-slate-400 mt-1 max-w-md mx-auto">
            Replay or catch up on past Philippine Trench deep sea expeditions.
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 font-arcade">
            <p className="text-sm tracking-widest uppercase">FETCHING EXPEDITION ARCHIVE RECORDS...</p>
          </div>
        ) : dives.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {dives.map((d) => {
              const isCompleted = completedMap[d.dayNumber];
              return (
                <Link
                  key={d.dayNumber}
                  href={`/archive/${d.dayNumber}`}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-krillion-gold/80 hover:bg-slate-900 transition-all flex items-center justify-between group shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-lg flex items-center justify-center font-arcade font-bold text-base ${
                        isCompleted
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/80 glow-cyan'
                          : 'bg-slate-800/90 text-slate-300 border border-slate-700'
                      }`}
                    >
                      #{d.dayNumber}
                    </div>

                    <div>
                      <div className="text-sm font-arcade font-bold tracking-wide text-white group-hover:text-krillion-gold transition-colors">
                        {d.title}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{d.date}</span>
                        <span>·</span>
                        <span>{d.promptCount} chambers</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCompleted && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-krillion-gold transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 font-mono text-sm">
            No archive records found in sonar database.
          </div>
        )}
      </main>

      <footer className="w-full border-t border-slate-900/80 py-5 text-center text-xs font-mono text-slate-500 bg-slate-950/60 backdrop-blur-sm relative z-10">
        <p>KRILLION PH · HISTORICAL EXPEDITION LOG</p>
      </footer>

      <HowToPlayModal
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </div>
  );
}
