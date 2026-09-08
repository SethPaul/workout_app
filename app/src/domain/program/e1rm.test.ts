import { describe, it, expect } from 'vitest';
import { currentMax, e1rm, e1rmHistory } from './e1rm';
import type { WorkoutLog } from '../types';

function snapshot(id: string) {
  return {
    id,
    name: id,
    intensity: 'M' as const,
    blocks: [{ format: 'strength' as const, movements: [{ movementId: 'squat' }] }],
    cadenceDays: 14,
    enabled: true,
    source: 'manual' as const,
  };
}

function log(
  id: string,
  finishedAt: string,
  sets: { weight?: number; reps?: number }[],
  overrides: Partial<WorkoutLog> = {},
): WorkoutLog {
  return {
    id,
    poolWorkoutId: id,
    workoutSnapshot: snapshot(id),
    startedAt: finishedAt,
    finishedAt,
    results: [{ movementId: 'squat', sets }],
    kind: 'pool',
    ...overrides,
  };
}

describe('e1rm', () => {
  it('computes the Epley formula', () => {
    expect(e1rm(100, 5)).toBeCloseTo(100 * (1 + 5 / 30));
  });

  it('is valid at the 1 and 10 rep boundaries', () => {
    expect(e1rm(100, 1)).toBe(100); // a true single is the max, not Epley-inflated
    expect(e1rm(100, 10)).toBeCloseTo(100 * (1 + 10 / 30));
  });

  it('excludes reps above 10', () => {
    expect(e1rm(100, 11)).toBeNull();
  });

  it('excludes reps below 1', () => {
    expect(e1rm(100, 0)).toBeNull();
  });
});

describe('e1rmHistory', () => {
  it('takes the best set per session and sorts oldest first', () => {
    const logs = [
      log('l2', '2024-01-10T00:00:00.000Z', [
        { weight: 100, reps: 5 },
        { weight: 110, reps: 3 },
      ]),
      log('l1', '2024-01-01T00:00:00.000Z', [{ weight: 90, reps: 5 }]),
    ];
    const history = e1rmHistory(logs, 'squat');
    expect(history.map((p) => p.date)).toEqual(['2024-01-01T00:00:00.000Z', '2024-01-10T00:00:00.000Z']);
    expect(history[1].e1rm).toBeCloseTo(e1rm(110, 3)!);
  });

  it('ignores sessions without the movement', () => {
    const logs = [log('l1', '2024-01-01T00:00:00.000Z', [{ weight: 90, reps: 5 }])];
    expect(e1rmHistory(logs, 'bench')).toEqual([]);
  });

  it('marks a max-test log as source "max-test"', () => {
    const logs = [log('l1', '2024-01-01T00:00:00.000Z', [{ weight: 200, reps: 1 }], { kind: 'max-test' })];
    expect(e1rmHistory(logs, 'squat')[0].source).toBe('max-test');
  });

  it('excludes sets outside the 1-10 rep window from the session best', () => {
    const logs = [
      log('l1', '2024-01-01T00:00:00.000Z', [
        { weight: 50, reps: 20 }, // excluded
        { weight: 100, reps: 5 },
      ]),
    ];
    expect(e1rmHistory(logs, 'squat')[0].e1rm).toBeCloseTo(e1rm(100, 5)!);
  });
});

describe('currentMax', () => {
  const NOW = '2024-03-01T00:00:00.000Z';

  it('returns null with no history', () => {
    expect(currentMax([], 'squat', NOW)).toBeNull();
  });

  it('uses the best 8-week estimate when there is no max-test', () => {
    const logs = [
      log('l1', '2024-02-20T00:00:00.000Z', [{ weight: 100, reps: 5 }]),
      log('l2', '2024-02-25T00:00:00.000Z', [{ weight: 105, reps: 5 }]),
    ];
    expect(currentMax(logs, 'squat', NOW)).toBeCloseTo(e1rm(105, 5)!);
  });

  it('ignores estimates older than 8 weeks (56 days)', () => {
    const logs = [log('old', '2023-12-01T00:00:00.000Z', [{ weight: 999, reps: 5 }])];
    expect(currentMax(logs, 'squat', NOW)).toBeNull();
  });

  it('a max-test within 56 days wins over a higher recent estimate', () => {
    const logs = [
      log('l1', '2024-02-25T00:00:00.000Z', [{ weight: 200, reps: 5 }]),
      log('l2', '2024-02-20T00:00:00.000Z', [{ weight: 150, reps: 1 }], { kind: 'max-test' }),
    ];
    expect(currentMax(logs, 'squat', NOW)).toBeCloseTo(e1rm(150, 1)!);
  });

  it('a max-test older than 56 days no longer wins; falls back to recent estimate', () => {
    const logs = [
      log('recent', '2024-02-20T00:00:00.000Z', [{ weight: 120, reps: 5 }]),
      log('stale-test', '2023-11-01T00:00:00.000Z', [{ weight: 300, reps: 1 }], { kind: 'max-test' }),
    ];
    expect(currentMax(logs, 'squat', NOW)).toBeCloseTo(e1rm(120, 5)!);
  });
});
