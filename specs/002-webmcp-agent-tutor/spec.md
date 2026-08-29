# Feature Specification: WebMCP Agent Tutor

**Feature Branch**: `main` *(no dedicated feature branch — the git extension hook is not installed)*

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Now WebMCP requirements. An agent must also be able to collaborate with human. Teach human about sudoku while solving the sudoku. This will be accomplished using WebMCP. Look up Web MCP Specification - https://webmachinelearning.github.io/webmcp/ . Use imperative style for WebMCP (unless you think otherwise). All tools are registered on document.modelContext with strict JSON input schemas. All write tool calls must result in a popup with text sent by agent — e.g. if agent fills a cell a popup should come containing text (1-2 lines) from agent on why that action is taken. This means each write tool call must have a popup text as input. Eleven tools: get_board_state, check_for_conflicts, highlight_pattern_cells, draw_constraint_beams, show_pattern_hint_toast, clear_visual_annotations, fill_cell, update_pencil_marks, auto_fill_all_pencil_marks, load_technique_practice, playback_deduction_sequence."

**Depends on**: `specs/001-sudoku-play-experience` — this feature adds an agent to the board that
feature builds. References below in the form `001/FR-0xx` point at that specification.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Tutor That Looks and Points (Priority: P1)

The learner is stuck. They ask their agent "where do I go next?" The agent reads the board, works out
that box 4 has only one place left for a `7`, tints those cells, and drops a short coaching note on
screen naming the technique. Nothing on the board has changed — the learner still makes the move
themselves.

**Why this priority**: This is the entire teaching premise in its safest form. An agent that can
perceive the board and direct attention is already a tutor. Every mutating capability that follows is
an accelerant, not a prerequisite, and shipping perception first means the learner is never at risk of
having their puzzle solved out from under them.

**Independent Test**: With only the read and annotation tools registered, ask an agent to explain the
next move on a mid-game board. Confirm it can describe the position accurately, direct attention to
the right cells, and leave every digit and candidate untouched.

**Acceptance Scenarios**:

1. **Given** a partially solved board, **When** the agent requests the board state, **Then** it
   receives every cell's value, whether that value is a starting clue or player-entered, every
   pencil candidate, the difficulty, and the completion status — enough to reason without guessing.
2. **Given** a board with a duplicate `4` in a column, **When** the agent asks for conflicts,
   **Then** it receives the coordinates of every cell participating in a duplication.
3. **Given** the agent has identified a hidden single, **When** it highlights the target cell and the
   cells that force it, **Then** those cells are visually marked in roles the learner can tell apart,
   and no cell value or candidate changes.
4. **Given** the agent shows a coaching note, **When** five seconds pass without interaction,
   **Then** the note dismisses itself, and the learner was able to keep playing throughout.
5. **Given** annotations are on screen, **When** the agent clears them, **Then** the board returns to
   its unannotated appearance with all game state intact.
6. **Given** a browser or context with no agent host present, **When** the learner uses the site,
   **Then** every capability from feature 001 works exactly as specified and nothing about the
   interface suggests something is missing or broken.

---

### User Story 2 - Every Move Comes With a Reason (Priority: P2)

The learner asks the agent to place the digit it just explained. The agent fills the cell — and in the
same breath a short popup appears saying why: *"Only 7 can go here — the other eight digits already
appear in this box."* The learner can undo it like any move of their own, and can see at a glance that
the agent, not they, put it there.

**Why this priority**: This is the contract that separates a tutor from an autosolver. Without it the
board fills with unexplained digits and the learner learns nothing. It is also the rule that makes
agent participation trustworthy: nothing changes silently.

**Independent Test**: Register only the board-reading and cell-filling tools. Confirm a fill cannot be
requested without an explanation, that the explanation surfaces on screen, that the digit is marked as
agent-placed, and that one undo removes it.

**Acceptance Scenarios**:

1. **Given** an agent attempting to fill a cell, **When** the request carries no explanation text,
   **Then** the request is rejected before anything on the board changes, and the rejection tells the
   agent that an explanation is required.
