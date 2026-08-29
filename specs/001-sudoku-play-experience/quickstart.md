# Quickstart & Slice Validation Guide

**Feature**: `001-sudoku-play-experience` | **Date**: 2026-08-29

This is the guide for **reviewing the website after each slice**. Every slice below ends in a running,
deployable site with a demo script you can walk in a browser in a couple of minutes.

Design details live elsewhere and are not repeated here: [data-model.md](./data-model.md),
[contracts/](./contracts/), [research.md](./research.md).

---

## Prerequisites

- Node 20 or newer
- A terminal and a browser

## Everyday commands

Development server:

```bash
npm run dev
```

Full test suite:

```bash
npm test
```

Static export — this is the build that matters, since zero server runtime is a constitutional
requirement:

```bash
npm run build
```

**Serve the export from a plain file server.** This is the check that proves there is no server
runtime; `npm run dev` cannot prove it, because the dev server is a server.

```bash
npx serve out
```

Budget and accessibility gates:

```bash
npm run test:perf
```

```bash
npm run test:a11y
```

---

## The universal review checklist

Run this at the end of **every** slice, before looking at anything slice-specific:

1. `npm test` passes, and the commit history shows the failing test arriving before its implementation
   (Principle V).
2. `npm run build` completes and emits `out/`.
3. `npx serve out` runs and the site works fully from those static files.
4. **Open DevTools → Network, reload, then play.** After initial load there must be zero requests
   (FR-043, SC-009).
5. `npm run test:a11y` passes — accessibility is a gate on every slice, not a final cleanup.
6. `npm run test:perf` passes. Bundle size is reported but does **not** gate — that budget is
   deferred (see plan.md § Complexity Tracking). Every timing budget still gates.
7. Tab through the whole page. Every control reachable, focus always visible.

---

## Slice 0 — Foundation & aesthetic

**Demo**: open the site. An empty 9×9 grid in warm Japandi paper tones, with hairline cell separators
and visibly heavier 3×3 box framing.

**Check**:
- The grid reads as a shoji panel — box borders are unmistakably heavier than cell lines (FR-053).
- Nothing is pure white or pure black (FR-052).
- `npm test` includes the palette contrast suite and it passes — this is the computed proof from
  research.md § R3, not a visual judgement.
- Note the first-load gzipped JS number for reference. It is informational only — the bundle budget
  is deferred and blocks nothing.
- Screenshot in greyscale: box structure still legible.

---

## Slice 1 — Playable board

**Demo**: pick a difficulty, get a puzzle, solve a few cells by mouse and by keyboard.

**Check**:
- A puzzle is on screen on first load with no menu, prompt, or configuration step (FR-001).
- Click a cell, press `5` — it appears, styled differently from the starting clues (FR-005).
- Click a **clue**, press any digit — nothing happens, and you get a brief non-blocking hint. No dialog
  (FR-021).
- Arrow keys and `WASD` move the selection; at the edge it stops rather than wrapping (FR-019).
- `Backspace` clears your own digit, never a clue (FR-018).
- Change difficulty — a new board appears in well under half a second (SC-002).
- With nothing selected, digit keys do nothing.

---

## Slice 2 — Intelligent highlighting

**Demo**: click around the board and watch the tinting.

**Check**:
- Selecting a cell tints its whole row, column, and box (FR-007).
- Selecting a cell containing a `5` lights every other `5` — clues and your own entries alike (FR-008).
- Selecting an **empty** cell shows the crosshair only, no matching highlight (FR-011).
- The selected cell carries a **ring**, not just a darker fill — this is what keeps every tier legible
  (research.md § R3).
- Take a greyscale screenshot: crosshair, matching, and selected are still all tellable apart (SC-010).
- Nothing about highlighting changes a digit, the timer, or undo availability (FR-010).

---

## Slice 3 — Conflicts & completion

**Demo**: place a duplicate on purpose, then finish a board.

**Check**:
- Two `3`s in a row: **both** cells flag in clay, with a corner marker as well as the colour (FR-025,
  FR-026).
- Erase one — both markings clear (FR-028).
- With a conflict on the board, keep playing elsewhere. Nothing blocks you (FR-027).
- Place a digit that is legal but wrong against the real solution — it is **not** flagged. The site
  never tells you whether you are right (FR-029). *This is deliberate; verify it rather than filing it
  as a bug.*
- Fill the last cell correctly: completion banner appears inline with the final time, the timer stops,
  the board freezes (FR-037–039).
- Fill all 81 cells **with** a conflict present: **not** treated as complete.

---

## Slice 4 — Pencil notes

**Demo**: pencil in candidates, then commit a digit and watch the bookkeeping happen.

**Check**:
- Toggle notes with the on-screen control, and with `Space` and `N`. The active mode is always visible
  (FR-013, FR-014).
- In notes mode `4` adds the candidate; pressing `4` again removes it (FR-016).
- Candidates sit in fixed positions, so a missing one reads as a gap (FR-022).
- Pencil `8` into several cells of row 2, then commit `8` in that row. **Every** `8` candidate in that
  row, column, and box disappears (FR-023).
- Press Undo **once**: the digit and every auto-cleared candidate come back together (FR-024). One
  action, one undo — this is the single most important check in this slice.
- Committing a value into a cell that had candidates clears them (FR-017).

---

## Slice 5 — Undo, timer, pause

**Demo**: make several changes, walk all the way back, then pause.

**Check**:
- Five changes, five undos, board is untouched again and Undo is visibly disabled (FR-031, FR-032).
- Undo is disabled on a fresh puzzle.
- Timer counts in `MM:SS` (FR-034).
- Pause: the clock stops **and** the board is obscured so you cannot keep solving (FR-035).
- Resume: the clock continues from where it stopped, it does not restart.
- Start a new puzzle: undo history is gone and cannot be stepped back into (FR-033).
- With reduced motion enabled in your OS, the pause overlay appears without transition (FR-049).

---

## Slice 6 — Session continuity

**Demo**: play partway, reload, and confirm nothing was lost.

**Check**:
- Half-solve a board with pencil notes, note the timer, reload. Same puzzle, same digits, same notes,
  same difficulty, same elapsed time (FR-041).
- Undo history is **not** restored — that is the documented design, not a defect.
- In a private window with storage blocked, the game still plays and tells you once, unobtrusively,
  that progress will not be saved (FR-042).
- Corrupt the stored value by hand in DevTools, reload: a fresh puzzle appears with no error screen
  (FR-044).
- Inspect the stored value. **It must not contain a complete 81-digit solution** (solution quarantine).

---

## Slice 7 — Audit & budgets

Not a build slice. This confirms and measures what the earlier slices already delivered — if they did
their job, this finds nothing.

**Check**:
- `npm run test:a11y` clean; automated axe pass plus a manual screen-reader walkthrough of the board.
- Complete an entire puzzle using **only** the keyboard, never touching the mouse (SC-005).
- Resize to 360 px: board, keypad, and controls usable with no horizontal page scroll (FR-050).
- `npm run test:perf` green on every enforced budget: generation ≤ 500 ms, validation ≤ 16 ms,
  interaction to paint ≤ 100 ms, TTI ≤ 2 s on simulated 4G. First-load bundle size is reported for
  information only and does not gate.
- Greyscale and colour-blind simulation across every board state.
- Confirm no statistics, streaks, or history exist anywhere (FR-051).
- Disconnect the network entirely and play a full session start to finish (SC-009).
