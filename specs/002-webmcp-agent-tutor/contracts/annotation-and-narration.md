# Contract: Annotation, Narration, and Accessibility

**Layer**: `src/ui/` | **Source of truth**: the agent session store

What the learner sees and hears when an agent is at work. Feature 001's rule holds unchanged: nothing
is conveyed by colour alone, and everything is reachable without a pointer.

---

## Visual roles

The learner's own highlighting is **entirely wash-based** — flat fills, no outlines, no lines. Agent
annotations therefore use **outlines, hatching, and rays**: form categories 001 never used. That is
what makes FR-032 ("distinguishable from the learner's own selection and crosshair") hold in
greyscale, under every colour-vision deficiency, and — the case that actually matters — while a
learner's wash is underneath.

| Role | Primary cue (form) | Secondary cue (colour) | Requirement |
|---|---|---|---|
| `target` | 2 px solid outline, inset, **plus a filled corner dot** | `--color-mark-agent` | FR-028 |
| `because` | diagonal hatch fill, **plus a hollow corner dot** | `--color-mark-agent-wash` | FR-028 |
| `beam` | dashed centre line spanning the unit, with end caps | `--color-mark-agent` | FR-029 |
| agent-placed digit | *italic* **plus** a sage corner glyph | `--color-ink-player` | FR-044 |
| agent-written candidate | sage corner glyph on the cell | `--color-ink-note` | FR-044 |

Three cues are load-bearing and each is asserted:

- **The corner dot distinguishes `target` from `because` with no colour at all.** Filled versus
  hollow survives greyscale; two tints of sage do not.
- **The selection ring stays unique to the learner.** No annotation role uses a full ring — that is
  001's strongest cue and it must keep meaning exactly one thing.
- **Beams are lines, washes are fills.** Where a beam crosses a crosshair, the two remain separable
  because they are different *kinds* of mark, not different colours (FR-029's overlap clause).

### Palette additions

Three tokens join `app/globals.css` — the only place they may exist:

| Token | Purpose | Contrast obligation |
|---|---|---|
| `--color-mark-agent-wash` | the `because` hatch fill | `--color-ink-player` and `--color-ink-clue` ≥ 4.5:1 on top of it |
| `--color-agent-surface` | explanation popups, toast, confirmation banner | `--color-ink-clue` ≥ 4.5:1 on it |
| `--color-agent-edge` | their border, and the connected badge | ≥ 3:1 against both `--color-surface` and `--color-agent-surface` |

`--color-mark-agent` (sage `#5E7A63`) was reserved by 001 and is reused unchanged.
`tests/unit/palette.contrast.test.ts` gains these to its required-token list and its computed ratios.
**These values are computed before anything renders, not chosen and checked later** — 001's first
candidate palette failed four such checks, which is why that order exists.

---

## The explanation queue

| Property | Value | Requirement |
|---|---|---|
| Length bounds | 20–240 characters, enforced by schema | FR-016 |
| Lifetime | ~6 s, or until dismissed | FR-019 |
| Visible at once | at most 3; further ones queue | FR-020 |
| Position | beside the board, never over it | FR-020 |
| Focus | never taken | FR-018, FR-022 |
| Rendering | text node only | FR-021 |
| Attribution | a sage agent glyph and the tool name | FR-017 |

**Untrusted text (FR-021)**: explanation text is rendered as a React text child. No
`dangerouslySetInnerHTML`, no markdown parsing, no URL auto-linking, no `<a>`, ever. A test feeds
`<img src=x onerror=alert(1)>`, `javascript:` URLs, and `[click](http://evil)` through `fill_cell` and
asserts the popup's `textContent` matches the input exactly while its `innerHTML` contains no element
and the document gained no anchor.

**Non-blocking (FR-018, SC-007)**: the queue is a `role="status"` region with `aria-live="polite"`. It
is not a dialog, has no focus trap, no backdrop, and no `autoFocus`. A test types digits continuously
while three explanations arrive and asserts every keystroke landed and `document.activeElement` never
changed.

---

## Accessibility

FR-060 and SC-011 require a screen-reader learner to receive every explanation and to be able to
determine every annotated cell — **without focus ever moving**. Two mechanisms, deliberately
redundant:

1. **Announcement.** Explanations and toasts are polite live regions. Annotations announce a summary
   when they change: *"Agent highlighted row 4 column 5 as the target, justified by row 4 column 1 and
   row 4 column 3."*
2. **Navigation.** The cell's own `aria-label` gains its role, so a learner arrowing across the board
   hears it in place rather than only in the announcement: *"Row 4, column 5, empty, agent target."*

The annotation overlay itself is `aria-hidden` and `pointer-events: none`. It is an absolutely
positioned sibling of the grid, never a child — `role="grid"` requires `role="row"` children, and 001
already paid for learning that (axe flags it as critical otherwise).

`prefers-reduced-motion` (FR-061): beams and highlights appear at their final state with no sweep, and
playback uses the same pacing without transition animation. The global rule in `globals.css` already
neutralises transitions; the sequencer additionally reads `reducedMotion` from the store so pacing is
a value, not a media query inside the tools layer.

---

## The connection indicator

FR-057: the learner can see an agent is connected and can disconnect it.

| `connection` | Renders |
|---|---|
| `absent` | **nothing** — no badge, no placeholder, no "no agent" text |
| `connected` | a small sage badge, "Agent connected", with a Disconnect button |
| `disconnected` | the badge in a neutral state, "Agent disconnected", with no reconnect control |

`absent` rendering nothing is FR-013 and SC-010: with no host present the page must be
indistinguishable from feature 001. The test for this compares the full accessibility tree of the app
with and without a host attached and asserts the no-host tree is identical to 001's.

Disconnect dispatches `requestDisconnect`; the registry aborts its controller; no further agent call
is applied. It is one-way within a session — a reconnect control would need a fresh registration that
the standard gives us no learner-initiated trigger for, and inventing one would be a parallel agent
channel, which Principle I forbids.

---

## The drill confirmation

FR-053's confirmation is an **inline banner**, not a modal. A modal would be exactly the blocking
feedback Principle V bans and would violate FR-056 outright.

- Renders above the board with the agent's `prompt` as literal text, plus **Load drill** and **Keep my
  board**.
- The learner may ignore it entirely and keep playing; the board stays live behind it.
- Unanswered after 60 s, it disappears and the tool resolves as `declined`.
- Declining is an ordinary outcome: `ok: true`, `outcome: "declined"` (FR-053).

---

## Invariants asserted by tests

1. **Greyscale**: all three annotation roles, plus agent-placed digits, remain distinguishable with
   colour removed (SC-004) — the same technique 001 used for its five highlight tiers.
2. **Colour-vision deficiency**: the same, simulated for protanopia, deuteranopia, and tritanopia.
3. **Agent versus learner versus clue** is determinable from a static screenshot with no interaction
   (SC-004).
4. **No annotation element is focusable** and none is in the tab order.
5. **Explanation text never becomes markup** — `innerHTML` free of elements, document free of new
   anchors, for a suite of hostile strings (FR-021, SC-012).
6. **Board input is never refused or delayed** while explanations, annotations, and playback are all
   active (SC-007).
7. **With no host, the accessibility tree is identical to feature 001's** (SC-010).
8. **axe reports no violations** with every annotation kind on screen, at 360 px and at desktop width.
