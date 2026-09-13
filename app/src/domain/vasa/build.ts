import type {
  Block,
  BlockMovement,
  BodyRegion,
  MovementResult,
  PoolWorkout,
  SetResult,
  VasaStyle,
  WorkoutLog,
} from '../types';
import { REGION_LABELS } from './region';
import { VASA_STYLE_LABELS } from './library';

export interface VasaSetInput {
  weight?: number;
  reps?: number;
}

export interface VasaMovementInput {
  movementId: string;
  sets: VasaSetInput[];
  notes?: string;
}

export interface VasaBlockInput {
  role: 'main' | 'accessory' | 'finisher';
  title: string;
  movements: VasaMovementInput[];
}

export interface BuildVasaLogInput {
  date: string | Date; // when performed; a bare "YYYY-MM-DD" string means local noon
  region: BodyRegion;
  style?: VasaStyle;
  blocks: VasaBlockInput[];
  notes?: string;
  rpe?: number;
  /** Override for deterministic ids in tests; a fresh id is generated otherwise. */
  id?: string;
}

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

function generateId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${random}`;
}

/** A bare "YYYY-MM-DD" date means local noon (matches AdhocLog.tsx's `${date}T12:00:00`). */
function resolveIso(date: string | Date): string {
  if (typeof date !== 'string') return date.toISOString();
  if (BARE_DATE.test(date)) return new Date(`${date}T12:00:00`).toISOString();
  return date;
}

function hasValue(s: VasaSetInput): boolean {
  return s.weight !== undefined || s.reps !== undefined;
}

/**
 * Builds a WorkoutLog for a Vasa studio class (SPEC 10.1/10.3): a synthetic
 * PoolWorkout snapshot with one strength block per main/accessory block plus
 * a 2-minute AMRAP finisher, `source: 'manual'`, id `vasa-<logId>`. Because
 * main/accessory blocks are `strength`, Vasa logs feed last-performed, the
 * pattern cadence gate, e1rm history, progression and fatigue flags exactly
 * like pool logs.
 */
export function buildVasaLog(input: BuildVasaLogInput): WorkoutLog {
  const iso = resolveIso(input.date);
  const logId = input.id ?? generateId();
  const snapshotId = `vasa-${logId}`;

  const nonEmptyBlocks = input.blocks.filter((b) => b.movements.length > 0);

  const blocks: Block[] = nonEmptyBlocks.map((block) => {
    const movements: BlockMovement[] = block.movements.map((m) => ({ movementId: m.movementId }));
    if (block.role === 'finisher') {
      return { format: 'amrap', title: block.title, movements, durationSec: 120 };
    }
    const sets = Math.max(1, ...block.movements.map((m) => m.sets.length));
    return { format: 'strength', title: block.title, movements, sets };
  });

  const results: MovementResult[] = nonEmptyBlocks.flatMap((block, blockIndex) =>
    block.movements.map((m) => {
      const sets: SetResult[] = m.sets
        .filter(hasValue)
        .map((s) => ({ weight: s.weight, reps: s.reps }));
      return { movementId: m.movementId, sets, notes: m.notes, blockIndex };
    }),
  );

  const name =
    `Vasa LFT · ${REGION_LABELS[input.region]}` +
    (input.style ? ` · ${VASA_STYLE_LABELS[input.style]}` : '');

  const tags = ['vasa', `region:${input.region}`, ...(input.style ? [`style:${input.style}`] : [])];

  const workoutSnapshot: PoolWorkout = {
    id: snapshotId,
    name,
    intensity: 'M',
    blocks,
    cadenceDays: 0,
    enabled: false,
    source: 'manual',
    tags,
    notes: input.notes,
  };

  return {
    id: logId,
    poolWorkoutId: undefined,
    workoutSnapshot,
    startedAt: iso,
    finishedAt: iso,
    results,
    notes: input.notes,
    rpe: input.rpe,
    kind: 'vasa',
    vasa: { region: input.region, style: input.style },
  };
}

/**
 * The most recent log of any kind containing `movementId` (SPEC 10.3), for
 * the picker's "last: 185×8, 185×8 · 3 Sep" hint.
 */
export function lastVasaSets(
  logs: WorkoutLog[],
  movementId: string,
): { date: string; sets: SetResult[] } | null {
  let best: WorkoutLog | null = null;
  for (const log of logs) {
    const containsMovement = log.workoutSnapshot.blocks.some((block) =>
      block.movements.some((m) => m.movementId === movementId),
    );
    if (!containsMovement) continue;
    if (best === null || log.finishedAt > best.finishedAt) best = log;
  }
  if (best === null) return null;
  const sets = best.results.filter((r) => r.movementId === movementId).flatMap((r) => r.sets ?? []);
  return { date: best.finishedAt, sets };
}
