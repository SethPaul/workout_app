import type { Block, BlockMovement, Format } from './types';

export type CueType = 'beep' | 'bell' | 'countdown';

/**
 * `at` carries the millisecond marker the cue fired at — remaining-ms for a
 * countdown-style cue (10000 for the "10s remaining" ping, 3000/2000/1000 for
 * the 3-2-1 ticks, or the phase's full duration for a start beep/bell), or
 * elapsed-ms for a stopwatch time-cap bell. It lets the audio layer tell cues
 * of the same `type` apart without growing the type union.
 */
export interface Cue {
  type: CueType;
  at: number;
}

export type PhaseKind = 'work' | 'rest' | 'countdown' | 'stopwatch';

export interface Phase {
  kind: PhaseKind;
  label: string;
  movementIds: string[];
  repsDue?: number;
  remainingMs?: number;
  elapsedMs: number;
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'between-blocks' | 'finished';

interface InternalPhase {
  kind: PhaseKind;
  label: string;
  movementIds: string[];
  repsDue?: number;
  /** undefined = event-paced (advanced via `next`) or an open stopwatch. */
  durationMs?: number;
  beepOnStart?: boolean;
  bellOnStart?: boolean;
  bellOnComplete?: boolean;
  halfwayBeep?: boolean;
  countdownTicks?: boolean;
  tenSecondCue?: boolean;
  /** stopwatch phases only: fire a bell once elapsed reaches this (time cap). */
  bellAtElapsedMs?: number;
  /** 'rounds' format only: auto-finish the block once roundsDone reaches this. */
  autoAdvanceRoundsTarget?: number;
}

interface InternalBlock {
  format: Format;
  phases: InternalPhase[];
  isDeathBy?: boolean;
  deathByMovementIds?: string[];
  chipperMovementIds?: string[];
}

export interface TimerState {
  blockIndex: number;
  phaseIndex: number;
  phase: Phase;
  roundsDone: number;
  status: TimerStatus;
  pendingCues: Cue[];
  // --- internal bookkeeping (not part of the documented public surface, but
  // plain data so the whole state can be safely structuredClone()d) ---
  _blocks: InternalBlock[];
  _phaseElapsedMs: number;
  _cueFiredMarks: string[];
  _lastTickAt?: number;
  _chipperIndex?: number;
}

export type TimerEvent =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'next'; now: number }
  | { type: 'roundDone'; now: number }
  | { type: 'fail'; now: number }
  | { type: 'finish'; now: number };

function movementLabel(m: BlockMovement): string {
  return m.loadNote ? `${m.movementId} (${m.loadNote})` : m.movementId;
}

function buildDeathByMinutePhase(minute: number, movementIds: string[]): InternalPhase {
  return {
    kind: 'countdown',
    label: `Minute ${minute}`,
    movementIds,
    repsDue: minute,
    durationMs: 60_000,
    beepOnStart: true,
    countdownTicks: true,
    tenSecondCue: true,
  };
}

