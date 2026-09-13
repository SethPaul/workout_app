import { describe, it, expect } from 'vitest';
import { migrate } from './migrate';
import { VASA_SEED_MOVEMENTS } from './vasa/seedMovements';
import type { AppState, WorkoutLog } from './types';

function v1State(overrides: Partial<AppState> = {}): AppState {
  return {
    movements: [],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 1,
    ...overrides,
  };
}

function log(id: string, finishedAt: string): WorkoutLog {
  return {
    id,
    poolWorkoutId: 'w1',
    workoutSnapshot: {
      id: 'w1',
      name: 'w1',
      intensity: 'M',
      blocks: [{ format: 'strength', movements: [{ movementId: 'squat' }] }],
      cadenceDays: 14,
      enabled: true,
      source: 'manual',
    },
    startedAt: finishedAt,
    finishedAt,
    results: [],
  };
}

describe('migrate v1 -> v3', () => {
  it('bumps schemaVersion all the way to 3', () => {
    expect(migrate(v1State()).schemaVersion).toBe(3);
  });

  it('stamps kind: "pool" on existing logs (v1 -> v2 step)', () => {
    const state = v1State({ logs: [log('l1', '2024-01-01T00:00:00.000Z')] });
    const migrated = migrate(state);
    expect(migrated.logs[0].kind).toBe('pool');
  });

  it('leaves an already-present kind untouched', () => {
    const state = v1State({
      logs: [{ ...log('l1', '2024-01-01T00:00:00.000Z'), kind: 'max-test' }],
    });
    const migrated = migrate(state);
    expect(migrated.logs[0].kind).toBe('max-test');
  });

  it('fills in settings defaults (v1 -> v2 step)', () => {
    const migrated = migrate(v1State());
    expect(migrated.settings.units).toBe('lb');
    expect(migrated.settings.deloadPolicy).toBe('fatigue');
    expect(migrated.settings.cycleWeeks).toBe(4);
    expect(migrated.settings.focus).toBe('balanced');
    expect(migrated.settings.masters).toBe(false);
  });

  it('preserves existing settings values instead of overwriting them', () => {
    const state = v1State();
    state.settings.units = 'kg';
    const migrated = migrate(state);
    expect(migrated.settings.units).toBe('kg');
  });

  it('sets program.cycleStartedAt to the earliest log date when logs exist', () => {
    const state = v1State({
      logs: [log('l1', '2024-01-10T00:00:00.000Z'), log('l2', '2024-01-05T00:00:00.000Z')],
    });
    const migrated = migrate(state);
    expect(migrated.program?.cycleStartedAt).toBe('2024-01-05T00:00:00.000Z');
  });

  it('sets program.cycleStartedAt to `now` when there are no logs', () => {
    const migrated = migrate(v1State(), '2024-06-01T00:00:00.000Z');
    expect(migrated.program?.cycleStartedAt).toBe('2024-06-01T00:00:00.000Z');
  });

  it('starts with no dismissed flags and no active deload', () => {
    const migrated = migrate(v1State());
    expect(migrated.program?.dismissedFlags).toEqual([]);
    expect(migrated.program?.deloadWeekStartedAt).toBeUndefined();
  });

  it('appends "band" to settings.availableEquipment (v2 -> v3 step)', () => {
    const migrated = migrate(v1State());
    expect(migrated.settings.availableEquipment).toContain('band');
  });

  it('appends every VASA_SEED_MOVEMENTS entry (v2 -> v3 step)', () => {
    const migrated = migrate(v1State());
    const ids = migrated.movements.map((m) => m.id);
    for (const seedMovement of VASA_SEED_MOVEMENTS) {
      expect(ids).toContain(seedMovement.id);
    }
  });
});

describe('migrate v2 -> v3', () => {
  function v2State(overrides: Partial<AppState> = {}): AppState {
    return {
      ...v1State(),
      schemaVersion: 2,
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
      ...overrides,
    };
  }

  it('bumps schemaVersion to 3', () => {
    expect(migrate(v2State()).schemaVersion).toBe(3);
  });

  it('appends "band" when absent from availableEquipment', () => {
    const migrated = migrate(v2State());
    expect(migrated.settings.availableEquipment).toContain('band');
  });

  it('does not duplicate "band" when it is already present', () => {
    const state = v2State({
      settings: {
        availableEquipment: ['barbell', 'band'],
        soundOn: true,
        vibrateOn: true,
        keepScreenOn: true,
      },
    });
    const migrated = migrate(state);
    expect(migrated.settings.availableEquipment.filter((e) => e === 'band')).toHaveLength(1);
  });

  it('appends every VASA_SEED_MOVEMENTS entry not already present', () => {
    const existing = VASA_SEED_MOVEMENTS[0];
    const state = v2State({ movements: [existing] });
    const migrated = migrate(state);
    const ids = migrated.movements.map((m) => m.id);
    // The pre-existing movement is kept, not duplicated or replaced.
    expect(ids.filter((id) => id === existing.id)).toHaveLength(1);
    expect(migrated.movements.find((m) => m.id === existing.id)).toBe(existing);
    for (const seedMovement of VASA_SEED_MOVEMENTS) {
      expect(ids).toContain(seedMovement.id);
    }
  });

  it('leaves an existing movement`s own libraries untouched', () => {
    const state = v2State({
      movements: [
        {
          id: 'squat',
          name: 'Squat',
          tags: [],
          equipment: [],
          cadenceDays: 7,
          unit: 'reps',
          loadable: true,
        },
      ],
    });
    const migrated = migrate(state);
    const squat = migrated.movements.find((m) => m.id === 'squat');
    expect(squat?.libraries).toBeUndefined();
  });

  it('does not touch settings.units/program when already resolved', () => {
    const state = v2State({
      settings: {
        availableEquipment: [],
        soundOn: true,
        vibrateOn: true,
        keepScreenOn: true,
        units: 'kg',
        deloadPolicy: 'calendar',
        cycleWeeks: 6,
        focus: 'strength',
        masters: true,
      },
    });
    const migrated = migrate(state);
    expect(migrated.settings.units).toBe('kg');
    expect(migrated.settings.deloadPolicy).toBe('calendar');
  });
});

describe('migrate idempotence', () => {
  it('the v1->v2 step never recomputes cycleStartedAt for an already-v2-or-later state', () => {
    const already: AppState = {
      ...v1State(),
      schemaVersion: 2,
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: ['f1'] },
    };
    const migrated = migrate(already, '2099-01-01T00:00:00.000Z');
    expect(migrated.program?.cycleStartedAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('a fully-migrated v3 state is returned unchanged (same object reference)', () => {
    const already: AppState = {
      movements: [...VASA_SEED_MOVEMENTS],
      pool: [],
      logs: [],
      settings: {
        availableEquipment: ['band'],
        soundOn: true,
        vibrateOn: true,
        keepScreenOn: true,
        units: 'lb',
        deloadPolicy: 'fatigue',
        cycleWeeks: 4,
        focus: 'balanced',
        masters: false,
      },
      schemaVersion: 3,
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
    };
    const migrated = migrate(already, '2099-01-01T00:00:00.000Z');
    expect(migrated).toBe(already);
  });

  it('calling migrate twice is a no-op the second time', () => {
    const once = migrate(v1State());
    const twice = migrate(once, '2099-01-01T00:00:00.000Z');
    expect(twice).toBe(once);
  });
});
