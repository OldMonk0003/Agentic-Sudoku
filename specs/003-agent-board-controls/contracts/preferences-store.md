# Contract: The Preferences Store

**Feature**: `specs/003-agent-board-controls` | **Module**: `src/state/preferences.ts`

The third store, peer to `store.ts` (the game) and `agentSession.ts` (the agent). It holds view
preferences the learner owns: currently one, the coordinate ruler.

**Why a third store rather than a field on an existing one** is [R2](../research.md#r2). The short
version: FR-014 says the ruler is not game data and is not undoable, which rules out `GameSession`;
FR-015 says it survives a reload and FR-013 says it works with no agent, which rules out the agent
session.

## The same rules as the other two stores

- **No React, no DOM, no timers, no randomness.** Bound into React through `useSyncExternalStore`,
  like the others.
- **Every mutation goes through a named action.** There is no other write path (Principle III).
- **Dispatch never throws.** A rejection is a returned value.
- **Runs headlessly.** Enumerable and drivable in bare Node, so the ruler tools can be contract-tested
  with no DOM mounted (002/FR-011).

## Public API

```ts
export interface Preferences {
  readonly rulerVisible: boolean;
}

export type PreferencesAction =
  | { type: 'showRuler' }
  | { type: 'hideRuler' }
  | { type: 'loadPreferences'; preferences: Preferences };

export const showRuler: () => PreferencesAction;
export const hideRuler: () => PreferencesAction;
export const loadPreferences: (preferences: Preferences) => PreferencesAction;

export interface PreferencesStore {
  getState(): Preferences;
  subscribe(listener: () => void): () => void;
  dispatch(action: PreferencesAction): { ok: boolean; changed: boolean };
}

export const preferencesStore: PreferencesStore;

export const DEFAULT_PREFERENCES: Preferences;      // { rulerVisible: false }
export const PREFERENCES_KEY = 'agentic-sudoku/preferences';

export function serialisePreferences(prefs: Preferences, storage?: MemoryStorage | null): boolean;
export function restorePreferences(storage?: MemoryStorage | null): Preferences;
export function attachPreferencePersistence(store: PreferencesStore, opts?: {...}): () => void;
```

`restorePreferences` returns `DEFAULT_PREFERENCES` rather than `null` — unlike a saved game, an absent
preference has a correct answer, so there is nothing for a caller to branch on.

### No-ops are successes

```ts
preferencesStore.dispatch(showRuler());   // { ok: true, changed: true }
preferencesStore.dispatch(showRuler());   // { ok: true, changed: false }   <- FR-011
```

Both ruler tools report the no-op back to the agent (`already_visible` / `already_hidden`) rather than
failing, so an agent that has lost track of the state cannot be tripped.

## Storage payload

```json
{ "schemaVersion": 1, "rulerVisible": true }
```

**Its own key.** The session's `agentic-sudoku/session` and its `SCHEMA_VERSION = 1` are **not
touched by this feature**, so every existing saved game still restores. That is the main reason this
store exists rather than a field being added ([R2](../research.md#r2)).

### Stored data is untrusted input

| Stored value | Result |
|---|---|
| Key absent | `DEFAULT_PREFERENCES` |
| Unparseable JSON | `DEFAULT_PREFERENCES`; payload discarded |
| `schemaVersion` missing, or not `1` | `DEFAULT_PREFERENCES`; payload discarded |
| `rulerVisible` present but not a boolean | `DEFAULT_PREFERENCES`; **never coerced** — `"true"`, `1`, and `null` are all rejected |
| Extra unrecognised properties | Ignored; the recognised fields are still read |
| `localStorage` access throws (private mode, blocked cookies, full quota) | `DEFAULT_PREFERENCES`; **not a player-facing error** |

Discard rather than partially apply, per the constitution's storage rule. A failed *write* is silent:
the ruler still works for the session, it simply does not persist. The learner is not shown a second
storage warning — 001/FR-042's single notice already covers "this device will not save".

## Who writes to it

| Actor | Path |
|---|---|
| The learner | `RulerToggle.tsx` (UI) dispatches directly — FR-013, works with no agent |
| The agent | `show_coordinate_ruler` / `hide_coordinate_ruler` (Tools) dispatch directly |

Both are `state ← ui` and `state ← tools`, which the lint rules already permit. **No new seam is
needed**, and unlike `switch_difficulty`, no signalling detour: the ruler needs no browser API, so the
tool can do the work itself.

## What must remain true

| Invariant | Test |
|---|---|
| Ruler actions never appear in `GameSession.history` | New unit test: dispatch both, assert `history` is unchanged |
| Ruler state is never undoable | New unit test: undo after showing the ruler is `nothing-to-undo` |
| Ruler state never enters the session payload | Extend `tests/unit/persistence.roundtrip.test.ts`: `agentic-sudoku/session` contains no ruler field |
| An existing v1 saved session still restores after this feature | `tests/unit/persistence.roundtrip.test.ts`, unchanged and still passing |
| A throwing storage backend leaves the board fully playable | Extend `tests/unit/persistence.resilience.test.ts` |
| The store drives headlessly with no DOM | New test in the `node` project |
