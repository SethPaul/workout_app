import type { CueType } from '../domain/timer';

/** Guarded navigator.vibrate — a no-op where unsupported or disallowed. */
export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore — vibration not supported/permitted on this device
  }
}

/** Maps a timer Cue's type to a short vibration pattern. */
export function vibrateForCue(type: CueType): void {
  switch (type) {
    case 'beep':
      vibrate(60);
      break;
    case 'bell':
      vibrate([90, 60, 90]);
      break;
    case 'countdown':
      vibrate(40);
      break;
  }
}
