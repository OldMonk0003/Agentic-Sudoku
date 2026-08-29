# Feature Specification: Core Sudoku Play Experience

**Feature Branch**: `main` *(no dedicated feature branch — the git extension hook is not installed)*

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "First set of requirements is for the actual Sudoku Experience. Agentic Sudoku Website must be clean and minimalistic. Four non-negotiable human features: intelligent highlighting (crosshair focus + matching digit highlight); dual input and keyboard ergonomics (on-screen keypad with normal/pencil mode toggle, full keyboard support); essential game controls (difficulty dropdown, erase, undo, elapsed timer with pause, auto-pencil removal); lightweight conflict feedback (soft red duplicate highlighting). Explicitly cut: no accounts/auth, no database or cloud saves (localStorage only), no theme switchers, no complex statistics or leaderboards."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sit Down and Solve (Priority: P1)

A person opens the site and is immediately looking at a playable Sudoku grid. No sign-up, no menu,
no "choose your options" screen. They click a cell, type a number, and keep going until the puzzle
is filled. They can pick Easy, Medium, or Hard from a dropdown whenever they want a different
challenge, and they can wipe a cell they got wrong.

**Why this priority**: This is the product. Without a board that generates valid puzzles and accepts
digits, nothing else in this feature has anything to attach to. Every other story is an enhancement
layered on top of this loop.

**Independent Test**: Open the site cold, place digits into every empty cell of an Easy puzzle using
mouse and keypad, and reach a completed grid. Delivers a working Sudoku game on its own, even with
no highlighting, notes, timer, or persistence.

**Acceptance Scenarios**:

1. **Given** a first-time visitor with no saved data, **When** the page finishes loading, **Then** a
   fully generated puzzle is on screen and immediately playable with no intermediate screen, prompt,
   or account step.
2. **Given** a puzzle on screen, **When** the player clicks an empty cell and presses `7`, **Then**
   `7` appears in that cell, styled distinctly from the puzzle's starting clues.
3. **Given** a cell containing a starting clue, **When** the player selects it and presses any digit
   or `Delete`, **Then** the clue is unchanged and the interface indicates the cell is fixed without
   opening a dialog or interrupting play.
4. **Given** a partially solved Medium puzzle, **When** the player selects `Hard` from the difficulty
   dropdown, **Then** a fresh Hard puzzle replaces the board immediately and the timer restarts.
5. **Given** any generated puzzle at any difficulty, **When** the puzzle is solved by exhaustive
   search, **Then** exactly one valid solution exists.

---

### User Story 2 - See the Board at a Glance (Priority: P2)

While scanning for where a digit can go, the player selects a cell and the grid quietly tells them
what matters: the row, column, and box they are working in are tinted, and if the selected cell
holds a digit, every other instance of that digit lights up across the board.

**Why this priority**: This is what separates a modern Sudoku UI from a spreadsheet. It is the single
highest-leverage reduction in eye strain and scanning effort, and players coming from any mainstream
Sudoku app expect it on arrival.

**Independent Test**: With a static, pre-filled board and no other features, click cells and confirm
the correct tinting appears and disappears. Delivers measurably faster visual scanning on its own.

**Acceptance Scenarios**:

1. **Given** a puzzle on screen, **When** the player selects the cell at row 4, column 6, **Then**
   all cells in row 4, all cells in column 6, and all cells in that cell's 3x3 box are tinted, and
   the selected cell itself is emphasised more strongly than its peers.
2. **Given** a board containing six `5`s, **When** the player selects any cell containing a `5`,
   **Then** all six cells showing `5` are highlighted simultaneously.
3. **Given** the player has selected a cell containing a `5`, **When** they then select an empty
   cell, **Then** the matching-digit highlight clears and only the crosshair tint for the new cell
   remains.
4. **Given** any selection, **When** highlighting updates, **Then** no cell value, note, timer, or
   history entry changes as a result.

---

### User Story 3 - Catch Mistakes Early (Priority: P3)

