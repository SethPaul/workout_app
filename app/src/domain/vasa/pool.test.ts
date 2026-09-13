import { describe, it, expect } from 'vitest';
import {
  buildEnteredWorkout,
  defaultWorkoutName,
  isEnteredWorkout,
  searchPool,
  workoutRegion,
  workoutStyle,
  type BuildEnteredWorkoutInput,
  type EnteredBlock,
} from './pool';
import type { Movement, PoolWorkout, WorkoutLog } from '../types';

const NOW = new Date('2024-06-15T12:00:00.000Z');

function mainBlock(overrides: Partial<EnteredBlock> = {}): EnteredBlock {
  return {
    role: 'main',
    title: 'Main',
    movements: [{ movementId: 'back_squat', sets: 5, reps: 5 }],
    ...overrides,
  };
}

function input(overrides: Partial<BuildEnteredWorkoutInput> = {}): BuildEnteredWorkoutInput {
  return {
    date: '2024-09-15',
    region: 'lower',
    blocks: [mainBlock()],
    id: 'entered-1',
    ...overrides,
  };
}

describe('defaultWorkoutName', () => {
  it('formats region · date without a style', () => {
    expect(defaultWorkoutName('lower', undefined, '2024-09-15')).toBe('Lower · Sep 15');
  });

  it('formats region · style · date with a style', () => {
    expect(defaultWorkoutName('lower', 'build', '2024-09-15')).toBe('Lower · Build · Sep 15');
  });

  it('parses a bare date at local noon (no off-by-one across timezones)', () => {
    expect(defaultWorkoutName('upper', undefined, '2024-01-01')).toBe('Upper · Jan 1');
  });
});

describe('buildEnteredWorkout', () => {
  it('drops blocks with no movements', () => {
    const w = buildEnteredWorkout(
      input({ blocks: [mainBlock(), { role: 'accessory', title: 'Accessory 1', movements: [] }] }),
    );
    expect(w.blocks).toHaveLength(1);
  });

  it('main/accessory blocks default to 3 sets when no movement specifies one', () => {
    const w = buildEnteredWorkout(
      input({ blocks: [{ role: 'main', title: 'Main', movements: [{ movementId: 'squat' }] }] }),
    );
    expect(w.blocks[0].sets).toBe(3);
  });

  it('main/accessory blocks use the largest sets among their movements', () => {
    const w = buildEnteredWorkout(
      input({
        blocks: [
          {
            role: 'accessory',
            title: 'Accessory 1',
            movements: [
              { movementId: 'a', sets: 2 },
              { movementId: 'b', sets: 4 },
            ],
          },
        ],
      }),
    );
    expect(w.blocks[0].sets).toBe(4);
  });

  it('carries reps and seconds onto each movement', () => {
    const w = buildEnteredWorkout(
      input({
        blocks: [
          {
            role: 'main',
            title: 'Main',
            movements: [{ movementId: 'squat', sets: 5, reps: 5 }],
          },
        ],
      }),
    );
    expect(w.blocks[0].movements[0]).toEqual({ movementId: 'squat', reps: 5, seconds: undefined });
  });

  it('finisher blocks become a 120s amrap with no sets', () => {
    const w = buildEnteredWorkout(
      input({
        blocks: [
          {
            role: 'finisher',
            title: 'Finisher (2 min)',
            movements: [{ movementId: 'plank', seconds: 45 }],
          },
        ],
      }),
    );
    const block = w.blocks[0];
    expect(block.format).toBe('amrap');
    expect(block.durationSec).toBe(120);
    expect(block.sets).toBeUndefined();
    expect(block.movements[0]).toEqual({ movementId: 'plank', reps: undefined, seconds: 45 });
  });

  it('tags the workout as entered, with region and (when set) style', () => {
    const withStyle = buildEnteredWorkout(input({ style: 'build' }));
    expect(withStyle.tags).toEqual(['vasa', 'region:lower', 'style:build']);
    const withoutStyle = buildEnteredWorkout(input());
    expect(withoutStyle.tags).toEqual(['vasa', 'region:lower']);
  });

  it('sets enabled: true, cadenceDays: 14, source: manual, intensity: M', () => {
    const w = buildEnteredWorkout(input());
    expect(w.enabled).toBe(true);
    expect(w.cadenceDays).toBe(14);
    expect(w.source).toBe('manual');
    expect(w.intensity).toBe('M');
  });

  it('defaults the name via defaultWorkoutName when none is given', () => {
    const w = buildEnteredWorkout(input({ name: undefined, style: 'pump' }));
    expect(w.name).toBe('Lower · Pump · Sep 15');
  });

  it('uses an explicit name when given', () => {
    const w = buildEnteredWorkout(input({ name: 'Tuesday LFT' }));
    expect(w.name).toBe('Tuesday LFT');
  });

  it('generates an "entered-<id>" id when none is given', () => {
    const w1 = buildEnteredWorkout(input({ id: undefined }));
    const w2 = buildEnteredWorkout(input({ id: undefined }));
    expect(w1.id).toMatch(/^entered-/);
    expect(w1.id).not.toBe(w2.id);
  });

  it('carries notes onto the workout', () => {
    const w = buildEnteredWorkout(input({ notes: 'felt strong' }));
    expect(w.notes).toBe('felt strong');
  });
});