function buildInternalBlock(block: Block): InternalBlock {
  const movementIds = block.movements.map((m) => m.movementId);

  switch (block.format) {
    case 'strength': {
      const sets = block.sets ?? 1;
      const restSec = block.restSec ?? 60;
      const repsDue = block.movements.length === 1 ? block.movements[0].reps : undefined;
      const phases: InternalPhase[] = [];
      for (let s = 1; s <= sets; s++) {
        phases.push({
          kind: 'work',
          label: `Set ${s}/${sets}`,
          movementIds,
          repsDue,
          bellOnStart: s === sets && sets > 1,
        });
        if (s < sets) {
          phases.push({
            kind: 'rest',
            label: 'Rest',
            movementIds: [],
            durationMs: restSec * 1000,
            countdownTicks: true,
            tenSecondCue: restSec * 1000 > 10_000,
          });
        }
      }
      return { format: 'strength', phases };
    }

    case 'emom': {
      const rounds = block.rounds ?? 1;
      const intervalSec = block.intervalSec ?? 60;
      const alternate = !!block.alternate;
      const phases: InternalPhase[] = [];
      for (let r = 1; r <= rounds; r++) {
        let roundMovementIds = movementIds;
        let repsDue: number | undefined;
        if (alternate && block.movements.length > 0) {
          const mv = block.movements[(r - 1) % block.movements.length];
          roundMovementIds = [mv.movementId];
          repsDue = mv.reps;
        }
        phases.push({
          kind: 'countdown',
          label: `Round ${r}/${rounds}`,
          movementIds: roundMovementIds,
          repsDue,
          durationMs: intervalSec * 1000,
          beepOnStart: true,
          countdownTicks: true,
          tenSecondCue: intervalSec * 1000 > 10_000,
        });
      }
      return { format: 'emom', phases };
    }

    case 'tabata': {
      const rounds = block.rounds ?? 8;
      const workSec = block.workSec ?? 20;
      const restSec = block.restSec ?? 10;
      const phases: InternalPhase[] = [];
      for (let mi = 0; mi < block.movements.length; mi++) {
        const mv = block.movements[mi];
        for (let r = 1; r <= rounds; r++) {
          phases.push({
            kind: 'work',
            label: `${movementLabel(mv)} ${r}/${rounds}`,
            movementIds: [mv.movementId],
            repsDue: mv.reps,
            durationMs: workSec * 1000,
            beepOnStart: true,
            tenSecondCue: workSec * 1000 > 10_000,
          });
          // No rest after the very last round of the very last movement; a
          // rest between rounds (same movement) or between movements stays.
          const isLastPhase = mi === block.movements.length - 1 && r === rounds;
          if (!isLastPhase) {
            phases.push({
              kind: 'rest',
              label: 'Rest',
              movementIds: [],
              durationMs: restSec * 1000,
              bellOnStart: true,
              tenSecondCue: restSec * 1000 > 10_000,
            });
          }
        }
      }
      return { format: 'tabata', phases };
    }

    case 'interval': {
      const rounds = block.rounds ?? 1;
      const workSec = block.workSec ?? 30;
      const restSec = block.restSec ?? 30;
      const phases: InternalPhase[] = [];
      for (let r = 1; r <= rounds; r++) {
        phases.push({
          kind: 'work',
          label: `Round ${r}/${rounds} work`,
          movementIds,
          durationMs: workSec * 1000,
          beepOnStart: true,
          tenSecondCue: workSec * 1000 > 10_000,
        });
        if (r < rounds) {
          phases.push({
            kind: 'rest',
            label: `Round ${r}/${rounds} rest`,
            movementIds: [],
            durationMs: restSec * 1000,
            bellOnStart: true,
            tenSecondCue: restSec * 1000 > 10_000,
          });
        }
      }
      return { format: 'interval', phases };
    }

    case 'amrap': {
      const durationSec = block.durationSec ?? 600;
      const phases: InternalPhase[] = [
        {
          kind: 'countdown',
          label: 'AMRAP',
          movementIds,
          durationMs: durationSec * 1000,
          halfwayBeep: true,
          countdownTicks: true,
          bellOnComplete: true,
          tenSecondCue: durationSec * 1000 > 10_000,
        },
      ];
      return { format: 'amrap', phases };
    }

    case 'rounds': {
      const timeCapMs = block.timeCapSec ? block.timeCapSec * 1000 : undefined;
      const phases: InternalPhase[] = [
        {
          kind: 'stopwatch',
          label: 'Rounds',
          movementIds,
          bellAtElapsedMs: timeCapMs,
          autoAdvanceRoundsTarget: block.rounds,
        },
      ];
      return { format: 'rounds', phases };
    }

    case 'chipper': {
      const timeCapMs = block.timeCapSec ? block.timeCapSec * 1000 : undefined;
      const first = block.movements[0];
      const phases: InternalPhase[] = [
        {
          kind: 'stopwatch',
          label: first ? `Movement 1/${block.movements.length}: ${movementLabel(first)}` : 'Chipper',
          movementIds: first ? [first.movementId] : [],
          bellAtElapsedMs: timeCapMs,
        },
      ];
      return { format: 'chipper', phases, chipperMovementIds: movementIds };
    }

    case 'death_by': {
      return {
        format: 'death_by',
        phases: [buildDeathByMinutePhase(1, movementIds)],
        isDeathBy: true,
        deathByMovementIds: movementIds,
      };
    }
  }
}

