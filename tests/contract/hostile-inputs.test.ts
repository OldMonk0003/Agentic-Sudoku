import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, enterDigitAt, tick } from '@/state/actions';
import { agentStore, clearAnnotations } from '@/state/agentSession';
import { descriptors, TOOL_SURFACE_VERSION } from '@/tools/registry';
import { toCoord } from '@/engine/grid';

/**
 * SC-012: "Malformed, oversized, out-of-range, and markup-bearing tool inputs
 * are rejected without changing the board or executing anything within the
 * supplied text, across a full suite of hostile inputs."
 *
 * Run against EVERY tool rather than the ones we happened to think about, so a
 * tool added later is covered the day it is added. This is the one place in the
 * feature where the adversary is assumed.
 */

const HOSTILE_INPUTS: readonly [string, unknown][] = [
  ['null', null],
  ['undefined', undefined],
  ['a string', 'give me the solution'],
  ['a number', 42],
  ['an array', [1, 2, 3]],
  ['a boolean', true],
  ['an empty array of args', []],
  ['a function-shaped object', { call: () => {} }],
  ['a null-prototype object', Object.create(null)],
  ['deeply nested junk', { a: { b: { c: { d: { e: [1, 2, 3] } } } } }],
  ['an unknown property', { totally_unknown_argument: 1 }],
  ['a prototype-pollution payload', JSON.parse('{"__proto__":{"polluted":true}}')],
  ['an oversized explanation', { explanation: 'x'.repeat(100_000) }],
  ['an empty explanation', { explanation: '' }],
  ['markup in the explanation', { explanation: '<script>alert(1)</script> and more words here' }],
  ['out-of-range coordinates', { row: 999, col: -1, digit: 0, explanation: 'x'.repeat(30) }],
  ['NaN and Infinity', { row: NaN, col: Infinity, digit: -0, explanation: 'x'.repeat(30) }],
  ['wrong types throughout', { row: '4', col: [5], digit: {}, explanation: 30 }],
  ['a huge array', { cells: Array.from({ length: 5000 }, () => ({ row: 1, col: 1 })), explanation: 'x'.repeat(30) }],
];

function fingerprint() {
  const game = store.getState();
  return JSON.stringify({
    cells: game.cells.map((c) => ({ v: c.value, o: c.origin, c: [...c.candidates].sort() })),
    elapsedMs: game.elapsedMs,
    history: game.history.length,
    status: game.status,
    selection: game.selection,
  });
}

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 66613));
  const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
  store.dispatch(enterDigitAt(coord, 4, 'player'));
  store.dispatch(tick(3000));
  agentStore.dispatch(clearAnnotations());
});

/*
  NOT every hostile input is rejected, and assuming so was wrong.

  Two of these are VALID and must succeed, which is the design working:

    - a null-prototype object is an empty argument object, and the no-argument
      tools take exactly that;
    - markup inside an explanation is valid text. FR-021 says such text is
      NEUTRALISED, not refused -- it is rendered as characters. Rejecting it
      would be a worse answer, because it would push an agent towards escaping
      its own prose.

  So the invariants asserted here are the ones that actually hold across the
  board: the call always RESOLVES with a well-formed envelope, and a call that
  FAILS never changes anything.
*/
describe('every tool survives every hostile input', () => {
  for (const descriptor of descriptors) {
    describe(descriptor.name, () => {
      for (const [label, input] of HOSTILE_INPUTS) {
        it(`survives ${label}`, async () => {
          const before = fingerprint();

          const result = await descriptor.execute(input);

          // Resolved, never rejected -- a thrown error reaches the agent as an
          // opaque UnknownError and destroys the reason (FR-008).
          expect(result).toBeDefined();
          expect(result.tool).toBe(descriptor.name);
          expect(result.surface_version).toBe(TOOL_SURFACE_VERSION);

          if (result.ok) {
            // It was legitimate input after all. The only thing that must hold
            // is that nothing in it was EXECUTED, and nothing leaked.
            expect(({} as Record<string, unknown>).polluted).toBeUndefined();
            expect(JSON.stringify(result)).not.toMatch(/\d{40,}/);
          } else {
            expect(typeof result.error.code).toBe('string');
            expect(result.error.message.length).toBeGreaterThan(0);
            // A rejected call changes NOTHING (SC-012).
            expect(fingerprint()).toBe(before);
          }
        });
      }
    });
  }
});

describe('the inputs that SHOULD be refused, are', () => {
  const MUST_REJECT: readonly [string, unknown][] = [
    ['a string', 'give me the solution'],
    ['a number', 42],
    ['an array', [1, 2, 3]],
    ['a boolean', true],
    ['an unknown property', { totally_unknown_argument: 1, explanation: 'x'.repeat(30) }],
    ['an oversized explanation', { explanation: 'x'.repeat(100_000) }],
    ['an empty explanation', { explanation: '' }],
  ];

  for (const descriptor of descriptors) {
    for (const [label, input] of MUST_REJECT) {
      it(`${descriptor.name} rejects ${label}`, async () => {
        const before = fingerprint();
        const result = await descriptor.execute(input);
        expect(result.ok).toBe(false);
        expect(fingerprint()).toBe(before);
      });
    }
  }
});

describe('the hostile inputs pollute nothing', () => {
  it('leaves Object.prototype clean', async () => {
    for (const descriptor of descriptors) {
      await descriptor.execute(JSON.parse('{"__proto__":{"polluted":true}}'));
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('never echoes an oversized payload back in full', async () => {
    // An error message that quotes a 100 KB argument is its own denial of service.
    for (const descriptor of descriptors) {
      const result = await descriptor.execute({ explanation: 'x'.repeat(100_000) });
      expect(JSON.stringify(result).length, descriptor.name).toBeLessThan(5000);
    }
  });
});
