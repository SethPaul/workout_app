import { describe, expect, it } from 'vitest';
import type { BlockOutcome, PoolWorkout, WorkoutLog } from '../domain/types';
import {
  applyBlockOutcomes,
  buildResultsDraft,
  draftFromLog,
  formatBlockOutcome,
  logFromDraft,
  scoreFromOutcomes,
} from './resultsDraft';
import type { AppState } from '../domain/types';

function poolWorkout(): PoolWorkout {
  return {
    id: 'w1',
    name: 'Squat Day',
    intensity: 'M',
    blocks: [
      {
        format: 'strength',
        title: 'Strength',
        movements: [{ movementId: 'squat', reps: 5 }],
        sets: 3,
      },
      {
        format: 'amrap',
        title: 'Conditioning',
        movements: [{ movementId: 'row', distanceM: 500 }],
        durationSec: 600,
      },
    ],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
  };
}

function baseLog(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'log-1',
    poolWorkoutId: 'w1',
    workoutSnapshot: poolWorkout(),
    startedAt: '2024-06-01T10:00:00.000Z',
    finishedAt: '2024-06-01T10:45:00.000Z',
    score: '7 rounds + 3',
    rpe: 8,
    notes: 'Felt strong',
    kind: 'pool',
    results: [
      {
        movementId: 'squat',
        blockIndex: 0,
        sets: [
          { weight: 225, reps: 5 },
          { weight: 225, reps: 5 },
          { weight: 235, reps: 4 },
        ],
        rpe: 8.5,
      },
      { movementId: 'row', blockIndex: 1, reps: 2, rpe: undefined },
    ],
    ...overrides,
  };
}

describe('draftFromLog / logFromDraft round-trip', () => {
  it('preserves results, score, rpe, and notes through draftFromLog -> logFromDraft', () => {
    const log = baseLog();
    const draft = draftFromLog(log);
    const restored = logFromDraft(log, draft);

    expect(restored.results).toEqual(log.results);
    expect(restored.score).toEqual(log.score);
    expect(restored.rpe).toEqual(log.rpe);
    expect(restored.notes).toEqual(log.notes);
  });

  it('preserves everything else on the log unchanged (id, poolWorkoutId, workoutSnapshot, kind, timing)', () => {
    const log = baseLog();
    const draft = draftFromLog(log);
    const restored = logFromDraft(log, draft);

    expect(restored.id).toBe(log.id);
    expect(restored.poolWorkoutId).toBe(log.poolWorkoutId);
    expect(restored.workoutSnapshot).toEqual(log.workoutSnapshot);
    expect(restored.kind).toBe(log.kind);
    expect(restored.startedAt).toBe(log.startedAt);
    expect(restored.finishedAt).toBe(log.finishedAt);
  });

  it('round-trips an adhoc-style log with no score/rpe/notes', () => {
    const log = baseLog({
      score: undefined,
      rpe: undefined,
      notes: undefined,
      kind: 'adhoc',
      poolWorkoutId: undefined,
    });
    const draft = draftFromLog(log);
    const restored = logFromDraft(log, draft);

    expect(restored.results).toEqual(log.results);
    expect(restored.score).toBeUndefined();
    expect(restored.rpe).toBeUndefined();
    expect(restored.notes).toBeUndefined();
  });
});

describe('buildResultsDraft', () => {
  function fixtureState(): AppState {
    return {
      movements: [
        {
          id: 'squat',
          name: 'Back Squat',
          tags: [],
          equipment: ['barbell'],
          cadenceDays: 7,
          unit: 'reps',
          loadable: true,
        },
        {
          id: 'row',
          name: 'Row',
          tags: [],
          equipment: [],
          cadenceDays: 1,
          unit: 'meters',
          loadable: false,
        },
      ],
      pool: [],
      logs: [],
      settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
      schemaVersion: 2,
      program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
    };
  }

  it('builds one set-draft per prescribed strength set, and a single entry for non-strength movements', () => {
    const draft = buildResultsDraft(fixtureState(), poolWorkout());
    const squatEntry = draft.movements.find((m) => m.movementId === 'squat');
    const rowEntry = draft.movements.find((m) => m.movementId === 'row');

    expect(squatEntry?.sets).toHaveLength(3);
    expect(squatEntry?.sets?.every((s) => s.reps === '5')).toBe(true);
    expect(rowEntry?.sets).toBeUndefined();
    expect(rowEntry?.reps).toBe('');
    expect(squatEntry?.blockIndex).toBe(0);
    expect(rowEntry?.blockIndex).toBe(1);
  });

  it('gives a movement appearing in two blocks one draft entry per block, in block order (no cross-block dedupe)', () => {
    const workout: PoolWorkout = {
      id: 'w2',
      name: 'Clean Day',
      intensity: 'M',
      blocks: [
        {
          format: 'strength',
          title: 'Strength',
          movements: [{ movementId: 'clean', reps: 3 }],
          sets: 5,
        },
        {
          format: 'amrap',
          title: 'Metcon',
          movements: [{ movementId: 'clean', reps: 10 }],
          durationSec: 300,
        },
      ],
      cadenceDays: 14,
      enabled: true,
      source: 'manual',
    };
    const draft = buildResultsDraft(fixtureState(), workout);
    const cleanEntries = draft.movements.filter((m) => m.movementId === 'clean');

    expect(cleanEntries).toHaveLength(2);
    expect(cleanEntries[0].blockIndex).toBe(0);
    expect(cleanEntries[0].sets).toHaveLength(5);
    expect(cleanEntries[1].blockIndex).toBe(1);
    expect(cleanEntries[1].sets).toBeUndefined();
  });
});

