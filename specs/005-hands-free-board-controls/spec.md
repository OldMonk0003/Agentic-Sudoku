# Feature Specification: Restart, Undo, and Prompt-Free Board Replacement

**Feature Branch**: `005-hands-free-board-controls` *(branch yourself — the git extension hook is not installed here)*

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "1. Sudoku game is fetched from storage if user closed the previous game without solving it. User may not want to continue the same game and start fresh. Add a 'restart' button which just restarts the game in same difficulty level (a different game). Add a webmcp tool also to restart. 2. Add a webmcp tool which undos the move. There is a undo button create a mcp tool to undo. 3. Switching difficulty from MCP tool prompts the user to confirm 'Switch the Puzzle' or 'Keep Board'. We are targetting hands free experience. Can we have a WebMCP tool to either 'Switch the Puzzle' or 'Keep Board' otherwise user has to use hand which is not optimal. Alternatively (if it is easier) just switch difficulty without prompting if call comes from WebMCP tool."

**Depends on**: `specs/001-sudoku-play-experience`, `specs/002-webmcp-agent-tutor`, and
`specs/003-agent-board-controls`. References below in the form `001/FR-0xx` point at those.

**Amends — and this is the part to argue with**: this feature **repeals** `002/FR-053` and
`003/FR-030`, which require the learner's explicit confirmation before an agent replaces their board.
Confirmed with the author, who chose repeal over the two alternatives offered.

