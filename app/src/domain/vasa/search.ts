import { daysSince, lastPerformedMovement } from '../cadence';
import type { BodyRegion, Movement, WorkoutLog } from '../types';
import { availableAtVasa, inLibrary } from './library';
import { matchesRegion, movementRegion } from './region';

export interface SearchMovementsOptions {
  region: BodyRegion;
  logs: WorkoutLog[];
  now: Date;
  limit?: number;
}

const DEFAULT_LIMIT = 8;
const SIMILAR_LIMIT = 3;
const RECENCY_WINDOW_DAYS = 30;

/**
 * SPEC 10.7: lowercase, replace every run of non-alphanumeric characters with
 * a single space, then trim. Hyphens and spaces both fold to a space, so
 * "pull up" normalizes the same as "Pull-up"; "pullup" does not (see the
 * space-stripped substring tier below for that case).
 */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * SPEC 10.7: "ies" -> "y"; otherwise strips one trailing "s" unless the token
 * ends in "ss" or is 3 characters or shorter.
 */
export function singular(token: string): string {
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.endsWith('ss') || token.length <= 3) return token;
  if (token.endsWith('s')) return token.slice(0, -1);
  return token;
}

const ABBREVIATIONS: Record<string, string> = {
  db: 'dumbbell',
  kb: 'kettlebell',
  bb: 'barbell',
  rdl: 'romanian deadlift',
  ohp: 'overhead press',
  bss: 'bulgarian split squat',
  sl: 'single leg',
  sa: 'single arm',
};

/**
 * SPEC 10.7: expands a query token that equals a known abbreviation exactly
 * into its full word(s) (e.g. "db" -> ["dumbbell"], "rdl" -> ["romanian",
 * "deadlift"]); any other token passes through unchanged as a single-element
 * array. Applied to query tokens only, never to candidate name/alias words.
 */
export function expandAbbreviation(token: string): string[] {
  const expansion = ABBREVIATIONS[token];
  return expansion ? expansion.split(' ') : [token];
}

/** normalize -> split -> singularize, with no abbreviation expansion. */
function rawWords(s: string): string[] {
  const norm = normalizeText(s);
  return norm === '' ? [] : norm.split(' ').map(singular);
}

/** normalize -> split -> expand abbreviations -> singularize; query side only. */
function expandedWords(s: string): string[] {
  const norm = normalizeText(s);
  return norm === '' ? [] : norm.split(' ').flatMap(expandAbbreviation).map(singular);
}

function wordsKey(words: string[]): string {
  return words.join(' ');
}

/**
 * Every word of `queryWords` prefix-matches a distinct word of
 * `candidateWords`, in strictly increasing candidate positions (SPEC 10.7's
 * "ordered word prefixes" tier). Greedily takes, for each query word in
 * order, the earliest unused candidate word after the previous match — always
 * safe here since matching earlier never removes an option a later token
 * could have used.
 */
function orderedPrefixMatch(queryWords: string[], candidateWords: string[]): boolean {
  let last = -1;
  for (const token of queryWords) {
    let found = -1;
    for (let i = last + 1; i < candidateWords.length; i += 1) {
      if (candidateWords[i].startsWith(token)) {
        found = i;
        break;
      }
    }
    if (found === -1) return false;
    last = found;
  }
  return true;
}

/**
 * Every word of `queryWords` prefix-matches a distinct word of
 * `candidateWords`, in any order (SPEC 10.7's "unordered word prefixes"
 * tier) — a bipartite matching solved with Kuhn's augmenting-path algorithm
 * (the candidate lists here are always tiny).
 */
function unorderedPrefixMatch(queryWords: string[], candidateWords: string[]): boolean {
  const owner = new Array<number>(candidateWords.length).fill(-1);

  function tryAssign(tokenIndex: number, visited: boolean[]): boolean {
    for (let i = 0; i < candidateWords.length; i += 1) {
      if (visited[i] || !candidateWords[i].startsWith(queryWords[tokenIndex])) continue;
      visited[i] = true;
      if (owner[i] === -1 || tryAssign(owner[i], visited)) {
        owner[i] = tokenIndex;
        return true;
      }
    }
    return false;
  }

  for (let t = 0; t < queryWords.length; t += 1) {
    if (!tryAssign(t, new Array<boolean>(candidateWords.length).fill(false))) return false;
  }
  return true;
}

