import { describe, it, expect } from 'vitest';
import { applyWave, cycleWeek, effectiveCycleStart, isDeloadWeek, weekKind } from './cycle';
import type { Movement, PoolWorkout, ProgramState, Settings } from '../types';

const settings: Settings = { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true };

function program(overrides: Partial<ProgramState> = {}): ProgramState {
  return { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [], ...overrides };
}

describe('cycleWeek', () => {
  it('is week 1 for the first 6 days', () => {
    expect(cycleWeek(program(), '2024-01-01T00:00:00.000Z')).toBe(1);
    expect(cycleWeek(program(), '2024-01-06T00:00:00.000Z')).toBe(1);
  });

  it('is week 2 on day 7', () => {
    expect(cycleWeek(program(), '2024-01-08T00:00:00.000Z')).toBe(2);
  });

  it('is week 4 three weeks in', () => {
    expect(cycleWeek(program(), '2024-01-22T00:00:00.000Z')).toBe(4);
  });
});

describe('isDeloadWeek', () => {
  it('false when no deload has been started', () => {
    expect(isDeloadWeek(program(), '2024-01-01T00:00:00.000Z')).toBe(false);
  });

  it('true within 7 days of deloadWeekStartedAt', () => {
    const p = program({ deloadWeekStartedAt: '2024-02-01T00:00:00.000Z' });
    expect(isDeloadWeek(p, '2024-02-03T00:00:00.000Z')).toBe(true);
  });

  it('false once 7+ days have elapsed', () => {
    const p = program({ deloadWeekStartedAt: '2024-02-01T00:00:00.000Z' });
    expect(isDeloadWeek(p, '2024-02-08T00:00:00.000Z')).toBe(false);
  });
});

describe('weekKind', () => {
  it('cycleWeeks 3: 1, 3 (peak at cycleWeeks-1), 2', () => {
    expect(weekKind(1, 3)).toBe(1);
    expect(weekKind(2, 3)).toBe(3);
    expect(weekKind(3, 3)).toBe(2);
  });

  it('cycleWeeks 4: 1, 2, 3, 2 (SPEC 9.5)', () => {
    expect(weekKind(1, 4)).toBe(1);
    expect(weekKind(2, 4)).toBe(2);
    expect(weekKind(3, 4)).toBe(3);
    expect(weekKind(4, 4)).toBe(2);
  });

  it('cycleWeeks 5: 1, 2, 3 (peak), 2, 2', () => {
    expect(weekKind(1, 5)).toBe(1);
    expect(weekKind(2, 5)).toBe(2);
    expect(weekKind(3, 5)).toBe(2);
    expect(weekKind(4, 5)).toBe(3);
    expect(weekKind(5, 5)).toBe(2);
  });

  it('cycleWeeks 6: 1, 2, 2, 2, 3 (peak), 2', () => {
    expect(weekKind(1, 6)).toBe(1);
    expect(weekKind(2, 6)).toBe(2);
    expect(weekKind(3, 6)).toBe(2);
    expect(weekKind(4, 6)).toBe(2);
    expect(weekKind(5, 6)).toBe(3);
    expect(weekKind(6, 6)).toBe(2);
  });
});

