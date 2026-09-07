import { describe, it, expect } from 'vitest';
import { heavyMovementsInWorkout, movementPatterns, PATTERN_CADENCE_DAYS } from './patterns';
import type { Movement, PoolWorkout } from './types';

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

describe('movementPatterns', () => {
  it('maps direct tags to the same-named pattern', () => {
    expect(movementPatterns(movement('back_squat', { tags: ['squat', 'compound'] }))).toEqual(['squat']);
    expect(movementPatterns(movement('deadlift', { tags: ['hinge'] }))).toEqual(['hinge']);
  });

  it('maps legs -> squat and carry -> core', () => {
    expect(movementPatterns(movement('lunge', { tags: ['legs'] }))).toEqual(['squat']);
    expect(movementPatterns(movement('farmers_carry', { tags: ['carry'] }))).toEqual(['core']);
  });

  it('applies by-id overrides regardless of tags', () => {
    expect(movementPatterns(movement('bar_complex', { tags: ['accessory'] }))).toEqual(['hinge']);
    expect(movementPatterns(movement('sandbag_drop', { tags: ['compound'] }))).toEqual(['hinge']);
    expect(movementPatterns(movement('tire_flip', { tags: ['accessory'] }))).toEqual(['hinge']);
    expect(movementPatterns(movement('renegade_manmaker', { tags: ['compound'] }))).toEqual(['pull']);
    expect(movementPatterns(movement('turkish_getup', { tags: ['accessory'] }))).toEqual(['core']);
  });

  it('returns multiple patterns for multi-tagged movements', () => {
    const patterns = movementPatterns(movement('thruster', { tags: ['squat', 'push'] }));
    expect(patterns).toContain('squat');
    expect(patterns).toContain('push');
  });

  it('returns an empty list for a movement with no mappable tags', () => {
    expect(movementPatterns(movement('plank', { tags: ['accessory'] }))).toEqual([]);
  });
});

describe('PATTERN_CADENCE_DAYS', () => {
  it('sets the specified per-pattern minimums', () => {
    expect(PATTERN_CADENCE_DAYS).toEqual({
      squat: 2,
      hinge: 2,
      push: 2,
      pull: 2,
      olympic: 2,
      core: 0,
      cardio: 0,
      plyo: 1,
    });
  });
});

function workout(
  id: string,
  blocks: PoolWorkout['blocks'],
  overrides: Partial<PoolWorkout> = {},
): PoolWorkout {
  return {
    id,
    name: id,
    intensity: 'M',
    blocks,
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
    ...overrides,
  };
}

describe('heavyMovementsInWorkout', () => {
  const backSquat = movement('back_squat', { tags: ['squat', 'compound'] });
  const frontSquat = movement('front_squat', { tags: ['squat', 'compound'] });
  const cleanBarbell = movement('clean', { tags: ['olympic'], equipment: ['barbell'] });
  const kbSnatch = movement('kb_snatch', { tags: ['olympic'], equipment: ['kettlebell'] });
  const byId = new Map([
    [backSquat.id, backSquat],
    [frontSquat.id, frontSquat],
    [cleanBarbell.id, cleanBarbell],
    [kbSnatch.id, kbSnatch],
  ]);

  it('counts a movement in a strength block as heavy', () => {
    const w = workout('w1', [{ format: 'strength', movements: [{ movementId: 'back_squat' }] }]);
    expect(heavyMovementsInWorkout(w, byId).map((m) => m.id)).toEqual(['back_squat']);
  });

  it('counts a movement in a block titled Power as heavy', () => {
    const w = workout('w1', [
      { format: 'emom', title: 'Power', movements: [{ movementId: 'front_squat' }] },
    ]);
    expect(heavyMovementsInWorkout(w, byId).map((m) => m.id)).toEqual(['front_squat']);
  });

  it('does not count a movement in a non-strength, non-Power block as heavy', () => {
    const w = workout('w1', [
      { format: 'amrap', title: 'Conditioning', movements: [{ movementId: 'front_squat' }] },
    ]);
    expect(heavyMovementsInWorkout(w, byId)).toEqual([]);
  });

  it('counts an olympic-tagged barbell movement as heavy anywhere', () => {
    const w = workout('w1', [
      { format: 'amrap', title: 'Conditioning', movements: [{ movementId: 'clean' }] },
    ]);
    expect(heavyMovementsInWorkout(w, byId).map((m) => m.id)).toEqual(['clean']);
  });

  it('does not treat a non-barbell olympic movement as heavy outside a heavy block', () => {
    const w = workout('w1', [
      { format: 'amrap', title: 'Conditioning', movements: [{ movementId: 'kb_snatch' }] },
    ]);
    expect(heavyMovementsInWorkout(w, byId)).toEqual([]);
  });
});
