# Feature Specification: Agentic Sudoku Codex Skill

**Feature Branch**: `004-codex-sudoku-skill` *(branch yourself — the git extension hook is not installed here)*

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "A Codex Skill named Agentic Sudoku to be created. Upon calling this skill in Codex Agent. Following should happen — 1. Agentic Sudoku Website must open in the in-app browser of Codex. 2. Agent must be instructed to read and specify all webmcp tools with their short descriptions from the site. 3. Agent must only use the webmcp tools to follow user instructions. This skill must be created in a folder in root of repository. Update ReadMe with instructions to install this skill."

**Depends on**: `specs/001-sudoku-play-experience`, `specs/002-webmcp-agent-tutor`, and
`specs/003-agent-board-controls`. References below in the form `001/FR-0xx`, `002/SC-0xx`, and
`003/FR-0xx` point at those specifications.

**Closes**: `002/T126` and `003/T097` — the standing open item that `002/SC-001` has never been
verified against a live agent. Every tool on this surface has only ever been driven through a
spec-conformant fake. **This feature is the vehicle that finally measures it**, and that shapes what
the skill is permitted to contain.

**The inversion worth naming up front**: every feature so far has built the board a person looks at.
This one builds an artifact whose reader is an *agent*. It ships no pixels, changes no game rule,
and adds no tool. It is the first thing in this repository that is delivered *to* the agent rather
than drawn *for* the learner.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One Call and the Board Is There (Priority: P1)

Someone sitting in Codex wants to play Sudoku with their agent. They invoke the Agentic Sudoku
skill by name. The site opens in Codex's own in-app browser, a puzzle is on screen and playable, and
they can start talking to the agent about it. They did not paste a URL, did not go hunting for a
server to start, and did not explain to the agent what any of this is.

**Why this priority**: This is the whole convenience the request is asking for, and it is the only
part that delivers value entirely on its own — a board on screen in one call is worth having even if
the agent then does nothing clever with it. It is also the precondition for every other story: the
tool surface does not exist until the page is loaded.

**Independent Test**: In a Codex session with nothing open, invoke the skill by name. Confirm the
Agentic Sudoku board appears in the in-app browser with a generated puzzle on it, without the person
supplying an address or any further instruction.

**Acceptance Scenarios**:

1. **Given** a Codex session with no browser open, **When** the person invokes the skill by name,
   **Then** the Agentic Sudoku site opens in Codex's in-app browser with a playable puzzle on screen.
2. **Given** the skill has just opened the site, **When** the person looks at the board, **Then** it
   behaves exactly as the site always does — no banner, no wrapper, and no modification introduced by
   having arrived through the skill.
3. **Given** the site is already open in the in-app browser, **When** the person invokes the skill
   again, **Then** the existing board is reused rather than a second copy being opened, and the
   person's in-progress puzzle is not discarded.
4. **Given** the site cannot be reached at all, **When** the skill is invoked, **Then** the person is
   told plainly that it could not be opened and what to do about it, and the agent does not proceed
   to act as though a board were present.
5. **Given** the person is offline, **When** the skill opens a site that is already available
   locally, **Then** the board still generates and plays, because the site makes no network request
   after load (001/FR-043, 001/SC-009).

---

### User Story 2 - The Agent Tells Me What It Can Do (Priority: P2)

With the board up, the agent reads the capabilities the page is publishing and reports them back:
every tool it found, each with a one-line description of what that tool does. The person now knows —
without reading any documentation, and without the agent guessing — that it can ask for a hint, ask
for the grid to be numbered, ask for a harder puzzle, and what else besides.

**Why this priority**: It converts an opaque agent into a legible one, and it is what turns the board
into a collaboration rather than a page the agent happens to be looking at. It is second because it
requires the page to be loaded, and because a board with a silent agent is still a usable board.

**Independent Test**: Invoke the skill on a loaded board and confirm the agent reports a list of
tools with short descriptions, that the list matches the capabilities the page actually publishes
exactly — no invented entry, no omission — and that the descriptions were taken from the page rather
than from anything written inside the skill.

