import { describe, expect, it } from 'vitest';
import type { AppState, BlockMovement } from '../domain/types';
import { movementLine } from './helpers';

function fixtureState(): AppState {
  return {
    movements: [
      {
        id: 'squat',
        name: 'Back Squat',
        tags: [],
        equipment: ['barbell'],
        cadenceDays: 7,
        unit: 'reps',
        loadable: true,
      },
    ],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 2,
    program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
  };
}

describe('movementLine', () => {
  it('includes targetRpe alongside other targets', () => {
    const bm: BlockMovement = { movementId: 'squat', reps: 5, targetRpe: 7 };
    expect(movementLine(fixtureState(), bm)).toBe('Back Squat — 5 reps RPE 7');
  });

  it('combines loadPct, rir, and targetRpe when all are present', () => {
    const bm: BlockMovement = { movementId: 'squat', reps: 5, loadPct: 80, rir: 2, targetRpe: 8 };
    expect(movementLine(fixtureState(), bm)).toBe('Back Squat — 5 reps @ 80%, RIR 2, RPE 8');
  });

  it('omits the target segment entirely when no targets are set', () => {
    const bm: BlockMovement = { movementId: 'squat', reps: 5 };
    expect(movementLine(fixtureState(), bm)).toBe('Back Squat — 5 reps');
  });
});
