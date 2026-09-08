import type { AppState, MovementResult, PoolWorkout, WorkoutLog } from '../domain/types';
import { resolveSettings } from '../domain/program/context';
import { loadForBlockMovement } from '../domain/program/rpe';
import { movementById } from './helpers';

/** One editable strength set (Run's results form and EditLog share this shape). */
export interface SetDraft {
  weight: string;
  reps: string;
}

/** One movement's editable results (SPEC 9.9 results form / EditLog). */
export interface MovementDraft {
  movementId: string;
  sets?: SetDraft[]; // present for strength-block movements: one entry per set
  weight?: string; // present for non-strength (single-entry) movements
  reps?: string;
  rpe: string; // per-movement RPE of the hardest set, optional
}

export interface ResultsDraft {
  movements: MovementDraft[];
  score: string;
  rpe: string;
  notes: string;
}

function numToStr(n: number | undefined): string {
  return n === undefined ? '' : String(n);
}

function numOrUndef(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t ? Number(t) : undefined;
}

/** Suggested weight for a strength BlockMovement (SPEC 9.3/9.9), as a prefill string, or '' when there's no known max yet. */
function suggestedWeightStr(
  appState: AppState,
  bm: { movementId: string; reps?: number; targetRpe?: number; loadPct?: number },
): string {
  const mv = movementById(appState, bm.movementId);
  if (!mv || !mv.loadable) return '';
  const units = resolveSettings(appState.settings).units;
  const load = loadForBlockMovement(bm, mv, appState.logs, units, new Date());
  return load === null ? '' : String(load);
}

/**
 * Builds a fresh results draft for a workout about to be logged (Run's
 * "finished" screen): one entry per movement, strength-block movements get
 * one set per prescribed set (prefilled with the suggested load), everything
 * else gets a single weight/reps entry.
 */
export function buildResultsDraft(appState: AppState, workout: PoolWorkout): ResultsDraft {
  const seen = new Set<string>();
  const movements: MovementDraft[] = [];

  for (const block of workout.blocks) {
    if (block.format !== 'strength') continue;
    for (const bm of block.movements) {
      if (seen.has(bm.movementId)) continue;
      seen.add(bm.movementId);
      const suggested = suggestedWeightStr(appState, bm);
      const sets: SetDraft[] = Array.from({ length: block.sets ?? 1 }, () => ({
        weight: suggested,
        reps: bm.reps !== undefined ? String(bm.reps) : '',
      }));
      movements.push({ movementId: bm.movementId, sets, rpe: '' });
    }
  }

  for (const block of workout.blocks) {
    for (const bm of block.movements) {
      if (seen.has(bm.movementId)) continue;
      seen.add(bm.movementId);
      movements.push({
        movementId: bm.movementId,
        weight: '',
        reps: bm.reps !== undefined ? String(bm.reps) : '',
        rpe: '',
      });
    }
  }

  return { movements, score: '', rpe: '', notes: '' };
}

/**
 * Builds a results draft from an already-saved log's own results, for
 * editing (EditLog). Unlike `buildResultsDraft`, this reads the log's actual
 * values rather than suggesting a load.
 */
export function draftFromLog(log: WorkoutLog): ResultsDraft {
  const movements: MovementDraft[] = log.results.map((r) => {
    if (r.sets) {
      return {
        movementId: r.movementId,
        sets: r.sets.map((s) => ({ weight: numToStr(s.weight), reps: numToStr(s.reps) })),
        rpe: numToStr(r.rpe),
      };
    }
    return {
      movementId: r.movementId,
      weight: numToStr(r.weight),
      reps: numToStr(r.reps),
      rpe: numToStr(r.rpe),
    };
  });

  return {
    movements,
    score: log.score ?? '',
    rpe: numToStr(log.rpe),
    notes: log.notes ?? '',
  };
}

/** Converts a draft's per-movement entries into `MovementResult[]` (shared by Run's save and `logFromDraft`). */
export function resultsFromDraft(movements: MovementDraft[]): MovementResult[] {
  return movements.map((m) => {
    const rpe = numOrUndef(m.rpe);
    if (m.sets) {
      return {
        movementId: m.movementId,
        sets: m.sets.map((s) => ({ weight: numOrUndef(s.weight), reps: numOrUndef(s.reps) })),
        rpe,
      };
    }
    return {
      movementId: m.movementId,
      weight: numOrUndef(m.weight),
      reps: numOrUndef(m.reps),
      rpe,
    };
  });
}

/**
 * Applies an edited draft back onto a log, replacing only its
 * results/score/rpe/notes and preserving everything else (id,
 * poolWorkoutId, workoutSnapshot, kind, timing, ...).
 */
export function logFromDraft(log: WorkoutLog, draft: ResultsDraft): WorkoutLog {
  return {
    ...log,
    results: resultsFromDraft(draft.movements),
    score: draft.score.trim() || undefined,
    notes: draft.notes.trim() || undefined,
    rpe: numOrUndef(draft.rpe),
  };
}