The player places a digit that duplicates one already in the same row, column, or box. Both the digit
they just placed and the one it collides with are marked in soft red. The player is not stopped, not
scolded, and not told whether the digit is "correct" — only that the board now contradicts itself.

**Why this priority**: Without it, a single early error silently poisons an hour of work. It is
inexpensive to provide and dramatically reduces frustration, but the game is still playable without
it, so it sits below the core loop and highlighting.

**Independent Test**: On a pre-filled board, place known duplicates in a row, a column, and a box,
and confirm each is flagged and each clears when resolved. Delivers error visibility on its own.

**Acceptance Scenarios**:

1. **Given** a row already containing a `3`, **When** the player enters `3` into another cell in that
   row, **Then** both cells are marked as conflicting.
2. **Given** two cells marked as conflicting, **When** the player erases one of them, **Then** both
   conflict markings clear.
3. **Given** a conflicting digit on the board, **When** the player continues playing, **Then** they
   may enter digits anywhere else without dismissing or resolving the conflict first.
4. **Given** a player using a screen reader or with a colour vision deficiency, **When** a conflict
   occurs, **Then** the conflict is conveyed by a cue other than colour alone and is announced to
   assistive technology.
5. **Given** a digit that is legal against the current board but wrong against the puzzle's unique
   solution, **When** it is entered, **Then** it is NOT marked, because the system reports
   contradictions only, never solution correctness.

---

### User Story 4 - Think in Pencil (Priority: P4)

The player switches to pencil mode and jots candidate digits into cells. Later, when they commit a
real digit to a cell, the board quietly strips that candidate from every note in the same row,
column, and box — the bookkeeping a paper player would do by hand.

**Why this priority**: Notes are essential for Hard puzzles and expected by experienced players, but
Easy and Medium boards are solvable without them, so this follows the core loop and error feedback.

**Independent Test**: Toggle to pencil mode, add and remove candidates, then place a digit and verify
peer notes update. Delivers full note-taking on its own.

**Acceptance Scenarios**:

1. **Given** the input mode toggle set to Notes, **When** the player presses `4` on an empty cell,
   **Then** `4` appears as a small candidate mark, not as the cell's value.
2. **Given** a cell whose candidates include `4`, **When** the player presses `4` again in Notes
   mode, **Then** `4` is removed from that cell's candidates.
3. **Given** the player is in Normal mode, **When** they press `Spacebar` or `N`, **Then** the mode
   switches to Notes and the currently active mode is visible on screen at all times.
4. **Given** several cells in row 2 carry `8` as a candidate, **When** the player commits `8` as the
   value of another cell in row 2, **Then** `8` is removed from the candidates of every cell in that
   row, that column, and that box.
5. **Given** a digit placement that also stripped candidates, **When** the player presses Undo once,
   **Then** both the placed digit and every automatically stripped candidate are restored together.

---

### User Story 5 - Take Back and Take a Break (Priority: P5)

The player mis-taps, hits Undo, and the board steps backwards. A stopwatch counts their solve, and
they can pause it when the phone rings without the board sitting exposed.

**Why this priority**: Quality-of-life controls that make longer sessions tolerable. The puzzle is
fully solvable without them, so they follow the features that affect solving itself.

**Independent Test**: Make a series of changes, undo them all the way back to the starting position,
and pause/resume the timer. Delivers session control on its own.

**Acceptance Scenarios**:

1. **Given** the player has made five changes, **When** they press Undo five times, **Then** the
   board returns to its untouched starting state and Undo becomes unavailable.
2. **Given** an untouched fresh puzzle, **When** the player looks at the Undo control, **Then** it is
   visibly unavailable.
3. **Given** a running timer showing `04:12`, **When** the player presses Pause, **Then** the time
   stops advancing and the board is obscured so play cannot continue while paused.
4. **Given** a paused game, **When** the player resumes, **Then** the board reappears and the timer
   continues from `04:12` rather than restarting.
5. **Given** the player selects a new difficulty, **When** the fresh board appears, **Then** the undo
   history from the previous puzzle is discarded and cannot be stepped back into.

---

### User Story 6 - Pick Up Where You Left Off (Priority: P6)

