import { parseBackup, type ParsedBackup } from '../domain/serialize';
import type { AppState, WorkoutLog } from '../domain/types';
import { clearTodayWorkout, state, update } from '../state/store';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function latestLog(logs: WorkoutLog[]): string | undefined {
  let latest: string | undefined;
  for (const l of logs) if (!latest || l.finishedAt > latest) latest = l.finishedAt;
  return latest;
}

function describeLogs(logs: WorkoutLog[]): string {
  const latest = latestLog(logs);
  return `${plural(logs.length, 'logged workout')}${latest ? ` (latest ${formatDate(latest)})` : ''}`;
}

function daysAgo(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/**
 * The confirmation text shown before an import replaces everything: what the
 * backup holds, how old it is, and — most importantly — how many workouts
 * logged on this device are missing from it and would be lost.
 */
export function describeImport(
  backup: ParsedBackup,
  current: AppState | null,
  sourceName?: string,
  now: Date = new Date(),
): string {
  const incoming = backup.state;
  const lines = ['Replace all data on this device with this backup?', ''];
  if (sourceName) lines.push(`File: ${sourceName}`);
  if (backup.exportedAt) {
    lines.push(`Exported: ${formatDate(backup.exportedAt)} (${daysAgo(backup.exportedAt, now)})`);
  }
  lines.push(
    `Backup has: ${describeLogs(incoming.logs)}, ${plural(incoming.pool.length, 'pool workout')}, ` +
      `${plural(incoming.movements.length, 'movement')}.`,
  );

  if (current) {
    lines.push(`This device has: ${describeLogs(current.logs)}.`);
    const incomingIds = new Set(incoming.logs.map((l) => l.id));
    const lost = current.logs.filter((l) => !incomingIds.has(l.id)).length;
    if (lost > 0) {
      lines.push(
        '',
        `Warning: ${plural(lost, 'logged workout')} on this device ${lost === 1 ? 'is' : 'are'} ` +
          'not in the backup and will be lost. Export this device first if you want to keep them.',
      );
    }
  }
  lines.push('', 'This cannot be undone.');
  return lines.join('\n');
}

/**
 * Validates `text` as a backup, asks for confirmation, and replaces the app
 * state with it. Used by Settings → Import and by files opened with / shared
 * to the Android app. Resolves true if the data was replaced.
 */
export async function importBackupText(text: string, sourceName?: string): Promise<boolean> {
  let backup: ParsedBackup;
  try {
    backup = parseBackup(text);
  } catch (err) {
    const what = sourceName ? `"${sourceName}"` : 'this file';
    alert(
      `Couldn't import ${what}. ${err instanceof Error ? err.message : String(err)}\n\n` +
        'Pick a backup made with Settings → Export in this app.',
    );
    return false;
  }
  if (!confirm(describeImport(backup, state.value, sourceName))) return false;
  await update(() => backup.state);
  clearTodayWorkout();
  return true;
}
