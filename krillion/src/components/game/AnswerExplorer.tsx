'use client';

import React, { useState } from 'react';
import { GroupedAnswersPrompt, TIERS, TierId } from '@/lib/types';
import { Search, ChevronDown, ChevronUp, Sparkles, Gem } from 'lucide-react';

interface AnswerExplorerProps {
  prompts: GroupedAnswersPrompt[];
}

export function AnswerExplorer({ prompts }: AnswerExplorerProps) {
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<TierId | 'all'>('all');

  const activePrompt = prompts[selectedPromptIndex];
  if (!activePrompt) return null;

  const tierKeys: Array<Exclude<TierId, 'miss'>> = [
    'krillion',
    'deepcut',
    'rare',
    'schooler',
    'tooclever',
    'plankton',
  ];

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-krillion-gold" />
        <h3 className="text-lg font-black text-white tracking-tight">
          Answer Explorer
        </h3>
        <span className="text-xs text-slate-400 ml-auto">
          Explore all accepted pulls &amp; gems
        </span>
      </div>

      {/* Prompt selector tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none">
        {prompts.map((p, idx) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedPromptIndex(idx);
              setSearchTerm('');
            }}
            className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all select-none touch-manipulation flex items-center justify-center ${
              idx === selectedPromptIndex
                ? 'bg-krillion-gold text-slate-950 shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80'
            }`}
          >
            Depth #{idx + 1}
          </button>
        ))}
      </div>

      {/* Active prompt question title */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-krillion-cyan mb-1">
          Depth {selectedPromptIndex + 1} of {prompts.length} · {activePrompt.category === 'filipino' ? '🇵🇭 Pinoy Culture' : '🌐 Universal'}
        </div>
        <div className="text-sm sm:text-base font-bold text-white">
          {activePrompt.text}
        </div>
      </div>

      {/* Search and Tier filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search accepted answers or aliases..."
            className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-krillion-cyan touch-manipulation"
          />
        </div>

        <select
          value={selectedTierFilter}
          onChange={(e) => setSelectedTierFilter(e.target.value as any)}
          aria-label="Filter answers by rarity tier"
          className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-krillion-cyan touch-manipulation"
        >
          <option value="all">All Tiers ({activePrompt.totalAnswersCount})</option>
          <option value="krillion">🌟 One in a Krillion ({activePrompt.tiers.krillion.length})</option>
          <option value="deepcut">🏮 Deep Cut ({activePrompt.tiers.deepcut.length})</option>
          <option value="rare">🦑 Rare ({activePrompt.tiers.rare.length})</option>
          <option value="schooler">🐟 Schooler ({activePrompt.tiers.schooler.length})</option>
          <option value="tooclever">🤡 Too Clever ({activePrompt.tiers.tooclever.length})</option>
          <option value="plankton">🫧 Plankton ({activePrompt.tiers.plankton.length})</option>
        </select>
      </div>

      {/* Answers grouped by Tier */}
      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {tierKeys.map((tierKey) => {
          if (selectedTierFilter !== 'all' && selectedTierFilter !== tierKey) {
            return null;
          }

          const tierInfo = TIERS[tierKey];
          const entries = activePrompt.tiers[tierKey] || [];
          const filtered = entries.filter((e) => {
            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase();
            const matchesAnswer = e.answer.toLowerCase().includes(term);
            const matchesAlias = (e.aliases || []).some((a) => a.toLowerCase().includes(term));
            const matchesQuip = e.quip?.toLowerCase().includes(term);
            return matchesAnswer || matchesAlias || matchesQuip;
          });

          if (filtered.length === 0) return null;

          const isKrillionGem = tierKey === 'krillion';

          return (
            <div
              key={tierKey}
              className={`rounded-xl border p-4 transition-all ${
                isKrillionGem
                  ? 'bg-amber-950/20 border-krillion-gold/40 shadow-[0_0_15px_rgba(255,209,102,0.1)]'
                  : 'bg-slate-950/40 border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{tierInfo.emoji}</span>
                  <span className="text-sm font-bold text-white">{tierInfo.name}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: tierInfo.color }}>
                    +{tierInfo.score} pts
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {filtered.length} {filtered.length === 1 ? 'answer' : 'answers'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filtered.map((item, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-bold text-slate-100">{item.answer}</span>
                      {isKrillionGem && <Gem className="w-3.5 h-3.5 text-krillion-gold flex-shrink-0" />}
                    </div>

                    {item.aliases && item.aliases.length > 0 && (
                      <div className="text-[10px] text-slate-400 line-clamp-1 mb-1">
                        aliases: {item.aliases.join(', ')}
                      </div>
                    )}

                    {item.quip && (
                      <div className="text-[11px] text-slate-300 italic">
                        &ldquo;{item.quip}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
