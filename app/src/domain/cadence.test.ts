import { describe, it, expect } from 'vitest';
import { daysSince, lastPerformedMovement, lastPerformedWorkout, movementDueIn } from './cadence';
import type { Movement, PoolWorkout, WorkoutLog } from './types';

function makeWorkout(id: string, movementIds: string[]): PoolWorkout {
  return {
    id,
    name: id,
    intensity: 'M',
    blocks: [
      {
        format: 'strength',
        movements: movementIds.map((movementId) => ({ movementId })),
      },
    ],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
  };
}

function makeLog(poolWorkoutId: string, movementIds: string[], finishedAt: string): WorkoutLog {
  return {
    id: `log-${finishedAt}`,
    poolWorkoutId,
    workoutSnapshot: makeWorkout(poolWorkoutId, movementIds),
    startedAt: finishedAt,
    finishedAt,
    results: [],
  };
}

describe('daysSince', () => {
  it('computes whole days elapsed', () => {
    expect(daysSince('2024-01-01T00:00:00.000Z', '2024-01-04T00:00:00.000Z')).toBe(3);
  });

  it('floors partial days', () => {
    expect(daysSince('2024-01-01T00:00:00.000Z', '2024-01-03T23:00:00.000Z')).toBe(2);
  });

  it('returns 0 for the same instant', () => {
    expect(daysSince('2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')).toBe(0);
  });

  it('accepts a Date for now', () => {
    expect(daysSince('2024-01-01T00:00:00.000Z', new Date('2024-01-08T00:00:00.000Z'))).toBe(7);
  });
});

describe('lastPerformedMovement', () => {
  it('returns null when never performed', () => {
    expect(lastPerformedMovement([], 'deadlift')).toBeNull();
  });

  it('finds the latest finishedAt among logs containing the movement', () => {
    const logs = [
      makeLog('w1', ['deadlift'], '2024-01-01T00:00:00.000Z'),
      makeLog('w2', ['squat'], '2024-01-05T00:00:00.000Z'),
      makeLog('w3', ['deadlift', 'row'], '2024-01-03T00:00:00.000Z'),
    ];
    expect(lastPerformedMovement(logs, 'deadlift')).toBe('2024-01-03T00:00:00.000Z');
  });

  it('ignores logs that do not contain the movement', () => {
    const logs = [makeLog('w1', ['squat'], '2024-01-01T00:00:00.000Z')];
    expect(lastPerformedMovement(logs, 'deadlift')).toBeNull();
  });
});

describe('lastPerformedWorkout', () => {
  it('returns null when never performed', () => {
    expect(lastPerformedWorkout([], 'w1')).toBeNull();
  });

  it('finds the latest finishedAt for that exact workout id', () => {
    const logs = [
      makeLog('w1', ['deadlift'], '2024-01-01T00:00:00.000Z'),
      makeLog('w1', ['deadlift'], '2024-01-10T00:00:00.000Z'),
      makeLog('w2', ['squat'], '2024-01-20T00:00:00.000Z'),
    ];
    expect(lastPerformedWorkout(logs, 'w1')).toBe('2024-01-10T00:00:00.000Z');
  });
});

describe('movementDueIn', () => {
  const deadlift: Movement = {
    id: 'deadlift',
    name: 'Deadlift',
    tags: ['compound', 'hinge'],
    equipment: ['barbell', 'rack'],
    cadenceDays: 7,
    unit: 'reps',
    loadable: true,
  };

  it('returns null (always due) when never performed', () => {
    expect(movementDueIn(deadlift, [], '2024-01-08T00:00:00.000Z')).toBeNull();
  });

  it('returns a positive number of days remaining before cadence expires', () => {
    const logs = [makeLog('w1', ['deadlift'], '2024-01-01T00:00:00.000Z')];
    expect(movementDueIn(deadlift, logs, '2024-01-04T00:00:00.000Z')).toBe(4);
  });

  it('returns zero or negative once due', () => {
    const logs = [makeLog('w1', ['deadlift'], '2024-01-01T00:00:00.000Z')];
    expect(movementDueIn(deadlift, logs, '2024-01-08T00:00:00.000Z')).toBe(0);
    expect(movementDueIn(deadlift, logs, '2024-01-10T00:00:00.000Z')).toBe(-2);
  });
});
