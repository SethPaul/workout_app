import { describe, it, expect } from 'vitest';
import { createTimer, timerReducer, type Cue, type TimerState } from './timer';
import type { Block } from './types';

function runTicks(state: TimerState, startNow: number, count: number, stepMs = 100): { state: TimerState; cues: Cue[] } {
  let s = state;
  const cues: Cue[] = [];
  for (let i = 1; i <= count; i++) {
    s = timerReducer(s, { type: 'tick', now: startNow + i * stepMs });
    cues.push(...s.pendingCues);
  }
  return { state: s, cues };
}

describe('timer: strength', () => {
  const block: Block = {
    format: 'strength',
    movements: [{ movementId: 'squat', reps: 5 }],
    sets: 2,
    restSec: 2,
  };

  it('walks work -> rest -> next set -> finish, ringing a bell before the last set', () => {
    let state = createTimer([block], 0);
    expect(state.phase.label).toBe('Set 1/2');
    expect(state.phase.kind).toBe('work');

    state = timerReducer(state, { type: 'start', now: 0 });
    expect(state.status).toBe('running');

    // Work is event-paced: user advances manually.
    state = timerReducer(state, { type: 'next', now: 100 });
    expect(state.phase.kind).toBe('rest');
    expect(state.phase.remainingMs).toBe(2000);

    const { state: afterRest, cues } = runTicks(state, 100, 25); // 2500ms of ticking
    expect(afterRest.phase.label).toBe('Set 2/2');
    expect(afterRest.phase.kind).toBe('work');
    expect(cues.some((c) => c.type === 'bell')).toBe(true);
    expect(cues.filter((c) => c.type === 'countdown').length).toBeGreaterThan(0);

    const finished = timerReducer(afterRest, { type: 'next', now: 3000 });
    expect(finished.status).toBe('finished');
  });
});

describe('timer: emom', () => {
  const block: Block = {
    format: 'emom',
    movements: [{ movementId: 'burpee', reps: 10 }],
    rounds: 2,
    intervalSec: 1,
  };

  it('beeps at each round start and finishes after the last round', () => {
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    expect(state.pendingCues.some((c) => c.type === 'beep')).toBe(true);
    expect(state.phase.label).toBe('Round 1/2');

    const { state: afterRound1, cues } = runTicks(state, 0, 11); // 1100ms
    expect(cues.some((c) => c.type === 'beep')).toBe(true); // beep starting round 2
    expect(afterRound1.phase.label).toBe('Round 2/2');

    const { state: afterRound2 } = runTicks(afterRound1, 1100, 11);
    expect(afterRound2.status).toBe('finished');
  });
});

