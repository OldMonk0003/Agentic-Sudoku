# Quickstart: Reviewing the WebMCP Agent Tutor

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Every slice ends in a site you can open and an agent surface you can call. This document is the
review script: what to run, what to type, and what you should see — slice by slice.

---

## Prerequisites

```bash
npm install
```

**Always review the static export, never the dev server.** `npm run dev` cannot prove there is no
server runtime, because the dev server *is* one:

```bash
npm run build && npm start
```

That serves `out/` at <http://localhost:4321>. **`localhost` is a secure context**, which matters here:
`document.modelContext` is `[SecureContext]`-gated, so the agent surface exists on localhost and on
HTTPS, and nowhere else.

---

## Two ways to drive the tools

### Path A — a real WebMCP browser (preferred)

If your browser exposes `document.modelContext` (Chrome's WebMCP origin trial or the equivalent flag),
you need nothing from us. Open <http://localhost:4321>, open DevTools, and drive the **real** standard:

```js
const mc = document.modelContext;

// What does this site offer an agent?
(await mc.getTools()).map(t => ({ name: t.name, readOnly: t.annotations?.readOnlyHint }));

// Call one. executeTool returns a JSON string.
const tool = (await mc.getTools()).find(t => t.name === 'get_board_state');
JSON.parse(await mc.executeTool(tool, {}));
```

A one-liner worth keeping in your clipboard for every slice below:

```js
const call = async (name, args = {}) =>
  JSON.parse(await document.modelContext.executeTool(
    (await document.modelContext.getTools()).find(t => t.name === name), args));
```

Then talk to an actual agent for the real test: *"What should I play next?"* — SC-001 says it should
manage with no instructions from you about this site.

### Path B — no WebMCP in your browser

Do **not** expect to paste a fake `document.modelContext` into the console and have it work: the site
feature-detects at load, so a host that appears afterwards is never seen. That is correct behaviour
(FR-013), not a bug to work around.

Instead, review through the headed harness, which injects a spec-conformant fake host *before* the
page loads and then drives the real registration path:

```bash
npm run review:agent -- --slice 2
```

It opens a real browser window, runs that slice's demo calls against the board, and leaves the window
open so you can watch and interact. Everything you see is the production code path; only the host is
substituted.

---

## The universal review checklist

Run on **every** slice, before the slice-specific script:

```bash
npm test && npm run test:e2e && npm run test:a11y && npm run lint && npm run typecheck
```

Then, at <http://localhost:4321>:

- [ ] **Look at the page.** Two purely visual defects have shipped past a green suite in this project. Counting elements proves nothing about whether anything is drawn.
- [ ] `(await document.modelContext.getTools()).length` matches the slice's expected tool count.
- [ ] **Play a full move as a human.** Feature 001 must be untouched.
- [ ] **Turn the agent off** (Disconnect) and confirm the board still plays perfectly.
- [ ] **DevTools → Network, filter All: zero requests after load**, including during agent calls (FR-059).
- [ ] No console errors, no unhandled rejections.

---

## Slice 0 — The surface exists and can see

**Tools: 2** — `get_board_state`, `check_for_conflicts`

```js
(await document.modelContext.getTools()).map(t => t.name);
// → ['get_board_state', 'check_for_conflicts']

await call('get_board_state');
```

- [ ] `data.cells` has 81 entries, each with `row`, `col`, `value`, `origin`, `candidates`.
- [ ] `origin` is `'clue'` for the starting digits and `'player'` for anything you typed.
- [ ] `data.difficulty`, `data.status`, `data.elapsed_ms` are present and correct.
- [ ] **Nothing in the response reveals the solution.** Search the JSON for an 81-character digit run — there is none, and there is no `solution` key at any depth.
- [ ] `surface_version` appears in the result.
- [ ] Every result has `ok`. Now break it deliberately:

```js
await call('get_board_state', { nope: 1 });   // → ok:false, code 'unexpected-argument'
await call('check_for_conflicts', 'garbage'); // → ok:false, NOT a thrown error
```

- [ ] Type two 5s into the same row, then `await call('check_for_conflicts')` — the group names the unit, the digit, and both cells.
- [ ] A sage **"Agent connected"** badge is visible with a **Disconnect** button. Click it: the badge goes neutral, `getTools()` returns `[]`, and the board still plays.
- [ ] In a browser **without** WebMCP: no badge, no placeholder, nothing. The page is feature 001.

---

## Slice 1 — The agent can point

**Tools: 5** — adds `highlight_pattern_cells`, `show_pattern_hint_toast`, `clear_visual_annotations`

```js
await call('highlight_pattern_cells', {
  target_cells:  [{ row: 4, col: 5 }],
  because_cells: [{ row: 4, col: 1 }, { row: 4, col: 3 }, { row: 6, col: 5 }],
  explanation: 'Only one cell in this box can still take a 7 — the other three are ruled out by its row and column.'
});
```

- [ ] The target cell and the justifying cells are marked, and **you can tell which is which** — filled corner dot versus hollow, outline versus hatch.
- [ ] **No digit and no pencil mark changed.**
- [ ] The explanation appears beside the board, attributed to the agent.
- [ ] Click a cell while annotations are up: your own crosshair still works and is obviously *yours*.
- [ ] **Screenshot it and desaturate.** Target, because, and your own crosshair remain three distinct things (FR-035).
- [ ] Keep typing while three explanations arrive — every keystroke lands, focus never moves (FR-018).
- [ ] Reject the narration contract:

```js
await call('highlight_pattern_cells', { target_cells: [{ row: 1, col: 1 }] });
// → ok:false, 'explanation-required' — and NOTHING is highlighted
await call('show_pattern_hint_toast', { explanation: 'too short' });
// → ok:false, 'explanation-length', details carries 20 and 240
```

- [ ] `show_pattern_hint_toast` self-dismisses at five seconds; you can dismiss it sooner.
- [ ] `clear_visual_annotations` removes marks and toast, leaves every digit, candidate, and the timer alone.
- [ ] Wait ~60 s after a highlight with no further calls: the marks expire on their own (FR-033).

---

## Slice 2 — Nothing changes silently

**Tools: 6** — adds `fill_cell`. **This is the slice that makes it a tutor.**

```js
await call('fill_cell', { row: 4, col: 5, digit: 7,
  explanation: 'Only 7 can go here — the other eight digits already appear in this box.' });
```

- [ ] The digit appears **and** the explanation appears, together.
- [ ] The agent's digit is distinguishable from your entries and from clues **at a glance, without hovering** — italic plus a sage corner glyph.
- [ ] **Press Undo once. It is gone.** Exactly like your own move.
- [ ] Your selection did **not** move to the filled cell.
- [ ] Fill a cell that duplicates a digit in its row: it is **allowed**, and flagged as a conflict (FR-038 — the tutor is permitted to be wrong, and you are permitted to see it).
- [ ] Rejections leave the board untouched:

```js
await call('fill_cell', { row: 1, col: 1, digit: 9, explanation: 'x'.repeat(30) }); // a clue → 'cell-is-clue'
await call('fill_cell', { row: 0, col: 5, digit: 7, explanation: 'x'.repeat(30) }); // → 'out-of-range'
await call('fill_cell', { row: 4, col: 5, digit: 7 });                              // → 'explanation-required'
```

- [ ] Pause the board, then try a fill → `wrong-status`. `get_board_state` still succeeds (FR-045).
- [ ] Hostile text is inert:

```js
await call('fill_cell', { row: 2, col: 2, digit: 3,
  explanation: '<img src=x onerror=alert(1)> and a [link](http://evil.example) for good measure' });
```

The popup shows those characters **as literal text**. No image, no alert, no clickable link (FR-021).

---

## Slice 3 — Show me why it cannot go there

**Tools: 7** — adds `draw_constraint_beams`

```js
await call('draw_constraint_beams', {
  beams: [{ unit_type: 'row', unit_number: 3, digit: 6 }, { unit_type: 'col', unit_number: 7, digit: 6 }],
  explanation: 'Row 3 and column 7 already contain a 6, so their intersection cannot take one.' });
```

- [ ] Two rays are drawn, and **where they cross, both are still readable** (FR-029).
- [ ] Beams are lines; your crosshair is a fill. Nobody could confuse them.
- [ ] Select a cell: your crosshair still works underneath.
- [ ] Enable OS reduced motion, redraw: beams appear at their final state, no sweep (FR-061).
- [ ] Greyscale: beams still visible and still distinct from every wash.

---

## Slice 4 — Bookkeeping done for me

**Tools: 9** — adds `update_pencil_marks`, `auto_fill_all_pencil_marks`

```js
await call('auto_fill_all_pencil_marks', {
  explanation: 'Pencilling in every legal candidate so the naked pairs become visible.' });
```

- [ ] Every empty cell now holds exactly its legal digits — **spot-check one by hand against the row, column, and box.**
- [ ] No filled cell was touched.
- [ ] **One Undo removes all of it** (FR-043).
- [ ] Now write some pencil marks yourself, then call it again with no acknowledgement:

```js
await call('auto_fill_all_pencil_marks', { explanation: 'Filling all candidates for you now, watch this.' });
// → ok:false, 'acknowledgement-required' — your marks are intact
```

Repeat with `acknowledges_replacing_marks: true` → succeeds, `data.hand_written_marks_replaced` is
non-zero, and **one Undo restores your own marks exactly** (US4 scenario 4).

- [ ] `update_pencil_marks` with one bad cell in a list of three changes **nothing at all**.
- [ ] Agent-written candidates are visibly agent-written.

---

## Slice 5 — Walk me through it

**Tools: 10** — adds `playback_deduction_sequence`

```js
call('playback_deduction_sequence', {           // note: no await — watch it run
  explanation: 'Three steps that finish this box; follow the reasoning as it goes.',
  steps: [
    { action: 'highlight', cells: [{ row: 4, col: 5 }], explanation: 'Start here: this cell is the most constrained in the box.' },
    { action: 'fill', row: 4, col: 5, digit: 7, explanation: 'Its row and column between them rule out every digit except 7.' },
    { action: 'fill', row: 6, col: 5, digit: 2, explanation: 'With the 7 placed, this cell has only a 2 left to take.' }
  ]}).then(r => console.log(r));
```

- [ ] Steps play **in order**, each with **its own** explanation as it happens — not three at once, not one summary (FR-047).
- [ ] **The board never locks.** You can click and type throughout.
- [ ] Now interrupt: start it again and click a cell mid-sequence. Playback **stops immediately**; completed steps stay done; the promise resolves with `steps_completed` and `stopped_because: 'interrupted'` (FR-048, FR-049).
- [ ] After an interruption at 2 of 3, **Undo steps back one at a time**, not in a lump (FR-050).
- [ ] Reduced motion: pacing changes, nothing sweeps.
- [ ] A sequence whose third step targets a clue is rejected **before step one runs** — the board is untouched.

---

## Slice 6 — Give me one to practice on

**Tools: 11** — adds `load_technique_practice`. The surface is complete.

```js
await call('load_technique_practice', { technique: 'x-wing',
  explanation: 'Here is a board built around the X-Wing you just learned — want to try it?' });
```

- [ ] With progress on the board, **you are asked first** — an inline banner, not a modal.
- [ ] **You can ignore the banner and keep playing.** The board stays live behind it.
- [ ] Decline → board untouched, and the call returns `ok: true` with `outcome: 'declined'` (declining is not an error).
- [ ] Accept → a drill loads, the timer resets, undo history clears.
- [ ] Solve it and confirm it genuinely needed an X-Wing.
- [ ] `technique: 'swordfish'` → schema rejection listing the techniques that *do* have drills (FR-054).
- [ ] Ignore the banner for 60 s → it disappears and the call resolves `declined`.
- [ ] **Network tab: still zero requests.** Drills are bundled (FR-055).

---

## Slice 7 — Audit

No new tools. This slice proves what the previous seven built.

```bash
npm run test:perf     # tool-call latency, TTI, interaction to paint
npm run test:a11y     # axe, keyboard-only, greyscale, CVD
npm test              # includes the hostile-input suite
```

- [ ] **SC-001 — the real test.** Point a live agent at the site with **no instructions about it**. Ask *"teach me something about this puzzle."* It should read the board, find a move, explain it, and point at the right cells, using nothing but the tool descriptions.
- [ ] **SC-004** — from a static screenshot in greyscale, identify which digits are yours, which are the agent's, and which are clues.
- [ ] **SC-008** — the nine non-exempt tools return within 100 ms at p95. `playback_deduction_sequence` and `load_technique_practice` are exempt by recorded deviation.
- [ ] **SC-010** — in a browser with no WebMCP, walk **every** feature 001 review script in [001/quickstart.md](../001-sudoku-play-experience/quickstart.md). Identical behaviour, zero agent-related pixels.
- [ ] **SC-012** — the hostile-input suite passes: malformed, oversized, out-of-range, and markup-bearing inputs across all eleven tools, none of which changes the board.
- [ ] The tool registry document is current: every tool's schema and an example invocation (Definition of Done, item 6).
- [ ] Bundle number recorded and reported; still informational, still gating nothing.
