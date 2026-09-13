import { slugify } from '../slug';
import type { BodyRegion, Equipment, Movement, MovementLibrary, Unit, VasaStyle } from '../types';

/** SPEC 10.3: `m.libraries`, defaulting an absent value to `['default']`. */
export function movementLibraries(m: Movement): MovementLibrary[] {
  return m.libraries ?? ['default'];
}

/** SPEC 10.3: whether `m` belongs to the given library. */
export function inLibrary(m: Movement, lib: MovementLibrary): boolean {
  return movementLibraries(m).includes(lib);
}

/** SPEC 10.3: adds `lib` to `m.libraries` without duplicating it. */
export function withLibrary(m: Movement, lib: MovementLibrary): Movement {
  const current = movementLibraries(m);
  if (current.includes(lib)) return m;
  return { ...m, libraries: [...current, lib] };
}

/** SPEC 10.3: equipment available at a Vasa studio class (the rack carries a pull-up bar). */
export const VASA_EQUIPMENT: Equipment[] = [
  'rack',
  'pullup_bar',
  'barbell',
  'kettlebell',
  'dumbbell',
  'band',
  'landmine',
  'bench',
  'plyo_box',
  'box',
  'none',
];

const VASA_EQUIPMENT_SET = new Set<Equipment>(VASA_EQUIPMENT);

/** SPEC 10.3: whether every piece of equipment `m` requires is available at Vasa. */
export function availableAtVasa(m: Movement): boolean {
  if (m.equipment.length === 0) return true;
  return m.equipment.every((e) => e === 'none' || VASA_EQUIPMENT_SET.has(e));
}

/** SPEC 10.1: Vasa's four training styles. */
export const VASA_STYLES: VasaStyle[] = ['build', 'pump', 'power', 'brawn'];

export const VASA_STYLE_LABELS: Record<VasaStyle, string> = {
  build: 'Build · strength',
  pump: 'Pump · hypertrophy',
  power: 'Power',
  brawn: 'Brawn · advanced strength',
};

export interface NewVasaMovementInput {
  name: string;
  region: BodyRegion;
  existingIds: string[];
  loadable?: boolean;
  equipment?: Equipment[];
  unit?: Unit;
  tags?: string[];
}

/** Makes `base` unique against `existingIds` by appending `_2`, `_3`, ... as needed. */
function uniqueId(base: string, existingIds: string[]): string {
  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/**
 * SPEC 10.3/10.7: builds a fresh Movement for the "Create <name>" flow in the
 * Vasa movement picker — added straight to the `vasa` library (the user
 * picked a region explicitly, so nothing needs to be inferred). `unit`
 * defaults to `'reps'` and `tags` to `[]`.
 */
export function newVasaMovement(input: NewVasaMovementInput): Movement {
  const id = uniqueId(slugify(input.name), input.existingIds);
  return {
    id,
    name: input.name,
    tags: input.tags ?? [],
    equipment: input.equipment ?? ['none'],
    cadenceDays: 3,
    unit: input.unit ?? 'reps',
    loadable: input.loadable ?? true,
    libraries: ['vasa'],
    region: input.region,
  };
}
