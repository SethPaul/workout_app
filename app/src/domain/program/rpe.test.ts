import { describe, it, expect } from 'vitest';
import { defaultIncrement, loadForBlockMovement, resolveIncrement, RPE_TABLE, suggestLoad } from './rpe';
import type { Movement, WorkoutLog } from '../types';

function movement(id: string, overrides: Partial<Movement> = {}): Movement {
  return {
    id,
    name: id,
    tags: [],
    equipment: [],
    cadenceDays: 7,
    unit: 'reps',
    loadable: true,
    ...overrides,
  };
}

describe('RPE_TABLE anchors (SPEC 9.3)', () => {
  it('matches the spec-given anchor fractions', () => {
    expect(RPE_TABLE[1][10]).toBe(1.0);
    expect(RPE_TABLE[1][9]).toBe(0.955);
    expect(RPE_TABLE[1][8]).toBe(0.922);
    expect(RPE_TABLE[2][10]).toBe(0.955);
    expect(RPE_TABLE[3][10]).toBe(0.922);
    expect(RPE_TABLE[5][10]).toBe(0.862);
    expect(RPE_TABLE[5][8]).toBe(0.811);
    expect(RPE_TABLE[8][10]).toBe(0.786);
    expect(RPE_TABLE[10][10]).toBe(0.739);
  });

  it('is monotonically decreasing across reps 1-10 at a fixed RPE', () => {
    for (let rpe = 6; rpe <= 10; rpe++) {
      for (let reps = 1; reps < 10; reps++) {
        expect(RPE_TABLE[reps][rpe]).toBeGreaterThan(RPE_TABLE[reps + 1][rpe]);
      }
    }
  });

  it('is monotonically decreasing across RPE 6-10 at a fixed rep count', () => {
    for (let reps = 1; reps <= 10; reps++) {
      for (let rpe = 7; rpe <= 10; rpe++) {
        expect(RPE_TABLE[reps][rpe]).toBeGreaterThan(RPE_TABLE[reps][rpe - 1]);
      }
    }
  });
});

describe('defaultIncrement (SPEC 9.1)', () => {
  it('lower-body barbell: 10 lb / 5 kg', () => {
    const m = movement('squat', { tags: ['squat'], equipment: ['barbell'] });
    expect(defaultIncrement(m, 'lb')).toBe(10);
    expect(defaultIncrement(m, 'kg')).toBe(5);
  });

  it('upper-body barbell: 5 lb / 2.5 kg', () => {
    const m = movement('bench', { tags: ['push'], equipment: ['barbell'] });
    expect(defaultIncrement(m, 'lb')).toBe(5);
    expect(defaultIncrement(m, 'kg')).toBe(2.5);
  });

  it('dumbbell/kettlebell: 5 lb / 2 kg', () => {
    const m = movement('db_press', { tags: ['push'], equipment: ['dumbbell'] });
    expect(defaultIncrement(m, 'lb')).toBe(5);
    expect(defaultIncrement(m, 'kg')).toBe(2);
    const kb = movement('kb_swing', { tags: ['hinge'], equipment: ['kettlebell'] });
    expect(defaultIncrement(kb, 'lb')).toBe(5);
  });

  it('bodyweight: 0', () => {
    const m = movement('pushup', { tags: ['bodyweight'], equipment: ['none'] });
    expect(defaultIncrement(m, 'lb')).toBe(0);
  });

  it('non-loadable: 0', () => {
    const m = movement('row', { equipment: ['rower'], loadable: false });
    expect(defaultIncrement(m, 'lb')).toBe(0);
  });

  it('an explicit movement.increment overrides the default', () => {
    const m = movement('squat', { tags: ['squat'], equipment: ['barbell'], increment: 2.5 });
    expect(resolveIncrement(m, 'lb')).toBe(2.5);
  });
});

