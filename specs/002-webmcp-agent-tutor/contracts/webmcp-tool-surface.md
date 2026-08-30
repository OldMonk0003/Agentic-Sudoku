# Contract: The WebMCP Tool Surface

**Layer**: `src/tools/` | **Consumers**: any agent speaking the WebMCP standard

**Surface version**: `1.0.0` — echoed in every result. MAJOR bumps on a rename, a removal, or a
narrowed input constraint (FR-010, Principle I).

This is the public contract of the product. An agent that has never seen this site must be able to use
it correctly from these descriptions alone (FR-006, SC-001), so every description is written for that
reader — not for us.

---

## Registration

```ts
// src/tools/registry.ts — enumerable with NO DOM mounted (FR-011)
export const TOOL_SURFACE_VERSION = '1.0.0';
export const descriptors: readonly ToolDescriptor[];       // all 11, importable in bare Node
export function registerTools(): RegistrationHandle | null; // null when no host is present
export function unregisterTools(): void;
```

Registration is **feature-detected**: if `document.modelContext` is absent — no host, insecure
context, or Permissions Policy denial — `registerTools()` returns `null`, records nothing
learner-facing, and the site is feature 001 exactly (FR-013, SC-010).

Each tool is registered with:

```ts
document.modelContext.registerTool(
  { name, description, inputSchema,
    annotations: { readOnlyHint: descriptor.readOnly, untrustedContentHint: true },
    execute },
  { signal: controller.signal },     // ← the ONLY teardown mechanism in the standard
);
```

**Idempotency (FR-012)**: `registerTool` rejects with `InvalidStateError` on a duplicate name, so
`registerTools()` guards on a module-level handle and returns the existing one rather than
re-registering. Teardown aborts the single `AbortController`, which unregisters exactly what was
registered — it cannot drift, because it is the same object.

**`untrustedContentHint: true` on every tool**: results contain agent-authored text echoed back and
learner-entered digits. Telling the host so is free and correct.

---

## Result envelope

Every tool, always, resolves — never rejects (a rejection reaches the agent as an opaque
`UnknownError`, destroying the reason FR-009 requires).

```jsonc
// success
{ "ok": true,  "tool": "fill_cell", "surface_version": "1.0.0", "data": { … } }

// failure
{ "ok": false, "tool": "fill_cell", "surface_version": "1.0.0",
  "error": { "code": "cell-is-clue", "message": "Row 4, column 2 is a starting clue and cannot be changed.",
             "details": { "row": 4, "col": 2 } } }
```

