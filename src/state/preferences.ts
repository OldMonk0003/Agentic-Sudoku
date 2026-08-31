import type { MemoryStorage } from './persistence';

/**
 * The third store: view preferences the learner owns.
 *
 * WHY IT IS SEPARATE (research.md R2). The coordinate ruler had to go somewhere,
 * and both existing stores were ruled out by a requirement rather than by taste:
 *
 *   - NOT `GameSession`. FR-014 says the ruler is not game data and is not
 *     undoable. On the session it would sit inside what `ChangeRecord`
 *     snapshots, inside what `get_board_state` returns, and inside what
 *     `serialiseSession` writes -- three separate chances to become undoable or
 *     agent-visible by accident.
 *   - NOT the agent session. That is never persisted, by design (002/FR-034),
 *     and it does not meaningfully exist without an agent -- but FR-013 requires
 *     the ruler to work with no agent at all.
 *
 * A separate storage key also means the SESSION's `SCHEMA_VERSION` stays at 1,
 * so every saved game in the world still restores. That is a migration AVOIDED,
 * not performed, and it is worth more than the tidiness of one fewer file.
 *
 * Like the other two stores: no React, no DOM, no timers, no randomness. Every
 * mutation goes through a named action, and `dispatch` never throws.
 */

export interface Preferences {
  /** FR-006. Hidden until the learner or an agent asks for it (FR-015). */
  readonly rulerVisible: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = Object.freeze({ rulerVisible: false });

export type PreferencesAction =
  | { type: 'showRuler' }
  | { type: 'hideRuler' }
  | { type: 'loadPreferences'; preferences: Preferences };

export const showRuler = (): PreferencesAction => ({ type: 'showRuler' });
export const hideRuler = (): PreferencesAction => ({ type: 'hideRuler' });
export const loadPreferences = (preferences: Preferences): PreferencesAction =>
  ({ type: 'loadPreferences', preferences });

const ACTION_TYPES: ReadonlySet<string> = new Set<PreferencesAction['type']>([
  'showRuler', 'hideRuler', 'loadPreferences',
]);

export interface PreferencesResult {
  readonly ok: boolean;
  readonly changed: boolean;
}

export interface PreferencesStore {
  getState(): Preferences;
  subscribe(listener: () => void): () => void;
  dispatch(action: PreferencesAction): PreferencesResult;
}

function reduce(state: Preferences, action: PreferencesAction): Preferences {
  switch (action.type) {
    case 'showRuler':
      return state.rulerVisible ? state : { ...state, rulerVisible: true };
    case 'hideRuler':
      return state.rulerVisible ? { ...state, rulerVisible: false } : state;
    case 'loadPreferences':
      return { rulerVisible: action.preferences.rulerVisible };
  }
}

export function createPreferencesStore(initial: Preferences = DEFAULT_PREFERENCES): PreferencesStore {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    dispatch(action: PreferencesAction): PreferencesResult {
      // Hostile input is a RETURNED rejection, never an exception -- the rule the
      // game store established, so both actors get identical treatment.
      if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
        return { ok: false, changed: false };
      }
      if (!ACTION_TYPES.has(action.type)) return { ok: false, changed: false };

      const next = reduce(state, action);

      // FR-011: a redundant show or hide is a SUCCESSFUL no-op, not a failure.
      // The learner has their own toggle, so neither actor's view of the ruler
      // is authoritative; an agent that has lost track must not be punished for
      // asking again.
      if (next === state) return { ok: true, changed: false };

      state = next;
      for (const listener of listeners) listener();
      return { ok: true, changed: true };
    },
  };
}

/** The single application preferences store. */
export const preferencesStore: PreferencesStore = createPreferencesStore();

// --- persistence -----------------------------------------------------------

export const PREFERENCES_KEY = 'agentic-sudoku/preferences';
const PREFERENCES_SCHEMA_VERSION = 1;

interface PersistedPreferences {
  readonly schemaVersion: number;
  readonly rulerVisible: boolean;
}

function defaultStorage(): MemoryStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Accessing localStorage itself throws in some privacy configurations.
    return null;
  }
}

/** Write the preference. Returns false on any failure -- never throws. */
export function serialisePreferences(
  preferences: Preferences,
  storage: MemoryStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;

  try {
    const payload: PersistedPreferences = {
      schemaVersion: PREFERENCES_SCHEMA_VERSION,
      rulerVisible: preferences.rulerVisible,
    };
    storage.setItem(PREFERENCES_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the preference, or the default.
 *
 * Unlike a saved game, an absent preference has a CORRECT answer, so this
 * returns `DEFAULT_PREFERENCES` rather than null -- there is nothing for a
 * caller to branch on.
 *
 * Stored data is untrusted input: a malformed, tampered, or future-versioned
 * payload is DISCARDED rather than partially applied, and nothing is coerced.
 * `"true"`, `1`, and `null` are not booleans.
 */
export function restorePreferences(
  storage: MemoryStorage | null = defaultStorage(),
): Preferences {
  if (!storage) return DEFAULT_PREFERENCES;

  let raw: string | null;
  try {
    raw = storage.getItem(PREFERENCES_KEY);
  } catch {
    return DEFAULT_PREFERENCES;
  }
  if (!raw) return DEFAULT_PREFERENCES;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_PREFERENCES;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_PREFERENCES;
  }

  const value = parsed as Record<string, unknown>;
  if (value.schemaVersion !== PREFERENCES_SCHEMA_VERSION) return DEFAULT_PREFERENCES;
  if (typeof value.rulerVisible !== 'boolean') return DEFAULT_PREFERENCES;

  return { rulerVisible: value.rulerVisible };
}

/**
 * Subscribe persistence to the store.
 *
 * Undebounced, unlike the session's: a preference changes when a human clicks a
 * toggle, not once per keystroke, so there is no burst to absorb.
 *
 * A failing backend is silent. The ruler still works for this session, it simply
 * does not persist, and 001/FR-042's single storage notice already covers "this
 * device will not save" -- a second warning for a view preference would be noise.
 */
export function attachPreferencePersistence(
  store: PreferencesStore,
  options: { storage?: MemoryStorage | null } = {},
): () => void {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;

  return store.subscribe(() => {
    serialisePreferences(store.getState(), storage);
  });
}
