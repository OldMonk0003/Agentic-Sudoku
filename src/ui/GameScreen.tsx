'use client';

import { useEffect } from 'react';
import { Board } from './Board';
import { Keypad } from './Keypad';
import { DifficultySelect } from './DifficultySelect';
import { requestPuzzle } from './puzzleLoader';
import { useSelector } from './useStore';

/**
 * The application shell.
 *
 * A puzzle is requested on first mount so the player lands on a playable board
 * with no menu, prompt, or configuration step (FR-001).
 */
export function GameScreen() {
  const hasPuzzle = useSelector((s) => s.puzzle !== null);

  useEffect(() => {
    if (!hasPuzzle) requestPuzzle('easy');
  }, [hasPuzzle]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center gap-6 px-4 py-8 sm:py-12">
      <header className="flex w-full flex-col items-center gap-4">
        <h1 className="text-lg font-medium tracking-[0.2em] text-ink-clue uppercase">Agentic Sudoku</h1>
        <DifficultySelect />
      </header>

      <Board />
      <Keypad />
    </main>
  );
}
