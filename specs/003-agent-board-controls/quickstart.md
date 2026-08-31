# Quickstart: Agent Board Controls & Coordinate Ruler

**Feature**: `specs/003-agent-board-controls`

How to see each user story working, and how to check the things the test suite cannot.

## Prerequisites

```bash
npm install
```

Branch from `002-webmcp-agent-tutor` — `main` does not have the agent surface this extends:

```bash
git checkout 002-webmcp-agent-tutor && git checkout -b 003-agent-board-controls
```

## Verify the build the way it ships

`npm run dev` cannot prove there is no server runtime — the dev server *is* a server:

```bash
npm run build && npm start
```

## The suite

```bash
npm test
```

```bash
npm run test:e2e && npm run test:a11y && npm run test:perf
```

```bash
npm run lint && npm run typecheck
```

`npm run lint` includes the layer-boundary rules. If `switch_difficulty` is ever wired to
`puzzleLoader` directly, **this is what fails**, and that failure is correct — see
[R1](./research.md#r1).

## Driving the agent surface

No browser here implements `document.modelContext`, so the surface is driven through the
spec-conformant fakes: `tests/support/fakeModelContext.ts` (Node) and
`tests/support/browserFakeHost.ts` (page). Both are pinned by `tests/unit/fakeModelContext.test.ts`
so they cannot quietly become laxer than the real thing.

```bash
npm run review:agent
```

---

## Story 1 — The coordinate ruler (P1)

**As the agent:**

```
show_coordinate_ruler { explanation: "Numbering the grid so you can tell me a cell without counting." }
```

**Expect**: columns 1–9 appear across the top, rows 1–9 down the left, with captions. Quiet grey-brown
(`--color-ink-note`), not the red of the original screenshot — [R6](./research.md#r6) explains why.

**Then check, by hand:**

1. Every digit, candidate, conflict mark, the clock, and the selection are unchanged.
2. Press Undo — the ruler is not an undo step, and Undo does whatever it would have done anyway.
3. Wait two minutes. **The ruler is still there.** It does not expire like a teaching annotation
   (FR-012).
4. Reload. It is still there (FR-015).
5. Call `show_coordinate_ruler` again — succeeds with `already_visible: true`, not an error.
6. `hide_coordinate_ruler`, then reload. Still hidden.

**With no agent at all** — open the page in a plain browser:

7. The learner's own ruler toggle is present and works (FR-013).
8. Nothing else agent-related is on screen (002/FR-013, SC-011).

**The check the suite cannot make:**

```bash
npx playwright test tests/review/ruler-360.spec.ts --project=chromium
```

Screenshot at 360 px and at desktop, both states, and **read the images back**. Counting label
elements proves nothing about whether the board is still usable. Three purely visual defects have
shipped past a green suite in this project.

---

## Story 2 — The agent spotlight (P2)

This is the fix for the second screenshot in the original request.

**Setup**: click a cell in the bottom-left — say row 8, column 2 — so the learner's crosshair is
clearly somewhere the agent is not about to act.

**As the agent:**

```
fill_cell { row: 1, col: 3, digit: 9, explanation: "Only 9 can go here - the other eight digits already appear in this box." }
```

**Expect**: row 1, column 3, and its box are picked out by a dashed agent-coloured edge rule, and the
filled cell carries the agent's corner glyph.

**Then check, by hand — this is the important part:**

1. The learner's crosshair is **still on row 8, column 2**, and looks the same as it always did.
2. The two markings are obviously different from each other — one flat wash, one dashed rule.
3. **Press `5`.** It goes into row 8, column 2 — the cell *you* had selected, not the agent's
   (FR-019, SC-004). If it lands in the agent's cell, the feature is wrong.
4. Fill a second cell. The first spotlight is **gone**, not accumulated (FR-022).
5. Wait 60 seconds. The spotlight expires (FR-023).
6. `clear_visual_annotations` removes it along with everything else.
7. `auto_fill_all_pencil_marks` on a mostly empty board → **no spotlight at all.** Sixty spotlit
   cells convey nothing; the explanation carries the message instead
   ([R3](./research.md#r3)).
8. `playback_deduction_sequence` → the spotlight follows each step as it plays, with no extra code
   ([R4](./research.md#r4)).

**Greyscale and CVD**: `npm run test:a11y` covers it, but look at a greyscale screenshot too. The
dashed rule must still read as "not the learner's" with no colour at all.

---

## Story 3 — Switching difficulty (P3)

**Setup**: fill in three or four digits so there is progress to lose.

**As the agent:**

```
switch_difficulty { difficulty: "hard", explanation: "You have cleared three easy boards quickly - let us try a hard one." }
```

**Expect**: a confirmation banner appears. **Nothing has changed yet.**

**Then check:**

1. **Decline.** The board, clock, and history are exactly as they were, and the agent gets
   `outcome: "declined"` with `ok: true` — a normal answer, not an error (FR-030).
2. Ask again and **accept**. A fresh hard puzzle, clock at `00:00`, Undo greyed out (FR-033).
3. On an **untouched** board, ask again — it loads with no prompt (FR-031).
4. Ask for `"expert"` → rejected with `unknown-difficulty` and the list of levels that exist
   (FR-029). Board unchanged.
5. Ask while a **walkthrough** is playing → the walkthrough stops and reports how far it got
   (FR-034).
6. Ask while **paused** → rejected (FR-035). On a **complete** board → permitted.
7. Ask and then **do not answer**. After 60 seconds the agent gets `declined` rather than waiting
   forever.
8. Ask twice without answering → the second is `confirmation-pending`. **The learner is never shown
   two prompts.**
9. Throughout: keep clicking cells and typing. **You are never locked out** (FR-037).

---

## Story 4 — Pause and resume (P4)

**As the agent:**

```
pause_timer { explanation: "You have been at this twenty minutes - worth a short break." }
```

**Expect**: the clock stops and the board is covered, exactly as the learner's own Pause does.

**Then check:**

1. **Press the learner's own Resume button.** It works. You are never dependent on the agent to get
   your board back (FR-043) — check this before anything else.
2. Pause again, then `resume_timer` → the clock restarts from where it stopped.
3. While paused, `fill_cell` → rejected, `wrong-status` (002/FR-045).
4. While paused, `get_board_state` → **succeeds.** Reads still work.
5. While paused, `resume_timer` → **succeeds.** This is the one carve-out (FR-040). If it is ever
   rejected, `pause_timer` has become a one-way door.
6. `pause_timer` on an already-paused board → rejected, and the message names the actual state.
7. Pause during a walkthrough → the walkthrough stops at its last completed step (FR-042). Steps must
   never execute behind the overlay.

---

## Whole-feature checks

| Check | How |
|---|---|
| 16 tools, enumerable with no DOM | `npx vitest run --project node tests/unit/tools.surface.test.ts` |
| Surface version is `1.1.0`, all 11 original tools intact | Same test |
| No network request from any of the 16 | `npm run test:e2e` — extend the existing zero-request assertion |
| No solution leakage across 16 tools | `npx vitest run tests/unit/tools.no-solution-leak.test.ts` |
| Hostile inputs: 19 payloads × 16 tools, none throws | `npx vitest run tests/contract/hostile-inputs.test.ts` |
| Four new tools under 100 ms p95 | `npm run test:perf` — `switch_difficulty` is exempt and recorded |
| **An existing saved game still restores** | `npx vitest run tests/unit/persistence.roundtrip.test.ts` — must be unchanged and still green ([R2](./research.md#r2)) |
| Bundle size | Reported by the build, informational only |