Error codes are enumerated in [data-model.md](../data-model.md#errorcode).

---

## Shared schema fragments

```jsonc
// coordinate — used wherever a cell is named
"Coord": {
  "type": "object", "additionalProperties": false,
  "properties": { "row": { "type": "integer", "minimum": 1, "maximum": 9 },
                  "col": { "type": "integer", "minimum": 1, "maximum": 9 } },
  "required": ["row", "col"]
}

// explanation — INJECTED into every write tool's schema by defineWriteTool (R4)
"explanation": { "type": "string", "minLength": 20, "maxLength": 240 }
```

`additionalProperties: false` on **every** object in **every** schema. FR-003 requires unrecognised
arguments to be rejected, not ignored; our own validator enforces it whether or not the host does
(R5).

---

## The eleven tools

| # | Tool | `readOnly` | Explanation required | Slice |
|---|---|---|---|---|
| 1 | `get_board_state` | ✅ | — | 0 |
| 2 | `check_for_conflicts` | ✅ | — | 0 |
| 3 | `highlight_pattern_cells` | ❌ | ✅ | 1 |
| 4 | `show_pattern_hint_toast` | ❌ | ✅ (it *is* the message) | 1 |
| 5 | `clear_visual_annotations` | ❌ | ✅ | 1 |
| 6 | `fill_cell` | ❌ | ✅ | 2 |
| 7 | `draw_constraint_beams` | ❌ | ✅ | 3 |
| 8 | `update_pencil_marks` | ❌ | ✅ | 4 |
| 9 | `auto_fill_all_pencil_marks` | ❌ | ✅ | 4 |
| 10 | `playback_deduction_sequence` | ❌ | ✅ (plus one per step) | 5 |
| 11 | `load_technique_practice` | ❌ | ✅ | 6 |

`readOnly: false` on the annotation tools is deliberate and follows FR-014: they change what the
learner sees, so they narrate. Only tools that change *nothing perceivable* are read-only (FR-023).

---

### 1. `get_board_state` — read-only

> Read the current Sudoku board. Rows are numbered 1–9 top to bottom, columns 1–9 left to right, and
> boxes 1–9 in reading order. Returns all 81 cells with their digit (or null if empty), who put it
> there (`clue` for the puzzle's starting digits, `player` for the human, `agent` for you), and the
> pencil candidates written in that cell. Also returns the difficulty, elapsed time, and whether the
> board is playing, paused, or complete. The puzzle's solution is not available through any tool —
> reason from the visible board, as the human does.

**Input**: `{ "type": "object", "additionalProperties": false, "properties": {} }`

**`data`**:

```jsonc
{
  "cells": [ { "row": 1, "col": 1, "value": 5, "origin": "clue", "candidates": [] }, … 81 total ],
  "difficulty": "medium",            // easy | medium | hard
  "status": "playing",               // playing | paused | complete
  "elapsed_ms": 184000,
  "empty_count": 41,
  "is_complete": false
}
```

**Example invocation** (DevTools console, real host):

```js
const mc = document.modelContext;
const tool = (await mc.getTools()).find(t => t.name === 'get_board_state');
JSON.parse(await mc.executeTool(tool, {}));
// → { ok: true, tool: 'get_board_state', surface_version: '1.0.0',
//     data: { cells: [ { row: 1, col: 1, value: 5, origin: 'clue', candidates: [] }, … ],
//             difficulty: 'easy', status: 'playing', elapsed_ms: 0,
//             empty_count: 45, is_complete: false } }
```

`origin` is `null` for an empty cell — an empty cell has no author, and reporting one would be noise
the agent has to learn to ignore.

Requirements: FR-024, FR-026, FR-027. Leaves board data, annotations, elapsed time, and undo history
untouched — asserted by a test that snapshots all four around the call.

---

### 2. `check_for_conflicts` — read-only

> List every cell involved in a duplicate digit within a row, column, or box, grouped so you can see
> which cells collide with which. Returns an empty list when the board has no duplicates. This
> reports duplicates only — it does not tell you whether a digit is correct, because the site never
> reveals the solution.

**Input**: `{ "type": "object", "additionalProperties": false, "properties": {} }`

**`data`**:

```jsonc
{ "conflicts": [ { "unit": { "type": "col", "n": 7 }, "digit": 4,
                   "cells": [ { "row": 2, "col": 7 }, { "row": 8, "col": 7 } ] } ],
  "conflicted_cell_count": 2 }
```

**Example invocation**:

```js
JSON.parse(await mc.executeTool(
  (await mc.getTools()).find(t => t.name === 'check_for_conflicts'), {}));
// → { ok: true, tool: 'check_for_conflicts', surface_version: '1.0.0',
//     data: { conflicts: [], conflicted_cell_count: 0 } }
```

**Example rejection** — every tool behaves this way, and none ever rejects its promise:

```js
JSON.parse(await mc.executeTool(tool, { unit: 'row' }));
// → { ok: false, tool: 'check_for_conflicts', surface_version: '1.0.0',
//     error: { code: 'unexpected-argument',
//              message: '"unit" is not a recognised argument; permitted: none',
//              details: { violations: [ { path: 'unit', message: '…' } ] } } }
```

Requirements: FR-025, FR-027. Read-only by decision recorded in the spec's Assumptions — 001 already
flags conflicts continuously, so there is nothing here to write.

---

### 3. `highlight_pattern_cells` — write

> Tint cells on the board to point the human at a pattern, without changing anything they have
> written. Use `target_cells` for the cells your deduction concludes about, and `because_cells` for
> the cells that justify it; the two are drawn differently so the human can tell them apart. Marks
> fade on their own after about a minute. Requires `explanation`: one or two sentences the human will
> see, saying what you are pointing at and why.

**Input**:

```jsonc
{ "type": "object", "additionalProperties": false,
  "properties": {
    "target_cells":  { "type": "array", "items": Coord, "minItems": 0, "maxItems": 81, "uniqueItems": true },
    "because_cells": { "type": "array", "items": Coord, "minItems": 0, "maxItems": 81, "uniqueItems": true },
    "explanation":   { "type": "string", "minLength": 20, "maxLength": 240 } },
  "required": ["explanation"] }
```

At least one of the two arrays must be non-empty, or `no-annotation-target` is returned — a
constraint JSON Schema cannot express without `anyOf`, so it is checked by the handler and stated in
the description.

**`data`**: `{ "annotated_cells": 7, "expires_in_ms": 60000 }`

**Example invocation**:

```js
await call('highlight_pattern_cells', {
  target_cells:  [{ row: 5, col: 6 }],
  because_cells: [{ row: 5, col: 1 }, { row: 5, col: 3 }],
  explanation: 'Only this cell in the box can still take a seven; its row and column rule out the rest.'
});
// → { ok: true, data: { target_cells: 1, because_cells: 2,
//                       annotated_cells: 3, expires_in_ms: 60000 } }
```

**As rendered**: `target` is a solid sage outline with a FILLED corner dot;
`because` is a diagonal hatch **framing** the cell with a HOLLOW corner dot. The hatch frames rather
than fills because striping across a cell makes the digit inside it hard to read — a defect a green
suite missed and looking at the board found.

Requirements: FR-028, FR-032, FR-033, FR-034, FR-035.

---

### 4. `show_pattern_hint_toast` — write

> Show the human a short coaching note near the board. It disappears after five seconds, or sooner if
> they dismiss it. It never takes their keyboard focus and never stops them playing. The
> `explanation` you supply **is** the note the human reads, so write it to them, not about them.

**Input**: `{ "type": "object", "additionalProperties": false,
  "properties": { "explanation": { "type": "string", "minLength": 20, "maxLength": 240 } },
  "required": ["explanation"] }`

**`data`**: `{ "expires_in_ms": 5000 }`

This is the one tool where the narration text is the payload rather than an accompaniment. It keeps
the property name `explanation` so the write contract stays uniform — one property, one length rule,
one enforcement point (R4).

**Example invocation**:

```js
await call('show_pattern_hint_toast', {
  explanation: 'Look for a digit with only one home left in a box. That is a hidden single.'
});
// → { ok: true, data: { expires_in_ms: 5000 } }
```

Requirements: FR-030, FR-018, FR-019.

---

### 5. `clear_visual_annotations` — write

> Remove every highlight, beam, and coaching note you have placed. The human's digits, pencil marks,
> timer, and undo history are untouched — this only clears your own marks.

**Input**: explanation only.

**`data`**: `{ "cleared_annotations": 4, "cleared_toast": true }`

**Ordering matters**: clearing removes annotations and the toast, then publishes its own explanation.
It does **not** clear the explanation queue — otherwise this call would erase its own narration.

**Example invocation**:

```js
await call('clear_visual_annotations', {
  explanation: 'Clearing my marks so we can look at the next pattern with fresh eyes.'
});
// → { ok: true, data: { cleared_annotations: 2, cleared_toast: true } }
```

Requirements: FR-031, FR-014.

---

### 6. `fill_cell` — write

> Put one digit into one empty, non-clue cell. Rows and columns are 1–9. The cell must be empty and
> not a starting clue, and the board must not be paused or complete, or the call is rejected and
> nothing changes. You are allowed to be wrong: a digit that duplicates one in the same row, column,
> or box will be placed and flagged as a conflict, exactly as it would be for the human. The human
> can undo it with a single press of their Undo button. Requires `explanation`: one or two sentences
> saying why this digit goes here, which the human sees attributed to you.

**Input**:

```jsonc
{ "type": "object", "additionalProperties": false,
  "properties": { "row": { "type": "integer", "minimum": 1, "maximum": 9 },
                  "col": { "type": "integer", "minimum": 1, "maximum": 9 },
                  "digit": { "type": "integer", "minimum": 1, "maximum": 9 },
                  "explanation": { "type": "string", "minLength": 20, "maxLength": 240 } },
  "required": ["row", "col", "digit", "explanation"] }
```

**`data`**: `{ "row": 4, "col": 5, "digit": 7, "created_conflict": false, "board_complete": false, "undo_depth": 12 }`

Evaluated against the board **as it stands at the moment of the call** (FR-046) — an agent that read a
stale board is rejected, not applied. Does **not** move the learner's selection.

**Example invocation**:

```js
await call('fill_cell', {
  row: 4, col: 5, digit: 7,
  explanation: 'Only 7 can go here — the other eight digits already appear in this box.'
});
// → { ok: true, data: { row: 4, col: 5, digit: 7, created_conflict: false,
//                       board_complete: false, undo_depth: 12 } }
```

**As rendered**: the digit is *italic* and carries a sage corner glyph. Both cues survive greyscale,
and **both survive the digit being wrong** — a conflicted agent digit keeps its authorship marks as
well as the conflict ink, because FR-038 exists so the learner can catch the tutor's mistakes and that
is impossible if a wrong digit stops looking like the agent's.

Requirements: FR-036, FR-037, FR-038, FR-042, FR-044, FR-045, FR-046.

---

### 7. `draw_constraint_beams` — write

> Cast a visible ray along a whole row, column, or box to show a constraint — for example, the row
> that already contains a 6 and therefore rules a 6 out elsewhere. Beams are drawn as lines, which
> keeps them distinct from the human's own square highlighting, and several beams stay individually
> readable where they cross. Beams fade after about a minute.

**Input**:

```jsonc
{ "type": "object", "additionalProperties": false,
  "properties": {
    "beams": { "type": "array", "minItems": 1, "maxItems": 9, "items": {
      "type": "object", "additionalProperties": false,
      "properties": { "unit_type": { "type": "string", "enum": ["row", "col", "box"] },
                      "unit_number": { "type": "integer", "minimum": 1, "maximum": 9 },
                      "digit": { "type": "integer", "minimum": 1, "maximum": 9 } },
      "required": ["unit_type", "unit_number"] } },
    "explanation": { "type": "string", "minLength": 20, "maxLength": 240 } },
  "required": ["beams", "explanation"] }
```

**`data`**: `{ "beams_drawn": 2, "expires_in_ms": 60000 }`

**Example invocation**:

```js
await call('draw_constraint_beams', {
  beams: [{ unit_type: 'row', unit_number: 3, digit: 6 },
          { unit_type: 'col', unit_number: 7, digit: 6 }],
  explanation: 'Row 3 and column 7 already contain a six, so their intersection cannot take one.'
});
// → { ok: true, data: { beams_drawn: 2, expires_in_ms: 60000 } }
```

**As rendered**: a row beam is a horizontal dashed rule through its nine cells, a column beam a
vertical one, a box beam a dotted frame. Crossing beams stay readable because they run in different
*directions* — not because they are different colours, which is what makes FR-029 hold in greyscale.
The draw-in sweep shows the direction of the constraint and is dropped entirely under reduced motion.

Requirements: FR-029, FR-032, FR-033, FR-061 (no animated sweep under reduced motion).

---

### 8. `update_pencil_marks` — write

> Set the pencil candidates of specific empty cells to exactly the digits you list. This replaces
> whatever was in those cells — an empty digit list erases that cell's marks. No other cell is
> touched, and the whole call is a single undo step for the human. Cells holding a digit, and
> starting clues, are rejected.

**Input**:

```jsonc
{ "type": "object", "additionalProperties": false,
  "properties": {
    "cells": { "type": "array", "minItems": 1, "maxItems": 81, "items": {
      "type": "object", "additionalProperties": false,
      "properties": { "row": { "type": "integer", "minimum": 1, "maximum": 9 },
                      "col": { "type": "integer", "minimum": 1, "maximum": 9 },
                      "digits": { "type": "array", "maxItems": 9, "uniqueItems": true,
                                  "items": { "type": "integer", "minimum": 1, "maximum": 9 } } },
      "required": ["row", "col", "digits"] } },
    "explanation": { "type": "string", "minLength": 20, "maxLength": 240 } },
  "required": ["cells", "explanation"] }
```

**`data`**: `{ "cells_updated": 3, "undo_depth": 13 }`

**All-or-nothing**: if any listed cell is a clue, is filled, or is off the grid, the whole call is
rejected and nothing changes. A partially applied batch could not be narrated by the one explanation
that accompanied it.

**Example invocation**:

```js
await call('update_pencil_marks', {
  cells: [{ row: 5, col: 5, digits: [1, 2] }, { row: 5, col: 7, digits: [] }],
  explanation: 'Narrowing r5c5 to the naked pair, and clearing r5c7 which the pair rules out.'
});
// → { ok: true, data: { cells_updated: 2, undo_depth: 13 } }
```

Requirements: FR-039, FR-043, FR-044.

---

### 9. `auto_fill_all_pencil_marks` — write

> Fill every empty cell with exactly the digits that are still legal there, given the board as it
> stands. Cells that already hold a digit are not touched. This is one undo step for the human. If
> the human has written their own pencil marks, this replaces them — in that case you must pass
> `acknowledges_replacing_marks: true` and say so in your explanation, or the call is rejected.

**Input**:

```jsonc
{ "type": "object", "additionalProperties": false,
  "properties": { "acknowledges_replacing_marks": { "type": "boolean" },
                  "explanation": { "type": "string", "minLength": 20, "maxLength": 240 } },
  "required": ["explanation"] }
```

**`data`**: `{ "cells_filled": 41, "hand_written_marks_replaced": 6, "undo_depth": 14 }`

**Why the extra flag**: FR-041 requires the explanation to say that hand-written marks were replaced.
Text cannot be checked for meaning, but consent can be checked for presence — so when any learner-written
candidate would be overwritten and the flag is absent, the call is rejected with
`acknowledgement-required` and a message telling the agent to acknowledge it. That turns an
unenforceable requirement into a mechanical one.

Candidates come from the Engine's legal-candidate computation over the **visible** board, so this tool
is wrong in exactly the ways the human's own pencilling would be wrong and reveals nothing about the
solution.

**Example invocation**, and the acknowledgement in action:

```js
await call('auto_fill_all_pencil_marks', { explanation: 'Pencilling every legal candidate for you.' });
// → { ok: false, error: { code: 'acknowledgement-required',
//       message: 'The human has pencil marks of their own in 3 cells, and this would replace them.
//                 Retry with acknowledges_replacing_marks: true, and say in your explanation that
//                 you are replacing their marks.',
//       details: { hand_written_cells: 3 } } }

await call('auto_fill_all_pencil_marks', {
  acknowledges_replacing_marks: true,
  explanation: 'Replacing the marks you wrote by hand with the full set of legal candidates.'
});
// → { ok: true, data: { cells_filled: 41, hand_written_marks_replaced: 3, undo_depth: 14 } }
```

Requirements: FR-040, FR-041, FR-043, FR-026.

---

### 10. `playback_deduction_sequence` — write

> Play a short walkthrough: a list of steps performed one after another, each with its own
> explanation shown as that step happens. Use it to teach a chain of reasoning. The human can stop it
> at any moment simply by clicking or typing on the board — playback halts immediately, completed
> steps stay done, and this call tells you how many finished and why it stopped. Each step remains a
> separate undo step for the human. This call takes several seconds to return, by design.

**Input**:

```jsonc
{ "type": "object", "additionalProperties": false,
  "properties": {
    "steps": { "type": "array", "minItems": 2, "maxItems": 8, "items": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "action": { "type": "string", "enum": ["fill", "pencil", "highlight", "beam"] },
        "row": { "type": "integer", "minimum": 1, "maximum": 9 },
        "col": { "type": "integer", "minimum": 1, "maximum": 9 },
        "digit": { "type": "integer", "minimum": 1, "maximum": 9 },
        "digits": { "type": "array", "maxItems": 9, "uniqueItems": true,
                    "items": { "type": "integer", "minimum": 1, "maximum": 9 } },
        "cells": { "type": "array", "maxItems": 81, "items": Coord },
        "unit_type": { "type": "string", "enum": ["row", "col", "box"] },
        "unit_number": { "type": "integer", "minimum": 1, "maximum": 9 },
        "explanation": { "type": "string", "minLength": 20, "maxLength": 240 } },
      "required": ["action", "explanation"] } },
    "explanation": { "type": "string", "minLength": 20, "maxLength": 240 } },
  "required": ["steps", "explanation"] }
```

Per-action required fields (`fill` needs `row`/`col`/`digit`; `beam` needs `unit_type`/`unit_number`;
and so on) are checked by the handler before the first step runs — a sequence that would fail at step
four is rejected at step zero rather than abandoning the learner halfway.

**`data`**: `{ "steps_requested": 3, "steps_completed": 3, "stopped_because": "finished" }`
where `stopped_because` is `finished | interrupted | step-failed`. An interruption is
`ok: true` — the learner taking control is the system working, not an error. A step that fails its
own precondition returns `ok: false` with `playback-step-failed` and the same counts.

**Example invocation** — note the absent `await`, so you can watch it run:

```js
call('playback_deduction_sequence', {
  explanation: 'Three steps that finish this box; follow the reasoning as it goes.',
  steps: [
    { action: 'highlight', cells: [{ row: 4, col: 5 }],
      explanation: 'Start here: this is the most constrained cell in the box.' },
    { action: 'fill', row: 4, col: 5, digit: 7,
      explanation: 'Its row and column between them rule out every digit except 7.' },
    { action: 'fill', row: 6, col: 5, digit: 2,
      explanation: 'With the 7 placed, this cell has only a 2 left to take.' }
  ]}).then(console.log);
// → { ok: true, data: { steps_requested: 3, steps_completed: 3, stopped_because: 'finished' } }

// Touch the board while it runs:
// → { ok: true, data: { steps_requested: 3, steps_completed: 1, stopped_because: 'interrupted' } }
```

**Pacing**: 1.2 s between steps, dropping to 1.0 s under reduced motion — the difference is exactly
the sweep that no longer plays, so the *reading* time is unchanged. Shortening the dwell for a learner
who asked for less motion would be backwards.

**Activity before the call does not cancel it.** The interruption baseline is captured when the
sequence begins; a click a moment earlier is not an interruption of a walkthrough that had not
started, and treating it as one would look like the tool simply not working.

Requirements: FR-047 through FR-051. **Exempt from the 100 ms tool-call budget** — see
[plan.md § Complexity Tracking](../plan.md).

---

### 11. `load_technique_practice` — write

> Replace the current puzzle with a curated one that drills a specific technique. Because this
> discards the human's current board, they are asked to confirm first — if they decline, this returns
> normally with `outcome: "declined"` and nothing changes. Pass the technique id you want; if no
> drill exists for it, the rejection lists the ones that do. Every drill has exactly one solution and
> genuinely requires its technique.

**Input**:

```jsonc
{ "type": "object", "additionalProperties": false,
  "properties": { "technique": { "type": "string", "enum": ["naked-single", "hidden-single",
                                  "locked-candidates", "naked-pair", "x-wing"] },
                  "explanation": { "type": "string", "minLength": 20, "maxLength": 240 } },
  "required": ["technique", "explanation"] }
```

The `enum` is generated from the technique registry, so adding a technique module cannot leave the
schema stale.

**`data`**: `{ "outcome": "loaded", "technique": "x-wing", "difficulty": "hard" }` where `outcome` is
`loaded | declined | not-needed` (`not-needed` when the board had no progress and no confirmation was
required).

An unanswered confirmation resolves as `declined` after 60 seconds rather than hanging.

**Example invocation**:

```js
await call('load_technique_practice', {
  technique: 'naked-pair',
  explanation: 'Here is a board built around the naked pair you just learned — want to try it?'
});
// learner clicks "Keep my board":
// → { ok: true, data: { outcome: 'declined', technique: 'naked-pair' } }
// learner clicks "Load drill":
// → { ok: true, data: { outcome: 'loaded', technique: 'naked-pair', difficulty: 'medium' } }
```

**Drill coverage is partial, and the `enum` above is generated from what actually exists.** Drills
ship for `hidden-single`, `locked-candidates`, and `naked-pair`. `naked-single` and `x-wing` have
none: measured against `requiresTechnique`, no such puzzle appeared in hundreds of thousands of
candidates. FR-054 is the designed response — a technique with no drill is rejected with the list of
those that have one. See [data-model.md](../data-model.md) and `src/engine/drills.ts` for why.

Requirements: FR-052 through FR-055. **Exempt from the 100 ms budget** while awaiting a human.

---

## Invariants asserted by contract tests

One contract test file per tool (Principle V), each asserting name, schema rejection, success shape,
and error shape. Across the surface:

1. **Every descriptor is enumerable with no DOM mounted**, and `registry.ts` imports no React and no
   UI module.
2. **No handler ever rejects.** Every tool is called with `null`, `undefined`, `{}`, an array, a
   string, an unknown property, and a deeply nested object; all resolve with `ok: false`.
3. **No write tool can be declared without narration** — enforced by the type of `defineWriteTool`,
   asserted by a test that the injected `explanation` property is present in all nine write schemas
   with identical bounds.
4. **`registerTools()` twice registers eleven tools, not twenty-two**, and `unregisterTools()` leaves
   the host with zero.
5. **No tool result anywhere contains the solution.** The full surface is exercised on a solved-adjacent
   board and every serialised result is scanned for any 81-character digit run (FR-026, FR-058).
6. **Read-only tools change nothing**: board, annotations, elapsed time, and undo depth are identical
   before and after (FR-027).
7. **Every failure carries an enumerated code** — no `message`-only errors, no generic strings
   (FR-009).
8. **`surface_version` is present in every result**, success and failure alike (FR-010).
9. **With `document.modelContext` absent, importing the bootstrap registers nothing and throws
   nothing**, and the rendered app is byte-identical to feature 001's (FR-013, SC-010).