2. **Given** a valid fill request with an explanation, **When** it succeeds, **Then** the digit
   appears in the cell and the explanation appears on screen attributed to the agent.
3. **Given** an agent-placed digit, **When** the learner looks at the board, **Then** they can tell it
   apart from a starting clue and from their own entries without hovering, clicking, or reading a log.
4. **Given** an agent has placed a digit, **When** the learner presses Undo once, **Then** the digit
   is removed exactly as if they had placed it themselves.
5. **Given** the agent requests a fill into a starting clue or an already-filled cell, **Then** the
   request is rejected with a reason and the board is unchanged.
6. **Given** the agent places a digit that duplicates one in the same row, column, or box, **Then**
   the placement succeeds and the conflict is marked by the existing rules (001/FR-025), because the
   agent is permitted to be wrong and the learner is permitted to see it.
7. **Given** an explanation popup is on screen, **When** the learner continues typing digits,
   **Then** their input is unaffected and the popup never takes keyboard focus.

---

### User Story 3 - Show Me Why It Cannot Go There (Priority: P3)

The agent explains an elimination by casting beams along the row and column that rule a digit out,
so the learner sees the constraint rather than being told about it.

**Why this priority**: Elimination reasoning is the hardest thing to convey in words and the easiest
to convey with a line. It is a significant teaching upgrade, but the tutor is already functional
without it.

**Independent Test**: Ask the agent to justify one elimination. Confirm beams appear along the correct
lines, are distinguishable from the crosshair highlighting of feature 001, and clear on request.

**Acceptance Scenarios**:

1. **Given** the agent draws a beam along row 3, **Then** a visible ray spans that row and is
   attributed to the agent rather than being mistaken for the learner's own selection highlight.
2. **Given** several beams are drawn at once, **Then** each remains individually discernible where
   they cross.
3. **Given** beams are on screen, **When** the learner selects a cell, **Then** their own crosshair
   highlighting still functions and remains distinguishable from the beams.
4. **Given** the learner has asked for reduced motion, **When** beams are drawn, **Then** they appear
   without animated sweeping.

---

### User Story 4 - Bookkeeping Done For Me (Priority: P4)

The learner asks the agent to pencil in the candidates. Every empty cell fills with its legal digits
in one narrated step, and from then on the agent can prune individual candidates as it teaches, each
pruning explained.

**Why this priority**: Candidate bookkeeping is tedious and error-prone by hand, and most teaching
techniques beyond singles are unreadable without it. It follows the core narration contract because it
is only useful once the learner trusts what the agent writes.

**Independent Test**: On a mid-game board, have the agent fill all candidates and then prune a
specific one. Confirm correctness against the board's constraints and that each is one undo step.

**Acceptance Scenarios**:

1. **Given** a board with empty cells, **When** the agent fills all pencil marks, **Then** every empty
   cell carries exactly the digits legal in that cell given the current board, and no filled cell is
   touched.
2. **Given** a whole-board candidate fill, **When** the learner presses Undo once, **Then** every
   candidate written by that action is removed in a single step.
3. **Given** the agent updates candidates for specific cells, **Then** only those cells change and the
   accompanying explanation names why.
4. **Given** the learner has hand-written candidates they care about, **When** the agent fills all
   candidates, **Then** the learner is told in the explanation that their existing marks were replaced,
   and one undo restores them.

---

### User Story 5 - Walk Me Through It (Priority: P5)

The learner asks to be shown the next three moves. The agent plays a sequence: highlight, explain,
place, pause, move on. The learner watches it unfold, and can stop it at any moment by touching the
board.

**Why this priority**: A narrated chain is the most powerful teaching form here and the most complex
to build, since it must remain interruptible and must never leave the board in a half-finished state.
It depends on every preceding capability.

**Independent Test**: Request a three-step walkthrough. Confirm each step shows its own explanation
in order, that interrupting mid-sequence stops it cleanly, and that the board is coherent afterwards.

