import type { AppState, Block, BlockMovement, Equipment, Format, Movement } from '../domain/types';

/** Formats a millisecond duration as clock time — "M:SS" or "H:MM:SS". */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function movementById(state: AppState, id: string): Movement | undefined {
  return state.movements.find((m) => m.id === id);
}

export function movementName(state: AppState, id: string): string {
  return movementById(state, id)?.name ?? id;
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  kettlebell: 'Kettlebell',
  dumbbell: 'Dumbbell',
  rack: 'Squat Rack',
  bench: 'Bench',
  pullup_bar: 'Pull-up Bar',
  rings: 'Rings',
  rower: 'Rower',
  bike: 'Bike',
  box: 'Box',
  jump_rope: 'Jump Rope',
  medball: 'Medicine Ball',
  wall: 'Wall (space)',
  sandbag: 'Sandbag',
  sled: 'Sled',
  ghd: 'GHD',
  ab_wheel: 'Ab Wheel',
  trx: 'TRX / Suspension',
  cable: 'Cable Machine',
  landmine: 'Landmine',
  plyo_box: 'Plyo Box',
  none: 'No equipment',
};

export const INTENSITY_LABELS: Record<'H' | 'M' | 'L', string> = {
  H: 'High',
  M: 'Medium',
  L: 'Low',
};

export function formatDueIn(days: number | null): string {
  if (days === null) return 'never done';
  if (days <= 0) return 'due now';
  return `due in ${days} day${days === 1 ? '' : 's'}`;
}

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const FORMAT_LABELS: Record<Format, string> = {
  strength: 'Strength',
  emom: 'EMOM',
  tabata: 'Tabata',
  interval: 'Interval',
  amrap: 'AMRAP',
  rounds: 'Rounds',
  chipper: 'Chipper',
  death_by: 'Death By',
};

/** One human-readable line describing a single movement's target within a block. */
export function movementLine(state: AppState, bm: BlockMovement): string {
  const name = movementName(state, bm.movementId);
  const parts: string[] = [];
  if (bm.repScheme && bm.repScheme.length > 0) parts.push(bm.repScheme.join('-'));
  else if (bm.reps !== undefined) parts.push(`${bm.reps} reps`);
  if (bm.distanceM !== undefined) parts.push(`${bm.distanceM} m`);
  if (bm.calories !== undefined) parts.push(`${bm.calories} cal`);
  if (bm.seconds !== undefined) parts.push(`${bm.seconds}s`);
  if (bm.loadNote) parts.push(bm.loadNote);
  return parts.length > 0 ? `${name} — ${parts.join(', ')}` : name;
}

/** One human-readable line summarising a block's scheme (sets/rounds/timing). */
export function blockMetaLine(block: Block): string {
  switch (block.format) {
    case 'strength':
      return `${block.sets ?? 1} sets${block.restSec ? `, ${block.restSec}s rest` : ''}`;
    case 'emom':
      return `${block.rounds ?? 1} rounds x ${block.intervalSec ?? 60}s`;
    case 'tabata':
      return `${block.rounds ?? 8} rounds, ${block.workSec ?? 20}s on / ${block.restSec ?? 10}s off`;
    case 'interval':
      return `${block.rounds ?? 1} x (${block.workSec ?? 30}s on / ${block.restSec ?? 30}s off)`;
    case 'amrap':
      return `${Math.round((block.durationSec ?? 600) / 60)} min AMRAP`;
    case 'rounds':
      return `${block.rounds ? `${block.rounds} rounds` : 'Rounds'} for time${block.timeCapSec ? `, cap ${Math.round(block.timeCapSec / 60)} min` : ''}`;
    case 'chipper':
      return `For time${block.timeCapSec ? `, cap ${Math.round(block.timeCapSec / 60)} min` : ''}`;
    case 'death_by':
      return 'Death by (1 rep/min, +1 each minute)';
  }
}

export function uid(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rand}`;
}
