import { useRef } from 'preact/hooks';
import type { Equipment, Units } from '../../domain/types';
import { exportState } from '../../domain/serialize';
import { resolveSettings, type DeloadPolicy, type Focus } from '../../domain/program/context';
import { clearTodayWorkout, startNewCycle, state, update } from '../../state/store';
import { buildSeedState } from '../../storage/seed';
import {
  backupFilename,
  canShareBackup,
  isNativeApp,
  openBackupFile,
  saveBackup,
  shareBackup,
} from '../../platform/backupIO';
import { playTestTone } from '../audio';
import { importBackupText } from '../backupImport';
import { EQUIPMENT_LABELS } from '../helpers';

const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];
const DELOAD_POLICY_LABELS: Record<DeloadPolicy, string> = {
  fatigue: 'Fatigue-based (recommended)',
  calendar: 'Calendar (every N+1th week)',
  off: 'Off',
};
const FOCUS_LABELS: Record<Focus, string> = {
  balanced: 'Balanced',
  strength: 'Strength',
  conditioning: 'Conditioning',
};

export function Settings() {
  const s = state.value!;
  const settings = resolveSettings(s.settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function patchSettings(fn: (settings: typeof s.settings) => Partial<typeof s.settings>) {
    void update((cur) => ({ ...cur, settings: { ...cur.settings, ...fn(cur.settings) } }));
  }

  async function handleStartNewCycle() {
    if (
      !confirm(
        'Start a new cycle now? This resets the cycle week and clears any active deload or dismissed flags.',
      )
    )
      return;
    await startNewCycle();
  }

  function toggleEquipment(eq: Equipment, on: boolean) {
    void update((cur) => {
      const set = new Set(cur.settings.availableEquipment);
      if (on) set.add(eq);
      else set.delete(eq);
      return { ...cur, settings: { ...cur.settings, availableEquipment: [...set] } };
    });
  }

  function toggleSetting(key: 'soundOn' | 'vibrateOn' | 'keepScreenOn', on: boolean) {
    void update((cur) => ({ ...cur, settings: { ...cur.settings, [key]: on } }));
  }

  function setSoundVolume(v: number) {
    void update((cur) => ({ ...cur, settings: { ...cur.settings, soundVolume: v } }));
  }

  const native = isNativeApp();
  const shareable = canShareBackup();

  function reportError(action: string, err: unknown) {
    alert(`${action} failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  async function handleSave() {
    try {
      const saved = await saveBackup(backupFilename(), exportState(s));
      if (saved && native) alert('Backup saved.');
    } catch (err) {
      reportError('Saving the backup', err);
    }
  }

  async function handleShare() {
    try {
      await shareBackup(backupFilename(), exportState(s));
    } catch (err) {
      reportError('Sharing the backup', err);
    }
  }

  async function pickImportFile() {
    if (!native) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const file = await openBackupFile();
      if (file) await importBackupText(file.text, file.name);
    } catch (err) {
      reportError('Opening the file', err);
    }
  }

  async function handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await importBackupText(await file.text(), file.name);
  }

  async function resetToSeed() {
    if (!confirm('Reset all data to the built-in seed workouts? Your logs and edits will be lost.'))
      return;
    const seeded = await buildSeedState();
    await update(() => seeded);
    clearTodayWorkout();
  }

  return (
    <div>
      <h1 class="page-title">Settings</h1>

      <div class="section-title">Programming</div>
      <div class="card stack">
        <div class="field">
          <label for="units">Units</label>
          <select
            id="units"
            value={settings.units}
            onChange={(e) =>
              patchSettings(() => ({ units: (e.target as HTMLSelectElement).value as Units }))
            }
          >
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
          <div class="muted">
            Changing units doesn't convert anything — it only relabels weights and sets the default
            load increments. Logs keep the number as entered.
          </div>
        </div>

        <div class="field">
          <label for="deload-policy">Deload policy</label>
          <select
            id="deload-policy"
            value={settings.deloadPolicy}
            onChange={(e) =>
              patchSettings(() => ({
                deloadPolicy: (e.target as HTMLSelectElement).value as DeloadPolicy,
              }))
            }
          >
            {(Object.keys(DELOAD_POLICY_LABELS) as DeloadPolicy[]).map((p) => (
              <option value={p} key={p}>
                {DELOAD_POLICY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div class="field">
          <label for="cycle-weeks">Cycle length (weeks)</label>
          <input
            id="cycle-weeks"
            type="number"
            min="3"
            max="6"
            value={settings.cycleWeeks}
            onInput={(e) => {
              const n = Number((e.target as HTMLInputElement).value);
              if (!Number.isFinite(n)) return;
              const clamped = Math.min(6, Math.max(3, Math.round(n)));
              patchSettings(() => ({ cycleWeeks: clamped }));
            }}
          />
        </div>

        <div class="field">
          <label for="focus">Focus</label>
          <select
            id="focus"
            value={settings.focus}
            onChange={(e) =>
              patchSettings(() => ({ focus: (e.target as HTMLSelectElement).value as Focus }))
            }
          >
            {(Object.keys(FOCUS_LABELS) as Focus[]).map((f) => (
              <option value={f} key={f}>
                {FOCUS_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        <label class="toggle-row">
          <span>Masters mode (extra recovery day in the pattern cadence)</span>
          <input
            type="checkbox"
            checked={settings.masters}
            onChange={(e) =>
              patchSettings(() => ({ masters: (e.target as HTMLInputElement).checked }))
            }
            style="width:24px;height:24px"
          />
        </label>

        <button class="btn btn-block" onClick={() => void handleStartNewCycle()}>
          Start new cycle
        </button>
      </div>

      <div class="section-title">Available Equipment</div>
      <div class="card">
        {ALL_EQUIPMENT.map((eq) => (
          <label class="toggle-row" key={eq}>
            <span>{EQUIPMENT_LABELS[eq]}</span>
            <input
              type="checkbox"
              checked={s.settings.availableEquipment.includes(eq)}
              onChange={(e) => toggleEquipment(eq, (e.target as HTMLInputElement).checked)}
              style="width:24px;height:24px"
            />
          </label>
        ))}
      </div>

      <div class="section-title">Run Preferences</div>
      <div class="card">
        <label class="toggle-row">
          <span>Sound cues</span>
          <input
            type="checkbox"
            checked={s.settings.soundOn}
            onChange={(e) => toggleSetting('soundOn', (e.target as HTMLInputElement).checked)}
            style="width:24px;height:24px"
          />
        </label>
        <div class="field">
          <label for="sound-volume">
            Volume ({Math.round((s.settings.soundVolume ?? 1) * 100)}%)
          </label>
          <div class="volume-row">
            <input
              id="sound-volume"
              class="volume-slider"
              type="range"
              min="0"
              max="100"
              step="5"
              disabled={!s.settings.soundOn}
              value={Math.round((s.settings.soundVolume ?? 1) * 100)}
              onInput={(e) => setSoundVolume(Number((e.target as HTMLInputElement).value) / 100)}
            />
            <button class="btn" disabled={!s.settings.soundOn} onClick={() => playTestTone()}>
              Test
            </button>
          </div>
        </div>
        <label class="toggle-row">
          <span>Vibration cues</span>
          <input
            type="checkbox"
            checked={s.settings.vibrateOn}
            onChange={(e) => toggleSetting('vibrateOn', (e.target as HTMLInputElement).checked)}
            style="width:24px;height:24px"
          />
        </label>
        <label class="toggle-row">
          <span>Keep screen on during Run</span>
          <input
            type="checkbox"
            checked={s.settings.keepScreenOn}
            onChange={(e) => toggleSetting('keepScreenOn', (e.target as HTMLInputElement).checked)}
            style="width:24px;height:24px"
          />
        </label>
      </div>

      <div class="section-title">Backup</div>
      <div class="stack">
        <div class="muted">
          Your data lives only on this device. A backup is one JSON file with all workouts, logs,
          movements and settings. To move to {native ? 'another device' : 'the Android app'}, export
          here, send the file over (email, Drive, USB), then open it with Workout or use Import.
        </div>
        <button class="btn btn-block" onClick={() => void handleSave()}>
          {native ? 'Save backup to a file' : 'Export JSON'}
        </button>
        {shareable && (
          <button class="btn btn-block" onClick={() => void handleShare()}>
            Share backup
          </button>
        )}
        <button class="btn btn-block" onClick={() => void pickImportFile()}>
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style="display:none"
          onChange={(e) => void handleFile(e)}
        />
        <button class="btn btn-danger btn-block" onClick={() => void resetToSeed()}>
          Reset to seed data
        </button>
      </div>
    </div>
  );
}