**Acceptance Scenarios**:

1. **Given** the site is open and publishing its capabilities, **When** the skill runs, **Then** the
   agent reports every published tool, each with a short description of what it does.
2. **Given** the agent reports the tool list, **Then** the list contains exactly the tools the page
   publishes — no tool the page does not offer, and none of the ones it does left out.
3. **Given** the site's published surface changes — a capability added, removed, or reworded —
   **When** the skill is invoked afterwards, **Then** the agent's report reflects the change with no
   edit to the skill, because the list was read from the page and never stored in the skill.
4. **Given** the agent reports the tool list, **Then** it also reports which capabilities only look
   at the board and which change it, so the person knows before asking which requests will alter
   their puzzle.
5. **Given** the page publishes a version for its capability surface, **Then** the agent reports it,
   so a person can tell which surface they are talking to.
6. **Given** the person asks "what can you do here?" later in the same session, **Then** the answer
   still comes from the published surface as it stands at that moment, not from a list memorised
   earlier in the conversation.

---

### User Story 3 - Everything It Does, It Does Through the Tools (Priority: P3)

The person says "put a 4 in row 2, column 7" or "show me where I'm stuck". The agent acts — but only
ever by invoking one of the capabilities the page published. It does not click cells, does not type
at the keyboard, does not script the page, and does not read the project's source code to work out
the answer. If the person asks for something no published capability covers, the agent says so
plainly instead of reaching around the surface to do it anyway.

**Why this priority**: This is the constraint that makes the session mean something. An agent
permitted to click is not exercising the tool surface, and a run where it quietly clicked proves
nothing about whether the surface works. It is third because it only bites once the agent is acting,
and because the first two stories are useful even with a permissive agent.

**Independent Test**: Across a full session — reads, fills, annotations, a difficulty change, a pause
and resume — confirm every change to the board arrived through a published capability, and that a
request no capability covers produced a plain refusal rather than a workaround.

**Acceptance Scenarios**:

1. **Given** the person asks the agent to place a digit, **When** the agent acts, **Then** the digit
   arrives through a published capability and is marked on the board as the agent's (002/FR-044).
2. **Given** the person asks for something no published capability covers, **When** the agent
   responds, **Then** it says plainly that the site offers no way to do that and names what it can do
   instead, rather than clicking, typing, or scripting the page to achieve it.
3. **Given** the agent is working on the board, **Then** it never moves the person's selected cell,
   because it addresses cells by coordinate through the published surface (002/FR-056, 003/FR-019).
4. **Given** a capability rejects a request and explains why, **When** the agent responds, **Then** it
   relays the reason to the person and corrects itself, rather than retrying the identical call or
   working around the refusal by another route.
5. **Given** the person asks what digit is correct for a cell, **Then** the agent answers only from
   what is visible on the board, because the site never discloses the solution to anyone
   (001/FR-029, 002/FR-026) — and it does not go looking for the answer in the project's files.
6. **Given** the person disconnects the agent using the site's own Disconnect control (002/FR-057),
   **When** they then ask the agent to change the board, **Then** it reports that the capabilities are
   no longer available and does not fall back to operating the page directly.
7. **Given** the agent changes the board, **Then** each change carries the agent's own explanation on
   screen, because the site refuses a silent change (002/SC-002) — and the agent writes real
   reasoning rather than filler to satisfy the requirement.

---

### User Story 4 - Someone Else Can Install It (Priority: P4)

A person who has never seen this repository reads the README, follows the installation steps, and
has the skill available in their own Codex within a few minutes. They then invoke it and get a board.

**Why this priority**: A skill nobody can install is a skill nobody uses, and the request asks for the
README explicitly. It ships last because the skill has to exist and work before instructions for
installing it are worth writing.

**Independent Test**: Hand the README to someone with Codex and no knowledge of this project.
Confirm they can install the skill and invoke it successfully from the written steps alone, without
asking a question.

**Acceptance Scenarios**:

