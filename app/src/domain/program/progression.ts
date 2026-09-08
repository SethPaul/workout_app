import type { Block, BlockMovement, Movement, Settings, WorkoutLog } from '../types';
import { resolveIncrement } from './rpe';
import { logKind, resolveSettings } from './context';

export type ProgressionMode = 'linear' | 'double';
export type ProgressionStatusValue = 'progress' | 'hold' | 'stall' | 'unknown';

export interface ProgressionResult {
  mode: ProgressionMode;
  lastLoad: number | null;
  lastReps: number | null;
  nextLoad: number | null;
  nextReps: number | null;
  status: ProgressionStatusValue;
  stallCount: number;
  suggestion: string;
}

/** A strength-block session for one movement: the log, the block, and its BlockMovement entry. */
export interface MovementSession {
  log: WorkoutLog;
  block: Block;
  bm: BlockMovement;
}

/**
 * Strength-block sessions for `movementId`, most recent first (SPEC 9.4).
 * Pool sessions only: adhoc and max-test logs get a synthetic single-block
 * snapshot with no prescribed reps/sets, so they can't be judged against a
 * target here (or by the fatigue signals built on top of this) — max-test
 * logs still feed `currentMax` directly, via e1rm.ts, unaffected by this.
 */
export function strengthSessionsForMovement(movementId: string, logs: WorkoutLog[]): MovementSession[] {
  const sessions: MovementSession[] = [];
  for (const log of logs) {
    if (logKind(log) !== 'pool') continue;
    for (const block of log.workoutSnapshot.blocks) {
      if (block.format !== 'strength') continue;
      const bm = block.movements.find((m) => m.movementId === movementId);
      if (!bm) continue;
      sessions.push({ log, block, bm });
    }
  }
  return sessions.sort((a, b) => b.log.finishedAt.localeCompare(a.log.finishedAt));
}

function setsFor(session: MovementSession): { weight?: number; reps?: number }[] {
  const result = session.log.results.find((r) => r.movementId === session.bm.movementId);
  if (!result) return [];
  if (result.sets && result.sets.length > 0) return result.sets;
  if (result.weight !== undefined || result.reps !== undefined) return [{ weight: result.weight, reps: result.reps }];
  return [];
}

function rpeFor(session: MovementSession): number | undefined {
  return session.log.results.find((r) => r.movementId === session.bm.movementId)?.rpe;
}

function defaultMode(movement: Movement): ProgressionMode {
  return movement.equipment.includes('barbell') ? 'linear' : 'double';
}

function defaultRepRange(movement: Movement): [number, number] {
  return movement.tags.includes('accessory') ? [6, 8] : [3, 5];
}

/** Prescribed reps for a session, falling back to the movement's rep range floor. */
function prescribedReps(session: MovementSession, mode: ProgressionMode, repRange: [number, number]): number {
  if (session.bm.reps !== undefined) return session.bm.reps;
  return mode === 'double' ? repRange[0] : repRange[1];
}

function heaviestSetLoadAndReps(sets: { weight?: number; reps?: number }[]): { load: number | null; reps: number | null } {
  let load: number | null = null;
  let reps: number | null = null;
  for (const set of sets) {
    if (set.weight === undefined) continue;
    if (load === null || set.weight > load) {
      load = set.weight;
      reps = set.reps ?? null;
    }
  }
  return { load, reps };
}

/** Whether at least the prescribed `block.sets` were logged (no prescription on record always passes). */
function metSetCount(session: MovementSession, setsLogged: number): boolean {
  const prescribed = session.block.sets;
  return prescribed === undefined || setsLogged >= prescribed;
}

function linearSuccess(session: MovementSession, targetRpe: number, repRangeMax: number): boolean {
  const sets = setsFor(session);
  if (sets.length === 0) return false;
  if (!metSetCount(session, sets.length)) return false;
  const target = session.bm.reps ?? repRangeMax;
  const repsOk = sets.every((s) => s.reps !== undefined && s.reps >= target);
  const rpe = rpeFor(session);
  const rpeOk = rpe === undefined || rpe <= targetRpe + 0.5;
  return repsOk && rpeOk;
}

function doubleTopped(session: MovementSession, repRange: [number, number]): boolean {
  const sets = setsFor(session);
  if (sets.length === 0) return false;
  if (!metSetCount(session, sets.length)) return false;
  return sets.every((s) => s.reps !== undefined && s.reps >= repRange[1]);
}