The player refreshes the tab, closes the laptop, or comes back later in the same browser, and their
half-finished grid, their pencil notes, and their elapsed time are exactly as they left them.

**Why this priority**: Protects work already done, but every preceding story must exist before there
is anything worth restoring.

**Independent Test**: Play partway through a puzzle, reload the page, and confirm the exact board
state returns. Delivers continuity on its own.

**Acceptance Scenarios**:

1. **Given** a partially solved puzzle with pencil notes and `07:30` elapsed, **When** the player
   reloads the page, **Then** the same puzzle, the same entered digits, the same notes, the same
   difficulty, and an elapsed time of `07:30` are restored.
2. **Given** a device where saving is unavailable or storage is full, **When** the player uses the site,
   **Then** the game remains fully playable for the session and the player is informed unobtrusively
   that progress will not be saved.
3. **Given** saved data written by an older or incompatible version of the site, **When** the page
   loads, **Then** the unreadable data is discarded and a fresh puzzle is presented instead of an
   error state.
4. **Given** a player using the site, **When** any progress is saved, **Then** no game data is
   transmitted off the device.

---

### Edge Cases

- **Filled board that is wrong**: all 81 cells hold digits but conflicts remain. The puzzle is not
  treated as complete; conflicts stay marked and play continues.
- **Rapid difficulty switching**: the player changes difficulty repeatedly in quick succession. Only
  the most recently requested puzzle is shown, and no partially generated board ever reaches the
  screen.
- **Difficulty change discards work**: switching difficulty mid-solve destroys the current board with
  no confirmation, per the explicit "instantly" requirement. See Assumptions.
- **Selection at grid edges**: pressing an arrow key or `WASD` at the boundary leaves the selection
  where it is; the selection does not wrap around to the opposite edge.
- **Typing with nothing selected**: digit and delete keys are ignored until a cell is selected.
- **Keyboard shortcut collisions**: `Spacebar` toggles pencil mode only while the board has focus,
  never while a button or the difficulty dropdown holds focus, so it cannot silently flip modes
  while the player is operating a control.
- **Erasing a cell with both a value and stale notes**: a single erase clears whatever the cell is
  currently displaying, and one Undo restores it.
- **Auto-removal has nothing to remove**: placing a digit whose peers carry no matching candidate
  still records exactly one undoable step.
- **Pause during completion**: the timer cannot be paused once the puzzle is complete.
- **Two tabs open on the same browser**: the tab that most recently saved wins; no merge is attempted
  and neither tab errors. See Assumptions.
- **Very small viewport**: the grid, keypad, and controls remain usable without horizontal scrolling
  of the page.
- **Conflicts involving a starting clue**: the clue is marked as part of the conflict pair but remains
  uneditable; only the player's own digit can be removed to resolve it.

## Requirements *(mandatory)*

### Functional Requirements

**Board and puzzle generation**

- **FR-001**: The site MUST present a fully playable puzzle on first load with no account, sign-in,
  landing page, configuration step, or modal standing between arrival and play.
- **FR-002**: Every puzzle presented to a player MUST have exactly one valid solution.
- **FR-003**: The system MUST offer exactly three difficulty levels — Easy, Medium, and Hard — chosen
  from a dropdown, where the level reflects the solving techniques the puzzle actually requires.
- **FR-004**: Selecting a difficulty MUST immediately generate and display a fresh puzzle of that
  level, replacing the current board, resetting the timer, and clearing undo history.
- **FR-005**: Starting clues MUST be visually distinct from player-entered digits and MUST NOT be
  editable, erasable, or clearable by any input path.

**Selection and highlighting**

- **FR-006**: Exactly one cell MUST be selected at a time, selectable by pointer or keyboard.
- **FR-007**: Selecting a cell MUST tint every cell in its row, its column, and its 3x3 box.
- **FR-008**: Selecting a cell that contains a digit MUST highlight every other cell on the board
  displaying that same digit, whether that digit is a starting clue or a player entry.
