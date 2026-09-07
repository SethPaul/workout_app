import { daysSince, lastPerformedMovement, lastPerformedWorkout } from './cadence';
import type { Movement, PoolWorkout, Settings, WorkoutLog } from './types';

export type SelectReason = 'no-enabled' | 'equipment' | 'cadence' | 'excluded' | 'ok';

export interface SelectResult {
  workout: PoolWorkout | null;
  reason: SelectReason;
  candidates: PoolWorkout[];
}

export interface SelectInput {
  pool: PoolWorkout[];
  movements: Movement[];
  logs: WorkoutLog[];
  settings: Settings;
  now: string | Date;
  exclude?: string[];
  rng?: () => number;
  /** Bypass the cadence gate (workout + movement) entirely. Used by the UI's
   * "ignore cadence" escape hatch when the cadence gate empties the pool. */
  ignoreCadence?: boolean;
}

const NEVER_PERFORMED_WORKOUT_SCORE = 100;
const WORKOUT_DAYS_CAP = 60;
const MOVEMENT_DAYS_CAP = 30;
const RNG_WEIGHT = 5;

function movementEquipmentOk(movement: Movement | undefined, available: Set<string>): boolean {
  if (!movement) return true; // unknown movement id: don't let missing data block selection
  const required = movement.equipment.filter((e) => e !== 'none');
  return required.every((e) => available.has(e));
}

function movementCadenceOk(movement: Movement | undefined, logs: WorkoutLog[], now: string | Date): boolean {
  if (!movement) return true; // unknown movement id: treat as never performed (passes)
  const last = lastPerformedMovement(logs, movement.id);
  if (last === null) return true;
  return daysSince(last, now) >= movement.cadenceDays;
}

function workoutMovementIds(workout: PoolWorkout): string[] {
  return workout.blocks.flatMap((b) => b.movements.map((m) => m.movementId));
}

function workoutCadenceOk(workout: PoolWorkout, logs: WorkoutLog[], now: string | Date): boolean {
  const last = lastPerformedWorkout(logs, workout.id);
  if (last === null) return true;
  return daysSince(last, now) >= workout.cadenceDays;
}

function scoreWorkout(
  workout: PoolWorkout,
  movementById: Map<string, Movement>,
  logs: WorkoutLog[],
  now: string | Date,
  rng: () => number,
): number {
  const lastWorkout = lastPerformedWorkout(logs, workout.id);
  const workoutScore =
    lastWorkout === null
      ? NEVER_PERFORMED_WORKOUT_SCORE
      : 2 * Math.min(daysSince(lastWorkout, now), WORKOUT_DAYS_CAP);

  const movementIds = workoutMovementIds(workout);
  const movementScores = movementIds.map((id) => {
    const movement = movementById.get(id);
    const last = movement ? lastPerformedMovement(logs, movement.id) : null;
    if (last === null) return MOVEMENT_DAYS_CAP;
    return Math.min(daysSince(last, now), MOVEMENT_DAYS_CAP);
  });
  const meanMovementScore =
    movementScores.length === 0
      ? 0
      : movementScores.reduce((a, b) => a + b, 0) / movementScores.length;

  return workoutScore + meanMovementScore + rng() * RNG_WEIGHT;
}

/**
 * Implements SPEC section 3: gate the pool, score survivors, take the top
 * slice, and pick one uniformly at random from that slice.
 */
export function selectWorkout(input: SelectInput): SelectResult {
  const { pool, movements, logs, settings, now } = input;
  const exclude = input.exclude ?? [];
  const rng = input.rng ?? Math.random;

  const movementById = new Map(movements.map((m) => [m.id, m]));
  const available = new Set(settings.availableEquipment);

  const enabledPool = pool.filter((w) => w.enabled);
  if (enabledPool.length === 0) {
    return { workout: null, reason: 'no-enabled', candidates: [] };
  }

  const notExcluded = enabledPool.filter((w) => !exclude.includes(w.id));
  if (notExcluded.length === 0) {
    return { workout: null, reason: 'excluded', candidates: [] };
  }

  const equipmentOk = notExcluded.filter((w) =>
    workoutMovementIds(w).every((id) => movementEquipmentOk(movementById.get(id), available)),
  );
  if (equipmentOk.length === 0) {
    return { workout: null, reason: 'equipment', candidates: [] };
  }

  const cadenceOk = input.ignoreCadence
    ? equipmentOk
    : equipmentOk.filter((w) => {
        if (!workoutCadenceOk(w, logs, now)) return false;
        return workoutMovementIds(w).every((id) => movementCadenceOk(movementById.get(id), logs, now));
      });
  if (cadenceOk.length === 0) {
    return { workout: null, reason: 'cadence', candidates: [] };
  }

  const scored = cadenceOk
    .map((workout) => ({ workout, score: scoreWorkout(workout, movementById, logs, now, rng) }))
    .sort((a, b) => b.score - a.score);

  const sliceSize = Math.max(3, Math.ceil(scored.length * 0.25));
  const candidates = scored.slice(0, sliceSize).map((s) => s.workout);

  const pickIndex = Math.floor(rng() * candidates.length);
  const workout = candidates[Math.min(pickIndex, candidates.length - 1)];

  return { workout, reason: 'ok', candidates };
}
