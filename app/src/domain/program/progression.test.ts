import { describe, it, expect } from 'vitest';
import { progressionStatus } from './progression';
import type { Movement, PoolWorkout, Settings, WorkoutLog } from '../types';

function movement(id: string, overrides: Partial<Movement> = {}): Movement {
  return {
    id,
    name: id,
    tags: [],
    equipment: ['barbell'],
    cadenceDays: 7,
    unit: 'reps',
    loadable: true,
    ...overrides,
  };
}

const settings: Settings = { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true };

function strengthLog(
  id: string,
  finishedAt: string,
  movementId: string,
  bmOverrides: { reps?: number; targetRpe?: number },
  sets: { weight: number; reps: number }[],
  rpe?: number,
  options: { prescribedSets?: number; kind?: WorkoutLog['kind'] } = {},
): WorkoutLog {
  const workoutSnapshot: PoolWorkout = {
    id: `w-${id}`,
    name: `w-${id}`,
    intensity: 'M',
    blocks: [
      { format: 'strength', sets: options.prescribedSets ?? sets.length, movements: [{ movementId, ...bmOverrides }] },
    ],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
  };
  return {
    id,
    poolWorkoutId: workoutSnapshot.id,
    workoutSnapshot,
    startedAt: finishedAt,
    finishedAt,
    results: [{ movementId, sets, rpe }],
    kind: options.kind ?? 'pool',
  };
}

