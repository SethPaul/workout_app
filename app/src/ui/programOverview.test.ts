import { describe, it, expect } from 'vitest';
import type {
  AppState,
  Movement,
  PoolWorkout,
  ProgramState,
  Settings,
  WorkoutLog,
} from '../domain/types';
import {
  cycleSummary,
  deloadOverview,
  hasNoLogs,
  progressionRows,
  recentTrend,
} from './programOverview';

const NOW = new Date('2024-03-01T00:00:00.000Z');

const baseSettings: Settings = {
  availableEquipment: [],
  soundOn: true,
  vibrateOn: true,
  keepScreenOn: true,
  units: 'lb',
  cycleWeeks: 4,
};

function movement(id: string, overrides: Partial<Movement> = {}): Movement {
  return {
    id,
    name: id[0].toUpperCase() + id.slice(1),
    tags: [],
    equipment: ['barbell'],
    cadenceDays: 7,
    unit: 'reps',
    loadable: true,
    ...overrides,
  };
}

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function strengthSnapshot(movementId: string, reps: number): PoolWorkout {
  return {
    id: `w-${movementId}`,
    name: `${movementId} day`,
    intensity: 'M',
    // sets:1 matches strengthLog's single logged set below, so metSetCount
    // (prescribed sets vs sets actually logged) always passes — the
    // stall/hold/progress outcome then turns purely on reps/rpe, which is
    // what these fixtures are exercising.
    blocks: [{ format: 'strength', sets: 1, movements: [{ movementId, reps }] }],
    cadenceDays: 7,
    enabled: true,
    source: 'manual',
  };
}

function strengthLog(
  id: string,
  daysAgo: number,
  movementId: string,
  reps: number,
  sets: { weight: number; reps: number }[],
  overrides: Partial<WorkoutLog> = {},
): WorkoutLog {
  const finishedAt = isoDaysAgo(daysAgo);
  return {
    id,
    poolWorkoutId: `w-${movementId}`,
    workoutSnapshot: strengthSnapshot(movementId, reps),
    startedAt: finishedAt,
    finishedAt,
    results: [{ movementId, sets }],
    kind: 'pool',
    ...overrides,
  };
}

function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
    movements: [],
    pool: [],
    logs: [],
    settings: baseSettings,
    schemaVersion: 1,
    ...overrides,
  };
}

describe('cycleSummary', () => {
  it('reports week/cycleWeeks and base/build/peak kind for a fresh cycle', () => {
    const program: ProgramState = { cycleStartedAt: NOW.toISOString(), dismissedFlags: [] };
    const summary = cycleSummary(baseState({ program }), NOW);
    expect(summary.week).toBe(1);
    expect(summary.cycleWeeks).toBe(4);
    expect(summary.onDeload).toBe(false);
    expect(summary.kind).toBe(1);
    expect(summary.kindLabel).toBe('Base');
    expect(summary.deloadDaysRemaining).toBeNull();
  });

  it('reports the peak week (cycleWeeks - 1) as kind 3', () => {
    const program: ProgramState = { cycleStartedAt: isoDaysAgo(14), dismissedFlags: [] };
    const summary = cycleSummary(baseState({ program }), NOW);
    expect(summary.week).toBe(3);
    expect(summary.kind).toBe(3);
    expect(summary.kindLabel).toBe('Peak');
  });

  it('reports onDeload and days remaining once a deload has been accepted', () => {
    const program: ProgramState = {
      cycleStartedAt: isoDaysAgo(30),
      dismissedFlags: [],
      deloadWeekStartedAt: isoDaysAgo(2),
    };
    const summary = cycleSummary(baseState({ program }), NOW);
    expect(summary.onDeload).toBe(true);
    expect(summary.deloadDaysRemaining).toBe(5);
  });
});

describe('deloadOverview', () => {
  it('reports no suggestion and no flags with no logs', () => {
    const overview = deloadOverview(baseState(), NOW);
    expect(overview.suggested).toBe(false);
    expect(overview.activeFlags).toEqual([]);
    expect(overview.lastWorkout).toBeNull();
  });

  it('splits active vs dismissed flags and attributes movement-scoped flags to the last workout', () => {
    // missed-reps:squat needs the last 2 sessions to miss prescribed reps (4 instead of 5).
    const logs = [
      strengthLog('s1', 14, 'squat', 5, [{ weight: 200, reps: 4 }]),
      strengthLog('s2', 7, 'squat', 5, [{ weight: 200, reps: 4 }]),
    ];
    const program: ProgramState = { cycleStartedAt: isoDaysAgo(14), dismissedFlags: [] };
    const overview = deloadOverview(baseState({ logs, program }), NOW);

    expect(overview.activeFlags.map((f) => f.id)).toContain('missed-reps:squat');
    expect(overview.lastWorkout?.logId).toBe('s2');
    expect(overview.lastWorkout?.relatedFlagIds).toContain('missed-reps:squat');
  });

  it('moves dismissed flag ids into dismissedFlags', () => {
    const logs = [
      strengthLog('s1', 14, 'squat', 5, [{ weight: 200, reps: 4 }]),
      strengthLog('s2', 7, 'squat', 5, [{ weight: 200, reps: 4 }]),
    ];
    const program: ProgramState = {
      cycleStartedAt: isoDaysAgo(14),
      dismissedFlags: ['missed-reps:squat'],
    };
    const overview = deloadOverview(baseState({ logs, program }), NOW);

    expect(overview.activeFlags.map((f) => f.id)).not.toContain('missed-reps:squat');
    expect(overview.dismissedFlags.map((f) => f.id)).toContain('missed-reps:squat');
    // A dismissed flag should not be counted as related to the last workout either.
    expect(overview.lastWorkout?.relatedFlagIds).not.toContain('missed-reps:squat');
  });

  it('does not attribute flags for movements absent from the last workout', () => {
    const logs = [
      strengthLog('s1', 14, 'squat', 5, [{ weight: 200, reps: 4 }]),
      strengthLog('s2', 7, 'squat', 5, [{ weight: 200, reps: 4 }]),
      strengthLog('s3', 1, 'bench', 5, [{ weight: 100, reps: 5 }]),
    ];
    const program: ProgramState = { cycleStartedAt: isoDaysAgo(14), dismissedFlags: [] };
    const overview = deloadOverview(baseState({ logs, program }), NOW);

    expect(overview.lastWorkout?.logId).toBe('s3');
    expect(overview.lastWorkout?.relatedFlagIds).toEqual([]);
  });
});

