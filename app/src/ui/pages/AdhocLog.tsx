import { useMemo, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { buildAdhocLog, type AdhocEntryInput, type AdhocSetInput } from '../../domain/program/adhoc';
import { logAdhoc, state } from '../../state/store';
import { resolveSettings } from '../../domain/program/context';

interface SetDraft {
  weight: string;
  reps: string;
  rpe: string;
}

interface EntryDraft {
  movementId: string;
  sets: SetDraft[];
}

function blankSet(): SetDraft {
  return { weight: '', reps: '', rpe: '' };
}

function numOrUndef(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * "Log something else" (SPEC 9.8): a form for ad-hoc and max-test logging —
 * movements picked one at a time (searchable, same pattern as the pool
 * editor's movement picker), a growable set list per movement, notes, and a
 * "This was a max test" toggle. Saves via `buildAdhocLog` + `store.logAdhoc`.
 */
export function AdhocLog() {
  const s = state.value!;
  const location = useLocation();
  const units = resolveSettings(s.settings).units;

  const [date, setDate] = useState(todayIsoDate());
  const [entries, setEntries] = useState<EntryDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [maxTest, setMaxTest] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  const pickerMatches = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const already = new Set(entries.map((e) => e.movementId));
    const list = s.movements.filter(
      (m) => !already.has(m.id) && (q ? m.name.toLowerCase().includes(q) || (m.aliases ?? []).some((a) => a.toLowerCase().includes(q)) : true),
    );
    return list.slice(0, 25);
  }, [s.movements, entries, pickerQuery]);

  function addMovement(movementId: string) {
    setEntries((prev) => [...prev, { movementId, sets: [blankSet()] }]);
    setPickerOpen(false);
    setPickerQuery('');
  }

  function removeMovement(movementId: string) {
    setEntries((prev) => prev.filter((e) => e.movementId !== movementId));
  }

  function addSet(movementId: string) {
    setEntries((prev) => prev.map((e) => (e.movementId === movementId ? { ...e, sets: [...e.sets, blankSet()] } : e)));
  }

  function removeSet(movementId: string, index: number) {
    setEntries((prev) =>
      prev.map((e) => (e.movementId === movementId ? { ...e, sets: e.sets.filter((_, i) => i !== index) } : e)),
    );
  }

  function patchSet(movementId: string, index: number, fn: (set: SetDraft) => SetDraft) {
    setEntries((prev) =>
      prev.map((e) => (e.movementId === movementId ? { ...e, sets: e.sets.map((set, i) => (i === index ? fn(set) : set)) } : e)),
    );
  }

  function movementName(id: string): string {
    return s.movements.find((m) => m.id === id)?.name ?? id;
  }

  const canSave = entries.length > 0 && entries.every((e) => e.sets.some((set) => set.weight.trim() || set.reps.trim()));

  async function save() {
    if (!canSave) return;
    const adhocEntries: AdhocEntryInput[] = entries.map((e) => ({
      movementId: e.movementId,
      sets: e.sets
        .filter((set) => set.weight.trim() || set.reps.trim())
        .map<AdhocSetInput>((set) => ({
          weight: numOrUndef(set.weight),
          reps: numOrUndef(set.reps),
          rpe: numOrUndef(set.rpe),
        })),
    }));
    const log = buildAdhocLog({
      date: new Date(`${date}T12:00:00`),
      entries: adhocEntries,
      notes: notes.trim() || undefined,
      maxTest,
    });
    await logAdhoc(log);
    location.route('/history', true);
  }

  return (
    <div>
      <div class="top-bar">
        <a class="icon-btn" href="/history" aria-label="Back">
          ←
        </a>
        <h1 class="page-title">Log something else</h1>
      </div>

      <div class="stack">
        <div class="field">
          <label for="adhoc-date">Date</label>
          <input id="adhoc-date" type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
        </div>

        <div class="section-title">Movements</div>
        <div class="stack">
          {entries.map((entry) => (
            <div class="card stack" key={entry.movementId}>
              <div class="row-between">
                <span class="list-row-title">{movementName(entry.movementId)}</span>
                <button class="icon-btn" onClick={() => removeMovement(entry.movementId)} aria-label={`Remove ${movementName(entry.movementId)}`}>
                  ×
                </button>
              </div>
              <div class="stack">
                {entry.sets.map((set, si) => (
                  <div class="row" key={si}>
                    <span class="muted" style="width:3.5rem">
                      Set {si + 1}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder={`weight (${units})`}
                      value={set.weight}
                      onInput={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        patchSet(entry.movementId, si, (s2) => ({ ...s2, weight: v }));
                      }}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="reps"
                      value={set.reps}
                      onInput={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        patchSet(entry.movementId, si, (s2) => ({ ...s2, reps: v }));
                      }}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      max="10"
                      step="0.5"
                      placeholder="RPE"
                      value={set.rpe}
                      onInput={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        patchSet(entry.movementId, si, (s2) => ({ ...s2, rpe: v }));
                      }}
                    />
                    <button
                      class="icon-btn"
                      onClick={() => removeSet(entry.movementId, si)}
                      disabled={entry.sets.length <= 1}
                      aria-label="Remove set"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
              <button class="btn" onClick={() => addSet(entry.movementId)}>
                + Add set
              </button>
            </div>
          ))}

          {pickerOpen ? (
            <div class="card stack">
              <input
                type="search"
                autoFocus
                placeholder="Search movements…"
                value={pickerQuery}
                onInput={(e) => setPickerQuery((e.target as HTMLInputElement).value)}
              />
              <div class="list" style="max-height:220px;overflow-y:auto">
                {pickerMatches.map((m) => (
                  <button class="list-row" key={m.id} onClick={() => addMovement(m.id)}>
                    <span class="list-row-main list-row-title">{m.name}</span>
                  </button>
                ))}
                {pickerMatches.length === 0 && <div class="muted">No matches.</div>}
              </div>
              <button class="btn btn-ghost" onClick={() => setPickerOpen(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button class="btn btn-block" onClick={() => setPickerOpen(true)}>
              + Add movement
            </button>
          )}
        </div>

        <div class="field">
          <label for="adhoc-notes">Notes</label>
          <textarea id="adhoc-notes" value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
        </div>

        <label class="toggle-row">
          <span>This was a max test</span>
          <input
            type="checkbox"
            checked={maxTest}
            onChange={(e) => setMaxTest((e.target as HTMLInputElement).checked)}
            style="width:24px;height:24px"
          />
        </label>

        <button class="btn btn-primary btn-big btn-block" disabled={!canSave} onClick={() => void save()}>
          Save
        </button>
      </div>
    </div>
  );
}
