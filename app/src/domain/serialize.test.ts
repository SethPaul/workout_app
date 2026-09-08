import { describe, it, expect } from 'vitest';
import { exportState, importState } from './serialize';
import type { AppState } from './types';

function validState(): AppState {
  return {
    movements: [
      {
        id: 'squat',
        name: 'Squat',
        tags: ['compound'],
        equipment: ['barbell', 'rack'],
        cadenceDays: 7,
        unit: 'reps',
        loadable: true,
      },
    ],
    pool: [
      {
        id: 'w1',
        name: 'Squat Day',
        intensity: 'H',
        blocks: [
          {
            format: 'strength',
            movements: [{ movementId: 'squat', reps: 5 }],
            sets: 5,
          },
        ],
        cadenceDays: 14,
        enabled: true,
        source: 'manual',
      },
    ],
    logs: [],
    settings: {
      availableEquipment: ['barbell', 'rack'],
      soundOn: true,
      vibrateOn: true,
      keepScreenOn: true,
    },
    schemaVersion: 1,
  };
}

describe('exportState / importState round-trip', () => {
  it('round-trips a v1 export, migrated to v2 (SPEC 9.1)', () => {
    const state = validState();
    const json = exportState(state);
    const imported = importState(json);
    expect(imported.schemaVersion).toBe(2);
    expect(imported.movements).toEqual(state.movements);
    expect(imported.pool).toEqual(state.pool);
    expect(imported.logs).toEqual([]);
    expect(imported.settings).toMatchObject(state.settings);
    expect(imported.settings.units).toBe('lb');
    expect(imported.settings.deloadPolicy).toBe('fatigue');
    expect(imported.program).toBeDefined();
    expect(imported.program?.dismissedFlags).toEqual([]);
  });

  it('round-trips an already-v2 export unchanged', () => {
    const state: AppState = {
      ...validState(),
      schemaVersion: 2,
      settings: {
        ...validState().settings,
        units: 'kg',
        deloadPolicy: 'calendar',
        cycleWeeks: 6,
        focus: 'strength',
        masters: true,
      },
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: ['x'] },
    };
    const imported = importState(exportState(state));
    expect(imported).toEqual(state);
  });

  it('a v1 log without kind migrates to kind: "pool"', () => {
    const state = validState();
    state.logs.push({
      id: 'l1',
      poolWorkoutId: 'w1',
      workoutSnapshot: state.pool[0],
      startedAt: '2024-01-01T00:00:00.000Z',
      finishedAt: '2024-01-01T00:00:00.000Z',
      results: [],
    });
    const imported = importState(exportState(state));
    expect(imported.logs[0].kind).toBe('pool');
  });
});

