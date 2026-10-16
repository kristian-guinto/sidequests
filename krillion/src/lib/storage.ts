import { CompletionStats, TierId, UserAnswerRecord } from './types';

export interface SavedDailyState {
  dayNumber: number;
  date: string;
  completed: boolean;
  score: number;
  answers: UserAnswerRecord[];
  currentIndex?: number;
  stats?: CompletionStats;
  completedAt?: string;
}

export interface UserStats {
  totalDives: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string | null;
  totalScore: number;
  bestScore: number;
  averageScore: number;
}

const STORAGE_KEYS = {
  PLAYER_ID: 'krillion_player_id',
  USER_STATS: 'krillion_user_stats',
  DIVE_PREFIX: 'krillion_dive_',
};

export function getPlayerId(): string {
  if (typeof window === 'undefined') return 'server_player';
  let id = localStorage.getItem(STORAGE_KEYS.PLAYER_ID);
  if (!id) {
    id = 'krillion_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEYS.PLAYER_ID, id);
  }
  return id;
}

export function getSavedDailyState(dayNumber: number, dateStr?: string): SavedDailyState | null {
  if (typeof window === 'undefined') return null;

  // Try date-keyed first if dateStr provided, then dayNumber-keyed
  const rawDate = dateStr ? localStorage.getItem(`${STORAGE_KEYS.DIVE_PREFIX}date_${dateStr}`) : null;
  const rawDay = localStorage.getItem(`${STORAGE_KEYS.DIVE_PREFIX}${dayNumber}`);
  const raw = rawDate || rawDay;
  if (!raw) return null;

  try {
    const parsed: SavedDailyState = JSON.parse(raw);
    // If dateStr was provided, verify it matches
    if (dateStr && parsed.date && parsed.date !== dateStr) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDailyState(state: SavedDailyState): void {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(state);
  localStorage.setItem(
    `${STORAGE_KEYS.DIVE_PREFIX}${state.dayNumber}`,
    serialized
  );
  if (state.date) {
    localStorage.setItem(
      `${STORAGE_KEYS.DIVE_PREFIX}date_${state.date}`,
      serialized
    );
  }
}

export function getUserStats(): UserStats {
  const defaultStats: UserStats = {
    totalDives: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null,
    totalScore: 0,
    bestScore: 0,
    averageScore: 0,
  };

  if (typeof window === 'undefined') return defaultStats;
  const raw = localStorage.getItem(STORAGE_KEYS.USER_STATS);
  if (!raw) return defaultStats;

  try {
    return { ...defaultStats, ...JSON.parse(raw) };
  } catch {
    return defaultStats;
  }
}

export function updateUserStatsOnComplete(
  date: string,
  score: number
): UserStats {
  const stats = getUserStats();

  const isNewDay = stats.lastPlayedDate !== date;
  if (!isNewDay) {
    return stats;
  }

  // Calculate streak continuity
  let newStreak = stats.currentStreak;
  if (stats.lastPlayedDate) {
    const lastDate = new Date(stats.lastPlayedDate);
    const currentDate = new Date(date);
    const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  const totalDives = stats.totalDives + 1;
  const totalScore = stats.totalScore + score;
  const maxStreak = Math.max(stats.maxStreak, newStreak);
  const bestScore = Math.max(stats.bestScore, score);
  const averageScore = Math.round(totalScore / totalDives);

  const updated: UserStats = {
    totalDives,
    currentStreak: newStreak,
    maxStreak,
    lastPlayedDate: date,
    totalScore,
    bestScore,
    averageScore,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify(updated));
  }

  return updated;
}
