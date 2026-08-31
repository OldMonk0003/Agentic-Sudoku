# Contract: The Spotlight and the Coordinate Ruler

**Feature**: `specs/003-agent-board-controls`

The two new things on screen. This is the visual and accessibility contract for both — what must be
true of the pixels, and what must be true for a learner who cannot see them.

> **This is the contract most likely to pass its tests and still be wrong.** Three purely visual
> defects have shipped past a fully green suite in this project: an invisible grid (all 81 cells in the
> DOM, zero borders rendered), a board shrink-wrapped to half size, and an agent hatch whose diagonal
> stripes ran through the digit underneath. The third is the instructive one — the palette contrast
> test computes ratios against a *flat token*, while the damage was done by *stripes crossing a glyph*,
> so no assertion could have caught it. **Screenshots at 360 px and desktop are a required check
> here, not an optional one.**

---

## Part 1 — The agent spotlight

### What it is

The marking of where the agent last changed something, so the learner can find it without searching
(FR-018). It is **not** the learner's selection and never becomes it.

### The rule that decides everything else

`app/globals.css` already states it:

> Agent annotations are distinguished from the learner's own highlighting by FORM first: outlines,
> hatching, and rays, where the learner's highlighting is entirely flat washes.

**So the spotlight is an edge rule, never a wash** ([R5](../research.md#r5)). A second flat wash would
be exactly the confusion FR-020 forbids, and it would fail greyscale.

### Visual specification

| Element | Treatment |
|---|---|
| The spotlit band (row + column + box of the focus cell) | A **dashed rule** in `--color-mark-agent` along the band's outer edge |
| The focus cell | The existing agent corner glyph, at higher emphasis |
| Region form (2–9 cells) | The dashed edge rule around each changed cell; no band |
| More than 9 cells changed | **Nothing.** No spotlight is raised at all |

**Nothing new is drawn underneath a digit.** That is the 002 hatch lesson, and it is not to be
re-opened.

### Coexistence with the learner's crosshair

Both may be on screen at once, and must remain tellable apart (FR-020):

| | Learner | Agent |
|---|---|---|
| Form | Flat wash (`--color-wash-crosshair`) | Dashed edge rule |
| Selected/focus cell | Solid ring (`--color-ring-selected`) | Corner glyph (`--color-mark-agent`) |
| Survives greyscale by | Luminance ladder | **Form** — a dash is a dash with no colour at all |

When the agent's focus cell **is** the learner's selected cell, the learner's ring takes visual
precedence and the agent's corner glyph remains discernible.

### Behaviour

| Requirement | Contract |
|---|---|
| FR-019 | The learner's `selection` is **byte-identical** before and after every agent write, and `document.activeElement` does not change |
| FR-022 | At most one spotlight exists. A later write replaces it |
| FR-023 | Expires after `SPOTLIGHT_TTL_MS` (60 s), and `clear_visual_annotations` removes it with everything else |
| FR-024 | Never in `history`, never in `localStorage` |
| FR-027 | Any appearance transition is suppressed under `prefers-reduced-motion`, read from the agent store — the Tools layer never queries a media query |

### Accessibility (FR-025)

Announced through the **existing polite live region**, never a new one, and never taking focus:

> "Agent filled row 1, column 3. Highlighting row 1, column 3 and its box."

The spotlit cells are also reflected in each `Cell`'s accessible label, so a screen-reader learner
arrowing the board hears it **in place** rather than only in the announcement — the pattern 002
already established for annotation roles.

### Tests

| Check | Where |
|---|---|
| Selection and focus unmoved across every agent write | `tests/integration/` — the SC-004 test |
| One spotlight at a time; a second write replaces | Unit test over the agent store |
| Expiry, and removal by `clear_visual_annotations` | Unit test with an injected `now` |
| Never persisted, never in history | Extend the localStorage and history assertions |
| Distinguishable in greyscale and under CVD | `tests/a11y/` — extend the greyscale sweep |
| axe clean with both crosshairs on screen | `tests/a11y/` |
| **Rendered, not merely present** | A screenshot spec, read back. Counting elements proves nothing |

---

## Part 2 — The coordinate ruler

### What it is

Numbered gutters around the grid — columns 1–9 across the top, rows 1–9 down the left, each axis with
a caption — so the learner can name a cell without counting (FR-006, FR-007).

### Visual specification

| Element | Treatment |
|---|---|
| Numerals and captions | `--color-ink-note` (`#544E44`) |
| Type size | The existing smallest step of the scale |
| Placement | Grid **tracks** around the 9×9 grid — not overlays, not padding inside it |
| Hidden state | The tracks are not rendered; the board is byte-identical to today's |

> **The screenshot's red is deliberately not reproduced** ([R6](../research.md#r6)). 001/FR-052
> requires a warm low-saturation palette; `--color-ink-conflict` carries the comment *"muted clay,
> never alert red"*, so red in the gutters would borrow the board's conflict vocabulary for something
> that is not a conflict; and FR-008 wants the ruler subordinate to the grid. **Everything else in the
> screenshot is reproduced as shown.** If the red was load-bearing, that is a palette amendment with a
> contrast re-run, not a component change.

### Layout under pressure (FR-016)

At the 360 px floor (001/FR-050) the cell size is the binding constraint. The gutter track is fixed
and narrow, and the board does not shrink to accommodate it below usability.

**Verified by screenshot at 360 px and at desktop, both states, read back.** This is the single
highest-risk item in the feature for a defect that a green suite will not catch.

### Accessibility (FR-017)

**The gutters are `aria-hidden="true"`.** Every cell already announces its own coordinates
(001/FR-047), so exposing the ruler would append a second coordinate to every cell announcement —
making the board *worse* for a screen-reader learner in the name of an aid that exists to help
sighted learners stop counting.

The learner's own toggle (`RulerToggle.tsx`) **is** exposed, with a clear accessible name and pressed
state, and is fully keyboard-operable (001/FR-046).

### Behaviour

| Requirement | Contract |
|---|---|
| FR-012 | Persists until removed. **Does not expire** — the one board marking exempt from 002/FR-033 |
| FR-013 | The learner's toggle is present and working whether or not an agent is connected |
| FR-014 | No cell value, candidate, conflict, selection, clock, or history entry changes. Not undoable |
| FR-015 | Survives reload via the preferences store; defaults to hidden |

### The no-agent case (002/FR-013, SC-011)

With no agent host, the ruler and its toggle are **fully present and working** — it is an ordinary
readability aid, not an agent affordance. This is the one thing this feature adds that a host-less
page still gets, and the existing no-host parity test must be extended to assert exactly that:
**ruler toggle present, zero agent elements.**

### Tests

| Check | Where |
|---|---|
| Both axes numbered 1–9, matching the canonical addressing | Component test |
| Toggling changes no game state and is not undoable | Unit test |
| Persists across reload; defaults to hidden | Integration test |
| Present and working with no agent host | Extend the no-host parity test |
| `aria-hidden` on the gutters; toggle has name and pressed state | `tests/a11y/` |
| axe clean, ruler shown and hidden | `tests/a11y/` |
| **Legible at 360 px, board still usable** | Screenshot spec, read back |
