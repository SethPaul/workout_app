import { describe, it, expect, beforeEach } from 'vitest';
import type { AppState, Movement, PoolWorkout, WorkoutLog } from '../domain/types';
import type { Storage } from '../storage/storage';
import { buildAdhocLog } from '../domain/program/adhoc';
import { buildEnteredWorkout } from '../domain/vasa/pool';
import {
  acceptDeload,
  addPoolWorkout,
  bumpTodayWorkout,
  chooseTodayWorkout,
  clearTodayWorkout,
  currentTodayWorkout,
  deleteLog,
  dismissFlags,
  hopperMode,
  init,
  logAdhoc,
  pullToday,
  resetHopper,
  setHopperMode,
  setStorage,
  setTodayWorkout,
  startNewCycle,
  state,
  update,
  updateLog,
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
    expect(state.value?.schemaVersion).toBe(3);
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
    // init() migrates the loaded (schemaVersion 1) state, which appends the
    // SPEC 10.2 Vasa seed movements alongside the pre-existing "squat" one.
    expect(state.value?.movements.filter((m) => m.id === 'squat')).toHaveLength(1);
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

describe('hopper mode (SPEC 3.1)', () => {
  it('hopperMode defaults to "viable" when nothing has been pulled', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    expect(hopperMode(now)).toBe('viable');
  });

  it('hopperMode defaults to "viable" when a workout is pulled without a mode set', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    setTodayWorkout('w1', now);
    expect(hopperMode(now)).toBe('viable');
  });

  it('setHopperMode sets mode, keeps excluded, clears workoutId', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    setTodayWorkout('w1', now);
    bumpTodayWorkout(now);
    expect(currentTodayWorkout(now)?.excluded).toEqual(['w1']);

    setHopperMode('all', now);
    const today = currentTodayWorkout(now);
    expect(today?.mode).toBe('all');
    expect(today?.excluded).toEqual(['w1']);
    expect(today?.workoutId).toBeNull();
    expect(hopperMode(now)).toBe('all');
  });

  it('resetHopper clears excluded and workoutId, keeps mode', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    setTodayWorkout('w1', now);
    bumpTodayWorkout(now);
    setHopperMode('all', now);

    resetHopper(now);
    const today = currentTodayWorkout(now);
    expect(today?.excluded).toEqual([]);
    expect(today?.workoutId).toBeNull();
    expect(today?.mode).toBe('all');
  });

  it('bumpTodayWorkout preserves mode', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    setTodayWorkout('w1', now);
    setHopperMode('all', now);
    setTodayWorkout('w2', now);
    bumpTodayWorkout(now);
    expect(currentTodayWorkout(now)?.mode).toBe('all');
  });

  it('setTodayWorkout preserves mode', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    setTodayWorkout('w1', now);
    setHopperMode('all', now);
    setTodayWorkout('w2', now);
    expect(currentTodayWorkout(now)?.mode).toBe('all');
  });

  it('chooseTodayWorkout preserves mode', async () => {
    const storage = new MemoryStorage();
    storage.saved = { ...emptyState(), schemaVersion: 2, pool: [squatPool()] };
    setStorage(storage);
    await init();

    const now = new Date('2024-01-01T12:00:00Z');
    setTodayWorkout('w1', now);
    setHopperMode('all', now);
    chooseTodayWorkout('w1', now);
    expect(currentTodayWorkout(now)?.mode).toBe('all');
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
      movements: [
        {
          id: 'squat',
          name: 'Squat',
          tags: ['squat'],
          equipment: [],
          cadenceDays: 0,
          unit: 'reps',
          loadable: true,
        },
      ],
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
    const program = {
      cycleStartedAt: '2024-01-01T00:00:00.000Z',
      deloadWeekStartedAt: '2024-01-09T00:00:00.000Z',
      dismissedFlags: [],
    };
    pullToday({
      pool: [squatPool()],
      movements: [
        {
          id: 'squat',
          name: 'Squat',
          tags: ['squat'],
          equipment: [],
          cadenceDays: 0,
          unit: 'reps',
          loadable: true,
        },
      ],
      logs: [],
      settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
      now,
      program,
    });
    const today = currentTodayWorkout(now);
    expect(today?.snapshot?.blocks[0].movements[0].targetRpe).toBe(6);
    expect(today?.snapshot?.notes).toBe('Deload week');
  });

  it("passes ignoreCadence: true when today's hopper mode is 'all' (SPEC 3.1)", () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const pool = [squatPool()]; // cadenceDays: 0, so cadence alone wouldn't gate it out here
    pool[0].cadenceDays = 14;
    const movements = [
      {
        id: 'squat',
        name: 'Squat',
        tags: ['squat'],
        equipment: [],
        cadenceDays: 14,
        unit: 'reps' as const,
        loadable: true,
      },
    ];
    const logs = [
      {
        id: 'log-1',
        poolWorkoutId: 'w1',
        workoutSnapshot: { ...pool[0] },
        startedAt: '2024-01-01T00:00:00.000Z',
        finishedAt: '2024-01-01T00:00:00.000Z',
        results: [],
      },
    ];
    const settings = { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true };
    const program = { cycleStartedAt: now.toISOString(), dismissedFlags: [] };

    // Not in 'all' mode: still on cadence cooldown (logged moments ago).
    const gated = pullToday({ pool, movements, logs, settings, now, program });
    expect(gated.workout).toBeNull();
    expect(gated.reason).toBe('cadence');

    setHopperMode('all', now);
    const result = pullToday({ pool, movements, logs, settings, now, program });
    expect(result.workout?.id).toBe('w1');
  });

  it('an explicit ignoreCadence input overrides mode', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const pool = [squatPool()];
    pool[0].cadenceDays = 14;
    const movements = [
      {
        id: 'squat',
        name: 'Squat',
        tags: ['squat'],
        equipment: [],
        cadenceDays: 14,
        unit: 'reps' as const,
        loadable: true,
      },
    ];
    const logs = [
      {
        id: 'log-1',
        poolWorkoutId: 'w1',
        workoutSnapshot: { ...pool[0] },
        startedAt: '2024-01-01T00:00:00.000Z',
        finishedAt: '2024-01-01T00:00:00.000Z',
        results: [],
      },
    ];
    const settings = { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true };
    const program = { cycleStartedAt: now.toISOString(), dismissedFlags: [] };

    // mode stays 'viable' (default), but the caller explicitly ignores cadence.
    const result = pullToday({
      pool,
      movements,
      logs,
      settings,
      now,
      program,
      ignoreCadence: true,
    });
    expect(result.workout?.id).toBe('w1');
  });
});

function squatMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'back_squat',
    name: 'Back Squat',
    tags: ['squat'],
    equipment: ['barbell'],
    cadenceDays: 7,
    unit: 'reps',
    loadable: true,
    ...overrides,
  };
}

function emptyStateWithProgram(): AppState {
  return {
    ...emptyState(),
    schemaVersion: 2,
    program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
  };
}

describe('addPoolWorkout (SPEC 10.8)', () => {
  it('appends the workout to the pool', async () => {
    const storage = new MemoryStorage();
    storage.saved = emptyStateWithProgram();
    setStorage(storage);
    await init();
    await addPoolWorkout(squatPool());
    expect(state.value?.pool.map((w) => w.id)).toEqual(['w1']);
    expect(storage.saved?.pool.map((w) => w.id)).toEqual(['w1']);
  });

  it('marks referenced movements into the vasa library for an entered workout', async () => {
    const storage = new MemoryStorage();
    storage.saved = { ...emptyStateWithProgram(), movements: [squatMovement()] };
    setStorage(storage);
    await init();
    const entered = buildEnteredWorkout({
      date: '2024-01-05',
      region: 'lower',
      blocks: [{ role: 'main', title: 'Main', movements: [{ movementId: 'back_squat', sets: 5 }] }],
      id: 'entered-1',
    });
    await addPoolWorkout(entered);
    const movement = state.value?.movements.find((m) => m.id === 'back_squat');
    expect(movement?.libraries).toEqual(['default', 'vasa']);
  });

  it('does not touch movement libraries for an ordinary (non-entered) pool workout', async () => {
    const storage = new MemoryStorage();
    storage.saved = { ...emptyStateWithProgram(), movements: [squatMovement()] };
    setStorage(storage);
    await init();
    await addPoolWorkout(squatPool());
    const movement = state.value?.movements.find((m) => m.id === 'back_squat');
    expect(movement?.libraries).toBeUndefined();
  });
});

