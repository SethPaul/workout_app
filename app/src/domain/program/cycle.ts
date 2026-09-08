import { daysSince } from '../cadence';
import type { Block, BlockMovement, Movement, PoolWorkout, ProgramState, Settings } from '../types';
import { resolveSettings } from './context';

/**
 * The cycle's effective start date (SPEC 9.5: "A new cycle starts ... after
 * `cycleWeeks` weeks when no deload was taken and policy is 'off'").
 *
 * Under policy 'off' there is no fatigue/calendar deload to ever end the
 * cycle, so nothing else advances `cycleStartedAt` — left alone, `cycleWeek`
 * would count up forever. This rolls it forward by whole `cycleWeeks`
 * periods so the wave (`weekKind`) keeps repeating 1,2,3,2,... instead of
 * running off the end.
 *
 * Under 'fatigue' and 'calendar' policies this returns `cycleStartedAt`
 * unchanged: the week number is meant to keep climbing past `cycleWeeks`
 * while no deload has been accepted (that's what lets `deloadSuggested` in
 * fatigue.ts apply its "1 flag + week >= cycleWeeks" rule and its week-6
 * ceiling) — rollover for those policies happens only when a deload is
 * accepted, which already resets `cycleStartedAt` elsewhere (see
 * `state/store.ts`), not by this function.
 */
export function effectiveCycleStart(program: ProgramState, settings: Settings, now: string | Date): string {
  const resolved = resolveSettings(settings);
  if (resolved.deloadPolicy !== 'off') return program.cycleStartedAt;
  const cycleWeeks = resolved.cycleWeeks;
  if (!(cycleWeeks > 0)) return program.cycleStartedAt;

  const elapsedWeeks = Math.floor(Math.max(0, daysSince(program.cycleStartedAt, now)) / 7);
  const periodsElapsed = Math.floor(elapsedWeeks / cycleWeeks);
  if (periodsElapsed <= 0) return program.cycleStartedAt;

  const advanced = new Date(program.cycleStartedAt);
  advanced.setDate(advanced.getDate() + periodsElapsed * cycleWeeks * 7);
  return advanced.toISOString();
}

/**
 * 1-based week index of the current cycle (SPEC 9.5). Not clamped to
 * `settings.cycleWeeks` — callers (deload suggestion, wave lookup) decide
 * what a week beyond the nominal cycle length means.
 *
 * `settings` is optional (and, when passed, drives automatic rollover via
 * `effectiveCycleStart`) so existing two-argument call sites keep
 * typechecking; omitting it is equivalent to a non-'off' policy — the raw
 * `cycleStartedAt` is used as-is, matching prior behavior.
 */
export function cycleWeek(program: ProgramState, now: string | Date, settings?: Settings): number {
  const start = settings === undefined ? program.cycleStartedAt : effectiveCycleStart(program, settings, now);
  const days = Math.max(0, daysSince(start, now));
  return Math.floor(days / 7) + 1;
}

/**
 * Whether an accepted deload is currently active: `deloadWeekStartedAt` is
 * set and less than 7 days have elapsed since (SPEC 9.1: "cleared after 7
 * days" — modeled here as simply expiring rather than being separately unset).
 */
export function isDeloadWeek(program: ProgramState, now: string | Date): boolean {
  if (!program.deloadWeekStartedAt) return false;
  return daysSince(program.deloadWeekStartedAt, now) < 7;
}

/**
 * SPEC 9.5's wave shape, generalized to any `cycleWeeks`: week 1 is kind 1,
 * the second-to-last week of the cycle (`cycleWeeks - 1`) is the kind-3 peak,
 * and every other week — middle weeks and the final week alike — is kind 2.
 * For `cycleWeeks` = 4 that's exactly the spec's 1,2,3,2. `week` beyond
 * `cycleWeeks` (a cycle running long with no deload yet) keeps returning 2,
 * i.e. it holds at the post-peak plateau rather than repeating the wave.
 */
export function weekKind(week: number, cycleWeeks: number): 1 | 2 | 3 {
  if (week <= 1) return 1;
  if (week === cycleWeeks - 1) return 3;
  return 2;
}

function transformBlockMovement(bm: BlockMovement, kind: 1 | 2 | 3, deload: boolean, isOlympic: boolean): BlockMovement {
  if (deload) {
    return { ...bm, targetRpe: 6 };
  }
  if (kind === 3) {
    const repFloor = isOlympic ? 2 : 3;
    const reps = bm.reps === undefined ? undefined : Math.max(repFloor, bm.reps - 1);
    return { ...bm, reps, targetRpe: 9 };
  }
  const targetRpe = kind === 1 ? 7 : 8;
  return { ...bm, targetRpe };
}

function transformStrengthBlock(
  block: Block,
  kind: 1 | 2 | 3,
  deload: boolean,
  movementById: Map<string, Movement>,
): Block {
  const movements = block.movements.map((bm) =>
    transformBlockMovement(bm, kind, deload, movementById.get(bm.movementId)?.tags.includes('olympic') ?? false),
  );
  let sets = block.sets;
  if (sets !== undefined) {
    if (deload) sets = Math.max(2, Math.ceil(sets * 0.5));
    else if (kind === 3) sets = Math.max(3, sets - 1);
  }
  return { ...block, movements, sets };
}

/** Deload-only scaling for conditioning blocks (SPEC 9.5): amrap/rounds durations and interval rounds x0.6. */
function transformConditioningBlockForDeload(block: Block): Block {
  if (block.format === 'amrap' && block.durationSec !== undefined) {
    return { ...block, durationSec: Math.max(120, Math.round(block.durationSec * 0.6)) };
  }
  if (block.format === 'rounds') {
    if (block.timeCapSec !== undefined) return { ...block, timeCapSec: Math.round(block.timeCapSec * 0.6) };
    if (block.rounds !== undefined) return { ...block, rounds: Math.max(1, Math.round(block.rounds * 0.6)) };
    return block;
  }
  if (block.format === 'interval' && block.rounds !== undefined) {
    return { ...block, rounds: Math.max(1, Math.round(block.rounds * 0.6)) };
  }
  return block; // tabata/chipper/emom/death_by: untouched, even during deload
}

/**
 * Transforms a pulled workout's strength blocks for the current cycle week
 * (SPEC 9.5), returning a deep-enough copy (new blocks/movements arrays;
 * only touched blocks/movements are new objects) — the caller stores this
 * transformed snapshot, not the original pool entry.
 *
 * `movements` resolves each strength movement's `olympic` tag for the week-3
 * rep floor; SPEC 9.5 doesn't list it as a parameter, but the rule can't be
 * applied without movement tags, so it's accepted here as an optional 5th
 * argument (empty by default: non-olympic rep floor of 3).
 */
export function applyWave(
  workout: PoolWorkout,
  week: number,
  deload: boolean,
  settings: Settings,
  movements: Movement[] = [],
): PoolWorkout {
  const movementById = new Map(movements.map((m) => [m.id, m]));
  const kind = weekKind(week, resolveSettings(settings).cycleWeeks);

  const blocks = workout.blocks.map((block) => {
    if (block.format === 'strength') return transformStrengthBlock(block, kind, deload, movementById);
    return deload ? transformConditioningBlockForDeload(block) : block;
  });

  const notes = deload ? (workout.notes ? `${workout.notes} Deload week` : 'Deload week') : workout.notes;

  return { ...workout, blocks, notes };
}
