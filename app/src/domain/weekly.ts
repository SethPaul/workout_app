import { daysSince } from './cadence';
import type { PoolWorkout, WorkoutLog } from './types';

/**
 * Day types that must be logged at least once per rolling 7-day window.
 * `select.ts` restricts candidates to a needed type when one is owed and a
 * survivor of that type exists (SPEC section 3, AUDIT.md section C item C2).
 * More required day types can be added here.
 */
export const REQUIRED_WEEKLY: string[] = ['deadlift-press'];

/** Reads a workout's `day:*` tag, if any (e.g. `day:deadlift-press` -> `deadlift-press`). */
export function dayType(workout: PoolWorkout): string | null {
  const tag = (workout.tags ?? []).find((t) => t.startsWith('day:'));
  return tag ? tag.slice('day:'.length) : null;
}

/**
 * Returns the first `REQUIRED_WEEKLY` day type with no matching log in the
 * last 7 local days, or null if every required day type has been done.
 */
export function weeklyNeed(logs: WorkoutLog[], now: string | Date): string | null {
  for (const type of REQUIRED_WEEKLY) {
    const done = logs.some((log) => {
      if (dayType(log.workoutSnapshot) !== type) return false;
      return daysSince(log.finishedAt, now) < 7;
    });
    if (!done) return type;
  }
  return null;
}
