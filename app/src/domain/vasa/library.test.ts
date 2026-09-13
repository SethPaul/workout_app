import { describe, it, expect } from 'vitest';
import {
  movementLibraries,
  inLibrary,
  withLibrary,
  VASA_EQUIPMENT,
  availableAtVasa,
  VASA_STYLES,
  VASA_STYLE_LABELS,
  newVasaMovement,
} from './library';
import type { Movement } from '../types';

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'm',
    name: 'M',
    tags: [],
    equipment: [],
    cadenceDays: 3,
    unit: 'reps',
    loadable: true,
    ...overrides,
  };
}

describe('movementLibraries / inLibrary', () => {
  it('an absent libraries field reads as ["default"]', () => {
    expect(movementLibraries(movement())).toEqual(['default']);
    expect(inLibrary(movement(), 'default')).toBe(true);
    expect(inLibrary(movement(), 'vasa')).toBe(false);
  });

  it('reflects an explicit libraries array', () => {
    const m = movement({ libraries: ['vasa'] });
    expect(movementLibraries(m)).toEqual(['vasa']);
    expect(inLibrary(m, 'vasa')).toBe(true);
    expect(inLibrary(m, 'default')).toBe(false);
  });

  it('a movement can be in both libraries', () => {
    const m = movement({ libraries: ['default', 'vasa'] });
    expect(inLibrary(m, 'default')).toBe(true);
    expect(inLibrary(m, 'vasa')).toBe(true);
  });
});

describe('withLibrary', () => {
  it('adds a library to a movement with none set', () => {
    const m = withLibrary(movement(), 'vasa');
    expect(m.libraries).toEqual(['default', 'vasa']);
  });

  it('adds a library alongside an existing one', () => {
    const m = withLibrary(movement({ libraries: ['default'] }), 'vasa');
    expect(m.libraries).toEqual(['default', 'vasa']);
  });

  it('does not duplicate a library the movement already has', () => {
    const original = movement({ libraries: ['vasa'] });
    const m = withLibrary(original, 'vasa');
    expect(m.libraries).toEqual(['vasa']);
    expect(m).toBe(original); // unchanged: same reference
  });
});

describe('VASA_EQUIPMENT / availableAtVasa', () => {
  it('lists exactly the studio equipment (SPEC 10.3)', () => {
    expect(VASA_EQUIPMENT).toEqual([
      'rack',
      'barbell',
      'kettlebell',
      'dumbbell',
      'band',
      'landmine',
      'bench',
      'plyo_box',
      'box',
      'none',
    ]);
  });

  it('a movement using only Vasa equipment is available', () => {
    expect(availableAtVasa(movement({ equipment: ['barbell', 'bench'] }))).toBe(true);
  });

  it('a movement requiring equipment absent from the studio is unavailable', () => {
    expect(availableAtVasa(movement({ equipment: ['rower'] }))).toBe(false);
    expect(availableAtVasa(movement({ equipment: ['barbell', 'cable'] }))).toBe(false);
  });

  it('no equipment or ["none"] is always available', () => {
    expect(availableAtVasa(movement({ equipment: [] }))).toBe(true);
    expect(availableAtVasa(movement({ equipment: ['none'] }))).toBe(true);
  });
});

describe('VASA_STYLES / VASA_STYLE_LABELS', () => {
  it('lists the four training styles with labels', () => {
    expect(VASA_STYLES).toEqual(['build', 'pump', 'power', 'brawn']);
    expect(VASA_STYLE_LABELS.build).toMatch(/build/i);
    expect(VASA_STYLE_LABELS.pump).toMatch(/pump/i);
    expect(VASA_STYLE_LABELS.power).toMatch(/power/i);
    expect(VASA_STYLE_LABELS.brawn).toMatch(/brawn/i);
  });
});

describe('newVasaMovement', () => {
  it('builds a movement with the SPEC 10.3 defaults', () => {
    const m = newVasaMovement({ name: 'Band Tricep Extension', region: 'upper', existingIds: [] });
    expect(m.id).toBe('band_tricep_extension');
    expect(m.name).toBe('Band Tricep Extension');
    expect(m.tags).toEqual([]);
    expect(m.equipment).toEqual(['none']);
    expect(m.cadenceDays).toBe(3);
    expect(m.unit).toBe('reps');
    expect(m.loadable).toBe(true);
    expect(m.libraries).toEqual(['vasa']);
    expect(m.region).toBe('upper');
  });

  it('honors an explicit equipment/loadable override', () => {
    const m = newVasaMovement({
      name: 'Hip Thrust',
      region: 'lower',
      existingIds: [],
      loadable: false,
      equipment: ['barbell', 'bench'],
    });
    expect(m.equipment).toEqual(['barbell', 'bench']);
    expect(m.loadable).toBe(false);
  });

  it('appends _2, _3, ... to make the id unique against existingIds', () => {
    const first = newVasaMovement({ name: 'Curl', region: 'upper', existingIds: ['curl'] });
    expect(first.id).toBe('curl_2');
    const second = newVasaMovement({
      name: 'Curl',
      region: 'upper',
      existingIds: ['curl', 'curl_2'],
    });
    expect(second.id).toBe('curl_3');
  });
});
