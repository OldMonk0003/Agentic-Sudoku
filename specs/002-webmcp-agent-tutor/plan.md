# Implementation Plan: WebMCP Agent Tutor

**Branch**: `main` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-webmcp-agent-tutor/spec.md`

**Depends on**: [001 — Core Sudoku play experience](../001-sudoku-play-experience/plan.md), complete.

## Summary

Add an AI tutor to the board feature 001 built, participating through the WebMCP browser standard —
eleven tools registered on `document.modelContext`, every one of them able to see the board, and every
one that *changes* the board obliged to say why in text the learner reads.

The technical approach is shaped by four forces:

1. **The standard's real shape, verified not recalled.** `registerTool` rejects duplicate names,
   teardown is an `AbortSignal`, and `executeTool` collapses a rejected handler into an opaque
   `UnknownError`. That last fact is why every handler resolves with a structured result and never
   throws — a rejection destroys the reason FR-009 exists to deliver. See [research.md § R1](./research.md).
2. **Feature 001 already did the hard part.** The store is framework-agnostic and drivable with no DOM;
   every mutating action already takes `origin: 'clue' | 'player' | 'agent'`; the solution never leaves
   the Engine. So "an agent's move undoes exactly like a human's" (FR-042) needs no code — it is
   already true, and this feature's job is not to break it. `GameSession` gains **no field**.
3. **Ephemeral agent state needs a home that is not `GameSession`.** Annotations, explanations, and
   playback progress must never be saved (FR-034), so they live in a **second store**. That store turns
   out to be the seam between the UI and the Tools layer, letting neither import the other.
4. **The narration contract must be structural.** SC-002 and SC-003 are absolutes, so a write tool that
   forgets to narrate must be *undeclarable* rather than merely reviewable — one wrapper injects the
   `explanation` property into the schema and enforces it before any handler runs.

Delivery is **eight vertical slices**. Each ends in a deployed static site with a larger, working,
hand-drivable agent surface — `getTools()` returns 2, then 5, 6, 7, 9, 10, 11, 11.

## Technical Context

**Language/Version**: TypeScript 5.x `strict`; React 19; Node 20+ for tooling only

**Primary Dependencies**: **none added.** Next.js 16 (`output: 'export'`), React 19, Tailwind v4,
Lucide React, `sudoku-gen` — all already present. The JSON Schema validator is ~120 lines of ours
([R5](./research.md)), because a full implementation for a nine-keyword subset is not justifiable
against the bundle budget or the minimal-dependency rule.

**Integration standard**: WebMCP via `document.modelContext`, used directly — no wrapper, no SDK
([R1](./research.md)). `[SecureContext]` and Permissions Policy `tools` gated, so the surface exists
on HTTPS and localhost only.

**Storage**: unchanged. `localStorage`, schema v1, **no migration** — nothing this feature adds is
persistable.

**Testing**: Vitest (tools contract tests, agent store, engine drills), a spec-conformant fake host
(`tests/support/fakeModelContext.ts`), Playwright + axe (agent→state→view integration, a11y, perf)

**Target Platform**: evergreen browsers. WebMCP hosts get the tutor; everything else gets feature 001,
which is a supported mode, not a degraded one (FR-013)

**Project Type**: client-only static web application

**Performance Goals**: agent tool call ≤ 100 ms p95 for nine of eleven tools; annotation render within
one frame; no main-thread block beyond 16 ms during playback

**Constraints**: zero runtime network requests; no learner data leaves the device; WCAG 2.1 AA
including agent activity (FR-060); bundle budget still deferred and still reported

**Scale/Scope**: 11 tools, ~6 new UI components, 3 new game-store actions, 1 new store, 5 drill
puzzles, ~61 functional requirements

## Constitution Check

*GATE: evaluated before Phase 0, re-evaluated after Phase 1 design. Both passes recorded.*

| Principle | Gate | Pre-Phase 0 | Post-Phase 1 |
|---|---|---|---|
| **I. WebMCP compliance** | `document.modelContext` only; stable names, descriptions, strict schemas; structured results, never a thrown error; feature-detected; versioned; **registration isolated from rendering and enumerable headlessly**; idempotent and lifecycle-safe | PASS | **PASS** — surface in [contracts/webmcp-tool-surface.md](./contracts/webmcp-tool-surface.md); registration in `src/tools/registry.ts`, pulled into the client bundle by a `null`-rendering shim so nothing registers in a render path ([R2](./research.md)); idempotency guard against `InvalidStateError`; teardown by the one `AbortController` that registered everything |
| **II. Zero-backend** | No runtime network call; agent surface is in-page; nothing leaves the device | PASS | **PASS** — WebMCP is in-page by construction; drills are bundled constants ([R9](./research.md)); a zero-request assertion runs across the whole agent surface |
| **III. Modularity** | `Engine ← State ← Tools/View`; tool handlers hold no game rules and touch no DOM; one module per responsibility; 300-line review trigger | PASS | **PASS** — new lint zones forbid `ui ↔ tools` in both directions; handlers are thin adapters over existing actions; **`actions.ts` split is planned, not incidental** (see below) |
| **IV. Puzzle integrity & budgets** | Drills uniquely solvable and proven to require their technique; ≤ 100 ms tool calls; no main-thread block | PASS | **PASS with one recorded deviation** — `requiresTechnique` makes "genuinely requires" decidable ([R9](./research.md)); nine tools gate at 100 ms; **`playback_deduction_sequence` and `load_technique_practice` are exempt by design.** See Complexity Tracking |
| **V. Test-first & non-blocking** | Failing tests first; **contract test per tool**; headless enumeration; a full agent→state→view integration test including undo; nothing blocks either actor; reduced motion; non-colour cues | PASS | **PASS** — three test layers over the fake host ([R10](./research.md)); explanations are polite live regions with no focus trap; the drill confirmation is an inline banner, never a modal; annotation roles are distinguished by form before colour ([R7](./research.md)) |

**Solution quarantine**: structurally unchanged and now load-bearing for FR-026 and FR-058. No type
above the Engine can express a solution, so no tool result can contain one. `auto_fill_all_pencil_marks`
derives candidates from the *visible* board, making it wrong in exactly the ways the learner's own
pencilling would be — which is the point.

**Security posture**: this is the feature where the constitution's untrusted-input rules finally bind.
Agent input is schema-validated by our own validator before reaching State or Engine ([R5](./research.md));
agent-authored text is rendered as a text node only — no `innerHTML`, no linkification, ever
(FR-021); `untrustedContentHint: true` is set on every tool.

**Result: PASS on both evaluations, with one deliberate deviation recorded below.**

## Project Structure

### Documentation (this feature)

```text
specs/002-webmcp-agent-tutor/
├── spec.md
├── plan.md                            # This file
├── research.md                        # Phase 0 — 11 decisions, incl. the verified API shape
├── data-model.md                      # Phase 1
├── quickstart.md                      # Phase 1 — the per-slice review script
├── contracts/                         # Phase 1
│   ├── webmcp-tool-surface.md         # the public agent contract: 11 tools, schemas, results, errors
│   ├── agent-session-store.md         # the ephemeral store, the UI↔Tools seam, new game actions
│   └── annotation-and-narration.md    # visual roles, palette cost, accessibility
├── checklists/requirements.md
└── tasks.md                           # Created by /speckit-tasks, NOT by this command
```

### Source Code (repository root)

Additions and changes only; everything not listed is untouched.

```text
src/
├── engine/
│   ├── drills.ts                  # NEW — curated practice puzzles, bundled constants
│   └── requiresTechnique.ts       # NEW — the decidable definition behind FR-052/SC-009
│
├── state/
│   ├── actions.ts                 # SPLIT — the Action union, creators, ACTION_TYPES
│   ├── reduce.ts                  # NEW (from actions.ts) — routes an action to its handler
│   ├── edits.ts                   # NEW (from actions.ts) — cell mutations + the three new bulk actions
│   ├── navigation.ts              # NEW (from actions.ts) — selection and input mode
│   ├── lifecycle.ts               # NEW (from actions.ts) — load, pause, resume, tick, undo
│   └── agentSession.ts            # NEW — the second store: annotations, explanations, playback
│
├── tools/                         # NEW LAYER — the WebMCP adapter
│   ├── registry.ts                # descriptors + registerTools/unregisterTools; the ONLY document access
│   ├── AgentBootstrap.tsx         # 'use client', renders null; exists only to reach the client bundle
│   ├── types.ts                   # ToolDescriptor, ToolResult, ErrorCode
│   ├── validate.ts                # the JSON Schema subset interpreter (R5)
│   ├── narration.ts               # defineWriteTool — the narration contract, enforced once (R4)
│   ├── playback.ts                # the sequencer: injected scheduler, interruption by activity counter
│   └── tools/                     # one module per tool, eleven files
│       ├── getBoardState.ts  checkForConflicts.ts  highlightPatternCells.ts
│       ├── drawConstraintBeams.ts  showPatternHintToast.ts  clearVisualAnnotations.ts
│       ├── fillCell.ts  updatePencilMarks.ts  autoFillAllPencilMarks.ts
│       └── loadTechniquePractice.ts  playbackDeductionSequence.ts
│
└── ui/
    ├── AnnotationLayer.tsx        # NEW — absolutely positioned sibling of the grid, aria-hidden
    ├── ExplanationQueue.tsx       # NEW — ≤3 visible, polite, never focused
    ├── AgentToast.tsx             # NEW — the 5-second coaching note
    ├── ConfirmationBanner.tsx     # NEW — inline, never a modal
    ├── AgentBadge.tsx             # NEW — connected indicator + Disconnect
    ├── useAgentStore.ts           # NEW — the single useSyncExternalStore binding for store two
    ├── Board.tsx                  # CHANGED — dispatches learnerActed; renders the overlay
    └── Cell.tsx                   # CHANGED — annotation role in aria-label; agent glyph on agent cells