describe('resultsFromDraft / draftFromLog with a duplicate movement across blocks', () => {
  function duplicateMovementLog(): WorkoutLog {
    const workoutSnapshot: PoolWorkout = {
      id: 'w2',
      name: 'Clean Day',
      intensity: 'M',
      blocks: [
        {
          format: 'strength',
          title: 'Strength',
          movements: [{ movementId: 'clean', reps: 3 }],
          sets: 2,
        },
        {
          format: 'amrap',
          title: 'Metcon',
          movements: [{ movementId: 'clean', reps: 10 }],
          durationSec: 300,
        },
      ],
      cadenceDays: 14,
      enabled: true,
      source: 'manual',
    };
    return {
      id: 'log-2',
      poolWorkoutId: 'w2',
      workoutSnapshot,
      startedAt: '2024-06-01T10:00:00.000Z',
      finishedAt: '2024-06-01T10:45:00.000Z',
      kind: 'pool',
      results: [
        {
          movementId: 'clean',
          blockIndex: 0,
          sets: [
            { weight: 135, reps: 3 },
            { weight: 135, reps: 3 },
          ],
          rpe: 8,
        },
        { movementId: 'clean', blockIndex: 1, weight: 95, reps: 10, rpe: 7 },
      ],
    };
  }

  it('round-trips two results for the same movementId, keyed by blockIndex', () => {
    const log = duplicateMovementLog();
    const draft = draftFromLog(log);
    expect(draft.movements).toHaveLength(2);
    expect(draft.movements[0]).toMatchObject({ movementId: 'clean', blockIndex: 0 });
    expect(draft.movements[1]).toMatchObject({ movementId: 'clean', blockIndex: 1 });

    const restored = logFromDraft(log, draft);
    expect(restored.results).toEqual(log.results);
  });

  it('infers blockIndex as the first matching block when a result predates the field', () => {
    const log = duplicateMovementLog();
    // Simulate an old log saved before blockIndex existed.
    log.results = log.results.map(({ blockIndex: _blockIndex, ...rest }) => rest);
    const draft = draftFromLog(log);
    expect(draft.movements.map((m) => m.blockIndex)).toEqual([0, 0]);
  });
});

describe('formatBlockOutcome', () => {
  const amrapBlock = poolWorkout().blocks[1]; // format: 'amrap'
  const strengthBlock = poolWorkout().blocks[0]; // format: 'strength'

  it('formats amrap as "N rounds"', () => {
    const outcome: BlockOutcome = {
      blockIndex: 1,
      format: 'amrap',
      roundsDone: 7,
      elapsedMs: 600_000,
      status: 'completed',
    };
    expect(formatBlockOutcome(outcome, amrapBlock)).toBe('7 rounds');
  });

  it('formats rounds/chipper (for-time) as a clock', () => {
    const roundsBlock = { ...amrapBlock, format: 'rounds' as const };
    const outcome: BlockOutcome = {
      blockIndex: 0,
      format: 'rounds',
      elapsedMs: 754_000, // 12:34
      status: 'completed',
    };
    expect(formatBlockOutcome(outcome, roundsBlock)).toBe('12:34');

    const chipperBlock = { ...amrapBlock, format: 'chipper' as const };
    expect(formatBlockOutcome({ ...outcome, format: 'chipper' }, chipperBlock)).toBe('12:34');
  });

  it('formats a death_by fail as "failed at minute N"', () => {
    const deathByBlock = { ...amrapBlock, format: 'death_by' as const };
    const outcome: BlockOutcome = {
      blockIndex: 0,
      format: 'death_by',
      failedAtMinute: 9,
      elapsedMs: 540_000,
      status: 'failed',
    };
    expect(formatBlockOutcome(outcome, deathByBlock)).toBe('failed at minute 9');
  });

  it('formats a skipped block as "skipped" regardless of format', () => {
    const outcome: BlockOutcome = {
      blockIndex: 1,
      format: 'amrap',
      roundsDone: 2,
      elapsedMs: 120_000,
      status: 'skipped',
    };
    expect(formatBlockOutcome(outcome, amrapBlock)).toBe('skipped');
  });

  it('formats strength/emom/tabata/interval (no score) as an empty string', () => {
    const outcome: BlockOutcome = {
      blockIndex: 0,
      format: 'strength',
      elapsedMs: 300_000,
      status: 'completed',
    };
    expect(formatBlockOutcome(outcome, strengthBlock)).toBe('');
  });
});

