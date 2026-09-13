import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  draftHasAnyMovement,
  draftToWorkoutInput,
  newEnterDraft,
  readEnterDraft,
  regionForDraftDate,
  writeEnterDraft,
  type EnterDraft,
} from './enterDraft';
import type { Movement } from '../domain/types';

function fixtureDraft(overrides: Partial<EnterDraft> = {}): EnterDraft {
  return { ...newEnterDraft(new Date('2024-01-16T12:00:00')), ...overrides }; // Tue -> lower
}

describe('enterDraft (SPEC 10.8)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('newEnterDraft', () => {
    it('defaults region by weekday via regionForDate', () => {
      expect(newEnterDraft(new Date('2024-01-16T12:00:00')).region).toBe('lower'); // Tuesday
      expect(newEnterDraft(new Date('2024-01-17T12:00:00')).region).toBe('upper'); // Wednesday
      expect(newEnterDraft(new Date('2024-01-19T12:00:00')).region).toBe('full'); // Friday
    });

    it('creates four blocks: Main, Accessory 1, Accessory 2, Finisher (2 min)', () => {
      const draft = newEnterDraft(new Date('2024-01-16T12:00:00'));
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
      expect(draft.name).toBe('');
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
      expect(readEnterDraft()).toBeNull();
    });

    it('writes and reads back an identical draft', () => {
      const draft = fixtureDraft({
        name: 'Tuesday Lower',
        blocks: [
          {
            role: 'main',
            title: 'Main',
            movements: [{ movementId: 'squat', sets: '5', reps: '5', seconds: '' }],
          },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
        ],
      });
      writeEnterDraft(draft);
      expect(readEnterDraft()).toEqual(draft);
    });

    it('clears the stored draft when written null', () => {
      writeEnterDraft(fixtureDraft());
      writeEnterDraft(null);
      expect(readEnterDraft()).toBeNull();
    });

    it('returns null for corrupt JSON rather than throwing', () => {
      localStorage.setItem('workout_app.enterDraft', '{not json');
      expect(readEnterDraft()).toBeNull();
    });

    it('returns null for a plausible-looking but wrong-shaped value', () => {
      localStorage.setItem('workout_app.enterDraft', JSON.stringify({ foo: 'bar' }));
      expect(readEnterDraft()).toBeNull();
    });
  });

  describe('draftToWorkoutInput', () => {
    it('drops empty sets/reps/seconds/notes/name strings to undefined', () => {
      const draft = fixtureDraft({
        name: '   ',
        notes: '   ',
        blocks: [
          {
            role: 'main',
            title: 'Main',
            movements: [{ movementId: 'squat', sets: '', reps: '', seconds: '' }],
          },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
        ],
      });
      const input = draftToWorkoutInput(draft);
      expect(input.name).toBeUndefined();
      expect(input.notes).toBeUndefined();
      expect(input.blocks[0].movements[0]).toEqual({
        movementId: 'squat',
        sets: undefined,
        reps: undefined,
      });
    });

    it('parses numeric sets/reps for main/accessory rows', () => {
      const draft = fixtureDraft({
        name: 'Deadlift day',
        notes: 'Felt strong',
        blocks: [
          {
            role: 'main',
            title: 'Main',
            movements: [{ movementId: 'squat', sets: '5', reps: '5', seconds: '' }],
          },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
        ],
      });
      const input = draftToWorkoutInput(draft);
      expect(input.name).toBe('Deadlift day');
      expect(input.notes).toBe('Felt strong');
      expect(input.blocks[0].movements[0]).toEqual({ movementId: 'squat', sets: 5, reps: 5 });
    });

    it('carries a finisher row through with only `seconds`', () => {
      const draft = fixtureDraft({
        blocks: [
          { role: 'main', title: 'Main', movements: [] },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          {
            role: 'finisher',
            title: 'Finisher (2 min)',
            movements: [{ movementId: 'plank', sets: '', reps: '', seconds: '45' }],
          },
        ],
      });
      const input = draftToWorkoutInput(draft);
      expect(input.blocks[3].movements[0]).toEqual({ movementId: 'plank', seconds: 45 });
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
              { movementId: 'squat', sets: '5', reps: '5', seconds: '' },
              { movementId: 'deleted_movement', sets: '3', reps: '10', seconds: '' },
            ],
          },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
        ],
      });
      const input = draftToWorkoutInput(draft, movements);
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
          {
            role: 'main',
            title: 'Main',
            movements: [{ movementId: 'squat', sets: '', reps: '', seconds: '' }],
          },
          { role: 'accessory', title: 'Accessory 1', movements: [] },
          { role: 'accessory', title: 'Accessory 2', movements: [] },
          { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
        ],
      });
      expect(draftHasAnyMovement(draft)).toBe(true);
    });
  });
});
