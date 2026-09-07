import type { Movement, PoolWorkout, WorkoutLog } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight, local time, for the calendar day containing `d`. */
function localMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Local calendar-day difference between an ISO timestamp and `now` (also ISO
 * or Date) — not elapsed milliseconds. A workout performed at 23:00 local
 * yesterday is `1` day ago as of 07:00 local today, even though under 24h of
 * wall-clock time has passed; the same calendar day is always `0`. Uses
 * Math.round (not floor) so a DST transition's 23h/25h local day doesn't
 * shift the result by one.
 */
export function daysSince(iso: string, now: string | Date): number {
  const then = new Date(iso);
  const nowDate = typeof now === 'string' ? new Date(now) : now;
  const diffMs = localMidnight(nowDate).getTime() - localMidnight(then).getTime();
  return Math.round(diffMs / DAY_MS);
}

/** Latest `finishedAt` among logs whose workout snapshot contains this movement, or null. */
export function lastPerformedMovement(logs: WorkoutLog[], movementId: string): string | null {
  let latest: string | null = null;
  for (const log of logs) {
    const containsMovement = log.workoutSnapshot.blocks.some((block) =>
      block.movements.some((m) => m.movementId === movementId),
    );
    if (!containsMovement) continue;
    if (latest === null || log.finishedAt > latest) latest = log.finishedAt;
  }
  return latest;
}

/** Latest `finishedAt` among logs of this exact pool workout id, or null. */
export function lastPerformedWorkout(logs: WorkoutLog[], poolWorkoutId: string): string | null {
  let latest: string | null = null;
  for (const log of logs) {
    if (log.poolWorkoutId !== poolWorkoutId) continue;
    if (latest === null || log.finishedAt > latest) latest = log.finishedAt;
  }
  return latest;
}

/**
 * Days until a movement is next due (<=0 means due now). Returns null if the
 * movement has never been performed (always due).
 */
export function movementDueIn(
  movement: Movement,
  logs: WorkoutLog[],
  now: string | Date,
): number | null {
  const last = lastPerformedMovement(logs, movement.id);
  if (last === null) return null;
  return movement.cadenceDays - daysSince(last, now);
}

/**
 * Days until a pool workout is next due (<=0 means due now). Returns null if
 * the workout has never been performed (always due).
 */
export function workoutDueIn(
  workout: PoolWorkout,
  logs: WorkoutLog[],
  now: string | Date,
): number | null {
  const last = lastPerformedWorkout(logs, workout.id);
  if (last === null) return null;
  return workout.cadenceDays - daysSince(last, now);
}
