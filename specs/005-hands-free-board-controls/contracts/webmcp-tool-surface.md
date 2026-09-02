# Contract: The WebMCP Tool Surface at 1.2.0

**Feature**: [../spec.md](../spec.md) | **Date**: 2026-09-02

**16 → 18 tools. Version 1.1.0 → 1.2.0.** Two added, none renamed, none removed, no schema narrowed —
MINOR under 002/FR-010, so an agent written against 1.1.0 keeps working.

Both new tools are declared through `defineWriteTool`, which injects `explanation` into the schema
and validates it before the handler runs. Neither can change the board silently, and neither could
be written so that it did.

---

## `restart_puzzle` — NEW

Replace the board with a different puzzle at the **same** difficulty.

```jsonc
// input (plus the injected `explanation`, 20–240 chars)
{ "type": "object", "additionalProperties": false, "properties": {}, "required": [] }
```

**No arguments.** The difficulty comes from the board, which is the whole point — an agent that had
to supply it could supply the wrong one, and this tool exists precisely to mean "same level, new
grid".

| Success | |
|---|---|
| `outcome` | `"restarted"` |
| `difficulty` | the **derived** rating of the new puzzle, never a label echoed back on trust |
| `clue_count`, `techniques_required` | as `switch_difficulty` reports them |
| `elapsed_ms`, `undo_depth` | `0` and `0` — a restart resets both (FR-005) |

| Failure | When |
|---|---|
| `wrong-status` | the board is paused (FR-009), or still generating |
| `generation-failed` | no puzzle passing the uniqueness check could be produced; **the board is unchanged** (FR-010) |

**Permitted on a completed board** — there is no progress left to lose, and a new puzzle is what the
learner wants next. **Rejected while paused**, like every other agent-initiated replacement.

**Guaranteed to be a different grid** (FR-002, SC-003), enforced in `puzzleLoader` rather than here,
so the learner's own controls get the same guarantee.

---

## `undo_move` — NEW

Reverse the most recent change to the board, exactly as the learner's Undo button does.

```jsonc
// input (plus the injected `explanation`)
{ "type": "object", "additionalProperties": false, "properties": {}, "required": [] }
```

**No arguments, and no target.** It always means "the last one", which keeps it imperative and
matches one press of the button.

| Success | |
|---|---|
| `outcome` | `"undone"` |
| `undone_origin` | `"player"` or `"agent"` — **whose change was reversed** (FR-016) |
| `undone_action` | what kind of change it was, e.g. a digit entry or a whole-board pencil fill |
| `cells_restored` | how many cells the reversal touched |
| `undo_depth` | steps remaining after this one |
| `board_complete` | `false` — undoing out of a complete board returns it to play |

| Failure | When |
|---|---|
| `nothing-to-undo` | history is empty. The state a fresh or restarted board is always in |
| `wrong-status` | the board is paused (002/FR-045) |

**Permitted on a completed board.** The learner's own Undo works there and returns the board to play
([R3](../research.md#r3--what-are-undos-real-status-rules-contradicted-the-spec)); a tool that
refused where the button works would break FR-012.

**The paused rejection needs an explicit guard in this tool.** `undoLast` has no status check and
`defineWriteTool` deliberately does not gate on status — that is what keeps `resume_timer` working.
Same shape as `pause_timer`'s own guard.

**It may reverse the learner's own work.** There is no redo. `undone_origin` exists so the agent can
say what it just took back.

---

## `switch_difficulty` — CHANGED

| Before | After |
|---|---|
| Raised a confirmation when the board had progress; waited up to 60 s for an answer | **Replaces the board immediately** |
| Could return `outcome: "declined"` | That outcome can no longer occur |
| Could fail with `confirmation-pending` | That code no longer exists |
| Blocked on a human **and** on generation | Blocks on generation only |

**Not a breaking change.** No rename, no removal, no narrowed schema (002/FR-010). An agent that
handled `"declined"` simply never sees it again. The description changes to stop promising a
confirmation that no longer happens — a tool description that describes behaviour the site does not
have is the defect 002/FR-006 exists to prevent.

---

## `load_technique_practice` — CHANGED

The same removal, for the same reason: the drill confirmation and the difficulty confirmation were
one mechanism.

| Before | After |
|---|---|
| Confirmed before replacing a board with progress | Replaces immediately |
| `outcome: "declined"` \| `"loaded"` \| `"not-needed"` | `outcome: "loaded"` |

---

## Error codes

| Code | Status |
|---|---|
| `confirmation-pending` | **REMOVED** — nothing can raise a confirmation, so nothing can conflict with one |
| `nothing-to-undo` | **now reachable.** It has existed in the union since feature 002 and no tool could produce it until `undo_move` |

Removing an error code is not a MAJOR change: 002/FR-010 reserves that for renaming a tool, removing
a tool, or narrowing a schema.

---

## What does not change

- Every write tool still requires `explanation`, 20–240 characters, validated before the handler runs.
- Every tool still returns a structured result and never throws (002/FR-008).
- Registration stays in `registry.ts`, isolated from rendering and enumerable with no DOM mounted.
- No tool reveals the solution or whether a placed digit is correct.
- No tool moves the learner's selection or keyboard focus.
- With no host present, none of this exists and the site is feature 001 exactly.