**Acceptance Scenarios**:

1. **Given** a walkthrough of three steps, **Then** each step's own explanation appears as that step
   plays, in order, rather than all three appearing at once or a single summary standing in for all.
2. **Given** a walkthrough in progress, **When** the learner clicks a cell or presses a key, **Then**
   playback stops immediately, the board is left in a consistent state at the last completed step, and
   the agent is told how far the sequence got.
3. **Given** a walkthrough was interrupted after two of three steps, **When** the learner presses
   Undo, **Then** the two completed steps undo one at a time, not as one lump.
4. **Given** a walkthrough is playing, **Then** the learner can still see the board and is never
   locked out of the interface.

---

### User Story 6 - Give Me One to Practice On (Priority: P6)

Having just learned about X-Wings, the learner asks for a puzzle that drills them. The agent loads a
curated board built around that technique — but only after the learner confirms, because their current
puzzle is about to be set aside.

**Why this priority**: Deliberate practice is what converts an explanation into a skill, but it is the
only capability here that discards the learner's work, so it ships last and behind a confirmation.

**Independent Test**: Ask for a drill on a named technique from a half-finished board. Confirm the
learner is asked first, that declining changes nothing, and that accepting loads a valid puzzle
genuinely requiring that technique.

**Acceptance Scenarios**:

1. **Given** the learner has a partly solved board, **When** the agent requests a practice drill,
   **Then** the learner is asked to confirm before anything is replaced.
2. **Given** the confirmation prompt, **When** the learner declines, **Then** their board is untouched
   and the agent is told the learner declined.
3. **Given** the learner accepts, **Then** a drill puzzle loads that has exactly one solution and
   genuinely requires the named technique to solve.
4. **Given** an agent names a technique with no drill available, **Then** the request is rejected with
   a list of the techniques that do have drills, and the board is unchanged.

---

### Edge Cases

- **No agent present**: `document.modelContext` is unavailable, or the page is not in a secure
  context. The site behaves exactly as feature 001 specifies, with no error, no degraded banner, and
  no dead agent-related controls on screen.
- **Agent permission refused**: tool registration is denied by policy. The site continues as a normal
  human Sudoku game and the failure is recorded for developers, not surfaced as a player-facing error.
- **Agent writes to a stale board**: the agent read the board, the learner then changed it, and the
  agent's write no longer makes sense. The write is evaluated against the board as it is *now*, and if
  its precondition no longer holds it is rejected with a reason rather than silently applied.
- **Explanation too long or empty**: text outside the permitted length is rejected by the input
  schema, so no unnarrated or essay-length write ever reaches the board.
- **Explanation containing markup or a link**: rendered as literal text. Agent-authored text is never
  interpreted as markup, and never becomes a clickable link.
- **Rapid-fire writes**: the agent issues several writes in quick succession. Explanations queue
  rather than overwriting one another, and the learner can read each.
- **Annotation left behind**: the agent highlights cells and never clears them. Annotations expire on
  their own so the board cannot be permanently defaced by an abandoned agent session.
- **Agent tries to fill the last cell**: allowed. The puzzle completes and completion behaves exactly
  as 001/FR-037 through 001/FR-039 specify.
- **Agent acts on a completed or paused board**: writes are rejected while the board is complete or
  paused; reads still succeed.
- **Agent asks to highlight coordinates off the grid**: rejected by the input schema before any
  visual change occurs.
- **Walkthrough step fails midway**: playback halts at the failure, the board keeps every step
  completed so far, and the agent is told which step failed and why.
- **Learner undoes past an agent's move mid-lesson**: permitted. Undo makes no distinction between
  agent and human changes.
- **Two agents connected at once**: writes are applied in the order received; no coordination between
  agents is attempted.
- **Reload during an agent session**: annotations, explanations, and any in-flight walkthrough are
  discarded on reload. Only the board itself is restored, per 001/FR-041.

## Requirements *(mandatory)*

### Functional Requirements

