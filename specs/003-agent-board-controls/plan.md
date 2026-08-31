# Implementation Plan: Agent Board Controls & Coordinate Ruler

**Branch**: `003-agent-board-controls` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-agent-board-controls/spec.md`

**Builds on**: features 001 and 002, both complete. This branch should be cut from
`002-webmcp-agent-tutor`, not from `main` — `main` does not have the agent surface this feature
extends.

## Summary

Five tools are added to the WebMCP surface, taking it from eleven to sixteen: `switch_difficulty`,
`pause_timer`, `resume_timer`, `show_coordinate_ruler`, `hide_coordinate_ruler`. Two visible changes
accompany them: a **coordinate ruler** numbering the grid's rows and columns so the learner can name a
cell without counting, and an **agent spotlight** marking where the agent last acted.

The whole design turns on three decisions, each forced by an existing rule rather than chosen:

1. **`switch_difficulty` cannot reach the generator directly.** `requestPuzzle()` lives in the UI
   layer because `Worker` is a browser API, and `src/tools → src/ui` is a lint failure. The tool
   raises a request on the agent session store — the seam that already carries `requestDisconnect` in
   the other direction — and the UI performs the generation ([R1](./research.md#r1)).
2. **The ruler preference lives in a new third store with its own storage key.** It is not game data
   (FR-014) and it must survive a reload (FR-015), so neither existing store can hold it. A separate
   key also leaves the session's `SCHEMA_VERSION` at 1, so **no existing saved game is invalidated**
   ([R2](./research.md#r2)).
3. **The spotlight does not move the learner's selection.** It is a second, agent-attributed marking
   that coexists with the learner's crosshair, drawn as an edge rule rather than a wash because the
   agent's visual language is form-first by existing rule ([R3](./research.md#r3),
   [R5](./research.md#r5)). **This feature therefore does not override 002/FR-056** — the author chose
   this over literally moving the selection.

## Technical Context

**Language/Version**: TypeScript 5.9, `strict` mode. No `any` without an inline justification.

**Primary Dependencies**: Unchanged. Next.js 16 App Router (static export), React 19 client
components, Tailwind CSS 4, Lucide React, `sudoku-gen`. **This feature adds no runtime dependency**,
so Principle IV's budget re-validation trigger is not tripped.

**Storage**: `localStorage`, browser-local only. Adds one key, `agentic-sudoku/preferences`, carrying
its own schema version. The existing `agentic-sudoku/session` key and its `SCHEMA_VERSION = 1` are
**unchanged** — deliberately, so no in-progress board is discarded.

**Testing**: Vitest across three projects (`node`, `component`, `contract`) plus Playwright for e2e,
a11y, and perf. Five new tool contract tests, all written first.

**Target Platform**: Evergreen browsers. `document.modelContext` where present; fully playable
without it.

**Project Type**: Client-side static web application. Zero server runtime.

**Performance Goals**: Four of the five new tools hold Principle IV's ≤ 100 ms p95 agent tool-call
budget. `switch_difficulty` does not and cannot — see [Complexity Tracking](#complexity-tracking).
Board rendering with the ruler and spotlight stays inside the 16 ms frame budget; the spotlight's
derived cell set is 21 cells at most.

**Constraints**: No network request at any point. The solution never leaves the Engine. Palette values
only in `app/globals.css`. Layer boundaries enforced by lint. All motion honours
`prefers-reduced-motion`.

**Scale/Scope**: 16 tools; ~6 new source modules, ~8 changed; one new storage key; two new visual
elements. No change to the Engine layer at all.

## Constitution Check

*GATE: evaluated before Phase 0, re-evaluated after Phase 1 design. Both evaluations below.*

| Principle | What it demands here | Pre-design | Post-design |
|---|---|---|---|
| **I. WebMCP compliance** | Five more tools on `document.modelContext`; strict schemas; structured results, never a throw; registration outside the component tree and headlessly enumerable; idempotent; surface version raised | PASS | **PASS** — the five join the same `descriptors` array and the same `AbortController`; version 1.1.0 ([R10](./research.md#r10)); `tests/unit/tools.surface.test.ts` enumerates 16 in bare Node |
| **II. Zero-backend** | No new network request; storage tolerant of an unavailable backend | PASS | **PASS** — the new preferences store wraps every storage call exactly as `persistence.ts` does; a throwing backend yields the default (ruler hidden) |
| **III. Modular architecture** | `engine ← state ← ui/tools`; Tools must not touch the DOM; no module over ~300 lines; single responsibility | **AT RISK** — `switch_difficulty` needs a generator that lives in the UI layer | **PASS** — resolved by routing through the existing agent-session seam ([R1](./research.md#r1)), so no import direction changes and no new bridge is invented. The Engine layer is not modified by this feature at all |
| **IV. Puzzle integrity & budgets** | Generated puzzles uniquely solvable and technique-rated; ≤ 100 ms tool calls; nothing blocks a frame | **AT RISK** — `switch_difficulty` waits on a human and on generation | **PASS with the deviation extended** — uniqueness and rating come free by reusing `requestPuzzle`, which already verifies; four of five tools gate at 100 ms; `switch_difficulty` joins the two tools 002 already exempted. See [Complexity Tracking](#complexity-tracking) |
| **V. Test-first & non-blocking** | Failing tests first; a contract test per new tool; nothing blocks either actor; reduced motion; non-colour cues | **AT RISK** — an agent-initiated pause obscures the board | **PASS with one deviation recorded** — the pause overlay is pre-existing and learner-liftable at any moment (FR-043); everything else is non-blocking. See [Complexity Tracking](#complexity-tracking) |

**Solution quarantine**: unchanged and untested by this feature — none of the five new tools reads a
cell's correct answer, and none returns board contents at all beyond what already exists.
`switch_difficulty` returns the new puzzle's difficulty and clue count, never its solution.

**Security posture**: three of the five tools take no arguments beyond the mandatory explanation;
`switch_difficulty` takes one bounded enum; the ruler tools take none. This is the smallest new
untrusted-input surface any feature here has added. All five still validate through the same
validator against the same schema object.

**Accessibility**: the ruler is `aria-hidden` because every cell already announces its own coordinates
(FR-017) — adding the gutters to the accessibility tree would double every cell's announcement. The
spotlight is announced through the existing polite live region (FR-025). Both verified by the a11y
suite, not by inspection.

**Result: PASS on both evaluations, with two deviations recorded below.**

## Project Structure

### Documentation (this feature)

```text
specs/003-agent-board-controls/
├── plan.md                  # This file
├── research.md              # Phase 0 — R1..R11
├── data-model.md            # Phase 1 — new and changed shapes
├── quickstart.md            # Phase 1 — how to see it work
├── contracts/
│   ├── webmcp-tool-surface.md   # The five new tools; schemas and results
│   ├── preferences-store.md     # The third store and its storage key
│   └── spotlight-and-ruler.md   # Visual contract and a11y contract
├── checklists/
│   └── requirements.md      # Written by /speckit-specify; all items pass
└── tasks.md                 # NOT created by /speckit-plan
```

### Source code (repository root)

```text
src/
├── engine/                       UNCHANGED — this feature adds no game rules
│
├── state/
│   ├── preferences.ts            NEW  the third store: view preferences + own storage key (R2)
│   ├── spotlight.ts              NEW  the Spotlight shape and its derived cell set (R3)
│   ├── confirmation.ts           CHG  kind: 'drill' | 'difficulty'; technique -> subject (R8)
│   ├── agentActions.ts           CHG  spotlight, ruler, and puzzle-request actions
│   ├── agentReduce.ts            CHG  handlers for the above
│   └── agentSession.ts           CHG  spotlight slot; puzzleRequests counter (R1)
│
├── tools/
│   ├── narration.ts              CHG  WriteOutcome.changed -> raises the spotlight (R4)
│   ├── types.ts                  CHG  version 1.1.0; new error codes
│   ├── registry.ts               CHG  16 descriptors
│   └── tools/
│       ├── switchDifficulty.ts       NEW
│       ├── pauseTimer.ts             NEW
│       ├── resumeTimer.ts            NEW
│       ├── showCoordinateRuler.ts    NEW
│       └── hideCoordinateRuler.ts    NEW
│
└── ui/
    ├── CoordinateRuler.tsx       NEW  the gutters (R7)
    ├── RulerToggle.tsx           NEW  the learner's own control (FR-013)
    ├── usePreferences.ts         NEW  binds the preferences store to React
    ├── Board.tsx                 CHG  gutter tracks; spotlight tiers
    ├── Cell.tsx                  CHG  the spotlight edge rule (R5)
    └── GameScreen.tsx            CHG  subscribes to puzzle requests (R1)

