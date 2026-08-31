import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentStore,
  emptyAgentSession,
  askConfirmation,
  answerConfirmation,
  clearConfirmation,
  visibleConfirmation,
  CONFIRMATION_TTL_MS,
  type AgentStore,
} from '@/state/agentSession';

/**
 * The confirmation, generalised to two subjects (003/R8).
 *
 * Feature 002 built it for one destructive action -- loading a drill. Feature 003
 * adds a second, switching difficulty, so `technique` becomes `subject` and a
 * `kind` says which is being asked about.
 *
 * WHAT DOES NOT CHANGE IS THE SINGLE SLOT. The spec forbids showing the learner
 * two competing prompts, and one slot with an explicit rejection makes that
 * structural; a queue or a second slot would permit exactly the state being
 * forbidden.
 */

const NOW = 1_000_000;
let store: AgentStore;

beforeEach(() => {
  store = createAgentStore(emptyAgentSession());
});

describe('the generalised confirmation', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('carries the kind and the subject being asked about', () => {
    store.dispatch(askConfirmation({
      kind: 'difficulty', subject: 'hard',
      prompt: 'You have cleared three easy boards quickly, so let us try a hard one now.',
      now: NOW,
    }));

    const confirmation = visibleConfirmation(store.getState(), NOW + 10)!;
    expect(confirmation.kind).toBe('difficulty');
    expect(confirmation.subject).toBe('hard');
    expect(confirmation.answer).toBeNull();
  });

  it('still serves the drill kind unchanged', () => {
    store.dispatch(askConfirmation({
      kind: 'drill', subject: 'naked-pair',
      prompt: 'A drill on naked pairs would cement what you just worked out on your own.',
      now: NOW,
    }));

    expect(visibleConfirmation(store.getState(), NOW + 10)!.kind).toBe('drill');
  });

  it('records an answer', () => {
    store.dispatch(askConfirmation({
      kind: 'difficulty', subject: 'hard', prompt: 'A harder board would suit you now.', now: NOW,
    }));
    const { id } = store.getState().confirmation!;

    store.dispatch(answerConfirmation({ id, accepted: true }));
    expect(store.getState().confirmation!.answer).toBe('accepted');
  });

  it('shows nothing once answered', () => {
    store.dispatch(askConfirmation({
      kind: 'difficulty', subject: 'hard', prompt: 'A harder board would suit you now.', now: NOW,
    }));
    const { id } = store.getState().confirmation!;
    store.dispatch(answerConfirmation({ id, accepted: false }));

    expect(visibleConfirmation(store.getState(), NOW + 10)).toBeNull();
  });

  /*
    An unanswered prompt resolves as DECLINED rather than hanging the agent's
    call forever. Sixty seconds, unchanged from 002.
  */
  it('stops being on screen once it times out', () => {
    store.dispatch(askConfirmation({
      kind: 'difficulty', subject: 'hard', prompt: 'A harder board would suit you now.', now: NOW,
    }));

    expect(visibleConfirmation(store.getState(), NOW + CONFIRMATION_TTL_MS - 1)).not.toBeNull();
    expect(visibleConfirmation(store.getState(), NOW + CONFIRMATION_TTL_MS + 1)).toBeNull();
  });

  it('clears cleanly', () => {
    store.dispatch(askConfirmation({
      kind: 'drill', subject: 'naked-pair', prompt: 'A drill would cement this nicely for you.', now: NOW,
    }));
    store.dispatch(clearConfirmation());
    expect(store.getState().confirmation).toBeNull();
  });

  /*
    THE ONE THAT MATTERS. Two prompts on screen at once would make it ambiguous
    which board the learner is agreeing to lose.
  */
  it('refuses a second ask while one is still unanswered', () => {
    store.dispatch(askConfirmation({
      kind: 'drill', subject: 'naked-pair', prompt: 'A drill would cement this nicely for you.', now: NOW,
    }));
    const first = store.getState().confirmation!;

    const result = store.dispatch(askConfirmation({
      kind: 'difficulty', subject: 'hard', prompt: 'A harder board would suit you now instead.', now: NOW,
    }));

    expect(result).toEqual({ ok: true, changed: false });
    expect(store.getState().confirmation).toEqual(first);
  });

  it('accepts a new ask once the previous one was answered', () => {
    store.dispatch(askConfirmation({
      kind: 'drill', subject: 'naked-pair', prompt: 'A drill would cement this nicely for you.', now: NOW,
    }));
    store.dispatch(answerConfirmation({ id: store.getState().confirmation!.id, accepted: false }));

    store.dispatch(askConfirmation({
      kind: 'difficulty', subject: 'hard', prompt: 'A harder board would suit you now instead.', now: NOW,
    }));
    expect(store.getState().confirmation!.kind).toBe('difficulty');
  });

  it('accepts a new ask once the previous one timed out', () => {
    store.dispatch(askConfirmation({
      kind: 'drill', subject: 'naked-pair', prompt: 'A drill would cement this nicely for you.', now: NOW,
    }));

    const later = NOW + CONFIRMATION_TTL_MS + 1;
    store.dispatch(askConfirmation({
      kind: 'difficulty', subject: 'hard', prompt: 'A harder board would suit you now instead.', now: later,
    }));
    expect(store.getState().confirmation!.kind).toBe('difficulty');
  });
});
