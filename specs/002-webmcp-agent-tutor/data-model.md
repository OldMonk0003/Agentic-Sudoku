# Data Model: WebMCP Agent Tutor

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Types added or changed by this feature. Feature 001's model
([001/data-model.md](../001-sudoku-play-experience/data-model.md)) is unchanged except where noted —
and the notable thing about this document is **how little of `GameSession` moves**. The agent writes
through the actions that already exist, with `origin: 'agent'` instead of `'player'`.

## Addressing

Unchanged from 001 and restated in every tool description (FR-007): rows 1–9 top to bottom, columns
1–9 left to right, boxes 1–9 in reading order. `{ row, col }`, both 1-indexed. Flat indices remain an
Engine implementation detail and never appear at the tool boundary.

---

## What does NOT change

| Type | Why it matters that it is untouched |
|---|---|
| `Cell` | Already carries `origin: 'clue' \| 'player' \| 'agent'`. FR-044's visual distinction is a rendering change only. |
| `ChangeRecord` | Already records every cell an action touched. FR-042, FR-043, and FR-050 need no new machinery. |
| `GameSession` | **Gains no field.** Annotations, explanations, playback, and connection state live in a separate store (R3), which is what makes FR-034 structural. |
| `PersistedSession` | Unchanged, still schema v1. Nothing this feature adds is persistable, so there is no migration. |
| `Puzzle` | Unchanged. A drill is an ordinary `Puzzle` once loaded — it carries no marker distinguishing it, because none is needed after loading. |

---

## Engine additions

### `Drill`

```ts
// src/engine/drills.ts
export interface Drill {
  readonly id: string;              // 'x-wing-1'
  readonly technique: TechniqueId;  // must exist in TECHNIQUES
  readonly puzzleString: string;    // 81 chars, '-' for empty
}
```

Authored constants, bundled, no network (FR-055). Every drill is asserted by test to have exactly one
solution and to satisfy `requiresTechnique` — the guarantee behind SC-009.

### `requiresTechnique(clues, id): boolean`

```
true  ⟺  solving with (all techniques of band ≤ id's band, EXCLUDING id) stalls
     AND  solving with (that same set, INCLUDING id)                     completes
```

Pure, Engine-internal, reuses the technique modules from 001 (R9). This is the decidable definition of
"genuinely requires the technique" that FR-052 needs; without it the claim is untestable.

---

## Tools layer types

### `ToolDescriptor`

The unit of the public contract (FR-010). Enumerable with no DOM mounted (FR-011).

```ts
// src/tools/types.ts
export interface ToolDescriptor {
  readonly name: string;            // snake_case, matches the standard's [A-Za-z0-9_.-] rule
  readonly description: string;     // self-sufficient: addressing convention + return shape (FR-006)
  readonly inputSchema: JsonSchema; // the SAME object handed to the browser and to our validator (R5)
  readonly readOnly: boolean;       // → ToolAnnotations.readOnlyHint (FR-005)
  readonly execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<ToolResult>;
}

export const TOOL_SURFACE_VERSION = '1.0.0';
```

`readOnly` is the single source for both the descriptor table and the `readOnlyHint` we pass at
registration, so FR-005 cannot drift from what the tool actually does.

### `ToolResult`

```ts
export type ToolResult =
  | { readonly ok: true;  readonly tool: string; readonly surfaceVersion: string; readonly data: unknown }
  | { readonly ok: false; readonly tool: string; readonly surfaceVersion: string; readonly error: ToolError };

export interface ToolError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}
```

**A handler never rejects.** `executeTool` turns a rejection into an opaque `UnknownError` (R1), which
destroys the reason FR-009 exists to deliver.

### `ErrorCode`

A closed enumeration. The first group maps one-for-one onto the game store's existing
`RejectionReason`, so a state rejection is forwarded rather than reinterpreted.