describe('chooseTodayWorkout (SPEC 10.8)', () => {
  it('returns null and sets nothing for an unknown id', async () => {
    const storage = new MemoryStorage();
    storage.saved = emptyStateWithProgram();
    setStorage(storage);
    await init();
    const now = new Date('2024-01-01T12:00:00.000Z');
    const result = chooseTodayWorkout('nope', now);
    expect(result).toBeNull();
    expect(currentTodayWorkout(now)).toBeNull();
  });

  it('sets an unwaved snapshot for an entered workout', async () => {
    const storage = new MemoryStorage();
    storage.saved = { ...emptyStateWithProgram(), movements: [squatMovement()] };
    setStorage(storage);
    await init();
    const entered = buildEnteredWorkout({
      date: '2024-01-05',
      region: 'lower',
      blocks: [{ role: 'main', title: 'Main', movements: [{ movementId: 'back_squat', sets: 5 }] }],
      id: 'entered-1',
    });
    await addPoolWorkout(entered);

    // Week 3 (peak) would normally drop sets by 1 and bump targetRpe to 9;
    // an entered workout must skip the wave entirely (the coach's
    // prescription is not waved).
    const now = new Date('2024-01-15T00:00:00.000Z'); // cycleStartedAt + 14 days = week 3
    const snapshot = chooseTodayWorkout('entered-1', now);
    expect(snapshot?.blocks[0].sets).toBe(5);
    expect(snapshot?.blocks[0].movements[0].targetRpe).toBeUndefined();
    expect(currentTodayWorkout(now)?.workoutId).toBe('entered-1');
    expect(currentTodayWorkout(now)?.snapshot).toEqual(snapshot);
  });

  it('sets a wave-transformed snapshot for an ordinary pool workout', async () => {
    const storage = new MemoryStorage();
    storage.saved = {
      ...emptyStateWithProgram(),
      movements: [squatMovement()],
      pool: [squatPool()],
    };
    setStorage(storage);
    await init();

    const now = new Date('2024-01-15T00:00:00.000Z'); // week 3 (peak): sets -1, targetRpe 9
    const snapshot = chooseTodayWorkout('w1', now);
    expect(snapshot?.blocks[0].sets).toBe(4); // 5 - 1
    expect(snapshot?.blocks[0].movements[0].targetRpe).toBe(9);
  });

  it('clears a bumped exclusion for the chosen id', async () => {
    const storage = new MemoryStorage();
    storage.saved = { ...emptyStateWithProgram(), pool: [squatPool()] };
    setStorage(storage);
    await init();

    const now = new Date('2024-01-01T12:00:00.000Z');
    setTodayWorkout('w1', now);
    bumpTodayWorkout(now);
    expect(currentTodayWorkout(now)?.excluded).toEqual(['w1']);

    chooseTodayWorkout('w1', now);
    expect(currentTodayWorkout(now)?.excluded).toEqual([]);
    expect(currentTodayWorkout(now)?.workoutId).toBe('w1');
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

describe('updateLog / deleteLog', () => {
  function emptyStateWithProgram(): AppState {
    return {
      ...emptyState(),
      schemaVersion: 2,
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
    };
  }

  function seedLog(): WorkoutLog {
    return buildAdhocLog({
      date: '2024-01-05T00:00:00.000Z',
      entries: [{ movementId: 'squat', sets: [{ weight: 200, reps: 5 }] }],
      id: 'log-1',
    });
  }

  it('updateLog merges the patch into the matching log and persists it', async () => {
    const storage = new MemoryStorage();
    storage.saved = { ...emptyStateWithProgram(), logs: [seedLog()] };
    setStorage(storage);
    await init();

    const newFinishedAt = '2024-01-06T00:00:00.000Z';
    const newResults = [{ movementId: 'squat', sets: [{ weight: 225, reps: 5 }] }];
    await updateLog('log-1', { results: newResults, finishedAt: newFinishedAt });

    expect(state.value?.logs).toHaveLength(1);
    expect(state.value?.logs[0].results).toEqual(newResults);
    expect(state.value?.logs[0].finishedAt).toBe(newFinishedAt);
    expect(state.value?.logs[0].editedAt).toBeDefined();
    // Untouched fields survive the merge.
    expect(state.value?.logs[0].id).toBe('log-1');
    expect(state.value?.logs[0].kind).toBe('adhoc');
    // Persisted through to storage.
    expect(storage.saved?.logs[0].results).toEqual(newResults);
    expect(storage.saved?.logs[0].editedAt).toBeDefined();
  });

  it('updateLog leaves other logs untouched', async () => {
    const storage = new MemoryStorage();
    const other = buildAdhocLog({ date: '2024-01-02T00:00:00.000Z', entries: [], id: 'log-2' });
    storage.saved = { ...emptyStateWithProgram(), logs: [seedLog(), other] };
    setStorage(storage);
    await init();

    await updateLog('log-1', { notes: 'edited' });

    expect(state.value?.logs.find((l) => l.id === 'log-2')?.editedAt).toBeUndefined();
  });

  it('deleteLog removes the matching log and persists it', async () => {
    const storage = new MemoryStorage();
    storage.saved = { ...emptyStateWithProgram(), logs: [seedLog()] };
    setStorage(storage);
    await init();

    await deleteLog('log-1');

    expect(state.value?.logs).toHaveLength(0);
    expect(storage.saved?.logs).toHaveLength(0);
  });
});