Because every confirmation in the product is raised by an agent action, repealing it for agent
actions **retires the confirmation mechanism entirely** — the prompt, its sixty-second
decline-on-silence rule, and the "one prompt at a time" constraint all cease to exist. See
[US3](#user-story-3---switch-my-board-without-reaching-for-anything-priority-p3) and the Assumptions,
where the cost is stated rather than buried.

**The theme**: a session where the learner never has to touch the keyboard or mouse. Today one thing
breaks that outright — a confirmation prompt only a click can answer — and two ordinary controls,
Restart and Undo, have no agent equivalent at all.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Give Me a Different Puzzle, Same Level (Priority: P1)

The learner comes back to a half-finished board they no longer want. They liked the difficulty; they
just don't want *this* grid any more. One control gives them a fresh puzzle at the same level,
without hunting through the difficulty dropdown for the level they were already on.

**Why this priority**: It is the smallest, safest thing here — pure learner-facing convenience, no
agent involved, and it cannot break a puzzle. It also stands alone: useful on its own even if nothing
else in this feature ships. And it is the direct answer to the "I closed the tab and don't want this
game back" problem that prompted the request.

**Independent Test**: Restore a half-finished board, press the new control, and confirm a fresh
puzzle at the same difficulty appears with a clock at zero and no undo history — while the difficulty
setting itself is unchanged.

**Acceptance Scenarios**:

1. **Given** a restored, partly solved Medium board, **When** the learner presses Restart, **Then** a
   different Medium puzzle appears, the clock resets to zero, and the undo history is empty.
2. **Given** a restart, **Then** the puzzle presented is a *different* grid, not the same one with the
   learner's entries wiped.
3. **Given** a restart, **Then** the difficulty setting still reads the same level it did before.
4. **Given** an untouched board with no progress, **When** the learner presses Restart, **Then** a
   fresh puzzle still appears rather than the control doing nothing.
5. **Given** any restart, **Then** the puzzle presented has exactly one solution (001/FR-002).
6. **Given** a restart is in progress, **Then** the learner is never locked out of the interface, and
   no partially generated board reaches the screen.
7. **Given** no agent is connected at all, **Then** the control is present and works exactly the same,
   because it is an ordinary game control.

---

### User Story 2 - Ask for a Fresh Board or Take a Move Back (Priority: P2)

The learner, talking to their agent, says "start me a new one" or "take that back". Both happen
without them reaching for anything, and each arrives with the agent's reason on screen.

**Why this priority**: These are the two ordinary controls the agent could not reach. Undo especially
matters mid-lesson — the agent places a digit, the learner disagrees, and saying so should be enough.
It sits behind US1 because the learner's own controls must exist and work first.

**Independent Test**: With a board in progress, ask the agent to undo the last move and confirm the
board steps back exactly as the learner's Undo button would. Ask it to restart and confirm a fresh
puzzle at the same difficulty appears.

**Acceptance Scenarios**:

1. **Given** a board with changes on it, **When** the agent undoes, **Then** the most recent change is
   reversed exactly as the learner's own Undo control would reverse it.
2. **Given** an agent undo, **Then** the agent's reason for it appears on screen, attributed to the
   agent (002/FR-017).
3. **Given** a change that touched several cells at once, **When** the agent undoes, **Then** the
   whole change is reversed as one step, not partially.
4. **Given** an empty undo history, **When** the agent undoes, **Then** the request is rejected with a
   reason saying there is nothing to undo, and nothing changes.
5. **Given** the agent undoes a change *the learner* made, **Then** it succeeds, and the result tells
   the agent whose change it was so it can say so.
6. **Given** the agent restarts the board, **Then** a different puzzle at the same difficulty appears,
   with a clock at zero and no undo history.
7. **Given** a paused board, **When** the agent undoes or restarts, **Then** the request is rejected
   because the board is paused (002/FR-045), and reads still succeed.
8. **Given** either request, **Then** the learner's selection and keyboard focus do not move
   (002/FR-056, 003/FR-019).

---

### User Story 3 - Switch My Board Without Reaching for Anything (Priority: P3)

The learner says "give me a harder one". The board switches. There is no prompt, no button, and
nothing to click — the agent's reason for the change appears on screen as it happens, and that is the
only thing standing between the request and the new puzzle.

**Why this priority**: It is what the hands-free goal turns on, and it ships last because it is the
only part of this feature that *removes* a protection rather than adding a capability. Everything
else here is additive.

**Independent Test**: From a board with progress on it, ask the agent to change difficulty. Confirm a
new puzzle appears with no prompt shown at any point, that the agent's explanation of why is on
screen, and that the learner touched nothing.

**Acceptance Scenarios**:

1. **Given** a board with the learner's progress on it, **When** the agent requests a different
   difficulty, **Then** a fresh puzzle appears immediately with no confirmation prompt shown.
2. **Given** the same, **When** the agent loads a practice drill or restarts the board, **Then** those
   also proceed with no prompt, because the rule is the same for every agent-initiated replacement.
3. **Given** any agent-initiated replacement, **Then** the agent's explanation of why appears on
   screen attributed to the agent (002/FR-017), so the learner sees the cause of the change even
   though they were not asked about it.
4. **Given** an agent-initiated replacement, **Then** the agent's call completes as soon as the new
   board is ready or generation fails — it never waits on a human.
5. **Given** the learner uses their own difficulty control or Restart button, **Then** nothing changes
   for them: those never prompted and still do not.
6. **Given** a learner who does not want this, **Then** the Disconnect control (002/FR-057) remains
   their means of stopping it, and it is the only one.
7. **Given** the whole product, **Then** no confirmation prompt can be raised by any code path,
   because every source of one was an agent-initiated replacement.

---

### Edge Cases

**Restart**

- **Restart on a completed board**: permitted — the puzzle is finished, so there is no progress to
  lose, and a new one is exactly what the learner wants next.
- **Restart while paused**: rejected for the agent, consistent with every other board replacement
  (003/FR-035). The learner's own control resumes first or is unavailable while the overlay is up.
- **Restart pressed repeatedly in quick succession**: only the most recently requested board reaches
  the screen, and no partially generated board is ever shown (001 edge case).
- **Restart while a walkthrough is playing**: the walkthrough stops at its last completed step and the
  agent is told how far it got (002/FR-049), because the remaining steps address a board that no
  longer exists.
- **Generation fails to produce a verified puzzle**: the learner's board is left exactly as it was and
  the agent is told the attempt failed (003/FR-036).
- **Restart before any puzzle has loaded**: rejected, with a reason naming the board's actual state.

**Undo**

- **Undo with an empty history**: rejected with a reason. This is the state a fresh or restarted board
  is always in.
- **Undo of a change that touched many cells** — a whole-board candidate fill, or a digit placement
  that stripped candidates from its peers: reversed as exactly one step (001/FR-024, 002/FR-043).
- **Undo during a walkthrough**: each completed step remains individually undoable (002/FR-050); undo
  does not resume or rewind the sequence itself.
- **Undo on a completed board**: permitted, and it returns the board to play. This is what the
  learner's own control already does, so the agent matches it. It sits in tension with 001/FR-039's
  "a completed board becomes read-only", a tension that predates this feature and is not resolved by
  it.
- **Undo while paused**: rejected for the agent (002/FR-045). The learner's own control is *not*
  blocked here today — a pre-existing asymmetry this feature observes rather than changes.
- **Undo cannot be undone**: there is no redo in this product (001 Assumptions). An agent undoing the
  learner's work destroys it, and the learner's only recourse is to re-enter it.

**Board replacement without a prompt**

- **A replacement lands while the learner is mid-entry**: their keystroke applies to the old board or
  is lost with it, and they are not warned first. This is the sharp edge of repealing the prompt, and
  it is the reason FR-022 keeps narration mandatory.
- **A saved game is replaced**: the stored session is overwritten by the new board (001 Assumptions,
  one puzzle saved at a time). There is no route back to the replaced board — no redo, and nothing
  retains it.
- **An agent replaces the board repeatedly**: each replacement is narrated and each is permitted;
  nothing rate-limits it. The learner's recourse is Disconnect.
- **A replacement arrives while a walkthrough is playing**: the walkthrough stops at its last
  completed step and the agent is told how far it got (002/FR-049).
- **A replacement is requested while the board is paused**: rejected, as every agent change is while
  paused (002/FR-045, 003/FR-035).
- **No agent host present**: none of the new tools exist, and the learner's Restart and Undo controls
  work exactly as they do now (002/FR-013). No confirmation prompt exists for anyone.

## Requirements *(mandatory)*

### Functional Requirements

**Restarting the board**

- **FR-001**: The interface MUST offer a Restart control, available whenever a puzzle is on screen,
  alongside the existing game controls.
- **FR-002**: Restart MUST generate and present a **different** puzzle at the board's **current**
  difficulty. It MUST NOT re-present the same puzzle with the learner's entries cleared.
- **FR-003**: Restart MUST NOT change the difficulty setting; the level after a restart is the level
  before it.
- **FR-004**: A restarted puzzle MUST have exactly one solution, verified by the game's own reasoning
  rather than trusted from its source, and MUST carry a difficulty derived from the techniques it
  actually requires (001/FR-002).
- **FR-005**: Restart MUST reset the clock to zero and clear the undo history (001/FR-004,
  001/FR-033).
- **FR-006**: Restart MUST proceed without a confirmation prompt when the learner presses the control
  themselves, matching the existing difficulty control (001/FR-004).
- **FR-007**: Restart MUST work with no agent connected, because it is an ordinary game control
  (002/FR-013).
- **FR-008**: The agent MUST be able to request a restart, with the same result as the learner's own
  control.
- **FR-009**: An agent restart MUST be rejected while the board is paused, and permitted on a
  completed board (003/FR-035).
- **FR-010**: If no puzzle satisfying the integrity rules can be produced, the board MUST be left
  exactly as it was and the requester MUST be told the attempt failed (003/FR-036).
- **FR-011**: The learner MUST NOT be locked out of the interface while a restart is generating, and
  no partially generated board may reach the screen (001 edge case, 003/FR-037).

**Undoing a move**

- **FR-012**: The agent MUST be able to undo the most recent change to the board, producing exactly
  the result the learner's own Undo control produces (001/FR-031).
- **FR-013**: One agent undo request MUST reverse exactly one step, matching one press of the
  learner's control.
- **FR-014**: A change that touched several cells MUST be reversed as one whole step, never partially
  (001/FR-024, 002/FR-043).
- **FR-015**: An undo requested when there is nothing to undo MUST be rejected with a reason saying
  so, leaving the board unchanged.
- **FR-016**: An agent undo MUST be permitted regardless of who made the change being reversed, and
  the result MUST report whose change it was, so the agent can say what it just took back.
- **FR-017**: An agent undo MUST be rejected while the board is paused (002/FR-045); reads MUST
  continue to succeed. It MUST be **permitted on a completed board**, because the learner's own Undo
  control is permitted there and returns the board to play — an agent undo that refused where the
  button works would violate FR-012.
- **FR-018**: An agent undo MUST NOT move the learner's selection or keyboard focus (002/FR-056,
  003/FR-019).
