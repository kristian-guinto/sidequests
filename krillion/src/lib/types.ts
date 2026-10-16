export type TierId =
  | 'plankton'
  | 'tooclever'
  | 'schooler'
  | 'rare'
  | 'deepcut'
  | 'krillion'
  | 'miss';

export interface TierInfo {
  id: Exclude<TierId, 'miss'>;
  score: number;
  emoji: string;
  name: string;
  depth: number;
  blurb: string;
  color: string;
}

export const TIERS: Record<Exclude<TierId, 'miss'>, TierInfo> = {
  plankton: {
    id: 'plankton',
    score: 10,
    emoji: '🫧',
    name: 'Plankton',
    depth: 0.08,
    blurb: 'The answer everyone blurts out first.',
    color: '#8fa3c4',
  },
  tooclever: {
    id: 'tooclever',
    score: 15,
    emoji: '🤡',
    name: 'Too Clever',
    depth: 0.18,
    blurb: 'A famously "obscure" pick. Everyone reaches for it.',
    color: '#ff9f43',
  },
  schooler: {
    id: 'schooler',
    score: 30,
    emoji: '🐟',
    name: 'Schooler',
    depth: 0.36,
    blurb: 'Solid — swims with the school.',
    color: '#4de3ff',
  },
  rare: {
    id: 'rare',
    score: 60,
    emoji: '🦑',
    name: 'Rare',
    depth: 0.60,
    blurb: 'Genuinely uncommon. Nice pull.',
    color: '#ff5252',
  },
  deepcut: {
    id: 'deepcut',
    score: 85,
    emoji: '🏮',
    name: 'Deep Cut',
    depth: 0.82,
    blurb: 'True obscurity. Few go this deep into the Philippine Trench.',
    color: '#9d7bff',
  },
  krillion: {
    id: 'krillion',
    score: 100,
    emoji: '🌟',
    name: 'One in a Krillion',
    depth: 0.97,
    blurb: 'The designated gem. Emden Deep floor.',
    color: '#ffd166',
  },
};

export interface ScoreBand {
  min: number;
  max: number;
  name: string;
  emoji: string;
  description: string;
}

export const SCORE_BANDS: ScoreBand[] = [
  {
    min: 0,
    max: 150,
    name: 'Plankton',
    emoji: '🫧',
    description: 'Drifting on the surface. Easy answers, light depths.',
  },
  {
    min: 151,
    max: 250,
    name: 'Schooler',
    emoji: '🐟',
    description: 'Comfortable mid-waters. You swim with the pack.',
  },
  {
    min: 251,
    max: 350,
    name: 'Rare',
    emoji: '🦑',
    description: 'Venturing into the twilight zone. Impressive niche pulls.',
  },
  {
    min: 351,
    max: 449,
    name: 'Deep Cut',
    emoji: '🏮',
    description: 'Abyssal master. Obscurity is your native habitat.',
  },
  {
    min: 450,
    max: 700,
    name: 'One in a Krillion',
    emoji: '🌟',
    description: 'Emden Deep conqueror. Maximum Philippine Trench flex.',
  },
];

export function getScoreBand(score: number): ScoreBand {
  const band = SCORE_BANDS.find((b) => score >= b.min && score <= b.max);
  if (band) return band;
  if (score > 700) return SCORE_BANDS[SCORE_BANDS.length - 1];
  return SCORE_BANDS[0];
}

export interface AnswerEntry {
  answer: string;
  aliases?: string[];
  tier: Exclude<TierId, 'miss'>;
  quip?: string;
}

export interface PromptItem {
  id: string;
  text: string;
  category: 'filipino' | 'universal';
  hint?: string;
  answers: AnswerEntry[];
}

export interface DailyDive {
  dayNumber: number;
  date: string; // YYYY-MM-DD in Asia/Manila (PHT)
  title?: string;
  prompts: PromptItem[];
}

export interface EvaluationResult {
  matched: boolean;
  entry?: AnswerEntry;
  tier: TierId;
  score: number;
  canonicalAnswer: string | null;
  quip: string;
}

export interface UserAnswerRecord {
  promptId: string;
  answer: string;
  score: number;
  tier: TierId;
  canonicalAnswer?: string | null;
}

export interface CompletionPayload {
  dayNumber?: number;
  promptIds: string[];
  userAnswers: UserAnswerRecord[];
  totalScore: number;
  completedAt?: string;
}

export interface CompletionStats {
  betterThan: number; // percentile 0 - 100
  dist: number[]; // distribution across score bands or buckets
  totalPlayers: number;
}

export interface ClientPromptItem {
  id: string;
  text: string;
  category: 'filipino' | 'universal';
  hint?: string;
}

export interface TierGroupedAnswers {
  plankton: AnswerEntry[];
  tooclever: AnswerEntry[];
  schooler: AnswerEntry[];
  rare: AnswerEntry[];
  deepcut: AnswerEntry[];
  krillion: AnswerEntry[];
}

export interface GroupedAnswersPrompt {
  id: string;
  text: string;
  category: 'filipino' | 'universal';
  hint?: string;
  tiers: TierGroupedAnswers;
  totalAnswersCount: number;
}

