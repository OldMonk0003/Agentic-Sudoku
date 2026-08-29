'use client';

import { Board } from './Board';

/**
 * The application shell. Grows a keypad, controls, and timer in later slices;
 * Slice 0 is deliberately just the board so the aesthetic can be judged on its own.
 */
export function GameScreen() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center gap-8 px-4 py-8 sm:py-12">
      <header className="w-full text-center">
        <h1 className="text-lg font-medium tracking-[0.2em] text-ink-clue uppercase">Agentic Sudoku</h1>
      </header>

      <Board />
    </main>
  );
}
