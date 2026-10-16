import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LocalRepository,
  getManilaDateString,
} from '../repository/local';
import { DatabaseRepository } from '../repository/database';
import { getRepository } from '../repository';
import { DailyDive } from '../types';

describe('LocalRepository', () => {
  const customDives: DailyDive[] = [
    {
      dayNumber: 1,
      date: '2026-10-01',
      title: 'Day 1 Dive',
      prompts: [
        {
          id: 'prompt-1',
          text: 'Name a Philippine fruit',
          category: 'filipino',
          answers: [
            { answer: 'Mango', aliases: ['Mangga'], tier: 'plankton' },
            { answer: 'Durian', tier: 'schooler' },
            { answer: 'Lansones', tier: 'rare' },
            { answer: 'Marang', tier: 'deepcut' },
            { answer: 'Pangi', tier: 'krillion' },
          ],
        },
      ],
    },
    {
      dayNumber: 2,
      date: '2026-10-02',
      title: 'Day 2 Dive',
      prompts: [
        {
          id: 'prompt-2',
          text: 'Name a Philippine island',
          category: 'filipino',
          answers: [
            { answer: 'Luzon', tier: 'plankton' },
            { answer: 'Mindanao', tier: 'schooler' },
            { answer: 'Batanes', tier: 'rare' },
            { answer: 'Calayan', tier: 'deepcut' },
            { answer: 'Maniwaya', tier: 'krillion' },
          ],
        },
      ],
    },
  ];

  let repo: LocalRepository;

  beforeEach(() => {
    repo = new LocalRepository(customDives);
  });

  it('formats Manila date string correctly', () => {
    const d = new Date('2026-10-16T12:00:00Z');
    const manilaDate = getManilaDateString(d);
    // UTC 12:00 + 8h = 20:00 (still same date 2026-10-16)
    expect(manilaDate).toBe('2026-10-16');
  });

  it('retrieves exact dive by date', async () => {
    const dive = await repo.getDailyDive('2026-10-01');
    expect(dive).toBeDefined();
    expect(dive.dayNumber).toBe(1);
    expect(dive.title).toBe('Day 1 Dive');
    expect(dive.prompts.length).toBe(1);
  });

  it('smoothly wraps and generates deterministic dive for dates beyond range', async () => {
    const futureDive = await repo.getDailyDive('2026-10-16');
    expect(futureDive).toBeDefined();
    expect(futureDive.date).toBe('2026-10-16');
    expect(futureDive.prompts.length).toBeGreaterThan(0);
    expect(futureDive.dayNumber).toBeGreaterThan(0);
  });

  it('retrieves dive by dayNumber', async () => {
    const dive1 = await repo.getDiveByDayNumber(1);
    expect(dive1).not.toBeNull();
    expect(dive1?.title).toBe('Day 1 Dive');

    const dive2 = await repo.getDiveByDayNumber(2);
    expect(dive2).not.toBeNull();
    expect(dive2?.title).toBe('Day 2 Dive');
  });

  it('retrieves all dives', async () => {
    const all = await repo.getAllDives();
    expect(all.length).toBe(2);
  });

  it('retrieves unlimited prompts excluding specified IDs', async () => {
    const unlimited = await repo.getUnlimitedPrompts(1, ['prompt-1']);
    expect(unlimited.length).toBe(1);
    expect(unlimited[0].id).toBe('prompt-2');
  });

  it('evaluates submission accurately against indexed prompts', async () => {
    const res = await repo.evaluateSubmission('prompt-1', 'mangga');
    expect(res.matched).toBe(true);
    expect(res.canonicalAnswer).toBe('Mango');
    expect(res.tier).toBe('plankton');
    expect(res.score).toBe(10);
  });

  it('returns miss for non-existent prompt ID', async () => {
    const res = await repo.evaluateSubmission('invalid-prompt', 'mangga');
    expect(res.matched).toBe(false);
    expect(res.tier).toBe('miss');
    expect(res.score).toBe(0);
  });

  it('computes completion stats with realistic distribution curve', async () => {
    // High score (all krillion)
    const highScoreStats = await repo.recordCompletion({
      dayNumber: 1,
      promptIds: ['prompt-1'],
      userAnswers: [{ promptId: 'prompt-1', answer: 'pangi', score: 100, tier: 'krillion' }],
      totalScore: 100,
    });

    expect(highScoreStats.betterThan).toBeGreaterThanOrEqual(95);
    expect(highScoreStats.totalPlayers).toBeGreaterThan(2000);
    expect(highScoreStats.dist.length).toBe(5);

    // Low score (miss)
    const lowScoreStats = await repo.recordCompletion({
      dayNumber: 1,
      promptIds: ['prompt-1'],
      userAnswers: [{ promptId: 'prompt-1', answer: 'nothing', score: 0, tier: 'miss' }],
      totalScore: 0,
    });

    expect(lowScoreStats.betterThan).toBeLessThanOrEqual(10);
  });
});

describe('DatabaseRepository & Factory', () => {
  const originalEnv = process.env.KRILLION_STORAGE_DRIVER;

  afterEach(() => {
    process.env.KRILLION_STORAGE_DRIVER = originalEnv;
  });

  it('instantiates DatabaseRepository and safely falls back without credentials', async () => {
    const dbRepo = new DatabaseRepository();
    const dive = await dbRepo.getDailyDive('2026-10-01');
    expect(dive).toBeDefined();
    expect(dive.prompts.length).toBeGreaterThan(0);
  });

  it('factory instantiates repository based on environment variable', () => {
    process.env.KRILLION_STORAGE_DRIVER = 'local';
    const localRepo = getRepository();
    expect(localRepo).toBeInstanceOf(LocalRepository);

    process.env.KRILLION_STORAGE_DRIVER = 'neon';
    const neonRepo = getRepository();
    expect(neonRepo).toBeInstanceOf(DatabaseRepository);
  });
});