1. **Given** the README, **When** a newcomer follows the installation section, **Then** the skill
   becomes available in their Codex and can be invoked by name.
2. **Given** the installation section, **Then** it states any prerequisite the skill depends on —
   including how to have the site reachable — so the newcomer is not left to discover a missing step
   by failure.
3. **Given** the skill is installed, **When** the newcomer invokes it, **Then** the outcome matches
   what the README said would happen.
4. **Given** the repository's status tables, **Then** they record this feature alongside the existing
   three, so a reader of the README knows the skill exists at all.

---

### Edge Cases

- **The in-app browser publishes no capabilities at all.** The agent host may not implement the
  standard the site speaks. The skill reports this plainly, names it as the reason it can do nothing
  to the board, and stops. It MUST NOT simulate the capabilities, drive the page directly instead, or
  present a substitute as though it were the real surface. The board remains fully playable by the
  person (001/FR-001, 002/FR-013) and they are told so.
- **The site is not running.** The person is told what to start and how, and no board-dependent claim
  is made in the meantime.
- **The site is reachable but the capabilities are not published yet** — the page is still loading, or
  registration is still settling. The agent waits briefly and re-reads rather than reporting an empty
  surface as final.
- **A published capability the skill has never heard of.** It is reported and used like any other. The
  skill has no list of its own to be surprised against.
- **A capability the skill expected is missing.** Also fine, and reported as what was actually found.
  The skill never asserts the presence of something the page did not publish.
- **The person asks for something the surface deliberately does not offer** — erasing a cell, undoing
  a move, or being told whether a digit is correct. The agent says plainly that this is the person's
  own to do and points at the on-screen control, rather than reaching around the surface.
- **The person asks the agent to solve the whole puzzle.** Permitted by the surface, one explained
  placement at a time. The agent says what it is about to do, because a board silently filling itself
  is the outcome the narration contract exists to prevent (002/FR-014).
- **The board is paused** — by the person or by the agent. Reads still succeed and changes are
  refused (002/FR-045); the agent reports the refusal rather than treating it as a fault.
- **A confirmation prompt is waiting on screen** for a difficulty change or a practice drill
  (002/FR-053, 003/FR-030). The agent waits for the person's answer and reports a decline as an
  ordinary outcome, never re-asking immediately.
- **The page is reloaded mid-session.** Capabilities re-publish and any on-screen agent marks are
  discarded (002 edge cases). The agent re-reads the surface rather than assuming its earlier view
  still holds.
- **The skill is invoked twice in one session.** The second invocation is harmless: it does not open a
  duplicate board, does not restart the person's puzzle, and does not double-report the surface.
- **The published surface reports a version the agent has not seen before.** Reported to the person
  and otherwise unremarkable — the surface describes itself, so a new version needs no skill change
  (002/FR-010).
- **The person edits the repository while a session is open.** The skill makes no claim about source
  code and the agent does not consult it to play; a source change has no effect on a running session
  until the site is rebuilt and reloaded.

## Requirements *(mandatory)*

### Functional Requirements

**The skill package**

- **FR-001**: The repository MUST contain a skill package named **Agentic Sudoku**, in its own folder
  at the repository root, invocable by that name from a Codex session.
- **FR-002**: The skill MUST be self-contained: everything an agent needs to carry out the skill MUST
  be inside that folder, with no dependency on files elsewhere in the repository and no dependency on
  the session having this repository open.
- **FR-003**: The skill MUST be portable — installable and usable by a person who has this repository
  neither cloned nor open, since the site it drives is a web page rather than a codebase.
- **FR-004**: The skill MUST be plain, readable, inspectable content. A person MUST be able to read it
  and know exactly what it will instruct an agent to do, without running it.
- **FR-005**: The skill MUST NOT introduce, require, or imply any change to the site's capability
  surface, its game rules, or its interface. It consumes what already exists.

**Opening the site**

- **FR-006**: Invoking the skill MUST open the Agentic Sudoku site in the agent host's own in-app
  browser.
- **FR-007**: The skill MUST open the site at **`http://localhost:3000`** — the address the
  repository's own static export is served from — until the site is deployed, at which point that
  address becomes the deployed one.
