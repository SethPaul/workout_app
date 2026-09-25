import type { Cue } from './timer';

/**
 * The warm-up stopwatch shown on the Run screen's "Ready" step, before the
 * workout timer starts. A plain count-up clock with a target (default 5 min)
 * that rings a bell once when reached, so "cycle easy for 5 minutes" can be
 * timed without starting the workout proper. Pure and reducer-shaped like
 * `timer.ts`; `state/run.ts` owns the instance and its persistence.
 */
export interface WarmupState {
  running: boolean;
  /** Accumulated elapsed ms as of the last tick (or pause). */
  elapsedMs: number;
  /** Bell target in ms; the bell fires once when `elapsedMs` first reaches it. */
  targetMs: number;
  bellFired: boolean;
  /** Internal: wall-clock ms of the last tick while running. */
  _lastTickAt?: number;
}

export const WARMUP_TARGET_OPTIONS_MIN = [3, 5, 8, 10] as const;
export const DEFAULT_WARMUP_TARGET_MS = 5 * 60 * 1000;

export type WarmupEvent =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'reset' }
  | { type: 'setTarget'; targetMs: number };

export function createWarmup(targetMs: number = DEFAULT_WARMUP_TARGET_MS): WarmupState {
  return { running: false, elapsedMs: 0, targetMs, bellFired: false };
}

/**
 * Applies one event. Returns the next state and the cues it fired (at most
 * one bell, the first time elapsed reaches the target). Ticks while not
 * running are no-ops, so a stale interval can never add time.
 */
export function warmupReducer(
  state: WarmupState,
  event: WarmupEvent,
): { warmup: WarmupState; cues: Cue[] } {
  switch (event.type) {
    case 'start':
      if (state.running) return { warmup: state, cues: [] };
      return { warmup: { ...state, running: true, _lastTickAt: event.now }, cues: [] };

    case 'pause': {
      if (!state.running) return { warmup: state, cues: [] };
      const ticked = warmupReducer(state, { type: 'tick', now: event.now });
      const { _lastTickAt: _dropped, ...rest } = ticked.warmup;
      void _dropped;
      return { warmup: { ...rest, running: false }, cues: ticked.cues };
    }

    case 'tick': {
      if (!state.running || state._lastTickAt === undefined) return { warmup: state, cues: [] };
      const delta = Math.max(0, event.now - state._lastTickAt);
      const elapsedMs = state.elapsedMs + delta;
      const reached = !state.bellFired && elapsedMs >= state.targetMs;
      return {
        warmup: {
          ...state,
          elapsedMs,
          _lastTickAt: event.now,
          bellFired: state.bellFired || reached,
        },
        cues: reached ? [{ type: 'bell', at: state.targetMs }] : [],
      };
    }

    case 'reset':
      return { warmup: createWarmup(state.targetMs), cues: [] };

    case 'setTarget':
      // Re-arm the bell when the new target is still ahead of the clock.
      return {
        warmup: {
          ...state,
          targetMs: event.targetMs,
          bellFired: state.elapsedMs >= event.targetMs ? state.bellFired : false,
        },
        cues: [],
      };
  }
}

/**
 * Freezes a persisted warm-up on restore (a reload can't know how long the
 * page was gone): a running clock comes back paused at its last ticked
 * elapsed time. Mirrors `readPersistedRun`'s treatment of the timer.
 */
export function restoreWarmup(state: WarmupState): WarmupState {
  if (!state.running) return state;
  const { _lastTickAt: _dropped, ...rest } = state;
  void _dropped;
  return { ...rest, running: false };
}
