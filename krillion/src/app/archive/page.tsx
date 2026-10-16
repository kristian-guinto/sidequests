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
    <div className="min-h-screen flex flex-col bg-trench-abyss text-slate-100">
      <Header onOpenHowToPlay={() => setHowToPlayOpen(true)} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-950/40 border border-orange-800/60 text-xs text-krillion-orange mb-2">
            <Archive className="w-3.5 h-3.5" />
            <span>Trench Expedition Log</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Dive Archive
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Replay or catch up on any past Philippine Trench dive.
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm">Fetching expedition archive records...</p>
          </div>
        ) : dives.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {dives.map((d) => {
              const isCompleted = completedMap[d.dayNumber];
              return (
                <Link
                  key={d.dayNumber}
                  href={`/archive/${d.dayNumber}`}
                  className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-krillion-gold/60 hover:bg-slate-900 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm ${
                        isCompleted
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      #{d.dayNumber}
                    </div>

                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-krillion-gold transition-colors">
                        {d.title}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{d.date}</span>
                        <span>·</span>
                        <span>{d.promptCount} depths</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCompleted && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 text-sm">
            No archive records found.
          </div>
        )}
      </main>

      <footer className="w-full border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <p>Krillion PH · Expedition Log</p>
      </footer>

      <HowToPlayModal
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </div>
  );
}
