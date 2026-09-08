import { daysSince } from '../cadence';
import type { WorkoutLog } from '../types';
import { logKind } from './context';

/** 8-week / 56-day window used both for max-test precedence and the e1rm trend (SPEC 9.2). */
export const E1RM_WINDOW_DAYS = 56;

/**
 * Epley estimated 1RM (SPEC 9.2, R37): `w * (1 + reps/30)`. Only valid for
 * 1-10 reps — the formula's error grows sharply beyond that range, so
 * anything outside it returns null rather than a misleading number.
 */
export function e1rm(weight: number, reps: number): number | null {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  if (reps < 1 || reps > 10) return null;
  // A true single is the max; Epley would inflate it by 3.3%.
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export interface E1rmPoint {
  date: string; // the session's finishedAt
  e1rm: number;
  source: 'estimate' | 'max-test';
}

function bestSetE1rm(sets: { weight?: number; reps?: number }[]): number | null {
  let best: number | null = null;
  for (const set of sets) {
    if (set.weight === undefined || set.reps === undefined) continue;
    const value = e1rm(set.weight, set.reps);
    if (value !== null && (best === null || value > best)) best = value;
  }
  return best;
}

/**
 * Per-session e1RM history for one movement (SPEC 9.2): the best qualifying
 * set (<=10 reps) each session that includes the movement, oldest first.
 * `source` is 'max-test' for a `kind: 'max-test'` log, 'estimate' otherwise.
 */
export function e1rmHistory(logs: WorkoutLog[], movementId: string): E1rmPoint[] {
  const points: E1rmPoint[] = [];
  for (const log of logs) {
    const result = log.results.find((r) => r.movementId === movementId);
    if (!result) continue;
    const sets = result.sets && result.sets.length > 0 ? result.sets : [{ weight: result.weight, reps: result.reps }];
    const best = bestSetE1rm(sets);
    if (best === null) continue;
    points.push({ date: log.finishedAt, e1rm: best, source: logKind(log) === 'max-test' ? 'max-test' : 'estimate' });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Current working max for a movement (SPEC 9.2): a `max-test` log within 56
 * days wins outright; otherwise the max estimated 1RM over the last 8 weeks;
 * otherwise null (nothing recent to calibrate off).
 */
export function currentMax(logs: WorkoutLog[], movementId: string, now: string | Date): number | null {
  const history = e1rmHistory(logs, movementId);

  const recentMaxTests = history.filter((p) => p.source === 'max-test' && daysSince(p.date, now) <= E1RM_WINDOW_DAYS);
  if (recentMaxTests.length > 0) {
    return Math.max(...recentMaxTests.map((p) => p.e1rm));
  }

  const recent = history.filter((p) => daysSince(p.date, now) <= E1RM_WINDOW_DAYS);
  if (recent.length > 0) {
    return Math.max(...recent.map((p) => p.e1rm));
  }

  return null;
}
