import { describe, it, expect } from 'vitest';
import {
  searchMovements,
  hasExactName,
  similarMovements,
  normalizeText,
  singular,
  expandAbbreviation,
  textMatchScore,
} from './search';
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

  it('treats "pull up" and "Pull-up" as an exact match either direction', () => {
    const movements = [movement('pullup', 'Pull-up')];
    expect(hasExactName(movements, 'pull up')).toBe(true);
    expect(hasExactName(movements, 'Pull Up')).toBe(true);
  });

  it('treats "dead bugs" as an exact match of "Dead Bug" (singularized)', () => {
    const movements = [movement('dead_bug', 'Dead Bug')];
    expect(hasExactName(movements, 'dead bugs')).toBe(true);
  });
});

describe('normalizeText', () => {
  it('lowercases and folds punctuation/hyphens/whitespace to single spaces', () => {
    expect(normalizeText('Pull-up')).toBe('pull up');
    expect(normalizeText('  Incline   Dumbbell_Fly! ')).toBe('incline dumbbell fly');
  });

  it('leaves a single run-together word untouched', () => {
    expect(normalizeText('pullup')).toBe('pullup');
  });
});

describe('singular', () => {
  it('turns a trailing "ies" into "y"', () => {
    expect(singular('flies')).toBe('fly');
  });

  it('strips one trailing "s"', () => {
    expect(singular('flys')).toBe('fly');
    expect(singular('bugs')).toBe('bug');
  });

  it('does not strip "s" from a word ending in "ss" or 3 characters or shorter', () => {
    expect(singular('press')).toBe('press');
    expect(singular('legs')).toBe('leg');
    expect(singular('abs')).toBe('abs'); // 3 chars, left alone
  });
});

describe('expandAbbreviation', () => {
  it('expands a token that is exactly a known abbreviation', () => {
    expect(expandAbbreviation('db')).toEqual(['dumbbell']);
    expect(expandAbbreviation('rdl')).toEqual(['romanian', 'deadlift']);
    expect(expandAbbreviation('kb')).toEqual(['kettlebell']);
  });

  it('leaves a non-abbreviation token unchanged', () => {
    expect(expandAbbreviation('dumbbell')).toEqual(['dumbbell']);
  });

  it('does not expand a token that only contains an abbreviation', () => {
    expect(expandAbbreviation('dbx')).toEqual(['dbx']);
  });
});

describe('searchMovements match tiers (SPEC 10.7)', () => {
  it('matches "pull up" against "Pull-up" (hyphen/space fold to the same normalized text)', () => {
    const m = movement('pullup', 'Pull-up');
    const results = searchMovements([m], 'pull up', { region: 'full', logs: [], now: NOW });
    expect(results.map((r) => r.id)).toEqual(['pullup']);
  });

  it('matches "pullup" against "Pull-up" via the space-stripped substring tier', () => {
    const m = movement('pullup', 'Pull-up');
    const results = searchMovements([m], 'pullup', { region: 'full', logs: [], now: NOW });
    expect(results.map((r) => r.id)).toEqual(['pullup']);
  });

  it('"inc db fly" scores an ordered word-prefix match above an unordered one', () => {
    const ordered = movement('incline_db_fly', 'Incline Dumbbell Fly');
    const unordered = movement('db_incline_fly', 'Dumbbell Incline Fly');
    const results = searchMovements([unordered, ordered], 'inc db fly', {
      region: 'full',
      logs: [],
      now: NOW,
    });
    expect(results.map((r) => r.id)).toEqual(['incline_db_fly', 'db_incline_fly']);
  });

  it('scores an unordered word-prefix match (query tokens out of order) above a mismatch', () => {
    const m = movement('db_incline_fly', 'Dumbbell Incline Fly');
    const noMatch = movement('bench', 'Bench Press');
    const results = searchMovements([noMatch, m], 'inc db fly', {
      region: 'full',
      logs: [],
      now: NOW,
    });
    expect(results.map((r) => r.id)).toEqual(['db_incline_fly']);
  });

  it('"rdl" finds "Romanian Deadlift" via abbreviation expansion', () => {
    const m = movement('rdl', 'Romanian Deadlift');
    const results = searchMovements([m], 'rdl', { region: 'full', logs: [], now: NOW });
    expect(results.map((r) => r.id)).toEqual(['rdl']);
  });

  it('"kb swing" finds "Kettlebell Swing" via abbreviation expansion', () => {
    const m = movement('kb_swing', 'Kettlebell Swing');
    const results = searchMovements([m], 'kb swing', { region: 'full', logs: [], now: NOW });
    expect(results.map((r) => r.id)).toEqual(['kb_swing']);
  });

  it('"flys" and "flies" both match "Fly" (singularization)', () => {
    const m = movement('fly', 'Fly');
    expect(
      searchMovements([m], 'flys', { region: 'full', logs: [], now: NOW }).map((r) => r.id),
    ).toEqual(['fly']);
    expect(
      searchMovements([m], 'flies', { region: 'full', logs: [], now: NOW }).map((r) => r.id),
    ).toEqual(['fly']);
  });

  it('excludes a movement with no match at any tier when the query is non-empty', () => {
    const m = movement('squat', 'Back Squat');
    const results = searchMovements([m], 'xyz', { region: 'full', logs: [], now: NOW });
    expect(results).toEqual([]);
  });
});

