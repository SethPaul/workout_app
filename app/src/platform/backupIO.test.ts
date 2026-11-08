import { describe, expect, it } from 'vitest';
import { backupFilename, canShareBackup, isNativeApp } from './backupIO';

describe('backupIO (web)', () => {
  it('names backups by local date', () => {
    expect(backupFilename(new Date(2026, 0, 5, 23, 30))).toBe('workout-backup-2026-01-05.json');
  });

  it('is not native under test and has no Web Share in jsdom', () => {
    expect(isNativeApp()).toBe(false);
    expect(canShareBackup()).toBe(false);
  });
});