**Tool surface and registration**

- **FR-001**: The agent surface MUST be exposed exclusively through the WebMCP standard, registering
  each tool on `document.modelContext`, with no alternative or parallel agent channel.
- **FR-002**: The surface MUST consist of exactly these eleven tools: `get_board_state`,
  `check_for_conflicts`, `highlight_pattern_cells`, `draw_constraint_beams`,
  `show_pattern_hint_toast`, `clear_visual_annotations`, `fill_cell`, `update_pencil_marks`,
  `auto_fill_all_pencil_marks`, `load_technique_practice`, and `playback_deduction_sequence`.
- **FR-003**: Every tool MUST declare a strict input schema that fully constrains its arguments:
  every argument typed, every required argument marked required, every bounded value given its bounds,
  and unrecognised arguments rejected rather than ignored.
- **FR-004**: Tools MUST be imperative — each performing one discrete, nameable, explainable action.
  No tool may accept a whole-board replacement or a diff of arbitrary scope, because a single opaque
  state-swap cannot be narrated, attributed, or undone step by step.
- **FR-005**: Every tool MUST declare whether it modifies anything, so an agent can distinguish
  observation from action before calling.
- **FR-006**: Every tool's description MUST be sufficient for an agent that has never seen this site
  to use it correctly without external documentation, including the board's addressing convention and
  what the tool returns.
- **FR-007**: The board MUST use one canonical addressing convention across every tool — rows 1 to 9
  top to bottom, columns 1 to 9 left to right, boxes 1 to 9 in reading order — stated in each tool's
  description and never varied between tools.
- **FR-008**: Every tool MUST return a structured, machine-readable result reporting success or
  failure. A tool MUST NOT signal failure by raising an unhandled error into the page.
- **FR-009**: Every failed call MUST return a reason specific enough for the agent to correct itself
  and retry, naming what was wrong rather than reporting a generic failure.
- **FR-010**: The tool surface MUST carry a version that increases when a tool is renamed, removed, or
  has its input constraints narrowed, so agents can detect an incompatible surface.
- **FR-011**: Registration MUST be isolated from interface rendering and MUST be enumerable with no
  interface rendered, so the full tool surface can be inspected and tested independently of the board.
- **FR-012**: Registration MUST be idempotent and reversible: repeated setup MUST NOT produce
  duplicate tools, and teardown MUST remove exactly the tools it registered.
- **FR-013**: When no agent host is available, the site MUST behave exactly as feature 001 specifies,
  presenting no agent-related controls, warnings, or empty states.

**The narration contract**

- **FR-014**: Every tool that changes anything the learner can see — board data, annotations, or
  loaded puzzle — MUST require explanation text as a mandatory input.
- **FR-015**: A change-making call that omits the explanation, or supplies text outside the permitted
  length, MUST be rejected before any change occurs.
- **FR-016**: Explanation text MUST be constrained to roughly one to two lines, enforced by the input
  schema as a minimum and maximum character count, so an agent can neither skip the reasoning nor bury
  it in an essay.
- **FR-017**: On every successful change, the explanation MUST be displayed to the learner, visibly
  attributed to the agent.
- **FR-018**: Explanations MUST be displayed without blocking: they MUST NOT take keyboard focus, MUST
  NOT prevent input to the board, and MUST NOT require dismissal before play continues.
- **FR-019**: Explanations MUST be dismissible by the learner and MUST also dismiss themselves after a
  readable interval.
- **FR-020**: Concurrent explanations MUST queue rather than replace one another, with a cap on how
  many are visible at once so the board is never obscured.
- **FR-021**: Explanation text MUST be treated as untrusted content and rendered as literal text.
  Markup, scripts, and links within it MUST NOT be interpreted, styled, or made actionable.
- **FR-022**: Explanations MUST be announced to assistive technology without stealing focus.
- **FR-023**: Read-only tools MUST NOT require explanation text, because they change nothing the
  learner can perceive.

**Reading the board**

