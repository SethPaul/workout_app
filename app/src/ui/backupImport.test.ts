import { describe, expect, it } from 'vitest';
import type { AppState, WorkoutLog } from '../domain/types';
import { describeImport } from './backupImport';

function log(id: string, finishedAt: string): WorkoutLog {
  return {
    id,
    workoutSnapshot: {
      id: 'w',
      name: 'W',
      intensity: 'M',
      blocks: [],
      cadenceDays: 0,
      enabled: true,
      source: 'manual',
    },
    startedAt: finishedAt,
    finishedAt,
    results: [],
  } as WorkoutLog;
}

function appState(logs: WorkoutLog[]): AppState {
  return {
    movements: [],
    pool: [],
    logs,
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 3,
  } as AppState;
}

const NOW = new Date('2026-11-08T12:00:00.000Z');

describe('describeImport', () => {
  it('summarises the backup, its age and the source file', () => {
    const text = describeImport(
      {
        state: appState([
          log('a', '2026-10-30T10:00:00.000Z'),
          log('b', '2026-10-31T10:00:00.000Z'),
        ]),
        exportedAt: '2026-11-01T12:00:00.000Z',
      },
      appState([]),
      'workout-backup-2026-11-01.json',
      NOW,
    );
    expect(text).toContain('File: workout-backup-2026-11-01.json');
    expect(text).toContain('(7 days ago)');
    expect(text).toContain('Backup has: 2 logged workouts (latest');
    expect(text).toContain('0 pool workouts, 0 movements');
    expect(text).toContain('This device has: 0 logged workouts.');
    expect(text).not.toContain('Warning');
  });

  it('warns about logs on this device that the backup does not contain', () => {
    const shared = log('a', '2026-10-30T10:00:00.000Z');
    const text = describeImport(
      { state: appState([shared]) },
      appState([
        shared,
        log('new1', '2026-11-05T10:00:00.000Z'),
        log('new2', '2026-11-06T10:00:00.000Z'),
      ]),
      undefined,
      NOW,
    );
    expect(text).toContain('Warning: 2 logged workouts on this device are not in the backup');
    expect(text).not.toContain('Exported:');
    expect(text).not.toContain('File:');
  });

  it('uses singular wording for one log', () => {
    const text = describeImport(
      { state: appState([]) },
      appState([log('x', '2026-11-01T00:00:00Z')]),
    );
    expect(text).toContain('1 logged workout on this device is not in the backup');
  });
});
