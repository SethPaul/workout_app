import { get, set } from 'idb-keyval';
import { migrate } from '../domain/migrate';
import type { AppState } from '../domain/types';
import type { Storage } from './storage';

const APP_STATE_KEY = 'appState';

/** idb-keyval backed Storage: the whole AppState lives under one key. */
export class IdbStorage implements Storage {
  async load(): Promise<AppState | null> {
    const value = await get<AppState>(APP_STATE_KEY);
    if (!value) return null;
    // Upgrade legacy (or partially-upgraded) state on read, and persist the
    // upgrade once so `program.cycleStartedAt` etc. don't keep recomputing
    // against a moving `now` on every subsequent load (SPEC 9.1 migration).
    const migrated = migrate(value);
    if (migrated !== value) await set(APP_STATE_KEY, migrated);
    return migrated;
  }

  async save(state: AppState): Promise<void> {
    await set(APP_STATE_KEY, state);
  }
}
