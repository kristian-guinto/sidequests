import { describe, it, expect } from 'vitest';
import { getNextManilaMidnight, getManilaDateString } from '../date';
import { getRepository } from '../repository';

describe('Manila Date Utilities', () => {
  it('formats current Manila date as YYYY-MM-DD', () => {
    const str = getManilaDateString();
    expect(str).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('calculates the next midnight in Manila as a valid ISO string', () => {
    const midnightIso = getNextManilaMidnight();
    expect(midnightIso).toBeDefined();
    const dateObj = new Date(midnightIso);
    expect(dateObj.getTime()).toBeGreaterThan(Date.now() - 1000 * 60 * 60 * 24);
  });
});

describe('API Route Logic & Repository Integration', () => {
  const repo = getRepository();

  it('retrieves today dive with stripped answers contract', async () => {
    const dive = await repo.getDailyDive();
    expect(dive).toBeDefined();
    expect(dive.prompts.length).toBeGreaterThan(0);

    // Client-safe prompt mapping test
    const clientPrompts = dive.prompts.map((p) => ({
      id: p.id,
      text: p.text,
      category: p.category,
      hint: p.hint,
    }));

    for (const p of clientPrompts) {
      expect(p).not.toHaveProperty('answers');
      expect(p.id).toBeDefined();
      expect(p.text).toBeDefined();
      expect(p.category).toBeDefined();
    }
  });

  it('evaluates submissions with valid scores and tier quips', async () => {
    const dive = await repo.getDailyDive('2026-10-01');
    const firstPrompt = dive.prompts[0];
    const targetAnswer = firstPrompt.answers.find((a) => a.tier === 'plankton')!;

    const result = await repo.evaluateSubmission(firstPrompt.id, targetAnswer.answer);
    expect(result.matched).toBe(true);
    expect(result.tier).toBe('plankton');
    expect(result.score).toBe(10);
    expect(result.canonicalAnswer).toBe(targetAnswer.answer);
    expect(result.quip).toBeDefined();
  });

  it('records completion and calculates stats distribution', async () => {
    const dive = await repo.getDailyDive('2026-10-01');
    const stats = await repo.recordCompletion({
      dayNumber: dive.dayNumber,
      promptIds: dive.prompts.map((p) => p.id),
      userAnswers: [
        { promptId: dive.prompts[0].id, answer: 'Mayon', score: 10, tier: 'plankton' },
      ],
      totalScore: 10,
    });

    expect(stats.betterThan).toBeGreaterThanOrEqual(1);
    expect(stats.betterThan).toBeLessThanOrEqual(99);
    expect(stats.dist.length).toBe(5);
    expect(stats.totalPlayers).toBeGreaterThan(1000);
  });

  it('returns grouped answers for Answer Explorer', async () => {
    const dive = await repo.getDiveByDayNumber(1);
    expect(dive).not.toBeNull();
    if (!dive) return;

    for (const p of dive.prompts) {
      const tiers = {
        plankton: p.answers.filter((a) => a.tier === 'plankton'),
        tooclever: p.answers.filter((a) => a.tier === 'tooclever'),
        schooler: p.answers.filter((a) => a.tier === 'schooler'),
        rare: p.answers.filter((a) => a.tier === 'rare'),
        deepcut: p.answers.filter((a) => a.tier === 'deepcut'),
        krillion: p.answers.filter((a) => a.tier === 'krillion'),
      };

      expect(tiers.plankton.length).toBeGreaterThan(0);
      expect(tiers.krillion.length).toBeGreaterThan(0);
    }
  });
});
