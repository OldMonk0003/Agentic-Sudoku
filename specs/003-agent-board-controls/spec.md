# Feature Specification: Agent Board Controls & Coordinate Ruler

**Feature Branch**: `003-agent-board-controls` *(branch yourself — the git extension hook is not installed here)*

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "New WebMCP tools to be added — 1. WebMCP tool for agent to switch difficulty. 2. WebMCP tool for agent to Pause timer. 3. WebMCP tool for agent to Resume Timer. 4. WebMCP tool for agent to Annotate Row and Column (see attached screenshot Specification4-RowColumnAnnotation) so that a user has less cognitive load instructing agent which row and column to fill. This will require front end change too. 5. WebMCP tool for agent to remove Annotation set in 4. 6. Currently when agent instructs to fill a row column with a number the row/column highlighter doesn't move (specification6-AgentDoesntMoveTheHighlightedColumn). Fix this. As webmcp tool is called to fill a row and column highlighter should also move there."

**Depends on**: `specs/001-sudoku-play-experience` and `specs/002-webmcp-agent-tutor`. References below in the
form `001/FR-0xx` and `002/FR-0xx` point at those specifications. This feature adds five tools to the
eleven 002 registered, and changes what the learner sees when the agent acts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - I Can Read the Coordinates Off the Board (Priority: P1)

The learner wants to ask the agent about a specific cell, but naming it means counting squares —
across for the column, down for the row — every single time, and getting it wrong is easy on a board
of 81 identical boxes. They ask the agent to label the grid. Numbers appear along the top and down the
left side, 1 through 9 each way. From then on the learner reads a coordinate straight off the board:
*"what goes in row 4, column 7?"* No counting, no miscounts, no correcting the agent afterwards.

**Why this priority**: This is the whole point of the request — it removes friction from every future
sentence the learner says to the agent, which makes every other capability in this feature and in 002
cheaper to use. It also changes nothing about the game: it is pure readability, cannot be wrong, and
cannot damage a puzzle. It ships first.

**Independent Test**: With only the ruler tools registered, ask an agent to label the grid on a
mid-game board. Confirm the numbers appear on both axes, that every digit, candidate, highlight, and
the clock are untouched, and that the learner can name any cell without counting.

**Acceptance Scenarios**:

1. **Given** an unlabelled board, **When** the agent turns the coordinate ruler on, **Then** the
   column numbers 1 through 9 appear across the top and the row numbers 1 through 9 down the left,
   matching the board's canonical addressing (002/FR-007).
2. **Given** the ruler is showing, **Then** no cell value, candidate, conflict mark, elapsed time,
   selection, or undo entry has changed.
3. **Given** the ruler is showing, **When** the agent removes it, **Then** the labels disappear and
   the board is otherwise exactly as it was.
4. **Given** the ruler is showing, **When** the learner leaves it alone for several minutes, **Then**
   it is still showing — it does not fade or expire like a teaching annotation.
5. **Given** no agent is connected at all, **When** the learner turns the ruler on themselves,
   **Then** it appears and behaves identically, because it is an ordinary readability aid.
6. **Given** the ruler is showing, **When** the board is viewed at the narrowest supported width,
   **Then** the labels remain legible and the grid remains fully usable (001/FR-050).
7. **Given** a learner using a screen reader, **When** the ruler is on, **Then** the labels do not
   add noise to cell-by-cell navigation, because each cell already announces its own coordinates
   (001/FR-047).

---

### User Story 2 - I Can See Where the Agent Just Acted (Priority: P2)

The learner is studying the bottom-left of the board when the agent places a digit up in row 1. Today
nothing on the board moves, and they have to hunt for the change the explanation is describing. Now
the agent's cell is spotlit in the agent's own visual language — its row, its column, and its box are
picked out, plainly marked as the agent's doing — while the learner's own selection stays exactly
where they left it, still taking their next keypress.

**Why this priority**: It closes the gap between *"the agent says it filled row 1, column 3"* and
*"I can see row 1, column 3"*, which is the difference between reading a claim and watching a lesson.
It is second because it is only meaningful once there is something to look at, and because it must not
be built in a way that takes the board away from the learner.

