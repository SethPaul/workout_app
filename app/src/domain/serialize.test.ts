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
  it('round-trips a valid state', () => {
    const state = validState();
    const json = exportState(state);
    const imported = importState(json);
    expect(imported).toEqual(state);
  });
});

describe('importState validation', () => {
  it('rejects invalid JSON', () => {
    expect(() => importState('{not json')).toThrow(/could not parse JSON/);
  });

  it('rejects a non-object root', () => {
    expect(() => importState('[]')).toThrow(/root value must be an object/);
  });

  it('rejects a wrong schemaVersion', () => {
    const state = { ...validState(), schemaVersion: 2 as unknown as 1 };
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
});
