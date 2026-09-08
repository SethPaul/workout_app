import { describe, it, expect } from 'vitest';
import { selectWorkout } from './select';
import type { Movement, PoolWorkout, Settings, WorkoutLog } from './types';

/** Deterministic seeded RNG for reproducible tests (mulberry32). */
function seededRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function movement(id: string, overrides: Partial<Movement> = {}): Movement {
  return {
    id,
    name: id,
    tags: [],
    equipment: [],
    cadenceDays: 3,
    unit: 'reps',
    loadable: false,
    ...overrides,
  };
}

function workout(id: string, movementIds: string[], overrides: Partial<PoolWorkout> = {}): PoolWorkout {
  return {
    id,
    name: id,
    intensity: 'M',
    blocks: [{ format: 'strength', movements: movementIds.map((movementId) => ({ movementId })) }],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
    ...overrides,
  };
}

function log(
  poolWorkoutId: string,
  movementIds: string[],
  finishedAt: string,
  workoutOverrides: Partial<PoolWorkout> = {},
): WorkoutLog {
  const snapshot = workout(poolWorkoutId, movementIds, workoutOverrides);
  return {
    id: `log-${poolWorkoutId}-${finishedAt}`,
    poolWorkoutId,
    workoutSnapshot: snapshot,
    startedAt: finishedAt,
    finishedAt,
    results: [],
  };
}

function settingsWith(equipment: Settings['availableEquipment']): Settings {
  return { availableEquipment: equipment, soundOn: true, vibrateOn: true, keepScreenOn: true };
}

const NOW = '2024-02-01T00:00:00.000Z';

describe('selectWorkout gates', () => {
  it('returns no-enabled when nothing in the pool is enabled', () => {
    const pool = [workout('w1', ['squat'], { enabled: false })];
    const result = selectWorkout({
      pool,
      movements: [movement('squat')],
      logs: [],
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
    });
    expect(result.reason).toBe('no-enabled');
    expect(result.workout).toBeNull();
  });

  it('returns excluded when every enabled workout is in the exclude list', () => {
    const pool = [workout('w1', ['squat'])];
    const result = selectWorkout({
      pool,
      movements: [movement('squat')],
      logs: [],
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
      exclude: ['w1'],
    });
    expect(result.reason).toBe('excluded');
    expect(result.workout).toBeNull();
  });

  it('returns equipment when required equipment is unavailable', () => {
    const pool = [workout('w1', ['deadlift'])];
    const result = selectWorkout({
      pool,
      movements: [movement('deadlift', { equipment: ['barbell', 'rack'] })],
      logs: [],
      settings: settingsWith([]), // nothing available
      now: NOW,
    });
    expect(result.reason).toBe('equipment');
    expect(result.workout).toBeNull();
  });

  it('treats ["none"] equipment as always available', () => {
    const pool = [workout('w1', ['burpee'])];
    const result = selectWorkout({
      pool,
      movements: [movement('burpee', { equipment: ['none'] })],
      logs: [],
      settings: settingsWith([]),
      now: NOW,
    });
    expect(result.reason).toBe('ok');
  });

  it('returns cadence when the workout itself is not yet due', () => {
    const pool = [workout('w1', ['squat'], { cadenceDays: 14 })];
    const logs = [log('w1', ['squat'], '2024-01-30T00:00:00.000Z')]; // 2 days ago
    const result = selectWorkout({
      pool,
      movements: [movement('squat')],
      logs,
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
    });
    expect(result.reason).toBe('cadence');
    expect(result.workout).toBeNull();
  });

  it('returns cadence when a movement inside the workout is not yet due', () => {
    const pool = [workout('w1', ['deadlift'], { cadenceDays: 1 })];
    const logs = [log('w2', ['deadlift'], '2024-01-31T00:00:00.000Z')]; // 1 day ago, cadence 7
    const result = selectWorkout({
      pool,
      movements: [movement('deadlift', { cadenceDays: 7 })],
      logs,
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
    });
    expect(result.reason).toBe('cadence');
  });

  it('a never-performed workout and never-performed movements pass cadence gates', () => {
    const pool = [workout('w1', ['squat'])];
    const result = selectWorkout({
      pool,
      movements: [movement('squat')],
      logs: [],
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
    });
    expect(result.reason).toBe('ok');
    expect(result.workout?.id).toBe('w1');
  });

  it('gates are checked in order: no-enabled before excluded/equipment/cadence', () => {
    const pool = [
      workout('w1', ['squat'], { enabled: false }),
      workout('w2', ['squat'], { enabled: false }),
    ];
    const result = selectWorkout({
      pool,
      movements: [movement('squat')],
      logs: [],
      settings: settingsWith([]),
      now: NOW,
      exclude: ['w2'],
    });
    expect(result.reason).toBe('no-enabled');
  });
});