/** Best-set (weight, reps) actually logged this session, for gain comparisons (double progression). */
function sessionBest(session: MovementSession): { load: number | null; reps: number | null } {
  return heaviestSetLoadAndReps(setsFor(session));
}

/**
 * Progression status and next-target suggestion for a movement (SPEC 9.4,
 * R30-R33), based on its last two strength-block sessions.
 */
export function progressionStatus(movement: Movement, logs: WorkoutLog[], settings: Settings): ProgressionResult {
  const resolved = resolveSettings(settings);
  const mode = movement.progression ?? defaultMode(movement);
  const repRange = movement.repRange ?? defaultRepRange(movement);
  const increment = resolveIncrement(movement, resolved.units);

  const sessions = strengthSessionsForMovement(movement.id, logs);
  if (sessions.length === 0) {
    return {
      mode,
      lastLoad: null,
      lastReps: null,
      nextLoad: null,
      nextReps: null,
      status: 'unknown',
      stallCount: 0,
      suggestion: 'Log a set to start tracking progression.',
    };
  }

  const latest = sessions[0];
  const { load: lastLoad, reps: lastReps } = sessionBest(latest);

  // Walk backward from the most recent session, counting how many
  // consecutive sessions in a row failed to progress.
  let stallCount = 0;
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    let progressed: boolean;
    if (mode === 'linear') {
      progressed = linearSuccess(session, session.bm.targetRpe ?? 8, prescribedReps(session, mode, repRange));
    } else {
      // double: a session "progressed" if it topped its rep range (load will
      // step next time), or if it out-did the session before it.
      if (doubleTopped(session, repRange)) {
        progressed = true;
      } else if (i + 1 < sessions.length) {
        const prev = sessionBest(sessions[i + 1]);
        const cur = sessionBest(session);
        const loadGain = (cur.load ?? 0) > (prev.load ?? 0);
        const repGain = (cur.load ?? 0) === (prev.load ?? 0) && (cur.reps ?? 0) > (prev.reps ?? 0);
        progressed = loadGain || repGain;
      } else {
        progressed = true; // no earlier session to compare against: don't penalize
      }
    }
    if (progressed) break;
    stallCount++;
  }

  const status: ProgressionStatusValue = stallCount >= 2 ? 'stall' : stallCount === 1 ? 'hold' : 'progress';

  let nextLoad: number | null = lastLoad;
  let nextReps: number | null = lastReps;
  let suggestion: string;

  if (status === 'progress') {
    if (mode === 'linear') {
      nextLoad = lastLoad === null ? null : lastLoad + increment;
      nextReps = lastReps;
      suggestion =
        nextLoad === null
          ? 'Log the load you used to get a next target.'
          : `Add ${increment} to reach ${nextLoad} for ${nextReps ?? prescribedReps(latest, mode, repRange)} reps.`;
    } else if (doubleTopped(latest, repRange)) {
      nextLoad = lastLoad === null ? null : lastLoad + increment;
      nextReps = repRange[0];
      suggestion = `Hit the top of the rep range — add ${increment} and reset to ${nextReps} reps.`;
    } else {
      nextLoad = lastLoad;
      nextReps = Math.min((lastReps ?? repRange[0]) + 1, repRange[1]);
      suggestion = nextLoad === null ? `Add a rep: aim for ${nextReps} reps.` : `Add a rep: aim for ${nextReps} reps at ${nextLoad}.`;
    }
  } else if (status === 'hold') {
    nextLoad = lastLoad;
    nextReps = lastReps;
    suggestion =
      lastLoad === null || lastReps === null
        ? "Repeat last session — one miss isn't a stall yet."
        : `Repeat ${lastLoad} for ${lastReps} reps — one miss isn't a stall yet.`;
  } else {
    // stall
    const cutLoad = lastLoad === null ? null : Math.round((lastLoad * 0.9) / (increment > 0 ? increment / 2 : 1)) * (increment > 0 ? increment / 2 : 1);
    nextLoad = cutLoad;
    nextReps = mode === 'double' ? repRange[0] : lastReps;
    suggestion =
      stallCount >= 4
        ? 'Two stalls in a row — consider a scheme change (e.g. 5x5 -> 3x5, or shift the rep range).'
        : `Stalled — cut load about 10% (to ${cutLoad ?? '?'}) for one session, then resume.`;
  }

  return { mode, lastLoad, lastReps, nextLoad, nextReps, status, stallCount, suggestion };
}
