import type { Block, BlockMovement, MovementResult, PoolWorkout, SetResult, WorkoutLog } from '../types';

export interface AdhocSetInput {
  weight?: number;
  reps?: number;
  rpe?: number;
}

export interface AdhocEntryInput {
  movementId: string;
  sets: AdhocSetInput[];
}

export interface BuildAdhocLogInput {
  date: string | Date; // when performed; defaults to now if omitted
  entries: AdhocEntryInput[];
  notes?: string;
  maxTest?: boolean;
  /** Override for deterministic ids in tests; a fresh id is generated otherwise. */
  id?: string;
}

function generateId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${random}`;
}

function hardestSetRpe(sets: AdhocSetInput[]): number | undefined {
  const rpes = sets.map((s) => s.rpe).filter((r): r is number => r !== undefined);
  return rpes.length === 0 ? undefined : Math.max(...rpes);
}

/**
 * Builds a WorkoutLog for the "Log something else" flow (SPEC 9.8): a
 * synthetic PoolWorkout snapshot (one strength block per movement,
 * `source: 'manual'`, id `adhoc-<logId>`), so ad-hoc and max-test entries
 * count for last-performed, pattern cadence, e1rm history and fatigue flags
 * exactly like pool-sourced logs.
 */
export function buildAdhocLog(input: BuildAdhocLogInput): WorkoutLog {
  const iso = typeof input.date === 'string' ? input.date : input.date.toISOString();
  const logId = input.id ?? generateId();
  const snapshotId = `adhoc-${logId}`;

  const blocks: Block[] = input.entries.map((entry) => {
    const bm: BlockMovement = { movementId: entry.movementId };
    return { format: 'strength', movements: [bm], sets: entry.sets.length };
  });

  const workoutSnapshot: PoolWorkout = {
    id: snapshotId,
    name: input.maxTest ? 'Max test' : 'Logged workout',
    intensity: 'M',
    blocks,
    cadenceDays: 0,
    enabled: false,
    source: 'manual',
    notes: input.notes,
  };

  const results: MovementResult[] = input.entries.map((entry) => {
    const sets: SetResult[] = entry.sets.map((s) => ({ weight: s.weight, reps: s.reps }));
    return { movementId: entry.movementId, sets, rpe: hardestSetRpe(entry.sets) };
  });

  return {
    id: logId,
    poolWorkoutId: undefined,
    workoutSnapshot,
    startedAt: iso,
    finishedAt: iso,
    results,
    notes: input.notes,
    kind: input.maxTest ? 'max-test' : 'adhoc',
  };
}
