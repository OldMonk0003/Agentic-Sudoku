import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPreferencesStore,
  showRuler,
  hideRuler,
  loadPreferences,
  DEFAULT_PREFERENCES,
} from '@/state/preferences';

/**
 * The THIRD store: view preferences the learner owns.
 *
 * Why it is not a field on either existing store (research.md R2):
 *
 *   - not `GameSession`, because FR-014 says the ruler is not game data and is
 *     not undoable. On the session it would sit inside what ChangeRecord
 *     snapshots, inside what get_board_state returns, and inside what
 *     serialiseSession writes -- three chances to become undoable by accident;
 *   - not the agent session, because that is never persisted by design
 *     (002/FR-034) and FR-013 requires the ruler to work with NO AGENT AT ALL.
 *
 * Like the other two stores: no React, no DOM, no timers, no randomness. This
 * file runs in the `node` project, so a DOM dependency here would crash rather
 * than pass quietly.
 */

let store = createPreferencesStore();

beforeEach(() => {
  store = createPreferencesStore();
});

describe('the preferences store', () => {
  it('runs with no DOM at all', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
  });

  it('starts with the ruler hidden (FR-015)', () => {
    expect(store.getState()).toEqual({ rulerVisible: false });
    expect(DEFAULT_PREFERENCES).toEqual({ rulerVisible: false });
  });

  it('shows and hides the ruler', () => {
    expect(store.dispatch(showRuler())).toEqual({ ok: true, changed: true });
    expect(store.getState().rulerVisible).toBe(true);

    expect(store.dispatch(hideRuler())).toEqual({ ok: true, changed: true });
    expect(store.getState().rulerVisible).toBe(false);
  });

  /*
    FR-011: showing a ruler already showing, and hiding one already hidden, are
    NO-OPS THAT SUCCEED -- not failures.

    This matters at the agent boundary. The learner has their own toggle
    (FR-013), so neither actor's view of the ruler is authoritative; an agent
    that has lost track must not be punished for asking again.
  */
  it('treats a redundant show as a successful no-op (FR-011)', () => {
    store.dispatch(showRuler());
    expect(store.dispatch(showRuler())).toEqual({ ok: true, changed: false });
    expect(store.getState().rulerVisible).toBe(true);
  });

  it('treats a redundant hide as a successful no-op (FR-011)', () => {
    expect(store.dispatch(hideRuler())).toEqual({ ok: true, changed: false });
    expect(store.getState().rulerVisible).toBe(false);
  });

  it('adopts a restored payload wholesale', () => {
    expect(store.dispatch(loadPreferences({ rulerVisible: true }))).toEqual({
      ok: true,
      changed: true,
    });
    expect(store.getState().rulerVisible).toBe(true);
  });

  it('notifies subscribers only when something actually changed', () => {
    let notifications = 0;
    store.subscribe(() => { notifications += 1; });

    store.dispatch(showRuler());
    expect(notifications).toBe(1);

    store.dispatch(showRuler()); // no-op
    expect(notifications).toBe(1);

    store.dispatch(hideRuler());
    expect(notifications).toBe(2);
  });

  it('stops notifying after unsubscribe', () => {
    let notifications = 0;
    const unsubscribe = store.subscribe(() => { notifications += 1; });
    store.dispatch(showRuler());
    unsubscribe();
    store.dispatch(hideRuler());
    expect(notifications).toBe(1);
  });

  /* Hostile input is a RETURNED rejection, never an exception -- the rule the
     game store established, so both actors get identical treatment. */
  it('rejects an unknown action rather than throwing', () => {
    // @ts-expect-error deliberately not a PreferencesAction
    expect(store.dispatch({ type: 'launchMissiles' })).toEqual({ ok: false, changed: false });
    // @ts-expect-error deliberately not an action at all
    expect(store.dispatch(null)).toEqual({ ok: false, changed: false });
    expect(store.getState()).toEqual(DEFAULT_PREFERENCES);
  });

  it('never mutates the state object it handed out', () => {
    const before = store.getState();
    store.dispatch(showRuler());
    expect(before.rulerVisible).toBe(false);
    expect(store.getState()).not.toBe(before);
  });
});
