import { describe, it, expect } from 'vitest';
import { exportState, importState } from './serialize';
import { VASA_SEED_MOVEMENTS } from './vasa/seedMovements';
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
  it('round-trips a v1 export, migrated to v3 (SPEC 9.1/10.2)', () => {
    const state = validState();
    const json = exportState(state);
    const imported = importState(json);
    expect(imported.schemaVersion).toBe(3);
    expect(imported.movements).toEqual([...state.movements, ...VASA_SEED_MOVEMENTS]);
    expect(imported.pool).toEqual(state.pool);
    expect(imported.logs).toEqual([]);
    expect(imported.settings.availableEquipment).toEqual([
      ...state.settings.availableEquipment,
      'band',
    ]);
    expect(imported.settings.units).toBe('lb');
    expect(imported.settings.deloadPolicy).toBe('fatigue');
    expect(imported.program).toBeDefined();
    expect(imported.program?.dismissedFlags).toEqual([]);
  });

  it('a v2 export is migrated to v3 on import (band + Vasa seed movements added)', () => {
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
    expect(imported.schemaVersion).toBe(3);
    expect(imported.settings).toMatchObject({
      units: 'kg',
      deloadPolicy: 'calendar',
      cycleWeeks: 6,
      focus: 'strength',
      masters: true,
    });
    expect(imported.settings.availableEquipment).toContain('band');
    expect(imported.movements).toEqual([...state.movements, ...VASA_SEED_MOVEMENTS]);
    expect(imported.program).toEqual(state.program);
  });

  it('round-trips an already-v3 export unchanged', () => {
    const state: AppState = {
      ...validState(),
      schemaVersion: 3,
      settings: {
        ...validState().settings,
        availableEquipment: [...validState().settings.availableEquipment, 'band'],
        units: 'kg',
        deloadPolicy: 'calendar',
        cycleWeeks: 6,
        focus: 'strength',
        masters: true,
      },
      movements: [...validState().movements, ...VASA_SEED_MOVEMENTS],
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: ['x'] },
    };
    const imported = importState(exportState(state));
    expect(imported).toEqual(state);
  });

  it('round-trips a log with per-set rpe unchanged', () => {
    const state = validState();
    state.logs.push({
      id: 'l1',
      poolWorkoutId: 'w1',
      workoutSnapshot: state.pool[0],
      startedAt: '2024-01-01T00:00:00.000Z',
      finishedAt: '2024-01-01T00:00:00.000Z',
      kind: 'pool',
      results: [
        {
          movementId: 'squat',
          blockIndex: 0,
          sets: [
            { weight: 225, reps: 5, rpe: 7 },
            { weight: 225, reps: 5, rpe: 8 },
          ],
          rpe: 8,
        },
      ],
    });
    const imported = importState(exportState(state));
    expect(imported.logs[0].results).toEqual(state.logs[0].results);
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

describe('importState seedRevision (SPEC section 8)', () => {
  it('preserves a present seedRevision', () => {
    const state = { ...validState(), schemaVersion: 3 as const, seedRevision: 2 };
    expect(importState(exportState(state)).seedRevision).toBe(2);
  });

  it('leaves seedRevision absent when the export has none (caught up on next load)', () => {
    expect(importState(exportState(validState())).seedRevision).toBeUndefined();
  });

  it('rejects a non-numeric seedRevision', () => {
    const state = { ...validState(), seedRevision: '2' as unknown as number };
    expect(() => importState(JSON.stringify(state))).toThrow(/seedRevision/);
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

  it('accepts schemaVersion 3', () => {
    const state = { ...validState(), schemaVersion: 3 };
    expect(() => importState(JSON.stringify(state))).not.toThrow();
  });

  it('rejects an unsupported schemaVersion', () => {
    const state = { ...validState(), schemaVersion: 4 as unknown as 1 };
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
      // migrate() (SPEC 10.2) appends 'band' when absent.
      availableEquipment: ['barbell', 'band'],
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

describe('importState SPEC 10.2/10.8 (Vasa library facet) additions', () => {
  it('rejects a log with kind: "vasa" (SPEC 10.8 removed the vasa log kind)', () => {
    const state = validState();
    state.logs.push({
      id: 'l1',
      workoutSnapshot: state.pool[0],
      startedAt: '2024-01-01T00:00:00.000Z',
      finishedAt: '2024-01-01T00:00:00.000Z',
      results: [],
      kind: 'vasa' as unknown as 'pool',
    });
    expect(() => importState(JSON.stringify(state))).toThrow(/kind/);
  });

  it('accepts a movement with libraries and an explicit region', () => {
    const state = validState();
    state.movements[0].libraries = ['default', 'vasa'];
    state.movements[0].region = 'upper';
    const imported = importState(JSON.stringify(state));
    expect(imported.movements[0].libraries).toEqual(['default', 'vasa']);
    expect(imported.movements[0].region).toBe('upper');
  });

  it('rejects a movement with an invalid library', () => {
    const state: Record<string, unknown> = { ...validState() };
    (state.movements as Record<string, unknown>[])[0].libraries = ['default', 'nonsense'];
    expect(() => importState(JSON.stringify(state))).toThrow(/libraries/);
  });

  it('rejects a movement with an invalid region', () => {
    const state: Record<string, unknown> = { ...validState() };
    (state.movements as Record<string, unknown>[])[0].region = 'sideways';
    expect(() => importState(JSON.stringify(state))).toThrow(/region/);
  });

  it('accepts "band" as movement/settings equipment', () => {
    const state = validState();
    state.movements[0].equipment.push('band');
    state.settings.availableEquipment.push('band');
    const imported = importState(JSON.stringify(state));
    expect(imported.movements[0].equipment).toContain('band');
    expect(imported.settings.availableEquipment).toContain('band');
  });
});