function emptyPhase(): Phase {
  return { kind: 'stopwatch', label: 'Done', movementIds: [], elapsedMs: 0 };
}

function setPhaseFromInternal(state: TimerState, phase: InternalPhase): void {
  state.phase = {
    kind: phase.kind,
    label: phase.label,
    movementIds: phase.movementIds,
    repsDue: phase.repsDue,
    remainingMs: phase.durationMs,
    elapsedMs: 0,
  };
  state._phaseElapsedMs = 0;
  state._cueFiredMarks = [];
}

function pushCue(state: TimerState, type: CueType, at: number): void {
  state.pendingCues.push({ type, at });
}

/** Builds the initial (idle) timer state for a workout's blocks. */
export function createTimer(blocks: Block[], now: number): TimerState {
  const internalBlocks = blocks.map(buildInternalBlock);
  const state: TimerState = {
    blockIndex: 0,
    phaseIndex: 0,
    phase: emptyPhase(),
    roundsDone: 0,
    status: 'idle',
    pendingCues: [],
    _blocks: internalBlocks,
    _phaseElapsedMs: 0,
    _cueFiredMarks: [],
    _lastTickAt: now,
  };
  const first = internalBlocks[0]?.phases[0];
  if (first) setPhaseFromInternal(state, first);
  else state.status = 'finished';
  return state;
}

function currentBlock(state: TimerState): InternalBlock | undefined {
  return state._blocks[state.blockIndex];
}

function currentInternalPhase(state: TimerState): InternalPhase | undefined {
  return currentBlock(state)?.phases[state.phaseIndex];
}

function fireStartCues(state: TimerState, phase: InternalPhase | undefined): void {
  if (!phase) return;
  if (phase.beepOnStart) pushCue(state, 'beep', phase.durationMs ?? 0);
  if (phase.bellOnStart) pushCue(state, 'bell', phase.durationMs ?? 0);
}

/** Advances to the next block, or finishes the workout if none remain. */
function advanceBlock(state: TimerState): void {
  state.blockIndex += 1;
  state.phaseIndex = 0;
  state.roundsDone = 0;
  const block = currentBlock(state);
  if (!block) {
    state.status = 'finished';
    state.phase = emptyPhase();
    return;
  }
  state.status = 'between-blocks';
  const first = block.phases[0];
  if (first) setPhaseFromInternal(state, first);
}

/** Advances to the next phase within the current block (or the next block). */
function advancePhase(state: TimerState): void {
  const block = currentBlock(state);
  if (!block) return;
  state.phaseIndex += 1;
  const next = block.phases[state.phaseIndex];
  if (!next) {
    advanceBlock(state);
    return;
  }
  setPhaseFromInternal(state, next);
  fireStartCues(state, next);
}

/** A timed phase has run out (or the user force-advanced it). */
function completeCurrentPhase(state: TimerState): void {
  const block = currentBlock(state);
  const phase = currentInternalPhase(state);
  if (!block || !phase) return;
  if (phase.bellOnComplete) pushCue(state, 'bell', 0);
  if (block.isDeathBy && state.phaseIndex === block.phases.length - 1) {
    const nextMinute = (phase.repsDue ?? 1) + 1;
    block.phases.push(buildDeathByMinutePhase(nextMinute, block.deathByMovementIds ?? []));
  }
  advancePhase(state);
}

function fireCountdownCues(state: TimerState, phase: InternalPhase): void {
  const remaining = state.phase.remainingMs ?? 0;
  const marks = state._cueFiredMarks;
  if (phase.tenSecondCue && remaining <= 10_000 && !marks.includes('10s')) {
    pushCue(state, 'countdown', 10_000);
    marks.push('10s');
  }
  if (phase.countdownTicks) {
    for (const ms of [3000, 2000, 1000]) {
      const key = `tick-${ms}`;
      if (remaining <= ms && !marks.includes(key)) {
        pushCue(state, 'countdown', ms);
        marks.push(key);
      }
    }
  }
  if (phase.halfwayBeep && phase.durationMs !== undefined) {
    const half = Math.floor(phase.durationMs / 2);
    if (remaining <= half && !marks.includes('half')) {
      pushCue(state, 'beep', half);
      marks.push('half');
    }
  }
}

