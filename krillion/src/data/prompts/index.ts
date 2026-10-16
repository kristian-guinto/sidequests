import { DailyDive, PromptItem } from '@/lib/types';
import { daysPart1 } from './daysPart1';
import { daysPart2 } from './daysPart2';
import { sampleDives } from './sample';

/**
 * Combined list of all daily dives.
 * Seamlessly merges partitions (daysPart1, daysPart2) and falls back to sampleDives
 * for any unpopulated partition.
 */
export const ALL_DIVES: DailyDive[] = (() => {
  const p1 = daysPart1 && daysPart1.length > 0 ? daysPart1 : sampleDives.slice(0, 7);
  const p2 = daysPart2 && daysPart2.length > 0 ? daysPart2 : sampleDives.slice(7);
  const combined = [...p1, ...p2];

  // Sort by dayNumber ascending
  combined.sort((a, b) => a.dayNumber - b.dayNumber);
  return combined;
})();

/**
 * Flattened list of all unique prompt items across all dives.
 */
export const ALL_PROMPTS: PromptItem[] = (() => {
  const map = new Map<string, PromptItem>();
  for (const dive of ALL_DIVES) {
    for (const prompt of dive.prompts) {
      if (!map.has(prompt.id)) {
        map.set(prompt.id, prompt);
      }
    }
  }
  return Array.from(map.values());
})();
