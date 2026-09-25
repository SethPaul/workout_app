import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WARMUP_TARGET_MS,
  createWarmup,
  restoreWarmup,
  warmupReducer,
  type WarmupEvent,
  type WarmupState,
} from './warmup';

function run(events: WarmupEvent[], initial: WarmupState = createWarmup()) {
  let warmup = initial;
  const cues = [];
  for (const event of events) {
    const next = warmupReducer(warmup, event);
    warmup = next.warmup;
    cues.push(...next.cues);
  }
  return { warmup, cues };
}

describe('warmup stopwatch', () => {
  it('starts idle at 0 with the default 5 min target', () => {
    const w = createWarmup();
    expect(w.running).toBe(false);
    expect(w.elapsedMs).toBe(0);
    expect(w.targetMs).toBe(DEFAULT_WARMUP_TARGET_MS);
    expect(w.bellFired).toBe(false);
  });

  it('accumulates elapsed time across ticks while running', () => {
    const { warmup } = run([
      { type: 'start', now: 1000 },
      { type: 'tick', now: 1100 },
      { type: 'tick', now: 4000 },
    ]);
    expect(warmup.running).toBe(true);
    expect(warmup.elapsedMs).toBe(3000);
  });

  it('ignores ticks while not running', () => {
    const { warmup } = run([{ type: 'tick', now: 5000 }]);
    expect(warmup.elapsedMs).toBe(0);
    const paused = run([
      { type: 'start', now: 0 },
      { type: 'pause', now: 2000 },
      { type: 'tick', now: 9000 },
    ]);
    expect(paused.warmup.elapsedMs).toBe(2000);
    expect(paused.warmup.running).toBe(false);
  });

  it('pause folds the time since the last tick in, and resume continues without a jump', () => {
    const { warmup } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 1500 },
      { type: 'pause', now: 2000 },
      { type: 'start', now: 60_000 },
      { type: 'tick', now: 61_000 },
    ]);
    expect(warmup.elapsedMs).toBe(3000);
  });

  it('start while already running is a no-op', () => {
    const started = run([{ type: 'start', now: 0 }]).warmup;
    expect(warmupReducer(started, { type: 'start', now: 500 }).warmup).toBe(started);
  });

  it('rings the bell exactly once when elapsed reaches the target', () => {
    const { warmup, cues } = run([
      { type: 'setTarget', targetMs: 3000 },
      { type: 'start', now: 0 },
      { type: 'tick', now: 2999 },
      { type: 'tick', now: 3000 },
      { type: 'tick', now: 4000 },
      { type: 'pause', now: 5000 },
      { type: 'start', now: 6000 },
      { type: 'tick', now: 7000 },
    ]);
    expect(cues).toEqual([{ type: 'bell', at: 3000 }]);
    expect(warmup.bellFired).toBe(true);
  });

  it('rings when the target is crossed by a pause', () => {
    const { cues } = run([
      { type: 'setTarget', targetMs: 1000 },
      { type: 'start', now: 0 },
      { type: 'pause', now: 1500 },
    ]);
    expect(cues).toEqual([{ type: 'bell', at: 1000 }]);
  });

  it('reset returns to 0, keeps the target and re-arms the bell', () => {
    const { warmup } = run([
      { type: 'setTarget', targetMs: 1000 },
      { type: 'start', now: 0 },
      { type: 'tick', now: 2000 },
      { type: 'reset' },
    ]);
    expect(warmup).toEqual(createWarmup(1000));
  });

  it('raising the target above the clock re-arms the bell; lowering it below does not re-ring', () => {
    const rung = run([
      { type: 'setTarget', targetMs: 1000 },
      { type: 'start', now: 0 },
      { type: 'tick', now: 2000 },
    ]);
    const raised = warmupReducer(rung.warmup, { type: 'setTarget', targetMs: 5000 }).warmup;
    expect(raised.bellFired).toBe(false);
    const lowered = warmupReducer(rung.warmup, { type: 'setTarget', targetMs: 500 }).warmup;
    expect(lowered.bellFired).toBe(true);
    expect(warmupReducer(lowered, { type: 'tick', now: 3000 }).cues).toEqual([]);
  });

  it('a negative clock step never subtracts time', () => {
    const { warmup } = run([
      { type: 'start', now: 5000 },
      { type: 'tick', now: 4000 },
    ]);
    expect(warmup.elapsedMs).toBe(0);
  });
});

describe('restoreWarmup', () => {
  it('freezes a running warm-up at its last ticked elapsed time', () => {
    const running = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 4000 },
    ]).warmup;
    const restored = restoreWarmup(running);
    expect(restored.running).toBe(false);
    expect(restored.elapsedMs).toBe(4000);
    expect(restored._lastTickAt).toBeUndefined();
  });

  it('returns a stopped warm-up by identity', () => {
    const stopped = createWarmup();
    expect(restoreWarmup(stopped)).toBe(stopped);
  });
});
