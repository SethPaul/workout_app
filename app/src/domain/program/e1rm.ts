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

export interface LoggedSet {
  weight: number;
  reps: number;
}

export interface E1rmPoint {
  date: string; // the session's finishedAt
  e1rm: number;
  source: 'estimate' | 'max-test';
  /** The set the session's e1rm was computed from. */
  bestSet: LoggedSet;
  /**
   * The heaviest weight actually lifted that session (any rep count), with
   * the most reps done at that weight — what was on the bar, as opposed to
   * the estimate.
   */
  heaviestSet: LoggedSet;
}

type RawSet = { weight?: number; reps?: number };

function bestSetE1rm(sets: RawSet[]): { e1rm: number; set: LoggedSet } | null {
  let best: { e1rm: number; set: LoggedSet } | null = null;
  for (const set of sets) {
    if (set.weight === undefined || set.reps === undefined) continue;
    const value = e1rm(set.weight, set.reps);
    if (value !== null && (best === null || value > best.e1rm)) {
      best = { e1rm: value, set: { weight: set.weight, reps: set.reps } };
    }
  }
  return best;
}

function heaviestOf(sets: RawSet[]): LoggedSet | null {
  let heaviest: LoggedSet | null = null;
  for (const set of sets) {
    if (set.weight === undefined || set.reps === undefined || set.reps < 1) continue;
    if (
      !heaviest ||
      set.weight > heaviest.weight ||
      (set.weight === heaviest.weight && set.reps > heaviest.reps)
    ) {
      heaviest = { weight: set.weight, reps: set.reps };
    }
  }
  return heaviest;
}

/**
 * Per-session e1RM history for one movement (SPEC 9.2): the best qualifying
 * set (<=10 reps) each session that includes the movement, oldest first.
 * `source` is 'max-test' for a `kind: 'max-test'` log, 'estimate' otherwise.
 * Each point also carries the set behind the estimate and the heaviest set
 * actually lifted, so charts can show the estimate against real loads.
 */
export function e1rmHistory(logs: WorkoutLog[], movementId: string): E1rmPoint[] {
  const points: E1rmPoint[] = [];
  for (const log of logs) {
    // A movement can appear in more than one block of the same log (e.g.
    // cleans in both a strength block and a conditioning block) — consider
    // every matching result and take the best e1rm across all of them.
    const results = log.results.filter((r) => r.movementId === movementId);
    if (results.length === 0) continue;
    const sets = results.flatMap((result) =>
      result.sets && result.sets.length > 0
        ? result.sets
        : [{ weight: result.weight, reps: result.reps }],
    );
    const best = bestSetE1rm(sets);
    if (best === null) continue;
    points.push({
      date: log.finishedAt,
      e1rm: best.e1rm,
      source: logKind(log) === 'max-test' ? 'max-test' : 'estimate',
      bestSet: best.set,
      // Non-null whenever `best` is: the e1rm set itself qualifies.
      heaviestSet: heaviestOf(sets)!,
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Current working max for a movement (SPEC 9.2): a `max-test` log within 56
 * days wins outright; otherwise the max estimated 1RM over the last 8 weeks;
 * otherwise null (nothing recent to calibrate off).
 */
export function currentMax(
  logs: WorkoutLog[],
  movementId: string,
  now: string | Date,
): number | null {
  const history = e1rmHistory(logs, movementId);

  const recentMaxTests = history.filter(
    (p) => p.source === 'max-test' && daysSince(p.date, now) <= E1RM_WINDOW_DAYS,
  );
  if (recentMaxTests.length > 0) {
    return Math.max(...recentMaxTests.map((p) => p.e1rm));
  }

  const recent = history.filter((p) => daysSince(p.date, now) <= E1RM_WINDOW_DAYS);
  if (recent.length > 0) {
    return Math.max(...recent.map((p) => p.e1rm));
  }

  return null;
}
