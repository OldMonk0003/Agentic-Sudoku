# Contract: The Agent Session Store — and the seam it creates

**Layer**: `src/state/agentSession.ts` | **Consumers**: `src/tools/`, `src/ui/`

A **second store**, structurally separate from the game store. It holds everything the agent does that
is not game data: annotations, explanations, the toast, the drill confirmation, playback progress, and
the connection state.

Same shape as the game store, same discipline — `dispatch` never throws, every rejection is a returned
value, no React import, drivable with no DOM mounted.

```ts
export interface AgentStore {
  getState(): AgentSession;
  subscribe(listener: () => void): () => void;
  dispatch(action: AgentAction): AgentDispatchResult;
}
export const agentStore: AgentStore;
```

---

## Why a second store rather than a field on `GameSession`

Three requirements are satisfied by the separation itself rather than by care:

| Requirement | How separation delivers it |
|---|---|
| FR-034 — annotations never saved | `serialiseSession` reads the **game** store. It has no route to this data. |
| FR-034 — annotations never alter elapsed time or undo history | An annotation dispatch cannot reach `history` or `elapsedMs`; they are in another module's closure. |
| FR-027 — read tools leave everything unchanged | A read tool touches neither store. |

Putting annotations on `GameSession` would leave all three one forgotten field away from breaking, and
each would fail silently. This is the same reasoning that kept derived state out of `GameSession` in
001.

---

## The seam: UI and Tools never import each other

This store is the **only** channel between the two layers, in both directions. Enforced by lint:
`src/ui` may not import `src/tools`, and `src/tools` may not import `src/ui`.

```
                  ┌──────────────┐
   src/tools ────▶│ agentSession │◀──── src/ui
                  └──────────────┘
```

| Flow | Written by | Read by | Delivers |
|---|---|---|---|
| agent highlights cells | tools | `AnnotationLayer` | FR-028 |
| agent narrates a change | tools | `ExplanationQueue` | FR-017 |
| learner touches the board | `Board` (`learnerActed`) | playback sequencer | FR-048 |
| learner clicks Disconnect | `AgentBadge` (`requestDisconnect`) | registry | FR-057 |
| learner answers a drill prompt | `ConfirmationBanner` | `load_technique_practice` | FR-053 |
| OS reduced-motion setting | `GameScreen` (`setReducedMotion`) | sequencer + layer | FR-061 |

The two interesting cases are interruption and disconnection. Neither needs a callback wired from a
component into the tools layer: the Board bumps a counter, the sequencer watches it; the badge sets a
flag, the registry watches it. Components stay ignorant of whether an agent exists at all.

---

## Actions

| Action | Payload | Dispatched by | Requirement |
|---|---|---|---|
| `agentConnected` | — | registry, after successful registration | FR-057 |
| `agentDisconnected` | — | registry, after teardown | FR-057 |
| `requestDisconnect` | — | UI | FR-057 |
| `addAnnotations` | `{ annotations, ttlMs }` | tools | FR-028, FR-029, FR-033 |
| `clearAnnotations` | — | tools | FR-031 |
| `pushExplanation` | `{ text, tool, ttlMs }` | narration wrapper only | FR-017, FR-020 |
| `dismissExplanation` | `{ id }` | UI | FR-019 |
| `showToast` | `{ text, ttlMs }` | tools | FR-030 |
| `dismissToast` | — | UI | FR-030 |
| `expire` | `{ now }` | UI, on an interval | FR-033 |
| `askConfirmation` | `{ technique, prompt, ttlMs }` | tools | FR-053 |
| `answerConfirmation` | `{ id, accepted }` | UI | FR-053 |
| `playbackStarted` | `{ totalSteps }` | sequencer | FR-047 |
| `playbackAdvanced` | — | sequencer | FR-049 |
| `playbackEnded` | — | sequencer | FR-049 |
| `learnerActed` | — | UI, on any board key or click | FR-048 |
| `setReducedMotion` | `{ value }` | UI | FR-061 |

