import type { Movement } from '../types';
import { movementPatterns } from '../patterns';

/**
 * How much recovery a movement's sets need: `heavy` loaded compound/olympic
 * lifts, `accessory` for other loaded work, `light` for bodyweight, core,
 * cardio and plyo work.
 */
export type RestCategory = 'heavy' | 'accessory' | 'light';

/**
 * Recommended rest (seconds) by category x RPE band (easy <7.5, moderate
 * <9, hard >=9). Anchored to R3 (`project_docs/training_evidence.md`):
 * 2-3+ min between heavy sets, 90s-2 min for accessories; light work gets
 * proportionally less. Harder sets get more rest.
 */
export const REST_SEC: Record<RestCategory, [easy: number, moderate: number, hard: number]> = {
  heavy: [120, 150, 180],
  accessory: [60, 90, 120],
  light: [30, 45, 60],
};

/** Assumed RPE when none was entered for the set (the default target RPE). */
export const DEFAULT_REST_RPE = 8;

const LIGHT_PATTERNS = new Set(['core', 'cardio', 'plyo']);

export function restCategory(m: Movement): RestCategory {
  if (!m.loadable) return 'light';
  const patterns = movementPatterns(m);
  if (m.tags.includes('compound') || patterns.includes('olympic')) return 'heavy';
  if (patterns.length > 0 && patterns.every((p) => LIGHT_PATTERNS.has(p))) return 'light';
  return 'accessory';
}

function rpeBand(rpe: number): 0 | 1 | 2 {
  if (rpe < 7.5) return 0;
  if (rpe < 9) return 1;
  return 2;
}

/**
 * Recommended rest after a set of `movements` (a superset rests once after
 * the whole round, so it takes the longest any of them needs) at `rpe` —
 * the set's hardest entered RPE, or `DEFAULT_REST_RPE` when none was.
 */
export function recommendedRestSec(movements: Movement[], rpe: number | undefined): number {
  const band = rpeBand(rpe ?? DEFAULT_REST_RPE);
  if (movements.length === 0) return REST_SEC.accessory[band];
  return Math.max(...movements.map((m) => REST_SEC[restCategory(m)][band]));
}
