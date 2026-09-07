import type { Cue } from '../domain/timer';

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  );
}

/**
 * Creates (or resumes) the shared AudioContext. Must be called synchronously
 * from within a user-gesture event handler (the Run screen's Start button) —
 * browsers (notably iOS/Android Safari and Chrome) refuse to produce sound
 * from a context created or resumed outside a gesture, and will stay silent
 * forever if we try to build one lazily on first cue instead.
 */
export function resumeAudio(): void {
  try {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    // Web Audio unavailable — cues will silently no-op.
    ctx = null;
  }
}

/** True once an AudioContext has been created via a user gesture. */
export function isAudioReady(): boolean {
  return ctx !== null && ctx.state === 'running';
}

function playTone(freq: number, durationMs: number, opts: { decay?: boolean; gain?: number } = {}): void {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = ctx.currentTime;
    const dur = durationMs / 1000;
    const peak = opts.gain ?? 0.3;
    gainNode.gain.setValueAtTime(0.0001, t0);
    gainNode.gain.linearRampToValueAtTime(peak, t0 + 0.012);
    if (opts.decay) {
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    } else {
      gainNode.gain.setValueAtTime(peak, Math.max(t0 + 0.012, t0 + dur - 0.04));
      gainNode.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    }
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // Ignore playback failures (autoplay policy, closed context, etc).
  }
}

function playBeep(): void {
  playTone(880, 150);
}

function playBell(): void {
  playTone(660, 750, { decay: true, gain: 0.35 });
}

function playDoubleBeep(): void {
  playTone(880, 110);
  setTimeout(() => playTone(880, 110), 170);
}

function playCountdownTick(final: boolean): void {
  playTone(final ? 1320 : 880, final ? 220 : 120);
}

/** Plays the tone for one timer Cue (see domain/timer.ts). Silent no-op until resumeAudio() has run. */
export function playCue(cue: Cue): void {
  switch (cue.type) {
    case 'beep':
      playBeep();
      break;
    case 'bell':
      playBell();
      break;
    case 'countdown':
      if (cue.at === 10_000) playDoubleBeep();
      else playCountdownTick(cue.at <= 1000);
      break;
  }
}