`pushExplanation` is dispatched **only** by the narration wrapper, never by a tool handler directly —
that is what keeps "no change without an explanation" a property of the architecture rather than of
eleven implementations (R4).

---

## Expiry is a selector, not a timer

The store holds absolute `expiresAt` timestamps. Nothing in the state layer runs an interval.

```ts
export function visibleAnnotations(session: AgentSession, now: number): readonly Annotation[];
export function visibleExplanations(session: AgentSession, now: number): readonly Explanation[]; // ≤ 3
export function visibleToast(session: AgentSession, now: number): Toast | null;
```

The View drives `now` with a low-frequency interval and dispatches `expire` to reclaim memory. This is
the same division 001 used for the clock — *the View owns the interval, the store owns the number* —
and it is what makes expiry deterministic in a headless test: pass `now`, assert what is visible. No
waiting, no flake.

`visibleExplanations` caps at three (FR-020); older ones remain queued and surface as newer ones
expire.

---

## Additions to the game store

Coordinate-addressed, because **an agent must never move the learner's selection** — the learner may
be mid-thought on another cell (FR-056).

| Action | Payload | Rejects when | Undo | Requirement |
|---|---|---|---|---|
| `enterDigitAt` | `{ coord, digit, origin }` | clue, non-empty, off-grid, not `playing` | one record | FR-036, FR-037, FR-045 |
| `setCandidatesAt` | `{ entries: {coord, digits}[], origin }` | any entry invalid ⇒ **whole call rejected** | **one record, all entries** | FR-039, FR-043 |
| `fillAllCandidates` | `{ origin }` | not `playing` | **one record, whole board** | FR-040, FR-043 |

`enterDigit`, `toggleCandidate`, and `eraseCell` keep their signatures and delegate to the
coordinate-addressed forms. The human path does not change; both paths run the same code.

**All-or-nothing on `setCandidatesAt`** is not a convenience: one explanation accompanied the call, and
a partially applied batch would be narrated by text that no longer describes what happened.

`fillAllCandidates` reports how many learner-written candidates it overwrote, which is what
`auto_fill_all_pencil_marks` needs to enforce FR-041's acknowledgement.

### The `actions.ts` split

`src/state/actions.ts` is at 296 lines against Principle III's 300-line review trigger, and these three
actions push it over. Split, by responsibility rather than by size:

| Module | Owns |
|---|---|
| `src/state/actions.ts` | the `Action` union, creators, `ACTION_TYPES` — the vocabulary |
| `src/state/reduce.ts` | the dispatcher that routes an action to its handler |
| `src/state/edits.ts` | cell mutations: digits, candidates, erasure, bulk candidate writes |
| `src/state/navigation.ts` | selection and input mode |
| `src/state/lifecycle.ts` | puzzle load, session load, pause, resume, tick, undo |

Feature 001's 241 unit tests are the safety net: the split lands with the suite green and no test
edited, which is the evidence that it was a move and not a rewrite.

---

## Invariants asserted by tests

1. **Running every agent-session action leaves the game store byte-identical**, and the serialised
   persistence payload byte-identical (FR-034).
2. **`localStorage` never contains an annotation, an explanation, or the word "agent" outside the
   `origin` code `'a'`** (FR-034).
3. **`agentSession.ts` imports no React and no UI module**, and the whole store is drivable in a
   `node` environment with no DOM — the same guarantee `store.headless.test.ts` protects for the game
   store.
4. **`setCandidatesAt` with one invalid entry changes nothing** and returns a reason.
5. **`fillAllCandidates` produces exactly one `ChangeRecord`** covering every cell it touched, and one
   undo restores every prior candidate including hand-written ones (FR-043, US4 scenario 4).
6. **`enterDigitAt` does not change `session.selection`**, at any coordinate, ever.
7. **An agent-origin cell undoes identically to a player-origin cell** — the same test run twice with
   only `origin` differing, asserting identical resulting state (FR-042).
