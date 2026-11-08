import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Moving backup files in and out of the app, on the web and inside the
 * Android app (Capacitor). The web build never loads the Capacitor plugins'
 * native side; `isNativeApp()` gates every native call.
 *
 * On Android the pieces are:
 * - Save: the system "create document" picker (Downloads, Drive, ...) via
 *   the app's own `BackupTransfer` plugin (android/.../BackupTransferPlugin.java).
 * - Share: write to the cache dir and open the Android share sheet.
 * - Open: the system "open document" picker, accepting any file type, since
 *   providers often report a downloaded .json as application/octet-stream.
 * - Incoming: a .json opened or shared *into* the app ("Open with Workout")
 *   arrives as a `backupReceived` event.
 */

export interface BackupFile {
  name: string;
  text: string;
}

/** Payload of the native `backupReceived` event. */
export interface IncomingBackup {
  name?: string;
  text?: string;
  error?: string;
}

interface BackupTransferPlugin {
  saveFile(options: { filename: string; data: string }): Promise<{ saved: boolean }>;
  openFile(): Promise<{ name?: string; text?: string; cancelled?: boolean }>;
  addListener(
    event: 'backupReceived',
    listener: (payload: IncomingBackup) => void,
  ): Promise<PluginListenerHandle>;
}

const BackupTransfer = registerPlugin<BackupTransferPlugin>('BackupTransfer');

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** `workout-backup-YYYY-MM-DD.json`, using the device's local date. */
export function backupFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `workout-backup-${y}-${m}-${d}.json`;
}

function isAbort(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /cancel/i.test(msg);
}

function downloadInBrowser(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in some mobile browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Saves the backup somewhere the user chooses (native) or downloads it
 * (web). Resolves false only if the user cancelled the native picker.
 */
export async function saveBackup(filename: string, json: string): Promise<boolean> {
  if (!isNativeApp()) {
    downloadInBrowser(filename, json);
    return true;
  }
  const { saved } = await BackupTransfer.saveFile({ filename, data: json });
  return saved;
}

function webShareFile(filename: string, json: string): File | null {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return null;
  const file = new File([json], filename, { type: 'application/json' });
  // Chrome restricts shareable file types and rejects .json; Safari allows it.
  return navigator.canShare({ files: [file] }) ? file : null;
}

/** Whether "Share backup" can be offered on this platform. */
export function canShareBackup(): boolean {
  if (isNativeApp()) return true;
  try {
    return webShareFile('workout-backup.json', '{}') !== null;
  } catch {
    return false;
  }
}

/**
 * Hands the backup to the platform share sheet (email, Drive, Nearby Share,
 * ...). Resolves false if the user dismissed the sheet.
 */
export async function shareBackup(filename: string, json: string): Promise<boolean> {
  try {
    if (isNativeApp()) {
      const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ]);
      const { uri } = await Filesystem.writeFile({
        path: filename,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({ title: 'Workout backup', files: [uri] });
      return true;
    }
    const file = webShareFile(filename, json);
    if (!file) throw new Error('Sharing files is not supported in this browser');
    await navigator.share({ files: [file], title: 'Workout backup' });
    return true;
  } catch (err) {
    if (isAbort(err)) return false;
    throw err;
  }
}

/**
 * Opens the native document picker and reads the chosen file. Native only:
 * the web uses an `<input type="file">`. Resolves null if cancelled.
 */
export async function openBackupFile(): Promise<BackupFile | null> {
  const result = await BackupTransfer.openFile();
  if (result.cancelled || result.text === undefined) return null;
  return { name: result.name ?? 'backup.json', text: result.text };
}

/**
 * Subscribes to backups opened with / shared to the Android app. A file that
 * launched the app is retained natively and delivered once a listener is
 * attached. No-op on the web.
 */
export function onIncomingBackup(listener: (payload: IncomingBackup) => void): () => void {
  if (!isNativeApp()) return () => {};
  let handle: PluginListenerHandle | undefined;
  let removed = false;
  void BackupTransfer.addListener('backupReceived', listener).then((h) => {
    if (removed) void h.remove();
    else handle = h;
  });
  return () => {
    removed = true;
    void handle?.remove();
  };
}
