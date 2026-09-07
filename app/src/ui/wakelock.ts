let sentinel: WakeLockSentinel | null = null;
let wanted = false;
let visibilityHandlerAttached = false;

async function requestSentinel(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !navigator.wakeLock) return;
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    sentinel = null; // e.g. unsupported, or a permission/policy rejection
  }
}

function attachVisibilityHandler(): void {
  if (visibilityHandlerAttached || typeof document === 'undefined') return;
  visibilityHandlerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible' && !sentinel) {
      void requestSentinel();
    }
  });
}

/** Acquires the screen wake lock, if supported. Re-acquires automatically on visibilitychange until released(). */
export async function acquireWakeLock(): Promise<void> {
  wanted = true;
  attachVisibilityHandler();
  await requestSentinel();
}

/** Releases the wake lock and stops the automatic re-acquire behaviour. */
export function releaseWakeLock(): void {
  wanted = false;
  const s = sentinel;
  sentinel = null;
  if (s) void s.release().catch(() => undefined);
}