- **FR-009**: The selected cell, matching-digit cells, and crosshair cells MUST be distinguishable
  from one another and from unhighlighted cells at a glance, and MUST be separated by something
  other than hue alone — luminance, border weight, or type weight — so the tiers survive a
  greyscale rendering (see SC-010).
- **FR-010**: Highlighting MUST be passive: it MUST NOT alter cell values, notes, elapsed time, undo
  history, or completion state.
- **FR-011**: Selecting an empty cell MUST show the crosshair tint only, with no matching-digit
  highlight.

**Input**

- **FR-012**: An on-screen keypad offering digits 1 through 9 MUST be available at all times during
  play.
- **FR-013**: An explicit toggle MUST switch between Normal (value) and Notes (pencil) input, and the
  currently active mode MUST be visible on screen at all times.
- **FR-014**: Pressing `Spacebar` or `N` MUST toggle between Normal and Notes mode.
- **FR-015**: Pressing `1`–`9` MUST enter a value in Normal mode and a candidate in Notes mode, into
  the selected cell.
- **FR-016**: In Notes mode, entering a candidate already present in the selected cell MUST remove
  that candidate.
- **FR-017**: Committing a value to a cell MUST clear any candidates previously held by that cell.
- **FR-018**: `Backspace` and `Delete` MUST clear the selected cell's value, or all of its candidates
  if it holds no value, and MUST have no effect on a starting clue.
- **FR-019**: `Arrow Up/Down/Left/Right` and `W/A/S/D` MUST move the selection one cell in the
  corresponding direction, stopping at the grid boundary without wrapping.
- **FR-020**: The on-screen keypad and the physical keyboard MUST produce identical results for the
  equivalent action.
- **FR-021**: An attempt to modify a starting clue MUST be rejected with a brief non-blocking
  indication and MUST NOT open a dialog, steal focus, or interrupt play.

**Pencil notes**

- **FR-022**: A cell MUST be able to hold any subset of the candidates 1–9, each rendered in a fixed,
  consistent position within the cell so candidate positions are scannable.
- **FR-023**: Committing a digit to a cell MUST automatically remove that digit from the candidates
  of every other cell in the same row, column, and 3x3 box.
- **FR-024**: A digit placement and the candidate removals it triggers MUST be recorded as a single
  undoable step.

**Conflict feedback**

- **FR-025**: When a player's digit duplicates a digit already present in the same row, column, or
  box, all cells participating in that duplication MUST be marked in a soft, muted red — clay-toned
  rather than alert red, per FR-052.
- **FR-026**: Conflict state MUST additionally be conveyed by at least one non-colour cue and MUST be
  exposed to assistive technology, so it is never communicated by colour alone.
- **FR-027**: Conflicts MUST NOT block input: the player may leave a conflict unresolved and continue
  entering digits elsewhere, and no dialog or confirmation may appear.
- **FR-028**: Conflict state MUST be re-evaluated after every change and MUST clear as soon as the
  duplication no longer exists.
- **FR-029**: The system MUST report duplicate-constraint violations only, and MUST NOT indicate
  whether a legally placed digit matches the puzzle's unique solution.

**Game controls**

- **FR-030**: An Erase control MUST clear the active cell's value or candidates, and MUST never
  affect a starting clue.
- **FR-031**: An Undo control MUST revert the most recent player change — value entry, candidate
  change, erase, or an auto-removal bundle — and MUST be usable repeatedly back to the puzzle's
  untouched starting state.
- **FR-032**: Undo MUST be visibly unavailable when there is nothing to undo.
- **FR-033**: Undo history MUST NOT cross a new-puzzle boundary; a fresh puzzle starts with empty
  history.
- **FR-034**: An elapsed timer MUST count up from the start of a puzzle and display in `MM:SS` form.
- **FR-035**: A Pause control MUST halt the timer and obscure the board so play cannot continue while
  paused; resuming MUST restore the board and continue the timer from where it stopped.
- **FR-036**: The timer MUST stop when the puzzle is completed.

**Completion**

- **FR-037**: The system MUST recognise completion when all 81 cells hold digits and no conflicts
  remain.