describe('similarMovements', () => {
  it('ranks by match tier alone, ignoring library/region/recency/availability boosts', () => {
    // "Fly" is an exact match (100) for a default-library movement; "Incline
    // Fly" is only an ordered word-prefix match (60) even though it is in
    // the vasa library, which would normally add +10.
    const exactDefault = movement('fly', 'Fly', { libraries: ['default'] });
    const prefixVasa = movement('incline_fly', 'Incline Fly', { libraries: ['vasa'] });
    const results = similarMovements([prefixVasa, exactDefault], 'fly');
    expect(results.map((r) => r.id)).toEqual(['fly', 'incline_fly']);
  });

  it('returns only the top `limit` matches (default 3)', () => {
    const movements = Array.from({ length: 5 }, (_, i) => movement(`m${i}`, `Row ${i}`));
    expect(similarMovements(movements, 'row')).toHaveLength(3);
    expect(similarMovements(movements, 'row', 2)).toHaveLength(2);
  });

  it('excludes movements with no match at any tier', () => {
    const m = movement('squat', 'Back Squat');
    expect(similarMovements([m], 'xyz')).toEqual([]);
  });

  it('returns nothing for an empty query', () => {
    const m = movement('squat', 'Back Squat');
    expect(similarMovements([m], '')).toEqual([]);
  });
});

describe('textMatchScore (SPEC 10.7/10.8: nameMatchScore factored out for arbitrary strings)', () => {
  it('scores an exact normalized+singularized match 100', () => {
    expect(textMatchScore('dead bugs', ['Dead Bug'])).toBe(100);
  });

  it('scores an ordered word-prefix match 60', () => {
    expect(textMatchScore('inc db fly', ['Incline Dumbbell Fly'])).toBe(60);
  });

  it('scores an unordered word-prefix match 50', () => {
    expect(textMatchScore('fly inc', ['Incline Dumbbell Fly'])).toBe(50);
  });

  it('scores a space-stripped substring match 20', () => {
    expect(textMatchScore('pullup', ['Pull-up'])).toBe(20);
  });

  it('scores 0 (no match) for an empty query or no matching candidate', () => {
    expect(textMatchScore('', ['Back Squat'])).toBe(0);
    expect(textMatchScore('xyz', ['Back Squat'])).toBe(0);
  });

  it('takes the best score across multiple candidates', () => {
    expect(textMatchScore('back squat', ['vasa', 'region:lower', 'Back Squat'])).toBe(100);
  });

  it('empty candidate strings are ignored, not treated as a match', () => {
    expect(textMatchScore('back squat', ['', 'Back Squat'])).toBe(100);
  });
});