describe('effectiveCycleStart / cycleWeek automatic rollover', () => {
  const offSettings = (cycleWeeks = 4): Settings => ({ ...settings, deloadPolicy: 'off', cycleWeeks });

  it("policy 'off': unchanged before a full cycleWeeks period has elapsed", () => {
    const p = program({ cycleStartedAt: '2024-01-01T00:00:00.000Z' });
    const now = '2024-01-22T00:00:00.000Z'; // 3 weeks in, cycleWeeks=4
    expect(effectiveCycleStart(p, offSettings(4), now)).toBe(p.cycleStartedAt);
    expect(cycleWeek(p, now, offSettings(4))).toBe(4);
  });

  it("policy 'off': rolls the start forward by whole cycleWeeks periods once exceeded", () => {
    const p = program({ cycleStartedAt: '2024-01-01T00:00:00.000Z' });
    const now = '2024-02-01T00:00:00.000Z'; // 31 days in, cycleWeeks=4 (28-day periods)
    const rolled = effectiveCycleStart(p, offSettings(4), now);
    expect(rolled).toBe('2024-01-29T00:00:00.000Z'); // one 4-week period later
    // Without rollover this would be week 5+; with it, day 3 of the new cycle -> week 1.
    expect(cycleWeek(p, now, offSettings(4))).toBe(1);
  });

  it("policies other than 'off' never roll over — the week keeps counting until a deload is accepted", () => {
    const p = program({ cycleStartedAt: '2024-01-01T00:00:00.000Z' });
    const now = '2024-03-01T00:00:00.000Z'; // well past cycleWeeks with no deload
    const fatigueSettings: Settings = { ...settings, deloadPolicy: 'fatigue', cycleWeeks: 4 };
    expect(effectiveCycleStart(p, fatigueSettings, now)).toBe(p.cycleStartedAt);
  });

  it('cycleWeek without a settings argument behaves exactly as before (no rollover)', () => {
    const p = program({ cycleStartedAt: '2024-01-01T00:00:00.000Z' });
    expect(cycleWeek(p, '2024-02-01T00:00:00.000Z')).toBe(5);
  });
});

function strengthWorkout(overrides: Partial<PoolWorkout> = {}): PoolWorkout {
  return {
    id: 'w1',
    name: 'Squat Day',
    intensity: 'H',
    blocks: [
      {
        format: 'strength',
        title: 'Main',
        sets: 5,
        movements: [{ movementId: 'squat', reps: 5 }],
      },
      {
        format: 'amrap',
        title: 'Conditioning',
        durationSec: 600,
        movements: [{ movementId: 'row', distanceM: 500 }],
      },
    ],
    cadenceDays: 7,
    enabled: true,
    source: 'manual',
    ...overrides,
  };
}

const movements: Movement[] = [
  { id: 'squat', name: 'Squat', tags: ['squat'], equipment: ['barbell'], cadenceDays: 7, unit: 'reps', loadable: true },
  {
    id: 'snatch',
    name: 'Snatch',
    tags: ['olympic'],
    equipment: ['barbell'],
    cadenceDays: 3,
    unit: 'reps',
    loadable: true,
  },
  { id: 'row', name: 'Row', tags: ['cardio'], equipment: ['rower'], cadenceDays: 1, unit: 'meters', loadable: false },
];

