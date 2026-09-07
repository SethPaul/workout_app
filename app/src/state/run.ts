import { signal } from '@preact/signals';
import { createTimer, timerReducer, type TimerEvent, type TimerState } from '../domain/timer';
import type { PoolWorkout } from '../domain/types';

export interface RunSession {
  poolWorkoutId: string;
  workoutSnapshot: PoolWorkout;
  startedAt: string; // ISO
  timer: TimerState;
}

/** The in-progress workout run, if any. Null when nothing is running. */
export const runSession = signal<RunSession | null>(null);

/** Starts a fresh run session for `workout` (does not itself dispatch 'start'). */
export function beginRunSession(workout: PoolWorkout, now: Date = new Date()): void {
  runSession.value = {
    poolWorkoutId: workout.id,
    workoutSnapshot: workout,
    startedAt: now.toISOString(),
    timer: createTimer(workout.blocks, now.getTime()),
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