- **FR-038**: Completion MUST be communicated without blocking the interface, MUST show the final
  elapsed time, and MUST offer starting a new puzzle.
- **FR-039**: A completed board MUST become read-only until a new puzzle is started.

**Persistence**

- **FR-040**: The current session — puzzle, starting clues, player digits, candidates, difficulty,
  and elapsed time — MUST be saved on the player's own device as it changes.
- **FR-041**: Returning to the site in the same browser MUST restore the saved session exactly,
  including elapsed time.
- **FR-042**: If on-device storage is unavailable, full, or refuses to write, the game MUST remain fully playable
  for the session and MUST inform the player unobtrusively that progress will not be saved.
- **FR-043**: No game data may leave the device: no accounts, no server storage, and no network
  request for any gameplay function.
- **FR-044**: Saved data that cannot be read or is from an incompatible version MUST be discarded
  safely and replaced with a fresh puzzle, never surfaced as an error or a broken board.

**Presentation and accessibility**

- **FR-045**: The site MUST ship a single fixed visual aesthetic — **Japandi**, the warm-minimal
  fusion of Japanese restraint and Scandinavian functionalism — with no theme switcher, no user
  styling controls, and no dark/light toggle.
- **FR-046**: Every interactive element MUST be reachable and operable by keyboard alone, with a
  visible focus indicator.
- **FR-047**: Assistive technology MUST be able to determine a cell's coordinates, its value or
  candidates, and whether it is a clue, selected, highlighted, or conflicting.
- **FR-048**: No gameplay information may be conveyed by colour alone.
- **FR-049**: Any motion or transition MUST be reduced or removed when the player's system indicates
  a preference for reduced motion.
- **FR-050**: The board, keypad, and controls MUST remain usable down to a 360-pixel-wide viewport
  without horizontal page scrolling, with touch targets large enough for finger input.
- **FR-051**: The system MUST NOT collect, display, or store win rates, streaks, solve histories,
  leaderboards, or any cross-session statistics.
- **FR-052**: The palette MUST be warm and low-saturation: a paper-toned ground rather than pure
  white, soft charcoal ink rather than pure black, and any accent drawn from muted earth tones
  (clay, terracotta, sage). Saturated signal colours MUST NOT appear anywhere in the interface,
  including the conflict marking, which MUST read as muted clay rather than alert red.
- **FR-053**: The grid MUST express its 3x3 structure through line weight rather than colour: hairline
  separators between cells and heavier framing between boxes, giving the board the panelled
  structure of a shoji screen.
- **FR-054**: The interface MUST favour negative space and restraint over ornament: no gradients, no
  gloss, no decorative shadows, no more than two type weights, and no animation that exists for
  decoration rather than to explain a change of state.

### Key Entities

- **Puzzle**: One generated Sudoku instance. Holds the 81 starting clues, its unique solution, its
  difficulty level, and the seed that reproduces it. Immutable once generated.
- **Cell**: One of 81 positions, addressed by row and column and belonging to exactly one 3x3 box.
  Holds either a starting clue, a player-entered digit, or a set of candidates, plus its derived
  display states (selected, crosshair, matching-digit, conflicting).
- **Game Session**: The player's live progress against one Puzzle — all cell contents, the current
  selection, the active input mode, elapsed time, paused or completed status, and the change history.
  This is the unit that is saved and restored.
- **Change Record**: One undoable step in the session's history, capturing everything a single player
  action altered — including candidates removed automatically as a consequence — so one Undo restores
  the exact prior state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor is looking at a playable puzzle within 2 seconds of opening the
  site, having taken zero actions to get there.
- **SC-002**: Changing difficulty puts a new, fully generated board on screen in under half a second.
- **SC-003**: Across an audit of 10,000 generated puzzles spanning all three difficulties, 100% have
  exactly one solution.
- **SC-004**: Selection, highlighting, conflict marking, and digit entry become visible within 100
  milliseconds of the input that caused them.
- **SC-005**: A player can start, play, and complete an entire puzzle using only the keyboard,
  without touching a pointing device at any point.
