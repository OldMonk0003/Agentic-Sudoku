import { describe, it, expect } from 'vitest';
import { createStore, emptySession } from '@/state/store';
import { newPuzzle } from '@/state/actions';
import { serialiseSession, restoreSession, STORAGE_KEY, type MemoryStorage } from '@/state/persistence';

/**
 * FR-042 and FR-044: unreadable, incompatible, or unavailable storage MUST yield
 * a fresh puzzle with no error surfaced and nothing thrown. A broken save must
 * never become a broken game.
 */

function memoryStorage(seed?: string): MemoryStorage {
  const map = new Map<string, string>();
  if (seed !== undefined) map.set(STORAGE_KEY, seed);
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** Storage that throws on every operation, as a full or blocked quota does. */
function hostileStorage(): MemoryStorage {
  return {
    getItem: () => {
      throw new DOMException('SecurityError');
    },
    setItem: () => {
      throw new DOMException('QuotaExceededError');
    },
    removeItem: () => {
      throw new DOMException('SecurityError');
    },
  };
}

describe('persistence resilience', () => {
  it('discards a future schemaVersion rather than guessing at it (FR-044)', () => {
    const storage = memoryStorage(JSON.stringify({ schemaVersion: 99, values: '-'.repeat(81) }));
    expect(restoreSession(storage)).toBeNull();
  });

  it('discards a missing schemaVersion', () => {
    const storage = memoryStorage(JSON.stringify({ values: '-'.repeat(81) }));
    expect(restoreSession(storage)).toBeNull();
  });

  it.each([
    ['not JSON at all', 'this is not json {{{'],
    ['an empty string', ''],
    ['a JSON array', '[1,2,3]'],
    ['a JSON primitive', '"hello"'],
    ['null', 'null'],
    ['an object with nothing useful', '{}'],
  ])('discards %s without throwing', (_label, payload) => {
    const storage = memoryStorage(payload);
    expect(() => restoreSession(storage)).not.toThrow();
    expect(restoreSession(storage)).toBeNull();
  });

  it.each([
    ['a short values string', { values: '-'.repeat(80) }],
    ['a bad puzzle string', { puzzleString: 'nonsense' }],
    ['an unknown difficulty', { difficulty: 'impossible' }],
    ['a bad origins string', { origins: 'xyz' }],
    ['a negative elapsed time', { elapsedMs: -1 }],
    ['an unknown status', { status: 'exploded' }],
  ])('discards a payload with %s', (_label, override) => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 777));
    const good = memoryStorage();
    serialiseSession(store.getState(), good);

    const parsed = JSON.parse(good.getItem(STORAGE_KEY)!) as Record<string, unknown>;
    const storage = memoryStorage(JSON.stringify({ ...parsed, ...override }));

    expect(() => restoreSession(storage)).not.toThrow();
    expect(restoreSession(storage)).toBeNull();
  });

  it('discards a stored puzzle that is no longer uniquely solvable', () => {
    // Local storage is untrusted input: a tampered payload must not smuggle a
    // puzzle past Principle IV's uniqueness rule.
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 888));
    const good = memoryStorage();
    serialiseSession(store.getState(), good);

    const parsed = JSON.parse(good.getItem(STORAGE_KEY)!) as Record<string, unknown>;
    // Strip almost every clue -- still well-formed, but wildly under-constrained.
    const gutted = (parsed.puzzleString as string).slice(0, 3) + '-'.repeat(78);
    const storage = memoryStorage(JSON.stringify({ ...parsed, puzzleString: gutted, values: gutted }));

    expect(restoreSession(storage)).toBeNull();
  });

  it('survives a storage backend that throws on read (FR-042)', () => {
    expect(() => restoreSession(hostileStorage())).not.toThrow();
    expect(restoreSession(hostileStorage())).toBeNull();
  });

  it('survives a storage backend that throws on write (FR-042)', () => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 999));

    expect(() => serialiseSession(store.getState(), hostileStorage())).not.toThrow();
    // And reports the failure as a return value, never as an exception.
    expect(serialiseSession(store.getState(), hostileStorage())).toBe(false);
  });

  it('reports a successful write', () => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 111));
    expect(serialiseSession(store.getState(), memoryStorage())).toBe(true);
  });

  it('does not persist a session that has no puzzle yet', () => {
    const storage = memoryStorage();
    expect(serialiseSession(emptySession(), storage)).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});
