import { signal } from '@preact/signals';
import { createTimer, timerReducer, type TimerEvent, type TimerState } from '../domain/timer';
import type { AppState, PoolWorkout } from '../domain/types';
import { buildResultsDraft, type ResultsDraft } from '../ui/resultsDraft';

export interface RunSession {
  poolWorkoutId: string;
  workoutSnapshot: PoolWorkout;
  startedAt: string; // ISO
  timer: TimerState;
  // The in-progress results draft, editable from mid-workout as well as the
  // finished screen (SPEC: enter weights/reps/RPE during the workout).
  draft: ResultsDraft;
}

/** The in-progress workout run, if any. Null when nothing is running. */
export const runSession = signal<RunSession | null>(null);

/** Starts a fresh run session for `workout` (does not itself dispatch 'start'). */
export function beginRunSession(
  appState: AppState,
  workout: PoolWorkout,
  now: Date = new Date(),
): void {
  runSession.value = {
    poolWorkoutId: workout.id,
    workoutSnapshot: workout,
    startedAt: now.toISOString(),
    timer: createTimer(workout.blocks, now.getTime()),
    draft: buildResultsDraft(appState, workout),
  };
}

/** Dispatches a timer event against the current run session's timer, returning the cues it fired. */
export function dispatchRun(event: TimerEvent): TimerState | null {
  const session = runSession.value;
  if (!session) return null;
  const timer = timerReducer(session.timer, event);
  runSession.value = { ...session, timer };
  return timer;
}

/** Clears the run session (after saving/discarding a run). */
export function clearRunSession(): void {
  runSession.value = null;
}

/** Updates the current run session's results draft (mid-workout entry, or the finished screen's form). */
export function updateRunDraft(fn: (draft: ResultsDraft) => ResultsDraft): void {
  const session = runSession.value;
  if (!session) return;
  runSession.value = { ...session, draft: fn(session.draft) };
}
