'use client';

import { useEffect, useState } from 'react';
import { Board } from './Board';
import { Keypad } from './Keypad';
import { DifficultySelect } from './DifficultySelect';
import { RestartButton } from './RestartButton';
import { ModeToggle } from './ModeToggle';
import { RulerToggle } from './RulerToggle';
import { Timer } from './Timer';
import { Controls } from './Controls';
import { CompletionBanner } from './CompletionBanner';
import { AgentBadge } from './AgentBadge';
import { ExplanationQueue } from './ExplanationQueue';
import { AgentToast } from './AgentToast';
import { PlaybackIndicator } from './PlaybackIndicator';
import { agentStore } from './useAgentStore';
import { expire, setReducedMotion } from '@/state/agentSession';
import { resume, loadSession } from '@/state/actions';
import { store } from '@/state/store';
import { attachPersistence, restoreSession } from '@/state/persistence';
import { preferencesStore, loadPreferences } from '@/state/preferences';
import { attachPreferencePersistence, restorePreferences } from '@/state/preferences';
import { requestPuzzle } from './puzzleLoader';
import { useSelector, useSession } from './useStore';

/**
 * The application shell.
 *
 * A puzzle is requested on first mount so the player lands on a playable board
 * with no menu, prompt, or configuration step (FR-001).
 */
export function GameScreen() {
  const session = useSession();
  const hasPuzzle = useSelector((s) => s.puzzle !== null);
  const paused = session.status === 'paused';
  const [storageBlocked, setStorageBlocked] = useState(false);

  // Restore a saved session, or generate a fresh puzzle. Runs once: a failed
  // restore must fall through to a playable board, never an error state (FR-044).
  useEffect(() => {
    if (hasPuzzle) return;

    const restored = restoreSession();
    if (restored) store.dispatch(loadSession(restored));
    else requestPuzzle('easy');
  }, [hasPuzzle]);

  // Save as the session changes, debounced. onFailure fires at most once, so the
  // player is told a single time and never again (FR-042).
  useEffect(
    () => attachPersistence(store, { onFailure: () => setStorageBlocked(true) }),
    [],
  );

  /*
    The ruler preference, restored and then kept saved (003/FR-015).

    Its OWN storage key, deliberately: the session's schema version stays at 1,
    so every saved game written before this feature still restores
    (003/research.md R2). A failure here is silent -- the ruler still works for
    this session, and the single storage notice above already says "this device
    will not save".
  */
  useEffect(() => {
    preferencesStore.dispatch(loadPreferences(restorePreferences()));
    return attachPreferencePersistence(preferencesStore);
  }, []);

  /*
    THE TOOLS -> UI SEAM FOR GENERATION (003/research.md R1).

    `switch_difficulty` needs a generated puzzle, and generation lives HERE
    because `Worker` is a browser API -- while `src/tools` importing `src/ui` is
    a lint error, not a convention. So the tool raises a request on the agent
    store and this subscription performs it. Neither layer imports the other.

    The same shape `requestDisconnect` already runs in, with the arrow reversed:
    there, the Disconnect button raises a counter and registry.ts watches it.
  */
  useEffect(() => {
    let seen = agentStore.getState().puzzleRequests;
    return agentStore.subscribe(() => {
      const { puzzleRequests, puzzleRequest } = agentStore.getState();
      if (puzzleRequests === seen || !puzzleRequest) return;
      seen = puzzleRequests;
      requestPuzzle(puzzleRequest.difficulty);
    });
  }, []);

  /*
    THE VIEW OWNS THE INTERVAL; THE STORE OWNS THE NUMBER.
    Annotations and explanations carry an absolute `expiresAt`, and expiry is a
    pure selector over it -- so the state layer runs no timer and 002/FR-033 is
    deterministic in tests. This is the only thing that has to tick, and `expire`
    reports "no change" when nothing aged out, so it cannot cause a render loop.
  */
  useEffect(() => {
    const id = window.setInterval(() => agentStore.dispatch(expire({ now: Date.now() })), 500);
    return () => window.clearInterval(id);
  }, []);

  /*
    Reduced motion is read HERE and published into the store, so the tools layer
    never queries a media query of its own (002/FR-061). The sequencer reads a
    value; the browser API stays in the View.
  */
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const publish = () => agentStore.dispatch(setReducedMotion({ value: query.matches }));
    publish();
    query.addEventListener('change', publish);
    return () => query.removeEventListener('change', publish);
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center gap-6 px-4 py-8 sm:py-12">
      {storageBlocked && (
        <p
          data-testid="storage-notice"
          role="status"
          className="w-full max-w-[min(92vw,34rem)] rounded-sm border border-line-hairline bg-surface px-3 py-2 text-center text-xs text-ink-note"
        >
          Progress will not be saved on this device.
        </p>
      )}

      <header className="flex w-full flex-col items-center gap-4">
        <h1 className="text-lg font-medium tracking-[0.2em] text-ink-clue uppercase">Agentic Sudoku</h1>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <DifficultySelect />
          {/* Beside the difficulty control, NOT beside Erase and Undo. It
              replaces the board without asking, and a replaced board cannot be
              recovered (005/research.md R7). */}
          <RestartButton />
          <ModeToggle />
          {/* The learner's own control. Present with no agent, because the
              ruler is a readability aid, not an agent affordance (003/FR-013). */}
          <RulerToggle />
          <Timer />
          {/* Renders nothing at all when no agent host exists (FR-013). */}
          <AgentBadge />
        </div>
      </header>

      {/*
        The agent's voice. Both are polite live regions that never take focus and
        never block the board (002/FR-018, FR-022, SC-007). They sit ABOVE the
        board rather than over it, so nothing the agent says can obscure play.
      */}
      <PlaybackIndicator />
      <AgentToast />
      <ExplanationQueue />

      <CompletionBanner
        complete={session.status === 'complete'}
        elapsedMs={session.elapsedMs}
        onNewPuzzle={() => requestPuzzle(session.puzzle?.difficulty ?? 'easy')}
      />

      {/*
        The pause overlay. Player-initiated and dismissible at will, so it does
        not count as the blocking feedback Principle V bans -- but it must really
        obscure the board, or the clock could be stopped while solving continues
        (FR-035). Motion is handled by the global reduced-motion rule in
        globals.css rather than a bespoke check here.
      */}
      <div className="relative flex w-full flex-col items-center gap-6">
        {/*
          w-full + centring matter: without a width this wrapper shrink-wraps and
          the board's own `w-full max-w-[...]` collapses with it.
        */}
        <div
          aria-hidden={paused}
          className={[
            'flex w-full justify-center',
            paused ? 'pointer-events-none invisible' : '',
          ].join(' ')}
        >
          <Board />
        </div>

        {paused && (
          <div
            data-testid="pause-overlay"
            className={[
              // Matched to the board's own footprint rather than the full wrapper
              // width, so the curtain covers the board and nothing else.
              'absolute inset-y-0 left-1/2 -translate-x-1/2 z-20',
              'w-full max-w-[min(92vw,34rem)]',
              'flex flex-col items-center justify-center gap-4',
              'rounded-sm border border-line-hairline bg-surface',
            ].join(' ')}
          >
            <p className="text-sm text-ink-note">Paused</p>
            <button
              type="button"
              aria-label="Resume"
              onClick={() => store.dispatch(resume())}
              className={[
                'rounded-sm border border-line-box px-4 py-2 text-sm text-ink-player',
                'transition-colors hover:bg-wash-crosshair',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
              ].join(' ')}
            >
              Resume
            </button>
          </div>
        )}
      </div>

      <Controls />
      <Keypad />
    </main>
  );
}
