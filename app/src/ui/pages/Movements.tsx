import { useMemo, useState } from 'preact/hooks';
import { lastPerformedMovement, movementDueIn } from '../../domain/cadence';
import { state } from '../../state/store';
import { formatDueIn } from '../helpers';

export function Movements() {
  const s = state.value!;
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...s.movements]
      .filter((m) => (q ? m.name.toLowerCase().includes(q) || (m.aliases ?? []).some((a) => a.toLowerCase().includes(q)) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [s.movements, query]);

  return (
    <div>
      <h1 class="page-title">Movements</h1>
      <input
        type="search"
        placeholder="Search movements…"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        style="margin-bottom:1rem"
      />
      <div class="list">
        {rows.map((m) => {
          const last = lastPerformedMovement(s.logs, m.id);
          const dueIn = movementDueIn(m, s.logs, new Date());
          return (
            <a class="list-row" href={`/movements/${m.id}`} key={m.id}>
              <div class="list-row-main">
                <div class="list-row-title">{m.name}</div>
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
