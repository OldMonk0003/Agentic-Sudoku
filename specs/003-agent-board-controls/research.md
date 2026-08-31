# Phase 0 Research: Agent Board Controls & Coordinate Ruler

**Feature**: `specs/003-agent-board-controls` | **Date**: 2026-08-31

Every decision below was reached by reading the code that already exists, not by recalling how a
project like this is usually built. Where an existing rule forced the answer, the rule is cited.

---

## R1 — How `switch_difficulty` reaches the generator without the Tools layer importing the UI

**This is the central design problem of the feature.** Everything else here is smaller.

### The constraint

Puzzle generation is orchestrated by `requestPuzzle()` in [`src/ui/puzzleLoader.ts`](../../src/ui/puzzleLoader.ts),
which lives in the **UI layer** because `Worker` is a browser API and the State layer must stay
DOM-free. The Tools layer may not import it:

```js
{ target: './src/tools', from: './src/ui',
  message: 'Tools must not import UI. Tool handlers must not touch the DOM (Principle III).' }
```

That is a lint error, not a convention. `load_technique_practice` never hit this wall because a drill
is a bundled constant dispatched straight into the store — no generation involved. `switch_difficulty`
is the first tool that needs a *generated* puzzle.

### Decision

**Extend the agent session store's existing Tools↔UI seam with a puzzle-request signal, in exactly the
shape `requestDisconnect` already has.**

```
  Tools                     agentSession                       UI
  ─────                     ────────────                       ──
  switch_difficulty  ──▶  requestPuzzle({difficulty})  ──▶  GameScreen subscribes,
                                                            calls requestPuzzle()
                                                            from puzzleLoader.ts
                            ◀── game store: status 'generating' → 'playing'
```

The tool resolves by observing the **game store** — status returns to `playing` with a new puzzle
(success), or the generation-failure signal fires (failure). Neither layer imports the other.

### Why this and not something else

The agent session store is *already documented* as this seam, in both directions
([002 agent-session-store contract](../002-webmcp-agent-tutor/contracts/agent-session-store.md)):

> `Tools -> UI` annotations, explanations, the toast, playback progress
> `UI -> Tools` learnerActed (interrupts playback), requestDisconnect

`requestDisconnect` is the precedent: the learner's Disconnect button raises a counter, the registry
watches it, and the button imports nothing from the Tools layer. A puzzle request is the same shape
with the arrow reversed. **This adds a message to an existing seam rather than a new mechanism.**

### Alternatives rejected

| Alternative | Why rejected |
|---|---|
| Move `puzzleLoader.ts` into the State layer | `Worker` is a browser API. `tests/unit/store.headless.test.ts` plays a full puzzle in bare Node with no DOM, and CLAUDE.md records that if that test ever needs a browser, feature 002 is no longer buildable. This would break it. |
| Let the tool import `puzzleLoader` directly | Lint failure, and it puts a browser API inside a tool handler against Principle III. |
| Generate synchronously inside the tool handler | Generation was **measured** at p95 19.5 ms and up to 29 ms for hard puzzles (001/R5) — over the 16 ms frame budget Principle IV protects. It must stay off the main thread. |
| A new dedicated Tools↔UI bridge module | A second seam doing what the first already does. Principle III's "composition over accretion" says extract a named module rather than bolt on a parallel one; here the named module exists. |

---

## R2 — Where the coordinate-ruler preference lives

FR-014 says the ruler is not game data and is not undoable. FR-015 says it survives a reload.
FR-013 says it works with no agent connected. Those three together rule out both existing stores.

### Decision

**A third store: `src/state/preferences.ts`, with its own storage key `agentic-sudoku/preferences`
and its own schema version.** Framework-agnostic like the other two — no React, no DOM, no timers.

### Why

- **Not `GameSession`.** FR-014. Putting it there places a view preference inside the structure
  `ChangeRecord` snapshots, inside what the agent reads from `get_board_state`, and inside the payload
  `serialiseSession` writes. Three chances to become undoable or agent-visible by accident.
- **Not the agent session store.** It is never persisted, by design (002/FR-034), and it does not
  exist meaningfully without an agent — but FR-013 requires the ruler to work with no agent at all.
- **A separate storage key means `SCHEMA_VERSION` for the session stays at `1`.** Every existing saved
  game stays valid. This is a migration *avoided*, not performed — worth more than the tidiness of one
  file.

### Alternative rejected

