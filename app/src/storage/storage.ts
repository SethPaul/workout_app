import type { AppState } from '../domain/types';

/**
 * Storage abstraction so a remote backend can be swapped in later without
 * touching the rest of the app.
 */
export interface Storage {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
}
