import type { AppState, Equipment, Movement, PoolWorkout, Settings } from '../domain/types';

export const ALL_EQUIPMENT: Equipment[] = [
  'barbell',
  'kettlebell',
  'dumbbell',
  'rack',
  'bench',
  'pullup_bar',
  'rings',
  'rower',
  'bike',
  'box',
  'jump_rope',
  'medball',
  'wall',
  'sandbag',
  'sled',
  'ghd',
  'ab_wheel',
  'trx',
  'cable',
  'landmine',
  'plyo_box',
  'none',
];

export function defaultSettings(): Settings {
  return {
    availableEquipment: [...ALL_EQUIPMENT],
    soundOn: true,
    vibrateOn: true,
    keepScreenOn: true,
  };
}

// The seed/ directory is populated by a separate workstream and may not
// exist (or may be empty) when this app is built. A plain literal
// `import('../../seed/movements.json')` would make Vite/Rollup fail the
// *build* outright if the file is missing (unlike a runtime try/catch,
// which only guards against a *runtime* rejection) - the bundler needs to
// statically resolve dynamic import specifiers at build time. `import.meta
// .glob` sidesteps that: it globs the directory at build time and simply
// yields no entries when nothing matches, so the build always succeeds
// regardless of whether seed data exists yet. Each matched entry is itself
// a `() => import(...)` loader, so the actual JSON is still fetched via a
// dynamic import, lazily, the first time buildSeedState() runs.
const seedModules = import.meta.glob('../../seed/*.json');

async function loadSeedArray<T>(filename: string): Promise<T[]> {
  const key = Object.keys(seedModules).find((k) => k.endsWith(`/${filename}`));
  if (!key) return [];
  try {
    const mod = (await seedModules[key]()) as { default?: unknown };
    const data = mod.default ?? mod;
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Builds the first-run AppState from app/seed/*.json. Missing, empty, or
 * malformed seed files simply yield empty arrays rather than throwing -
 * the app should still boot (with an empty pool/movement list) if seed
 * data isn't available yet.
 */
export async function buildSeedState(): Promise<AppState> {
  const [movements, pool] = await Promise.all([
    loadSeedArray<Movement>('movements.json'),
    loadSeedArray<PoolWorkout>('pool.json'),
  ]);
  return {
    movements,
    pool,
    logs: [],
    settings: defaultSettings(),
    schemaVersion: 1,
  };
}