| Code | Raised when | Requirement |
|---|---|---|
| `cell-is-clue` | target is a starting clue | FR-037 |
| `cell-not-empty` | target already holds a digit | FR-037 |
| `out-of-range` | coordinate outside 1–9 | FR-037 |
| `wrong-status` | board is paused or complete | FR-045 |
| `nothing-to-undo` | forwarded from the store | — |
| `invalid-input` | schema violation; `details.violations` lists each | FR-003, SC-012 |
| `unexpected-argument` | property not in the schema | FR-003 |
| `explanation-required` | write tool called without explanation | FR-014, FR-015 |
| `explanation-length` | outside 20–240 chars; `details` carries both bounds | FR-016 |
| `acknowledgement-required` | `auto_fill_all_pencil_marks` would replace hand-written marks without saying so | FR-041 |
| `unknown-technique` | no drill for that technique; `details.available` lists those that exist | FR-054 |
| `no-annotation-target` | beam or highlight names an empty cell set | FR-028, FR-029 |
| `playback-interrupted` | learner acted mid-sequence; `details.completedSteps` | FR-049 |
| `playback-step-failed` | a step's own precondition failed; `details` carries index and cause | FR-049 |

`declined` is **not** an error code. A learner declining a drill is an ordinary outcome and returns
`ok: true` with `data.outcome = 'declined'` (FR-053).

---

## The agent session store