describe('selectWorkout scoring', () => {
  it('prefers a never-performed workout over any performed one (never bonus dominates)', () => {
    const pool = [
      workout('recent', ['squat']),
      workout('never', ['squat']),
    ];
    const logs = [log('recent', ['squat'], '2024-01-31T00:00:00.000Z')]; // yesterday, but cadenceDays default 14 -> would gate out
    // Give 'recent' a short cadence so it survives gating despite being recent.
    pool[0].cadenceDays = 1;
    const result = selectWorkout({
      pool,
      movements: [movement('squat', { cadenceDays: 1 })],
      logs,
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
      rng: seededRng(42),
    });
    expect(result.reason).toBe('ok');
    // The never-performed workout should score highest and sort first,
    // even though both survivors end up in the (small) candidate slice.
    expect(result.candidates[0].id).toBe('never');
  });

  it('scores higher daysSince workout higher, capped at 60', () => {
    const pool = [workout('old', ['squat'], { cadenceDays: 1 }), workout('new', ['squat'], { cadenceDays: 1 })];
    const logs = [
      log('old', ['squat'], '2023-01-01T00:00:00.000Z'), // very long ago, capped
      log('new', ['squat'], '2024-01-30T00:00:00.000Z'), // 2 days ago
    ];
    const result = selectWorkout({
      pool,
      movements: [movement('squat', { cadenceDays: 1 })],
      logs,
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
      rng: () => 0, // no randomness contribution
    });
    expect(result.reason).toBe('ok');
    // With rng fixed at 0, 'old' should always score higher and be the sole top candidate
    // when slice size is small; verify it's among candidates ranked first.
    expect(result.candidates[0].id).toBe('old');
  });

  it('uses a seeded rng deterministically to pick among the top slice', () => {
    const pool = [
      workout('a', ['squat'], { cadenceDays: 1 }),
      workout('b', ['squat'], { cadenceDays: 1 }),
      workout('c', ['squat'], { cadenceDays: 1 }),
      workout('d', ['squat'], { cadenceDays: 1 }),
    ];
    const settings = settingsWith(['barbell', 'rack']);
    const movements = [movement('squat', { cadenceDays: 1 })];

    const result1 = selectWorkout({ pool, movements, logs: [], settings, now: NOW, rng: seededRng(7) });
    const result2 = selectWorkout({ pool, movements, logs: [], settings, now: NOW, rng: seededRng(7) });
    expect(result1.workout?.id).toBe(result2.workout?.id);
  });
});

describe('selectWorkout bump/exclusion', () => {
  it('excludes the bumped id and can still pick another workout', () => {
    const pool = [workout('w1', ['squat']), workout('w2', ['row'])];
    const result = selectWorkout({
      pool,
      movements: [movement('squat'), movement('row')],
      logs: [],
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
      exclude: ['w1'],
      rng: () => 0,
    });
    expect(result.reason).toBe('ok');
    expect(result.workout?.id).toBe('w2');
  });
});

describe('selectWorkout candidates', () => {
  it('takes top max(3, ceil(25% of survivors)) as the candidate slice', () => {
    const pool = Array.from({ length: 8 }, (_, i) => workout(`w${i}`, ['squat'], { cadenceDays: 1 }));
    const result = selectWorkout({
      pool,
      movements: [movement('squat', { cadenceDays: 1 })],
      logs: [],
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
      rng: () => 0.5,
    });
    // 8 survivors -> ceil(0.25*8) = 2 -> max(3,2) = 3
    expect(result.candidates.length).toBe(3);
  });
});

