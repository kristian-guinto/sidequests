import {
  CompletionPayload,
  CompletionStats,
  DailyDive,
  EvaluationResult,
  PromptItem,
} from '../types';

export interface GameDataRepository {
  /**
   * Returns the daily dive for a given date in Asia/Manila (YYYY-MM-DD).
   * If omitted, defaults to the current day in Asia/Manila.
   * If the date is beyond the seeded range, rotates deterministically.
   */
  getDailyDive(dateStr?: string): Promise<DailyDive>;

  /**
   * Retrieves a dive by dayNumber (1-indexed).
   */
  getDiveByDayNumber(dayNumber: number): Promise<DailyDive | null>;

  /**
   * Retrieves all loaded dives.
   */
  getAllDives(): Promise<DailyDive[]>;

  /**
   * Retrieves N random prompts for the Unlimited mode, excluding any given prompt IDs.
   */
  getUnlimitedPrompts(count: number, excludeIds?: string[]): Promise<PromptItem[]>;

  /**
   * Evaluates a user answer submission against a specific prompt.
   */
  evaluateSubmission(promptId: string, rawAnswer: string): Promise<EvaluationResult>;

  /**
   * Records a user game completion and computes/returns aggregate percentile and distribution stats.
   */
  recordCompletion(payload: CompletionPayload): Promise<CompletionStats>;
}