- **FR-024**: `get_board_state` MUST return every cell's value, whether each value is a starting clue
  or was entered by the learner or the agent, every cell's pencil candidates, the difficulty, elapsed
  time, and whether the board is paused or complete.
- **FR-025**: `check_for_conflicts` MUST return every cell participating in a duplicate within a row,
  column, or box, grouped so the agent can tell which cells collide with which.
- **FR-026**: Read tools MUST NOT reveal the puzzle's solution, and no tool may return the solution or
  a cell's correct answer, so the agent must reason from the visible board as the learner does.
- **FR-027**: Read tools MUST leave board data, annotations, elapsed time, and undo history unchanged.

**Visual teaching annotations**

- **FR-028**: `highlight_pattern_cells` MUST mark a supplied set of cells in distinguishable roles —
  at minimum the cells a deduction targets versus the cells that justify it.
- **FR-029**: `draw_constraint_beams` MUST cast a visible ray along a supplied row, column, or box,
  and multiple simultaneous beams MUST remain individually discernible where they overlap.
- **FR-030**: `show_pattern_hint_toast` MUST present a coaching message that dismisses itself after
  five seconds, and MUST be dismissible sooner by the learner.
- **FR-031**: `clear_visual_annotations` MUST remove all agent highlights, beams, and coaching
  messages, and MUST leave every cell value, candidate, timer, and history entry untouched.
- **FR-032**: Agent annotations MUST be visually distinguishable from the learner's own selection and
  crosshair highlighting (001/FR-007), so the learner always knows which marks are theirs.
- **FR-033**: Annotations MUST expire automatically after a bounded interval, so an abandoned agent
  session cannot leave the board permanently marked.
- **FR-034**: Annotations MUST NOT alter board data, elapsed time, or undo history, and MUST NOT be
  saved as part of the restorable session (001/FR-040).
- **FR-035**: Annotation roles MUST be distinguishable by more than colour and MUST survive greyscale,
  consistent with 001/FR-048 and 001/FR-009.

**Changing the board**

- **FR-036**: `fill_cell` MUST place a single digit in a single empty, non-clue cell per call.
- **FR-037**: A fill targeting a starting clue, an already-filled cell, or a coordinate off the grid
  MUST be rejected with a reason and MUST leave the board unchanged.
- **FR-038**: A fill that creates a duplicate MUST be permitted and MUST be marked as a conflict by
  the existing rules (001/FR-025), because a tutor that cannot be seen to be wrong cannot be checked.
- **FR-039**: `update_pencil_marks` MUST set the candidates of the specified cells to the specified
  digits, affecting no other cell.
- **FR-040**: `auto_fill_all_pencil_marks` MUST write, into every empty cell, exactly the digits legal
  in that cell given the board as it currently stands, and MUST NOT modify any filled cell.
- **FR-041**: When `auto_fill_all_pencil_marks` replaces candidates the learner wrote by hand, the
  explanation MUST say so.
- **FR-042**: Every agent change MUST be recorded as an undoable step indistinguishable in operation
  from a learner's own, so a single undo reverses it (001/FR-031).
- **FR-043**: A tool call that changes many cells at once MUST be recorded as exactly one undoable
  step. `playback_deduction_sequence` is the sole exception: its steps are individually undoable per
  FR-050, because a walkthrough that collapses into one undo cannot be replayed or examined
  step by step.
- **FR-044**: Agent-placed digits and agent-written candidates MUST be visually distinguishable from
  the learner's own entries and from starting clues, at a glance and without interaction.
- **FR-045**: Changes MUST be rejected while the board is paused or complete; reads MUST continue to
  succeed in both states.
- **FR-046**: Every change MUST be evaluated against the board as it stands at the moment of the call.
  A call whose stated precondition no longer holds MUST be rejected rather than applied to a board the
  agent has not seen.

**Guided teaching flows**

- **FR-047**: `playback_deduction_sequence` MUST accept an ordered list of steps, each carrying its
  own explanation, and MUST play them in order with each explanation appearing as its step executes.
