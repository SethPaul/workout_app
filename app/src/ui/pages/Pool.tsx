import { useMemo, useState } from 'preact/hooks';
import { workoutDueIn } from '../../domain/cadence';
import { estimateWorkoutSeconds, formatDurationMin } from '../../domain/estimate';
import { state, update } from '../../state/store';
import { INTENSITY_LABELS, formatDueIn } from '../helpers';
import type { Intensity } from '../../domain/types';

export function Pool() {
  const s = state.value!;
  const [query, setQuery] = useState('');
  const [intensityFilter, setIntensityFilter] = useState<Intensity | 'all'>('all');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return s.pool
      .filter((w) => (intensityFilter === 'all' ? true : w.intensity === intensityFilter))
      .filter((w) => (q ? w.name.toLowerCase().includes(q) || (w.tags ?? []).some((t) => t.toLowerCase().includes(q)) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [s.pool, query, intensityFilter]);

  function toggleEnabled(id: string, enabled: boolean) {
    void update((cur) => ({
      ...cur,
      pool: cur.pool.map((w) => (w.id === id ? { ...w, enabled } : w)),
    }));
  }

  return (
    <div>
      <div class="top-bar">
        <h1 class="page-title">Pool</h1>
      </div>

      <div class="stack" style="margin-bottom:1rem">
        <input
          type="search"
          placeholder="Search name or tag…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <div class="row" style="overflow-x:auto">
          {(['all', 'H', 'M', 'L'] as const).map((opt) => (
            <button
              key={opt}
              class="btn"
              style={intensityFilter === opt ? 'border-color:var(--accent);color:var(--accent)' : ''}
              onClick={() => setIntensityFilter(opt)}
            >
              {opt === 'all' ? 'All' : INTENSITY_LABELS[opt]}
            </button>
          ))}
        </div>
      </div>

      <div class="list">
        {rows.length === 0 && <div class="empty-state">No workouts match.</div>}
        {rows.map((w) => {
          const dueIn = workoutDueIn(w, s.logs, new Date());
          return (
            <a class="list-row" href={`/pool/${w.id}`} key={w.id}>
              <div class="list-row-main">
                <div class="list-row-title">{w.name}</div>
                <div class="list-row-sub">
                  <span class={`chip chip-${w.intensity}`}>{w.intensity}</span>{' '}
                  {formatDurationMin(estimateWorkoutSeconds(w.blocks))} · {formatDueIn(dueIn)}
                </div>
              </div>
              <label class="row" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={w.enabled}
                  onChange={(e) => toggleEnabled(w.id, (e.target as HTMLInputElement).checked)}
                  aria-label={`Enable ${w.name}`}
                  style="width:22px;height:22px"
                />
              </label>
            </a>
          );
        })}
      </div>

      <a class="fab-add" href="/pool/new" aria-label="Add workout">
        +
      </a>
    </div>
  );
}