describe('suggestLoad', () => {
  const squat = movement('squat', { tags: ['squat'], equipment: ['barbell'] });

  function logAt(weight: number, reps: number, finishedAt: string): WorkoutLog {
    return {
      id: finishedAt,
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
      results: [{ movementId: 'squat', sets: [{ weight, reps }] }],
    };
  }

  it('returns null with no known max', () => {
    expect(suggestLoad(squat, 5, 8, [], 'lb', '2024-01-01T00:00:00.000Z')).toBeNull();
  });

  it('rounds to the nearest half-increment (5 lb for a 10 lb lower-body increment)', () => {
    const logs = [logAt(200, 5, '2024-01-01T00:00:00.000Z')];
    const now = '2024-01-15T00:00:00.000Z';
    const max = 200 * (1 + 5 / 30); // ~233.3
    const suggested = suggestLoad(squat, 5, 8, logs, 'lb', now)!;
    expect(suggested % 5).toBe(0);
    expect(Math.abs(suggested - max * RPE_TABLE_5_8())).toBeLessThanOrEqual(2.5);
  });

  function RPE_TABLE_5_8(): number {
    return 0.811;
  }

  it('a heavier single-target (low reps, high RPE) suggests more load than a higher-rep target', () => {
    const logs = [logAt(200, 5, '2024-01-01T00:00:00.000Z')];
    const now = '2024-01-15T00:00:00.000Z';
    const heavy = suggestLoad(squat, 1, 10, logs, 'lb', now)!;
    const light = suggestLoad(squat, 8, 8, logs, 'lb', now)!;
    expect(heavy).toBeGreaterThan(light);
  });

  function logFor(movementId: string, weight: number, reps: number, finishedAt: string): WorkoutLog {
    return {
      id: `${movementId}-${finishedAt}`,
      poolWorkoutId: 'w1',
      workoutSnapshot: {
        id: 'w1',
        name: 'w1',
        intensity: 'M',
        blocks: [{ format: 'strength', movements: [{ movementId }] }],
        cadenceDays: 14,
        enabled: true,
        source: 'manual',
      },
      startedAt: finishedAt,
      finishedAt,
      results: [{ movementId, sets: [{ weight, reps }] }],
    };
  }

  it('increment 0 (bodyweight): rounds the suggested load to a whole number, not a fraction', () => {
    const pushup = movement('pushup', { tags: ['bodyweight'], equipment: ['none'], increment: 0 });
    expect(resolveIncrement(pushup, 'lb')).toBe(0);
    const logs = [logFor('pushup', 150, 5, '2024-01-01T00:00:00.000Z')];
    const suggested = suggestLoad(pushup, 5, 8, logs, 'lb', '2024-01-15T00:00:00.000Z')!;
    expect(suggested).not.toBeNull();
    expect(Number.isInteger(suggested)).toBe(true);
  });

  it('kg with a 2.5 increment: rounds the suggested load to the nearest 1.25 kg step', () => {
    const bench = movement('bench', { tags: ['push'], equipment: ['barbell'], increment: 2.5 });
    expect(resolveIncrement(bench, 'kg')).toBe(2.5);
    const logs = [logFor('bench', 90, 5, '2024-01-01T00:00:00.000Z')];
    const suggested = suggestLoad(bench, 5, 8, logs, 'kg', '2024-01-15T00:00:00.000Z')!;
    expect(suggested).not.toBeNull();
    // step = increment / 2 = 1.25 kg; multiplying by 4 and checking it lands
    // on a whole number avoids float-modulo noise (e.g. 106.25 % 1.25).
    expect(Number.isInteger(suggested * 4)).toBe(true);
  });
});

describe('loadForBlockMovement loadPct override', () => {
  const squat = movement('squat', { tags: ['squat'], equipment: ['barbell'] });
  const logs: WorkoutLog[] = [
    {
      id: 'l1',
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
      startedAt: '2024-01-01T00:00:00.000Z',
      finishedAt: '2024-01-01T00:00:00.000Z',
      results: [{ movementId: 'squat', sets: [{ weight: 200, reps: 5 }] }],
    },
  ];
  const now = '2024-01-10T00:00:00.000Z';

  it('uses loadPct instead of the RPE table when present', () => {
    const max = 200 * (1 + 5 / 30);
    const result = loadForBlockMovement({ movementId: 'squat', loadPct: 50 }, squat, logs, 'lb', now)!;
    expect(Math.abs(result - max * 0.5)).toBeLessThanOrEqual(2.5);
  });

  it('falls back to the RPE table when loadPct is absent', () => {
    const result = loadForBlockMovement({ movementId: 'squat', reps: 5, targetRpe: 8 }, squat, logs, 'lb', now);
    expect(result).not.toBeNull();
  });
});
