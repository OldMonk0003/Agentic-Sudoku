import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit, toggleCandidate, tick, setInputMode, pause } from '@/state/actions';
import { serialiseSession, restoreSession, type MemoryStorage } from '@/state/persistence';
import { toCoord } from '@/engine/grid';

/** A minimal Storage stand-in, so these tests need no DOM at all. */
function memoryStorage(): MemoryStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function fingerprint(store: Store) {
  const s = store.getState();
  return {
    puzzleString: s.puzzle!.puzzleString,
    difficulty: s.puzzle!.difficulty,
    elapsedMs: s.elapsedMs,
    status: s.status,
    cells: s.cells.map((c) => ({
      value: c.value,
      origin: c.origin,
      candidates: [...c.candidates].sort(),
    })),
  };
}

describe('persistence round-trip', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 424242));
  });

  it('restores cells, candidates, origins, difficulty and elapsed time identically', () => {
    // Build a session with real texture: values, notes, and a clock.
    const empties = store.getState().cells.reduce<number[]>(
      (acc, c, i) => (c.value === null ? [...acc, i] : acc), []);

    store.dispatch(selectCell(toCoord(empties[0]!)));
    store.dispatch(enterDigit(7, 'player'));

    store.dispatch(setInputMode('notes'));
    store.dispatch(selectCell(toCoord(empties[1]!)));
    store.dispatch(toggleCandidate(3, 'player'));
    store.dispatch(toggleCandidate(9, 'player'));

    store.dispatch(selectCell(toCoord(empties[2]!)));
    store.dispatch(enterDigit(5, 'agent'));

    store.dispatch(tick(252_000));

    const before = fingerprint(store);
    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);

    const restored = restoreSession(storage);
    expect(restored).not.toBeNull();

    const reloaded = createStore(restored!);
    expect(fingerprint(reloaded)).toEqual(before);
  });

  it('preserves an agent origin across a reload, ready for feature 002', () => {
    const emptyIndex = store.getState().cells.findIndex((c) => c.value === null);
    store.dispatch(selectCell(toCoord(emptyIndex)));
    store.dispatch(enterDigit(4, 'agent'));

    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);
    const restored = restoreSession(storage)!;

    expect(restored.cells[emptyIndex]!.origin).toBe('agent');
  });

  it('restores clues as clues, so they stay uneditable after a reload', () => {
    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);
    const restored = restoreSession(storage)!;

    const clueCount = restored.cells.filter((c) => c.origin === 'clue').length;
    expect(clueCount).toBe(store.getState().cells.filter((c) => c.origin === 'clue').length);
    expect(clueCount).toBeGreaterThan(16);
  });

  it('does NOT restore undo history — the board comes back, the history does not', () => {
    const emptyIndex = store.getState().cells.findIndex((c) => c.value === null);
    store.dispatch(selectCell(toCoord(emptyIndex)));
    store.dispatch(enterDigit(2, 'player'));
    expect(store.getState().history).toHaveLength(1);

    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);

    // Documented behaviour, not a defect (data-model.md).
    expect(restoreSession(storage)!.history).toHaveLength(0);
  });

  it('does not restore selection or input mode', () => {
    store.dispatch(selectCell({ row: 4, col: 4 }));
    store.dispatch(setInputMode('notes'));

    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);
    const restored = restoreSession(storage)!;

    expect(restored.selection).toBeNull();
    expect(restored.inputMode).toBe('normal');
  });

  it('restores a paused session as paused', () => {
    store.dispatch(pause());

    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);
    expect(restoreSession(storage)!.status).toBe('paused');
  });

  it('returns null when nothing has been saved', () => {
    expect(restoreSession(memoryStorage())).toBeNull();
  });
});

/**
 * Feature 003 deliberately did NOT touch the session schema.
 *
 * The coordinate ruler is a view preference, so it went into its own store under
 * its own storage key (research.md R2). The alternative -- adding `rulerVisible`
 * to PersistedSession and bumping SCHEMA_VERSION to 2 -- was rejected because
 * `restoreSession` discards any payload whose version it does not recognise.
 * That would have thrown away every in-progress board in the world to gain one
 * boolean that is not session data.
 *
 * These two tests are what make that promise checkable rather than merely
 * stated.
 */
describe('feature 003 left the session schema alone', () => {
  it('a session payload written before feature 003 still restores', () => {
    // Byte-for-byte the v1 shape, as an older build would have written it.
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 987654));
    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);

    const raw = JSON.parse(storage.getItem('agentic-sudoku/session')!);
    expect(raw.schemaVersion).toBe(1);

    const restored = restoreSession(storage);
    expect(restored).not.toBeNull();
    expect(restored!.puzzle!.puzzleString).toBe(store.getState().puzzle!.puzzleString);
  });

  it('writes no ruler field into the session payload', () => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 5150));
    const storage = memoryStorage();
    serialiseSession(store.getState(), storage);

    const raw = storage.getItem('agentic-sudoku/session')!;
    expect(raw).not.toMatch(/ruler/i);
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      'candidates', 'difficulty', 'elapsedMs', 'origins', 'puzzleString', 'schemaVersion', 'status', 'values',
    ]);
  });
});
