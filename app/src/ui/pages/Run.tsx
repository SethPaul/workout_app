import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { Block, Format, WorkoutLog } from '../../domain/types';
import type { Cue, TimerEvent, TimerState } from '../../domain/timer';
import { clearTodayWorkout, state, update } from '../../state/store';
import { clearRunSession, dispatchRun, runSession, updateRunDraft } from '../../state/run';
import { resumeAudio, playCue } from '../audio';
import { vibrateForCue } from '../vibrate';
import { acquireWakeLock, releaseWakeLock } from '../wakelock';
import { formatClock, movementLine, strengthSuggestionLine, uid } from '../helpers';
import { resultsFromDraft } from '../resultsDraft';
import { ResultsForm } from '../components/ResultsForm';
import { BlockLogDetails, SetEntry } from '../components/SetEntry';

function phaseHeading(format: Format, block: Block, timer: TimerState): string {
  const phase = timer.phase;
  switch (format) {
    case 'strength': {
      const set = phase.setIndex ?? 1;
      const count = phase.setCount ?? block.sets ?? 1;
      return phase.kind === 'rest'
        ? `Rest · after set ${set} of ${count}`
        : `Set ${set} of ${count}`;
    }
    case 'emom': {
      const round = phase.round ?? 1;
      const count = phase.roundCount ?? block.rounds ?? 1;
      return `Round ${round} of ${count}`;
    }
    case 'tabata':
    case 'interval': {
      const count = phase.roundCount ?? block.rounds ?? 1;
      if (phase.round === undefined) return phase.kind === 'rest' ? 'Rest' : 'Work';
      return phase.kind === 'rest'
        ? `Rest · round ${phase.round} of ${count}`
        : `Round ${phase.round} of ${count}`;
    }
    case 'amrap':
      return 'AMRAP';
    case 'rounds':
      return block.rounds
        ? `Round ${timer.roundsDone + 1} of ${block.rounds}`
        : `Round ${timer.roundsDone + 1}`;
    case 'chipper': {
      const idx = timer._chipperIndex ?? 0;
      return `Movement ${idx + 1} of ${block.movements.length}`;
    }
    case 'death_by':
      return phase.repsDue !== undefined
        ? `Minute ${phase.repsDue} — ${phase.repsDue} reps`
        : phase.label;
  }
}

function playCues(cues: Cue[], soundOn: boolean, vibrateOn: boolean): void {
  for (const cue of cues) {
    if (soundOn) playCue(cue);
    if (vibrateOn) vibrateForCue(cue.type);
  }
}