- **FR-019**: The learner's own Undo control MUST be unchanged in every respect.

**Replacing the board without a prompt**

- **FR-020**: An agent-initiated board replacement MUST proceed without a confirmation prompt,
  whatever progress the board carries. This **repeals 002/FR-053 and 003/FR-030**.
- **FR-021**: The rule MUST apply uniformly to every agent-initiated replacement — switching
  difficulty, loading a practice drill, and restarting — so the learner is never left guessing which
  ones ask and which do not.
- **FR-022**: Every such replacement MUST still be narrated: the agent's explanation appears on
  screen, attributed to the agent (002/FR-014 through FR-022). **The narration is now the only thing
  the learner sees about a change to their board**, so it is not optional and its rules are not
  relaxed.
- **FR-023**: An agent's replacement call MUST NOT wait on human input. It completes when the new
  board is ready or when generation fails.
- **FR-024**: No code path may raise a confirmation prompt. The mechanism — the prompt, its
  decline-on-silence timeout, and the one-at-a-time constraint — MUST be retired, because every
  source of it was an agent-initiated replacement.
- **FR-025**: Learner-initiated replacement MUST be unchanged: the difficulty control and the Restart
  control never prompted, and still do not (001/FR-004, FR-006 above).
- **FR-026**: The learner's ability to stop an agent MUST remain the existing Disconnect control
  (002/FR-057), which MUST stay present and functional. **After this feature it is the learner's only
  protection against an unwanted board replacement**, so it may not be weakened.
