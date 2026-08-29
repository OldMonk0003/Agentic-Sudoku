import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createStore, emptySession } from '@/state/store';
import { newPuzzle, selectCell, enterDigit } from '@/state/actions';
import { serialiseSession, STORAGE_KEY, type MemoryStorage } from '@/state/persistence';
import { toCoord } from '@/engine/grid';

/**
 * FR-051: "The system MUST NOT collect, display, or store win rates, streaks,
 * solve histories, leaderboards, or any cross-session statistics."
 *
 * Explicitly cut by the author. This asserts the absence stayed absent.
 */

const srcDir = fileURLToPath(new URL('../../src', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

const FORBIDDEN = [
  'winRate', 'win_rate', 'streak', 'leaderboard', 'highScore', 'high_score',
  'solveHistory', 'solve_history', 'statistics', 'gamesPlayed', 'gamesWon',
  'averageTime', 'personalBest',
];

describe('no statistics anywhere', () => {
  it('no source file references a statistics concept', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(srcDir)) {
      const contents = readFileSync(file, 'utf8');
      for (const term of FORBIDDEN) {
        if (contents.includes(term)) offenders.push(`${file}: ${term}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the session shape carries no cross-session counters', () => {
    const keys = Object.keys(emptySession());
    expect(keys.sort()).toEqual(
      ['cells', 'elapsedMs', 'history', 'inputMode', 'puzzle', 'selection', 'status'].sort(),
    );
  });

  it('completing a puzzle records nothing beyond the current session', () => {
    const storage: MemoryStorage = (() => {
      const map = new Map<string, string>();
      return {
        getItem: (k) => map.get(k) ?? null,
        setItem: (k, v) => void map.set(k, v),
        removeItem: (k) => void map.delete(k),
        keys: () => [...map.keys()],
      } as MemoryStorage & { keys(): string[] };
    })();

    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 4242));

    const emptyIndex = store.getState().cells.findIndex((c) => c.value === null);
    store.dispatch(selectCell(toCoord(emptyIndex)));
    store.dispatch(enterDigit(5, 'player'));
    serialiseSession(store.getState(), storage);

    // Exactly one key, and it is the current session.
    const written = (storage as MemoryStorage & { keys(): string[] }).keys();
    expect(written).toEqual([STORAGE_KEY]);

    const payload = JSON.parse(storage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      for (const term of FORBIDDEN) {
        expect(key.toLowerCase()).not.toContain(term.toLowerCase());
      }
    }
  });

  it('starting a new puzzle overwrites rather than accumulating', () => {
    const map = new Map<string, string>();
    const storage: MemoryStorage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };

    const store = createStore(emptySession());
    for (const seed of [1, 2, 3, 4, 5]) {
      store.dispatch(newPuzzle('easy', seed));
      serialiseSession(store.getState(), storage);
    }

    // One puzzle saved at a time -- no library of past games (data-model.md).
    expect(map.size).toBe(1);
  });
});
