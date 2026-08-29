# Contract: Interaction & Presentation

**Layer**: `src/ui/` | This is the contract between the player and the board.

---

## Keyboard

Active only while the board region holds focus, so board shortcuts never fire while a button or the
difficulty select is focused (spec edge case).

| Key | Action | Requirement |
|---|---|---|
| `1`–`9` | Enter digit, or toggle candidate in notes mode | FR-015, 016 |
| `Backspace`, `Delete` | Erase selected cell | FR-018 |
| `↑ ↓ ← →` | Move selection one cell, no wrap at edges | FR-019 |
| `W` `A` `S` `D` | Same as arrows | FR-019 |
| `Space`, `N` | Toggle normal / notes mode | FR-014 |
| `Tab` | Move focus out of the board to the controls | FR-046 |

**Rules**: keypad and keyboard dispatch the identical action (FR-020). Digit and delete keys are ignored
with no selection. A key aimed at a clue cell is rejected with a brief non-blocking indication — never a
dialog (FR-021).

---

## Highlight tiers

Composed per the precedence in `data-model.md`. Each tier separates by **more than hue** so it survives
greyscale (FR-009, SC-010).

| Tier | Fill | Non-colour cue |
|---|---|---|
| Crosshair | `--color-wash-crosshair` | — (lowest tier, no cue needed) |
| Matching digit | `--color-wash-matching` | Digit rendered at medium weight |
| Conflict | `--color-wash-conflict` | Conflict ink **and** a corner marker |
| Selected | *(inherits whichever fill applies)* | **2px ring** — the strongest cue, and the reason selection is not a fill |

Verified contrast for every combination is in `research.md` § R3 and enforced by
`tests/unit/palette.contrast.test.ts`.

---

## Cell content styling

| Content | Ink token | Distinguisher |
|---|---|---|
| Starting clue | `--color-ink-clue` | Medium weight, darkest ink |
| Player entry | `--color-ink-player` | Regular weight, ink blue |
| Agent entry *(feature 002)* | `--color-ink-player` | Italic **+ sage corner mark** — not a third ink |
| Pencil candidates | `--color-ink-note` | Small, fixed 3×3 positions within the cell |
| Conflicting digit | `--color-ink-conflict` | Clay ink + corner marker |

Candidates occupy fixed positions so a missing candidate is visible as a gap (FR-022).

---

## Accessibility

- Board exposed as a grid with row/column semantics; each cell announces its coordinates, its value or
  candidates, and whether it is a clue, selected, or conflicting (FR-047).
- Selection moves programmatic focus so screen-reader and sighted navigation stay in step.
- Conflicts announced politely, without stealing focus (FR-026, FR-048).
- All motion gated on `prefers-reduced-motion`; the pause overlay and completion banner appear without
  transition when reduced motion is requested (FR-049).
- Every control reachable by keyboard with a visible focus indicator (FR-046).

---

## Non-blocking guarantees

- Nothing modal. The completion banner is inline and dismissible; the pause overlay is player-initiated
  and dismissible at will (FR-038, FR-018 of feature 002's sibling rule).
- The board renders a skeleton during `generating` and never blanks the page.
- No spinner, dialog, or animation may prevent digit entry (SC-011).

---

## Responsive

- Usable to a 360 px viewport with no horizontal page scroll (FR-050).
- Board is a square that scales with the viewport; the keypad reflows below it on narrow screens.
- Touch targets ≥ 44 px on the keypad and controls.