describe('progressionRows', () => {
  it('is empty when no movement has a logged strength session', () => {
    const rows = progressionRows(baseState({ movements: [movement('squat')] }), NOW);
    expect(rows).toEqual([]);
  });

  it('excludes non-loadable movements even if logged in a strength block', () => {
    const movements = [movement('row', { loadable: false })];
    const logs = [strengthLog('s1', 1, 'row', 5, [{ weight: 0, reps: 5 }])];
    const rows = progressionRows(baseState({ movements, logs }), NOW);
    expect(rows).toEqual([]);
  });

  it('sorts stall first, then hold, then progress', () => {
    const movements = [movement('bench'), movement('squat'), movement('deadlift')];
    const logs = [
      // squat: single session, nothing to compare against -> progress
      strengthLog('sq1', 1, 'squat', 5, [{ weight: 200, reps: 5 }]),
      // bench: one miss so far (only 1 stall) -> hold
      strengthLog('b1', 14, 'bench', 5, [{ weight: 135, reps: 5 }]),
      strengthLog('b2', 7, 'bench', 5, [{ weight: 135, reps: 3 }]),
      // deadlift: two misses in a row -> stall
      strengthLog('d1', 21, 'deadlift', 5, [{ weight: 300, reps: 3 }]),
      strengthLog('d2', 14, 'deadlift', 5, [{ weight: 300, reps: 3 }]),
      strengthLog('d3', 7, 'deadlift', 5, [{ weight: 300, reps: 3 }]),
    ];
    const rows = progressionRows(baseState({ movements, logs }), NOW);

    expect(rows.map((r) => r.status)).toEqual(['stall', 'hold', 'progress']);
    expect(rows.map((r) => r.movementId)).toEqual(['deadlift', 'bench', 'squat']);
  });

  it('reports currentMax, nextLoad and lastSessionDate', () => {
    const movements = [movement('squat')];
    const logs = [strengthLog('s1', 3, 'squat', 5, [{ weight: 200, reps: 5 }])];
    const rows = progressionRows(baseState({ movements, logs }), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].currentMax).toBeCloseTo(200 * (1 + 5 / 30));
    expect(rows[0].nextLoad).not.toBeNull();
    expect(rows[0].lastSessionDate).toBe(isoDaysAgo(3));
  });
});

describe('recentTrend', () => {
  it('returns 4 buckets, most recent first, all empty when there are no logs', () => {
    const buckets = recentTrend(baseState(), NOW);
    expect(buckets).toHaveLength(4);
    expect(buckets.map((b) => b.weeksAgo)).toEqual([0, 1, 2, 3]);
    for (const b of buckets) {
      expect(b.sessionCount).toBe(0);
      expect(b.strengthSessionCount).toBe(0);
      expect(b.avgRpe).toBeNull();
    }
  });

  it('buckets sessions into the correct week and averages rpe', () => {
    const logs = [
      strengthLog('s1', 1, 'squat', 5, [{ weight: 200, reps: 5 }], { rpe: 8 }),
      strengthLog('s2', 2, 'squat', 5, [{ weight: 200, reps: 5 }], { rpe: 6 }),
      strengthLog('s3', 10, 'squat', 5, [{ weight: 200, reps: 5 }], { rpe: 9 }),
    ];
    const buckets = recentTrend(baseState({ logs }), NOW);

    expect(buckets[0].sessionCount).toBe(2); // this week: s1, s2
    expect(buckets[0].strengthSessionCount).toBe(2);
    expect(buckets[0].avgRpe).toBe(7);

    expect(buckets[1].sessionCount).toBe(1); // 1 week ago: s3
    expect(buckets[1].avgRpe).toBe(9);

    expect(buckets[2].sessionCount).toBe(0);
    expect(buckets[3].sessionCount).toBe(0);
  });
});

describe('hasNoLogs', () => {
  it('true with no logs, false otherwise', () => {
    expect(hasNoLogs(baseState())).toBe(true);
    expect(
      hasNoLogs(
        baseState({ logs: [strengthLog('s1', 1, 'squat', 5, [{ weight: 100, reps: 5 }])] }),
      ),
    ).toBe(false);
  });
});
