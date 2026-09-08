import { describe, expect, it } from 'vitest';
import type { PoolWorkout, WorkoutLog } from '../domain/types';
import { buildResultsDraft, draftFromLog, logFromDraft } from './resultsDraft';
import type { AppState } from '../domain/types';

function poolWorkout(): PoolWorkout {
  return {
    id: 'w1',
    name: 'Squat Day',
    intensity: 'M',
    blocks: [
      { format: 'strength', title: 'Strength', movements: [{ movementId: 'squat', reps: 5 }], sets: 3 },
      { format: 'amrap', title: 'Conditioning', movements: [{ movementId: 'row', distanceM: 500 }], durationSec: 600 },
    ],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
  };
}

function baseLog(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'log-1',
    poolWorkoutId: 'w1',
    workoutSnapshot: poolWorkout(),
    startedAt: '2024-06-01T10:00:00.000Z',
    finishedAt: '2024-06-01T10:45:00.000Z',
    score: '7 rounds + 3',
    rpe: 8,
    notes: 'Felt strong',
    kind: 'pool',
    results: [
      {
        movementId: 'squat',
        sets: [
          { weight: 225, reps: 5 },
          { weight: 225, reps: 5 },
          { weight: 235, reps: 4 },
        ],
        rpe: 8.5,
      },
      { movementId: 'row', reps: 2, rpe: undefined },
    ],
    ...overrides,
  };
}

describe('draftFromLog / logFromDraft round-trip', () => {
  it('preserves results, score, rpe, and notes through draftFromLog -> logFromDraft', () => {
    const log = baseLog();
    const draft = draftFromLog(log);
    const restored = logFromDraft(log, draft);

    expect(restored.results).toEqual(log.results);
    expect(restored.score).toEqual(log.score);
    expect(restored.rpe).toEqual(log.rpe);
    expect(restored.notes).toEqual(log.notes);
  });

  it('preserves everything else on the log unchanged (id, poolWorkoutId, workoutSnapshot, kind, timing)', () => {
    const log = baseLog();
    const draft = draftFromLog(log);
    const restored = logFromDraft(log, draft);

    expect(restored.id).toBe(log.id);
    expect(restored.poolWorkoutId).toBe(log.poolWorkoutId);
    expect(restored.workoutSnapshot).toEqual(log.workoutSnapshot);
    expect(restored.kind).toBe(log.kind);
    expect(restored.startedAt).toBe(log.startedAt);
    expect(restored.finishedAt).toBe(log.finishedAt);
  });

  it('round-trips an adhoc-style log with no score/rpe/notes', () => {
    const log = baseLog({ score: undefined, rpe: undefined, notes: undefined, kind: 'adhoc', poolWorkoutId: undefined });
    const draft = draftFromLog(log);
    const restored = logFromDraft(log, draft);

    expect(restored.results).toEqual(log.results);
    expect(restored.score).toBeUndefined();
    expect(restored.rpe).toBeUndefined();
    expect(restored.notes).toBeUndefined();
  });
});

describe('buildResultsDraft', () => {
  function fixtureState(): AppState {
    return {
      movements: [
        { id: 'squat', name: 'Back Squat', tags: [], equipment: ['barbell'], cadenceDays: 7, unit: 'reps', loadable: true },
        { id: 'row', name: 'Row', tags: [], equipment: [], cadenceDays: 1, unit: 'meters', loadable: false },
      ],
      pool: [],
      logs: [],
      settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
      schemaVersion: 2,
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
    };
  }

  it('builds one set-draft per prescribed strength set, and a single entry for non-strength movements', () => {
    const draft = buildResultsDraft(fixtureState(), poolWorkout());
    const squatEntry = draft.movements.find((m) => m.movementId === 'squat');
    const rowEntry = draft.movements.find((m) => m.movementId === 'row');

    expect(squatEntry?.sets).toHaveLength(3);
    expect(squatEntry?.sets?.every((s) => s.reps === '5')).toBe(true);
    expect(rowEntry?.sets).toBeUndefined();
    expect(rowEntry?.reps).toBe('');
  });
});