describe('selectWorkout pattern gate (C1)', () => {
  const backSquat = movement('back_squat', { tags: ['squat', 'compound'], cadenceDays: 0 });
  const frontSquat = movement('front_squat', { tags: ['squat', 'compound'], cadenceDays: 0 });

  function strengthWorkout(id: string, movementId: string): PoolWorkout {
    return {
      id,
      name: id,
      intensity: 'M',
      blocks: [{ format: 'strength', movements: [{ movementId }] }],
      cadenceDays: 0,
      enabled: true,
      source: 'manual',
    };
  }

  function amrapWorkout(id: string, movementId: string): PoolWorkout {
    return {
      id,
      name: id,
      intensity: 'M',
      blocks: [{ format: 'amrap', title: 'Conditioning', movements: [{ movementId }], durationSec: 600 }],
      cadenceDays: 0,
      enabled: true,
      source: 'manual',
    };
  }

  function heavyLog(movementId: string, finishedAt: string): WorkoutLog {
    const snapshot = strengthWorkout(`logged-${movementId}`, movementId);
    return {
      id: `log-${movementId}-${finishedAt}`,
      poolWorkoutId: snapshot.id,
      workoutSnapshot: snapshot,
      startedAt: finishedAt,
      finishedAt,
      results: [],
    };
  }

  it('blocks a front_squat strength workout the day after a back_squat strength workout (same pattern)', () => {
    const pool = [strengthWorkout('fs', 'front_squat')];
    const logs = [heavyLog('back_squat', '2024-01-31T00:00:00.000Z')]; // yesterday
    const result = selectWorkout({
      pool,
      movements: [backSquat, frontSquat],
      logs,
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
    });
    expect(result.reason).toBe('pattern');
    expect(result.workout).toBeNull();
  });

  it('does not block when front_squat only appears in an AMRAP block (not heavy loading)', () => {
    const pool = [amrapWorkout('fs-amrap', 'front_squat')];
    const logs = [heavyLog('back_squat', '2024-01-31T00:00:00.000Z')];
    const result = selectWorkout({
      pool,
      movements: [backSquat, frontSquat],
      logs,
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
    });
    expect(result.reason).toBe('ok');
  });

  it('allows the front_squat strength workout two days after the back_squat strength workout', () => {
    const pool = [strengthWorkout('fs', 'front_squat')];
    const logs = [heavyLog('back_squat', '2024-01-30T00:00:00.000Z')]; // 2 days ago
    const result = selectWorkout({
      pool,
      movements: [backSquat, frontSquat],
      logs,
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
    });
    expect(result.reason).toBe('ok');
  });

  it('never blocks on the core pattern (0-day cadence)', () => {
    const plank = movement('plank', { tags: ['core'], cadenceDays: 0 });
    const pool = [strengthWorkout('plank-day', 'plank')];
    const logs = [heavyLog('plank', NOW)]; // performed "today" itself
    const result = selectWorkout({
      pool,
      movements: [plank],
      logs,
      settings: settingsWith([]),
      now: NOW,
    });
    expect(result.reason).toBe('ok');
  });

  it('ignoreCadence bypasses the pattern gate too', () => {
    const pool = [strengthWorkout('fs', 'front_squat')];
    const logs = [heavyLog('back_squat', '2024-01-31T00:00:00.000Z')]; // yesterday, would otherwise block
    const result = selectWorkout({
      pool,
      movements: [backSquat, frontSquat],
      logs,
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
      ignoreCadence: true,
    });
    expect(result.reason).toBe('ok');
  });
});

describe('selectWorkout weekly mandatory-day gate (C2)', () => {
  function dayWorkout(id: string, dayTag?: string): PoolWorkout {
    return {
      id,
      name: id,
      intensity: 'M',
      blocks: [{ format: 'strength', movements: [{ movementId: 'row' }] }],
      cadenceDays: 0,
      enabled: true,
      source: 'manual',
      ...(dayTag ? { tags: [dayTag] } : {}),
    };
  }

  it('exposes the needed day type when nothing satisfies it in the last 7 days', () => {
    const pool = [dayWorkout('generic')];
    const result = selectWorkout({
      pool,
      movements: [movement('row', { cadenceDays: 0 })],
      logs: [],
      settings: settingsWith([]),
      now: NOW,
    });
    expect(result.needed).toBe('deadlift-press');
  });

  it('restricts candidates to the needed day type when a gated survivor has it', () => {
    const pool = [dayWorkout('generic'), dayWorkout('the-day', 'day:deadlift-press')];
    const result = selectWorkout({
      pool,
      movements: [movement('row', { cadenceDays: 0 })],
      logs: [],
      settings: settingsWith([]),
      now: NOW,
      rng: () => 0,
    });
    expect(result.reason).toBe('ok');
    expect(result.workout?.id).toBe('the-day');
  });

  it('falls through to the normal pool when no survivor has the needed day type', () => {
    const pool = [dayWorkout('generic')];
    const result = selectWorkout({
      pool,
      movements: [movement('row', { cadenceDays: 0 })],
      logs: [],
      settings: settingsWith([]),
      now: NOW,
      rng: () => 0,
    });
    expect(result.reason).toBe('ok');
    expect(result.workout?.id).toBe('generic');
  });

  it('clears the need when a matching log happened 3 days ago', () => {
    const pool = [dayWorkout('generic')];
    const logs = [log('the-day', ['row'], '2024-01-29T00:00:00.000Z', { tags: ['day:deadlift-press'] })]; // 3 days before NOW
    const result = selectWorkout({
      pool,
      movements: [movement('row', { cadenceDays: 0 })],
      logs,
      settings: settingsWith([]),
      now: NOW,
    });
    expect(result.needed).toBeNull();
  });
});

