import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { evaluateAnswer } from '../matcher';
import { getManilaDateString } from './local';
import {
  AnswerEntry,
  CompletionPayload,
  CompletionStats,
  DailyDive,
  EvaluationResult,
  PromptItem,
  SCORE_BANDS,
  TIERS,
} from '../types';
import { LocalRepository } from './local';
import { GameDataRepository } from './types';

export interface DatabaseRepositoryConfig {
  databaseUrl?: string;
}

function formatDbDate(val: any): string {
  if (!val) return getManilaDateString();
  if (typeof val === 'string') {
    return val.split('T')[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return String(val);
}

/**
 * Neon Postgres implementation of GameDataRepository using @neondatabase/serverless.
 *
 * Tables:
 * - krillion_daily_dives (day_number INT PK, dive_date DATE UNIQUE, title TEXT)
 * - krillion_prompts (id TEXT PK, day_number INT FK, round_order INT, prompt_text TEXT, category TEXT, hint TEXT)
 * - krillion_answers (id SERIAL PK, prompt_id TEXT FK, answer TEXT, aliases JSONB, tier TEXT, score INT, quip TEXT)
 * - krillion_completions (id SERIAL PK, dive_date DATE, day_number INT, player_id TEXT, score INT, answers JSONB, UNIQUE(dive_date, player_id))
 * - krillion_submissions_log (id SERIAL PK, prompt_id TEXT, raw_answer TEXT, matched BOOLEAN, canonical_answer TEXT, tier TEXT, score INT, created_at TIMESTAMPTZ)
 */
export class DatabaseRepository implements GameDataRepository {
  private fallback: LocalRepository;
  private sql: NeonQueryFunction<false, false> | null = null;
  private isConnected: boolean = false;

  constructor(config?: DatabaseRepositoryConfig) {
    this.fallback = new LocalRepository();
    const connStr = config?.databaseUrl || process.env.DATABASE_URL;

    if (connStr) {
      try {
        this.sql = neon(connStr);
        this.isConnected = true;
      } catch (err) {
        console.warn('Failed to initialize Neon SQL client, falling back to local:', err);
        this.isConnected = false;
      }
    }
  }

  async getDailyDive(dateStr?: string): Promise<DailyDive> {
    if (!this.isConnected || !this.sql) {
      return this.fallback.getDailyDive(dateStr);
    }

    try {
      const targetDate = dateStr || getManilaDateString();

      // 1. Direct date query
      const diveRows = await this.sql`
        SELECT day_number, dive_date, title
        FROM krillion_daily_dives
        WHERE dive_date = ${targetDate}::date
        LIMIT 1;
      `;

      let dayNumber: number;
      let title: string;
      let finalDateStr = targetDate;
      let queryDayNumber: number;

      if (diveRows && diveRows.length > 0) {
        dayNumber = diveRows[0].day_number;
        queryDayNumber = dayNumber;
        title = diveRows[0].title;
        finalDateStr = formatDbDate(diveRows[0].dive_date);
      } else {
        // 2. Beyond range rotation: rotate across available day numbers
        const allDays = await this.sql`
          SELECT day_number, dive_date, title
          FROM krillion_daily_dives
          ORDER BY day_number ASC;
        `;

        if (!allDays || allDays.length === 0) {
          return this.fallback.getDailyDive(dateStr);
        }

        const epoch = new Date('2026-10-01T00:00:00+08:00').getTime();
        const target = new Date(`${targetDate}T00:00:00+08:00`).getTime();
        const diffDays = Math.max(0, Math.floor((target - epoch) / (1000 * 60 * 60 * 24)));
        const idx = diffDays % allDays.length;

        queryDayNumber = allDays[idx].day_number;
        dayNumber = diffDays + 1;
        title = allDays[idx].title;
      }

      // 3. Query prompts for this day_number
      const promptRows = await this.sql`
        SELECT id, day_number, round_order, prompt_text, category, hint
        FROM krillion_prompts
        WHERE day_number = ${queryDayNumber}
        ORDER BY round_order ASC;
      `;

      if (!promptRows || promptRows.length === 0) {
        return this.fallback.getDailyDive(dateStr);
      }

      // 4. Query answers for these prompt IDs
      const promptIds = promptRows.map((r: any) => r.id);
      const answerRows = await this.sql`
        SELECT prompt_id, answer, aliases, tier, score, quip
        FROM krillion_answers
        WHERE prompt_id = ANY(${promptIds});
      `;

      // Group answers by prompt_id
      const answersMap = new Map<string, AnswerEntry[]>();
      for (const ans of answerRows) {
        if (!answersMap.has(ans.prompt_id)) {
          answersMap.set(ans.prompt_id, []);
        }
        answersMap.get(ans.prompt_id)!.push({
          answer: ans.answer,
          aliases: Array.isArray(ans.aliases) ? ans.aliases : [],
          tier: ans.tier as any,
          quip: ans.quip || undefined,
        });
      }

      const prompts: PromptItem[] = promptRows.map((r: any) => ({
        id: r.id,
        text: r.prompt_text,
        category: r.category as any,
        hint: r.hint || undefined,
        answers: answersMap.get(r.id) || [],
      }));

      return {
        dayNumber,
        date: finalDateStr,
        title,
        prompts,
      };
    } catch (err) {
      console.warn('Neon query error in getDailyDive, falling back to local:', err);
      return this.fallback.getDailyDive(dateStr);
    }
  }

  async getDiveByDayNumber(dayNumber: number): Promise<DailyDive | null> {
    if (!this.isConnected || !this.sql) {
      return this.fallback.getDiveByDayNumber(dayNumber);
    }

    try {
      const diveRows = await this.sql`
        SELECT day_number, dive_date, title
        FROM krillion_daily_dives
        WHERE day_number = ${dayNumber}
        LIMIT 1;
      `;

      let targetRow: any;
      let effectiveDayNumber = dayNumber;

      if (diveRows && diveRows.length > 0) {
        targetRow = diveRows[0];
      } else {
        // Rotate if dayNumber is beyond range
        const allDays = await this.sql`
          SELECT day_number, dive_date, title
          FROM krillion_daily_dives
          ORDER BY day_number ASC;
        `;
        if (!allDays || allDays.length === 0) return null;
        const idx = (dayNumber - 1) % allDays.length;
        targetRow = allDays[idx];
      }

      const promptRows = await this.sql`
        SELECT id, day_number, round_order, prompt_text, category, hint
        FROM krillion_prompts
        WHERE day_number = ${targetRow.day_number}
        ORDER BY round_order ASC;
      `;

      if (!promptRows || promptRows.length === 0) return null;

      const promptIds = promptRows.map((r: any) => r.id);
      const answerRows = await this.sql`
        SELECT prompt_id, answer, aliases, tier, score, quip
        FROM krillion_answers
        WHERE prompt_id = ANY(${promptIds});
      `;

      const answersMap = new Map<string, AnswerEntry[]>();
      for (const ans of answerRows) {
        if (!answersMap.has(ans.prompt_id)) {
          answersMap.set(ans.prompt_id, []);
        }
        answersMap.get(ans.prompt_id)!.push({
          answer: ans.answer,
          aliases: Array.isArray(ans.aliases) ? ans.aliases : [],
          tier: ans.tier as any,
          quip: ans.quip || undefined,
        });
      }

      const prompts: PromptItem[] = promptRows.map((r: any) => ({
        id: r.id,
        text: r.prompt_text,
        category: r.category as any,
        hint: r.hint || undefined,
        answers: answersMap.get(r.id) || [],
      }));

      return {
        dayNumber: effectiveDayNumber,
        date: formatDbDate(targetRow.dive_date),
        title: targetRow.title,
        prompts,
      };
    } catch (err) {
      console.warn('Neon query error in getDiveByDayNumber, falling back to local:', err);
      return this.fallback.getDiveByDayNumber(dayNumber);
    }
  }

  async getAllDives(): Promise<DailyDive[]> {
    if (!this.isConnected || !this.sql) {
      return this.fallback.getAllDives();
    }

    try {
      const [diveRows, promptRows, answerRows] = await Promise.all([
        this.sql`SELECT day_number, dive_date, title FROM krillion_daily_dives ORDER BY day_number ASC;`,
        this.sql`SELECT id, day_number, round_order, prompt_text, category, hint FROM krillion_prompts ORDER BY day_number ASC, round_order ASC;`,
        this.sql`SELECT prompt_id, answer, aliases, tier, score, quip FROM krillion_answers;`,
      ]);

      const answersMap = new Map<string, AnswerEntry[]>();
      for (const ans of answerRows) {
        if (!answersMap.has(ans.prompt_id)) {
          answersMap.set(ans.prompt_id, []);
        }
        answersMap.get(ans.prompt_id)!.push({
          answer: ans.answer,
          aliases: Array.isArray(ans.aliases) ? ans.aliases : [],
          tier: ans.tier as any,
          quip: ans.quip || undefined,
        });
      }

      const promptsByDay = new Map<number, PromptItem[]>();
      for (const pr of promptRows) {
        if (!promptsByDay.has(pr.day_number)) {
          promptsByDay.set(pr.day_number, []);
        }
        promptsByDay.get(pr.day_number)!.push({
          id: pr.id,
          text: pr.prompt_text,
          category: pr.category as any,
          hint: pr.hint || undefined,
          answers: answersMap.get(pr.id) || [],
        });
      }

      return diveRows.map((d: any) => ({
        dayNumber: d.day_number,
        date: formatDbDate(d.dive_date),
        title: d.title,
        prompts: promptsByDay.get(d.day_number) || [],
      }));
    } catch (err) {
      console.warn('Neon query error in getAllDives, falling back to local:', err);
      return this.fallback.getAllDives();
    }
  }

  async getUnlimitedPrompts(
    count: number,
    excludeIds: string[] = []
  ): Promise<PromptItem[]> {
    if (!this.isConnected || !this.sql) {
      return this.fallback.getUnlimitedPrompts(count, excludeIds);
    }

    try {
      let promptRows: any[];
      if (excludeIds.length > 0) {
        promptRows = await this.sql`
          SELECT id, day_number, round_order, prompt_text, category, hint
          FROM krillion_prompts
          WHERE NOT (id = ANY(${excludeIds}))
          ORDER BY RANDOM()
          LIMIT ${count};
        `;
      } else {
        promptRows = await this.sql`
          SELECT id, day_number, round_order, prompt_text, category, hint
          FROM krillion_prompts
          ORDER BY RANDOM()
          LIMIT ${count};
        `;
      }

      if (!promptRows || promptRows.length === 0) {
        return this.fallback.getUnlimitedPrompts(count, excludeIds);
      }

      const promptIds = promptRows.map((r: any) => r.id);
      const answerRows = await this.sql`
        SELECT prompt_id, answer, aliases, tier, score, quip
        FROM krillion_answers
        WHERE prompt_id = ANY(${promptIds});
      `;

      const answersMap = new Map<string, AnswerEntry[]>();
      for (const ans of answerRows) {
        if (!answersMap.has(ans.prompt_id)) {
          answersMap.set(ans.prompt_id, []);
        }
        answersMap.get(ans.prompt_id)!.push({
          answer: ans.answer,
          aliases: Array.isArray(ans.aliases) ? ans.aliases : [],
          tier: ans.tier as any,
          quip: ans.quip || undefined,
        });
      }

      return promptRows.map((r: any) => ({
        id: r.id,
        text: r.prompt_text,
        category: r.category as any,
        hint: r.hint || undefined,
        answers: answersMap.get(r.id) || [],
      }));
    } catch (err) {
      console.warn('Neon query error in getUnlimitedPrompts, falling back to local:', err);
      return this.fallback.getUnlimitedPrompts(count, excludeIds);
    }
  }

  async evaluateSubmission(
    promptId: string,
    rawAnswer: string
  ): Promise<EvaluationResult> {
    if (!this.isConnected || !this.sql) {
      return this.fallback.evaluateSubmission(promptId, rawAnswer);
    }

    try {
      const [promptRows, answerRows] = await Promise.all([
        this.sql`
          SELECT id, day_number, round_order, prompt_text, category, hint
          FROM krillion_prompts
          WHERE id = ${promptId}
          LIMIT 1;
        `,
        this.sql`
          SELECT prompt_id, answer, aliases, tier, score, quip
          FROM krillion_answers
          WHERE prompt_id = ${promptId};
        `,
      ]);

      if (!promptRows || promptRows.length === 0) {
        return {
          matched: false,
          tier: 'miss',
          score: 0,
          canonicalAnswer: null,
          quip: 'Unknown prompt question! Drifted off-course.',
        };
      }

      const prompt: PromptItem = {
        id: promptRows[0].id,
        text: promptRows[0].prompt_text,
        category: promptRows[0].category as any,
        hint: promptRows[0].hint || undefined,
        answers: answerRows.map((a: any) => ({
          answer: a.answer,
          aliases: Array.isArray(a.aliases) ? a.aliases : [],
          tier: a.tier as any,
          quip: a.quip || undefined,
        })),
      };

      const result = evaluateAnswer(rawAnswer, prompt);

      // Asynchronously / non-blockingly log submission into krillion_submissions_log
      this.logSubmissionAsync(promptId, rawAnswer, result);

      return result;
    } catch (err) {
      console.warn('Neon query error in evaluateSubmission, falling back to local:', err);
      return this.fallback.evaluateSubmission(promptId, rawAnswer);
    }
  }

  private logSubmissionAsync(
    promptId: string,
    rawAnswer: string,
    result: EvaluationResult
  ): void {
    if (!this.sql) return;
    this.sql`
      INSERT INTO krillion_submissions_log (prompt_id, raw_answer, matched, canonical_answer, tier, score, created_at)
      VALUES (
        ${promptId},
        ${rawAnswer},
        ${result.matched},
        ${result.canonicalAnswer || null},
        ${result.tier},
        ${result.score},
        NOW()
      );
    `.catch((err) => {
      // Non-blocking catch
      console.warn('Async submission logging error:', err?.message);
    });
  }

  async recordCompletion(payload: CompletionPayload): Promise<CompletionStats> {
    if (!this.isConnected || !this.sql) {
      return this.fallback.recordCompletion(payload);
    }

    try {
      const dayNumber = payload.dayNumber || 1;
      const diveDate = payload.completedAt ? formatDbDate(payload.completedAt) : getManilaDateString();
      const playerId = (payload as any).playerId || `user_${Date.now()}`;

      // 1. Upsert into krillion_completions
      await this.sql`
        INSERT INTO krillion_completions (dive_date, day_number, player_id, score, answers, created_at)
        VALUES (
          ${diveDate}::date,
          ${dayNumber},
          ${playerId},
          ${payload.totalScore},
          ${JSON.stringify(payload.userAnswers)},
          NOW()
        )
        ON CONFLICT (dive_date, player_id) DO UPDATE
        SET score = EXCLUDED.score,
            answers = EXCLUDED.answers;
      `;

      // 2. Query all completions for this day_number or dive_date
      const completionRows = await this.sql`
        SELECT score
        FROM krillion_completions
        WHERE day_number = ${dayNumber} OR dive_date = ${diveDate}::date;
      `;

      if (completionRows && completionRows.length >= 5) {
        const scores = completionRows.map((r: any) => Number(r.score));
        const totalCount = scores.length;

        // Calculate percentile
        let lessThanCount = 0;
        let tieCount = 0;
        for (const s of scores) {
          if (s < payload.totalScore) lessThanCount++;
          else if (s === payload.totalScore) tieCount++;
        }

        let betterThan = Math.round(((lessThanCount + 0.5 * tieCount) / totalCount) * 100);
        betterThan = Math.min(99, Math.max(1, betterThan));
        if (payload.totalScore <= 0) betterThan = 1;

        // Calculate 5-bin distribution according to SCORE_BANDS
        const dist = [0, 0, 0, 0, 0];
        for (const s of scores) {
          for (let b = 0; b < SCORE_BANDS.length; b++) {
            if (s >= SCORE_BANDS[b].min && s <= SCORE_BANDS[b].max) {
              dist[b]++;
              break;
            }
          }
        }

        // Live player count blended with realistic baseline multiplier
        const totalPlayers = totalCount > 200 ? totalCount : 2480 + totalCount * 12;

        return {
          betterThan,
          dist,
          totalPlayers,
        };
      }

      return this.fallback.recordCompletion(payload);
    } catch (err) {
      console.warn('Neon query error in recordCompletion, falling back to local:', err);
      return this.fallback.recordCompletion(payload);
    }
  }
}
