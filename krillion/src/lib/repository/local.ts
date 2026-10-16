import { ALL_DIVES, ALL_PROMPTS } from '@/data/prompts';
import { evaluateAnswer } from '../matcher';
import {
  CompletionPayload,
  CompletionStats,
  DailyDive,
  EvaluationResult,
  PromptItem,
} from '../types';
import { GameDataRepository } from './types';

/**
 * Returns current date formatted as YYYY-MM-DD in Philippine Standard Time (Asia/Manila, UTC+8).
 */
export function getManilaDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Local in-memory repository reading from seeded prompt data.
 */
export class LocalRepository implements GameDataRepository {
  private dives: DailyDive[];
  private promptMap: Map<string, PromptItem>;

  constructor(dives: DailyDive[] = ALL_DIVES) {
    this.dives = dives;
    this.promptMap = new Map();
    for (const dive of this.dives) {
      for (const p of dive.prompts) {
        if (!this.promptMap.has(p.id)) {
          this.promptMap.set(p.id, p);
        }
      }
    }
  }

  async getDailyDive(dateStr?: string): Promise<DailyDive> {
    const targetDate = dateStr || getManilaDateString();

    if (this.dives.length === 0) {
      throw new Error('No dives available in repository');
    }

    // 1. Look for direct date match
    const directMatch = this.dives.find((d) => d.date === targetDate);
    if (directMatch) {
      return directMatch;
    }

    // 2. Deterministic day calculation relative to reference epoch (2026-10-01 Manila time)
    const epoch = new Date('2026-10-01T00:00:00+08:00').getTime();
    const target = new Date(`${targetDate}T00:00:00+08:00`).getTime();
    const diffDays = Math.max(
      0,
      Math.floor((target - epoch) / (1000 * 60 * 60 * 24))
    );

    const diveIndex = diffDays % this.dives.length;
    const baseDive = this.dives[diveIndex];

    return {
      ...baseDive,
      dayNumber: diffDays + 1,
      date: targetDate,
    };
  }

  async getDiveByDayNumber(dayNumber: number): Promise<DailyDive | null> {
    const direct = this.dives.find((d) => d.dayNumber === dayNumber);
    if (direct) return direct;

    if (dayNumber > 0 && this.dives.length > 0) {
      const idx = (dayNumber - 1) % this.dives.length;
      const base = this.dives[idx];
      return {
        ...base,
        dayNumber,
      };
    }

    return null;
  }

  async getAllDives(): Promise<DailyDive[]> {
    return this.dives;
  }

  async getUnlimitedPrompts(
    count: number,
    excludeIds: string[] = []
  ): Promise<PromptItem[]> {
    const excludeSet = new Set(excludeIds);
    const available = Array.from(this.promptMap.values()).filter(
      (p) => !excludeSet.has(p.id)
    );

    // Fisher-Yates shuffle
    const shuffled = [...available];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }

  async evaluateSubmission(
    promptId: string,
    rawAnswer: string
  ): Promise<EvaluationResult> {
    const prompt = this.promptMap.get(promptId);
    if (!prompt) {
      return {
        matched: false,
        tier: 'miss',
        score: 0,
        canonicalAnswer: null,
        quip: 'Unknown prompt question! Drifted off-course.',
      };
    }

    return evaluateAnswer(rawAnswer, prompt);
  }

  async recordCompletion(payload: CompletionPayload): Promise<CompletionStats> {
    const promptCount = Math.max(1, payload.promptIds.length);
    const maxPossibleScore = promptCount * 100;
    const scoreFraction = Math.min(
      1,
      Math.max(0, payload.totalScore / maxPossibleScore)
    );

    // Approximate normal CDF of player distribution
    // Mean score ~ 38% of max, standard deviation ~ 18%
    const mean = 0.38;
    const std = 0.18;
    const z = (scoreFraction - mean) / (std * Math.SQRT2);

    // Abramowitz and Stegun erf approximation
    const t = 1 / (1 + 0.3275911 * Math.abs(z));
    const erf =
      1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
        0.284496736) *
        t +
        0.254829592) *
        t *
        Math.exp(-z * z);
    const sign = z >= 0 ? 1 : -1;
    const cdf = 0.5 * (1 + sign * erf);

    let betterThan = Math.round(cdf * 100);
    betterThan = Math.min(99, Math.max(1, betterThan));

    // If score is 0, percentile is lowest
    if (payload.totalScore <= 0) {
      betterThan = 1;
    } else if (payload.totalScore >= maxPossibleScore) {
      betterThan = 99;
    }

    // Realistic player distribution across 5 score bands
    const totalPlayers = 2480 + ((payload.dayNumber || 1) * 73) % 650;
    const distPercentages = [0.14, 0.36, 0.28, 0.16, 0.06]; // Plankton, Schooler, Rare, Deep Cut, Krillion
    const dist = distPercentages.map((pct) => Math.round(pct * totalPlayers));

    return {
      betterThan,
      dist,
      totalPlayers,
    };
  }
}
