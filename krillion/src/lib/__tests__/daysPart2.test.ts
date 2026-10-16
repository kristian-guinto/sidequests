import { describe, it, expect } from 'vitest';
import { DAYS_PART_2 } from '@/data/prompts/daysPart2';
import { TierId } from '@/lib/types';

describe('DAYS_PART_2 Seed Dataset Verification', () => {
  it('contains exactly 7 days (Days 8 through 14)', () => {
    expect(DAYS_PART_2).toHaveLength(7);
    const dayNumbers = DAYS_PART_2.map((d) => d.dayNumber);
    expect(dayNumbers).toEqual([8, 9, 10, 11, 12, 13, 14]);
  });

  it('has correct dates from 2026-10-23 to 2026-10-29', () => {
    const dates = DAYS_PART_2.map((d) => d.date);
    expect(dates).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
    ]);
  });

  it('contains exactly 7 prompts per day (49 prompts total)', () => {
    let totalPrompts = 0;
    for (const day of DAYS_PART_2) {
      expect(day.prompts).toHaveLength(7);
      totalPrompts += day.prompts.length;
    }
    expect(totalPrompts).toBe(49);
  });

  it('maintains a 50/50 balance of Filipino and Universal prompts', () => {
    for (const day of DAYS_PART_2) {
      const filipino = day.prompts.filter((p) => p.category === 'filipino');
      const universal = day.prompts.filter((p) => p.category === 'universal');
      expect(filipino.length).toBeGreaterThanOrEqual(3);
      expect(universal.length).toBeGreaterThanOrEqual(3);
      expect(filipino.length + universal.length).toBe(7);
    }
  });

  it('has at least 30 accepted answers per prompt across all 6 tiers', () => {
    const requiredTiers: Exclude<TierId, 'miss'>[] = [
      'plankton',
      'tooclever',
      'schooler',
      'rare',
      'deepcut',
      'krillion',
    ];

    for (const day of DAYS_PART_2) {
      for (const prompt of day.prompts) {
        expect(prompt.answers.length).toBeGreaterThanOrEqual(30);

        const promptTiers = new Set(prompt.answers.map((a) => a.tier));
        for (const tier of requiredTiers) {
          expect(promptTiers.has(tier)).toBe(true);
        }

        // Verify quips exist on krillion and tooclever
        const krillions = prompt.answers.filter((a) => a.tier === 'krillion');
        expect(krillions.length).toBeGreaterThanOrEqual(1);
        for (const k of krillions) {
          expect(k.quip).toBeTruthy();
        }

        const tooclevers = prompt.answers.filter((a) => a.tier === 'tooclever');
        expect(tooclevers.length).toBeGreaterThanOrEqual(1);
        for (const tc of tooclevers) {
          expect(tc.quip).toBeTruthy();
        }
      }
    }
  });
});
