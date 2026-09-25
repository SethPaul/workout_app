import type { AppState, Movement, PoolWorkout } from './types';

/**
 * SPEC section 8 (seed revisions). The revision of the seed shipped in
 * `app/seed/*.json`. Bump it when a batch of new seed workouts lands, and
 * tag every workout in that batch `seed:v<N>`; `store.init` then appends the
 * batch to installs that predate it (see `mergeSeedRevision`).
 */
export const SEED_REVISION = 2;

const TAG_PREFIX = 'seed:v';

export interface SeedData {
  movements: Movement[];
  pool: PoolWorkout[];
}

/**
 * The seed revision a pool workout belongs to: its `seed:vN` tag, or 1 for
 * the original, untagged seed.
 */
export function seedRevisionOf(workout: PoolWorkout): number {
  const tag = (workout.tags ?? []).find((t) => t.startsWith(TAG_PREFIX));
  if (!tag) return 1;
  const n = Number(tag.slice(TAG_PREFIX.length));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * Brings a stored state up to `revision`: appends every seed workout whose
 * revision is newer than the state's own (`seedRevision`, absent = 1) and
 * whose id the state doesn't already hold, plus any movement those workouts
 * reference that the state lacks. Workouts from a revision the state has
 * already seen are never re-added, so a seed workout the user deleted stays
 * deleted. Existing entries are never modified. Returns `state` by identity
 * when it is already at or past `revision`.
 */
export function mergeSeedRevision(
  state: AppState,
  seed: SeedData,
  revision: number = SEED_REVISION,
): AppState {
  const current = state.seedRevision ?? 1;
  if (current >= revision) return state;

  const poolIds = new Set(state.pool.map((w) => w.id));
  const newWorkouts = seed.pool.filter((w) => {
    const r = seedRevisionOf(w);
    return r > current && r <= revision && !poolIds.has(w.id);
  });

  const movementIds = new Set(state.movements.map((m) => m.id));
  const referenced = new Set(
    newWorkouts.flatMap((w) => w.blocks.flatMap((b) => b.movements.map((m) => m.movementId))),
  );
  const newMovements = seed.movements.filter((m) => referenced.has(m.id) && !movementIds.has(m.id));

  return {
    ...state,
    movements: newMovements.length === 0 ? state.movements : [...state.movements, ...newMovements],
    pool: newWorkouts.length === 0 ? state.pool : [...state.pool, ...newWorkouts],
    seedRevision: revision,
  };
}
