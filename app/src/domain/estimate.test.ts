import { describe, it, expect } from 'vitest';
import { estimateBlockSeconds, estimateWorkoutSeconds, formatDurationMin } from './estimate';
import type { Block } from './types';

function block(overrides: Partial<Block>): Block {
  return { format: 'strength', movements: [{ movementId: 'squat' }], ...overrides };
}

describe('estimateBlockSeconds', () => {
  it('estimates strength sets from work + rest between sets', () => {
    const b = block({ format: 'strength', sets: 5, restSec: 90 });
    // 5 * 30 work + 4 * 90 rest
    expect(estimateBlockSeconds(b)).toBe(5 * 30 + 4 * 90);
  });

  it('uses explicit durationSec for amrap', () => {
    const b = block({ format: 'amrap', durationSec: 900 });
    expect(estimateBlockSeconds(b)).toBe(900);
  });

  it('uses timeCapSec for rounds/chipper when present', () => {
    expect(estimateBlockSeconds(block({ format: 'rounds', timeCapSec: 720 }))).toBe(720);
    expect(estimateBlockSeconds(block({ format: 'chipper', timeCapSec: 500 }))).toBe(500);
  });

  it('falls back to a per-movement guess for an uncapped chipper', () => {
    const b = block({
      format: 'chipper',
      movements: [{ movementId: 'a' }, { movementId: 'b' }, { movementId: 'c' }],
    });
    expect(estimateBlockSeconds(b)).toBe(3 * 60);
  });

  it('computes emom as rounds * interval', () => {
    expect(estimateBlockSeconds(block({ format: 'emom', rounds: 10, intervalSec: 60 }))).toBe(600);
  });

  it('computes tabata across all movements', () => {
    const b = block({
      format: 'tabata',
      movements: [{ movementId: 'a' }, { movementId: 'b' }],
      rounds: 8,
      workSec: 20,
      restSec: 10,
    });
    expect(estimateBlockSeconds(b)).toBe(2 * 8 * 30);
  });
});

describe('estimateWorkoutSeconds', () => {
  it('sums across blocks', () => {
    const blocks: Block[] = [
      block({ format: 'strength', sets: 3, restSec: 60 }),
      block({ format: 'amrap', durationSec: 300 }),
    ];
    expect(estimateWorkoutSeconds(blocks)).toBe(3 * 30 + 2 * 60 + 300);
  });
});

describe('formatDurationMin', () => {
  it('formats minutes under an hour', () => {
    expect(formatDurationMin(45 * 60)).toBe('45 min');
  });

  it('formats hours and minutes', () => {
    expect(formatDurationMin(65 * 60)).toBe('1h 05m');
  });

  it('formats an exact hour without minutes', () => {
    expect(formatDurationMin(120 * 60)).toBe('2h');
  });
});