**Independent Test**: With the learner's selection parked on one cell, have the agent fill a different
cell. Confirm the agent's cell is spotlit, that the spotlight is attributed to the agent and not
mistakable for the learner's own crosshair, that the learner's selection and keyboard focus have not
moved, and that the learner's next keypress still lands where they were looking.

**Acceptance Scenarios**:

1. **Given** the learner's selection is at row 5, column 4, **When** the agent fills row 1, column 3,
   **Then** the agent's row, column, and box are visibly spotlit around row 1, column 3.
2. **Given** the agent's spotlight is showing, **Then** the learner's own crosshair at row 5, column 4
   is still showing and the two are distinguishable from one another at a glance.
3. **Given** the agent has just filled a cell, **When** the learner presses a digit key, **Then** the
   digit goes into the cell the learner had selected, not the cell the agent acted on.
4. **Given** the agent's spotlight is showing, **Then** keyboard focus has not moved and no input the
   learner was making was interrupted.
5. **Given** the agent fills a second cell, **Then** the spotlight moves to the new cell rather than
   accumulating, so there is never more than one agent spotlight on the board.
6. **Given** the agent's spotlight is showing, **When** a readable interval passes, **Then** it clears
   itself, because it is a transient annotation and must not deface the board (002/FR-033).
7. **Given** a learner who cannot distinguish colours, **When** both crosshairs are on screen,
   **Then** they can still tell the agent's spotlight from their own (001/FR-048, 002/FR-035).
8. **Given** the agent writes pencil marks rather than a digit, **Then** the same spotlight behaviour
   applies to the cells it wrote.

---

### User Story 3 - Give Me a Harder One (Priority: P3)

The learner has been solving Easy boards comfortably and says so. The agent suggests moving up, and —
once the learner confirms, because their current board is about to be set aside — loads a fresh Hard
puzzle, explaining why it thinks they are ready.

**Why this priority**: Difficulty is the single biggest lever on whether practice is useful, and a
tutor that cannot adjust it is coaching blind. It sits behind the two visual stories because it
discards the learner's work, and because the learner can already change difficulty themselves.

**Independent Test**: From a partly solved board, ask the agent to switch difficulty. Confirm the
learner is asked first, that declining leaves the board untouched, and that accepting produces a fresh
puzzle at the requested level with a clean clock and empty undo history.

**Acceptance Scenarios**:

1. **Given** a board with the learner's progress on it, **When** the agent requests a different
   difficulty, **Then** the learner is asked to confirm before anything is replaced.
2. **Given** the confirmation prompt, **When** the learner declines, **Then** their board, clock, and
   history are untouched and the agent is told the learner declined — an ordinary outcome, not an error.
3. **Given** the learner accepts, **Then** a fresh puzzle at the requested difficulty appears, with
   exactly one solution, a clock reset to zero, and no undo history carried across (001/FR-033).
4. **Given** an untouched board with no progress on it, **When** the agent requests a different
   difficulty, **Then** the change happens without a confirmation prompt, because nothing is being lost.
5. **Given** the agent requests the difficulty the board is already at, **Then** a fresh puzzle at that
   level is generated, matching what the learner's own difficulty control does (001/FR-004).
6. **Given** the agent names a difficulty the game does not offer, **Then** the request is rejected
   with the list of levels that exist, and the board is unchanged.
7. **Given** the new puzzle is being generated, **Then** the learner is never locked out of the
   interface and the agent's call returns once the board is ready.

---

### User Story 4 - Take a Breath (Priority: P4)

The learner has been going for twenty minutes and the agent suggests a pause. It stops the clock,
explaining why. When the learner comes back, either of them can start it again.

**Why this priority**: It rounds out the agent's command of the session controls the learner already
has, and it is the smallest of the additions. It ships last because the learner can already pause and
resume with one click, so the tool adds convenience rather than capability.

**Independent Test**: With the clock running, have the agent pause. Confirm the clock stops, the board
is obscured as it is for a learner-initiated pause, that the learner can resume with their own control,
and that the agent can resume as well.

**Acceptance Scenarios**:

1. **Given** a running clock, **When** the agent pauses, **Then** the clock stops and the board is
   obscured exactly as a learner-initiated pause does (001/FR-035).
2. **Given** the agent has paused, **When** the learner presses their own Resume control, **Then** play
   resumes normally, so the learner is never dependent on the agent to get their board back.
