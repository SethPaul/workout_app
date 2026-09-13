import { describe, it, expect } from 'vitest';
import { searchMovements, hasExactName } from './search';
import type { Movement, WorkoutLog, PoolWorkout } from '../types';

function movement(id: string, name: string, overrides: Partial<Movement> = {}): Movement {
  return {
    id,
    name,
    tags: [],
    equipment: [],
    cadenceDays: 3,
    unit: 'reps',
    loadable: true,
    ...overrides,
  };
}

function snapshotWith(movementId: string): PoolWorkout {
  return {
    id: `w-${movementId}`,
    name: 'w',
    intensity: 'M',
    blocks: [{ format: 'strength', movements: [{ movementId }], sets: 1 }],
    cadenceDays: 0,
    enabled: false,
    source: 'manual',
  };
}

function logFor(movementId: string, finishedAt: string): WorkoutLog {
  return {
    id: `log-${movementId}-${finishedAt}`,
    workoutSnapshot: snapshotWith(movementId),
    startedAt: finishedAt,
    finishedAt,
    results: [{ movementId, sets: [] }],
    kind: 'pool',
  };
}

const NOW = new Date('2024-06-15T12:00:00.000Z');

describe('searchMovements ranking', () => {
  it('ranks exact name match above word-prefix above substring', () => {
    const exact = movement('squat', 'Squat');
    const prefix = movement('squat_jump', 'Squat Jump');
    const substring = movement('backsquat', 'Backsquat');
    const results = searchMovements([substring, prefix, exact], 'squat', {
      region: 'full',
      logs: [],
      now: NOW,
    });
    expect(results.map((m) => m.id)).toEqual(['squat', 'squat_jump', 'backsquat']);
  });

  it('excludes movements matching neither name nor alias', () => {
    const results = searchMovements(
      [movement('bench', 'Bench Press'), movement('squat', 'Squat')],
      'squat',
      { region: 'full', logs: [], now: NOW },
    );
    expect(results.map((m) => m.id)).toEqual(['squat']);
  });

  it('matches via aliases', () => {
    const m = movement('kb_swing', 'Kettlebell Swing', { aliases: ['kb swing'] });
    const results = searchMovements([m], 'kb swing', { region: 'full', logs: [], now: NOW });
    expect(results.map((r) => r.id)).toEqual(['kb_swing']);
  });

  it('boosts movements in the vasa library over an equally-matched default one', () => {
    // Same word-prefix tier (+50) for both; alphabetically "Ankle" sorts
    // before "Zulu", so only the +10 vasa-library boost can put curl_v first.
    const vasaM = movement('curl_v', 'Zulu Curl', { libraries: ['vasa'] });
    const defaultM = movement('curl_d', 'Ankle Curl', { libraries: ['default'] });
    const results = searchMovements([defaultM, vasaM], 'curl', {
      region: 'full',
      logs: [],
      now: NOW,
    });
    expect(results.map((m) => m.id)).toEqual(['curl_v', 'curl_d']);
  });

  it('boosts an exact region match over one that only passes the full-body fallback', () => {
    const lowerM = movement('lunge', 'Lunge', { region: 'lower' });
    const coreM = movement('plank', 'Plank', { tags: ['core'] }); // derives 'full'
    const results = searchMovements([coreM, lowerM], '', { region: 'lower', logs: [], now: NOW });
    expect(results.map((m) => m.id)).toEqual(['lunge', 'plank']);
  });

  it('does not exclude a movement outside the requested region, only ranks it without the region bonus', () => {
    const upperM = movement('bench_press', 'Bench Press', { tags: ['push'] });
    const lowerM = movement('bench_squat', 'Bench Squat', { tags: ['squat'] });
    const results = searchMovements([upperM, lowerM], 'bench', {
      region: 'lower',
      logs: [],
      now: NOW,
    });
    expect(results.map((m) => m.id)).toEqual(['bench_squat', 'bench_press']);
  });

  it('boosts a movement performed within the last 30 days', () => {
    // Alphabetically "Alpha Row" would sort first; the recency boost flips it.
    const recent = movement('recent', 'Zeta Row');
    const stale = movement('stale', 'Alpha Row');
    const logs = [logFor('recent', '2024-06-01T00:00:00.000Z')]; // 14 days before NOW
    const results = searchMovements([stale, recent], 'row', { region: 'full', logs, now: NOW });
    expect(results.map((m) => m.id)).toEqual(['recent', 'stale']);
  });

  it('does not boost a movement last performed more than 30 days ago', () => {
    const old = movement('old', 'Zeta Row');
    const other = movement('other', 'Alpha Row');
    const logs = [logFor('old', '2024-01-01T00:00:00.000Z')];
    const results = searchMovements([old, other], 'row', { region: 'full', logs, now: NOW });
    // No recency edge for either -> tie-break falls back to name.
    expect(results.map((m) => m.id)).toEqual(['other', 'old']);
  });

  it('ranks an unavailable-at-Vasa movement down but does not hide it', () => {
    const available = movement('db_row', 'Dumbbell Row', { equipment: ['dumbbell'] });
    const unavailable = movement('cable_row', 'Cable Row', { equipment: ['cable'] });
    const results = searchMovements([unavailable, available], 'row', {
      region: 'full',
      logs: [],
      now: NOW,
    });
    expect(results.map((m) => m.id)).toEqual(['db_row', 'cable_row']);
  });

  it('applies the default limit of 8', () => {
    const movements = Array.from({ length: 12 }, (_, i) => movement(`m${i}`, `Row ${i}`));
    const results = searchMovements(movements, 'row', { region: 'full', logs: [], now: NOW });
    expect(results).toHaveLength(8);
  });

  it('honors a custom limit', () => {
    const movements = Array.from({ length: 5 }, (_, i) => movement(`m${i}`, `Row ${i}`));
    const results = searchMovements(movements, 'row', {
      region: 'full',
      logs: [],
      now: NOW,
      limit: 2,
    });
    expect(results).toHaveLength(2);
  });

  it('an empty query returns every movement ranked by the non-name signals', () => {
    // Alphabetically "Alpha" would sort first; the vasa-library boost flips it.
    const vasaM = movement('z', 'Zulu', { libraries: ['vasa'] });
    const defaultM = movement('a', 'Alpha', { libraries: ['default'] });
    const results = searchMovements([defaultM, vasaM], '', { region: 'full', logs: [], now: NOW });
    expect(results.map((m) => m.id)).toEqual(['z', 'a']);
  });

  it('ties break alphabetically by name', () => {
    const b = movement('b', 'Beta');
    const a = movement('a', 'Alpha');
    const results = searchMovements([b, a], '', { region: 'full', logs: [], now: NOW });
    expect(results.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('hasExactName', () => {
  it('is true for a case/whitespace-insensitive exact name match', () => {
    const movements = [movement('squat', 'Back Squat')];
    expect(hasExactName(movements, 'back squat')).toBe(true);
    expect(hasExactName(movements, '  BACK   SQUAT  ')).toBe(true);
  });

  it('is true for an exact alias match', () => {
    const movements = [movement('rdl', 'Romanian Deadlift', { aliases: ['rdl'] })];
    expect(hasExactName(movements, 'RDL')).toBe(true);
  });

  it('is false when there is no exact match, even if a substring matches', () => {
    const movements = [movement('squat', 'Back Squat')];
    expect(hasExactName(movements, 'squat')).toBe(false);
    expect(hasExactName(movements, 'front squat')).toBe(false);
  });
});