- **FR-027**: The completion, uniqueness, and difficulty-derivation rules for a replacement puzzle
  MUST be unchanged (001/FR-002, 003/FR-032).

**The tool surface**

- **FR-028**: Each new agent capability MUST satisfy every existing surface rule unchanged: a strict
  input schema rejecting unrecognised arguments, one discrete nameable action, a declared statement of
  whether it changes anything, a description sufficient for an agent that has never seen this site,
  the canonical addressing convention, a structured result in both success and failure, and a failure
  reason specific enough to correct and retry (002/FR-003 through FR-009).
- **FR-029**: Every new capability that changes what the learner can see MUST require explanation text
  under the existing narration contract (002/FR-014 through FR-022).
- **FR-030**: The tool surface version MUST be raised to record the additions, and no existing tool's
  name, input constraints, or result shape may be removed or narrowed (002/FR-010).
- **FR-031**: Registration MUST remain isolated from interface rendering and enumerable with no
  interface rendered, and MUST remain idempotent and reversible (002/FR-011, FR-012).
- **FR-032**: With no agent host present, none of the new tools may exist and no agent-related control
  may appear (002/FR-013).
- **FR-033**: None of the new capabilities may reveal the puzzle's solution or whether a placed digit
  is correct (001/FR-029, 002/FR-026).
- **FR-034**: None of the new capabilities may cause a network request (001/FR-043, 002/FR-059).

### Key Entities

- **Restart Request**: A request for a fresh puzzle at the board's current difficulty, from either
  actor. Resolves to a new verified puzzle, or to a failure that leaves the board untouched.
- **Undo Request**: A request to reverse the most recent change, from either actor. Carries no
  target — it always means "the last one" — and reports what it reversed and who had made it.
- **Confirmation Answer**: An accept or decline, naming the prompt it answers and the actor who gave
  it. At most one answer is ever recorded per prompt; the first wins.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a restored half-finished board, a learner gets a different puzzle at the same
  difficulty in one action, in 100% of attempts.
- **SC-002**: 100% of restarted puzzles have exactly one solution and match the difficulty the board
  was already on.
- **SC-003**: A restart never re-presents the puzzle that was on screen.
- **SC-004**: An agent undo produces a board state identical to the one the learner's own Undo
  produces from the same starting position, in 100% of comparisons.
- **SC-005**: 100% of undo requests against an empty history are rejected with a reason, changing
  nothing.
- **SC-006**: **A learner can complete an entire session — including replacing their board at least
  once — without touching a keyboard or mouse**, using only speech to their agent.
- **SC-007**: 100% of agent-initiated board replacements are accompanied by an on-screen explanation
  from the agent. With the prompt repealed, this is the learner's only account of why their board
  changed, so a single silent replacement is a failure.
- **SC-008**: Zero confirmation prompts appear anywhere in the product, for any actor, in any flow.
- **SC-009**: The learner's own controls — Restart, Undo, difficulty, pause, and Disconnect — work in
  100% of cases regardless of whether an agent is connected or what it is doing.
- **SC-010**: Across a session, the learner's selection and keyboard focus are never moved by any
  agent action introduced here.
- **SC-011**: The undo call returns within a tenth of a second. Restart and difficulty-switch calls
  now wait only on puzzle generation and never on a human, which **narrows the latency deviation
  feature 003 recorded** rather than widening it.
- **SC-012**: On a page with no agent host, zero agent-related controls or empty states are present,
  and every capability of features 001 through 003 behaves exactly as before.

