import { describe, it, expect } from 'vitest';
import {
  baseNormalize,
  normalizeAnswer,
  levenshteinDistance,
  evaluateAnswer,
} from '../matcher';
import { PromptItem } from '../types';

describe('Matcher Normalization', () => {
  it('handles lowercasing and trimming', () => {
    expect(normalizeAnswer('   Baguio City   ')).toBe('baguio city');
    expect(normalizeAnswer('MANILA')).toBe('manila');
  });

  it('strips Filipino and Spanish diacritics', () => {
    expect(normalizeAnswer('Parañaque')).toBe('paranaque');
    expect(normalizeAnswer('San José')).toBe('san jose');
    expect(normalizeAnswer('Niño')).toBe('nino');
  });

  it('removes punctuation and collapses spaces', () => {
    expect(normalizeAnswer('Bacolod, Negros! (Occidental)?')).toBe(
      'bacolod negros occidental'
    );
    expect(normalizeAnswer('Siargao - Surigao')).toBe('siargao surigao');
  });

  it('strips common Filipino and geographical prefixes', () => {
    expect(normalizeAnswer('The Mind Museum')).toBe('mind museum');
    expect(normalizeAnswer('Ang Probinsyano')).toBe('probinsyano');
    expect(normalizeAnswer('Mga Kwento ni Lola Basyang')).toBe(
      'kwento ni lola basyang'
    );
    expect(normalizeAnswer('Ang Mga Kaibigan')).toBe('kaibigan');
    expect(normalizeAnswer('Mt Apo')).toBe('apo');
    expect(normalizeAnswer('Mt. Apo')).toBe('apo');
    expect(normalizeAnswer('Mount Pulag')).toBe('pulag');
    expect(normalizeAnswer('City of Makati')).toBe('makati');
    expect(normalizeAnswer('Province of Bohol')).toBe('bohol');
    expect(normalizeAnswer('LRT Balintawak')).toBe('balintawak');
    expect(normalizeAnswer('MRT Shaw')).toBe('shaw');
  });

  it('strips station suffixes', () => {
    expect(normalizeAnswer('Doroteo Jose Station')).toBe('doroteo jose');
    expect(normalizeAnswer('Monumento Stn')).toBe('monumento');
    expect(normalizeAnswer('LRT Doroteo Jose Station')).toBe('doroteo jose');
  });

  it('preserves short terms if prefix stripping would eliminate string', () => {
    expect(normalizeAnswer('the')).toBe('the');
    expect(normalizeAnswer('mrt')).toBe('mrt');
  });
});

describe('Levenshtein Distance', () => {
  it('computes accurate edit distances', () => {
    expect(levenshteinDistance('', '')).toBe(0);
    expect(levenshteinDistance('a', '')).toBe(1);
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('baguio', 'baguio')).toBe(0);
    expect(levenshteinDistance('baguio', 'baguo')).toBe(1); // 1 deletion
    expect(levenshteinDistance('tagaytay', 'tagaytai')).toBe(1); // 1 substitution
    expect(levenshteinDistance('philippines', 'philipines')).toBe(1); // 1 deletion
    expect(levenshteinDistance('malacanang', 'malakanyang')).toBe(2);
  });
});

