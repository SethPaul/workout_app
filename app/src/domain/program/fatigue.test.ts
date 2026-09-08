import { describe, it, expect } from 'vitest';
import { deloadSuggested, fatigueFlags, type FatigueFlag } from './fatigue';
import type { PoolWorkout, ProgramState, Settings, WorkoutLog } from '../types';

const NOW = '2024-03-01T00:00:00.000Z';

function isoDaysAgo(days: number): string {
  // Millisecond arithmetic (not setUTCDate, which truncates fractional days)
  // so a sub-day offset like "2 days and 2 hours ago" works correctly.
  const ms = new Date(NOW).getTime() - days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

function strengthSnapshot(movementId: string, reps: number): PoolWorkout {
  return {
    id: `w-${movementId}`,
    name: `w-${movementId}`,
    intensity: 'M',
    blocks: [{ format: 'strength', sets: 3, movements: [{ movementId, reps }] }],
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
  rpe?: number,
  overrides: Partial<WorkoutLog> = {},
): WorkoutLog {
  const finishedAt = isoDaysAgo(daysAgo);
  return {
    id,
    poolWorkoutId: `w-${movementId}`,
    workoutSnapshot: strengthSnapshot(movementId, reps),
    startedAt: finishedAt,
    finishedAt,
    results: [{ movementId, sets, rpe }],
    kind: 'pool',
    ...overrides,
  };
}

describe('fatigueFlags: e1rm-drop', () => {
  it('flags a movement whose e1rm is >=5% below its 8-week peak for the last 2 sessions', () => {
    const logs = [
      strengthLog('s1', 40, 'squat', 5, [{ weight: 220, reps: 5 }]), // peak, e1rm ~256.7
      strengthLog('s2', 20, 'squat', 5, [{ weight: 190, reps: 5 }]), // ~221.7, down
      strengthLog('s3', 5, 'squat', 5, [{ weight: 185, reps: 5 }]), // ~215.8, down
    ];
    const flags = fatigueFlags(logs, NOW);
    expect(flags.map((f) => f.id)).toContain('e1rm-drop:squat');
  });

  it('does not flag when the most recent session recovers', () => {
    const logs = [
      strengthLog('s1', 40, 'squat', 5, [{ weight: 220, reps: 5 }]),
      strengthLog('s2', 20, 'squat', 5, [{ weight: 190, reps: 5 }]),
      strengthLog('s3', 5, 'squat', 5, [{ weight: 220, reps: 5 }]), // back up
    ];
    const flags = fatigueFlags(logs, NOW);
    expect(flags.map((f) => f.id)).not.toContain('e1rm-drop:squat');
  });
});

describe('fatigueFlags: rpe-creep', () => {
  it('flags the same load logged at rising rpe over the last 3 sessions', () => {
    const logs = [
      strengthLog('s1', 21, 'bench', 5, [{ weight: 135, reps: 5 }], 7),
      strengthLog('s2', 14, 'bench', 5, [{ weight: 135, reps: 5 }], 8),
      strengthLog('s3', 7, 'bench', 5, [{ weight: 135, reps: 5 }], 9),
    ];
    const flags = fatigueFlags(logs, NOW);
    expect(flags.map((f) => f.id)).toContain('rpe-creep:bench');
  });

  it('does not flag when the load changed between sessions', () => {
    const logs = [
      strengthLog('s1', 21, 'bench', 5, [{ weight: 135, reps: 5 }], 7),
      strengthLog('s2', 14, 'bench', 5, [{ weight: 140, reps: 5 }], 8),
      strengthLog('s3', 7, 'bench', 5, [{ weight: 145, reps: 5 }], 9),
    ];
    const flags = fatigueFlags(logs, NOW);
    expect(flags.map((f) => f.id)).not.toContain('rpe-creep:bench');
  });

  it('does not flag a rise smaller than 1.5', () => {
    const logs = [
      strengthLog('s1', 21, 'bench', 5, [{ weight: 135, reps: 5 }], 7),
      strengthLog('s2', 14, 'bench', 5, [{ weight: 135, reps: 5 }], 7.5),
      strengthLog('s3', 7, 'bench', 5, [{ weight: 135, reps: 5 }], 8),
    ];
    const flags = fatigueFlags(logs, NOW);
    expect(flags.map((f) => f.id)).not.toContain('rpe-creep:bench');
  });
});

describe('fatigueFlags: missed-reps', () => {
  it('flags prescribed reps missed in the last 2 sessions', () => {
    const logs = [
      strengthLog('s1', 14, 'deadlift', 5, [{ weight: 300, reps: 3 }]), // missed
      strengthLog('s2', 7, 'deadlift', 5, [{ weight: 300, reps: 4 }]), // missed
    ];
    const flags = fatigueFlags(logs, NOW);
    expect(flags.map((f) => f.id)).toContain('missed-reps:deadlift');
  });

  it('does not flag when the most recent session hit the prescribed reps', () => {
    const logs = [
      strengthLog('s1', 14, 'deadlift', 5, [{ weight: 300, reps: 3 }]),
      strengthLog('s2', 7, 'deadlift', 5, [{ weight: 300, reps: 5 }]),
    ];
    const flags = fatigueFlags(logs, NOW);
    expect(flags.map((f) => f.id)).not.toContain('missed-reps:deadlift');
  });
});

describe('fatigueFlags: load-spike', () => {
  it('flags when the last 7 days training load is >=1.3x the 28-day weekly mean', () => {
    const logs = [
      strengthLog('base1', 24, 'squat', 5, [{ weight: 200, reps: 5 }], 7, {
        startedAt: isoDaysAgo(24),
        finishedAt: isoDaysAgo(24 - 1 / 24), // 1 hour session
        rpe: 7,
      }),
      strengthLog('base2', 17, 'squat', 5, [{ weight: 200, reps: 5 }], 7, {
        startedAt: isoDaysAgo(17),
        finishedAt: isoDaysAgo(17 - 1 / 24),
        rpe: 7,
      }),
      strengthLog('base3', 10, 'squat', 5, [{ weight: 200, reps: 5 }], 7, {
        startedAt: isoDaysAgo(10),
        finishedAt: isoDaysAgo(10 - 1 / 24),
        rpe: 7,
      }),
      strengthLog('spike', 2, 'squat', 5, [{ weight: 200, reps: 5 }], 9, {
        startedAt: isoDaysAgo(2),
        finishedAt: isoDaysAgo(2 - 2 / 24), // 2 hour session
        rpe: 9,
      }),
    ];
    const flags = fatigueFlags(logs, NOW);
    expect(flags.map((f) => f.id)).toContain('load-spike');
  });

  it('does not flag a normal, evenly spread week', () => {
    const logs = [1, 2, 3, 4].map((w) =>
      strengthLog(`w${w}`, w * 7, 'squat', 5, [{ weight: 200, reps: 5 }], 7, {
        startedAt: isoDaysAgo(w * 7),
        finishedAt: isoDaysAgo(w * 7 - 1 / 24),
        rpe: 7,
      }),
    );
    const flags = fatigueFlags(logs, NOW);
    expect(flags.map((f) => f.id)).not.toContain('load-spike');
  });
});

describe('deloadSuggested', () => {
  const settingsFor = (overrides: Partial<Settings> = {}): Settings => ({
    availableEquipment: [],
    soundOn: true,
    vibrateOn: true,
    keepScreenOn: true,
    ...overrides,
  });

  function programFor(overrides: Partial<ProgramState> = {}): ProgramState {
    return { cycleStartedAt: NOW, dismissedFlags: [], ...overrides };
  }

  const flag = (id: string): FatigueFlag => ({ id, text: id });

  it("policy 'off': never suggests, regardless of flags", () => {
    const settings = settingsFor({ deloadPolicy: 'off' });
    const p = programFor({ cycleStartedAt: isoDaysAgo(60) });
    expect(deloadSuggested([flag('a'), flag('b')], p, settings, NOW)).toBe(false);
  });

  it("policy 'calendar': true on week cycleWeeks+1, false otherwise", () => {
    const settings = settingsFor({ deloadPolicy: 'calendar', cycleWeeks: 4 });
    const week5Program = programFor({ cycleStartedAt: isoDaysAgo(28) }); // 4 weeks elapsed -> week 5
    expect(deloadSuggested([], week5Program, settings, NOW)).toBe(true);
    const week2Program = programFor({ cycleStartedAt: isoDaysAgo(7) });
    expect(deloadSuggested([], week2Program, settings, NOW)).toBe(false);
  });

  it("policy 'fatigue': true with 2+ non-dismissed flags", () => {
    const settings = settingsFor({ deloadPolicy: 'fatigue' });
    const p = programFor();
    expect(deloadSuggested([flag('a'), flag('b')], p, settings, NOW)).toBe(true);
  });

  it("policy 'fatigue': dismissed flags don't count toward the threshold", () => {
    const settings = settingsFor({ deloadPolicy: 'fatigue' });
    const p = programFor({ dismissedFlags: ['a', 'b'] });
    expect(deloadSuggested([flag('a'), flag('b')], p, settings, NOW)).toBe(false);
  });

  it("policy 'fatigue': 1 flag plus cycle week >= cycleWeeks suggests a deload", () => {
    const settings = settingsFor({ deloadPolicy: 'fatigue', cycleWeeks: 4 });
    const p = programFor({ cycleStartedAt: isoDaysAgo(21) }); // week 4
    expect(deloadSuggested([flag('a')], p, settings, NOW)).toBe(true);
  });

  it("policy 'fatigue': 1 flag before cycleWeeks does not yet suggest", () => {
    const settings = settingsFor({ deloadPolicy: 'fatigue', cycleWeeks: 4 });
    const p = programFor({ cycleStartedAt: isoDaysAgo(3) }); // week 1
    expect(deloadSuggested([flag('a')], p, settings, NOW)).toBe(false);
  });

  it("policy 'fatigue': week >= 6 ceiling forces a suggestion even with no flags", () => {
    const settings = settingsFor({ deloadPolicy: 'fatigue', cycleWeeks: 4 });
    const p = programFor({ cycleStartedAt: isoDaysAgo(35) }); // week 6
    expect(deloadSuggested([], p, settings, NOW)).toBe(true);
  });
});
