import type { Movement, PoolWorkout, WorkoutLog } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days elapsed between an ISO timestamp and `now` (also ISO or Date). */
export function daysSince(iso: string, now: string | Date): number {
  const then = new Date(iso).getTime();
  const nowMs = typeof now === 'string' ? new Date(now).getTime() : now.getTime();
  return Math.floor((nowMs - then) / DAY_MS);
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
