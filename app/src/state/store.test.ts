import { describe, it, expect, beforeEach } from 'vitest';
import type { AppState, PoolWorkout, WorkoutLog } from '../domain/types';
import type { Storage } from '../storage/storage';
import { buildAdhocLog } from '../domain/program/adhoc';
import {
  acceptDeload,
  bumpTodayWorkout,
  clearTodayWorkout,
  currentTodayWorkout,
  dismissFlags,
  init,
  logAdhoc,
  pullToday,
  setStorage,
  setTodayWorkout,
  startNewCycle,
  state,
  update,
} from './store';

class MemoryStorage implements Storage {
  saved: AppState | null = null;
  async load(): Promise<AppState | null> {
    return this.saved;
  }
  async save(next: AppState): Promise<void> {
    this.saved = next;
  }
}

function emptyState(): AppState {
  return {
    movements: [],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 1,
  };
}

beforeEach(() => {
  clearTodayWorkout();
});

describe('init / update', () => {
  it('seeds AppState from app/seed/*.json when storage has nothing', async () => {
    // Deliberately does not assert on the exact seed content: seed/*.json is
    // owned by a separate workstream and may be empty or populated. Only
    // the shape/integrity contract from buildSeedState() is asserted here
    // (see storage/seed.test.ts for the "missing seed" guarantee).
    setStorage(new MemoryStorage());
    await init();
    expect(state.value).not.toBeNull();
    expect(Array.isArray(state.value?.movements)).toBe(true);
    expect(Array.isArray(state.value?.pool)).toBe(true);
    expect(state.value?.logs).toEqual([]);
    expect(state.value?.schemaVersion).toBe(2);
  });

  it('loads existing state from storage instead of seeding', async () => {
    const storage = new MemoryStorage();
    storage.saved = emptyState();
    storage.saved.movements.push({
      id: 'squat',
      name: 'Squat',
      tags: [],
      equipment: [],
      cadenceDays: 7,
      unit: 'reps',
      loadable: true,
    });
    setStorage(storage);
    await init();
    expect(state.value?.movements).toHaveLength(1);
  });

  it('update() writes through to storage', async () => {
    const storage = new MemoryStorage();
    setStorage(storage);
    await init();
    await update((s) => ({ ...s, logs: [...s.logs] }));
    await update((s) => ({
      ...s,
      settings: { ...s.settings, soundOn: false },
    }));
    expect(state.value?.settings.soundOn).toBe(false);
    expect(storage.saved?.settings.soundOn).toBe(false);
  });
});

describe('todayDateString (via setTodayWorkout)', () => {
  it('uses the local calendar date, not the UTC date, for a 16:30 local timestamp', () => {
    // Constructed with local-time components (not an ISO string), so this
    // pins the local date regardless of host TZ.
    const now = new Date(2024, 5, 20, 16, 30); // June 20 2024, 16:30 local
    setTodayWorkout('w1', now);
    expect(currentTodayWorkout(now)?.date).toBe('2024-06-20');
  });
});

describe('today workout', () => {
  it('returns null when nothing has been set', () => {
    expect(currentTodayWorkout(new Date('2024-01-01T12:00:00Z'))).toBeNull();
  });

  it('remembers the pulled workout for the same day', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    setTodayWorkout('w1', now);
    expect(currentTodayWorkout(now)?.workoutId).toBe('w1');
  });

  it('bump adds the workout to excluded and clears the pick', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    setTodayWorkout('w1', now);
    bumpTodayWorkout(now);
    const today = currentTodayWorkout(now);
    expect(today?.workoutId).toBeNull();
    expect(today?.excluded).toEqual(['w1']);
  });

  it('exclusions reset once the date changes', () => {
    const day1 = new Date('2024-01-01T12:00:00Z');
    const day2 = new Date('2024-01-02T12:00:00Z');
    setTodayWorkout('w1', day1);
    bumpTodayWorkout(day1);
    expect(currentTodayWorkout(day2)).toBeNull(); // stale entry from a previous day
    setTodayWorkout('w2', day2);
    expect(currentTodayWorkout(day2)?.excluded).toEqual([]);
  });
});

