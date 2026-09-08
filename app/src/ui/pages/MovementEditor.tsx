import { useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { Equipment, Movement, Unit } from '../../domain/types';
import { daysSince } from '../../domain/cadence';
import { currentMax, e1rmHistory, E1RM_WINDOW_DAYS, type E1rmPoint } from '../../domain/program/e1rm';
import { defaultIncrement, resolveIncrement } from '../../domain/program/rpe';
import { progressionStatus, type ProgressionMode } from '../../domain/program/progression';
import { resolveSettings } from '../../domain/program/context';
import { state, update } from '../../state/store';
import { Sparkline } from '../components/Sparkline';
import { EQUIPMENT_LABELS, fmtWeight } from '../helpers';

const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];
const ALL_UNITS: Unit[] = ['reps', 'meters', 'calories', 'seconds'];

/** Same shape rule as `progression.ts`'s (unexported) defaultMode — display-only hint text. */
function defaultModeHint(m: Movement): ProgressionMode {
  return m.equipment.includes('barbell') ? 'linear' : 'double';
}

/** Same shape rule as `progression.ts`'s (unexported) defaultRepRange — display-only hint text. */
function defaultRepRangeHint(m: Movement): [number, number] {
  return m.tags.includes('accessory') ? [6, 8] : [3, 5];
}

interface CurrentMaxDetail {
  value: number;
  source: 'estimate' | 'max-test';
  date: string;
}

