import { daysSince } from '../cadence';
import type {
  Block,
  BlockMovement,
  BodyRegion,
  Movement,
  PoolWorkout,
  VasaStyle,
  WorkoutLog,
} from '../types';
import { textMatchScore } from './search';
import { REGION_LABELS } from './region';
import { VASA_STYLE_SHORT_LABELS } from './library';

export interface EnteredMovement {
  movementId: string;
  sets?: number;
  reps?: number;
  seconds?: number;
}

export interface EnteredBlock {
  role: 'main' | 'accessory' | 'finisher';
  title: string;
  movements: EnteredMovement[];
}

export interface BuildEnteredWorkoutInput {
  name?: string; // default: defaultWorkoutName(region, style, date)
  date: string; // YYYY-MM-DD (for the default name)
  region: BodyRegion;
  style?: VasaStyle;
  blocks: EnteredBlock[];
  notes?: string;
  /** Override for deterministic ids in tests; a fresh id is generated otherwise. */
  id?: string;
}

const RECENCY_WINDOW_DAYS = 30;
const DEFAULT_LIMIT = 8;

function generateId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${random}`;
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * SPEC 10.8: "Lower · Build · Sep 15" (no style: "Lower · Sep 15"). `date` is
 * a bare "YYYY-MM-DD" string parsed at local noon (matches `build.ts`'s
 * former `resolveIso`), so the month/day always land on the calendar date as
 * typed regardless of host timezone.
 */
export function defaultWorkoutName(
  region: BodyRegion,
  style: VasaStyle | undefined,
  date: string,
): string {
  const d = new Date(`${date}T12:00:00`);
  const dateLabel = `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  const parts = [
    REGION_LABELS[region],
    ...(style ? [VASA_STYLE_SHORT_LABELS[style]] : []),
    dateLabel,
  ];
  return parts.join(' · ');
}

/**
 * SPEC 10.8: builds a `PoolWorkout` for the "Enter a workout" flow — the
 * pivot from 10.3's `buildVasaLog`: the product is a pool entry (startable,
 * loggable via the ordinary Run screen), not a standalone log kind.
 *
 * Blocks with no movements are dropped. main/accessory -> `format:
 * 'strength'`, `sets` = the largest `sets` among their movements (default
 * 3); each movement carries its `reps`/`seconds` when given. finisher ->
 * `format: 'amrap'`, `durationSec: 120`. `tags` mark it as an entered
 * workout (`isEnteredWorkout`) and carry its region/style
 * (`workoutRegion`/`workoutStyle`).
 */
export function buildEnteredWorkout(input: BuildEnteredWorkoutInput): PoolWorkout {
  const id = input.id ?? `entered-${generateId()}`;
  const nonEmptyBlocks = input.blocks.filter((b) => b.movements.length > 0);

  const blocks: Block[] = nonEmptyBlocks.map((block) => {
    const movements: BlockMovement[] = block.movements.map((m) => ({
      movementId: m.movementId,
      reps: m.reps,
      seconds: m.seconds,
    }));
    if (block.role === 'finisher') {
      return { format: 'amrap', title: block.title, movements, durationSec: 120 };
    }
    const given = block.movements.map((m) => m.sets).filter((s): s is number => s !== undefined);
    const sets = given.length > 0 ? Math.max(...given) : 3;
    return { format: 'strength', title: block.title, movements, sets };
  });

  const tags = ['vasa', `region:${input.region}`, ...(input.style ? [`style:${input.style}`] : [])];

  return {
    id,
    name: input.name ?? defaultWorkoutName(input.region, input.style, input.date),
    intensity: 'M',
    blocks,
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
    tags,
    notes: input.notes,
  };
}

/** SPEC 10.8: the region from a `region:<r>` tag, or null when untagged. */
export function workoutRegion(w: PoolWorkout): BodyRegion | null {
  const tag = w.tags?.find((t) => t.startsWith('region:'));
  return (tag?.slice('region:'.length) as BodyRegion | undefined) ?? null;
}

/** SPEC 10.8: the style from a `style:<s>` tag, or null when untagged/absent. */
export function workoutStyle(w: PoolWorkout): VasaStyle | null {
  const tag = w.tags?.find((t) => t.startsWith('style:'));
  return (tag?.slice('style:'.length) as VasaStyle | undefined) ?? null;
}

/** SPEC 10.8: whether `w` was entered via the "Enter a workout" flow (carries the `vasa` tag). */
export function isEnteredWorkout(w: PoolWorkout): boolean {
  return w.tags?.includes('vasa') ?? false;
}

/** Latest `finishedAt` among logs of this exact pool workout (by id or by snapshot id), or null. */
function lastPerformedPoolWorkout(logs: WorkoutLog[], workoutId: string): string | null {
  let latest: string | null = null;
  for (const log of logs) {
    if (log.poolWorkoutId !== workoutId && log.workoutSnapshot.id !== workoutId) continue;
    if (latest === null || log.finishedAt > latest) latest = log.finishedAt;
  }
  return latest;
}

export interface SearchPoolOptions {
  region: BodyRegion;
  logs: WorkoutLog[];
  now: Date;
  limit?: number;
}

/**
 * SPEC 10.8: ranks pool workouts for the `/enter` search. A workout's match
 * candidates are its name, its tags, and the names of its movements
 * (`textMatchScore`, SPEC 10.7's tiers); a non-empty query with no match at
 * any tier excludes the workout. Boosts: `workoutRegion` equals
 * `opts.region` +8 (only when region !== 'full'); entered workout +4; last
 * performed within 30 days +3; disabled -5 (still shown, never hidden).
 * Ties by name. Default limit 8.
 */
export function searchPool(
  pool: PoolWorkout[],
  movements: Movement[],
  query: string,
  opts: SearchPoolOptions,
): PoolWorkout[] {
  const q = query.trim();
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const movementNameById = new Map(movements.map((m) => [m.id, m.name]));

  const scored: { workout: PoolWorkout; score: number }[] = [];
  for (const w of pool) {
    if (q !== '') {
      const movementNames = w.blocks.flatMap((b) =>
        b.movements.map((m) => movementNameById.get(m.movementId) ?? ''),
      );
      const candidates = [w.name, ...(w.tags ?? []), ...movementNames];
      const score = textMatchScore(q, candidates);
      if (score === 0) continue; // no match: excluded
      scored.push({ workout: w, score: score + boost(w, opts) });
      continue;
    }
    scored.push({ workout: w, score: boost(w, opts) });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.workout.name.localeCompare(b.workout.name);
  });

  return scored.slice(0, limit).map((s) => s.workout);
}

function boost(w: PoolWorkout, opts: SearchPoolOptions): number {
  let score = 0;
  if (opts.region !== 'full' && workoutRegion(w) === opts.region) score += 8;
  if (isEnteredWorkout(w)) score += 4;
  const last = lastPerformedPoolWorkout(opts.logs, w.id);
  if (last !== null && daysSince(last, opts.now) <= RECENCY_WINDOW_DAYS) score += 3;
  if (!w.enabled) score -= 5;
  return score;
}
