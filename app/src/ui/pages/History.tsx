import { useMemo } from 'preact/hooks';
import { state } from '../../state/store';
import { logKind } from '../../domain/program/context';

function durationLabel(startedAt: string, finishedAt: string): string {
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.max(0, Math.round(ms / 60000));
  return `${minutes} min`;
}

const KIND_LABELS: Record<'adhoc' | 'max-test', string> = {
  adhoc: 'Logged',
  'max-test': 'Max test',
};

export function History() {
  const s = state.value!;
  const rows = useMemo(
    () => [...s.logs].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)),
    [s.logs],
  );

  return (
    <div>
      <div class="top-bar">
        <h1 class="page-title">History</h1>
      </div>

      <a class="btn btn-block" href="/history/adhoc" style="margin-bottom:1rem">
        Log something else
      </a>

      {rows.length === 0 && <div class="empty-state">No workouts logged yet.</div>}
      <div class="list">
        {rows.map((log) => {
          const kind = logKind(log);
          return (
            <a class="list-row" href={`/history/${log.id}`} key={log.id}>
              <div class="list-row-main">
                <div class="row" style="gap:0.4rem">
                  <div class="list-row-title">{log.workoutSnapshot.name}</div>
                  {kind !== 'pool' && <span class="chip-kind">{KIND_LABELS[kind]}</span>}
                </div>
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
          );
        })}
      </div>
    </div>
  );
}
