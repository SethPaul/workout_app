import { useMemo, useState } from 'preact/hooks';
import { lastPerformedMovement, movementDueIn } from '../../domain/cadence';
import type { BodyRegion, MovementLibrary } from '../../domain/types';
import { inLibrary } from '../../domain/vasa/library';
import { matchesRegion, REGION_LABELS } from '../../domain/vasa/region';
import { state } from '../../state/store';
import { formatDueIn } from '../helpers';

type LibraryFilter = 'all' | MovementLibrary;

const LIBRARY_FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'default', label: 'Default' },
  { value: 'vasa', label: 'Vasa' },
];

// 'Any' is a null region — no filter — rather than passing 'full' through
// matchesRegion, which would (correctly) accept everything anyway but reads
// as "Full body" was chosen rather than "no filter".
const REGION_FILTERS: { value: BodyRegion | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 'lower', label: REGION_LABELS.lower },
  { value: 'upper', label: REGION_LABELS.upper },
  { value: 'full', label: REGION_LABELS.full },
];

export function Movements() {
  const s = state.value!;
  const [query, setQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [regionFilter, setRegionFilter] = useState<BodyRegion | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...s.movements]
      .filter((m) =>
        q
          ? m.name.toLowerCase().includes(q) ||
            (m.aliases ?? []).some((a) => a.toLowerCase().includes(q))
          : true,
      )
      .filter((m) => libraryFilter === 'all' || inLibrary(m, libraryFilter))
      .filter((m) => regionFilter === null || matchesRegion(m, regionFilter))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [s.movements, query, libraryFilter, regionFilter]);

  return (
    <div>
      <h1 class="page-title">Movements</h1>
      <input
        type="search"
        placeholder="Search movements…"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        style="margin-bottom:0.75rem"
      />
      <div class="chip-row">
        {LIBRARY_FILTERS.map((f) => (
          <button
            key={f.value}
            class={`chip-toggle${libraryFilter === f.value ? ' active' : ''}`}
            onClick={() => setLibraryFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div class="chip-row" style="margin-bottom:1rem">
        {REGION_FILTERS.map((f) => (
          <button
            key={f.label}
            class={`chip-toggle${regionFilter === f.value ? ' active' : ''}`}
            onClick={() => setRegionFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div class="list">
        {rows.map((m) => {
          const last = lastPerformedMovement(s.logs, m.id);
          const dueIn = movementDueIn(m, s.logs, new Date());
          return (
            <a class="list-row" href={`/movements/${m.id}`} key={m.id}>
              <div class="list-row-main">
                <div class="row" style="gap:0.4rem">
                  <div class="list-row-title">{m.name}</div>
                  {inLibrary(m, 'vasa') && <span class="chip-kind">Vasa</span>}
                </div>
                <div class="list-row-sub">
                  Cadence {m.cadenceDays}d · {formatDueIn(dueIn)}
                  {last ? ` · last ${new Date(last).toLocaleDateString()}` : ''}
                </div>
              </div>
            </a>
          );
        })}
        {rows.length === 0 && <div class="empty-state">No movements match.</div>}
      </div>
    </div>
  );
}