## Assumptions

Recorded where the description did not specify, or where an existing rule had to be chosen between.

- **"Restart" means a new puzzle, not the same one cleared.** The description says so explicitly — *"a
  different game"*. Worth stating because the word usually means the opposite: most games restart *the
  same level*. A control that wipes the learner's entries and leaves the same grid is a different
  feature, and this is not it.
- **Restart is the difficulty control aimed at the level you are already on.** It carries the same
  consequences — new board, clock to zero, history cleared — so it inherits the same rules rather than
  inventing new ones.
- **The learner's own Restart is unconfirmed.** Pressing a button labelled Restart is an intentional
  act, and the existing difficulty control already discards a board without asking (001/FR-004). A
  confirmation here would be inconsistent and, given the hands-free goal, actively unhelpful.
- **Undo takes back one step per request.** It mirrors one press of the button, which keeps the tool
  imperative and each reversal individually narrated (002/FR-004). An agent wanting three steps back
  asks three times and explains each.
- **The agent may undo the learner's own moves, and this is a real cost.** Undo does not distinguish
  authorship, there is no redo in this product, and the learner's work is therefore destroyable one
  step at a time by a mistaken agent. Three things bound it rather than prevent it: every undo is
  narrated on screen, the result names whose change was reversed, and the learner can disconnect the
  agent at any moment. Restricting the agent to undoing only its *own* last change was considered and
  rejected as both surprising — "undo" would sometimes mean something other than what the button does
  — and insufficient, since the agent's change may not be the most recent one.
- **The confirmation is repealed rather than made answerable.** The author was offered three routes —
  keep the prompt and let the agent answer it, declare consent inline on the call, or drop the prompt
  — and chose to drop it. It is the simplest of the three and the one with the fewest moving parts.
- **What that costs, stated plainly, because it is a real loss.** Two features were built around the
  rule that an agent may not discard the learner's board without being told it may. That rule is now
  gone. An agent that misreads "this is too easy" as "replace this" destroys an hour of work with no
  question asked, no undo — a replaced board is not in the undo history — and no copy retained, since
  only one game is ever saved. The learner's sole protection becomes the Disconnect button, which
  helps only if they reach it *first*.
- **What survives, and why it is not nothing.** The narration contract is untouched: the replacement
  still cannot happen silently, and the agent's stated reason appears on screen as it happens. That is
  now the whole of the learner's account of why their board changed, which is why FR-022 makes it
  non-negotiable rather than merely expected.
- **The mechanism is retired, not left dormant.** Every confirmation the product raises comes from an
  agent-initiated replacement, so repealing it for those leaves nothing that can raise one. A prompt
  that no code path can reach is dead weight that a future reader would mistake for a live safeguard,
  which is worse than its absence.
- **A cheap partial mitigation exists and is deliberately NOT specified here**: keeping the replaced
  board recoverable for a short window. It is out of scope because it is a new capability rather than
  a change to an existing one, and because the author asked for the simplest option. If the loss above
  turns out to bite in practice, that is the feature to write next.
- **No redo is introduced.** 001 excluded it and this feature does not revisit that, even though undo
  becoming agent-reachable makes the absence more noticeable.
- **Repealing the prompt narrows an existing deviation rather than adding one.** `switch_difficulty`
  is exempt from the 100 ms tool-call budget partly because it waits on a human; after this it waits
  only on generation. The exemption still stands, for a smaller reason.

## Out of Scope

- Redo, and any form of history navigation beyond the single-step undo that already exists.
- Restarting *the same puzzle* with the learner's entries cleared — a plausible second meaning of the
  word, excluded because the description ruled it out.
- Any change to how puzzles are generated, rated, or verified.
- Any change to the learner's existing controls beyond adding Restart alongside them.
- Voice input or speech recognition in the page. "Hands-free" here means the agent is the learner's
  hands; the site gains no microphone (002 Out of Scope).
- Recovering a board an agent replaced. Noted in the Assumptions as the obvious follow-up if the
  repealed confirmation proves too sharp, but a new capability and not this feature's work.
- Any tool for answering a confirmation prompt, since after this feature no prompt exists to answer.
- Agent-initiated pausing, resuming, annotating, or filling — all of which already exist and are
  unchanged.
- Any relaxation of the narration contract. Every new change-making capability still requires its
  explanation, and this feature does not revisit that.
- Statistics about restarts, undos, or how often an agent answered for the learner (001/FR-051).
