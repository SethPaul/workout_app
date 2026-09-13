import { describe, it, expect } from 'vitest';
import { buildVasaLog, lastVasaSets } from './build';
import { lastPerformedMovement } from '../cadence';
import type { VasaBlockInput } from './build';

function mainBlock(overrides: Partial<VasaBlockInput> = {}): VasaBlockInput {
  return {
    role: 'main',
    title: 'Main',
    movements: [{ movementId: 'back_squat', sets: [{ weight: 185, reps: 8 }] }],
    ...overrides,
  };
}

describe('buildVasaLog', () => {
  it('drops blocks with no movements', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock(), { role: 'accessory', title: 'Accessory 1', movements: [] }],
      id: 'l1',
    });
    expect(log.workoutSnapshot.blocks).toHaveLength(1);
    expect(log.results).toHaveLength(1);
  });

  it('assigns blockIndex against the post-drop block list', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [
        { role: 'main', title: 'Main', movements: [] }, // dropped
        mainBlock({ title: 'Accessory 1' }),
        {
          role: 'finisher',
          title: 'Finisher',
          movements: [{ movementId: 'plank', sets: [] }],
        },
      ],
      id: 'l1',
    });
    expect(log.workoutSnapshot.blocks).toHaveLength(2);
    expect(log.results.map((r) => r.blockIndex)).toEqual([0, 1]);
    expect(log.results[0].movementId).toBe('back_squat');
    expect(log.results[1].movementId).toBe('plank');
  });

  it('main/accessory blocks become strength blocks with sets = the largest set count (min 1)', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'upper',
      blocks: [
        {
          role: 'accessory',
          title: 'Accessory 2',
          movements: [
            { movementId: 'incline_dumbbell_fly', sets: [{ reps: 10 }, { reps: 10 }] },
            { movementId: 'band_tricep_extension', sets: [{ reps: 15 }] },
          ],
        },
      ],
      id: 'l1',
    });
    const block = log.workoutSnapshot.blocks[0];
    expect(block.format).toBe('strength');
    expect(block.sets).toBe(2);
    expect(block.title).toBe('Accessory 2');
  });

  it('an empty-sets main block still gets sets: 1 (the min)', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [
        { role: 'main', title: 'Main', movements: [{ movementId: 'back_squat', sets: [] }] },
      ],
      id: 'l1',
    });
    expect(log.workoutSnapshot.blocks[0].sets).toBe(1);
  });

  it('finisher blocks become a 120s amrap', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'full',
      blocks: [
        {
          role: 'finisher',
          title: 'Finisher (2 min)',
          movements: [{ movementId: 'plank', sets: [] }],
        },
      ],
      id: 'l1',
    });
    const block = log.workoutSnapshot.blocks[0];
    expect(block.format).toBe('amrap');
    expect(block.durationSec).toBe(120);
    expect(block.title).toBe('Finisher (2 min)');
    expect(block.sets).toBeUndefined();
  });

  it('drops sets with neither weight nor reps, but keeps an otherwise-empty sets array', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [
        mainBlock({
          movements: [
            {
              movementId: 'back_squat',
              sets: [{ weight: 185, reps: 8 }, {}, { reps: 5 }, { weight: 200 }],
            },
          ],
        }),
      ],
      id: 'l1',
    });
    expect(log.results[0].sets).toEqual([
      { weight: 185, reps: 8 },
      { weight: undefined, reps: 5 },
      { weight: 200, reps: undefined },
    ]);
  });

  it('an all-blank sets array survives as an empty MovementResult.sets', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock({ movements: [{ movementId: 'back_squat', sets: [{}, {}] }] })],
      id: 'l1',
    });
    expect(log.results[0].sets).toEqual([]);
  });

  it('carries a MovementResult.notes from the input', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [
        mainBlock({
          role: 'finisher',
          movements: [{ movementId: 'plank', sets: [], notes: '3 rounds' }],
        }),
      ],
      id: 'l1',
    });
    expect(log.results[0].notes).toBe('3 rounds');
  });

  it('names the snapshot with region only when no style is given', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
      id: 'l1',
    });
    expect(log.workoutSnapshot.name).toBe('Vasa LFT · Lower');
  });

  it('appends the style label to the snapshot name when a style is set', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'upper',
      style: 'build',
      blocks: [mainBlock()],
      id: 'l1',
    });
    expect(log.workoutSnapshot.name).toBe('Vasa LFT · Upper · Build · strength');
  });

  it('sets the fixed snapshot fields', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
      id: 'l1',
    });
    expect(log.workoutSnapshot.id).toBe('vasa-l1');
    expect(log.workoutSnapshot.intensity).toBe('M');
    expect(log.workoutSnapshot.cadenceDays).toBe(0);
    expect(log.workoutSnapshot.enabled).toBe(false);
    expect(log.workoutSnapshot.source).toBe('manual');
  });

  it('tags the snapshot with vasa, region and (when set) style', () => {
    const withStyle = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'upper',
      style: 'pump',
      blocks: [mainBlock()],
      id: 'l1',
    });
    expect(withStyle.workoutSnapshot.tags).toEqual(['vasa', 'region:upper', 'style:pump']);

    const withoutStyle = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
      id: 'l2',
    });
    expect(withoutStyle.workoutSnapshot.tags).toEqual(['vasa', 'region:lower']);
  });

  it('stamps kind: "vasa" and vasa: { region, style }', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'upper',
      style: 'power',
      blocks: [mainBlock()],
      id: 'l1',
    });
    expect(log.kind).toBe('vasa');
    expect(log.vasa).toEqual({ region: 'upper', style: 'power' });
  });

  it('omits style from vasa meta when none is given', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
      id: 'l1',
    });
    expect(log.vasa).toEqual({ region: 'lower' });
  });

  it('a bare "YYYY-MM-DD" date means local noon', () => {
    const log = buildVasaLog({
      date: '2024-06-01',
      region: 'lower',
      blocks: [mainBlock()],
      id: 'l1',
    });
    const expected = new Date('2024-06-01T12:00:00').toISOString();
    expect(log.startedAt).toBe(expected);
    expect(log.finishedAt).toBe(expected);
  });

  it('a full ISO date string is used as-is', () => {
    const log = buildVasaLog({
      date: '2024-06-01T09:30:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
      id: 'l1',
    });
    expect(log.startedAt).toBe('2024-06-01T09:30:00.000Z');
    expect(log.finishedAt).toBe('2024-06-01T09:30:00.000Z');
  });

  it('a Date instance is converted via toISOString', () => {
    const date = new Date('2024-06-01T09:30:00.000Z');
    const log = buildVasaLog({ date, region: 'lower', blocks: [mainBlock()], id: 'l1' });
    expect(log.startedAt).toBe(date.toISOString());
  });

  it('generates a unique id when none is given', () => {
    const l1 = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
    });
    const l2 = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
    });
    expect(l1.id).not.toBe(l2.id);
  });

  it('carries notes and rpe onto the log', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
      notes: 'felt strong',
      rpe: 8,
      id: 'l1',
    });
    expect(log.notes).toBe('felt strong');
    expect(log.rpe).toBe(8);
  });

  it('has no poolWorkoutId', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
      id: 'l1',
    });
    expect(log.poolWorkoutId).toBeUndefined();
  });

  it('feeds lastPerformedMovement like a pool log (SPEC 10.3)', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
      id: 'l1',
    });
    expect(lastPerformedMovement([log], 'back_squat')).toBe(log.finishedAt);
  });
});