Adding `rulerVisible` to `PersistedSession` and bumping `SCHEMA_VERSION` to 2. Rejected because
`restoreSession` discards anything whose version it does not recognise, so **every player in the world
would lose their in-progress board** to gain one boolean that is not session data. `isPersisted` would
also have to straddle two shapes, which is exactly the untrusted-input surface the constitution wants
kept narrow.

---

## R3 — The spotlight's shape, and where it lives

### Decision

**A single-slot field on the agent session store**, beside `toast` and `confirmation`, which are
already single slots:

```ts
interface Spotlight {
  readonly cells: readonly Coord[];      // what actually changed
  readonly focus: Coord | null;          // set only for a single-cell change
  readonly expiresAt: number;
}
```

A single slot makes FR-022 ("at most one spotlight at a time") **structural** — a later write
overwrites the field, and there is no code path that could accumulate two.

**Two shapes, by cardinality:**

| Change | Spotlight |
|---|---|
| One cell | *Focus* form — the cell, plus its row, column, and box (21 cells) |
| 2–9 cells | *Region* form — just the changed cells, no crosshair |
| More than 9 cells | **No spotlight at all** |

The suppression threshold matters. `auto_fill_all_pencil_marks` writes into every empty cell; a
spotlight over sixty cells conveys nothing, obscures the board, and is the opposite of "so the learner
can see where the change happened without searching for it" (FR-018). FR-026 asks the spotlight to
convey extent — for a whole-board write, the honest conveyance is the explanation text, which
002/FR-041 already requires to say what it replaced.

### Alternative rejected

Reusing `addAnnotations` with a third `AnnotationRole`. Rejected because roles are per-cell entries in
a shared list, so "replace the previous spotlight but leave the highlights and beams alone" becomes a
filter-and-splice over a list that other tools also write to. A slot is the right structure for a
single-valued thing, and the store already has two of them.

---

## R4 — How the spotlight is raised: structurally, not tool by tool

### Decision

**`defineWriteTool`'s `WriteOutcome` gains an optional `changed: readonly Coord[]`, and the wrapper
raises the spotlight in the same `validate → mutate → publish` step where it queues the explanation.**

The reasoning is verbatim the reasoning [`narration.ts`](../../src/tools/narration.ts) already
records for the explanation itself:

> With nine write tools written independently, those hold only if nine implementations are each
> correct and stay correct forever.

A spotlight that some write tools remember and others forget is worse than none, because the learner
learns to trust it and is then misled once. Putting it in the wrapper also means **each step of
`playback_deduction_sequence` spotlights automatically**, since every step runs through the same path
— FR-018's walkthrough case needs no separate code.

Ordering: the spotlight is published *after* the mutation succeeds, alongside the explanation. A
spotlight on a rejected write would point at a cell that did not change.

---

## R5 — The spotlight's visual language

### Decision

**An edge rule, never a wash.** The spotlit band is drawn as a dashed rule in `--color-mark-agent`
along the band's outer edge; the focus cell carries the agent corner glyph that already exists.

### Why the rule is forced, not chosen

`app/globals.css` already states the principle in its own comment:

> Agent annotations are distinguished from the learner's own highlighting by FORM first: outlines,
> hatching, and rays, where the learner's highlighting is entirely flat washes.

A spotlight rendered as a wash would be a second flat wash on the same board as the learner's
crosshair — **precisely the confusion FR-020 forbids**, and it would fail the greyscale requirement
FR-021 inherits from 001/FR-048.

There is also a scar to respect. 002's tasks record the third purely visual defect to ship past a green
suite in this project: the `because` hatch's diagonal stripes ran straight through a clue's digit, and
the palette contrast test could not catch it, because the ratios are computed against a flat token
while the damage was done by stripes crossing a glyph. The fix was to move the hatch to the cell edge.
**The spotlight must not re-open that**: nothing new goes underneath a digit.