3. **Given** a paused board, **When** the agent resumes, **Then** the clock restarts from where it
   stopped and the board is playable again.
4. **Given** a paused board, **When** the agent attempts any change other than resuming, **Then** it is
   rejected because the board is paused (002/FR-045), and reads still succeed.
5. **Given** a board that is not running, **When** the agent pauses, **Then** the request is rejected
   with a reason naming the board's actual state, and nothing changes.
6. **Given** a running board, **When** the agent resumes, **Then** the request is rejected as
   redundant, and nothing changes.
7. **Given** the agent pauses or resumes, **Then** the explanation appears on screen attributed to the
   agent, so the learner is never surprised by a stopped or restarted clock (002/FR-017).

---

### Edge Cases

- **Ruler on, then the agent disconnects**: the labels stay. They belong to the learner, not to the
  agent session, and are removed only by the learner or by an explicit removal request.
- **Ruler removal when no ruler is showing**: succeeds as a no-op rather than failing, so an agent
  tidying up cannot be tripped by uncertainty about the current state.
- **Learner turns the ruler off while the agent believes it is on**: the agent's next removal request
  succeeds as a no-op; a request to show it again re-displays it. Neither actor's view of the ruler is
  authoritative over the other's.
- **Ruler across a reload**: the learner's ruler preference is remembered with the rest of the session
  (001/FR-040); an unreadable stored preference falls back to off (001/FR-044).
- **Ruler at the narrowest supported viewport**: labels shrink but stay legible, and the grid must not
  be squeezed below usability (001/FR-050).
- **Spotlight while the learner has no selection**: the agent's spotlight shows on its own; there is no
  learner crosshair to distinguish it from, and nothing is implied about the learner's selection.
- **Spotlight on the same cell the learner has selected**: both are shown; the learner's selection
  marking takes visual precedence, and the agent's attribution is still discernible.
- **Spotlight during a walkthrough**: it follows each step as the step executes, so the learner's eye
  tracks the sequence, and clears when the sequence ends.
- **Agent fills the last cell**: the puzzle completes; the spotlight clears with the completion, and
  completion behaves exactly as 001/FR-037 through 001/FR-039 specify.
- **Difficulty change during a walkthrough**: the walkthrough stops, because its remaining steps refer
  to a board that no longer exists, and the agent is told how far it got (002/FR-049).
- **Difficulty change while paused or complete**: rejected on a paused board; permitted on a complete
  board, since there is no progress left to lose.
- **Difficulty confirmation left unanswered**: resolves as declined after the same interval the drill
  confirmation uses, rather than hanging the agent's call forever.
- **Two confirmations at once**: a difficulty request arriving while a drill confirmation is already
  waiting is rejected with a reason, so the learner is never shown two competing prompts.
- **Generation fails to produce a verified puzzle**: the learner's board is left exactly as it was and
  the agent is told generation failed, because an unverified puzzle must never reach a player.
- **Pause requested while a walkthrough is playing**: the walkthrough stops at the last completed step
  and the agent is told, rather than steps executing invisibly behind a pause overlay.
- **Agent pauses and then disconnects**: the learner resumes with their own control; a paused board is
  never a board the learner cannot recover.
- **No agent host present**: none of the five tools exist, no agent-related control appears, and the
  learner's own ruler toggle, difficulty select, pause, and resume all work exactly as before
  (002/FR-013).

## Requirements *(mandatory)*

### Functional Requirements

**Tool surface**

- **FR-001**: The agent surface MUST gain exactly five tools — switch difficulty, pause the timer,
  resume the timer, show the coordinate ruler, and remove the coordinate ruler — bringing the surface
  to sixteen, all registered through the same standard channel as the existing eleven (002/FR-001).
- **FR-002**: Each new tool MUST satisfy every existing surface rule unchanged: a strict input schema
  that rejects unrecognised arguments (002/FR-003), one discrete nameable action per tool
  (002/FR-004), a declared statement of whether it changes anything (002/FR-005), a description
  sufficient for an agent that has never seen this site (002/FR-006), the canonical addressing
  convention (002/FR-007), a structured result in both success and failure (002/FR-008), and a
  failure reason specific enough to correct and retry (002/FR-009).
