import { describe, it, expect } from 'vitest';
import { SEED_REVISION, mergeSeedRevision, seedRevisionOf, type SeedData } from './seedRevision';
import type { AppState, Movement, PoolWorkout } from './types';

function movement(id: string): Movement {
  return {
    id,
    name: id,
    tags: [],
    equipment: ['none'],
    cadenceDays: 1,
    unit: 'reps',
    loadable: false,
  };
}

function workout(id: string, movementIds: string[], tags: string[] = []): PoolWorkout {
  return {
    id,
    name: id,
    intensity: 'M',
    blocks: [
      { format: 'rounds', rounds: 1, movements: movementIds.map((movementId) => ({ movementId })) },
    ],
    cadenceDays: 14,
    enabled: true,
    tags,
    source: 'manual',
  };
}

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    movements: [movement('row')],
    pool: [workout('v1-a', ['row'])],
    logs: [],
    settings: { availableEquipment: ['none'], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 3,
    ...overrides,
  };
}

const seed: SeedData = {
  movements: [movement('row'), movement('air_squat'), movement('unused')],
  pool: [
    workout('v1-a', ['row']),
    workout('v1-deleted', ['row']),
    workout('v2-a', ['row', 'air_squat'], ['day:recovery', 'seed:v2']),
    workout('v2-b', ['row'], ['seed:v2']),
    workout('v3-a', ['row'], ['seed:v3']),
  ],
};

describe('seedRevisionOf', () => {
  it('reads the seed:vN tag', () => {
    expect(seedRevisionOf(workout('x', [], ['slog', 'seed:v2']))).toBe(2);
    expect(seedRevisionOf(workout('x', [], ['seed:v7']))).toBe(7);
  });

  it('treats an untagged or malformed workout as revision 1', () => {
    expect(seedRevisionOf(workout('x', []))).toBe(1);
    expect(seedRevisionOf(workout('x', [], ['seed:vX']))).toBe(1);
    expect(seedRevisionOf(workout('x', [], ['seed:v0']))).toBe(1);
  });
});

describe('mergeSeedRevision', () => {
  it('appends workouts newer than the stored revision and stamps seedRevision', () => {
    const merged = mergeSeedRevision(state(), seed, 2);
    expect(merged.pool.map((w) => w.id)).toEqual(['v1-a', 'v2-a', 'v2-b']);
    expect(merged.seedRevision).toBe(2);
  });

  it('never re-adds a revision-1 workout the user deleted', () => {
    const merged = mergeSeedRevision(state(), seed, 2);
    expect(merged.pool.some((w) => w.id === 'v1-deleted')).toBe(false);
  });

  it('does not add workouts beyond the requested revision', () => {
    const merged = mergeSeedRevision(state(), seed, 2);
    expect(merged.pool.some((w) => w.id === 'v3-a')).toBe(false);
  });

  it('appends only the movements the new workouts reference and the state lacks', () => {
    const merged = mergeSeedRevision(state(), seed, 2);
    expect(merged.movements.map((m) => m.id)).toEqual(['row', 'air_squat']);
  });

  it('skips a new-revision workout whose id is already present', () => {
    const existing = { ...workout('v2-a', ['row'], ['seed:v2']), name: 'edited by user' };
    const merged = mergeSeedRevision(state({ pool: [existing] }), seed, 2);
    expect(merged.pool.filter((w) => w.id === 'v2-a')).toEqual([existing]);
    expect(merged.pool.map((w) => w.id)).toEqual(['v2-a', 'v2-b']);
  });

  it('returns the state by identity when already at or past the revision', () => {
    const current = state({ seedRevision: 2 });
    expect(mergeSeedRevision(current, seed, 2)).toBe(current);
    const ahead = state({ seedRevision: 3 });
    expect(mergeSeedRevision(ahead, seed, 2)).toBe(ahead);
  });

  it('is idempotent', () => {
    const once = mergeSeedRevision(state(), seed, 2);
    expect(mergeSeedRevision(once, seed, 2)).toBe(once);
  });

  it('stamps the revision even when nothing new applies', () => {
    const merged = mergeSeedRevision(state(), { movements: [], pool: [] }, 2);
    expect(merged.seedRevision).toBe(2);
    expect(merged.pool.map((w) => w.id)).toEqual(['v1-a']);
  });

  it('defaults to SEED_REVISION', () => {
    const merged = mergeSeedRevision(state(), seed);
    expect(merged.seedRevision).toBe(SEED_REVISION);
  });
});