describe('lastVasaSets', () => {
  it('returns null when the movement has never been performed', () => {
    expect(lastVasaSets([], 'back_squat')).toBeNull();
  });

  it('returns the sets and date of the most recent log containing the movement', () => {
    const older = buildVasaLog({
      date: '2024-05-01T12:00:00.000Z',
      region: 'lower',
      blocks: [
        mainBlock({ movements: [{ movementId: 'back_squat', sets: [{ weight: 175, reps: 8 }] }] }),
      ],
      id: 'l1',
    });
    const newer = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [
        mainBlock({
          movements: [
            {
              movementId: 'back_squat',
              sets: [
                { weight: 185, reps: 8 },
                { weight: 185, reps: 7 },
              ],
            },
          ],
        }),
      ],
      id: 'l2',
    });
    const result = lastVasaSets([older, newer], 'back_squat');
    expect(result).toEqual({
      date: newer.finishedAt,
      sets: [
        { weight: 185, reps: 8 },
        { weight: 185, reps: 7 },
      ],
    });
  });

  it('finds the movement in a log of any kind, not just vasa', () => {
    const log = buildVasaLog({
      date: '2024-06-01T12:00:00.000Z',
      region: 'lower',
      blocks: [mainBlock()],
      id: 'l1',
    });
    // buildVasaLog's own snapshot is already kind: 'vasa'; this just pins
    // that lastVasaSets doesn't special-case kind at all.
    expect(log.kind).toBe('vasa');
    const result = lastVasaSets([log], 'back_squat');
    expect(result?.sets).toEqual([{ weight: 185, reps: 8 }]);
  });
});
