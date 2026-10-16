import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getSavedDailyState, saveDailyState, SavedDailyState } from '../storage';

describe('Strict Daily Dive Only Enforcements', () => {
  const headerPath = path.resolve(__dirname, '../../components/Header.tsx');
  const resultsModalPath = path.resolve(__dirname, '../../components/game/ResultsModal.tsx');
  const nextConfigPath = path.resolve(__dirname, '../../../next.config.mjs');
  const answersRoutePath = path.resolve(__dirname, '../../app/api/dive/[dayNumber]/answers/route.ts');

  it('ensures Header does not contain Archive or Unlimited navigation links', () => {
    const code = fs.readFileSync(headerPath, 'utf8');
    expect(code).not.toContain('/archive');
    expect(code).not.toContain('/unlimited');
    expect(code).not.toContain('ARCHIVE');
    expect(code).not.toContain('UNLIMITED');
  });

  it('ensures ResultsModal contains Next Dive Countdown and no Dive Again / Replay button', () => {
    const code = fs.readFileSync(resultsModalPath, 'utf8');
    expect(code).not.toContain('DIVE AGAIN');
    expect(code).not.toContain('REPLAY');
    expect(code).not.toContain('isUnlimited');
    expect(code).toContain('NEXT TRENCH EXPEDITION');
    expect(code).toContain('getNextManilaMidnight');
  });

  it('ensures next.config.mjs redirects /archive and /unlimited to /', () => {
    const code = fs.readFileSync(nextConfigPath, 'utf8');
    expect(code).toContain('/archive/:path*');
    expect(code).toContain('/unlimited');
  });

  it('ensures answers route restricts access to today active dive', () => {
    const code = fs.readFileSync(answersRoutePath, 'utf8');
    expect(code).toContain('todayDive');
    expect(code).toContain('dayNumber !== todayDive.dayNumber');
  });

  it('verifies in-progress and completed storage persistence', () => {
    // Mock localStorage
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    };
    (global as any).window = { localStorage: mockStorage };
    (global as any).localStorage = mockStorage;

    const inProgressState: SavedDailyState = {
      dayNumber: 1,
      date: '2026-10-16',
      completed: false,
      score: 110,
      currentIndex: 2,
      answers: [
        { promptId: 'p-1', answer: 'Answer 1', score: 10, tier: 'plankton' },
        { promptId: 'p-2', answer: 'Answer 2', score: 100, tier: 'krillion' },
      ],
    };

    saveDailyState(inProgressState);

    const loaded = getSavedDailyState(1, '2026-10-16');
    expect(loaded).not.toBeNull();
    expect(loaded?.completed).toBe(false);
    expect(loaded?.currentIndex).toBe(2);
    expect(loaded?.answers.length).toBe(2);
    expect(loaded?.score).toBe(110);

    // Save as completed
    const completedState: SavedDailyState = {
      ...inProgressState,
      completed: true,
      stats: { betterThan: 90, dist: [5, 10, 20, 30, 35], totalPlayers: 2500 },
    };
    saveDailyState(completedState);

    const reloaded = getSavedDailyState(1, '2026-10-16');
    expect(reloaded?.completed).toBe(true);
    expect(reloaded?.stats?.betterThan).toBe(90);
  });
});