- **FR-003**: All five new tools change something the learner can perceive and MUST therefore require
  explanation text under the existing narration contract (002/FR-014 through FR-022) — including the
  two ruler tools, because the board's appearance changes.
- **FR-004**: The tool surface version MUST be raised to record the addition, and no existing tool's
  name, input constraints, or result shape may be narrowed or removed by this feature (002/FR-010).
- **FR-005**: Registration of the new tools MUST remain isolated from interface rendering and
  enumerable with no interface rendered (002/FR-011), and MUST remain idempotent and reversible
  (002/FR-012).

**The coordinate ruler**

- **FR-006**: The board MUST be able to display a coordinate ruler: the column numbers 1 through 9
  across the top of the grid and the row numbers 1 through 9 down its left side, each axis carrying a
  visible label naming what it numbers.
- **FR-007**: The ruler's numbering MUST match the canonical addressing convention used by every tool
  — rows 1 to 9 top to bottom, columns 1 to 9 left to right (002/FR-007) — so a coordinate the learner
  reads off the board is the coordinate the agent understands.
- **FR-008**: The ruler MUST be visually subordinate to the grid: legible enough to read a coordinate
  from, quiet enough that it does not compete with the digits (001/FR-054).
- **FR-009**: One tool call MUST show the ruler for the whole grid; the ruler is not aimed at a
  particular row or column.
- **FR-010**: A second tool call MUST remove the ruler, returning the board to its unlabelled
  appearance.
- **FR-011**: Showing a ruler that is already showing, and removing one that is not, MUST both succeed
  as no-ops rather than failing.
- **FR-012**: The ruler MUST persist until it is explicitly removed. It MUST NOT expire on a timer,
  and is the one board marking exempt from the automatic expiry of 002/FR-033.
- **FR-013**: The learner MUST have their own always-available control to show and hide the ruler,
  present and working whether or not an agent is connected.
- **FR-014**: The ruler MUST NOT alter any cell value, candidate, conflict state, selection, elapsed
  time, or undo history, and MUST NOT be undoable — it is a view preference, not a move.
- **FR-015**: The learner's ruler preference MUST be remembered across a reload with the rest of the
  session (001/FR-040), and MUST default to hidden for a learner who has never set it.
- **FR-016**: The ruler MUST remain legible and MUST NOT compromise the board's usability at the
  narrowest supported viewport (001/FR-050).
- **FR-017**: The ruler MUST NOT add redundant announcements to assistive technology, because every
  cell already reports its own coordinates (001/FR-047).

**The agent spotlight**

- **FR-018**: When an agent changes one or more cells, the board MUST spotlight the changed location —
  its row, its column, and its box — so the learner can see where the change happened without
  searching for it.
- **FR-019**: The spotlight MUST NOT move the learner's selection, MUST NOT move keyboard focus, and
  MUST NOT change which cell the learner's next input affects. The learner's uninterrupted control
  (002/FR-056) is preserved exactly.
- **FR-020**: The spotlight MUST be visually attributed to the agent and MUST be distinguishable from
  the learner's own selection and crosshair highlighting (002/FR-032), including when both are on
  screen at once.
- **FR-021**: The spotlight MUST be distinguishable by more than colour and MUST survive greyscale
  (001/FR-048, 002/FR-035).
- **FR-022**: At most one agent spotlight MUST exist at a time: a later agent change replaces the
  earlier spotlight rather than adding to it.
- **FR-023**: The spotlight MUST expire automatically after a bounded interval, and MUST be cleared by
  the existing annotation-clearing tool along with every other agent mark (002/FR-031).
- **FR-024**: The spotlight MUST NOT alter board data, elapsed time, or undo history, and MUST NOT be
  saved as part of the restorable session (002/FR-034).
- **FR-025**: The spotlighted location MUST be perceivable to a learner using assistive technology on
  equal terms with a sighted learner (002/FR-060).
- **FR-026**: When an agent change spans several cells, the spotlight MUST convey the extent of the
  change rather than implying a single cell was touched.
- **FR-027**: Spotlight motion MUST honour the learner's reduced-motion preference (001/FR-049,
  002/FR-061).

**Switching difficulty**

- **FR-028**: The agent MUST be able to request a fresh puzzle at any of the difficulty levels the
  game offers (001/FR-003).