- **FR-007a**: The address MUST appear in **exactly one place** in the skill, so moving from the local
  address to the deployed one is a single edit that cannot leave a stale copy behind.
- **FR-007b**: The README MUST state that the skill points at a local address today and what has to
  change when the site is deployed, so a newcomer is not left wondering why nothing opens.
- **FR-008**: The skill MUST reuse a session's existing board when the site is already open, rather
  than opening a duplicate or discarding an in-progress puzzle.
- **FR-009**: When the site cannot be opened, the skill MUST report that plainly, MUST say what would
  make it reachable, and MUST NOT allow the agent to continue as though a board were present.
- **FR-010**: Opening the site MUST require no action from the person beyond invoking the skill — no
  pasted address, no prior configuration inside the conversation.

**Reading and reporting the capability surface**

- **FR-011**: The skill MUST instruct the agent to read the full set of capabilities the site
  publishes, from the live page, at the moment of invocation.
- **FR-012**: The agent MUST report every capability it found, each with a short description of what
  that capability does.
- **FR-013**: The reported list MUST match the published surface exactly: nothing added, nothing
  omitted, nothing renamed.
- **FR-014**: **The skill MUST NOT contain a copy of the capability list, of any capability's name, or
  of any capability's description.** The list is discovered every time. A skill carrying its own copy
  would be a second, unversioned statement of a contract the site already publishes, and it would
  drift the first time the site changed — which is the precise failure the site's self-describing
  surface exists to prevent (002/FR-006, 002/FR-010).
- **FR-015**: The report MUST distinguish capabilities that only observe the board from those that
  change it, so the person knows before asking which requests will alter their puzzle (002/FR-005).
- **FR-016**: The report MUST state the version the surface declares for itself, where it declares
  one.
- **FR-017**: The agent MUST re-read the surface rather than relying on an earlier reading whenever
  the page has been reloaded, the agent has been disconnected and reconnected, or the person asks
  again what it can do.
- **FR-018**: Descriptions in the report MUST be faithful to what the site published. The agent MUST
  NOT embellish a capability with behaviour the site did not describe.

**Acting only through the surface**

- **FR-019**: The skill MUST instruct the agent that every action affecting the board — every digit,
  every candidate, every mark, every change of difficulty, and every change to the clock — is
  performed exclusively by invoking a published capability.
- **FR-020**: The agent MUST NOT change the board by any other means: not by clicking cells, not by
  typing at the keyboard, not by operating the site's own on-screen controls, and not by scripting the
  page.
- **FR-021**: The agent MUST NOT consult the project's source code, its stored data, or any other
  off-page source to decide what to do on the board. It reasons from the board as the person sees it,
  which is what the site's own design guarantees for every actor (002/FR-026).
- **FR-022**: When a request is not covered by any published capability, the agent MUST say so and
  name what it can do instead. It MUST NOT satisfy the request by any route outside the surface.
- **FR-023**: When a capability refuses a request, the agent MUST relay the reason and correct itself
  rather than repeating the identical call or circumventing the refusal.
- **FR-024**: The person MUST retain full control throughout: nothing the skill instructs may disable
  a control, take their selection, or prevent them from playing (002/FR-056, 003/FR-019).
- **FR-025**: The skill MUST NOT instruct the agent to work around, suppress, or shortcut any of the
  site's own protections — the requirement to explain every change, the confirmation before a board is
  replaced, or the refusal of changes on a paused board.
- **FR-026**: When the host publishes no capabilities at all, the agent MUST report that the surface is
  unavailable and MUST NOT substitute direct operation of the page for it.

**Content of the skill**

- **FR-027**: The skill MUST NOT contain instructions on how to solve Sudoku, how to apply any
  particular technique, or how any specific capability is used. Its content is confined to: open the
  site, read the surface, report it, and act only through it.
- **FR-028**: The skill MUST NOT contain anything that would let an agent operate the site
  successfully if the site's own descriptions were inadequate. If a run needs the skill to explain the
  site, that is a defect in the site's descriptions to be fixed there (002/FR-006).
