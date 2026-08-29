'use client';

import { useEffect } from 'react';
import { Board } from './Board';
import { Keypad } from './Keypad';
import { DifficultySelect } from './DifficultySelect';
import { ModeToggle } from './ModeToggle';
import { Timer } from './Timer';
import { Controls } from './Controls';
import { CompletionBanner } from './CompletionBanner';
import { resume } from '@/state/actions';
import { store } from '@/state/store';
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

  useEffect(() => {
    if (!hasPuzzle) requestPuzzle('easy');
  }, [hasPuzzle]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center gap-6 px-4 py-8 sm:py-12">
      <header className="flex w-full flex-col items-center gap-4">
        <h1 className="text-lg font-medium tracking-[0.2em] text-ink-clue uppercase">Agentic Sudoku</h1>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <DifficultySelect />
          <ModeToggle />
          <Timer />
        </div>
      </header>

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