describe('scoreFromOutcomes', () => {
  it('joins per-block text bare (no block title) for a single-block workout', () => {
    const single: PoolWorkout = { ...poolWorkout(), blocks: [poolWorkout().blocks[1]] };
    const outcomes: BlockOutcome[] = [
      { blockIndex: 0, format: 'amrap', roundsDone: 7, elapsedMs: 600_000, status: 'completed' },
    ];
    expect(scoreFromOutcomes(outcomes, single)).toBe('7 rounds');
  });

  it('prefixes each fragment with its block title, joined by " · ", for a multi-block workout', () => {
    const workout = poolWorkout(); // Strength (strength) + Conditioning (amrap)
    const outcomes: BlockOutcome[] = [
      { blockIndex: 0, format: 'strength', elapsedMs: 400_000, status: 'completed' },
      { blockIndex: 1, format: 'amrap', roundsDone: 4, elapsedMs: 600_000, status: 'completed' },
    ];
    // The strength block contributes no text, so only the amrap fragment appears.
    expect(scoreFromOutcomes(outcomes, workout)).toBe('Conditioning: 4 rounds');
  });

  it('returns an empty string when no outcome has any score text', () => {
    const workout = poolWorkout();
    const outcomes: BlockOutcome[] = [
      { blockIndex: 0, format: 'strength', elapsedMs: 400_000, status: 'completed' },
    ];
    expect(scoreFromOutcomes(outcomes, workout)).toBe('');
  });
});

describe('applyBlockOutcomes', () => {
  it('sets blockOutcomes and derives the score while scoreAuto is true', () => {
    const workout = poolWorkout();
    const draft = buildResultsDraft(
      {
        movements: [],
        pool: [],
        logs: [],
        settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
        schemaVersion: 2,
      },
      workout,
    );
    const outcomes: BlockOutcome[] = [
      { blockIndex: 1, format: 'amrap', roundsDone: 5, elapsedMs: 600_000, status: 'completed' },
    ];
    const next = applyBlockOutcomes(draft, outcomes, workout);
    expect(next.blockOutcomes).toBe(outcomes);
    expect(next.score).toBe('Conditioning: 5 rounds');
  });

  it('sets blockOutcomes but leaves a user-typed score alone once scoreAuto is false', () => {
    const workout = poolWorkout();
    const draft = {
      ...buildResultsDraft(
        {
          movements: [],
          pool: [],
          logs: [],
          settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
          schemaVersion: 2,
        },
        workout,
      ),
      score: 'my custom score',
      scoreAuto: false,
    };
    const outcomes: BlockOutcome[] = [
      { blockIndex: 1, format: 'amrap', roundsDone: 5, elapsedMs: 600_000, status: 'completed' },
    ];
    const next = applyBlockOutcomes(draft, outcomes, workout);
    expect(next.blockOutcomes).toBe(outcomes);
    expect(next.score).toBe('my custom score');
  });
});

describe('draftFromLog / logFromDraft preserve blockOutcomes', () => {
  it('reads log.blockOutcomes into the draft with scoreAuto false, and logFromDraft preserves them', () => {
    const outcomes: BlockOutcome[] = [
      { blockIndex: 1, format: 'amrap', roundsDone: 7, elapsedMs: 600_000, status: 'completed' },
    ];
    const log = baseLog({ blockOutcomes: outcomes });
    const draft = draftFromLog(log);
    expect(draft.blockOutcomes).toEqual(outcomes);
    expect(draft.scoreAuto).toBe(false);

    const restored = logFromDraft(log, draft);
    expect(restored.blockOutcomes).toEqual(outcomes);
  });

  it('defaults to an empty array when the log predates blockOutcomes', () => {
    const log = baseLog();
    const draft = draftFromLog(log);
    expect(draft.blockOutcomes).toEqual([]);
  });
});