describe('progressionStatus: linear (barbell default)', () => {
  const squat = movement('squat', { tags: ['squat'], equipment: ['barbell'] });

  it('unknown when the movement has never been logged in a strength block', () => {
    const result = progressionStatus(squat, [], settings);
    expect(result.status).toBe('unknown');
    expect(result.mode).toBe('linear');
  });

  it('success: every set hit target reps at rpe <= target+0.5 -> progress, next load = last + increment', () => {
    const logs = [
      strengthLog('l1', '2024-01-01T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [
        { weight: 200, reps: 5 },
        { weight: 200, reps: 5 },
      ], 8),
    ];
    const result = progressionStatus(squat, logs, settings);
    expect(result.status).toBe('progress');
    expect(result.lastLoad).toBe(200);
    expect(result.nextLoad).toBe(210); // default lower-body barbell increment: 10 lb
  });

  it('missing RPE counts as success', () => {
    const logs = [
      strengthLog('l1', '2024-01-01T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [{ weight: 200, reps: 5 }]),
    ];
    const result = progressionStatus(squat, logs, settings);
    expect(result.status).toBe('progress');
  });

  it('a single missed session is a hold, not a stall', () => {
    const logs = [
      strengthLog('l1', '2024-01-01T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [{ weight: 200, reps: 5 }]),
      strengthLog('l2', '2024-01-08T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [{ weight: 205, reps: 3 }]),
    ];
    const result = progressionStatus(squat, logs, settings);
    expect(result.status).toBe('hold');
    expect(result.stallCount).toBe(1);
  });

  it('two consecutive missed sessions is a stall, suggesting a ~10% cut', () => {
    const logs = [
      strengthLog('l1', '2024-01-01T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [{ weight: 200, reps: 5 }]),
      strengthLog('l2', '2024-01-08T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [{ weight: 205, reps: 3 }]),
      strengthLog('l3', '2024-01-15T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [{ weight: 205, reps: 3 }]),
    ];
    const result = progressionStatus(squat, logs, settings);
    expect(result.status).toBe('stall');
    expect(result.stallCount).toBe(2);
    expect(result.suggestion).toMatch(/10%/);
    expect(result.nextLoad).toBeLessThan(205);
  });

  it('a high rpe (>target+0.5) even with reps met counts as a miss', () => {
    const logs = [
      strengthLog('l1', '2024-01-01T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [{ weight: 200, reps: 5 }]),
      strengthLog(
        'l2',
        '2024-01-08T00:00:00.000Z',
        'squat',
        { reps: 5, targetRpe: 8 },
        [{ weight: 200, reps: 5 }],
        9.8,
      ),
    ];
    const result = progressionStatus(squat, logs, settings);
    expect(result.status).toBe('hold');
  });

  it('back-off then success resumes progression (status flips back to progress)', () => {
    const logs = [
      strengthLog('l1', '2024-01-01T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [{ weight: 205, reps: 3 }]),
      strengthLog('l2', '2024-01-08T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [{ weight: 205, reps: 3 }]),
      // Backed off to ~185 (stall cut) and hit it clean:
      strengthLog('l3', '2024-01-15T00:00:00.000Z', 'squat', { reps: 5, targetRpe: 8 }, [{ weight: 185, reps: 5 }]),
    ];
    const result = progressionStatus(squat, logs, settings);
    expect(result.status).toBe('progress');
    expect(result.lastLoad).toBe(185);
    expect(result.nextLoad).toBe(195);
  });
});

describe('progressionStatus: double progression (non-barbell default)', () => {
  const curl = movement('db_curl', { tags: ['accessory'], equipment: ['dumbbell'], progression: 'double' });

  it('climbs reps session over session while below the top of the range', () => {
    const logs = [
      strengthLog('l1', '2024-01-01T00:00:00.000Z', 'db_curl', { reps: 6 }, [
        { weight: 30, reps: 6 },
        { weight: 30, reps: 6 },
      ]),
      strengthLog('l2', '2024-01-08T00:00:00.000Z', 'db_curl', { reps: 6 }, [
        { weight: 30, reps: 7 },
        { weight: 30, reps: 7 },
      ]),
    ];
    const result = progressionStatus(curl, logs, settings);
    expect(result.mode).toBe('double');
    expect(result.status).toBe('progress');
    expect(result.lastReps).toBe(7); // heaviest-set reps this session
    expect(result.nextReps).toBe(8);
    expect(result.nextLoad).toBe(30);
  });

  it('adds load and resets to the bottom of the range once every set tops out', () => {
    const logs = [
      strengthLog('l1', '2024-01-08T00:00:00.000Z', 'db_curl', { reps: 8 }, [
        { weight: 30, reps: 8 },
        { weight: 30, reps: 8 },
      ]),
    ];
    const result = progressionStatus(curl, logs, settings);
    expect(result.status).toBe('progress');
    expect(result.nextLoad).toBe(35); // dumbbell increment: 5 lb
    expect(result.nextReps).toBe(6); // reset to repRange[0]
  });

  it('two sessions without any rep or load gain is a stall', () => {
    const logs = [
      strengthLog('l1', '2024-01-01T00:00:00.000Z', 'db_curl', { reps: 6 }, [{ weight: 30, reps: 6 }]),
      strengthLog('l2', '2024-01-08T00:00:00.000Z', 'db_curl', { reps: 6 }, [{ weight: 30, reps: 6 }]),
      strengthLog('l3', '2024-01-15T00:00:00.000Z', 'db_curl', { reps: 6 }, [{ weight: 30, reps: 6 }]),
    ];
    const result = progressionStatus(curl, logs, settings);
    expect(result.status).toBe('stall');
  });
});

describe('progressionStatus: pool sessions only', () => {
  const squat = movement('squat', { tags: ['squat'], equipment: ['barbell'] });

  it('two consecutive max-test logs do not produce a stall (no pool sessions at all)', () => {
    const logs = [
      strengthLog(
        'mt1',
        '2024-01-01T00:00:00.000Z',
        'squat',
        { reps: 5, targetRpe: 8 },
        [{ weight: 300, reps: 1 }],
        undefined,
        { kind: 'max-test' },
      ),
      strengthLog(
        'mt2',
        '2024-01-08T00:00:00.000Z',
        'squat',
        { reps: 5, targetRpe: 8 },
        [{ weight: 305, reps: 1 }],
        undefined,
        { kind: 'max-test' },
      ),
    ];
    const result = progressionStatus(squat, logs, settings);
    expect(result.status).toBe('unknown');
    expect(result.stallCount).toBe(0);
  });

  it('logging fewer sets than prescribed is not a success', () => {
    const logs = [
      strengthLog(
        'l1',
        '2024-01-01T00:00:00.000Z',
        'squat',
        { reps: 5, targetRpe: 8 },
        [
          { weight: 200, reps: 5 },
          { weight: 200, reps: 5 },
          { weight: 200, reps: 5 },
        ],
        8,
        { prescribedSets: 5 }, // only 3 of 5 prescribed sets logged
      ),
    ];
    const result = progressionStatus(squat, logs, settings);
    expect(result.status).not.toBe('progress');
  });
});