describe('applyWave', () => {
  it('week 1: sets unchanged, targetRpe 7', () => {
    const result = applyWave(strengthWorkout(), 1, false, settings, movements);
    const strength = result.blocks[0];
    expect(strength.sets).toBe(5);
    expect(strength.movements[0].reps).toBe(5);
    expect(strength.movements[0].targetRpe).toBe(7);
  });

  it('week 2: sets unchanged, targetRpe 8', () => {
    const result = applyWave(strengthWorkout(), 2, false, settings, movements);
    const strength = result.blocks[0];
    expect(strength.sets).toBe(5);
    expect(strength.movements[0].targetRpe).toBe(8);
  });

  it('week 3: sets-1 (min 3), reps-1 (min 3 for non-olympic), targetRpe 9', () => {
    const result = applyWave(strengthWorkout(), 3, false, settings, movements);
    const strength = result.blocks[0];
    expect(strength.sets).toBe(4);
    expect(strength.movements[0].reps).toBe(4);
    expect(strength.movements[0].targetRpe).toBe(9);
  });

  it('week 3: rep floor is 2 (not 3) for an olympic movement', () => {
    const workout = strengthWorkout({
      blocks: [{ format: 'strength', sets: 3, movements: [{ movementId: 'snatch', reps: 3 }] }],
    });
    const result = applyWave(workout, 3, false, settings, movements);
    expect(result.blocks[0].movements[0].reps).toBe(2);
  });

  it('week 3 sets floor at 3 even from a low starting count', () => {
    const workout = strengthWorkout({
      blocks: [{ format: 'strength', sets: 3, movements: [{ movementId: 'squat', reps: 5 }] }],
    });
    const result = applyWave(workout, 3, false, settings, movements);
    expect(result.blocks[0].sets).toBe(3);
  });

  it('week 4 (default cycleWeeks=4) behaves like week 2', () => {
    const result = applyWave(strengthWorkout(), 4, false, settings, movements);
    const strength = result.blocks[0];
    expect(strength.sets).toBe(5);
    expect(strength.movements[0].targetRpe).toBe(8);
  });

  it('non-strength blocks are untouched outside deload', () => {
    for (const week of [1, 2, 3, 4]) {
      const result = applyWave(strengthWorkout(), week, false, settings, movements);
      expect(result.blocks[1]).toEqual(strengthWorkout().blocks[1]);
    }
  });

  it('deload: sets x0.5 rounded up (min 2), targetRpe 6', () => {
    const result = applyWave(strengthWorkout(), 2, true, settings, movements);
    const strength = result.blocks[0];
    expect(strength.sets).toBe(3); // ceil(5*0.5) = 3
    expect(strength.movements[0].targetRpe).toBe(6);
  });

  it('deload: sets floor at 2 from a small starting count', () => {
    const workout = strengthWorkout({
      blocks: [{ format: 'strength', sets: 2, movements: [{ movementId: 'squat', reps: 5 }] }],
    });
    const result = applyWave(workout, 2, true, settings, movements);
    expect(result.blocks[0].sets).toBe(2);
  });

  it('deload: scales an amrap conditioning block duration x0.6', () => {
    const result = applyWave(strengthWorkout(), 2, true, settings, movements);
    expect(result.blocks[1].durationSec).toBe(360); // 600 * 0.6
  });

  it('deload: floors an amrap duration at 120s even from a short starting duration', () => {
    const workout = strengthWorkout({
      blocks: [
        { format: 'strength', sets: 5, movements: [{ movementId: 'squat', reps: 5 }] },
        { format: 'amrap', durationSec: 150, movements: [{ movementId: 'row', distanceM: 100 }] },
      ],
    });
    const result = applyWave(workout, 2, true, settings, movements);
    // 150 * 0.6 = 90, below the 120s floor.
    expect(result.blocks[1].durationSec).toBe(120);
  });

  it('deload: scales interval rounds x0.6', () => {
    const workout = strengthWorkout({
      blocks: [
        { format: 'strength', sets: 5, movements: [{ movementId: 'squat', reps: 5 }] },
        { format: 'interval', rounds: 10, workSec: 30, restSec: 30, movements: [{ movementId: 'row' }] },
      ],
    });
    const result = applyWave(workout, 2, true, settings, movements);
    expect(result.blocks[1].rounds).toBe(6);
  });

  it('deload: leaves a tabata block untouched', () => {
    const workout = strengthWorkout({
      blocks: [
        { format: 'strength', sets: 5, movements: [{ movementId: 'squat', reps: 5 }] },
        { format: 'tabata', rounds: 8, movements: [{ movementId: 'row' }] },
      ],
    });
    const result = applyWave(workout, 2, true, settings, movements);
    expect(result.blocks[1].rounds).toBe(8);
  });

  it('deload: appends "Deload week" to notes', () => {
    const result = applyWave(strengthWorkout({ notes: 'Bring chalk' }), 2, true, settings, movements);
    expect(result.notes).toBe('Bring chalk Deload week');
  });

  it('deload: sets notes to "Deload week" when there were none', () => {
    const result = applyWave(strengthWorkout(), 2, true, settings, movements);
    expect(result.notes).toBe('Deload week');
  });

  it('does not mutate the original workout', () => {
    const original = strengthWorkout();
    const snapshot = JSON.parse(JSON.stringify(original));
    applyWave(original, 3, true, settings, movements);
    expect(original).toEqual(snapshot);
  });
});