- **FR-029**: A request naming a level the game does not offer MUST be rejected with the list of levels
  that exist, and the board MUST be unchanged.
- **FR-030**: A difficulty change MUST obtain the learner's explicit confirmation before replacing a
  board that has any progress on it, and MUST report a declined confirmation back to the agent as an
  ordinary, non-error outcome — the same contract the practice-drill tool follows (002/FR-053).
- **FR-031**: A difficulty change on a board with no progress on it MUST proceed without a
  confirmation prompt.
- **FR-032**: A puzzle loaded by this tool MUST have exactly one solution, verified by the game's own
  reasoning rather than trusted from its source, and MUST carry a difficulty derived from the
  techniques it actually requires (001/FR-002).
- **FR-033**: A successful difficulty change MUST reset the clock and clear undo history, exactly as
  the learner's own difficulty control does (001/FR-004, 001/FR-033).
- **FR-034**: A difficulty change MUST stop any walkthrough in progress and report to the agent how
  far it had got (002/FR-049), because the remaining steps address a board that no longer exists.
- **FR-035**: A difficulty change MUST be rejected while the board is paused, and MUST be permitted on
  a completed board.
- **FR-036**: If no puzzle satisfying the integrity rules can be produced, the learner's board MUST be
  left exactly as it was and the agent MUST be told the attempt failed.
- **FR-037**: The learner MUST NOT be locked out of the interface while a puzzle is being generated
  (002/FR-051, 002/FR-056).

**Pausing and resuming**

- **FR-038**: The agent MUST be able to pause a running board, stopping the clock and obscuring the
  board exactly as a learner-initiated pause does (001/FR-035).
- **FR-039**: The agent MUST be able to resume a paused board, restarting the clock from where it
  stopped.
- **FR-040**: Resuming MUST be permitted while the board is paused, as an explicit exception to the
  rule that changes are rejected on a paused board (002/FR-045). All other agent changes remain
  rejected while paused, and reads continue to succeed.
- **FR-041**: A pause requested on a board that is not running, or a resume requested on a board that
  is not paused, MUST be rejected with a reason naming the board's actual state, leaving it unchanged.
- **FR-042**: A pause requested while a walkthrough is playing MUST stop the walkthrough at its last
  completed step and report that to the agent (002/FR-049).
- **FR-043**: The learner MUST always be able to resume a board the agent paused, using their own
  existing control and without the agent's involvement.
- **FR-044**: Pausing and resuming MUST NOT alter cell values, candidates, or undo history, and MUST
  NOT be undoable.

**Coexistence and safety**

- **FR-045**: None of the five new tools may reveal the puzzle's solution or whether a placed digit is
  correct (001/FR-029, 002/FR-026, 002/FR-058).
- **FR-046**: None of the five new tools may cause a network request (001/FR-043, 002/FR-059).
- **FR-047**: No new tool may disable an input, block a control, or leave the learner unable to
  continue, with the single exception of the pause overlay — which the learner can lift at any moment
  with their own control (002/FR-056).

### Key Entities

- **Coordinate Ruler**: The numbered gutters along the top and left of the grid. A persistent view
  preference belonging to the learner, operable by either actor, saved with the session, never part of
  game data and never undoable.
- **Agent Spotlight**: The transient marking of the location an agent most recently changed — its row,
  column, and box. Attributed to the agent, at most one at a time, self-expiring, and entirely
  separate from the learner's selection.
- **Difficulty Request**: An agent's request for a fresh puzzle at a named level, gated on the
  learner's confirmation whenever progress would be lost, and resolving to loaded, declined, or
  rejected.
- **Session Control**: The clock's running state as something either actor can change — paused or
  running — with resuming carved out of the rule that a paused board refuses changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the ruler showing, a learner can name any cell's row and column correctly without
  counting cells, in 100% of attempts.
- **SC-002**: An agent that has never encountered this site can, from the tool descriptions alone,
  show the ruler, change difficulty, and pause and resume the board correctly, with no site-specific
  instructions supplied beforehand.
- **SC-003**: In 100% of agent cell changes, the learner can locate the changed cell from the
  spotlight alone, without reading the explanation text and without searching the board.
