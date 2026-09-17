import type {
  AppState,
  Block,
  BlockOutcome,
  MovementResult,
  PoolWorkout,
  WorkoutLog,
} from '../domain/types';
import { resolveSettings } from '../domain/program/context';
import { loadForBlockMovement } from '../domain/program/rpe';
import { formatClock, movementById } from './helpers';

/** One editable strength set (Run's results form and EditLog share this shape). */
export interface SetDraft {
  weight: string;
  reps: string;
  rpe: string;
}

/** One movement's editable results (SPEC 9.9 results form / EditLog). */
export interface MovementDraft {
  movementId: string;
  blockIndex: number; // index into workout.blocks — one draft entry per (block, movement)
  sets?: SetDraft[]; // present for strength-block movements: one entry per set
  weight?: string; // present for non-strength (single-entry) movements
  reps?: string;
  // Movement-level RPE. For entries with `sets`, this is a fallback used only
  // when no set has its own rpe (older logs, or non-strength single entries
  // where there's no per-set RPE to begin with).
  rpe: string;
}

export interface ResultsDraft {
  movements: MovementDraft[];
  score: string;
  rpe: string;
  notes: string;
  /** Per-block outcomes captured by the timer (rounds done, elapsed clock, fail minute); see `domain/timer.ts`. */
  blockOutcomes: BlockOutcome[];
  /** True until the user types into the Score field; while true, `applyBlockOutcomes` is free to keep `score` in sync. */
  scoreAuto: boolean;
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
 * "finished" screen, and now also usable mid-workout): one entry per
 * (block, movement) pair in block order — a movement appearing in more than
 * one block (e.g. cleans in both a strength block and a conditioning block)
 * gets one entry per block rather than being deduped. Strength-block
 * movements get one set per prescribed set (prefilled with the suggested
 * load), everything else gets a single weight/reps entry.
 */
export function buildResultsDraft(appState: AppState, workout: PoolWorkout): ResultsDraft {
  const movements: MovementDraft[] = [];

  workout.blocks.forEach((block, blockIndex) => {
    for (const bm of block.movements) {
      if (block.format === 'strength') {
        const suggested = suggestedWeightStr(appState, bm);
        const sets: SetDraft[] = Array.from({ length: block.sets ?? 1 }, () => ({
          weight: suggested,
          reps: bm.reps !== undefined ? String(bm.reps) : '',
          rpe: '',
        }));
        movements.push({ movementId: bm.movementId, blockIndex, sets, rpe: '' });
      } else {
        movements.push({
          movementId: bm.movementId,
          blockIndex,
          weight: '',
          reps: bm.reps !== undefined ? String(bm.reps) : '',
          rpe: '',
        });
      }
    }
  });

  return { movements, score: '', rpe: '', notes: '', blockOutcomes: [], scoreAuto: true };
}

/**
 * Formats one block's captured outcome as a short score fragment, e.g. "7
 * rounds" (amrap), "12:34" (rounds/chipper, for-time), "failed at minute 9"
 * (death_by). Returns '' for a skipped-status entry's format-specific text is
 * not applicable — 'skipped' — and for formats with nothing to score
 * (strength/emom/tabata/interval).
 */
export function formatBlockOutcome(outcome: BlockOutcome, block: Block): string {
  if (outcome.status === 'skipped') return 'skipped';
  if (outcome.status === 'failed') {
    return outcome.failedAtMinute !== undefined
      ? `failed at minute ${outcome.failedAtMinute}`
      : 'failed';
  }
  switch (block.format) {
    case 'amrap':
      return outcome.roundsDone !== undefined ? `${outcome.roundsDone} rounds` : '';
    case 'rounds':
    case 'chipper':
      return formatClock(outcome.elapsedMs);
    default:
      return '';
  }
}

/**
 * Joins every block's non-empty `formatBlockOutcome` text into one score
 * string, prefixed with the block's title when the workout has more than one
 * block (e.g. "Main: 7 rounds · Finisher: 4:12"), or bare when there's just one.
 */
