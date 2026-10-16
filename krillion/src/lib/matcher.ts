import { AnswerEntry, EvaluationResult, PromptItem, TierId, TIERS } from './types';

/**
 * Basic normalization: lowercases, strips diacritics, removes punctuation, collapses whitespace.
 */
export function baseNormalize(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritical marks (ñ -> n, é -> e)
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"?><[\]\\]/g, ' ') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Taglish and Filipino prefix/suffix stripper.
 * Strips common prefixes ("the ", "ang ", "mga ", "mt ", "mt. ", "mount ", "lrt ", "mrt ", "city of ", "province of ")
 * and suffixes (" station").
 */
export function normalizeAnswer(input: string): string {
  let text = baseNormalize(input);
  if (!text) return '';

  const original = text;

  // Prefixes to strip (ordered by length descending to match longest first)
  const prefixes = [
    'province of ',
    'city of ',
    'mount ',
    'ang mga ',
    'the ',
    'ang ',
    'mga ',
    'lrt ',
    'mrt ',
    'mt ',
  ];

  let strippedPrefix = true;
  while (strippedPrefix) {
    strippedPrefix = false;
    for (const prefix of prefixes) {
      if (text.startsWith(prefix) && text.length > prefix.length) {
        text = text.slice(prefix.length).trim();
        strippedPrefix = true;
      }
    }
  }

  // Suffixes to strip
  const suffixes = [
    ' station',
    ' stn',
  ];

  let strippedSuffix = true;
  while (strippedSuffix) {
    strippedSuffix = false;
    for (const suffix of suffixes) {
      if (text.endsWith(suffix) && text.length > suffix.length) {
        text = text.slice(0, -suffix.length).trim();
        strippedSuffix = true;
      }
    }
  }

  return text || original;
}

/**
 * Standard Levenshtein distance calculation between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const d: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[s1.length][s2.length];
}

interface MatchCandidate {
  entry: AnswerEntry;
  matchedString: string;
  exact: boolean;
  distance: number;
}

/**
 * Evaluates a user submission against a PromptItem.
 * 1. Checks exact match against normalized canonical answers and all aliases.
 * 2. If no exact match and normalized length >= 5, evaluates fuzzy Levenshtein distance:
 *    - len >= 5: distance <= 1
 *    - len >= 8: distance <= 2
 *    - len < 5: requires exact match to prevent false positives.
 */
export function evaluateAnswer(
  rawAnswer: string,
  prompt: PromptItem
): EvaluationResult {
  const trimmed = rawAnswer ? rawAnswer.trim() : '';
  if (!trimmed) {
    return {
      matched: false,
      tier: 'miss',
      score: 0,
      canonicalAnswer: null,
      quip: 'No answer submitted! You drifted without moving.',
    };
  }

  const normUser = normalizeAnswer(trimmed);
  const baseNormUser = baseNormalize(trimmed);

  // Phase 1: Exact matches (checking both full stripped normalization and base normalization)
  for (const entry of prompt.answers) {
    const candidates = [entry.answer, ...(entry.aliases || [])];
    for (const cand of candidates) {
      const normCand = normalizeAnswer(cand);
      const baseCand = baseNormalize(cand);

      if (
        normUser === normCand ||
        baseNormUser === baseCand ||
        (normUser && normUser === baseCand) ||
        (baseNormUser && baseNormUser === normCand)
      ) {
        return {
          matched: true,
          entry,
          tier: entry.tier,
          score: TIERS[entry.tier].score,
          canonicalAnswer: entry.answer,
          quip: entry.quip || TIERS[entry.tier].blurb,
        };
      }
    }
  }

  // Phase 2: Fuzzy matching
  // Length guard: words shorter than 5 chars NEVER fuzzy-match
  if (normUser.length >= 5) {
    const maxAllowedDist = normUser.length >= 8 ? 2 : 1;
    const fuzzyCandidates: MatchCandidate[] = [];

    for (const entry of prompt.answers) {
      const candidates = [entry.answer, ...(entry.aliases || [])];
      for (const cand of candidates) {
        const normCand = normalizeAnswer(cand);

        // Candidate must also be >= 5 chars to prevent matching short words with typos
        if (normCand.length < 5) continue;

        // Skip if length difference already exceeds maxAllowedDist
        if (Math.abs(normUser.length - normCand.length) > maxAllowedDist) continue;

        const dist = levenshteinDistance(normUser, normCand);
        if (dist <= maxAllowedDist) {
          fuzzyCandidates.push({
            entry,
            matchedString: cand,
            exact: false,
            distance: dist,
          });
        }
      }
    }

    if (fuzzyCandidates.length > 0) {
      // Pick best candidate: minimum distance, tie-breaker: highest tier score
      fuzzyCandidates.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return TIERS[b.entry.tier].score - TIERS[a.entry.tier].score;
      });

      const best = fuzzyCandidates[0];
      return {
        matched: true,
        entry: best.entry,
        tier: best.entry.tier,
        score: TIERS[best.entry.tier].score,
        canonicalAnswer: best.entry.answer,
        quip: best.entry.quip || TIERS[best.entry.tier].blurb,
      };
    }
  }

  // Phase 3: Miss
  return {
    matched: false,
    tier: 'miss',
    score: 0,
    canonicalAnswer: null,
    quip: 'Not in our depths! That answer drifted away into the void.',
  };
}
