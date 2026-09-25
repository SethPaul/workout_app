import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AppState, PoolWorkout } from '../domain/types';
import type { WarmupState } from '../domain/warmup';
import {
  beginRunSession,
  clearRunSession,
  dispatchRun,
  dispatchWarmup,
  runSession,
  updateRunDraft,
} from './run';

const RUN_KEY = 'workout_app.runSession';

function fixtureState(): AppState {
  return {
    movements: [
      {
        id: 'squat',
        name: 'Back Squat',
        tags: [],
        equipment: [],
        cadenceDays: 7,
        unit: 'reps',
        loadable: true,
      },
    ],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 1,
  };
}

function strengthWorkout(): PoolWorkout {
  return {
    id: 'w1',
    name: 'Squat Day',
    intensity: 'M',
    blocks: [
      {
        format: 'strength',
        title: 'Strength',
        movements: [{ movementId: 'squat', reps: 5 }],
        sets: 3,
        restSec: 30,
      },
    ],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
  };
}

describe('run session persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    clearRunSession();
  });

  afterEach(() => {
    clearRunSession();
    localStorage.clear();
  });

  it('beginRunSession persists the session immediately', () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    const raw = localStorage.getItem(RUN_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!);
    expect(stored.poolWorkoutId).toBe('w1');
    expect(stored.timer.status).toBe('idle');
  });

  it('clearRunSession removes the persisted entry', () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    expect(localStorage.getItem(RUN_KEY)).not.toBeNull();
    clearRunSession();
    expect(localStorage.getItem(RUN_KEY)).toBeNull();
    expect(runSession.value).toBeNull();
  });

  it('non-tick events (start/pause) persist immediately', () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    dispatchRun({ type: 'start', now: 0 });
    let stored = JSON.parse(localStorage.getItem(RUN_KEY)!);
    expect(stored.timer.status).toBe('running');

    dispatchRun({ type: 'pause', now: 100 });
    stored = JSON.parse(localStorage.getItem(RUN_KEY)!);
    expect(stored.timer.status).toBe('paused');
  });

  it('updateRunDraft persists the updated draft immediately', () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    updateRunDraft((draft) => ({ ...draft, notes: 'felt strong' }));
    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!);
    expect(stored.draft.notes).toBe('felt strong');
  });

  it('tick events are throttled to at most once every 2 seconds', () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    dispatchRun({ type: 'start', now: 0 });
    // start() persists immediately with phaseElapsedMs 0.
    const afterStart = JSON.parse(localStorage.getItem(RUN_KEY)!);
    expect(afterStart.timer._phaseElapsedMs).toBe(0);

    // Ticks shortly after start should NOT overwrite the persisted copy yet
    // (throttled to at most once every 2s).
    dispatchRun({ type: 'tick', now: 500 });
    let stored = JSON.parse(localStorage.getItem(RUN_KEY)!);
    expect(stored.timer._phaseElapsedMs).toBe(0);

    dispatchRun({ type: 'tick', now: 1000 });
    stored = JSON.parse(localStorage.getItem(RUN_KEY)!);
    expect(stored.timer._phaseElapsedMs).toBe(0);

    // Once 2s have elapsed since the last persist (start at now=0), the next
    // tick persists.
    dispatchRun({ type: 'tick', now: 2000 });
    stored = JSON.parse(localStorage.getItem(RUN_KEY)!);
    expect(stored.timer._phaseElapsedMs).toBe(2000);

    // The in-memory signal always reflects the latest tick regardless of
    // whether that particular tick was persisted.
    expect(runSession.value?.timer._phaseElapsedMs).toBe(2000);
  });

  it('a running session restores as paused with no elapsed-time jump, and restoredAt set', async () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    dispatchRun({ type: 'start', now: 0 });
    dispatchRun({ type: 'tick', now: 5000 }); // persists (>=2s since the last persist at now=0)
    expect(runSession.value?.timer.status).toBe('running');
    expect(runSession.value?.timer._phaseElapsedMs).toBe(5000);

    // Simulate a reload by re-importing the module fresh: it re-reads
    // localStorage at load time, exactly like a real page load would.
    vi.resetModules();
    const fresh = await import('./run');
    const restored = fresh.runSession.value;
    expect(restored).not.toBeNull();
    expect(restored!.timer.status).toBe('paused');
    expect(restored!.timer._lastTickAt).toBeUndefined();
    expect(restored!.timer._phaseElapsedMs).toBe(5000); // preserved, no jump
    expect(restored!.restoredAt).toBeDefined();
    expect(restored!.timer.pendingCues).toEqual([]);
  });

  it('beginRunSession starts with an idle warm-up stopwatch at 0', () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    expect(runSession.value?.warmup).toEqual({
      running: false,
      elapsedMs: 0,
      targetMs: 5 * 60 * 1000,
      bellFired: false,
    });
  });

  it('dispatchWarmup persists start/pause/reset/setTarget immediately and throttles ticks', () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    const stored = () => JSON.parse(localStorage.getItem(RUN_KEY)!) as { warmup: WarmupState };

    dispatchWarmup({ type: 'setTarget', targetMs: 3000 });
    expect(stored().warmup.targetMs).toBe(3000);

    dispatchWarmup({ type: 'start', now: 1000 });
    expect(stored().warmup.running).toBe(true);

    dispatchWarmup({ type: 'tick', now: 1500 }); // < 2 s since the persist at start: not written
    expect(runSession.value?.warmup?.elapsedMs).toBe(500);
    expect(stored().warmup.elapsedMs).toBe(0);

    dispatchWarmup({ type: 'tick', now: 3100 }); // >= 2 s: written
    expect(stored().warmup.elapsedMs).toBe(2100);

    const cues = dispatchWarmup({ type: 'pause', now: 4500 });
    expect(cues).toEqual([{ type: 'bell', at: 3000 }]);
    expect(stored().warmup).toMatchObject({ running: false, elapsedMs: 3500, bellFired: true });

    dispatchWarmup({ type: 'reset' });
    expect(stored().warmup).toEqual({
      running: false,
      elapsedMs: 0,
      targetMs: 3000,
      bellFired: false,
    });
  });

  it('a running warm-up restores paused at its last persisted elapsed time', async () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    dispatchWarmup({ type: 'start', now: 0 });
    dispatchWarmup({ type: 'tick', now: 5000 });

    vi.resetModules();
    const fresh = await import('./run');
    const restored = fresh.runSession.value;
    expect(restored?.timer.status).toBe('idle');
    expect(restored?.warmup).toEqual({
      running: false,
      elapsedMs: 5000,
      targetMs: 5 * 60 * 1000,
      bellFired: false,
    });
  });

  it('a session persisted before the warm-up existed restores without one and gains it on first event', async () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    const raw = JSON.parse(localStorage.getItem(RUN_KEY)!) as Record<string, unknown>;
    delete raw.warmup;
    localStorage.setItem(RUN_KEY, JSON.stringify(raw));

    vi.resetModules();
    const fresh = await import('./run');
    expect(fresh.runSession.value?.warmup).toBeUndefined();
    fresh.dispatchWarmup({ type: 'start', now: 0 });
    expect(fresh.runSession.value?.warmup?.running).toBe(true);
  });

  it('an idle/paused/between-blocks/finished session restores as-is', async () => {
    beginRunSession(fixtureState(), strengthWorkout(), new Date(0));
    dispatchRun({ type: 'start', now: 0 });
    dispatchRun({ type: 'pause', now: 100 });

    vi.resetModules();
    const fresh = await import('./run');
    expect(fresh.runSession.value?.timer.status).toBe('paused');
  });

  it('corrupt JSON in storage restores as null', async () => {
    localStorage.setItem(RUN_KEY, '{not valid json');
    vi.resetModules();
    const fresh = await import('./run');
    expect(fresh.runSession.value).toBeNull();
  });

  it('a plausible-but-malformed stored value (missing timer/draft) restores as null', async () => {
    localStorage.setItem(RUN_KEY, JSON.stringify({ poolWorkoutId: 'w1' }));
    vi.resetModules();
    const fresh = await import('./run');
    expect(fresh.runSession.value).toBeNull();
  });
});
