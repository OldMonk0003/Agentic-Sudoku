import { describe, it, expect } from 'vitest';
import {
  createAgentStore,
  emptyAgentSession,
  addAnnotations,
  clearAnnotations,
  pushExplanation,
  dismissExplanation,
  showToast,
  dismissToast,
  expire,
  setReducedMotion,
  visibleAnnotations,
  visibleExplanations,
  visibleToast,
  ANNOTATION_TTL_MS,
  EXPLANATION_TTL_MS,
  TOAST_TTL_MS,
  MAX_VISIBLE_EXPLANATIONS,
} from '@/state/agentSession';

/**
 * Annotations, explanations, and the toast.
 *
 * The design point worth stating: **expiry is a SELECTOR, not a timer.** The
 * store holds absolute `expiresAt` stamps and nothing in the state layer runs an
 * interval -- the View supplies `now`, exactly as 001 kept the clock's interval
 * in the View and the number in the store.
 *
 * That is what makes FR-033 deterministic to test: pass a `now`, assert what is
 * visible. No waiting, no flake.
 */

const T0 = 1_000_000;
const store = () => createAgentStore(emptyAgentSession());

const cellMark = (role: 'target' | 'because', cells: { row: number; col: number }[]) =>
  ({ kind: 'cell' as const, role, cells });