describe('selectWorkout focus multiplier (SPEC 9.7)', () => {
  function strengthLed(id: string): PoolWorkout {
    return {
      id,
      name: id,
      intensity: 'M',
      blocks: [{ format: 'strength', movements: [{ movementId: 'squat' }] }],
      cadenceDays: 0,
      enabled: true,
      source: 'manual',
    };
  }

  function conditioningOnly(id: string): PoolWorkout {
    return {
      id,
      name: id,
      intensity: 'M',
      blocks: [{ format: 'amrap', movements: [{ movementId: 'row' }], durationSec: 600 }],
      cadenceDays: 0,
      enabled: true,
      source: 'manual',
    };
  }

  const movements = [movement('squat', { cadenceDays: 0 }), movement('row', { cadenceDays: 0 })];

  it("focus 'strength' boosts a strength-led workout above an equally-scored conditioning one", () => {
    const pool = [conditioningOnly('cond'), strengthLed('str')];
    const settings: Settings = { ...settingsWith([]), focus: 'strength' };
    const result = selectWorkout({ pool, movements, logs: [], settings, now: NOW, rng: () => 0 });
    expect(result.candidates[0].id).toBe('str');
  });

  it("focus 'conditioning' boosts a conditioning-only workout above an equally-scored strength one", () => {
    const pool = [conditioningOnly('cond'), strengthLed('str')];
    const settings: Settings = { ...settingsWith([]), focus: 'conditioning' };
    const result = selectWorkout({ pool, movements, logs: [], settings, now: NOW, rng: () => 0 });
    expect(result.candidates[0].id).toBe('cond');
  });

  it("focus 'balanced' (or unset) leaves the two tied, so daysSince ordering decides", () => {
    const pool = [conditioningOnly('cond'), strengthLed('str')];
    const result = selectWorkout({ pool, movements, logs: [], settings: settingsWith([]), now: NOW, rng: () => 0 });
    // Neither is ever-performed, so both score identically; the candidate
    // slice should contain both rather than one dominating.
    expect(result.candidates.map((c) => c.id).sort()).toEqual(['cond', 'str']);
  });
});

describe('selectWorkout masters cadence extension (SPEC 9.7/R44)', () => {
  const backSquat = movement('back_squat', { tags: ['squat', 'compound'], cadenceDays: 0 });
  const frontSquat = movement('front_squat', { tags: ['squat', 'compound'], cadenceDays: 0 });

  function strengthWorkout(id: string, movementId: string): PoolWorkout {
    return {
      id,
      name: id,
      intensity: 'M',
      blocks: [{ format: 'strength', movements: [{ movementId }] }],
      cadenceDays: 0,
      enabled: true,
      source: 'manual',
    };
  }

  function heavyLog(movementId: string, finishedAt: string): WorkoutLog {
    const snapshot = strengthWorkout(`logged-${movementId}`, movementId);
    return {
      id: `log-${movementId}-${finishedAt}`,
      poolWorkoutId: snapshot.id,
      workoutSnapshot: snapshot,
      startedAt: finishedAt,
      finishedAt,
      results: [],
    };
  }

  it('2 days is enough gap without masters (default squat cadence is 2)', () => {
    const pool = [strengthWorkout('fs', 'front_squat')];
    const logs = [heavyLog('back_squat', '2024-01-30T00:00:00.000Z')]; // 2 days ago
    const result = selectWorkout({
      pool,
      movements: [backSquat, frontSquat],
      logs,
      settings: settingsWith(['barbell', 'rack']),
      now: NOW,
    });
    expect(result.reason).toBe('ok');
  });

  it('masters extends the same gap to 3 days, blocking a 2-day gap', () => {
    const pool = [strengthWorkout('fs', 'front_squat')];
    const logs = [heavyLog('back_squat', '2024-01-30T00:00:00.000Z')]; // 2 days ago
    const settings: Settings = { ...settingsWith(['barbell', 'rack']), masters: true };
    const result = selectWorkout({ pool, movements: [backSquat, frontSquat], logs, settings, now: NOW });
    expect(result.reason).toBe('pattern');
  });

  it('masters still allows a 3-day gap', () => {
    const pool = [strengthWorkout('fs', 'front_squat')];
    const logs = [heavyLog('back_squat', '2024-01-29T00:00:00.000Z')]; // 3 days ago
    const settings: Settings = { ...settingsWith(['barbell', 'rack']), masters: true };
    const result = selectWorkout({ pool, movements: [backSquat, frontSquat], logs, settings, now: NOW });
    expect(result.reason).toBe('ok');
  });
});
