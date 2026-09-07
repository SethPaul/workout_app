import { describe, it, expect, beforeEach } from 'vitest';
import type { AppState } from '../domain/types';
import type { Storage } from '../storage/storage';
import {
  bumpTodayWorkout,
  clearTodayWorkout,
  currentTodayWorkout,
  init,
  setStorage,
  setTodayWorkout,
  state,
  update,
} from './store';

class MemoryStorage implements Storage {
  saved: AppState | null = null;
  async load(): Promise<AppState | null> {
    return this.saved;
  }
  async save(next: AppState): Promise<void> {
    this.saved = next;
  }
}

function emptyState(): AppState {
  return {
    movements: [],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 1,
  };
}

beforeEach(() => {
  clearTodayWorkout();
});

describe('init / update', () => {
  it('seeds AppState from app/seed/*.json when storage has nothing', async () => {
    // Deliberately does not assert on the exact seed content: seed/*.json is
    // owned by a separate workstream and may be empty or populated. Only
    // the shape/integrity contract from buildSeedState() is asserted here
    // (see storage/seed.test.ts for the "missing seed" guarantee).
    setStorage(new MemoryStorage());
    await init();
    expect(state.value).not.toBeNull();
    expect(Array.isArray(state.value?.movements)).toBe(true);
    expect(Array.isArray(state.value?.pool)).toBe(true);
    expect(state.value?.logs).toEqual([]);
    expect(state.value?.schemaVersion).toBe(1);
  });

  it('loads existing state from storage instead of seeding', async () => {
    const storage = new MemoryStorage();
    storage.saved = emptyState();
    storage.saved.movements.push({
      id: 'squat',
      name: 'Squat',
      tags: [],
      equipment: [],
      cadenceDays: 7,
      unit: 'reps',
      loadable: true,
    });
    setStorage(storage);
    await init();
    expect(state.value?.movements).toHaveLength(1);
  });

  it('update() writes through to storage', async () => {
    const storage = new MemoryStorage();
    setStorage(storage);
    await init();
    await update((s) => ({ ...s, logs: [...s.logs] }));
    await update((s) => ({
      ...s,
      settings: { ...s.settings, soundOn: false },
    }));
    expect(state.value?.settings.soundOn).toBe(false);
    expect(storage.saved?.settings.soundOn).toBe(false);
  });
});

describe('todayDateString (via setTodayWorkout)', () => {
  it('uses the local calendar date, not the UTC date, for a 16:30 local timestamp', () => {
    // Constructed with local-time components (not an ISO string), so this
    // pins the local date regardless of host TZ.
    const now = new Date(2024, 5, 20, 16, 30); // June 20 2024, 16:30 local
    setTodayWorkout('w1', now);
    expect(currentTodayWorkout(now)?.date).toBe('2024-06-20');
  });
});

describe('today workout', () => {
  it('returns null when nothing has been set', () => {
    expect(currentTodayWorkout(new Date('2024-01-01T12:00:00Z'))).toBeNull();
  });

  it('remembers the pulled workout for the same day', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    setTodayWorkout('w1', now);
    expect(currentTodayWorkout(now)?.workoutId).toBe('w1');
  });

  it('bump adds the workout to excluded and clears the pick', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    setTodayWorkout('w1', now);
    bumpTodayWorkout(now);
    const today = currentTodayWorkout(now);
    expect(today?.workoutId).toBeNull();
    expect(today?.excluded).toEqual(['w1']);
  });

  it('exclusions reset once the date changes', () => {
    const day1 = new Date('2024-01-01T12:00:00Z');
    const day2 = new Date('2024-01-02T12:00:00Z');
    setTodayWorkout('w1', day1);
    bumpTodayWorkout(day1);
    expect(currentTodayWorkout(day2)).toBeNull(); // stale entry from a previous day
    setTodayWorkout('w2', day2);
    expect(currentTodayWorkout(day2)?.excluded).toEqual([]);
  });
});
