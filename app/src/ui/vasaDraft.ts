import type {
  BuildVasaLogInput,
  VasaBlockInput,
  VasaMovementInput,
  VasaSetInput,
} from '../domain/vasa/build';
import { regionForDate } from '../domain/vasa/region';
import type { BodyRegion, Movement, VasaStyle } from '../domain/types';

export type VasaBlockRole = 'main' | 'accessory' | 'finisher';

/** One set's editable weight/reps, kept as strings so number inputs round-trip cleanly. */
export interface VasaDraftSet {
  weight: string;
  reps: string;
}

/** One movement within a draft block: main/accessory carry `sets`, finisher carries `note`. */
export interface VasaDraftMovement {
  movementId: string;
  sets: VasaDraftSet[];
  note: string;
}

export interface VasaDraftBlock {
  role: VasaBlockRole;
  title: string;
  movements: VasaDraftMovement[];
}

/** SPEC 10.5: the in-progress `/vasa` screen state, persisted to localStorage on every change. */
export interface VasaDraft {
  date: string; // YYYY-MM-DD, local to the device
  region: BodyRegion;
  /** True once the user has tapped a region chip; suppresses re-defaulting on date change. */
  regionTouched: boolean;
  style?: VasaStyle;
  blocks: VasaDraftBlock[]; // always 4: main, accessory, accessory, finisher
  notes: string;
  rpe: string;
}

const VASA_DRAFT_KEY = 'workout_app.vasaDraft';

function isoDateOf(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * `regionForDate`, but for the draft's bare "YYYY-MM-DD" date string —
 * parsed as local noon (matches `domain/vasa/build.ts`'s `resolveIso`) so a
 * negative UTC offset never rolls the date to the wrong weekday.
 */
export function regionForDraftDate(date: string): BodyRegion {
  return regionForDate(new Date(`${date}T12:00:00`));
}

/**
 * SPEC 10.5: a fresh draft for opening `/vasa` with nothing restored — four
 * always-present blocks (Main, Accessory 1, Accessory 2, Finisher (2 min))
 * and a region defaulted from `now`'s weekday (SPEC 10.3 `regionForDate`).
 */
export function newVasaDraft(now: Date): VasaDraft {
  return {
    date: isoDateOf(now),
    region: regionForDate(now),
    regionTouched: false,
    style: undefined,
    blocks: [
      { role: 'main', title: 'Main', movements: [] },
      { role: 'accessory', title: 'Accessory 1', movements: [] },
      { role: 'accessory', title: 'Accessory 2', movements: [] },
      { role: 'finisher', title: 'Finisher (2 min)', movements: [] },
    ],
    notes: '',
    rpe: '',
  };
}

function isPlausibleVasaDraft(value: unknown): value is VasaDraft {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.date === 'string' &&
    typeof v.region === 'string' &&
    typeof v.regionTouched === 'boolean' &&
    Array.isArray(v.blocks) &&
    typeof v.notes === 'string' &&
    typeof v.rpe === 'string'
  );
}

/**
 * Reads the persisted `/vasa` draft (SPEC 10.5), same pattern as
 * `state/run.ts`'s run-session persistence. An old-date draft is still
 * returned as-is — the user may finish logging a class after the fact, and
 * the screen shows the draft's own date rather than forcing today's.
 */
export function readVasaDraft(): VasaDraft | null {
  try {
    const raw = localStorage.getItem(VASA_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlausibleVasaDraft(parsed)) return null;
    return parsed;
  } catch {
    return null; // localStorage unavailable (SSR/tests/private mode), or corrupt JSON
  }
}

/** Persists (or, for `null`, clears) the `/vasa` draft. */
export function writeVasaDraft(draft: VasaDraft | null): void {
  try {
    if (draft) localStorage.setItem(VASA_DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(VASA_DRAFT_KEY);
  } catch {
    // ignore: nothing we can do if storage is unavailable
  }
}

function numOrUndef(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Converts a `VasaDraft` into `buildVasaLog`'s input (SPEC 10.3/10.5).
 * Blank weight/reps/notes/rpe strings drop to `undefined`; finisher
 * movements carry their free-text note as `notes` with no sets. When
 * `movements` is given, draft entries referencing a movement id no longer
 * present in it (e.g. deleted since the draft was saved) are dropped rather
 * than passed through to `buildVasaLog`.
 */
export function draftToLogInput(draft: VasaDraft, movements?: Movement[]): BuildVasaLogInput {
  const known = movements ? new Set(movements.map((m) => m.id)) : null;

  const blocks: VasaBlockInput[] = draft.blocks.map((block) => ({
    role: block.role,
    title: block.title,
    movements: block.movements
      .filter((m) => known === null || known.has(m.movementId))
      .map((m): VasaMovementInput => {
        if (block.role === 'finisher') {
          return { movementId: m.movementId, sets: [], notes: m.note.trim() || undefined };
        }
        const sets: VasaSetInput[] = m.sets.map((s) => ({
          weight: numOrUndef(s.weight),
          reps: numOrUndef(s.reps),
        }));
        return { movementId: m.movementId, sets };
      }),
  }));

  return {
    date: draft.date,
    region: draft.region,
    style: draft.style,
    blocks,
    notes: draft.notes.trim() || undefined,
    rpe: numOrUndef(draft.rpe),
  };
}

/** SPEC 10.5: Save is enabled only once at least one block has a movement. */
export function draftHasAnyMovement(draft: VasaDraft): boolean {
  return draft.blocks.some((b) => b.movements.length > 0);
}
