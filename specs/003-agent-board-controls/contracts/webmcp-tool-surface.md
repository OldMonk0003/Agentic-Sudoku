# Contract: The Five New WebMCP Tools

**Feature**: `specs/003-agent-board-controls`

The surface goes from eleven tools to **sixteen**. This document specifies only the five additions;
the existing eleven are unchanged and are specified in
[002/contracts/webmcp-tool-surface.md](../../002-webmcp-agent-tutor/contracts/webmcp-tool-surface.md).

**`TOOL_SURFACE_VERSION`: `1.0.0` → `1.1.0`.** Additive. No existing tool is renamed or removed, no
schema narrowed, no result shape changed, so an agent written against 1.0.0 continues to work
(002/FR-010).

## Rules inherited unchanged

Every one of the five obeys the existing surface contract:

- Registered on `document.modelContext` through the same `descriptors` array and the same
  `AbortController` (002/FR-001, FR-012).
- `additionalProperties: false` — an unrecognised argument is **rejected**, not ignored (002/FR-003).
- **Never throws.** Failure is a returned `{ ok: false, error }`, because `executeTool` collapses a
  rejected handler into an opaque `UnknownError` and destroys the reason the agent needs (002/FR-008).
- Every result carries `tool` and `surface_version`, so a stale agent finds out on its next call.
- `readOnlyHint: false` and `untrustedContentHint: true` on all five.
- **All five require `explanation`** (FR-003), injected into the schema by `defineWriteTool`, 20–240
  characters, validated before the handler runs.

`explanation` is omitted from the schemas below for brevity; it is present on all five, always
required.

---

## `switch_difficulty`

**Changes**: yes — replaces the board. **Confirmation-gated** when progress exists.

**Description** (what the agent actually reads):

> Load a brand-new Sudoku puzzle at a chosen difficulty, replacing the one on screen. Rows are
> numbered 1 to 9 top to bottom and columns 1 to 9 left to right. If the human has made any progress
> on the current board, they are asked to confirm first and may decline — a decline is a normal
> outcome, not an error. A new puzzle resets the clock to zero and clears the undo history. Requires
> explanation: one or two sentences saying why you are changing the difficulty, which the human sees.

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "difficulty": { "type": "string", "enum": ["easy", "medium", "hard"] }
  },
  "required": ["difficulty"]
}
```

**Success**:

```json
{ "ok": true, "tool": "switch_difficulty", "surface_version": "1.1.0",
  "data": { "outcome": "loaded", "difficulty": "hard", "clue_count": 24,
            "techniques_required": ["hidden-single", "locked-candidates"],
            "elapsed_ms": 0, "undo_depth": 0 } }
```

`outcome: "declined"` is **also a success** — the learner answered, and the agent needs to know that
without treating it as a fault (FR-030):

```json
{ "ok": true, "tool": "switch_difficulty", "surface_version": "1.1.0",
  "data": { "outcome": "declined", "difficulty": "hard" } }