export function Run() {
  const location = useLocation();
  const session = runSession.value;
  const appState = state.value!;

  useEffect(() => {
    if (!session) location.route('/', true);
  }, [session]);

  useEffect(() => {
    const id = setInterval(() => {
      const s = runSession.value;
      if (!s || s.timer.status !== 'running') return;
      const timer = dispatchRun({ type: 'tick', now: Date.now() });
      if (timer)
        playCues(timer.pendingCues, appState.settings.soundOn, appState.settings.vibrateOn);
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => releaseWakeLock();
  }, []);

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      const status = runSession.value?.timer.status;
      if (status && status !== 'finished' && status !== 'idle') {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    if (session && session.timer.status === 'finished') {
      releaseWakeLock();
    }
  }, [session?.timer.status]);

  if (!session) return null;

  function fire(type: TimerEvent['type']) {
    const timer = dispatchRun({ type, now: Date.now() });
    if (timer) playCues(timer.pendingCues, appState.settings.soundOn, appState.settings.vibrateOn);
  }

  function handleStart() {
    resumeAudio();
    if (appState.settings.keepScreenOn) void acquireWakeLock();
    fire('start');
  }

  function handleFinishEarly() {
    const status = session!.timer.status;
    if (status !== 'finished') {
      if (!confirm('Finish this workout now? Any remaining blocks will be skipped.')) return;
    }
    fire('finish');
  }

  function handleAbandon() {
    if (!confirm('Abandon this workout without saving a log?')) return;
    releaseWakeLock();
    clearRunSession();
    location.route('/', true);
  }

  function handleSave() {
    if (!session) return;
    const results = resultsFromDraft(session.draft.movements);
    const log: WorkoutLog = {
      id: uid('log'),
      poolWorkoutId: session.poolWorkoutId,
      workoutSnapshot: session.workoutSnapshot,
      startedAt: session.startedAt,
      finishedAt: new Date().toISOString(),
      score: session.draft.score.trim() || undefined,
      results,
      notes: session.draft.notes.trim() || undefined,
      rpe: session.draft.rpe.trim() ? Number(session.draft.rpe) : undefined,
    };
    void update((s) => ({ ...s, logs: [...s.logs, log] })).then(() => {
      clearTodayWorkout();
      clearRunSession();
      location.route('/history', true);
    });
  }

  const { timer, workoutSnapshot } = session;
  const block = workoutSnapshot.blocks[timer.blockIndex];

  // ---- idle: pre-start summary ----
  if (timer.status === 'idle') {
    return (
      <div class="run-screen">
        <div class="run-top">
          <button class="btn btn-ghost" onClick={handleAbandon}>
            Cancel
          </button>
          <span class="muted">{workoutSnapshot.name}</span>
          <span class="run-top-spacer" />
        </div>
        <div class="run-body">
          <p class="run-phase-label">Ready</p>
          <p>
            {workoutSnapshot.blocks.length} block{workoutSnapshot.blocks.length === 1 ? '' : 's'}
          </p>
        </div>
        <div class="run-controls">
          <button class="btn btn-primary btn-big" onClick={handleStart}>
            Start
          </button>
        </div>
      </div>
    );
  }

  // ---- finished: results form ----
  if (timer.status === 'finished') {
    return (
      <div class="run-screen">
        <div class="run-top">
          <span class="page-title" style="font-size:1.2rem">
            Log results
          </span>
        </div>
        <ResultsForm
          snapshot={workoutSnapshot}
          draft={session.draft}
          onChange={(next) => updateRunDraft(() => next)}
          settings={appState.settings}
          movements={appState.movements}
        />
        <div class="stack" style="padding-bottom:1rem">
          <button class="btn btn-primary btn-big btn-block" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    );
  }

  // ---- between blocks: "Next: ..." screen ----
  if (timer.status === 'between-blocks') {
    return (
      <div class="run-screen">
        <div class="run-top">
          <button class="btn btn-ghost" onClick={handleFinishEarly}>
            Finish
          </button>
          <span class="muted">{workoutSnapshot.name}</span>
          <span class="run-top-spacer" />
        </div>
        <div class="run-body next-block-card">
          <p class="run-phase-label">Next: {block?.title || `Block ${timer.blockIndex + 1}`}</p>
          {block && (
            <div class="stack" style="text-align:left;width:100%">
              {block.movements.map((bm, i) => (
                <div class="movement-line" key={i}>
                  {block.format === 'strength'
                    ? strengthSuggestionLine(appState, block, bm)
                    : movementLine(appState, bm)}
                </div>
              ))}
            </div>
          )}
        </div>
        <div class="run-controls">
          <button class="btn btn-primary btn-big" onClick={() => fire('next')}>
            Begin
          </button>
        </div>
      </div>
    );
  }

  // ---- running / paused ----
  if (!block) return null;
  const format = block.format;
  const running = timer.status === 'running';
  const heading = phaseHeading(format, block, timer);
  const clock =
    timer.phase.remainingMs !== undefined
      ? formatClock(timer.phase.remainingMs)
      : formatClock(timer.phase.elapsedMs);
  const currentMovements = block.movements.filter((bm) =>
    timer.phase.movementIds.includes(bm.movementId),
  );

  const canRoundDone = format === 'amrap' || format === 'rounds';
  const canNext = format === 'chipper' || (format === 'strength' && timer.phase.kind === 'work');
  const canFail = format === 'death_by';
  const canSkipBlock = format !== 'death_by';

  return (
    <div class="run-screen">
      <div class="run-top">
        <button class="btn btn-ghost" onClick={handleFinishEarly}>
          Finish
        </button>
        <span class="muted">
          Block {timer.blockIndex + 1} of {workoutSnapshot.blocks.length}
        </span>
        <span class="run-top-spacer" />
      </div>
      <div class="run-body">
        <p class="run-phase-label">{heading}</p>
        <p class="run-timer">{clock}</p>
        {(format === 'amrap' || format === 'rounds') && (
          <p class="run-rounds">Rounds completed: {timer.roundsDone}</p>
        )}
        <div class="run-movements">
          {(currentMovements.length > 0 ? currentMovements : block.movements).map((bm, i) => (
            <div key={i}>
              {format === 'strength'
                ? strengthSuggestionLine(appState, block, bm)
                : movementLine(appState, bm)}
            </div>
          ))}
        </div>
        {format === 'strength' && (
          <SetEntry
            appState={appState}
            block={block}
            blockIndex={timer.blockIndex}
            currentSet={timer.phase.setIndex ?? 1}
            draft={session.draft}
            onChange={(next) => updateRunDraft(() => next)}
          />
        )}
        {format !== 'strength' && (
          <BlockLogDetails
            appState={appState}
            block={block}
            blockIndex={timer.blockIndex}
            draft={session.draft}
            onChange={(next) => updateRunDraft(() => next)}
          />
        )}
        {!running && <p class="status-pill">Paused</p>}
      </div>
      <div class="run-controls">
        <button class="btn btn-big" onClick={() => fire(running ? 'pause' : 'resume')}>
          {running ? 'Pause' : 'Resume'}
        </button>
        {canRoundDone && (
          <button
            class="btn btn-primary btn-big"
            onClick={() => fire('roundDone')}
            disabled={!running}
          >
            +1 Round
          </button>
        )}
        {canNext && (
          <button class="btn btn-primary btn-big" onClick={() => fire('next')} disabled={!running}>
            {format === 'chipper' ? 'Next Movement' : 'Set Done'}
          </button>
        )}
        {canFail && (
          <button class="btn btn-danger btn-big" onClick={() => fire('fail')} disabled={!running}>
            Fail
          </button>
        )}
        {canSkipBlock && (
          <button class="btn" onClick={() => fire('fail')} disabled={!running}>
            Skip Block
          </button>
        )}
      </div>
    </div>
  );
}