- **SC-004**: In 100% of agent changes, the learner's selection and keyboard focus are exactly where
  the learner left them, and the learner's next keypress lands in the cell they had selected.
- **SC-005**: A learner can distinguish the agent's spotlight from their own crosshair in 100% of
  cases, verified under greyscale and colour-vision-deficiency simulation.
- **SC-006**: 100% of difficulty changes that would discard learner progress are preceded by a
  confirmation the learner can decline, and 100% of declines leave the board bit-for-bit unchanged.
- **SC-007**: 100% of boards produced by an agent difficulty change have exactly one solution.
- **SC-008**: A learner can resume a board the agent paused, using only their own controls, in 100% of
  attempts.
- **SC-009**: The ruler, spotlight, pause, and resume calls each return within a tenth of a second, so
  the agent's turn is never delayed by them.
- **SC-010**: Across an entire tutored session, there is no moment at which board input is refused or
  delayed because of something the agent is doing, other than a pause the learner can lift instantly.
- **SC-011**: On a page with no agent host, zero agent-related controls or empty states are present,
  and every capability of features 001 and 002 behaves exactly as before.
- **SC-012**: 100% of calls to the new tools that omit valid explanation text are rejected without
  changing anything.
- **SC-013**: A learner using assistive technology can determine that the ruler is showing, where the
  agent last acted, and that the board was paused or resumed by the agent — on equal terms with a
  sighted learner.

## Assumptions

Recorded where the description did not specify, or where an existing rule had to be chosen between.

- **The ruler labels the whole grid, always.** Confirmed with the author against the supplied
  screenshot: one call shows the complete 1-through-9 ruler on both axes. It is not aimed at a
  particular row or column, and there is no emphasis parameter.
- **The ruler is sticky and the learner owns it too.** Confirmed with the author. It persists until
  explicitly removed and does not auto-expire, because it disappearing mid-conversation would defeat
  its purpose; and the learner gets their own toggle, so it is an ordinary readability aid the agent
  happens to be able to operate rather than an agent-only affordance. This is the sole exemption from
  002/FR-033.
- **The agent gets its own spotlight; it never takes the learner's selection.** Confirmed with the
  author, choosing against literally moving the selection. The screenshot's complaint — that nothing
  moves when the agent acts — is answered by a second, agent-attributed crosshair rather than by
  hijacking the learner's. This preserves 002/FR-056 and the coordinate-addressed write design intact,
  and makes "whose highlight is this?" answerable at a glance. **This spec therefore does not override
  002/FR-056.**
- **Difficulty changes are confirmation-gated when progress exists**, following the precedent 002 set
  for practice drills (002/FR-053) rather than the unconfirmed behaviour of the learner's own
  difficulty control (001/FR-004). The learner clicking their own select is an intentional act; an
  agent discarding their board is not, and the two warrant different treatment.
- **An unanswered difficulty confirmation resolves as declined** after the same interval the existing
  drill confirmation uses, rather than leaving the agent's call outstanding indefinitely.
- **Only one confirmation prompt may be pending at a time.** A second request while one is waiting is
  rejected, rather than queued or stacked, so the learner is never asked two questions at once.
- **An agent pause is not a violation of 002/FR-056**, on the grounds that the learner can lift it
  instantly with a control that is always present and never agent-dependent. This is the only place in
  the feature where an agent action obscures the board, and it is noted here deliberately so a reviewer
  can object to it by name.
- **Resuming is exempt from 002/FR-045.** A tool whose only purpose is to leave the paused state cannot
  be barred by the paused state; without this carve-out the pause tool would be a one-way door for the
  agent.
- **The spotlight applies to every agent write that changes cells**, including pencil marks and each
  step of a walkthrough — not only single-digit fills. The description named filling; extending it is
  the consistent reading, and a spotlight that appeared for some writes and not others would be
  harder to learn than one that always appears.
- **Sixteen tools remain within the surface's existing budgets.** The tool count is not itself
  constrained; each new tool is individually held to the existing latency budget, with no new
  exemption sought beyond the two already recorded in 002.
- **No new drill, technique, or puzzle content is in scope.** The open items carried from 002 — the
  missing X-Wing and naked-single drills, the offline-reload gap, and the deferred bundle budget — are
  untouched by this feature and remain open.