- **FR-029**: The skill MUST be **content-free**: it MUST carry no coaching tone, no teaching style,
  no suggested opening move, and no guidance on how to play. Its entire content is the four
  instructions above — open the site, read the surface, report it, act only through it — plus the one
  address of FR-007a. Anything beyond that would soften the measurement of 002/SC-001 and, worse,
  could carry a run that the site's own descriptions would not have carried.

**Documentation**

- **FR-030**: The README MUST carry installation instructions sufficient for a person who has never
  seen this repository to install the skill and invoke it.
- **FR-031**: The installation instructions MUST state every prerequisite, including whatever is
  required for the site to be reachable.
- **FR-032**: The README MUST state what the skill does when invoked, so a person knows what to expect
  before running it.
- **FR-033**: The README MUST record the limitation honestly where the agent host does not publish the
  standard the site speaks, rather than presenting the skill as working everywhere.
- **FR-034**: The repository's feature status tables MUST record this feature alongside the existing
  three.

### Key Entities

- **Skill Package**: The named, self-contained, human-readable bundle at the repository root that an
  agent host loads when the person invokes it by name. Carries instructions only — no capability
  list, no game rules, no solving content.
- **Published Capability Surface**: What the site advertises about itself at the moment it is read —
  the set of capabilities, their descriptions, whether each observes or changes, and the surface's own
  version. Owned by the site, never by the skill, and re-read rather than remembered.
- **Session**: One run from invocation to the person stopping — a board open in the in-app browser, a
  surface read from it, and a conversation in which every board change went through that surface.
- **Installation Instruction**: The README's account of how a newcomer gets the skill into their own
  agent host, what it needs to work, and what it will do.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person invokes the skill by name and is looking at a playable puzzle within 30
  seconds, having supplied no address and no further instruction.
- **SC-002**: The capabilities the agent reports match the site's published surface exactly — 100%
  present, 0% invented — verified by comparing the report against the surface the page actually
  publishes.
- **SC-003**: The site's capability surface can be changed — one added, one reworded — and the agent's
  next report reflects both, **with no edit to the skill**.
- **SC-004**: Across a complete session, 100% of changes to the board arrive through a published
  capability, and 0% arrive by clicking, typing, operating the site's own controls, or scripting the
  page.
- **SC-005**: A request no published capability covers produces a plain refusal naming the
  alternatives, in 100% of attempts, and never a workaround.
- **SC-006**: **002/SC-001 is finally measured**: with no site-specific solving instructions supplied
  by the skill or the person, the agent reads the board, identifies a valid next move, and explains
  it — the criterion open since feature 002 and widened by feature 003.
- **SC-007**: A person with Codex who has never seen this repository installs the skill and invokes it
  successfully from the README alone, in under 5 minutes, without asking a question.
- **SC-008**: Where the agent host publishes no capability surface, the person is told so within the
  first exchange, and 0% of the session is spent acting as though the board were reachable.
- **SC-009**: Reading the site and reporting its surface adds no perceptible wait — the person is
  reading the tool list within a few seconds of the board appearing.
- **SC-010**: The person's own play is never impeded during a session: at no point is a control
  disabled, a selection moved, or an input refused because of something the skill instructed.
- **SC-011**: The skill contains zero capability names, zero capability descriptions, and zero Sudoku
  or coaching guidance, verified by inspection of its content.
- **SC-012**: Invoking the skill a second time in one session leaves the person's in-progress puzzle
  intact in 100% of attempts.
- **SC-013**: Repointing the skill from the local address to a deployed one is a single edit in a
  single place, and no stale address remains anywhere in the skill afterwards.

## Assumptions

Recorded where the description did not specify, or where an existing rule had to be chosen between.

- **The skill is a set of instructions, not a program.** It tells an agent what to do; it does not run
  code, hold state, or call anything itself. Everything it achieves, it achieves by directing an agent
  that already has a browser and the ability to invoke what a page publishes.