describe('workoutRegion / workoutStyle / isEnteredWorkout', () => {
  it('reads region and style from tags', () => {
    const w = buildEnteredWorkout(input({ style: 'power' }));
    expect(workoutRegion(w)).toBe('lower');
    expect(workoutStyle(w)).toBe('power');
  });

  it('workoutStyle is null when no style tag is present', () => {
    const w = buildEnteredWorkout(input());
    expect(workoutStyle(w)).toBeNull();
  });

  it('workoutRegion/workoutStyle are null for a workout with no tags', () => {
    const plain: PoolWorkout = {
      id: 'w1',
      name: 'Plain',
      intensity: 'M',
      blocks: [],
      cadenceDays: 14,
      enabled: true,
      source: 'manual',
    };
    expect(workoutRegion(plain)).toBeNull();
    expect(workoutStyle(plain)).toBeNull();
    expect(isEnteredWorkout(plain)).toBe(false);
  });

  it('isEnteredWorkout is true only for workouts tagged "vasa"', () => {
    const entered = buildEnteredWorkout(input());
    expect(isEnteredWorkout(entered)).toBe(true);
  });
});

// --- searchPool -------------------------------------------------------

function plainWorkout(overrides: Partial<PoolWorkout> = {}): PoolWorkout {
  return {
    id: 'plain',
    name: 'Plain Squat Day',
    intensity: 'H',
    blocks: [{ format: 'strength', movements: [{ movementId: 'back_squat' }], sets: 5 }],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
    ...overrides,
  };
}

function movement(id: string, name: string): Movement {
  return { id, name, tags: [], equipment: [], cadenceDays: 3, unit: 'reps', loadable: true };
}

function logForWorkout(workoutId: string, finishedAt: string): WorkoutLog {
  return {
    id: `log-${workoutId}-${finishedAt}`,
    poolWorkoutId: workoutId,
    workoutSnapshot: plainWorkout({ id: workoutId }),
    startedAt: finishedAt,
    finishedAt,
    results: [],
    kind: 'pool',
  };
}