- **FR-048**: Playback MUST be interruptible at any moment by learner input on the board, and MUST
  stop immediately when interrupted.
- **FR-049**: An interrupted or failed playback MUST leave the board consistent at the last completed
  step, MUST NOT roll back completed steps, and MUST report to the agent how many steps completed and
  why it stopped.
- **FR-050**: Each step of a playback MUST remain individually undoable; a sequence MUST NOT collapse
  into a single undo entry.
- **FR-051**: Playback MUST NOT lock the interface: the board stays visible and the learner is never
  prevented from acting.
- **FR-052**: `load_technique_practice` MUST load a curated puzzle that genuinely requires the named
  technique and has exactly one solution.
- **FR-053**: `load_technique_practice` MUST obtain the learner's explicit confirmation before
  replacing a board that has any progress on it, and MUST report a declined confirmation back to the
  agent as an ordinary, non-error outcome.
- **FR-054**: A request naming a technique with no available drill MUST be rejected with the list of
  techniques that do have drills.
- **FR-055**: Drill puzzles MUST be available without any network request, consistent with
  001/FR-043.

**Coexistence, safety, and access**

- **FR-056**: The learner MUST retain full control at all times: no agent action may disable an
  input, block a control, or prevent the learner from playing.
- **FR-057**: The learner MUST be able to see that an agent is connected and MUST be able to
  disconnect it, after which no further agent action is applied.
- **FR-058**: No agent action may reveal whether a placed digit matches the puzzle's solution,
  preserving 001/FR-029.
- **FR-059**: No tool may cause a network request, and no board or learner data may leave the device
  through the agent surface beyond what the connected agent is given in tool results (001/FR-043).
- **FR-060**: Agent activity MUST be perceivable to a learner using assistive technology on equal
  terms with a sighted learner, including which cells were annotated and what changed.
- **FR-061**: Agent-driven motion MUST honour the learner's reduced-motion preference (001/FR-049),
  including beam drawing and playback pacing.

### Key Entities

- **Tool Descriptor**: One entry in the agent surface — its name, its description, its input schema,
  and whether it changes anything. Collectively these form the versioned public contract of FR-010.
- **Explanation**: The agent-authored text accompanying one change, and the on-screen popup that
  presents it. Untrusted text, one to two lines, attributed, transient, non-blocking.
- **Annotation**: A transient visual mark the agent places on the board — a highlighted cell in a
  given role, a constraint beam, or a coaching message. Never part of game state, never saved,
  self-expiring.
- **Deduction Step**: One unit of a walkthrough — an action plus the explanation that justifies it.
  Ordered within a sequence, individually undoable, individually interruptible.
- **Practice Drill**: A curated puzzle bundled with the site, tagged with the technique it exercises
  and carrying the guarantee of a unique solution.
- **Change Attribution**: The record of who caused a given cell's contents — starting clue, learner,
  or agent. Drives the visual distinction of FR-044 and is readable by tests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An agent that has never encountered this site can, using only the tool descriptions,
  read the board, identify a valid next move, and explain it — with no site-specific instructions
  supplied to it beforehand.
- **SC-002**: 100% of changes the agent makes to the board arrive with an explanation visible to the
  learner. There is no path by which the board changes silently.
- **SC-003**: 100% of attempted changes lacking valid explanation text are rejected without altering
  the board.
- **SC-004**: A learner can identify, without interacting with the board, which digits they placed,
  which the agent placed, and which were starting clues — verified with colour vision deficiency
  simulation and in greyscale.
- **SC-005**: 100% of agent changes are reversible by a single press of the learner's existing Undo
  control.
- **SC-006**: The learner can interrupt a walkthrough at any point and regain full control within one
  step of the sequence, in 100% of attempts.
- **SC-007**: Agent activity never blocks the learner: across an entire tutored session, there is no
  moment at which board input is refused or delayed because of something the agent is doing.
- **SC-008**: Observation and annotation calls return within a tenth of a second, fast enough that a
  learner conversing with an agent perceives the board responding as they talk.
