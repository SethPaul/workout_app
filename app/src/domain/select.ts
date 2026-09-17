import { daysSince, lastPerformedMovement, lastPerformedWorkout } from './cadence';
import {
  heavyMovementsInWorkout,
  movementPatterns,
  patternCadenceDays,
  type Pattern,
} from './patterns';
import type { Movement, PoolWorkout, Settings, WorkoutLog } from './types';
import { dayType, weeklyNeed } from './weekly';

export type SelectReason = 'no-enabled' | 'equipment' | 'cadence' | 'pattern' | 'excluded' | 'ok';

export interface SelectResult {
  workout: PoolWorkout | null;
  reason: SelectReason;
  candidates: PoolWorkout[];
  /** A `day:*` type still owed this week (SPEC section 3), or null if none is. */
  needed: string | null;
  /**
   * SPEC 3.1: the hopper. `viable` is the full gate-1/2 survivor list
   * (ignoring `exclude`); `remaining` is `viable` minus `exclude` (the
   * current pick, if any, is part of it).
   */
  hopper: { viable: PoolWorkout[]; remaining: PoolWorkout[] };
}

export interface SelectInput {
  pool: PoolWorkout[];
  movements: Movement[];
  logs: WorkoutLog[];
  settings: Settings;
  now: string | Date;
  exclude?: string[];
  rng?: () => number;
  /** Bypass the cadence gates (workout + movement + pattern) entirely. Used
   * by the UI's "ignore cadence" escape hatch when a cadence gate empties
   * the pool. */
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

function movementCadenceOk(
  movement: Movement | undefined,
  logs: WorkoutLog[],
  now: string | Date,
): boolean {
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

/** Latest `finishedAt` among logs whose snapshot contains a HEAVY movement of this pattern, or null. */
function lastHeavyPatternPerformance(
  logs: WorkoutLog[],
  movementById: Map<string, Movement>,
  pattern: Pattern,
): string | null {
  let latest: string | null = null;
  for (const log of logs) {
    const heavy = heavyMovementsInWorkout(log.workoutSnapshot, movementById);
    const matches = heavy.some((m) => movementPatterns(m).includes(pattern));
    if (!matches) continue;
    if (latest === null || log.finishedAt > latest) latest = log.finishedAt;
  }
  return latest;
}

/**
 * Pattern-level cadence gate (SPEC section 3, AUDIT.md C1): every pattern of
 * every HEAVY movement in the candidate must be far enough past its last
 * HEAVY performance of that pattern, anywhere in the logs.
 */
function patternCadenceOk(
  workout: PoolWorkout,
  movementById: Map<string, Movement>,
  logs: WorkoutLog[],
  now: string | Date,
  settings: Settings,
): boolean {
  const cadenceDays = patternCadenceDays(settings);
  const heavy = heavyMovementsInWorkout(workout, movementById);
  for (const movement of heavy) {
    for (const pattern of movementPatterns(movement)) {
      const requiredDays = cadenceDays[pattern];
      if (requiredDays <= 0) continue;
      const last = lastHeavyPatternPerformance(logs, movementById, pattern);
      if (last === null) continue;
      if (daysSince(last, now) < requiredDays) return false;
    }
  }
  return true;
}

/**
 * SPEC 9.7 focus multiplier: strength focus boosts workouts led by a
 * strength/Power block; conditioning focus boosts `day:zone2`/`day:hiit`
 * tagged workouts and workouts with no strength block at all. 'balanced' is
 * a no-op.
 */
function focusMultiplier(workout: PoolWorkout, focus: Settings['focus']): number {
  if (!focus || focus === 'balanced') return 1;

  if (focus === 'strength') {
    const firstBlock = workout.blocks[0];
    const strengthLed =
      firstBlock !== undefined &&
      (firstBlock.format === 'strength' || firstBlock.title === 'Power');
    return strengthLed ? 1.5 : 1;
  }

  // 'conditioning'
  const tags = workout.tags ?? [];
  const taggedConditioning = tags.includes('day:zone2') || tags.includes('day:hiit');
  const conditioningOnly = workout.blocks.every((b) => b.format !== 'strength');
  return taggedConditioning || conditioningOnly ? 1.5 : 1;
}

function scoreWorkout(
  workout: PoolWorkout,
  movementById: Map<string, Movement>,
  logs: WorkoutLog[],
  now: string | Date,
  rng: () => number,
  focus: Settings['focus'],
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

  return (workoutScore + meanMovementScore) * focusMultiplier(workout, focus) + rng() * RNG_WEIGHT;
}

/**
 * SPEC 3.1: the hopper. Runs gates 1-2 (enabled, equipment, cadence,
 * pattern, weekly-need restriction) *ignoring* `exclude` entirely, so a
 * caller can tell "nothing is eligible today" (a gate reason) apart from
 * "everything eligible has already been bumped" (`selectWorkout`'s
 * `'excluded'`, computed by subtracting `exclude` from `viable` afterwards).
 * `ignoreCadence` skips the cadence and pattern gates only; equipment still
 * applies.
 */
export function viableWorkouts(input: Omit<SelectInput, 'exclude'>): {
  viable: PoolWorkout[];
  /** The gated survivors before the weekly-need restriction (equals `viable` when none applied). */
  unrestricted: PoolWorkout[];
  reason: SelectReason;
} {
  const { pool, movements, logs, settings, now } = input;
  const movementById = new Map(movements.map((m) => [m.id, m]));
  const available = new Set(settings.availableEquipment);

  const enabledPool = pool.filter((w) => w.enabled);
  if (enabledPool.length === 0) return { viable: [], unrestricted: [], reason: 'no-enabled' };

  const equipmentOk = enabledPool.filter((w) =>
    workoutMovementIds(w).every((id) => movementEquipmentOk(movementById.get(id), available)),
  );
  if (equipmentOk.length === 0) return { viable: [], unrestricted: [], reason: 'equipment' };

  const cadenceOk = input.ignoreCadence
    ? equipmentOk
    : equipmentOk.filter((w) => {
        if (!workoutCadenceOk(w, logs, now)) return false;
        return workoutMovementIds(w).every((id) =>
          movementCadenceOk(movementById.get(id), logs, now),
        );
      });
  if (cadenceOk.length === 0) return { viable: [], unrestricted: [], reason: 'cadence' };

  const patternOk = input.ignoreCadence
    ? cadenceOk
    : cadenceOk.filter((w) => patternCadenceOk(w, movementById, logs, now, settings));
  if (patternOk.length === 0) return { viable: [], unrestricted: [], reason: 'pattern' };

  // Weekly mandatory-day gate (SPEC section 3, AUDIT.md C2): restrict to the
  // needed day type only if a gated survivor actually has it, otherwise fall
  // through to the normal pool rather than returning empty.
  const needed = weeklyNeed(logs, now);
  const needMatches = needed ? patternOk.filter((w) => dayType(w) === needed) : [];
  const gated = needMatches.length > 0 ? needMatches : patternOk;

  return { viable: gated, unrestricted: patternOk, reason: 'ok' };
}

/**
 * Implements SPEC section 3 / 3.1: compute the hopper (`viableWorkouts`,
 * ignoring `exclude`), subtract `exclude` to get `hopper.remaining`, then
 * score/slice/pick from what remains. When the hopper is non-empty but every
 * entry has been excluded (bumped) today, the reason is `'excluded'` rather
 * than whatever gate would otherwise apply to the leftovers — exclusions are
 * applied strictly after the gates, never mixed into them.
 */
export function selectWorkout(input: SelectInput): SelectResult {
  const { movements, logs, settings, now } = input;
  const exclude = input.exclude ?? [];
  const rng = input.rng ?? Math.random;
  const needed = weeklyNeed(logs, now);

  const { viable: restricted, unrestricted, reason } = viableWorkouts(input);
  const notExcluded = (list: PoolWorkout[]) => list.filter((w) => !exclude.includes(w.id));
  // The weekly-need restriction (step 2) never empties the pool on its own:
  // once every needed-day workout has been bumped today, the hopper widens
  // to the unrestricted survivors rather than reporting itself exhausted.
  const widen = restricted.length > 0 && notExcluded(restricted).length === 0;
  const viable = widen ? unrestricted : restricted;
  const hopper = { viable, remaining: notExcluded(viable) };

  if (viable.length === 0) {
    return { workout: null, reason, candidates: [], needed, hopper };
  }
  if (hopper.remaining.length === 0) {
    return { workout: null, reason: 'excluded', candidates: [], needed, hopper };
  }

  const movementById = new Map(movements.map((m) => [m.id, m]));
  const scored = hopper.remaining
    .map((workout) => ({
      workout,
      score: scoreWorkout(workout, movementById, logs, now, rng, settings.focus),
    }))
    .sort((a, b) => b.score - a.score);

  const sliceSize = Math.max(3, Math.ceil(scored.length * 0.25));
  const candidates = scored.slice(0, sliceSize).map((s) => s.workout);

  const pickIndex = Math.floor(rng() * candidates.length);
  const workout = candidates[Math.min(pickIndex, candidates.length - 1)];

  return { workout, reason: 'ok', candidates, needed, hopper };
}