```

**Never returns the solution.** `clue_count` and `techniques_required` describe the puzzle; neither
reveals an answer (FR-045).

**Errors**:

| Code | When |
|---|---|
| `unknown-difficulty` | Not one of the three. `details.available` lists them (FR-029) |
| `wrong-status` | The board is paused (FR-035). Permitted when complete |
| `confirmation-pending` | Another confirmation is already awaiting an answer |
| `generation-failed` | No puzzle passing the uniqueness rule was produced; the board is unchanged (FR-036) |
| `explanation-required` / `explanation-length` | The narration contract |

**Latency**: exempt from the ≤ 100 ms budget — waits on a human answer and on off-thread generation.
Recorded in [plan.md § Complexity Tracking](../plan.md#complexity-tracking).

---

## `pause_timer`

**Changes**: yes — stops the clock and obscures the board.

**Description**:

> Pause the game: the elapsed-time clock stops and the board is covered, exactly as it is when the
> human presses their own Pause button. The human can resume at any moment with their own Resume
> control, and you can resume with `resume_timer`. While paused, every other tool that changes the
> board is refused; reading the board still works. Requires explanation: one or two sentences saying
> why you are pausing, which the human sees.

```json
{ "type": "object", "additionalProperties": false, "properties": {}, "required": [] }
```

**Success**: `{ "outcome": "paused", "elapsed_ms": 733120 }`

**Errors**:

| Code | When |
|---|---|
| `wrong-status` | The board is not running — already paused, still generating, or complete (FR-041). The message names the actual state |

**Side effect**: a walkthrough in progress **stops** at its last completed step, and that is reported
to the walkthrough's caller, not to this one (FR-042). Steps must not execute behind a pause overlay.

---

## `resume_timer`

**Changes**: yes — restarts the clock and uncovers the board.

**Description**:

> Resume a paused game: the clock restarts from where it stopped and the board becomes playable
> again. This is the one tool that works while the board is paused. Requires explanation: one or two
> sentences, which the human sees.

```json
{ "type": "object", "additionalProperties": false, "properties": {}, "required": [] }
```

**Success**: `{ "outcome": "resumed", "elapsed_ms": 733120 }`

**Errors**:

| Code | When |
|---|---|
| `wrong-status` | The board is not paused (FR-041) |

> **The carve-out, stated explicitly.** 002/FR-045 rejects agent changes while the board is paused.
> `resume_timer` is exempt — a tool whose only purpose is to leave the paused state cannot be barred
> by the paused state, or `pause_timer` becomes a one-way door for the agent (FR-040). **No other
> tool gains this exemption.**
>
> It needs no special code: the store's `resumeSession` already requires `status === 'paused'`, and
> nothing in `defineWriteTool` gates on status. The exemption exists by construction, and a test
> pins it so it cannot be closed by accident.

---

## `show_coordinate_ruler`

**Changes**: yes — the board's appearance. Changes **no game data**.

**Description**:

> Show numbered guides around the Sudoku grid: the column numbers 1 to 9 across the top and the row
> numbers 1 to 9 down the left side. Use this so the human can read a cell's coordinates straight off
> the board instead of counting squares — it makes it much easier for them to tell you which cell they
> mean. The guides stay until removed and change nothing about the puzzle. Calling this when they are
> already showing is fine and does nothing. Requires explanation: one or two sentences, which the
> human sees.

```json
{ "type": "object", "additionalProperties": false, "properties": {}, "required": [] }
```

**Success**: `{ "outcome": "shown", "already_visible": false }`

`already_visible: true` with `ok: true` when the ruler was already up — a no-op, not a failure
(FR-011).

**Errors**: none beyond the narration contract. This tool cannot fail on board state; it works while
paused and while complete, because it changes no game data.

---

## `hide_coordinate_ruler`

**Changes**: yes — the board's appearance. Changes **no game data**.

**Description**:

> Remove the numbered row and column guides from around the grid. Calling this when they are not
> showing is fine and does nothing. Requires explanation: one or two sentences, which the human sees.

```json
{ "type": "object", "additionalProperties": false, "properties": {}, "required": [] }
```

**Success**: `{ "outcome": "hidden", "already_hidden": true }`

**Errors**: none beyond the narration contract.

> **Neither actor's view of the ruler is authoritative.** The learner has their own toggle (FR-013)
> and may hide a ruler the agent showed, or show one the agent hid. Both tools are therefore
> idempotent by design, so an agent that has lost track cannot be tripped by the mismatch.

---

## Contract tests

One per tool, written first, in `tests/contract/`. Each asserts, at minimum:

1. The registered **name** is exactly as above and appears in `descriptors`.
2. The **input schema** rejects: a missing `explanation`, an explanation outside 20–240 characters, an
   unrecognised property, and (for `switch_difficulty`) a difficulty outside the enum.
3. The **success result shape**, including `surface_version: "1.1.0"`.
4. The **error result shape** for every code listed above.
5. The handler **never throws** — including on hostile input. The existing
   `tests/contract/hostile-inputs.test.ts` matrix extends from 11 tools to 16.
6. **No solution leakage**, extending `tests/unit/tools.no-solution-leak.test.ts` to 16.

Plus two surface-level assertions:

- `tests/unit/tools.surface.test.ts` enumerates **16** tools **in bare Node with no DOM mounted**, all
  names unique and snake_case (002/FR-011).
- `TOOL_SURFACE_VERSION === '1.1.0'`, and every one of the original eleven names is still present with
  its schema unnarrowed (002/FR-010).
