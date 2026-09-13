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
const RECENCY_WINDOW_DAYS = 30;

/** Collapses/trims whitespace and lowercases, for whitespace-insensitive text comparisons. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The mutually-exclusive name/alias match tier for `query` against `m`
 * (SPEC 10.3): exact > word-prefix > substring > no match (0, and the
 * movement is excluded from results entirely).
 */
function nameMatchScore(m: Movement, query: string): number {
  const q = normalize(query);
  const candidates = [m.name, ...(m.aliases ?? [])];
  let sawSubstring = false;
  let sawWordPrefix = false;
  for (const candidate of candidates) {
    const c = normalize(candidate);
    if (c === q) return 100;
    if (!sawWordPrefix && c.split(' ').some((word) => word.startsWith(q))) sawWordPrefix = true;
    if (!sawSubstring && c.includes(q)) sawSubstring = true;
  }
  if (sawWordPrefix) return 50;
  if (sawSubstring) return 20;
  return 0;
}

/**
 * SPEC 10.3: ranks movements for the Vasa movement picker. With a non-empty
 * `query`, movements matching neither name nor alias are excluded entirely;
 * with an empty query every movement is included, ranked purely by the
 * library/region/recency/availability signals below.
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
 * SPEC 10.3: case/whitespace-insensitive equality against a movement's name
 * or any alias. The Vasa picker shows a "Create "<query>"" row only when
 * this is false.
 */
export function hasExactName(movements: Movement[], query: string): boolean {
  const q = normalize(query);
  return movements.some((m) => [m.name, ...(m.aliases ?? [])].some((c) => normalize(c) === q));
}
