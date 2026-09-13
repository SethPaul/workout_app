import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  draftHasAnyMovement,
  draftToLogInput,
  newVasaDraft,
  readVasaDraft,
  regionForDraftDate,
  writeVasaDraft,
  type VasaDraft,
} from './vasaDraft';
import type { Movement } from '../domain/types';

function fixtureDraft(overrides: Partial<VasaDraft> = {}): VasaDraft {
  return { ...newVasaDraft(new Date('2024-01-16T12:00:00')), ...overrides }; // Tue -> lower
}

describe('vasaDraft (SPEC 10.5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('newVasaDraft', () => {
    it('defaults region by weekday via regionForDate', () => {
      expect(newVasaDraft(new Date('2024-01-16T12:00:00')).region).toBe('lower'); // Tuesday
      expect(newVasaDraft(new Date('2024-01-17T12:00:00')).region).toBe('upper'); // Wednesday
      expect(newVasaDraft(new Date('2024-01-19T12:00:00')).region).toBe('full'); // Friday
    });

    it('creates four blocks: Main, Accessory 1, Accessory 2, Finisher (2 min)', () => {
      const draft = newVasaDraft(new Date('2024-01-16T12:00:00'));
      expect(draft.blocks.map((b) => b.title)).toEqual([
        'Main',
        'Accessory 1',
        'Accessory 2',
        'Finisher (2 min)',
      ]);
      expect(draft.blocks.map((b) => b.role)).toEqual([
        'main',
        'accessory',
        'accessory',
        'finisher',
      ]);
      expect(draft.regionTouched).toBe(false);
      expect(draft.blocks.every((b) => b.movements.length === 0)).toBe(true);
    });
  });

  describe('regionForDraftDate', () => {
    it('parses the bare date as local noon before deriving the region', () => {
      expect(regionForDraftDate('2024-01-16')).toBe('lower'); // Tuesday
      expect(regionForDraftDate('2024-01-18')).toBe('upper'); // Thursday
      expect(regionForDraftDate('2024-01-20')).toBe('full'); // Saturday
    });
  });

  describe('localStorage round-trip', () => {
    it('returns null when nothing is stored', () => {
      expect(readVasaDraft()).toBeNull();
    });

    it('writes and reads back an identical draft', () => {
      const draft = fixtureDraft({
        blocks: [
          {
            role: 'main',
            title: 'Main',
            movements: [{ movementId: 'squat', sets: [{ weight: '185', reps: '8' }], note: '' }],
          },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
        ],
      });
      writeVasaDraft(draft);
      expect(readVasaDraft()).toEqual(draft);
    });

    it('clears the stored draft when written null', () => {
      writeVasaDraft(fixtureDraft());
      writeVasaDraft(null);
      expect(readVasaDraft()).toBeNull();
    });

    it('returns null for corrupt JSON rather than throwing', () => {
      localStorage.setItem('workout_app.vasaDraft', '{not json');
      expect(readVasaDraft()).toBeNull();
    });

    it('returns null for a plausible-looking but wrong-shaped value', () => {
      localStorage.setItem('workout_app.vasaDraft', JSON.stringify({ foo: 'bar' }));
      expect(readVasaDraft()).toBeNull();
    });
  });

  describe('draftToLogInput', () => {
    it('drops empty weight/reps/notes/rpe strings to undefined', () => {
      const draft = fixtureDraft({
        notes: '   ',
        rpe: '',
        blocks: [
          {
            role: 'main',
            title: 'Main',
            movements: [{ movementId: 'squat', sets: [{ weight: '', reps: '' }], note: '' }],
          },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
        ],
      });
      const input = draftToLogInput(draft);
      expect(input.notes).toBeUndefined();
      expect(input.rpe).toBeUndefined();
      expect(input.blocks[0].movements[0].sets).toEqual([{ weight: undefined, reps: undefined }]);
    });

    it('parses numeric weight/reps/rpe strings', () => {
      const draft = fixtureDraft({
        rpe: '7.5',
        notes: 'Felt strong',
        blocks: [
          {
            role: 'main',
            title: 'Main',
            movements: [
              {
                movementId: 'squat',
                sets: [
                  { weight: '185', reps: '8' },
                  { weight: '185', reps: '8' },
                ],
                note: '',
              },
            ],
          },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
        ],
      });
      const input = draftToLogInput(draft);
      expect(input.rpe).toBe(7.5);
      expect(input.notes).toBe('Felt strong');
      expect(input.blocks[0].movements[0].sets).toEqual([
        { weight: 185, reps: 8 },
        { weight: 185, reps: 8 },
      ]);
    });

    it('carries a finisher note through as `notes` with no sets', () => {
      const draft = fixtureDraft({
        blocks: [
          { role: 'main', title: 'Main', movements: [] },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          {
            role: 'finisher',
            title: 'Finisher (2 min)',
            movements: [{ movementId: 'plank', sets: [], note: '20 each side' }],
          },
        ],
      });
      const input = draftToLogInput(draft);
      expect(input.blocks[3].movements[0]).toEqual({
        movementId: 'plank',
        sets: [],
        notes: '20 each side',
      });
    });

    it('drops draft entries for movements no longer present when a movement list is given', () => {
      const movements: Movement[] = [
        {
          id: 'squat',
          name: 'Squat',
          tags: [],
          equipment: [],
          cadenceDays: 7,
          unit: 'reps',
          loadable: true,
        },
      ];
      const draft = fixtureDraft({
        blocks: [
          {
            role: 'main',
            title: 'Main',
            movements: [
              { movementId: 'squat', sets: [{ weight: '185', reps: '5' }], note: '' },
              { movementId: 'deleted_movement', sets: [{ weight: '10', reps: '10' }], note: '' },
            ],
          },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
        ],
      });
      const input = draftToLogInput(draft, movements);
      expect(input.blocks[0].movements).toHaveLength(1);
      expect(input.blocks[0].movements[0].movementId).toBe('squat');
    });
  });

  describe('draftHasAnyMovement', () => {
    it('is false for a fresh draft', () => {
      expect(draftHasAnyMovement(fixtureDraft())).toBe(false);
    });

    it('is true once any block has a movement', () => {
      const draft = fixtureDraft({
        blocks: [
          { role: 'main', title: 'Main', movements: [{ movementId: 'squat', sets: [], note: '' }] },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
        ],
      });
      expect(draftHasAnyMovement(draft)).toBe(true);
    });
  });
});