Non-colour cues: the dash pattern (a form the learner's solid washes never use) and the corner glyph.

**Expected to need no new palette token.** If one proves necessary it goes in `app/globals.css` and
`tests/unit/palette.contrast.test.ts` re-runs — that file parses the theme block, so a new token is a
test event, not a styling event.

---

## R6 — The ruler's colour: the screenshot is not reproduced literally

### Decision

**Render the ruler in `--color-ink-note`, not the rust/red of the supplied screenshot.**

### Why

The screenshot shows the row and column numbers in a saturated red. Three existing rules stand
against it:

1. 001/FR-052 requires a warm, low-saturation palette — "a paper-toned ground rather than pure white".
2. `--color-ink-conflict: #8A3B29` carries the comment *"muted clay, never alert red"*. Red in the
   gutters would borrow the board's conflict vocabulary for something that is not a conflict.
3. FR-008 requires the ruler to be *subordinate* to the grid — legible enough to read a coordinate
   from, quiet enough not to compete with the digits. A saturated hue is the loudest thing on a
   Japandi board.

`--color-ink-note` (`#544E44`) is the existing token for quiet secondary text and is what the pencil
candidates already use.

> **Flagged for the author**: this is the one element of the screenshot deliberately not reproduced.
> Everything else — both axes labelled 1–9, the "Columns" and "Row" captions, the gutter placement —
> is reproduced as shown. If the red was load-bearing rather than incidental, say so and it becomes a
> palette amendment with a contrast re-run, not a component change.

---

## R7 — Ruler layout that does not squeeze the board

### Decision

The gutters are **grid tracks added around the existing 9×9 grid**, not overlays and not padding
inside it. When the ruler is hidden the tracks are not rendered, so the hidden state is byte-identical
to today's board.

At the 360 px floor (001/FR-050) the cell size is the binding constraint, so the gutter track is sized
to yield: a fixed narrow track with the label at the existing smallest step of the type scale.

**This one must be looked at, not tested.** Three purely visual defects have shipped past a fully green
suite in this project — an invisible grid, a half-size board, and the hatch. Counting label elements
proves nothing about whether the board is still usable at 360 px. A screenshot at 360 px and at
desktop is a required check, not an optional one.

---

## R8 — Generalising the confirmation to two subjects

### Decision

`Confirmation` gains `kind: 'drill' | 'difficulty'`, and `technique: string` becomes
`subject: string` — a technique id or a difficulty name. **One pending slot, unchanged.** A request
arriving while another is unanswered is **rejected with a reason**, never queued and never stacked.

### Why

The spec's edge case is explicit: the learner must never be shown two competing prompts. A single slot
with an explicit rejection makes that structural; a queue or a second slot permits exactly the state
being forbidden. The 60-second decline-on-timeout behaviour in
[`confirmation.ts`](../../src/state/confirmation.ts) is reused unchanged for difficulty, so an
unanswered prompt cannot hang the agent's call.

---

## R9 — Tool names

| Author's phrasing | Registered name |
|---|---|
| switch difficulty | `switch_difficulty` |
| pause timer | `pause_timer` |
| resume timer | `resume_timer` |
| annotate row and column | `show_coordinate_ruler` |
| remove annotation | `hide_coordinate_ruler` |

snake_case matches the existing eleven. The two ruler tools are named for **what the agent gets**
rather than for the mechanism, because 002/FR-006 requires an agent that has never seen this site to
use them correctly from the description alone — "annotate row and column" invites an agent to think it
must supply a row and a column, which is the one thing these tools do not take. `show_`/`hide_` pair
unambiguously and make the read of "which one undoes the other" free.

---

## R10 — Surface version, and the latency budget

**`TOOL_SURFACE_VERSION` 1.0.0 → 1.1.0.** Additive: five tools added, none renamed, no schema
narrowed, no result shape changed. 002/FR-010 reserves MAJOR for exactly those, so MINOR is correct.

**Latency (Principle IV, ≤ 100 ms per agent tool call):**

| Tool | Budget |
|---|---|
| `pause_timer`, `resume_timer` | Holds — one store dispatch |
| `show_coordinate_ruler`, `hide_coordinate_ruler` | Holds — one store dispatch plus a storage write |
| `switch_difficulty` | **Cannot hold** — waits on a learner confirmation and on off-thread generation |

`switch_difficulty` joins `load_technique_practice` and `playback_deduction_sequence` under the
deviation 002 already recorded. It is the *same* deviation for the *same* reason — a tool whose result
depends on a human answering and on work that must not block a frame cannot report an outcome it does
not yet have — so this plan extends that entry rather than opening a new class of exception. Recorded
in [plan.md § Complexity Tracking](./plan.md#complexity-tracking).

---

## R11 — What this feature does not touch

Confirmed against the open items carried from 001 and 002, so the plan cannot be read as quietly
closing any of them:

- The missing `x-wing` and `naked-single` drills — untouched, still open.
- SC-009's offline-*reload* clause (needs a service worker) — untouched, still open.
- The deferred 250 KB bundle budget — untouched. The bundle will grow slightly; it stays
  informational, as recorded in 001's plan.
- **SC-001 of 002 — the surface has still never been driven by a live agent.** This feature adds five
  more tools to a surface verified only against a spec-conformant fake. It does not change that, and
  it enlarges the untested contact area.
