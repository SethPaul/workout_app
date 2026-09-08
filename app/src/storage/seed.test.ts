import { describe, it, expect } from 'vitest';
import { buildSeedState, ALL_EQUIPMENT, defaultSettings } from './seed';

describe('buildSeedState', () => {
  it('never throws, even when seed/*.json is missing or empty', async () => {
    const state = await buildSeedState();
    expect(Array.isArray(state.movements)).toBe(true);
    expect(Array.isArray(state.pool)).toBe(true);
    expect(state.logs).toEqual([]);
    expect(state.schemaVersion).toBe(2);
  });

  it('defaults settings.availableEquipment to every Equipment value', async () => {
    const state = await buildSeedState();
    expect(state.settings.availableEquipment).toEqual(ALL_EQUIPMENT);
  });

  it('includes a fresh ProgramState (SPEC 9.1)', async () => {
    const state = await buildSeedState();
    expect(state.program?.cycleStartedAt).toBeTruthy();
    expect(state.program?.dismissedFlags).toEqual([]);
  });
});

describe('defaultSettings', () => {
  it('turns sound, vibrate and keep-screen-on by default', () => {
    const s = defaultSettings();
    expect(s.soundOn).toBe(true);
    expect(s.vibrateOn).toBe(true);
    expect(s.keepScreenOn).toBe(true);
    expect(s.availableEquipment).toEqual(ALL_EQUIPMENT);
  });

  it('defaults the programming-layer settings (SPEC 9.1)', () => {
    const s = defaultSettings();
    expect(s.units).toBe('lb');
    expect(s.deloadPolicy).toBe('fatigue');
    expect(s.cycleWeeks).toBe(4);
    expect(s.focus).toBe('balanced');
    expect(s.masters).toBe(false);
  });
});

describe('seed data integrity (SPEC section 8)', () => {
  it('every movementId referenced in pool.json exists in movements.json', async () => {
    const state = await buildSeedState();
    const movementIds = new Set(state.movements.map((m) => m.id));
    const missing: string[] = [];
    for (const workout of state.pool) {
      for (const block of workout.blocks) {
        for (const m of block.movements) {
          if (!movementIds.has(m.movementId)) missing.push(`${workout.id} -> ${m.movementId}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
