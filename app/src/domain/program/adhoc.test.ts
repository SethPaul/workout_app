import { describe, it, expect } from 'vitest';
import { buildAdhocLog } from './adhoc';
import { lastPerformedMovement } from '../cadence';
import { heavyMovementsInWorkout } from '../patterns';
import { currentMax, e1rm } from './e1rm';
import type { Movement } from '../types';

describe('buildAdhocLog', () => {
  it('builds a kind: adhoc log with no poolWorkoutId and a synthetic snapshot', () => {
    const log = buildAdhocLog({
      date: '2024-01-01T00:00:00.000Z',
      entries: [{ movementId: 'squat', sets: [{ weight: 200, reps: 5, rpe: 8 }] }],
      id: 'l1',
    });
    expect(log.kind).toBe('adhoc');
    expect(log.poolWorkoutId).toBeUndefined();
    expect(log.workoutSnapshot.id).toBe('adhoc-l1');
    expect(log.workoutSnapshot.source).toBe('manual');
    expect(log.workoutSnapshot.blocks).toHaveLength(1);
    expect(log.workoutSnapshot.blocks[0].format).toBe('strength');
    expect(log.results[0]).toMatchObject({ movementId: 'squat', rpe: 8 });
  });

  it('marks a max test with kind: max-test', () => {
    const log = buildAdhocLog({
      date: '2024-01-01T00:00:00.000Z',
      entries: [{ movementId: 'squat', sets: [{ weight: 315, reps: 1 }] }],
      maxTest: true,
      id: 'l2',
    });
    expect(log.kind).toBe('max-test');
  });

  it('takes the hardest (max) rpe across sets as the per-movement result rpe', () => {
    const log = buildAdhocLog({
      date: '2024-01-01T00:00:00.000Z',
      entries: [
        {
          movementId: 'squat',
          sets: [
            { weight: 200, reps: 5, rpe: 7 },
            { weight: 200, reps: 5, rpe: 9 },
          ],
        },
      ],
      id: 'l3',
    });
    expect(log.results[0].rpe).toBe(9);
  });

  it('produces one strength block per movement for multiple entries', () => {
    const log = buildAdhocLog({
      date: '2024-01-01T00:00:00.000Z',
      entries: [
        { movementId: 'squat', sets: [{ weight: 200, reps: 5 }] },
        { movementId: 'bench', sets: [{ weight: 135, reps: 5 }] },
      ],
      id: 'l4',
    });
    expect(log.workoutSnapshot.blocks).toHaveLength(2);
    expect(log.workoutSnapshot.blocks.map((b) => b.movements[0].movementId)).toEqual(['squat', 'bench']);
  });

  it('generates a unique id when none is given', () => {
    const l1 = buildAdhocLog({ date: '2024-01-01T00:00:00.000Z', entries: [] });
    const l2 = buildAdhocLog({ date: '2024-01-01T00:00:00.000Z', entries: [] });
    expect(l1.id).not.toBe(l2.id);
  });
});

describe('buildAdhocLog integrates with cadence/patterns/e1rm', () => {
  const squat: Movement = {
    id: 'squat',
    name: 'Squat',
    tags: ['squat', 'compound'],
    equipment: ['barbell', 'rack'],
    cadenceDays: 7,
    unit: 'reps',
    loadable: true,
  };

  it('lastPerformedMovement sees an adhoc log', () => {
    const log = buildAdhocLog({
      date: '2024-01-15T00:00:00.000Z',
      entries: [{ movementId: 'squat', sets: [{ weight: 200, reps: 5 }] }],
      id: 'l1',
    });
    expect(lastPerformedMovement([log], 'squat')).toBe('2024-01-15T00:00:00.000Z');
  });

  it('heavyMovementsInWorkout detects the synthetic strength block as HEAVY', () => {
    const log = buildAdhocLog({
      date: '2024-01-15T00:00:00.000Z',
      entries: [{ movementId: 'squat', sets: [{ weight: 200, reps: 5 }] }],
      id: 'l1',
    });
    const movementById = new Map([['squat', squat]]);
    const heavy = heavyMovementsInWorkout(log.workoutSnapshot, movementById);
    expect(heavy.map((m) => m.id)).toEqual(['squat']);
  });

  it('currentMax picks up a max-test adhoc log', () => {
    const log = buildAdhocLog({
      date: '2024-01-15T00:00:00.000Z',
      entries: [{ movementId: 'squat', sets: [{ weight: 315, reps: 1 }] }],
      maxTest: true,
      id: 'l1',
    });
    expect(currentMax([log], 'squat', '2024-01-20T00:00:00.000Z')).toBeCloseTo(e1rm(315, 1)!);
  });
});