describe('timer: tabata', () => {
  // Two rounds so a rest phase exists between them (rest is kept between
  // rounds; only the very last round of the very last movement has none).
  const block: Block = {
    format: 'tabata',
    movements: [{ movementId: 'situp' }],
    rounds: 2,
    workSec: 1,
    restSec: 1,
  };

  it('beeps on work start and rings a bell on rest start', () => {
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    expect(state.phase.kind).toBe('work');
    expect(state.pendingCues.some((c) => c.type === 'beep')).toBe(true);

    const { state: afterWork, cues } = runTicks(state, 0, 11);
    expect(afterWork.phase.kind).toBe('rest');
    expect(cues.some((c) => c.type === 'bell')).toBe(true);

    const { state: afterRest } = runTicks(afterWork, 1100, 11);
    expect(afterRest.phase.kind).toBe('work'); // round 2/2, no trailing rest after it
    const { state: afterSecondWork } = runTicks(afterRest, 2200, 11);
    expect(afterSecondWork.status).toBe('finished');
  });

  it('finishes on the last round of the last movement without a trailing rest', () => {
    const twoMovementBlock: Block = {
      format: 'tabata',
      movements: [{ movementId: 'situp' }, { movementId: 'burpee' }],
      rounds: 1,
      workSec: 1,
      restSec: 1,
    };
    let state = createTimer([twoMovementBlock], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    expect(state.phase.kind).toBe('work');
    expect(state.phase.movementIds).toEqual(['situp']);

    // First movement's work -> rest between movements (kept) -> second movement's work.
    const { state: afterRestBetween } = runTicks(state, 0, 11);
    expect(afterRestBetween.phase.kind).toBe('rest');

    const { state: afterSecondWork } = runTicks(afterRestBetween, 1100, 11);
    expect(afterSecondWork.phase.kind).toBe('work');
    expect(afterSecondWork.phase.movementIds).toEqual(['burpee']);

    // No trailing rest after the last round of the last movement: this
    // finishes the block directly.
    const { state: finished } = runTicks(afterSecondWork, 2200, 11);
    expect(finished.status).toBe('finished');
  });
});

describe('timer: interval', () => {
  const block: Block = {
    format: 'interval',
    movements: [{ movementId: 'row', distanceM: 250 }],
    rounds: 1,
    workSec: 1,
    restSec: 1,
  };

  it('runs work then finishes directly after the only round (no trailing rest)', () => {
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    expect(state.phase.label).toBe('Round 1/1 work');

    const { state: afterWork } = runTicks(state, 0, 11);
    expect(afterWork.status).toBe('finished');
  });

  it('runs work then rest between rounds, but not after the final round', () => {
    const twoRoundBlock: Block = { ...block, rounds: 2 };
    let state = createTimer([twoRoundBlock], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    expect(state.phase.label).toBe('Round 1/2 work');

    const { state: afterWork1 } = runTicks(state, 0, 11);
    expect(afterWork1.phase.label).toBe('Round 1/2 rest');

    const { state: afterRest1 } = runTicks(afterWork1, 1100, 11);
    expect(afterRest1.phase.label).toBe('Round 2/2 work');
    expect(afterRest1.phase.kind).toBe('work');

    const { state: afterWork2 } = runTicks(afterRest1, 2200, 11);
    expect(afterWork2.status).toBe('finished');
  });

  it('ends the block on a "work" phase, never a trailing rest', () => {
    const threeRoundBlock: Block = { ...block, rounds: 3 };
    let state = createTimer([threeRoundBlock], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    let now = 0;
    // Drive ticks until the block finishes, recording the last non-finished phase kind.
    let lastKind: string = state.phase.kind;
    while (state.status !== 'finished') {
      now += 100;
      state = timerReducer(state, { type: 'tick', now });
      if (state.status !== 'finished') lastKind = state.phase.kind;
    }
    expect(lastKind).toBe('work');
  });
});

describe('timer: amrap', () => {
  const block: Block = {
    format: 'amrap',
    movements: [{ movementId: 'kb-swing', reps: 15 }],
    durationSec: 2,
  };

  it('increments rounds on roundDone and finishes with a bell at time up', () => {
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });

    state = timerReducer(state, { type: 'roundDone', now: 100 });
    state = timerReducer(state, { type: 'roundDone', now: 200 });
    expect(state.roundsDone).toBe(2);
    expect(state.phase.kind).toBe('countdown'); // roundDone doesn't change phase for amrap

    const { state: afterHalf, cues: halfCues } = runTicks(state, 200, 9); // ~1000ms -> halfway of 2000ms
    expect(halfCues.some((c) => c.type === 'beep')).toBe(true);

    const { state: finished, cues } = runTicks(afterHalf, 1100, 10); // remaining ~1000ms
    expect(cues.some((c) => c.type === 'bell')).toBe(true);
    expect(finished.status).toBe('finished');
  });
});

describe('timer: rounds', () => {
  it('auto-finishes once roundsDone reaches the target', () => {
    const block: Block = {
      format: 'rounds',
      movements: [{ movementId: 'pullup', reps: 10 }],
      rounds: 3,
    };
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    expect(state.phase.kind).toBe('stopwatch');

    state = timerReducer(state, { type: 'roundDone', now: 100 });
    state = timerReducer(state, { type: 'roundDone', now: 200 });
    expect(state.status).toBe('running');
    state = timerReducer(state, { type: 'roundDone', now: 300 });
    expect(state.status).toBe('finished');
  });

  it('rings a bell at the time cap without ending the block', () => {
    const block: Block = {
      format: 'rounds',
      movements: [{ movementId: 'pullup', reps: 10 }],
      rounds: 100,
      timeCapSec: 1,
    };
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    const { state: afterCap, cues } = runTicks(state, 0, 11); // 1100ms > 1000ms cap
    expect(cues.some((c) => c.type === 'bell')).toBe(true);
    expect(afterCap.status).toBe('running');
  });
});

describe('timer: chipper', () => {
  const block: Block = {
    format: 'chipper',
    movements: [{ movementId: 'row', distanceM: 500 }, { movementId: 'situp', reps: 50 }, { movementId: 'squat', reps: 50 }],
  };

  it('advances movements on next and finishes after the last one', () => {
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    expect(state.phase.movementIds).toEqual(['row']);

    state = timerReducer(state, { type: 'next', now: 100 });
    expect(state.phase.movementIds).toEqual(['situp']);

    state = timerReducer(state, { type: 'next', now: 200 });
    expect(state.phase.movementIds).toEqual(['squat']);

    state = timerReducer(state, { type: 'next', now: 300 });
    expect(state.status).toBe('finished');
  });
});

describe('timer: death_by', () => {
  const block: Block = {
    format: 'death_by',
    movements: [{ movementId: 'burpee' }],
  };

  it('advances minute by minute and ends the block on fail', () => {
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    expect(state.phase.label).toBe('Minute 1');
    expect(state.phase.repsDue).toBe(1);

    const { state: afterMinute1 } = runTicks(state, 0, 601, 100); // 60,100ms > 60,000ms
    expect(afterMinute1.phase.label).toBe('Minute 2');
    expect(afterMinute1.phase.repsDue).toBe(2);

    const failed = timerReducer(afterMinute1, { type: 'fail', now: 61_000 });
    expect(failed.status).toBe('finished'); // single block: failing ends the workout
  });
});

describe('timer: emom alternate', () => {
  it('alternates two movements A,B,A,B across 4 rounds', () => {
    const block: Block = {
      format: 'emom',
      movements: [{ movementId: 'a', reps: 5 }, { movementId: 'b', reps: 8 }],
      rounds: 4,
      intervalSec: 1,
      alternate: true,
    };
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    expect(state.phase.movementIds).toEqual(['a']);
    expect(state.phase.repsDue).toBe(5);

    const { state: round2 } = runTicks(state, 0, 11);
    expect(round2.phase.movementIds).toEqual(['b']);
    expect(round2.phase.repsDue).toBe(8);

    const { state: round3 } = runTicks(round2, 1100, 11);
    expect(round3.phase.movementIds).toEqual(['a']);
    expect(round3.phase.repsDue).toBe(5);

    const { state: round4 } = runTicks(round3, 2200, 11);
    expect(round4.phase.movementIds).toEqual(['b']);
    expect(round4.phase.repsDue).toBe(8);

    const { state: finished } = runTicks(round4, 3300, 11);
    expect(finished.status).toBe('finished');
  });
});

describe('timer: out-of-order ticks', () => {
  it('does not double-count elapsed time when a later tick arrives after an earlier one', () => {
    const block: Block = {
      format: 'amrap',
      movements: [{ movementId: 'kb-swing', reps: 15 }],
      durationSec: 100,
    };
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });

    state = timerReducer(state, { type: 'tick', now: 1000 });
    expect(state.phase.elapsedMs).toBe(1000);

    // An earlier tick arrives after the 1000ms tick was already applied.
    state = timerReducer(state, { type: 'tick', now: 500 });
    // _lastTickAt must not regress, so this tick contributes 0 extra elapsed ms.
    expect(state.phase.elapsedMs).toBe(1000);

    // The next tick must be measured from the latest tick seen (1000), not
    // from the out-of-order one (500), or it would double-count.
    state = timerReducer(state, { type: 'tick', now: 1000 });
    expect(state.phase.elapsedMs).toBe(1000);
  });
});