- **SC-006**: Reloading the page mid-game restores the exact board, notes, difficulty, and elapsed
  time in 100% of trials where local storage is available.
- **SC-007**: After committing a digit, 100% of that digit's candidate marks in the affected row,
  column, and box are removed with no manual cleanup by the player.
- **SC-008**: 90% of first-time players place their first digit within 15 seconds of the page loading,
  without instructions, a tutorial, or an onboarding overlay.
- **SC-009**: A player can disconnect from the network entirely and complete a full solve session —
  generation, play, saving, and reloading — with no loss of function and no gameplay data leaving
  the device.
- **SC-010**: All gameplay states — selected, crosshair, matching-digit, conflict, clue versus
  player-entered — remain distinguishable in a greyscale rendering of the screen, and all text and
  state indicators meet WCAG 2.1 AA contrast.
- **SC-011**: The board never stops accepting input while the player is solving: no action produces
  a perceptible freeze, and no modal, spinner, or overlay other than the player's own Pause ever
  prevents them from continuing to enter digits.

## Assumptions

These are reasonable defaults chosen where the feature description did not specify. Each can be
changed before planning without restructuring the feature.

- **Difficulty change is destructive and unconfirmed.** The description specifies a fresh board
  "instantly", so no "are you sure, you will lose progress" confirmation is shown. Flagged because it
  can silently discard a long solve; say so if a guard is wanted instead.
- **Matching-digit highlight applies to placed values only**, not to pencil candidates containing
  that digit. Selecting a cell with a `5` highlights other cells *showing* `5`, not cells that merely
  list `5` as a candidate.
- **Undo is full-depth**, stepping back through every change to the start of the current puzzle,
  rather than a single-level undo. There is no Redo in this feature.
- **Erasing a digit does not restore candidates** that its placement automatically removed. Only Undo
  restores them, and it does so as one atomic step.
- **Pause obscures the board**, which is standard practice to prevent solving on a stopped clock. The
  overlay is player-initiated and dismissible at will, so it does not count as blocking feedback.
- **The timer starts on page load / puzzle generation** rather than on the player's first input.
- **Completion is celebrated inline**, as a non-blocking banner with the final time and a "new
  puzzle" action — not a modal that must be dismissed.
- **Touch and mobile are in scope** down to a 360-pixel viewport, since an on-screen keypad implies
  touch use. This is the largest scope assumption here; confirm before planning if desktop-only was
  intended.
- **Multiple tabs are last-write-wins.** No cross-tab synchronisation or merge is attempted, and no
  warning is shown when a second tab is opened.
- **One puzzle is saved at a time.** There is no library of in-progress games, and starting a new
  puzzle overwrites the saved one.
- **The chosen aesthetic is Japandi** — warm off-white ground, soft charcoal ink, muted earth accents,
  shoji-style grid framing — fixed for all users, replacing the neutral-slate palette the description
  originally offered as an example. The known tension is that Japandi's muted surfaces can drift below
  accessible contrast; the resolution is to keep ink-on-ground contrast high and confine the muted
  tones to surfaces and highlight washes, with the highlight tiers separated by luminance rather than
  hue (FR-009, FR-052, SC-010).
- **No hints, no auto-solve, no "check my board" in this feature.** Teaching and assistance are the
  agent's role and belong to a later feature.

## Out of Scope

Deliberately excluded from this feature, either cut by the description or deferred:

- User accounts, authentication, profiles, and any server-side identity.
- Databases, cloud saves, and cross-device synchronisation.
- Theme switchers, custom palettes, font pickers, and styling engines.
- Win rates, streaks, solve-time graphs, leaderboards, and historical statistics.
- Hints, technique explanations, auto-solve, and correctness checking against the solution.
- The agent collaboration surface itself — WebMCP tool registration and agent-driven play — which is
  a separate feature. This feature must leave the game state observable and mutable through a single
  set of actions so that surface can be added later without reworking the board.
- Puzzle variants (Killer, Samurai, irregular regions), grid sizes other than 9x9, and difficulty
  levels beyond Easy, Medium, and Hard.
- Printing, export, import, and puzzle sharing by link or code.
