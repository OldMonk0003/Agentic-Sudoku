'use client';

import { useSelector } from './useStore';
import { requestPuzzle } from './puzzleLoader';
import type { Difficulty } from '@/state/types';

const LEVELS: readonly { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

/**
 * Changing difficulty replaces the board immediately, with no confirmation --
 * the spec's documented assumption, taken from "triggers a fresh board
 * instantly" (FR-004).
 */
export function DifficultySelect() {
  const difficulty = useSelector((s) => s.puzzle?.difficulty ?? 'easy');

  return (
    <label className="flex items-center gap-2 text-sm text-ink-note">
      <span>Difficulty</span>
      <select
        aria-label="Difficulty"
        value={difficulty}
        onChange={(event) => requestPuzzle(event.target.value as Difficulty)}
        className={[
          'rounded-sm border border-line-hairline bg-surface px-2 py-1.5',
          'text-ink-clue',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
        ].join(' ')}
      >
        {LEVELS.map((level) => (
          <option key={level.value} value={level.value}>
            {level.label}
          </option>
        ))}
      </select>
    </label>
  );
}