export function scoreFromOutcomes(outcomes: BlockOutcome[], snapshot: PoolWorkout): string {
  const multiBlock = snapshot.blocks.length > 1;
  const parts = [...outcomes]
    .sort((a, b) => a.blockIndex - b.blockIndex)
    .map((outcome) => {
      const block = snapshot.blocks[outcome.blockIndex];
      if (!block) return '';
      const text = formatBlockOutcome(outcome, block);
      if (!text) return '';
      const title = block.title || `Block ${outcome.blockIndex + 1}`;
      return multiBlock ? `${title}: ${text}` : text;
    })
    .filter((s) => s.length > 0);
  return parts.join(' · ');
}

/**
 * Records the timer's captured block outcomes onto the draft, and — as long
 * as the user hasn't typed a custom score (`draft.scoreAuto`) — keeps
 * `draft.score` in sync with them. Called from `dispatchRun` whenever the
 * timer records a new block outcome.
 */
export function applyBlockOutcomes(
  draft: ResultsDraft,
  outcomes: BlockOutcome[],
  snapshot: PoolWorkout,
): ResultsDraft {
  const next: ResultsDraft = { ...draft, blockOutcomes: outcomes };
  if (draft.scoreAuto) next.score = scoreFromOutcomes(outcomes, snapshot);
  return next;
}

/**
 * Builds a results draft from an already-saved log's own results, for
 * editing (EditLog). Unlike `buildResultsDraft`, this reads the log's actual
 * values rather than suggesting a load.
 */
export function draftFromLog(log: WorkoutLog): ResultsDraft {
  /** First block in the snapshot containing this movement, for results saved before blockIndex existed. */
  function inferBlockIndex(movementId: string): number {
    const idx = log.workoutSnapshot.blocks.findIndex((b) =>
      b.movements.some((bm) => bm.movementId === movementId),
    );
    return idx >= 0 ? idx : 0;
  }

  const movements: MovementDraft[] = log.results.map((r) => {
    const blockIndex = r.blockIndex ?? inferBlockIndex(r.movementId);
    if (r.sets) {
      const anySetRpe = r.sets.some((s) => s.rpe !== undefined);
      return {
        movementId: r.movementId,
        blockIndex,
        sets: r.sets.map((s) => ({
          weight: numToStr(s.weight),
          reps: numToStr(s.reps),
          rpe: numToStr(s.rpe),
        })),
        // Older logs (or non-strength entries) only ever stored a
        // movement-level RPE — surface it as a fallback rather than copying
        // it onto every set.
        rpe: anySetRpe ? '' : numToStr(r.rpe),
      };
    }
    return {
      movementId: r.movementId,
      blockIndex,
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
    blockOutcomes: log.blockOutcomes ?? [],
    // A saved log's score was either typed by hand or already finalized on
    // save; editing it should never be silently overwritten by re-deriving
    // it from the block outcomes.
    scoreAuto: false,
  };
}

/** Converts a draft's per-movement entries into `MovementResult[]` (shared by Run's save and `logFromDraft`). */
export function resultsFromDraft(movements: MovementDraft[]): MovementResult[] {
  return movements.map((m) => {
    if (m.sets) {
      const sets = m.sets.map((s) => ({
        weight: numOrUndef(s.weight),
        reps: numOrUndef(s.reps),
        rpe: numOrUndef(s.rpe),
      }));
      const setRpes = sets.map((s) => s.rpe).filter((r): r is number => r !== undefined);
      // Hardest set wins; fall back to the movement-level field when no set
      // has its own RPE (legacy logs / RPE entered before any set was filled in).
      const rpe = setRpes.length > 0 ? Math.max(...setRpes) : numOrUndef(m.rpe);
      return { movementId: m.movementId, blockIndex: m.blockIndex, sets, rpe };
    }
    return {
      movementId: m.movementId,
      blockIndex: m.blockIndex,
      weight: numOrUndef(m.weight),
      reps: numOrUndef(m.reps),
      rpe: numOrUndef(m.rpe),
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
