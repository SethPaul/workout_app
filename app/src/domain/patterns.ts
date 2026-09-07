import type { Block, Movement, PoolWorkout } from './types';

/**
 * Movement-pattern taxonomy used for the pattern-level cadence gate
 * (SPEC section 3, `app/seed/AUDIT.md` section C item C1). Mirrors
 * `app/seed/profile.py`'s `TAG_TO_PATTERN` / `ID_OVERRIDE_PATTERN` tables so
 * the two stay in agreement; if that mapping changes, mirror the change here.
 */
export type Pattern = 'squat' | 'hinge' | 'push' | 'pull' | 'olympic' | 'core' | 'cardio' | 'plyo';

/** Minimum days between two HEAVY performances of the same pattern. */
export const PATTERN_CADENCE_DAYS: Record<Pattern, number> = {
  squat: 2,
  hinge: 2,
  push: 2,
  pull: 2,
  olympic: 2,
  core: 0,
  cardio: 0,
  plyo: 1,
};

// Base rule: a movement tag maps directly to a pattern of the same name,
// plus two extensions (mirrors profile.py):
//   'legs'  -> 'squat' (no dedicated leg-day pattern in this 8-pattern taxonomy)
//   'carry' -> 'core'  (loaded-carry work is trunk-stability dominant)
const TAG_TO_PATTERN: Partial<Record<string, Pattern>> = {
  squat: 'squat',
  legs: 'squat',
  hinge: 'hinge',
  push: 'push',
  pull: 'pull',
  olympic: 'olympic',
  core: 'core',
  carry: 'core',
  cardio: 'cardio',
  plyo: 'plyo',
};

// By-movement-id overrides for movements whose tags don't resolve to any of
// the 8 patterns via TAG_TO_PATTERN (mirrors profile.py's ID_OVERRIDE_PATTERN).
const ID_OVERRIDE_PATTERN: Partial<Record<string, Pattern>> = {
  bar_complex: 'hinge',
  sandbag_drop: 'hinge',
  tire_flip: 'hinge',
  renegade_manmaker: 'pull',
  turkish_getup: 'core',
};

/** The pattern(s) a movement contributes to. */
export function movementPatterns(m: Movement): Pattern[] {
  const override = ID_OVERRIDE_PATTERN[m.id];
  if (override) return [override];
  const patterns = new Set<Pattern>();
  for (const tag of m.tags) {
    const pattern = TAG_TO_PATTERN[tag];
    if (pattern) patterns.add(pattern);
  }
  return [...patterns];
}

/**
 * Only HEAVY loading should trigger the pattern gate: a movement appearing
 * in a `strength` block, or in a block titled 'Power', or any olympic-tagged
 * barbell movement in any block.
 */
function isHeavyBlock(block: Block): boolean {
  return block.format === 'strength' || block.title === 'Power';
}

function isOlympicBarbell(m: Movement): boolean {
  return m.tags.includes('olympic') && m.equipment.includes('barbell');
}

/** The distinct Movements within `workout` that count as HEAVY loading. */
export function heavyMovementsInWorkout(
  workout: PoolWorkout,
  movementById: Map<string, Movement>,
): Movement[] {
  const seen = new Set<string>();
  const heavy: Movement[] = [];
  for (const block of workout.blocks) {
    const blockIsHeavy = isHeavyBlock(block);
    for (const bm of block.movements) {
      const movement = movementById.get(bm.movementId);
      if (!movement) continue;
      if (seen.has(movement.id)) continue;
      if (blockIsHeavy || isOlympicBarbell(movement)) {
        seen.add(movement.id);
        heavy.push(movement);
      }
    }
  }
  return heavy;
}