describe('importState validation', () => {
  it('rejects invalid JSON', () => {
    expect(() => importState('{not json')).toThrow(/could not parse JSON/);
  });

  it('rejects a non-object root', () => {
    expect(() => importState('[]')).toThrow(/root value must be an object/);
  });

  it('accepts schemaVersion 2', () => {
    const state = { ...validState(), schemaVersion: 2 };
    expect(() => importState(JSON.stringify(state))).not.toThrow();
  });

  it('rejects an unsupported schemaVersion', () => {
    const state = { ...validState(), schemaVersion: 3 as unknown as 1 };
    expect(() => importState(JSON.stringify(state))).toThrow(/schemaVersion/);
  });

  it('rejects when movements is not an array', () => {
    const state: Record<string, unknown> = { ...validState(), movements: 'nope' };
    expect(() => importState(JSON.stringify(state))).toThrow(/"movements"/);
  });

  it('rejects a movement missing required fields', () => {
    const state = validState();
    // @ts-expect-error intentionally malformed for the test
    state.movements[0].cadenceDays = 'seven';
    expect(() => importState(JSON.stringify(state))).toThrow(/cadenceDays/);
  });

  it('rejects a pool workout referencing an unknown movementId', () => {
    const state = validState();
    state.pool[0].blocks[0].movements.push({ movementId: 'deadlift' });
    expect(() => importState(JSON.stringify(state))).toThrow(/unknown movementId "deadlift"/);
  });

  it('rejects malformed settings', () => {
    const state: Record<string, unknown> = { ...validState(), settings: { soundOn: true } };
    expect(() => importState(JSON.stringify(state))).toThrow(/settings/);
  });

  it('fills in missing settings booleans with defaults', () => {
    const state = validState();
    const raw: Record<string, unknown> = {
      ...state,
      settings: { availableEquipment: ['barbell'] },
    };
    const imported = importState(JSON.stringify(raw));
    expect(imported.settings).toEqual({
      availableEquipment: ['barbell'],
      soundOn: true,
      vibrateOn: true,
      keepScreenOn: true,
      units: 'lb',
      deloadPolicy: 'fatigue',
      cycleWeeks: 4,
      focus: 'balanced',
      masters: false,
    });
  });

  it('rejects an unknown block format', () => {
    const state = validState();
    // @ts-expect-error intentionally malformed for the test
    state.pool[0].blocks[0].format = 'not-a-real-format';
    expect(() => importState(JSON.stringify(state))).toThrow(/format/);
  });

  it('rejects a duplicate movement id', () => {
    const state = validState();
    state.movements.push({ ...state.movements[0] });
    expect(() => importState(JSON.stringify(state))).toThrow(/duplicate movement id "squat"/);
  });

  it('rejects a duplicate pool workout id', () => {
    const state = validState();
    state.pool.push({ ...state.pool[0] });
    expect(() => importState(JSON.stringify(state))).toThrow(/duplicate pool workout id "w1"/);
  });

  it('rejects a negative movement cadenceDays', () => {
    const state = validState();
    state.movements[0].cadenceDays = -1;
    expect(() => importState(JSON.stringify(state))).toThrow(/cadenceDays/);
  });

  it('rejects a negative pool workout cadenceDays', () => {
    const state = validState();
    state.pool[0].cadenceDays = -7;
    expect(() => importState(JSON.stringify(state))).toThrow(/cadenceDays/);
  });

  it('accepts loadPct and rir within range', () => {
    const state = validState();
    state.pool[0].blocks[0].movements[0].loadPct = 70;
    state.pool[0].blocks[0].movements[0].rir = 2;
    const imported = importState(JSON.stringify(state));
    expect(imported.pool[0].blocks[0].movements[0].loadPct).toBe(70);
    expect(imported.pool[0].blocks[0].movements[0].rir).toBe(2);
  });

  it('rejects a loadPct above 100', () => {
    const state = validState();
    state.pool[0].blocks[0].movements[0].loadPct = 101;
    expect(() => importState(JSON.stringify(state))).toThrow(/loadPct/);
  });

  it('rejects a negative loadPct', () => {
    const state = validState();
    state.pool[0].blocks[0].movements[0].loadPct = -5;
    expect(() => importState(JSON.stringify(state))).toThrow(/loadPct/);
  });

  it('rejects an rir above 5', () => {
    const state = validState();
    state.pool[0].blocks[0].movements[0].rir = 6;
    expect(() => importState(JSON.stringify(state))).toThrow(/rir/);
  });

  it('rejects a negative rir', () => {
    const state = validState();
    state.pool[0].blocks[0].movements[0].rir = -1;
    expect(() => importState(JSON.stringify(state))).toThrow(/rir/);
  });

  it('accepts a log with no poolWorkoutId (adhoc/max-test, SPEC 9.1)', () => {
    const state = validState();
    state.logs.push({
      id: 'l1',
      workoutSnapshot: state.pool[0],
      startedAt: '2024-01-01T00:00:00.000Z',
      finishedAt: '2024-01-01T00:00:00.000Z',
      results: [],
      kind: 'adhoc',
    });
    const imported = importState(JSON.stringify(state));
    expect(imported.logs[0].poolWorkoutId).toBeUndefined();
    expect(imported.logs[0].kind).toBe('adhoc');
  });

  it('rejects an invalid log kind', () => {
    const state = validState();
    state.logs.push({
      id: 'l1',
      workoutSnapshot: state.pool[0],
      startedAt: '2024-01-01T00:00:00.000Z',
      finishedAt: '2024-01-01T00:00:00.000Z',
      results: [],
      kind: 'nonsense' as unknown as 'pool',
    });
    expect(() => importState(JSON.stringify(state))).toThrow(/kind/);
  });

  it('rejects an invalid settings.units', () => {
    const state: Record<string, unknown> = {
      ...validState(),
      settings: { ...validState().settings, units: 'stone' },
    };
    expect(() => importState(JSON.stringify(state))).toThrow(/units/);
  });

  it('rejects an invalid settings.deloadPolicy', () => {
    const state: Record<string, unknown> = {
      ...validState(),
      settings: { ...validState().settings, deloadPolicy: 'never' },
    };
    expect(() => importState(JSON.stringify(state))).toThrow(/deloadPolicy/);
  });
});
