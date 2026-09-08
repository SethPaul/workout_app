import type { BlockMovement, Movement, Units } from '../types';
import { currentMax } from './e1rm';
import type { WorkoutLog } from '../types';

/**
 * Helms/Zourdos RIR-based %1RM table (SPEC 9.3, R36), reps 1-10 x RPE 6-10,
 * as fractions of 1RM. Anchored to the spec's example values; the rest is
 * filled consistently (~2.5-3.5% per RPE step, and each row's RPE9 lines up
 * with the next row's RPE10 — dropping one rep buys roughly one RPE of
 * headroom, the standard shape of this chart).
 */
export const RPE_TABLE: Record<number, Record<number, number>> = {
  1: { 10: 1.0, 9: 0.955, 8: 0.922, 7: 0.892, 6: 0.863 },
  2: { 10: 0.955, 9: 0.922, 8: 0.892, 7: 0.863, 6: 0.837 },
  3: { 10: 0.922, 9: 0.892, 8: 0.863, 7: 0.837, 6: 0.811 },
  4: { 10: 0.892, 9: 0.863, 8: 0.837, 7: 0.811, 6: 0.786 },
  5: { 10: 0.862, 9: 0.837, 8: 0.811, 7: 0.786, 6: 0.762 },
  6: { 10: 0.837, 9: 0.811, 8: 0.786, 7: 0.762, 6: 0.739 },
  7: { 10: 0.811, 9: 0.786, 8: 0.762, 7: 0.739, 6: 0.717 },
  8: { 10: 0.786, 9: 0.762, 8: 0.739, 7: 0.717, 6: 0.696 },
  9: { 10: 0.762, 9: 0.739, 8: 0.717, 7: 0.696, 6: 0.676 },
  10: { 10: 0.739, 9: 0.717, 8: 0.696, 7: 0.676, 6: 0.656 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** RPE_TABLE fraction for `reps` (clamped 1-10) x `rpe` (clamped 6-10, linearly interpolated between integers). */
export function rpeTableFraction(reps: number, rpe: number): number {
  const clampedReps = clamp(Math.round(reps), 1, 10);
  const row = RPE_TABLE[clampedReps];
  const clampedRpe = clamp(rpe, 6, 10);
  const lower = Math.floor(clampedRpe);
  const upper = Math.ceil(clampedRpe);
  if (lower === upper) return row[lower];
  const t = clampedRpe - lower;
  return row[lower] + (row[upper] - row[lower]) * t;
}

const LOWER_BODY_PATTERNS = ['squat', 'hinge', 'olympic'];

/**
 * Default load increment (SPEC 9.1/9.3, R32) by equipment/pattern, in the
 * given units. A movement's own `increment` (if set) should be preferred by
 * callers — see `resolveIncrement`.
 */
export function defaultIncrement(movement: Movement, units: Units): number {
  if (!movement.loadable) return 0;
  if (movement.tags.includes('bodyweight')) return 0;

  const isBarbell = movement.equipment.includes('barbell');
  const isLowerBody = movement.tags.some((t) => LOWER_BODY_PATTERNS.includes(t));

  if (isBarbell && isLowerBody) return units === 'kg' ? 5 : 10;
  if (isBarbell) return units === 'kg' ? 2.5 : 5;
  if (movement.equipment.includes('dumbbell') || movement.equipment.includes('kettlebell')) {
    return units === 'kg' ? 2 : 5;
  }
  // Other loadable equipment (e.g. cable, sandbag): use the upper-body barbell step as a generic default.
  return units === 'kg' ? 2.5 : 5;
}

/** `movement.increment` if set, else `defaultIncrement`. */
export function resolveIncrement(movement: Movement, units: Units): number {
  return movement.increment ?? defaultIncrement(movement, units);
}

function roundToStep(value: number, step: number): number {
  if (step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
}

/**
 * Suggested working load (SPEC 9.3): `currentMax * RPE_TABLE[reps][rpe]`,
 * rounded to the nearest half-increment. Null when there's no known max to
 * calibrate off (the UI should then prompt to log a set).
 */
export function suggestLoad(
  movement: Movement,
  reps: number,
  targetRpe: number,
  logs: WorkoutLog[],
  units: Units,
  now: string | Date = new Date(),
): number | null {
  const max = currentMax(logs, movement.id, now);
  if (max === null) return null;
  const fraction = rpeTableFraction(reps, targetRpe);
  const step = resolveIncrement(movement, units) / 2;
  return roundToStep(max * fraction, step);
}

/**
 * Suggested load for a BlockMovement, honoring an explicit `loadPct`
 * override (SPEC 9.3) ahead of the RPE table.
 */
export function loadForBlockMovement(
  bm: BlockMovement,
  movement: Movement,
  logs: WorkoutLog[],
  units: Units,
  now: string | Date = new Date(),
): number | null {
  const reps = bm.reps ?? 5;
  if (bm.loadPct !== undefined) {
    const max = currentMax(logs, movement.id, now);
    if (max === null) return null;
    const step = resolveIncrement(movement, units) / 2;
    return roundToStep(max * (bm.loadPct / 100), step);
  }
  const targetRpe = bm.targetRpe ?? 8;
  return suggestLoad(movement, reps, targetRpe, logs, units, now);
}
