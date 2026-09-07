import { useMemo } from 'preact/hooks';
import { state } from '../../state/store';

function durationLabel(startedAt: string, finishedAt: string): string {
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.max(0, Math.round(ms / 60000));
  return `${minutes} min`;
}

export function History() {
  const s = state.value!;
  const rows = useMemo(
    () => [...s.logs].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)),
    [s.logs],
  );

  return (
    <div>
      <h1 class="page-title">History</h1>
      {rows.length === 0 && <div class="empty-state">No workouts logged yet.</div>}
      <div class="list">
        {rows.map((log) => (
          <a class="list-row" href={`/history/${log.id}`} key={log.id}>
            <div class="list-row-main">
              <div class="list-row-title">{log.workoutSnapshot.name}</div>
              <div class="list-row-sub">
                {new Date(log.finishedAt).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
                {' · '}
                {durationLabel(log.startedAt, log.finishedAt)}
                {log.score ? ` · ${log.score}` : ''}
              </div>
            </div>
            <span class={`chip chip-${log.workoutSnapshot.intensity}`}>{log.workoutSnapshot.intensity}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
