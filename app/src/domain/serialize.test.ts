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
});