describe('searchPool', () => {
  const movements = [movement('back_squat', 'Back Squat'), movement('plank', 'Plank')];

  it('matches on workout name', () => {
    const w = plainWorkout({ name: 'Tuesday LFT' });
    const results = searchPool([w], movements, 'tuesday', { region: 'full', logs: [], now: NOW });
    expect(results.map((r) => r.id)).toEqual(['plain']);
  });

  it('matches on a tag', () => {
    const w = plainWorkout({ tags: ['deadlift-day'] });
    const results = searchPool([w], movements, 'deadlift', { region: 'full', logs: [], now: NOW });
    expect(results.map((r) => r.id)).toEqual(['plain']);
  });

  it('matches on a movement name', () => {
    const w = plainWorkout();
    const results = searchPool([w], movements, 'squat', { region: 'full', logs: [], now: NOW });
    expect(results.map((r) => r.id)).toEqual(['plain']);
  });

  it('excludes a workout with no match at any tier when the query is non-empty', () => {
    const w = plainWorkout();
    const results = searchPool([w], movements, 'xyz', { region: 'full', logs: [], now: NOW });
    expect(results).toEqual([]);
  });

  it('boosts a workout whose region matches opts.region by 8 (only when region !== full)', () => {
    const lower = buildEnteredWorkout(input({ id: 'lower-w', region: 'lower' }));
    const upper = buildEnteredWorkout(input({ id: 'upper-w', region: 'upper' }));
    const results = searchPool([upper, lower], movements, '', {
      region: 'lower',
      logs: [],
      now: NOW,
    });
    expect(results.map((r) => r.id)).toEqual(['lower-w', 'upper-w']);
  });

  it('boosts an entered workout by 4 over an equally-matching plain one', () => {
    const entered = buildEnteredWorkout(input({ id: 'entered-w', name: 'Squat Session' }));
    const plain = plainWorkout({ id: 'plain-w', name: 'Squat Session' });
    const results = searchPool([plain, entered], movements, '', {
      region: 'full',
      logs: [],
      now: NOW,
    });
    expect(results.map((r) => r.id)).toEqual(['entered-w', 'plain-w']);
  });

  it('boosts a workout last performed within 30 days by 3', () => {
    const recent = plainWorkout({ id: 'recent' });
    const stale = plainWorkout({ id: 'stale', name: 'Zzz Stale' });
    const logs = [logForWorkout('recent', '2024-06-10T00:00:00.000Z')];
    const results = searchPool([stale, recent], movements, '', { region: 'full', logs, now: NOW });
    expect(results.map((r) => r.id)).toEqual(['recent', 'stale']);
  });

  it('a last-performed date over 30 days ago earns no recency boost', () => {
    const old = plainWorkout({ id: 'old' });
    const other = plainWorkout({ id: 'other', name: 'Aaa Other' });
    const logs = [logForWorkout('old', '2024-01-01T00:00:00.000Z')];
    const results = searchPool([old, other], movements, '', { region: 'full', logs, now: NOW });
    // No boosts apply to either: ties broken by name.
    expect(results.map((r) => r.id)).toEqual(['other', 'old']);
  });

  it('finds last-performed via workoutSnapshot.id when poolWorkoutId is absent', () => {
    const w = plainWorkout({ id: 'snap-w' });
    const other = plainWorkout({ id: 'other', name: 'Zzz Other' });
    const log: WorkoutLog = {
      id: 'log-1',
      workoutSnapshot: plainWorkout({ id: 'snap-w' }),
      startedAt: '2024-06-10T00:00:00.000Z',
      finishedAt: '2024-06-10T00:00:00.000Z',
      results: [],
      kind: 'pool',
    };
    const results = searchPool([other, w], movements, '', {
      region: 'full',
      logs: [log],
      now: NOW,
    });
    expect(results.map((r) => r.id)).toEqual(['snap-w', 'other']);
  });

  it('penalizes a disabled workout by 5 but still shows it', () => {
    const disabled = plainWorkout({ id: 'disabled', name: 'Zzz Disabled', enabled: false });
    const enabled = plainWorkout({ id: 'enabled', name: 'Aaa Enabled', enabled: true });
    const results = searchPool([disabled, enabled], movements, '', {
      region: 'full',
      logs: [],
      now: NOW,
    });
    expect(results.map((r) => r.id)).toEqual(['enabled', 'disabled']);
  });

  it('ties are broken by name', () => {
    const b = plainWorkout({ id: 'b', name: 'Bravo' });
    const a = plainWorkout({ id: 'a', name: 'Alpha' });
    const results = searchPool([b, a], movements, '', { region: 'full', logs: [], now: NOW });
    expect(results.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('respects a custom limit, default 8', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      plainWorkout({ id: `w${i}`, name: `W ${i}` }),
    );
    expect(searchPool(many, movements, '', { region: 'full', logs: [], now: NOW })).toHaveLength(8);
    expect(
      searchPool(many, movements, '', { region: 'full', logs: [], now: NOW, limit: 3 }),
    ).toHaveLength(3);
  });
});
