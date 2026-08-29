import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit, toggleCandidate } from '@/state/actions';
import { peersOf, toCoord, type CellIndex, type Digit } from '@/engine/grid';
import { revertRecord } from '@/state/history';

/**
 * THE critical test of this feature.
 *
 * FR-023 strips a committed digit from every peer's candidates. FR-024 requires
 * that placement and every consequent removal be ONE undoable step. Get this
 * wrong and the bug is invisible until a player presses Undo once and gets half
 * their board back -- which is why it was called out at planning time as the task
 * most likely to be got wrong.
 *
 * The assertions that matter:
 *   - exactly ONE history entry, not seven
 *   - that entry covers the placed cell AND every peer it touched
 *   - one revert restores all of them together
 *   - peers that did not hold the digit are NOT in the record
 */

function setup(): { store: Store; target: CellIndex; peers: CellIndex[] } {
  const store = createStore(emptySession());
  store.dispatch(newPuzzle('easy', 8080));

  // Pick an empty cell with at least six empty peers, so "six removals" is real.
  const cells = store.getState().cells;
  const target = cells.findIndex(
    (c, i) => c.value === null && [...peersOf(i)].filter((p) => cells[p]!.value === null).length >= 6,
  );
  const peers = [...peersOf(target)].filter((p) => cells[p]!.value === null);
  return { store, target, peers };
}

describe('auto-removal of peer candidates', () => {
  let store: Store;
  let target: CellIndex;
  let peers: CellIndex[];

  beforeEach(() => {
    ({ store, target, peers } = setup());
  });

  it('produces EXACTLY ONE history entry covering seven cells (FR-024)', () => {
    const digit: Digit = 5;
    const six = peers.slice(0, 6);

    // Pencil the digit into six peers.
    for (const peer of six) {
      store.dispatch(selectCell(toCoord(peer)));
      store.dispatch(toggleCandidate(digit, 'player'));
    }
    const historyBefore = store.getState().history.length;
    expect(historyBefore).toBe(6);

    // Commit the digit into the target.
    store.dispatch(selectCell(toCoord(target)));
    store.dispatch(enterDigit(digit, 'player'));

    // ONE more entry, not seven.
    const history = store.getState().history;
    expect(history.length).toBe(historyBefore + 1);

    const record = history.at(-1)!;
    const touched = new Set(record.after.map((c) => c.index));
    expect(touched.size).toBe(7);
    expect(touched.has(target)).toBe(true);
    for (const peer of six) expect(touched.has(peer), `peer ${peer}`).toBe(true);
  });

  it('actually strips the digit from every peer that held it (FR-023)', () => {
    const digit: Digit = 5;
    const six = peers.slice(0, 6);
    for (const peer of six) {
      store.dispatch(selectCell(toCoord(peer)));
      store.dispatch(toggleCandidate(digit, 'player'));
    }

    store.dispatch(selectCell(toCoord(target)));
    store.dispatch(enterDigit(digit, 'player'));

    for (const peer of six) {
      expect(store.getState().cells[peer]!.candidates.has(digit), `peer ${peer}`).toBe(false);
    }
  });

  it('leaves OTHER candidates in those peers alone', () => {
    const six = peers.slice(0, 6);
    for (const peer of six) {
      store.dispatch(selectCell(toCoord(peer)));
      store.dispatch(toggleCandidate(5, 'player'));
      store.dispatch(toggleCandidate(8, 'player'));
    }

    store.dispatch(selectCell(toCoord(target)));
    store.dispatch(enterDigit(5, 'player'));

    for (const peer of six) {
      expect(store.getState().cells[peer]!.candidates.has(5)).toBe(false);
      expect(store.getState().cells[peer]!.candidates.has(8), `peer ${peer} kept 8`).toBe(true);
    }
  });

  it('does NOT include peers that never held the digit', () => {
    const two = peers.slice(0, 2);
    for (const peer of two) {
      store.dispatch(selectCell(toCoord(peer)));
      store.dispatch(toggleCandidate(5, 'player'));
    }

    store.dispatch(selectCell(toCoord(target)));
    store.dispatch(enterDigit(5, 'player'));

    const record = store.getState().history.at(-1)!;
    const touched = new Set(record.after.map((c) => c.index));
    expect(touched.size).toBe(3); // the target plus exactly two peers
  });

  it('still records exactly one step when there is nothing to strip (spec edge case)', () => {
    store.dispatch(selectCell(toCoord(target)));
    const before = store.getState().history.length;
    store.dispatch(enterDigit(5, 'player'));

    const history = store.getState().history;
    expect(history.length).toBe(before + 1);
    expect(history.at(-1)!.after).toHaveLength(1);
  });

  it('keeps `before` and `after` covering the same cells', () => {
    const six = peers.slice(0, 6);
    for (const peer of six) {
      store.dispatch(selectCell(toCoord(peer)));
      store.dispatch(toggleCandidate(5, 'player'));
    }
    store.dispatch(selectCell(toCoord(target)));
    store.dispatch(enterDigit(5, 'player'));

    const record = store.getState().history.at(-1)!;
    expect(record.before.map((c) => c.index).sort()).toEqual(record.after.map((c) => c.index).sort());
  });

  it('ONE revert restores the placement AND all six stripped candidates together', () => {
    const digit: Digit = 5;
    const six = peers.slice(0, 6);
    for (const peer of six) {
      store.dispatch(selectCell(toCoord(peer)));
      store.dispatch(toggleCandidate(digit, 'player'));
    }

    // Snapshot the exact state the single undo must restore.
    const snapshot = store.getState().cells.map((c) => ({
      value: c.value,
      origin: c.origin,
      candidates: [...c.candidates].sort(),
    }));

    store.dispatch(selectCell(toCoord(target)));
    store.dispatch(enterDigit(digit, 'player'));

    // Revert that single record by hand -- the Undo control arrives in Slice 5,
    // but the record it will replay must already be correct.
    const record = store.getState().history.at(-1)!;
    const reverted = revertRecord(store.getState().cells, record);

    const after = reverted.map((c) => ({
      value: c.value,
      origin: c.origin,
      candidates: [...c.candidates].sort(),
    }));
    expect(after).toEqual(snapshot);
  });
});
