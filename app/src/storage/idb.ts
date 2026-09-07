import { get, set } from 'idb-keyval';
import type { AppState } from '../domain/types';
import type { Storage } from './storage';

const APP_STATE_KEY = 'appState';

/** idb-keyval backed Storage: the whole AppState lives under one key. */
export class IdbStorage implements Storage {
  async load(): Promise<AppState | null> {
    const value = await get<AppState>(APP_STATE_KEY);
    return value ?? null;
  }

  async save(state: AppState): Promise<void> {
    await set(APP_STATE_KEY, state);
  }
}
