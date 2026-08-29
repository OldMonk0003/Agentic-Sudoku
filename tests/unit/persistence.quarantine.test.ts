import { describe, it, expect } from 'vitest';
import { createStore, emptySession } from '@/state/store';
import { newPuzzle, selectCell, enterDigit } from '@/state/actions';
import { serialiseSession, STORAGE_KEY, type MemoryStorage } from '@/state/persistence';
import { solve } from '@/engine/solver';
import { toCoord, type Digit } from '@/engine/grid';

/**
 * Solution quarantine at the persistence boundary (constitution, Technology &
 * Architecture Constraints): the solution "MUST NOT be written to persisted
 * session state in a form the page can read back and display".
 *
 * The third and last of the three quarantine tests -- engine, store, storage.
 */

function memoryStorage(): MemoryStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('persisted payload never carries the solution', () => {
  it('contains no complete 81-digit grid', () => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 13579));

    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);
    const payload = storage.getItem(STORAGE_KEY)!;

    expect(/\d{81}/.test(payload)).toBe(false);
  });

  it('does not contain the puzzle’s actual solution string anywhere', () => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 24680));

    const solution = solve(store.getState().puzzle!.clues)!.join('');
    expect(solution).toHaveLength(81);

    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);

    expect(storage.getItem(STORAGE_KEY)!).not.toContain(solution);
  });

  it('has no field named anything like a solution', () => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('medium', 111213));

    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY)!) as Record<string, unknown>;

    for (const key of Object.keys(parsed)) {
      expect(key.toLowerCase()).not.toContain('solution');
      expect(key.toLowerCase()).not.toContain('answer');
    }
  });

  it('still holds no complete grid once the player has filled most of the board', () => {
    // The one case where a full grid legitimately appears is a solved board --
    // and that is the player's own work, not a leaked answer key. Short of that,
    // nothing resembling a solution may be written.
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 31415));

    const solution = solve(store.getState().puzzle!.clues)!;
    const empties = store.getState().cells.reduce<number[]>(
      (acc, c, i) => (c.value === null ? [...acc, i] : acc), []);

    // Fill all but one, so the board is one move from complete.
    for (const index of empties.slice(0, -1)) {
      store.dispatch(selectCell(toCoord(index)));
      store.dispatch(enterDigit(solution[index] as Digit, 'player'));
    }

    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);
    expect(/\d{81}/.test(storage.getItem(STORAGE_KEY)!)).toBe(false);
  });
});
