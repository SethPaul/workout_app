import { describe, it, expect } from 'vitest';
import { regionForDate, movementRegion, matchesRegion, REGION_LABELS } from './region';
import type { Movement } from '../types';

function movement(tags: string[], overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'm',
    name: 'M',
    tags,
    equipment: [],
    cadenceDays: 3,
    unit: 'reps',
    loadable: true,
    ...overrides,
  };
}

describe('regionForDate', () => {
  // 2024-01-01 is a Monday; constructed with local-time components so this
  // pins the local weekday regardless of host TZ.
  const days: [string, number, ReturnType<typeof regionForDate>][] = [
    ['Monday', 1, 'lower'],
    ['Tuesday', 2, 'lower'],
    ['Wednesday', 3, 'upper'],
    ['Thursday', 4, 'upper'],
    ['Friday', 5, 'full'],
    ['Saturday', 6, 'full'],
    ['Sunday', 7, 'full'],
  ];

  for (const [label, date, expected] of days) {
    it(`${label} -> ${expected}`, () => {
      expect(regionForDate(new Date(2024, 0, date, 12))).toBe(expected);
    });
  }
});

describe('movementRegion', () => {
  it('an explicit region overrides tag derivation', () => {
    expect(movementRegion(movement(['push'], { region: 'lower' }))).toBe('lower');
  });

  it.each(['squat', 'legs', 'hinge', 'unilateral'])('tag "%s" derives lower', (tag) => {
    expect(movementRegion(movement([tag]))).toBe('lower');
  });

  it.each(['push', 'pull', 'gymnastics'])('tag "%s" derives upper', (tag) => {
    expect(movementRegion(movement([tag]))).toBe('upper');
  });

  it('a lower tag and an upper tag together derive full', () => {
    expect(movementRegion(movement(['squat', 'push']))).toBe('full');
  });

  it('neither lower nor upper tags (e.g. core/cardio/carry/plyo) derive full', () => {
    expect(movementRegion(movement(['core']))).toBe('full');
    expect(movementRegion(movement(['cardio']))).toBe('full');
    expect(movementRegion(movement(['carry']))).toBe('full');
    expect(movementRegion(movement(['plyo']))).toBe('full');
  });

  it('no tags at all derives full', () => {
    expect(movementRegion(movement([]))).toBe('full');
  });
});

describe('matchesRegion', () => {
  it('region "full" accepts every movement', () => {
    expect(matchesRegion(movement(['squat']), 'full')).toBe(true);
    expect(matchesRegion(movement(['push']), 'full')).toBe(true);
    expect(matchesRegion(movement(['core']), 'full')).toBe(true);
  });

  it('a movement matching the exact region passes', () => {
    expect(matchesRegion(movement(['squat']), 'lower')).toBe(true);
    expect(matchesRegion(movement(['push']), 'upper')).toBe(true);
  });

  it('a movement of the other region is excluded', () => {
    expect(matchesRegion(movement(['squat']), 'upper')).toBe(false);
    expect(matchesRegion(movement(['push']), 'lower')).toBe(false);
  });

  it('a core (full-region) movement surfaces on both lower and upper filters', () => {
    const core = movement(['core']);
    expect(matchesRegion(core, 'lower')).toBe(true);
    expect(matchesRegion(core, 'upper')).toBe(true);
  });
});

describe('REGION_LABELS', () => {
  it('labels every BodyRegion', () => {
    expect(REGION_LABELS).toEqual({ lower: 'Lower', upper: 'Upper', full: 'Full body' });
  });
});
