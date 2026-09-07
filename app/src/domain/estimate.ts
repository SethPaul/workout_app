import type { Block } from './types';

const DEFAULT_SET_WORK_SEC = 30; // rough time to perform one strength set
const DEFAULT_ROUNDS_ROUND_SEC = 90; // rough time per round when a rounds/chipper block is unbounded
const DEFAULT_CHIPPER_MOVEMENT_SEC = 60;
const DEFAULT_DEATH_BY_MINUTES = 8; // rough guess at how long a death-by block runs before failure

/** Rough estimated seconds for a single block, used when the format has no explicit duration. */
export function estimateBlockSeconds(block: Block): number {
  switch (block.format) {
    case 'strength': {
      const sets = block.sets ?? 1;
      const restSec = block.restSec ?? 60;
      return sets * DEFAULT_SET_WORK_SEC + Math.max(0, sets - 1) * restSec;
    }
    case 'emom': {
      const rounds = block.rounds ?? 1;
      const intervalSec = block.intervalSec ?? 60;
      return rounds * intervalSec;
    }
    case 'tabata': {
      const rounds = block.rounds ?? 8;
      const workSec = block.workSec ?? 20;
      const restSec = block.restSec ?? 10;
      const movementCount = Math.max(1, block.movements.length);
      return movementCount * rounds * (workSec + restSec);
    }
    case 'interval': {
      const rounds = block.rounds ?? 1;
      const workSec = block.workSec ?? 30;
      const restSec = block.restSec ?? 30;
      return rounds * (workSec + restSec);
    }
    case 'amrap':
      return block.durationSec ?? 600;
    case 'rounds': {
      if (block.timeCapSec) return block.timeCapSec;
      const rounds = block.rounds ?? 5;
      return rounds * DEFAULT_ROUNDS_ROUND_SEC;
    }
    case 'chipper': {
      if (block.timeCapSec) return block.timeCapSec;
      return Math.max(1, block.movements.length) * DEFAULT_CHIPPER_MOVEMENT_SEC;
    }
    case 'death_by':
      return DEFAULT_DEATH_BY_MINUTES * 60;
  }
}

/** Rough estimated total duration (seconds) for a workout's blocks — for display only. */
export function estimateWorkoutSeconds(blocks: Block[]): number {
  return blocks.reduce((sum, b) => sum + estimateBlockSeconds(b), 0);
}

/** Formats a seconds duration as e.g. "45 min" or "1h 05m". */
export function formatDurationMin(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}