describe('annotations', () => {
  it('records what the agent marked, with a bounded lifetime', () => {
    const s = store();
    s.dispatch(addAnnotations({ annotations: [cellMark('target', [{ row: 4, col: 5 }])], now: T0 }));

    const visible = visibleAnnotations(s.getState(), T0);
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ kind: 'cell', role: 'target' });
    expect(visible[0]!.expiresAt).toBe(T0 + ANNOTATION_TTL_MS);
  });

  it('distinguishes target from because, which is the whole teaching point', () => {
    const s = store();
    s.dispatch(
      addAnnotations({
        annotations: [
          cellMark('target', [{ row: 4, col: 5 }]),
          cellMark('because', [{ row: 4, col: 1 }, { row: 4, col: 3 }]),
        ],
        now: T0,
      }),
    );

    const roles = visibleAnnotations(s.getState(), T0).map((a) =>
      a.kind === 'cell' ? a.role : 'beam',
    );
    expect(roles).toEqual(['target', 'because']);
  });

  it('expires on its own, so an abandoned agent cannot deface the board (FR-033)', () => {
    const s = store();
    s.dispatch(addAnnotations({ annotations: [cellMark('target', [{ row: 1, col: 1 }])], now: T0 }));

    expect(visibleAnnotations(s.getState(), T0 + ANNOTATION_TTL_MS - 1)).toHaveLength(1);
    expect(visibleAnnotations(s.getState(), T0 + ANNOTATION_TTL_MS)).toHaveLength(0);
  });

  it('clears everything the agent drew on request (FR-031)', () => {
    const s = store();
    s.dispatch(addAnnotations({ annotations: [cellMark('target', [{ row: 1, col: 1 }])], now: T0 }));
    s.dispatch(showToast({ text: 'a coaching note for the learner to read', now: T0 }));

    s.dispatch(clearAnnotations());

    expect(visibleAnnotations(s.getState(), T0)).toHaveLength(0);
    expect(visibleToast(s.getState(), T0)).toBeNull();
  });

  it('gives every annotation a distinct id without touching Math.random', () => {
    // The constitution routes ALL first-party randomness through the seeded PRNG
    // in the Engine. A monotonic counter needs no randomness at all.
    const s = store();
    s.dispatch(addAnnotations({ annotations: [cellMark('target', [{ row: 1, col: 1 }])], now: T0 }));
    s.dispatch(addAnnotations({ annotations: [cellMark('target', [{ row: 2, col: 2 }])], now: T0 }));

    const ids = visibleAnnotations(s.getState(), T0).map((a) => a.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('the explanation queue', () => {
  const push = (s: ReturnType<typeof store>, text: string, now = T0) =>
    s.dispatch(pushExplanation({ text, tool: 'fill_cell', now }));

  it('carries the text, the attribution, and a readable lifetime', () => {
    const s = store();
    push(s, 'Only 7 can go here, because the other eight digits are already in this box.');

    const [explanation] = visibleExplanations(s.getState(), T0);
    expect(explanation!.text).toContain('Only 7 can go here');
    expect(explanation!.tool).toBe('fill_cell');
    expect(explanation!.expiresAt).toBe(T0 + EXPLANATION_TTL_MS);
  });

  it('QUEUES rather than replacing, and shows at most three at once (FR-020)', () => {
    const s = store();
    for (let i = 0; i < 5; i++) push(s, `explanation number ${i} for the learner`);

    // All five are held; only three are shown, so the board is never obscured.
    expect(visibleExplanations(s.getState(), T0)).toHaveLength(MAX_VISIBLE_EXPLANATIONS);
    expect(s.getState().explanations).toHaveLength(5);
  });

  it('surfaces a queued explanation as an older one expires', () => {
    const s = store();
    push(s, 'the first explanation the learner will read here', T0);
    push(s, 'the second explanation the learner will read here', T0);
    push(s, 'the third explanation the learner will read here', T0);
    push(s, 'the fourth explanation, queued behind the first three', T0 + 1000);

    const later = visibleExplanations(s.getState(), T0 + EXPLANATION_TTL_MS);
    expect(later).toHaveLength(1);
    expect(later[0]!.text).toContain('fourth');
  });

  it('is dismissible by the learner before it expires (FR-019)', () => {
    const s = store();
    push(s, 'an explanation the learner would rather not look at');
    const [explanation] = visibleExplanations(s.getState(), T0);

    s.dispatch(dismissExplanation({ id: explanation!.id }));
    expect(visibleExplanations(s.getState(), T0)).toHaveLength(0);
  });

  it('is NOT cleared by clear_visual_annotations', () => {
    // Otherwise that call would erase its own narration the instant it made it.
    const s = store();
    push(s, 'clearing my marks so we can look at the next pattern');
    s.dispatch(clearAnnotations());

    expect(visibleExplanations(s.getState(), T0)).toHaveLength(1);
  });
});

describe('the coaching toast', () => {
  it('holds one message and expires after five seconds (FR-030)', () => {
    const s = store();
    s.dispatch(showToast({ text: 'Look for a digit with only one home left in a box.', now: T0 }));

    expect(TOAST_TTL_MS).toBe(5000);
    expect(visibleToast(s.getState(), T0 + TOAST_TTL_MS - 1)).not.toBeNull();
    expect(visibleToast(s.getState(), T0 + TOAST_TTL_MS)).toBeNull();
  });

  it('is replaced rather than queued -- there is only ever one', () => {
    const s = store();
    s.dispatch(showToast({ text: 'the first coaching note shown to the learner', now: T0 }));
    s.dispatch(showToast({ text: 'the second coaching note shown to the learner', now: T0 }));

    expect(visibleToast(s.getState(), T0)!.text).toContain('second');
  });

  it('is dismissible sooner by the learner (FR-030)', () => {
    const s = store();
    s.dispatch(showToast({ text: 'a coaching note the learner has finished with', now: T0 }));
    s.dispatch(dismissToast());
    expect(visibleToast(s.getState(), T0)).toBeNull();
  });
});

describe('expiry reclaims memory without a timer in the state layer', () => {
  it('drops expired entries when the View says so', () => {
    const s = store();
    s.dispatch(addAnnotations({ annotations: [cellMark('target', [{ row: 1, col: 1 }])], now: T0 }));
    s.dispatch(pushExplanation({ text: 'an explanation that will age out', tool: 'fill_cell', now: T0 }));

    s.dispatch(expire({ now: T0 + ANNOTATION_TTL_MS + 1 }));

    expect(s.getState().annotations).toHaveLength(0);
    expect(s.getState().explanations).toHaveLength(0);
  });

  it('reports no change when nothing has expired, so it cannot cause a render loop', () => {
    const s = store();
    s.dispatch(addAnnotations({ annotations: [cellMark('target', [{ row: 1, col: 1 }])], now: T0 }));

    const result = s.dispatch(expire({ now: T0 + 1 }));
    expect(result).toEqual({ ok: true, changed: false });
  });
});

describe('reduced motion', () => {
  it('is a value in the store, so the tools layer never reads a media query', () => {
    const s = store();
    expect(s.getState().reducedMotion).toBe(false);

    s.dispatch(setReducedMotion({ value: true }));
    expect(s.getState().reducedMotion).toBe(true);
  });
});
