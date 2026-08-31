import { describe, it, expect } from 'vitest';
import {
  createPreferencesStore,
  showRuler,
  serialisePreferences,
  restorePreferences,
  attachPreferencePersistence,
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
} from '@/state/preferences';
import type { MemoryStorage } from '@/state/persistence';

/**
 * Stored data is untrusted input (constitution, Storage schema).
 *
 * The matrix below is contracts/preferences-store.md turned into assertions.
 * Every failure mode DISCARDS the payload and returns the default rather than
 * partially applying it -- a broken preference must never become a broken board.
 *
 * The most load-bearing test here is the LAST one: feature 003 deliberately did
 * NOT bump the session's SCHEMA_VERSION, because restoreSession discards
 * anything whose version it does not recognise. Putting `rulerVisible` in the
 * session payload would have thrown away every in-progress board in the world
 * to gain one boolean that is not session data (research.md R2).
 */

function fakeStorage(initial: Record<string, string> = {}): MemoryStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

const throwingStorage: MemoryStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('quota exceeded'); },
  removeItem() { throw new Error('blocked'); },
};

describe('preference persistence', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('round-trips a shown ruler', () => {
    const storage = fakeStorage();
    expect(serialisePreferences({ rulerVisible: true }, storage)).toBe(true);
    expect(restorePreferences(storage)).toEqual({ rulerVisible: true });
  });

  it('round-trips a hidden ruler', () => {
    const storage = fakeStorage();
    serialisePreferences({ rulerVisible: false }, storage);
    expect(restorePreferences(storage)).toEqual({ rulerVisible: false });
  });

  it('writes under its own key, never the session key', () => {
    const storage = fakeStorage();
    serialisePreferences({ rulerVisible: true }, storage);
    expect(Object.keys(storage.data)).toEqual([PREFERENCES_KEY]);
    expect(PREFERENCES_KEY).not.toBe('agentic-sudoku/session');
  });

  it('records a schema version', () => {
    const storage = fakeStorage();
    serialisePreferences({ rulerVisible: true }, storage);
    expect(JSON.parse(storage.data[PREFERENCES_KEY]!).schemaVersion).toBe(1);
  });

  describe('untrusted input', () => {
    const cases: readonly [string, string | null][] = [
      ['an absent key', null],
      ['unparseable JSON', '{not json at all'],
      ['an empty string', ''],
      ['a JSON array', '[1,2,3]'],
      ['a JSON scalar', '42'],
      ['null', 'null'],
      ['a future schema version', '{"schemaVersion":99,"rulerVisible":true}'],
      ['a missing schema version', '{"rulerVisible":true}'],
      ['a string schema version', '{"schemaVersion":"1","rulerVisible":true}'],
      // NEVER COERCED. "true", 1, and null are not booleans, and quietly
      // treating them as one is how a tampered payload becomes behaviour.
      ['rulerVisible as the string "true"', '{"schemaVersion":1,"rulerVisible":"true"}'],
      ['rulerVisible as 1', '{"schemaVersion":1,"rulerVisible":1}'],
      ['rulerVisible as null', '{"schemaVersion":1,"rulerVisible":null}'],
      ['rulerVisible missing entirely', '{"schemaVersion":1}'],
      ['rulerVisible as an object', '{"schemaVersion":1,"rulerVisible":{}}'],
    ];

    for (const [label, raw] of cases) {
      it(`discards ${label} and returns the default`, () => {
        const storage = fakeStorage(raw === null ? {} : { [PREFERENCES_KEY]: raw });
        expect(restorePreferences(storage)).toEqual(DEFAULT_PREFERENCES);
      });
    }

    it('reads the recognised fields even when unknown extras are present', () => {
      const storage = fakeStorage({
        [PREFERENCES_KEY]: '{"schemaVersion":1,"rulerVisible":true,"somethingElse":"ignored"}',
      });
      expect(restorePreferences(storage)).toEqual({ rulerVisible: true });
    });
  });

  describe('an unavailable storage backend', () => {
    it('returns the default rather than throwing on read', () => {
      expect(() => restorePreferences(throwingStorage)).not.toThrow();
      expect(restorePreferences(throwingStorage)).toEqual(DEFAULT_PREFERENCES);
    });

    it('reports false rather than throwing on write', () => {
      expect(serialisePreferences({ rulerVisible: true }, throwingStorage)).toBe(false);
    });

    it('returns the default when there is no storage at all', () => {
      expect(restorePreferences(null)).toEqual(DEFAULT_PREFERENCES);
      expect(serialisePreferences({ rulerVisible: true }, null)).toBe(false);
    });
  });

  describe('attachPreferencePersistence', () => {
    it('writes when the preference changes', () => {
      const storage = fakeStorage();
      const store = createPreferencesStore();
      const detach = attachPreferencePersistence(store, { storage });

      store.dispatch(showRuler());
      expect(restorePreferences(storage)).toEqual({ rulerVisible: true });
      detach();
    });

    it('stops writing after detach', () => {
      const storage = fakeStorage();
      const store = createPreferencesStore();
      const detach = attachPreferencePersistence(store, { storage });
      detach();

      store.dispatch(showRuler());
      expect(restorePreferences(storage)).toEqual(DEFAULT_PREFERENCES);
    });

    it('a failing backend does not propagate into dispatch', () => {
      const store = createPreferencesStore();
      attachPreferencePersistence(store, { storage: throwingStorage });
      expect(() => store.dispatch(showRuler())).not.toThrow();
      expect(store.getState().rulerVisible).toBe(true);
    });
  });
});