describe('Answer Evaluation & Matching', () => {
  const samplePrompt: PromptItem = {
    id: 'ph-mountains',
    text: 'Name a mountain or volcano in the Philippines',
    category: 'filipino',
    hint: 'From famous Luzon peaks to Mindanao giants',
    answers: [
      {
        answer: 'Mayon Volcano',
        aliases: ['Mayon', 'Mount Mayon', 'Mt Mayon'],
        tier: 'plankton',
        quip: 'Perfect cone, perfect consensus pick.',
      },
      {
        answer: 'Mount Apo',
        aliases: ['Apo', 'Mt Apo'],
        tier: 'tooclever',
        quip: 'Highest peak in the country. Top of mind for mountain geeks.',
      },
      {
        answer: 'Mount Pulag',
        aliases: ['Pulag', 'Mt Pulag'],
        tier: 'schooler',
        quip: 'Sea of clouds climber.',
      },
      {
        answer: 'Mount Kanlaon',
        aliases: ['Kanlaon', 'Canlaon', 'Mt Kanlaon'],
        tier: 'rare',
        quip: 'Active stratovolcano of Negros.',
      },
      {
        answer: 'Mount Guiting-Guiting',
        aliases: ['Guiting-Guiting', 'G2', 'Mt Guiting-Guiting'],
        tier: 'deepcut',
        quip: 'Sawtooth mountain of Sibuyan Island. Technical and unforgiving.',
      },
      {
        answer: 'Mount Halcon',
        aliases: ['Halcon', 'Mt Halcon'],
        tier: 'krillion',
        quip: 'The holy grail of Mindoro peaks. One in a Krillion!',
      },
      {
        answer: 'Apo', // short test
        tier: 'schooler',
      },
    ],
  };

  it('matches exact canonical answer', () => {
    const res = evaluateAnswer('Mount Pulag', samplePrompt);
    expect(res.matched).toBe(true);
    expect(res.canonicalAnswer).toBe('Mount Pulag');
    expect(res.tier).toBe('schooler');
    expect(res.score).toBe(30);
    expect(res.quip).toBe('Sea of clouds climber.');
  });

  it('matches via alias with prefix stripping', () => {
    const res = evaluateAnswer('Mt. Mayon', samplePrompt);
    expect(res.matched).toBe(true);
    expect(res.canonicalAnswer).toBe('Mayon Volcano');
    expect(res.tier).toBe('plankton');
    expect(res.score).toBe(10);
  });

  it('matches Krillion tier answers accurately', () => {
    const res = evaluateAnswer('halcon', samplePrompt);
    expect(res.matched).toBe(true);
    expect(res.canonicalAnswer).toBe('Mount Halcon');
    expect(res.tier).toBe('krillion');
    expect(res.score).toBe(100);
  });

  it('matches Deep Cut answers with hyphens and punctuation', () => {
    const res = evaluateAnswer('guiting guiting', samplePrompt);
    expect(res.matched).toBe(true);
    expect(res.canonicalAnswer).toBe('Mount Guiting-Guiting');
    expect(res.tier).toBe('deepcut');
    expect(res.score).toBe(85);
  });

  it('matches fuzzy distance 1 for medium words (len >= 5)', () => {
    // "pulag" (5 chars) -> typo "pulaq" (dist 1)
    const res = evaluateAnswer('pulaq', samplePrompt);
    expect(res.matched).toBe(true);
    expect(res.canonicalAnswer).toBe('Mount Pulag');
  });

  it('matches fuzzy distance 2 for long words (len >= 8)', () => {
    // "kanlaon" -> "kanlaon" is 7, "mount kanlaon" -> prefix stripped is "kanlaon" (7)
    // "guiting guiting" is 15 chars. Typo: "guiting guiting" -> "guiting guytin" (2 edits)
    const res = evaluateAnswer('guiting guytin', samplePrompt);
    expect(res.matched).toBe(true);
    expect(res.canonicalAnswer).toBe('Mount Guiting-Guiting');
  });

  it('rejects fuzzy match when edit distance exceeds threshold', () => {
    // "pulag" (5 chars) with 2 typos: "pulxx"
    const res = evaluateAnswer('pulxx', samplePrompt);
    expect(res.matched).toBe(false);
    expect(res.tier).toBe('miss');
    expect(res.score).toBe(0);
  });

  it('enforces exact match on short words (< 5 chars)', () => {
    // Short prompt
    const shortPrompt: PromptItem = {
      id: 'short-test',
      text: 'Short words test',
      category: 'universal',
      answers: [
        { answer: 'Cebu', tier: 'plankton' }, // 4 chars
        { answer: 'Vigan', tier: 'schooler' }, // 5 chars
      ],
    };

    // "Cebu" exact
    expect(evaluateAnswer('Cebu', shortPrompt).matched).toBe(true);

    // "Cebx" (4 chars, dist 1) - must NOT match because < 5 chars requires exact match!
    const shortMiss = evaluateAnswer('Cebx', shortPrompt);
    expect(shortMiss.matched).toBe(false);
    expect(shortMiss.tier).toBe('miss');

    // "Vigan" (5 chars) with 1 typo "Vigan" -> "Vigam" - CAN match because len >= 5
    const viganFuzzy = evaluateAnswer('Vigam', shortPrompt);
    expect(viganFuzzy.matched).toBe(true);
    expect(viganFuzzy.canonicalAnswer).toBe('Vigan');
  });

  it('returns appropriate miss result for empty or invalid input', () => {
    const emptyRes = evaluateAnswer('', samplePrompt);
    expect(emptyRes.matched).toBe(false);
    expect(emptyRes.tier).toBe('miss');
    expect(emptyRes.score).toBe(0);

    const spaceRes = evaluateAnswer('   ', samplePrompt);
    expect(spaceRes.matched).toBe(false);
    expect(spaceRes.tier).toBe('miss');

    const unknownRes = evaluateAnswer('Mount Everest', samplePrompt);
    expect(unknownRes.matched).toBe(false);
    expect(unknownRes.tier).toBe('miss');
  });
});