- **SC-009**: 100% of curated practice puzzles have exactly one solution and are solvable using the
  technique they are tagged with.
- **SC-010**: With no agent host present, the site scores identically against every success criterion
  in feature 001, with zero agent-related interface elements visible.
- **SC-011**: A learner using a screen reader receives every explanation and can determine every
  annotated cell, without focus ever being taken from where they were working.
- **SC-012**: Malformed, oversized, out-of-range, and markup-bearing tool inputs are rejected without
  changing the board or executing anything within the supplied text, across a full suite of hostile
  inputs.

## Assumptions

These are reasonable defaults chosen where the description did not specify. Each can be changed before
planning without restructuring the feature.

- **Imperative tool style is correct, and is adopted.** The description offered the choice; imperative
  wins here because this product teaches. Each tool performs one discrete act that can be named,
  narrated, attributed, and undone on its own. A declarative "make the board look like this" surface
  would collapse a lesson into a single opaque diff with one explanation covering everything — exactly
  what the narration contract exists to prevent.
- **`check_for_conflicts` is read-only**, departing from the "Read + Write" classification in the
  description. Feature 001 already marks conflicts continuously and automatically (001/FR-025,
  001/FR-028), so there is nothing for this tool to write; the red flagging is already guaranteed. It
  returns the conflict set and carries no explanation text. If the intent was a deliberate emphasis
  pulse, that is better served by `highlight_pattern_cells`.
- **Explanation length is 20 to 240 characters**, the practical span of one to two lines, enforced by
  the schema at both ends.
- **Explanation popups persist about six seconds** or until dismissed, slightly longer than the
  five-second coaching toast, since they accompany a change to the board. At most three are visible at
  once; further ones queue.
- **Annotations expire after about sixty seconds** of no agent activity.
- **`playback_deduction_sequence` is exempt from the responsiveness expectation of SC-008**, because
  its duration is the point. It is the only tool that may take longer than a moment to resolve, and it
  must remain interruptible throughout.
- **The agent may place a wrong digit.** Nothing prevents it, the conflict rules catch duplicates, and
  the learner is never told whether a legal digit is correct. A tutor whose errors are invisible cannot
  be checked, and checking the tutor is part of learning.
- **The learner is asked to confirm only for board replacement** — the one destructive agent action.
  Fills, candidate changes, and annotations proceed without prompting, because a confirmation on every
  move would make collaboration unusable and each is one undo away.
- **A visible indicator shows when an agent is connected**, with a control to disconnect it.
- **Practice drills are bundled with the site** as authored content, not generated at request time,
  because a drill must be verified to require its technique.
- **Multiple simultaneous agents are permitted but uncoordinated**, applied in arrival order.
- **Agent-authored explanations are not persisted** and do not survive a reload.
- **The site is served over HTTPS.** The WebMCP surface is only available in a secure context, so the
  agent path does not exist on plain HTTP. This constrains hosting but not architecture, and feature
  001 remains fully functional either way.
- **Teaching content — which techniques exist, how they are explained, the curriculum ordering — comes
  from the agent, not the site.** The site supplies the board, the tools, and the surfaces to draw on;
  it holds no lesson text of its own beyond drill puzzle metadata.

## Out of Scope

- Any bundled chat interface, conversation panel, or in-page agent. The agent lives in the user's own
  client and reaches the page through the standard.
- Lesson content, curricula, technique explanations, and difficulty progression authored by the site.
- Agent-side reasoning, prompting, model choice, and solving strategy.
- Learner progress tracking, skill assessment, mastery scoring, and technique history — excluded here
  for the same reason 001/FR-051 excludes statistics.
- Voice input and speech output.
- Multiplayer or human-to-human collaboration on one board.
- Server-mediated agent access, remote tool hosting, and any transport other than the in-page
  standard.
- Cross-origin exposure of the tool surface to embedding documents.
- Agent-authored puzzle generation, and agent modification of starting clues.
