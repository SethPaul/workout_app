import type { BuildEnteredWorkoutInput, EnteredBlock, EnteredMovement } from '../domain/vasa/pool';
import { regionForDate } from '../domain/vasa/region';
import type { BodyRegion, Movement, VasaStyle } from '../domain/types';

export type EnterBlockRole = 'main' | 'accessory' | 'finisher';

/** One movement within a draft block, kept as strings so number inputs round-trip cleanly. */
export interface EnterDraftMovement {
  movementId: string;
  sets: string;
  reps: string;
  seconds: string;
}

export interface EnterDraftBlock {
  role: EnterBlockRole;
  title: string;
  movements: EnterDraftMovement[];
}

/** SPEC 10.8 item 3: the `/enter` composer's in-progress state, persisted to localStorage on every change. */
export interface EnterDraft {
  name: string;
  date: string; // YYYY-MM-DD, local to the device
  region: BodyRegion;
  /** True once the user has tapped a region chip; suppresses re-defaulting on date change. */
  regionTouched: boolean;
  style?: VasaStyle;
  blocks: EnterDraftBlock[]; // always 4: main, accessory, accessory, finisher
  notes: string;
}

const ENTER_DRAFT_KEY = 'workout_app.enterDraft';

function isoDateOf(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * `regionForDate`, but for the draft's bare "YYYY-MM-DD" date string —
 * parsed as local noon (matches `domain/vasa/pool.ts`'s date handling) so a
 * negative UTC offset never rolls the date to the wrong weekday.
 */
export function regionForDraftDate(date: string): BodyRegion {
  return regionForDate(new Date(`${date}T12:00:00`));
}

/**
 * SPEC 10.8 item 3: a fresh draft for opening `/enter`'s composer with
 * nothing restored — four always-present blocks (Main, Accessory 1,
 * Accessory 2, Finisher (2 min)) and a region defaulted from `now`'s weekday.
 */
export function newEnterDraft(now: Date): EnterDraft {
  return {
    name: '',
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
  };
}

function isPlausibleEnterDraft(value: unknown): value is EnterDraft {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    typeof v.date === 'string' &&
    typeof v.region === 'string' &&
    typeof v.regionTouched === 'boolean' &&
    Array.isArray(v.blocks) &&
    typeof v.notes === 'string'
  );
}

/** Reads the persisted `/enter` draft, same pattern as `state/run.ts`'s run-session persistence. */
export function readEnterDraft(): EnterDraft | null {
  try {
    const raw = localStorage.getItem(ENTER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlausibleEnterDraft(parsed)) return null;
    return parsed;
  } catch {
    return null; // localStorage unavailable (SSR/tests/private mode), or corrupt JSON
  }
}

/** Persists (or, for `null`, clears) the `/enter` draft. */
export function writeEnterDraft(draft: EnterDraft | null): void {
  try {
    if (draft) localStorage.setItem(ENTER_DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(ENTER_DRAFT_KEY);
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
 * Converts an `EnterDraft` into `buildEnteredWorkout`'s input (SPEC 10.8).
 * Blank sets/reps/seconds/notes/name strings drop to `undefined`; finisher
 * movements carry only `seconds`, main/accessory only `sets`/`reps`. When
 * `movements` is given, draft entries referencing a movement id no longer
 * present in it (e.g. deleted since the draft was saved) are dropped rather
 * than passed through to `buildEnteredWorkout`.
 */
export function draftToWorkoutInput(
  draft: EnterDraft,
  movements?: Movement[],
): BuildEnteredWorkoutInput {
  const known = movements ? new Set(movements.map((m) => m.id)) : null;

  const blocks: EnteredBlock[] = draft.blocks.map((block) => ({
    role: block.role,
    title: block.title,
    movements: block.movements
      .filter((m) => known === null || known.has(m.movementId))
      .map((m): EnteredMovement => {
        if (block.role === 'finisher') {
          return { movementId: m.movementId, seconds: numOrUndef(m.seconds) };
        }
        return {
          movementId: m.movementId,
          sets: numOrUndef(m.sets),
          reps: numOrUndef(m.reps),
        };
      }),
  }));

  return {
    name: draft.name.trim() || undefined,
    date: draft.date,
    region: draft.region,
    style: draft.style,
    blocks,
    notes: draft.notes.trim() || undefined,
  };
}

/** SPEC 10.8 item 4: Save & start / Save to pool are enabled only once at least one block has a movement. */
export function draftHasAnyMovement(draft: EnterDraft): boolean {
  return draft.blocks.some((b) => b.movements.length > 0);
}
