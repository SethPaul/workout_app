import type { BodyRegion, Movement } from '../types';

/**
 * SPEC 10.3: the day-of-week default region filter for Vasa's weekly focus
 * (Mon/Tue lower, Wed/Thu upper, Fri/Sat/Sun full body), evaluated in local
 * time so the app's device-local "today" always lands on the right day.
 */
export function regionForDate(date: Date): BodyRegion {
  const day = date.getDay(); // 0 = Sunday ... 6 = Saturday
  if (day === 1 || day === 2) return 'lower'; // Mon, Tue
  if (day === 3 || day === 4) return 'upper'; // Wed, Thu
  return 'full'; // Fri, Sat, Sun
}

const LOWER_TAGS = new Set(['squat', 'legs', 'hinge', 'unilateral']);
const UPPER_TAGS = new Set(['push', 'pull', 'gymnastics']);

/**
 * SPEC 10.3: a movement's body region — `region` if explicitly set, else
 * derived from its tags. Movements tagged in both lower and upper vocab (or
 * neither, e.g. pure core/cardio/carry/plyo) are 'full' so they always
 * surface regardless of the day's default filter.
 */
export function movementRegion(m: Movement): BodyRegion {
  if (m.region) return m.region;
  const lower = m.tags.some((t) => LOWER_TAGS.has(t));
  const upper = m.tags.some((t) => UPPER_TAGS.has(t));
  if (lower && upper) return 'full';
  if (lower) return 'lower';
  if (upper) return 'upper';
  return 'full';
}

/**
 * SPEC 10.3: whether `m` should surface under the given region filter.
 * 'full' accepts everything; otherwise a movement matches when its own
 * region equals `region` or is itself 'full' (so core/finisher movements
 * always surface alongside the day's main lifts).
 */
export function matchesRegion(m: Movement, region: BodyRegion): boolean {
  if (region === 'full') return true;
  const r = movementRegion(m);
  return r === region || r === 'full';
}

export const REGION_LABELS: Record<BodyRegion, string> = {
  lower: 'Lower',
  upper: 'Upper',
  full: 'Full body',
};