describe('timer: finished state ignores further events', () => {
  it('ignores tick, next, and roundDone once finished', () => {
    const block: Block = {
      format: 'rounds',
      movements: [{ movementId: 'pullup', reps: 10 }],
      rounds: 1,
    };
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });
    state = timerReducer(state, { type: 'roundDone', now: 100 });
    expect(state.status).toBe('finished');

    const afterTick = timerReducer(state, { type: 'tick', now: 200 });
    expect(afterTick.status).toBe('finished');
    expect(afterTick.phase).toEqual(state.phase);

    const afterNext = timerReducer(state, { type: 'next', now: 300 });
    expect(afterNext.status).toBe('finished');
    expect(afterNext.roundsDone).toBe(state.roundsDone);

    const afterRoundDone = timerReducer(state, { type: 'roundDone', now: 400 });
    expect(afterRoundDone.status).toBe('finished');
    expect(afterRoundDone.roundsDone).toBe(state.roundsDone);
  });
});

describe('timer: pause/resume', () => {
  it('preserves remaining time across a pause', () => {
    const block: Block = {
      format: 'emom',
      movements: [{ movementId: 'burpee', reps: 10 }],
      rounds: 1,
      intervalSec: 5,
    };
    let state = createTimer([block], 0);
    state = timerReducer(state, { type: 'start', now: 0 });

    const { state: partway } = runTicks(state, 0, 20); // 2000ms elapsed, 3000ms remaining
    expect(partway.phase.remainingMs).toBe(3000);

    const paused = timerReducer(partway, { type: 'pause', now: 2000 });
    expect(paused.status).toBe('paused');

    // Ticks while paused must be ignored entirely.
    const stillPaused = timerReducer(paused, { type: 'tick', now: 500_000 });
    expect(stillPaused.status).toBe('paused');
    expect(stillPaused.phase.remainingMs).toBe(3000);

    const resumed = timerReducer(stillPaused, { type: 'resume', now: 500_000 });
    expect(resumed.status).toBe('running');
    expect(resumed.phase.remainingMs).toBe(3000); // unchanged by the pause duration

    const afterResume = timerReducer(resumed, { type: 'tick', now: 500_100 });
    expect(afterResume.phase.remainingMs).toBe(2900); // only the 100ms since resume counted
  });
});