function squatPool(): PoolWorkout {
  return {
    id: 'w1',
    name: 'Squat Day',
    intensity: 'H',
    blocks: [{ format: 'strength', sets: 5, movements: [{ movementId: 'squat', reps: 5 }] }],
    cadenceDays: 0,
    enabled: true,
    source: 'manual',
  };
}

describe('pullToday (SPEC 9.5/9.9)', () => {
  it('stores the wave-transformed snapshot, not the raw pool entry', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const result = pullToday({
      pool: [squatPool()],
      movements: [{ id: 'squat', name: 'Squat', tags: ['squat'], equipment: [], cadenceDays: 0, unit: 'reps', loadable: true }],
      logs: [],
      settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
      now,
      program: { cycleStartedAt: now.toISOString(), dismissedFlags: [] }, // week 1
    });
    expect(result.workout?.id).toBe('w1');
    const today = currentTodayWorkout(now);
    expect(today?.snapshot?.blocks[0].movements[0].targetRpe).toBe(7); // week 1
    expect(today?.snapshot?.blocks[0].sets).toBe(5);
  });

  it('applies the deload wave when a deload is active', () => {
    const now = new Date('2024-01-10T12:00:00Z');
    const program = { cycleStartedAt: '2024-01-01T00:00:00.000Z', deloadWeekStartedAt: '2024-01-09T00:00:00.000Z', dismissedFlags: [] };
    pullToday({
      pool: [squatPool()],
      movements: [{ id: 'squat', name: 'Squat', tags: ['squat'], equipment: [], cadenceDays: 0, unit: 'reps', loadable: true }],
      logs: [],
      settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
      now,
      program,
    });
    const today = currentTodayWorkout(now);
    expect(today?.snapshot?.blocks[0].movements[0].targetRpe).toBe(6);
    expect(today?.snapshot?.notes).toBe('Deload week');
  });
});

describe('logAdhoc / acceptDeload / dismissFlags / startNewCycle', () => {
  function emptyStateWithProgram(): AppState {
    return {
      ...emptyState(),
      schemaVersion: 2,
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
    };
  }

  it('logAdhoc appends the log', async () => {
    const storage = new MemoryStorage();
    storage.saved = emptyStateWithProgram();
    setStorage(storage);
    await init();
    const log: WorkoutLog = buildAdhocLog({
      date: '2024-01-05T00:00:00.000Z',
      entries: [{ movementId: 'squat', sets: [{ weight: 200, reps: 5 }] }],
      id: 'adhoc-1',
    });
    await logAdhoc(log);
    expect(state.value?.logs).toHaveLength(1);
    expect(state.value?.logs[0].kind).toBe('adhoc');
  });

  it('acceptDeload sets program.deloadWeekStartedAt', async () => {
    const storage = new MemoryStorage();
    storage.saved = emptyStateWithProgram();
    setStorage(storage);
    await init();
    const now = new Date('2024-02-01T00:00:00.000Z');
    await acceptDeload(now);
    expect(state.value?.program?.deloadWeekStartedAt).toBe(now.toISOString());
  });

  it('dismissFlags adds ids without duplicating existing ones', async () => {
    const storage = new MemoryStorage();
    storage.saved = {
      ...emptyStateWithProgram(),
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: ['a'] },
    };
    setStorage(storage);
    await init();
    await dismissFlags(['a', 'b']);
    expect(state.value?.program?.dismissedFlags.sort()).toEqual(['a', 'b']);
  });

  it('startNewCycle resets cycleStartedAt and clears deload/dismissed flags', async () => {
    const storage = new MemoryStorage();
    storage.saved = {
      ...emptyStateWithProgram(),
      program: {
        cycleStartedAt: '2024-01-01T00:00:00.000Z',
        deloadWeekStartedAt: '2024-01-20T00:00:00.000Z',
        dismissedFlags: ['a'],
      },
    };
    setStorage(storage);
    await init();
    const now = new Date('2024-02-01T00:00:00.000Z');
    await startNewCycle(now);
    expect(state.value?.program).toEqual({ cycleStartedAt: now.toISOString(), dismissedFlags: [] });
  });
});
