import { describe, it, expect } from 'vitest';
import { dayType, REQUIRED_WEEKLY, weeklyNeed } from './weekly';
import type { PoolWorkout, WorkoutLog } from './types';

function workout(id: string, overrides: Partial<PoolWorkout> = {}): PoolWorkout {
  return {
    id,
    name: id,
    intensity: 'M',
    blocks: [{ format: 'strength', movements: [{ movementId: 'deadlift' }] }],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
    ...overrides,
  };
}

function log(id: string, finishedAt: string, workoutOverrides: Partial<PoolWorkout> = {}): WorkoutLog {
  const snapshot = workout(id, workoutOverrides);
  return {
    id: `log-${id}-${finishedAt}`,
    poolWorkoutId: snapshot.id,
    workoutSnapshot: snapshot,
    startedAt: finishedAt,
    finishedAt,
    results: [],
  };
}

const NOW = '2024-02-08T00:00:00.000Z'; // a Thursday

describe('dayType', () => {
  it('reads a day:* tag', () => {
    expect(dayType(workout('w1', { tags: ['day:deadlift-press', 'other'] }))).toBe('deadlift-press');
  });

  it('returns null when no day:* tag is present', () => {
    expect(dayType(workout('w1', { tags: ['other'] }))).toBeNull();
    expect(dayType(workout('w1'))).toBeNull();
  });
});

describe('weeklyNeed', () => {
  it('detects the need when no matching log exists in the last 7 days', () => {
    expect(weeklyNeed([], NOW)).toBe(REQUIRED_WEEKLY[0]);
  });

  it('detects the need when the only matching log is more than 7 days old', () => {
    const logs = [log('w1', '2024-01-20T00:00:00.000Z', { tags: ['day:deadlift-press'] })];
    expect(weeklyNeed(logs, NOW)).toBe('deadlift-press');
  });

  it('clears the need when a matching log happened 3 days ago', () => {
    const logs = [log('w1', '2024-02-05T00:00:00.000Z', { tags: ['day:deadlift-press'] })]; // 3 days ago
    expect(weeklyNeed(logs, NOW)).toBeNull();
  });

  it('is not satisfied by a differently-tagged log', () => {
    const logs = [log('w1', '2024-02-07T00:00:00.000Z', { tags: ['day:strength'] })];
    expect(weeklyNeed(logs, NOW)).toBe('deadlift-press');
  });
});
