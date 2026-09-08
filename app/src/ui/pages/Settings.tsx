import { useRef } from 'preact/hooks';
import type { Equipment, Units } from '../../domain/types';
import { exportState, importState } from '../../domain/serialize';
import { resolveSettings, type DeloadPolicy, type Focus } from '../../domain/program/context';
import { clearTodayWorkout, startNewCycle, state, update } from '../../state/store';
import { buildSeedState } from '../../storage/seed';
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
    if (!confirm('Start a new cycle now? This resets the cycle week and clears any active deload or dismissed flags.')) return;
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

  function exportJson() {
    const json = exportState(s);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function pickImportFile() {
    fileInputRef.current?.click();
  }

  async function handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const text = await file.text();
    let parsed;
    try {
      parsed = importState(text);
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (!confirm('Replace all current data with this backup? This cannot be undone.')) return;
    await update(() => parsed);
    clearTodayWorkout();
  }

  async function resetToSeed() {
    if (!confirm('Reset all data to the built-in seed workouts? Your logs and edits will be lost.')) return;
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
            onChange={(e) => patchSettings(() => ({ units: (e.target as HTMLSelectElement).value as Units }))}
          >
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
          <div class="muted">Changing units doesn't convert anything — it only relabels weights and sets the default load increments. Logs keep the number as entered.</div>
        </div>

        <div class="field">
          <label for="deload-policy">Deload policy</label>
          <select
            id="deload-policy"
            value={settings.deloadPolicy}
            onChange={(e) => patchSettings(() => ({ deloadPolicy: (e.target as HTMLSelectElement).value as DeloadPolicy }))}
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
            onChange={(e) => patchSettings(() => ({ focus: (e.target as HTMLSelectElement).value as Focus }))}
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
            onChange={(e) => patchSettings(() => ({ masters: (e.target as HTMLInputElement).checked }))}
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
        <button class="btn btn-block" onClick={exportJson}>
          Export JSON
        </button>
        <button class="btn btn-block" onClick={pickImportFile}>
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
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
