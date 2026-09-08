import { useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { AppState, WorkoutLog } from '../../domain/types';
import { logKind } from '../../domain/program/context';
import { state, updateLog } from '../../state/store';
import { ResultsForm } from '../components/ResultsForm';
import { draftFromLog, logFromDraft, type ResultsDraft } from '../resultsDraft';
import { AdhocLog } from './AdhocLog';

/** "YYYY-MM-DDTHH:mm" in local time, for a `<input type="datetime-local">`. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses a `<input type="datetime-local">` value as a local-time Date. */
function fromLocalInputValue(value: string): Date {
  return new Date(value);
}

function EditPoolLog({ log, appState }: { log: WorkoutLog; appState: AppState }) {
  const location = useLocation();
  const [draft, setDraft] = useState<ResultsDraft>(() => draftFromLog(log));
  const [finishedInput, setFinishedInput] = useState(() => toLocalInputValue(log.finishedAt));
  const detailHref = `/history/${log.id}`;

  async function handleSave() {
    const newFinished = fromLocalInputValue(finishedInput);
    // Shift startedAt by the same delta so the logged duration is preserved.
    const delta = newFinished.getTime() - new Date(log.finishedAt).getTime();
    const newStarted = new Date(new Date(log.startedAt).getTime() + delta).toISOString();
    const patched = logFromDraft(log, draft);
    await updateLog(log.id, {
      results: patched.results,
      score: patched.score,
      notes: patched.notes,
      rpe: patched.rpe,
      finishedAt: newFinished.toISOString(),
      startedAt: newStarted,
    });
    location.route(detailHref, true);
  }

  return (
    <div>
      <div class="top-bar">
        <a class="icon-btn" href={detailHref} aria-label="Back">
          ←
        </a>
        <h1 class="page-title">Edit log</h1>
      </div>

      <div class="stack" style="padding-bottom:1rem">
        <div class="field">
          <label for="edit-log-when">Date &amp; time</label>
          <input
            id="edit-log-when"
            type="datetime-local"
            value={finishedInput}
            onInput={(e) => setFinishedInput((e.target as HTMLInputElement).value)}
          />
        </div>

        <ResultsForm
          snapshot={log.workoutSnapshot}
          draft={draft}
          onChange={setDraft}
          settings={appState.settings}
          movements={appState.movements}
        />

        <div class="row">
          <a class="btn btn-ghost" href={detailHref}>
            Cancel
          </a>
          <button class="btn btn-primary btn-block" onClick={() => void handleSave()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EditAdhocLog({ log }: { log: WorkoutLog }) {
  const location = useLocation();
  const detailHref = `/history/${log.id}`;
  return (
    <AdhocLog
      initialLog={log}
      onSave={(next) => updateLog(next.id, next)}
      onSaved={() => location.route(detailHref, true)}
    />
  );
}

/** Edits a saved WorkoutLog (pool, adhoc, or max-test) at `/history/:id/edit`. */
export function EditLog() {
  const s = state.value!;
  const { params } = useRoute();
  const log = s.logs.find((l) => l.id === params.id);

  if (!log) {
    return (
      <div class="empty-state">
        <p>Log not found.</p>
        <a href="/history">Back to History</a>
      </div>
    );
  }

  if (logKind(log) !== 'pool') {
    return <EditAdhocLog log={log} />;
  }

  return <EditPoolLog log={log} appState={s} />;
}