`src/state/agentSession.ts` — a second store, structurally separate from the game store (R3).
Never persisted, never restored, discarded on reload (FR-034, spec edge case "Reload during an agent
session").

```ts
export interface AgentSession {
  readonly connection: ConnectionState;
  readonly annotations: readonly Annotation[];
  readonly explanations: readonly Explanation[];   // the queue, newest last
  readonly toast: Toast | null;                    // FR-030; at most one
  readonly confirmation: Confirmation | null;      // FR-053; at most one
  readonly playback: PlaybackState | null;
  readonly learnerActivity: number;                // monotonic; bumped by board input (R8)
  readonly reducedMotion: boolean;                 // supplied by the View, read by the sequencer
}

export type ConnectionState = 'absent' | 'connected' | 'disconnected';
```

`connection` drives FR-057's indicator and disconnect control. `'absent'` renders **nothing at all** —
FR-013 and SC-010 require no agent-related element on screen when no host exists, so "absent" is not a
badge saying "no agent", it is the absence of a badge.

### `Annotation`

```ts
export type Annotation =
  | { readonly id: string; readonly kind: 'cell'; readonly role: 'target' | 'because';
      readonly cells: readonly Coord[]; readonly expiresAt: number }
  | { readonly id: string; readonly kind: 'beam';
      readonly unit: { readonly type: 'row' | 'col' | 'box'; readonly n: number };
      readonly digit: Digit | null; readonly expiresAt: number };
```

`expiresAt` is an absolute timestamp, not a countdown. Expiry is therefore a **pure selector** —
`visibleAnnotations(session, now)` — with the View supplying `now`, exactly as 001 kept the timer's
interval in the View and the number in the store. Deterministic in headless tests; no interval running
in the state layer (FR-033).

### `Explanation`

```ts
export interface Explanation {
  readonly id: string;
  readonly text: string;        // 20–240 chars, agent-authored, UNTRUSTED
  readonly tool: string;        // which tool produced it — the attribution of FR-017
  readonly createdAt: number;
  readonly expiresAt: number;   // ~6 s after createdAt
}
```

**`text` is untrusted input** (FR-021). It is rendered as a text node — never `innerHTML`, never
`dangerouslySetInnerHTML`, never linkified, never parsed as markup. React's default escaping does this
for us; the point of stating it here is that it must stay true when someone later wants clickable
cell references in explanations. Registration also sets `untrustedContentHint: true` so the host knows
too.

At most three render at once; the rest queue (FR-020).

### `Toast`, `Confirmation`, `PlaybackState`

```ts
export interface Toast { readonly id: string; readonly text: string; readonly expiresAt: number; }

export interface Confirmation {
  readonly id: string;
  readonly technique: TechniqueId;
  readonly prompt: string;          // agent-authored, untrusted, rendered as text
  readonly expiresAt: number;       // unanswered after 60 s ⇒ resolves as 'declined'
}

export interface PlaybackState {
  readonly running: boolean;
  readonly totalSteps: number;
  readonly completedSteps: number;
}
```

`PlaybackState` exists so the learner can see a walkthrough is in progress and so tests can assert
FR-049's reported counts. It holds no step contents — those are the agent's, and they are consumed by
the sequencer, not stored.

### Agent session actions

| Action | Dispatched by | Effect |
|---|---|---|
| `agentConnected` / `agentDisconnected` | registry | drives the FR-057 indicator |
| `requestDisconnect` | UI (learner clicks Disconnect) | registry observes and aborts its controller |
| `addAnnotations` / `clearAnnotations` | tools | FR-028, FR-029, FR-031 |
| `pushExplanation` / `dismissExplanation` | tools / UI | FR-017, FR-019, FR-020 |
| `showToast` / `dismissToast` | tools / UI | FR-030 |
| `askConfirmation` / `answerConfirmation` | tools / UI | FR-053 |
| `playbackStarted` / `playbackAdvanced` / `playbackEnded` | sequencer | FR-047, FR-049 |
| `learnerActed` | UI, on any board key or click | the interruption signal (FR-048) |
| `setReducedMotion` | UI | FR-061 |

None of these touch `GameSession`. That separation is asserted by a test that runs the entire agent
session action set and then compares the game store's state and the serialised payload byte for byte.

---

## Game store additions

The only changes to feature 001's state layer. Each is coordinate-addressed, because **an agent must
never move the learner's selection** — the learner may be mid-thought on another cell, and FR-056
gives them uninterrupted control.

| Action | Payload | Undo | Requirement |
|---|---|---|---|
| `enterDigitAt` | `{ coord, digit, origin }` | one record | FR-036 |
| `setCandidatesAt` | `{ entries: { coord, digits }[], origin }` | **one record for all entries** | FR-039, FR-043 |
| `fillAllCandidates` | `{ origin }` | **one record for the whole board** | FR-040, FR-043 |

`enterDigit`, `toggleCandidate`, and `eraseCell` keep their selection-based signatures and delegate to
the coordinate-addressed forms, so the human path is unchanged and both paths share one implementation.

`fillAllCandidates` computes legal candidates through the Engine's existing `allCandidates`, which
reads only the visible board — so it can never leak the solution (FR-026, FR-058), and it is wrong in
exactly the way the learner's own pencilling would be wrong.

**These additions push `src/state/actions.ts` past Principle III's 300-line review trigger** (it sits
at 296). The split is planned, not incidental — see [plan.md § Project Structure](./plan.md).

---

## Traceability

| Requirement | Where it lives in this model |
|---|---|
| FR-005 | `ToolDescriptor.readOnly`, one source for hint and docs |
| FR-008, FR-009 | `ToolResult` / `ErrorCode`; handlers never reject |
| FR-010 | `TOOL_SURFACE_VERSION`, echoed in every result |
| FR-011 | `ToolDescriptor` enumerable from `registry.ts` with no DOM |
| FR-016 | explanation bounds injected into every write tool's schema |
| FR-021 | `Explanation.text` untrusted; text node only; `untrustedContentHint` |
| FR-026, FR-058 | no solution type exists above the Engine — unchanged from 001 |
| FR-033 | `expiresAt` + pure `visibleAnnotations(session, now)` |
| FR-034 | separate store; `serialiseSession` cannot see it |
| FR-042, FR-050 | ordinary `ChangeRecord`s from ordinary actions |
| FR-043 | `setCandidatesAt` and `fillAllCandidates` emit exactly one record |
| FR-052, SC-009 | `Drill` + `requiresTechnique` |
| FR-053 | `Confirmation`; `declined` is a success outcome, not an error |
| FR-057 | `ConnectionState`; `'absent'` renders nothing |
