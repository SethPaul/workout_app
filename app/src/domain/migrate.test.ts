import { describe, it, expect } from 'vitest';
import { migrate } from './migrate';
import type { AppState, WorkoutLog } from './types';

function v1State(overrides: Partial<AppState> = {}): AppState {
  return {
    movements: [],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 1,
    ...overrides,
  };
}

function log(id: string, finishedAt: string): WorkoutLog {
  return {
    id,
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
    results: [],
  };
}

describe('migrate v1 -> v2', () => {
  it('bumps schemaVersion to 2', () => {
    expect(migrate(v1State()).schemaVersion).toBe(2);
  });

  it('stamps kind: "pool" on existing logs', () => {
    const state = v1State({ logs: [log('l1', '2024-01-01T00:00:00.000Z')] });
    const migrated = migrate(state);
    expect(migrated.logs[0].kind).toBe('pool');
  });

  it('leaves an already-present kind untouched', () => {
    const state = v1State({ logs: [{ ...log('l1', '2024-01-01T00:00:00.000Z'), kind: 'max-test' }] });
    const migrated = migrate(state);
    expect(migrated.logs[0].kind).toBe('max-test');
  });

  it('fills in settings defaults', () => {
    const migrated = migrate(v1State());
    expect(migrated.settings.units).toBe('lb');
    expect(migrated.settings.deloadPolicy).toBe('fatigue');
    expect(migrated.settings.cycleWeeks).toBe(4);
    expect(migrated.settings.focus).toBe('balanced');
    expect(migrated.settings.masters).toBe(false);
  });

  it('preserves existing settings values instead of overwriting them', () => {
    const state = v1State();
    state.settings.units = 'kg';
    const migrated = migrate(state);
    expect(migrated.settings.units).toBe('kg');
  });

  it('sets program.cycleStartedAt to the earliest log date when logs exist', () => {
    const state = v1State({
      logs: [log('l1', '2024-01-10T00:00:00.000Z'), log('l2', '2024-01-05T00:00:00.000Z')],
    });
    const migrated = migrate(state);
    expect(migrated.program?.cycleStartedAt).toBe('2024-01-05T00:00:00.000Z');
  });

  it('sets program.cycleStartedAt to `now` when there are no logs', () => {
    const migrated = migrate(v1State(), '2024-06-01T00:00:00.000Z');
    expect(migrated.program?.cycleStartedAt).toBe('2024-06-01T00:00:00.000Z');
  });

  it('starts with no dismissed flags and no active deload', () => {
    const migrated = migrate(v1State());
    expect(migrated.program?.dismissedFlags).toEqual([]);
    expect(migrated.program?.deloadWeekStartedAt).toBeUndefined();
  });

  it('is idempotent: an already-migrated state with program set is returned unchanged', () => {
    const already: AppState = {
      ...v1State(),
      schemaVersion: 2,
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: ['f1'] },
    };
    const migrated = migrate(already, '2099-01-01T00:00:00.000Z');
    expect(migrated).toBe(already);
    expect(migrated.program?.cycleStartedAt).toBe('2024-01-01T00:00:00.000Z');
  });
});