- **The skill is read by an agent, and that is the whole audience.** Unlike every other artifact in
  this repository, no part of it is rendered for a person to look at — which is why "look at the page,
  don't just run the tests" becomes, here, "run it against a real agent and read what comes back".
- **The skill carries no copy of the tool surface, and this is the load-bearing decision.** The site
  already describes itself completely, by constitutional mandate (Principle I) and by 002/FR-006. A
  skill restating that description would create a second copy that drifts on the first change to the
  site — and, worse, would mask exactly the defect this feature exists to detect. If a run fails
  because a description was inadequate, the fix belongs in the site.
- **"Only use the WebMCP tools" is read as covering every action on the board, not every action in the
  session.** The agent may still converse, explain, read what the page shows it, and answer questions.
  What it may not do is change the board, or learn what to change it to, by any route other than the
  published surface. Talking is not acting.
- **Reading the board through the published surface is the only reading that counts.** Screenshotting
  the page to see the digits, scraping the page's content, or opening the project's saved data would
  each be a way around the surface, and each is excluded by the same rule.
- **The site's own controls belong to the person, not the agent.** The Pause button, the difficulty
  select, the ruler toggle, and the Disconnect control are the person's, even though the surface
  publishes capabilities that do some of the same things. The agent uses the published capability; it
  does not press the person's buttons.
- **A second invocation is idempotent**, matching how the site's own ruler capabilities behave
  (003/FR-011): asking again for something already true succeeds and does nothing.
- **This feature adds no seventeenth capability.** The request is for a skill that consumes the
  existing sixteen. Anything the skill turns out to want that the surface does not offer is a finding
  to record, not a licence to add a capability inside this feature.
- **The agent host is Codex**, as named in the request. Nothing here is written to prevent another
  host from using the same skill, but no other host is verified by this feature.
- **The address is `http://localhost:3000` today and a deployed address later.** Confirmed with the
  author: the site is not yet deployed, Vercel is the intended destination, and the skill will be
  repointed when it is. That is why FR-007a insists the address live in exactly one place — the
  future edit is known in advance, and the only way it goes wrong is a second copy nobody remembers.
  Until then, the skill's usefulness is bounded by the person having the site running locally, which
  the README must say plainly.
- **The site is served over a secure context.** The standard the site speaks is only available in one,
  which is a hosting constraint rather than an architectural one — and the site remains fully playable
  by a person either way (002 assumptions). `localhost` qualifies as a secure context, so today's
  local address is not a barrier to the agent path; a future deployed address must be served over
  HTTPS, which Vercel does by default.
- **Codex's in-app browser may not publish this standard at all, and that risk is real and unresolved.**
  If it does not, this feature still ships everything it promises except a successful session, and
  SC-006 stays open. It is recorded here so the possibility is faced before the work starts rather
  than discovered at the end.

## Out of Scope

- Any new capability on the site's surface, and any change to an existing one. The sixteen that exist
  are what this skill consumes.
- Any change to the game, the board, the interface, the palette, or the rules.
- Deploying or hosting the site. Where the site is reachable from is a prerequisite this feature
  states, not a problem it solves — the skill points at the local address today, and repointing it at
  a deployed one is a one-line edit this spec makes cheap (FR-007a, SC-013) rather than work it
  performs.
- Skills for agent hosts other than Codex, and any abstraction meant to serve several hosts at once.
- Sudoku teaching content, curricula, technique explanations, and coaching scripts — excluded here for
  the same reason 002 excluded them: the teaching comes from the agent, and the site supplies the
  board and the tools.
- Any bundled chat interface or in-page agent. The agent lives in the person's own client, exactly as
  002 requires.
- Recording, scoring, or reporting how well an agent performed across sessions — the same exclusion
  001/FR-051 and 002 apply to the person's own statistics.
- Automating the closure of the other open items carried from 001, 002, and 003: the offline-reload
  gap, the deferred bundle budget, the two missing drills, and the ruler's colour decision. This
  feature closes exactly one of them, 002/SC-001, and by measurement rather than by change.