app/globals.css                   CHG only if the spotlight needs a token it does not have (R5)
```

**Structure Decision**: no new directory and no new layer. Every file above sits in a layer that
already exists, and the one genuinely new structural element — the preferences store — is a third peer
to `store.ts` and `agentSession.ts`, built the same way: a plain TypeScript module, no React, no DOM,
no timers, bound into React through `useSyncExternalStore`.

The two changes worth calling out for a reviewer:

- **`narration.ts` grows a second structural guarantee.** It already injects and validates the
  explanation so no write can be silent; it now also raises the spotlight so no cell-changing write
  can be invisible. Same file, same reason, same `validate → mutate → publish` ordering
  ([R4](./research.md#r4)).
- **`agentSession.ts` carries one more message on the Tools↔UI seam.** It stays the only place those
  two layers meet, which is what keeps the lint rule true.

## Phase 1 outputs

- [data-model.md](./data-model.md) — `Preferences`, `Spotlight`, the changed `Confirmation`, and the
  puzzle-request signal, with validation rules and state transitions.
- [contracts/webmcp-tool-surface.md](./contracts/webmcp-tool-surface.md) — the five tools: names,
  descriptions, input schemas, success and error result shapes, example invocations.
- [contracts/preferences-store.md](./contracts/preferences-store.md) — the third store's public API,
  storage payload, and untrusted-input rules.
- [contracts/spotlight-and-ruler.md](./contracts/spotlight-and-ruler.md) — the visual and
  accessibility contract for both new on-screen elements.
- [quickstart.md](./quickstart.md) — how to see each of the four user stories working.

## Complexity Tracking

Two deviations. Both are recorded so a reviewer can object to them by name, which is what
the constitution's Violations rule asks for.

### Deviation 1 — `switch_difficulty` does not meet the ≤ 100 ms tool-call budget

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Principle IV — the ≤ 100 ms agent tool call budget is not met by `switch_difficulty`.** | Its result depends on two things outside our control finishing: the learner answering a confirmation (FR-030), and puzzle generation completing off the main thread. FR-036 requires it to report whether a verified puzzle was actually produced, which is knowable only at the end. | Returning an immediate acknowledgement and finishing in the background was rejected because it makes FR-030 and FR-036 **unimplementable** — an acknowledgement cannot carry an outcome that has not happened yet, and the agent could not tell a loaded board from a declined one from a failed generation. Generating synchronously to fit the budget was rejected because generation was measured at p95 19.5 ms and up to 29 ms for hard puzzles, over the 16 ms frame budget Principle IV also protects. |

**This is the same deviation 002 already recorded**, for the same reason, now covering a third tool.
It is not a new class of exception: `load_technique_practice` is confirmation-gated and
`playback_deduction_sequence` is human-paced, and `switch_difficulty` is both. **Scope: three tools,
latency only.** The other thirteen gate the build at 100 ms p95.

**What is not deviated from, and is tested**: `switch_difficulty` never blocks the learner for a
single frame (FR-037); an unanswered confirmation resolves as declined after 60 s rather than hanging;
a failed generation leaves the learner's board exactly as it was (FR-036).

### Deviation 2 — an agent-initiated pause obscures the board

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Principle V — "no modal dialog, spinner, or animation may prevent the human from continuing to play"**, and 002/FR-056's "no agent action may prevent the learner from playing". `pause_timer` obscures the board, and now an agent can trigger it. | The pause overlay must genuinely obscure the board or the clock could be stopped while solving continues — that is 001/FR-035, and it is why the overlay exists. A pause tool that did not obscure would be a different, dishonest feature. The author asked for agent-operable pause and resume. | Letting the agent stop the clock *without* obscuring the board was rejected because it creates a cheat: stop the timer, keep solving. Refusing the pause tool entirely was rejected because it was explicitly requested, and because the learner's own Pause button already does exactly this — the agent gains no power the learner lacks. |

**What bounds it**: the learner's own Resume control is always present, never agent-dependent, and one
click (FR-043). An agent that pauses and disconnects cannot strand the learner. Every agent write
except `resume_timer` stays rejected while paused (002/FR-045), so a paused board is not a board the
agent can quietly work on. **This is the only place in the feature where an agent action obscures the
board**, and it is the narrowest form of it available.

### Carried forward, unchanged

**The 250 KB gzipped bundle budget remains deferred** under 001's recorded author decision. This
feature adds no runtime dependency; the bundle grows by the new modules only, and CI continues to
report the number without gating on it. Last measured at 195.4 KB.