app/
├── globals.css                    # CHANGED — three new palette tokens (R7)
└── layout.tsx                     # CHANGED — mounts <AgentBootstrap />

tests/
├── unit/tools.surface.test.ts     # NEW — descriptors enumerable in bare node, NO DOM (FR-011)
├── contract/                      # NEW DIRECTORY — one contract test per tool (Principle V)
├── support/fakeModelContext.ts    # NEW — spec-conformant fake host (R10)
├── review/agent-demo.spec.ts      # NEW — the headed per-slice review harness (quickstart Path B)
└── integration/agent-*.spec.ts    # NEW — agent call → state → view → undo
```

**Structure Decision**: a fourth layer, `src/tools/`, sitting beside `src/ui/` exactly as the
constitution's `Engine ← State ← Tools/View` describes. Two new lint zones make the boundary real:
**`src/ui` may not import `src/tools`, and `src/tools` may not import `src/ui`.** They communicate
only through `src/state/agentSession.ts` ([contracts/agent-session-store.md](./contracts/agent-session-store.md)),
so `Board.tsx` never learns that playback exists and `playback.ts` never touches a DOM node. A third
rule confines `document` access to `registry.ts`, asserted by a test that greps every handler module —
tool handlers "MUST NOT touch the DOM directly" (Principle III), and the registration module is the
single place that must.

**The `actions.ts` split** is planned work, not a discovery. It sits at 296 lines against Principle
III's 300-line review trigger, and this feature's three new actions push it over. It is split by
responsibility — vocabulary, routing, edits, navigation, lifecycle — in Slice 2, where the first new
action lands. Feature 001's 241 unit tests are the safety net: the split ships with the suite green
and **no test file edited**, which is the evidence that it was a move rather than a rewrite.

## Vertical Slice Plan

Eight slices. **Each ends in a deployable site whose agent surface you can drive by hand** — from the
DevTools console against the real `document.modelContext` where the browser has it, or through the
headed review harness where it does not. Both paths, and the per-slice checks, are in
[quickstart.md](./quickstart.md).

| # | Slice | Tools after | What you can do at the end | Spec coverage |
|---|---|---|---|---|
| **0** | **The surface exists and can see** | **2** | Open DevTools, run `getTools()`, see two tools; call `get_board_state` and get the real board; see the "Agent connected" badge and disconnect it. Hostile input already returns codes, not exceptions. | FR-001–013, 024–027, 057, 058 |
| **1** | **The agent can point** | **5** | Ask for a highlight and watch target and justifying cells mark themselves *differently*; get a coaching toast that expires; clear it all. Nothing on the board has changed. | US1 · FR-014–023, 028, 030–035 |
| **2** | **Nothing changes silently** | **6** | The agent fills a cell — and the explanation appears with it. Undo removes it in one press. A fill without an explanation is refused before anything moves. | US2 · FR-036–038, 042, 044–046 |
| **3** | **Show me why it cannot go there** | **7** | Cast beams down a row and a column and see the constraint rather than read about it. | US3 · FR-029 |
| **4** | **Bookkeeping done for me** | **9** | Fill every candidate on the board in one narrated step — and undo the whole thing in one press. Overwriting your own marks requires the agent to admit it. | US4 · FR-039–041, 043 |
| **5** | **Walk me through it** | **10** | Watch a three-step deduction play out, each step explaining itself. Touch the board and it stops dead, keeping what it finished. | US5 · FR-047–051 |
| **6** | **Give me one to practice on** | **11** | Ask for an X-Wing drill, get asked to confirm, decline and lose nothing — or accept and get a puzzle that provably needs an X-Wing. | US6 · FR-052–055 |
| **7** | **Audit** | 11 | Read a report proving hostile-input rejection, greyscale distinguishability, screen-reader parity, tool-call latency, and no-agent equivalence with feature 001. | FR-056, 059–061 · SC-001–012 |

**Review checkpoint on every slice** (the same bar 001 held): the build produces a static export,
`out/` is served from a plain file server, that slice's script in [quickstart.md](./quickstart.md) is
walked end to end **against a real `document.modelContext` where available**, the tests pass, and the
failing-test-first order is visible in commit history per Principle V.

**Why this order.** It follows the spec's own P1–P6 priorities, which were written so each story ships
independently — with one addition in front. Slice 0 is not "infrastructure": it registers two real
tools and an agent can genuinely read the board from it, which is the smallest thing that is
recognisably the feature. Perception ships before mutation deliberately, so that at no point in the
build is there a path by which the board can change without an explanation — the narration wrapper
(Slice 1) exists *before* the first write tool (Slice 2). Beams (US3) come after `fill_cell` (US2)
because that is the spec's stated priority order, and they cost one annotation kind on a layer Slice 1
already built.

**What every slice carries rather than defers**: its own contract tests, its own accessibility
obligations, and its own no-agent parity check. Accessibility is a constitutional gate, and Slice 7 is
an audit — if the earlier slices did their job, it finds nothing. 001's audit found two real bugs, so
that is a hope, not a promise.

## Complexity Tracking

### Recorded deviation

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Principle IV — the ≤ 100 ms agent tool call budget is not met by `playback_deduction_sequence` or `load_technique_practice`.** | Both resolve only when something outside our control finishes. Playback *paces steps for a human to watch* — its duration is the feature — and FR-049 requires it to report how many steps completed and why it stopped, which is knowable only at the end. `load_technique_practice` must wait for the learner to answer a confirmation (FR-053) and report their answer. The spec already exempts playback from SC-008; this records the same reasoning against the constitution and extends it to the confirmation-gated tool. | Returning an immediate acknowledgement and finishing in the background was rejected because it makes FR-049 and FR-053 **unimplementable**: an acknowledgement cannot carry an outcome that has not happened yet, and the agent would be left unable to tell a completed walkthrough from an interrupted one. Shortening the pacing to fit 100 ms was rejected because a three-step walkthrough inside a tenth of a second is not a walkthrough. |

**Scope of the deviation**: two tools, latency only. The other nine gate the build at 100 ms p95 and
are measured in `tests/perf/`. Every other Principle IV budget continues to hold unchanged.

**What is not deviated from, and is tested**: neither tool blocks the learner for a single frame
(FR-051, FR-056, SC-007); playback is interruptible at any moment; an unanswered confirmation resolves
as `declined` after 60 s rather than hanging forever.

### Carried forward from feature 001

**The 250 KB gzipped bundle budget remains deferred**, unchanged, under 001's recorded author decision
(currently ~189 KB, reported and gating nothing). Governance requires re-validation "whenever a runtime
dependency is added or the build target changes" — **this feature adds neither**, which is part of why
the validator is 120 lines of ours rather than `ajv` ([R5](./research.md)). The number is re-reported
in Slice 7; the deferral stands and should be revisited at the first dependency change.

### Deliberate design choices

Three decisions that *look* like added complexity, recorded as cheaper than the alternative:

| Decision | Why it is not gold-plating |
|---|---|
| **A second store** rather than an `annotations` field on `GameSession` | FR-034 requires annotations to never be persisted and never to touch elapsed time or undo history. On `GameSession` those are three fields away from breaking, silently. In a separate store, `serialiseSession` has no route to the data at all — one structural test replaces permanent vigilance. ~120 lines, no dependency. |
| **A narration wrapper** rather than an explanation check in each write tool | SC-002 and SC-003 are absolutes. Nine independent implementations make them nine chances to fail, in the one place — the agent boundary — where no human is watching. Through the wrapper, a write tool that does not narrate cannot be declared. |
| **Our own 120-line schema validator** rather than `ajv` or hand-written guards | Hand-written guards beside a hand-written schema drift, and the drift *is* the failure: a tool that advertises one contract and enforces another. Driving both from one object makes drift impossible rather than tested-for. `ajv` was rejected on the bundle budget for a nine-keyword subset. |
