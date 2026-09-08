import { daysSince } from '../cadence';
import type { Block, BlockMovement, Movement, PoolWorkout, ProgramState, Settings } from '../types';

/**
 * 1-based week index of the current cycle (SPEC 9.5). Not clamped to
 * `settings.cycleWeeks` — callers (deload suggestion, wave lookup) decide
 * what a week beyond the nominal cycle length means.
 */
export function cycleWeek(program: ProgramState, now: string | Date): number {
  const days = Math.max(0, daysSince(program.cycleStartedAt, now));
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
 * SPEC 9.5 defines the wave explicitly only for weeks 1-4 of a 4-week
 * cycle (week 4 == week 2). For a cycle longer than 4 weeks, or any week
 * count past the nominal cycle length, this extends the same shape: week 3
 * is the peak week and repeats every other week after week 2, i.e.
 * 1,2,3,2,3,2,3,... — never left ambiguous, always one of the three
 * defined shapes.
 */
function weekKind(week: number): 1 | 2 | 3 {
  if (week <= 1) return 1;
  if (week === 2) return 2;
  if (week === 3) return 3;
  return week % 2 === 0 ? 2 : 3;
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
    return { ...block, durationSec: Math.round(block.durationSec * 0.6) };
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
  void settings; // reserved: cycleWeeks/masters don't change the wave shape itself, only which week is passed in
  const movementById = new Map(movements.map((m) => [m.id, m]));
  const kind = weekKind(week);

  const blocks = workout.blocks.map((block) => {
    if (block.format === 'strength') return transformStrengthBlock(block, kind, deload, movementById);
    return deload ? transformConditioningBlockForDeload(block) : block;
  });

  const notes = deload ? (workout.notes ? `${workout.notes} Deload week` : 'Deload week') : workout.notes;

  return { ...workout, blocks, notes };
}
