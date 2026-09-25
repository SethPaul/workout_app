import { describe, it, expect } from 'vitest';
import { buildSeedState, catchUpSeed, loadSeedData, ALL_EQUIPMENT, defaultSettings } from './seed';
import { SEED_REVISION, seedRevisionOf } from '../domain/seedRevision';
import { VASA_SEED_MOVEMENTS } from '../domain/vasa/seedMovements';

describe('buildSeedState', () => {
  it('never throws, even when seed/*.json is missing or empty', async () => {
    const state = await buildSeedState();
    expect(Array.isArray(state.movements)).toBe(true);
    expect(Array.isArray(state.pool)).toBe(true);
    expect(state.logs).toEqual([]);
    expect(state.schemaVersion).toBe(3);
  });

  it('includes VASA_SEED_MOVEMENTS (SPEC 10.2), deduped by id against movements.json', async () => {
    const state = await buildSeedState();
    const ids = state.movements.map((m) => m.id);
    for (const seedMovement of VASA_SEED_MOVEMENTS) {
      expect(ids).toContain(seedMovement.id);
    }
    // No id appears twice, whether or not movements.json happens to define it.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defaults settings.availableEquipment to every Equipment value', async () => {
    const state = await buildSeedState();
    expect(state.settings.availableEquipment).toEqual(ALL_EQUIPMENT);
    expect(state.settings.availableEquipment).toContain('band');
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

describe('seed revisions (SPEC section 8)', () => {
  it('stamps a fresh seed state with the shipped SEED_REVISION', async () => {
    const state = await buildSeedState();
    expect(state.seedRevision).toBe(SEED_REVISION);
  });

  it('ships at least one workout for every revision up to SEED_REVISION', async () => {
    const { pool } = await loadSeedData();
    for (let r = 1; r <= SEED_REVISION; r++) {
      expect(pool.some((w) => seedRevisionOf(w) === r)).toBe(true);
    }
  });

  it('ships no workout tagged beyond SEED_REVISION', async () => {
    const { pool } = await loadSeedData();
    expect(pool.filter((w) => seedRevisionOf(w) > SEED_REVISION)).toEqual([]);
  });

  it('catchUpSeed returns a current state by identity and upgrades an old one', async () => {
    const current = { ...(await buildSeedState()), pool: [], movements: [] };
    expect(await catchUpSeed(current)).toBe(current);

    const old = { ...current, seedRevision: undefined };
    const caughtUp = await catchUpSeed(old);
    expect(caughtUp.seedRevision).toBe(SEED_REVISION);
    expect(caughtUp.pool.length).toBeGreaterThan(0);
    expect(caughtUp.pool.every((w) => seedRevisionOf(w) > 1)).toBe(true);
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