/**
 * SPEC 10.7: the best of the match tiers for `query` against a movement's
 * name and every alias (best candidate wins): exact 100, ordered word-prefix
 * 60, unordered word-prefix 50, space-stripped substring 20, else 0 (no
 * match — the movement is excluded from `searchMovements` results).
 */
function nameMatchScore(m: Movement, query: string): number {
  const qRaw = rawWords(query);
  if (qRaw.length === 0) return 0;
  const qKey = wordsKey(qRaw);
  const qStripped = qRaw.join('');
  const qExpanded = expandedWords(query);

  let best = 0;
  for (const candidate of [m.name, ...(m.aliases ?? [])]) {
    const cWords = rawWords(candidate);
    if (cWords.length === 0) continue;
    if (wordsKey(cWords) === qKey) return 100;
    if (best < 60 && orderedPrefixMatch(qExpanded, cWords)) best = 60;
    if (best < 50 && unorderedPrefixMatch(qExpanded, cWords)) best = 50;
    if (best < 20 && cWords.join('').includes(qStripped)) best = 20;
  }
  return best;
}

/**
 * SPEC 10.7 (replaces 10.3's matching rules; the boosts below are unchanged
 * from 10.3): ranks movements for the Vasa movement picker. With a non-empty
 * `query`, movements matching neither name nor alias in any tier are
 * excluded entirely; with an empty query every movement is included, ranked
 * purely by the library/region/recency/availability signals below.
 */
export function searchMovements(
  movements: Movement[],
  query: string,
  opts: SearchMovementsOptions,
): Movement[] {
  const q = query.trim();
  const limit = opts.limit ?? DEFAULT_LIMIT;

  const scored: { movement: Movement; score: number }[] = [];
  for (const m of movements) {
    let score = 0;
    if (q !== '') {
      const nameScore = nameMatchScore(m, q);
      if (nameScore === 0) continue; // no match: excluded
      score += nameScore;
    }
    if (inLibrary(m, 'vasa')) score += 10;
    if (matchesRegion(m, opts.region)) score += 8;
    if (opts.region !== 'full' && movementRegion(m) === opts.region) score += 4;
    const last = lastPerformedMovement(opts.logs, m.id);
    if (last !== null && daysSince(last, opts.now) <= RECENCY_WINDOW_DAYS) score += 3;
    if (!availableAtVasa(m)) score -= 15;
    scored.push({ movement: m, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.movement.name.localeCompare(b.movement.name);
  });

  return scored.slice(0, limit).map((s) => s.movement);
}

/**
 * SPEC 10.7: the top matches for `query` by the match tiers alone (no
 * library/region/recency/availability boosts), ties broken by name — the
 * "Already have: …" row offered before creating a movement that might
 * already exist.
 */
export function similarMovements(
  movements: Movement[],
  query: string,
  limit = SIMILAR_LIMIT,
): Movement[] {
  const scored = movements
    .map((movement) => ({ movement, score: nameMatchScore(movement, query) }))
    .filter((s) => s.score > 0);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.movement.name.localeCompare(b.movement.name);
  });

  return scored.slice(0, limit).map((s) => s.movement);
}

/**
 * SPEC 10.7: case/whitespace/punctuation-insensitive, singularized equality
 * against a movement's name or any alias ("dead bugs" ≡ "Dead Bug"). The
 * Vasa picker shows a "Create "<query>"" row only when this is false.
 */
export function hasExactName(movements: Movement[], query: string): boolean {
  const qKey = wordsKey(rawWords(query));
  return movements.some((m) =>
    [m.name, ...(m.aliases ?? [])].some((c) => wordsKey(rawWords(c)) === qKey),
  );
}