function applyTick(state: TimerState, now: number): void {
  const block = currentBlock(state);
  const phase = currentInternalPhase(state);
  if (!block || !phase) {
    state.status = 'finished';
    return;
  }

  const last = state._lastTickAt ?? now;
  const dt = Math.max(0, now - last);
  // A tick can arrive out of order (e.g. after a later tick was already
  // applied); never let _lastTickAt move backwards, or the next tick would
  // double-count the interval it already covered.
  state._lastTickAt = Math.max(last, now);
  state._phaseElapsedMs += dt;
  state.phase.elapsedMs = state._phaseElapsedMs;

  if (phase.durationMs !== undefined) {
    const remaining = Math.max(0, phase.durationMs - state._phaseElapsedMs);
    state.phase.remainingMs = remaining;
    fireCountdownCues(state, phase);
    if (remaining <= 0) completeCurrentPhase(state);
  } else if (phase.kind === 'stopwatch') {
    if (
      phase.bellAtElapsedMs !== undefined &&
      !state._cueFiredMarks.includes('timecap') &&
      state._phaseElapsedMs >= phase.bellAtElapsedMs
    ) {
      pushCue(state, 'bell', phase.bellAtElapsedMs);
      state._cueFiredMarks.push('timecap');
    }
  }
  // Event-paced phases with no duration (e.g. a strength work set) do
  // nothing further on tick; they advance on `next`.
}

function applyNext(state: TimerState, now: number): void {
  if (state.status === 'between-blocks') {
    state.status = 'running';
    state._lastTickAt = now;
    fireStartCues(state, currentBlock(state)?.phases[0]);
    return;
  }
  if (state.status !== 'running') return;

  const block = currentBlock(state);
  if (block?.format === 'chipper') {
    const total = block.chipperMovementIds?.length ?? 0;
    const idx = (state._chipperIndex ?? 0) + 1;
    if (idx >= total) {
      advanceBlock(state);
    } else {
      state._chipperIndex = idx;
      const id = block.chipperMovementIds![idx];
      state.phase = { ...state.phase, movementIds: [id], label: `Movement ${idx + 1}/${total}: ${id}` };
    }
    return;
  }

  completeCurrentPhase(state);
}

function applyRoundDone(state: TimerState): void {
  if (state.status !== 'running') return;
  state.roundsDone += 1;
  const block = currentBlock(state);
  const phase = currentInternalPhase(state);
  if (block?.format === 'rounds' && phase?.autoAdvanceRoundsTarget !== undefined) {
    if (state.roundsDone >= phase.autoAdvanceRoundsTarget) advanceBlock(state);
  }
}

function applyFail(state: TimerState): void {
  if (state.status !== 'running') return;
  // death_by (and, generically, any format): failing ends the current block.
  advanceBlock(state);
}

/**
 * Pure reducer: `(state, event) => state`. Never mutates its input — always
 * clones defensively so callers may hold on to prior states (e.g. for undo
 * or for asserting "nothing changed").
 */
export function timerReducer(state: TimerState, event: TimerEvent): TimerState {
  const next: TimerState = structuredClone(state);
  next.pendingCues = []; // each dispatch reports only the cues it generated

  switch (event.type) {
    case 'start': {
      if (next.status !== 'idle') break;
      next.status = 'running';
      next._lastTickAt = event.now;
      fireStartCues(next, currentInternalPhase(next));
      break;
    }
    case 'pause': {
      if (next.status === 'running') next.status = 'paused';
      break;
    }
    case 'resume': {
      if (next.status === 'paused') {
        next.status = 'running';
        next._lastTickAt = event.now; // preserves remaining/elapsed ms exactly
      }
      break;
    }
    case 'tick': {
      if (next.status === 'running') applyTick(next, event.now);
      break;
    }
    case 'next': {
      applyNext(next, event.now);
      break;
    }
    case 'roundDone': {
      applyRoundDone(next);
      break;
    }
    case 'fail': {
      applyFail(next);
      break;
    }
    case 'finish': {
      next.status = 'finished';
      break;
    }
  }

  return next;
}
