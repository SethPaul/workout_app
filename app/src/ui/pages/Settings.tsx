import { useRef } from 'preact/hooks';
import type { Equipment } from '../../domain/types';
import { exportState, importState } from '../../domain/serialize';
import { clearTodayWorkout, state, update } from '../../state/store';
import { buildSeedState } from '../../storage/seed';
import { EQUIPMENT_LABELS } from '../helpers';

const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];

export function Settings() {
  const s = state.value!;
  const fileInputRef = useRef<HTMLInputElement>(null);

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