/** Which history point backs `currentMax` (SPEC 9.2/9.9: "with source and date"). */
function currentMaxDetail(history: E1rmPoint[], value: number, now: Date): CurrentMaxDetail | null {
  const windowed = history.filter((p) => daysSince(p.date, now) <= E1RM_WINDOW_DAYS);
  const maxTests = windowed.filter((p) => p.source === 'max-test');
  const pool = maxTests.length > 0 ? maxTests : windowed;
  let best: E1rmPoint | undefined;
  for (const p of pool) {
    if (!best || p.e1rm > best.e1rm || (p.e1rm === best.e1rm && p.date > best.date)) best = p;
  }
  if (!best) return null;
  return { value, source: best.source, date: best.date };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function MovementEditor() {
  const s = state.value!;
  const location = useLocation();
  const { params } = useRoute();
  const existing = s.movements.find((m) => m.id === params.id);

  const [draft, setDraft] = useState<Movement | null>(existing ? structuredClone(existing) : null);
  const [tagsInput, setTagsInput] = useState(existing?.tags.join(', ') ?? '');

  if (!existing || !draft) {
    return (
      <div class="empty-state">
        <p>Movement not found.</p>
        <a href="/movements">Back to Movements</a>
      </div>
    );
  }

  function patch(fn: (m: Movement) => void) {
    setDraft((d) => {
      if (!d) return d;
      const next = structuredClone(d);
      fn(next);
      return next;
    });
  }

  // ---- Movements -> detail (SPEC 9.2/9.4/9.9): current max, e1rm trend,
  // progression status, and PRs, computed off the saved movement/logs so
  // they don't shift while progression fields are mid-edit. ----
  const now = new Date();
  const units = resolveSettings(s.settings).units;
  const history = e1rmHistory(s.logs, existing.id);
  const maxValue = currentMax(s.logs, existing.id, now);
  const maxDetail = maxValue === null ? null : currentMaxDetail(history, maxValue, now);
  const prog = progressionStatus(existing, s.logs, s.settings);
  const bestE1rm = history.length > 0 ? Math.max(...history.map((p) => p.e1rm)) : null;
  const bestSingle = s.logs.reduce<number | null>((best, log) => {
    const result = log.results.find((r) => r.movementId === existing.id);
    if (!result) return best;
    const sets = result.sets && result.sets.length > 0 ? result.sets : [{ weight: result.weight }];
    for (const set of sets) {
      if (set.weight !== undefined && (best === null || set.weight > best)) best = set.weight;
    }
    return best;
  }, null);
  const sparkValues = history.slice(-12).map((p) => p.e1rm);

  async function save() {
    if (!draft) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const toSave: Movement = { ...draft, tags };
    await update((cur) => ({ ...cur, movements: cur.movements.map((m) => (m.id === toSave.id ? toSave : m)) }));
    location.route('/movements', true);
  }

  return (
    <div>
      <div class="top-bar">
        <a class="icon-btn" href="/movements" aria-label="Back">
          ←
        </a>
        <h1 class="page-title">{draft.name}</h1>
      </div>

      {draft.loadable && (
        <div class="card stack" style="margin-bottom:1rem">
          <div class="section-title" style="margin-top:0">
            Current max
          </div>
          {maxDetail ? (
            <div class="row-between">
              <span class="stat-value">{fmtWeight(maxDetail.value, units)}</span>
              <span class="muted">
                {maxDetail.source === 'max-test' ? 'tested' : 'estimated'} · {fmtDate(maxDetail.date)}
              </span>
            </div>
          ) : (
            <div class="muted">Log a set to calibrate.</div>
          )}

          <div class="section-title">e1RM trend (last {sparkValues.length || 0} sessions)</div>
          <Sparkline values={sparkValues} unit={units} />

          <div class="section-title">Progression</div>
          <div class="stat-row">
            <span class="stat-label">Status</span>
            <span class="stat-value" style="text-transform:capitalize">
              {prog.status}
            </span>
          </div>
          <div class="muted">{prog.suggestion}</div>

          <div class="section-title">Personal records</div>
          <div class="stat-row">
            <span class="stat-label">Best e1RM</span>
            <span class="stat-value">{bestE1rm === null ? '—' : fmtWeight(bestE1rm, units)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Best single</span>
            <span class="stat-value">{bestSingle === null ? '—' : fmtWeight(bestSingle, units)}</span>
          </div>
        </div>
      )}

      <div class="stack">
        <div class="field">
          <label>Name</label>
          <input
            type="text"
            value={draft.name}
            onInput={(e) => patch((m) => (m.name = (e.target as HTMLInputElement).value))}
          />
        </div>

        <div class="field">
          <label>Cadence (minimum days between performances)</label>
          <input
            type="number"
            value={draft.cadenceDays}
            onInput={(e) => patch((m) => (m.cadenceDays = Number((e.target as HTMLInputElement).value) || 0))}
          />
        </div>

        <div class="field">
          <label>Unit</label>
          <select value={draft.unit} onChange={(e) => patch((m) => (m.unit = (e.target as HTMLSelectElement).value as Unit))}>
            {ALL_UNITS.map((u) => (
              <option value={u} key={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <label class="toggle-row">
          <span>Loadable (logs weight)</span>
          <input
            type="checkbox"
            checked={draft.loadable}
            onChange={(e) => patch((m) => (m.loadable = (e.target as HTMLInputElement).checked))}
            style="width:24px;height:24px"
          />
        </label>

        <div class="field">
          <label>Equipment required</label>
          <div class="tag-list">
            {ALL_EQUIPMENT.map((eq) => (
              <label class="tag-pill" key={eq}>
                <input
                  type="checkbox"
                  checked={draft.equipment.includes(eq)}
                  onChange={(e) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    patch((m) => {
                      m.equipment = checked ? [...m.equipment, eq] : m.equipment.filter((x) => x !== eq);
                    });
                  }}
                />
                {EQUIPMENT_LABELS[eq]}
              </label>
            ))}
          </div>
        </div>

        <div class="field">
          <label>Tags (comma separated)</label>
          <input type="text" value={tagsInput} onInput={(e) => setTagsInput((e.target as HTMLInputElement).value)} />
        </div>

        {draft.aliases && draft.aliases.length > 0 && (
          <div class="field">
            <label>Aliases</label>
            <div class="muted">{draft.aliases.join(', ')}</div>
          </div>
        )}

        {draft.loadable && (
          <>
            <div class="section-title">Progression (SPEC 9.4)</div>
            <div class="field">
              <label>Progression mode</label>
              <select
                value={draft.progression ?? ''}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  patch((m) => (m.progression = v === '' ? undefined : (v as Movement['progression'])));
                }}
              >
                <option value="">Default ({defaultModeHint(draft)})</option>
                <option value="linear">Linear (add load each success)</option>
                <option value="double">Double (add reps, then load)</option>
              </select>
            </div>

            <div class="row">
              <div class="field" style="flex:1">
                <label>Rep range — low</label>
                <input
                  type="number"
                  placeholder={String(defaultRepRangeHint(draft)[0])}
                  value={draft.repRange?.[0] ?? ''}
                  onInput={(e) => {
                    const raw = (e.target as HTMLInputElement).value;
                    const n = raw.trim() ? Number(raw) : undefined;
                    patch((m) => {
                      const hi = m.repRange?.[1] ?? defaultRepRangeHint(m)[1];
                      m.repRange = n === undefined ? undefined : [n, hi];
                    });
                  }}
                />
              </div>
              <div class="field" style="flex:1">
                <label>Rep range — high</label>
                <input
                  type="number"
                  placeholder={String(defaultRepRangeHint(draft)[1])}
                  value={draft.repRange?.[1] ?? ''}
                  onInput={(e) => {
                    const raw = (e.target as HTMLInputElement).value;
                    const n = raw.trim() ? Number(raw) : undefined;
                    patch((m) => {
                      const lo = m.repRange?.[0] ?? defaultRepRangeHint(m)[0];
                      m.repRange = n === undefined ? undefined : [lo, n];
                    });
                  }}
                />
              </div>
            </div>

            <div class="field">
              <label>Load increment ({units})</label>
              <input
                type="number"
                step="0.5"
                placeholder={String(defaultIncrement(draft, units))}
                value={draft.increment ?? ''}
                onInput={(e) => {
                  const raw = (e.target as HTMLInputElement).value;
                  patch((m) => (m.increment = raw.trim() ? Number(raw) : undefined));
                }}
              />
              <div class="muted">Currently steps by {resolveIncrement(draft, units)} {units} per progression.</div>
            </div>
          </>
        )}

        <button class="btn btn-primary btn-big btn-block" onClick={() => void save()}>
          Save
        </button>
      </div>
    </div>
  );
}
