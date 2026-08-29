<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 -> 1.2.0
Bump rationale: MINOR. A mandated technology stack is added to Technology & Architecture
Constraints, and Principle IV's reproducibility rule is WIDENED (a recorded puzzle
definition now satisfies it alongside a recorded generation seed) to accommodate a
generator that exposes no seed parameter. Widening a rule cannot make previously
compliant work non-compliant -- recording a seed still satisfies the principle -- so
this is not a MAJOR bump. No principle was removed and no rule was tightened.

Modified principles:
  - IV. Puzzle Integrity & Performance Budgets -- reproducibility rule widened; a new
    rule requires independent uniqueness verification of any third-party-generated
    puzzle before it reaches a player

Modified sections:
  - Technology & Architecture Constraints -- mandated stack added (Next.js App Router +
    React client components, static export with zero server runtime, Tailwind CSS,
    Lucide React, sudoku-gen); Determinism constraint clarified for third-party
    randomness; a solution-quarantine constraint added
  - Development Workflow & Quality Gates -- Definition of Done extended from 8 to 10
    items (static-export verification; uniqueness verification of generated puzzles)

Added sections: none
Removed sections: none

Deferred items: none

Open risk recorded, not deferred:
  - The 250 KB gzipped first-load budget in Principle IV is now sharply constrained by the
    mandated framework baseline. Governance already requires budget re-validation whenever a
    runtime dependency is added or the build target changes; that re-validation MUST happen
    at the first /speckit-plan and the measured number recorded.

Templates requiring review at runtime (not modified by this command):
  - .specify/templates/plan-template.md -- Constitution Check gate should reflect
    Principles I-V, the mandated stack, and the numeric budgets in Principle IV.
  - .specify/templates/spec-template.md -- non-functional requirement sections should
    reference the performance and accessibility budgets defined here.
  - .specify/templates/tasks-template.md -- task generation should emit contract-test
    tasks for every WebMCP tool per Principle V, ordered before implementation tasks.
-->

# Agentic Sudoku Constitution

Agentic Sudoku is a browser-based Sudoku environment in which a human player and an
AI agent collaborate — on the same board, in the same session — to learn and solve
puzzles. The agent participates through the WebMCP browser standard rather than through
a private API. This constitution defines the non-negotiable rules that make that
collaboration correct, inspectable, and fast.

## Core Principles

### I. WebMCP Standard Compliance (NON-NEGOTIABLE)

Agent capability MUST be exposed exclusively through the WebMCP browser standard via
`document.modelContext`; no bespoke agent bridge, no `window.__agent` globals, no
side-channel `postMessage` protocol may substitute for or shadow it.

- Every agent-invocable capability MUST be registered as a WebMCP tool with a stable
  `name`, a human-readable `description`, and a JSON Schema `inputSchema` that fully
  constrains its arguments. Unschema'd or free-form string arguments are prohibited.
- Tool handlers MUST return the standard structured result shape and MUST report
  failure as a returned error result, never as an unhandled thrown exception that
  escapes into the host page.
- Tool registration MUST be feature-detected. When `document.modelContext` is absent
  the application MUST remain fully playable by a human; the absence of an agent host
  is a supported operating mode, not a degraded one.
- Tool names, schemas, and result shapes form a public contract. Renaming a tool,
  removing a tool, or narrowing an existing schema is a BREAKING change and requires a
  MAJOR bump of the tool-surface version recorded in the tool registry module.
- Every tool MUST be idempotent-safe to describe and explicit about mutation: read-only
  tools MUST NOT alter game state, and mutating tools MUST return the resulting state
  so the agent never has to guess what happened.
- **Registration MUST be isolated from UI rendering.** Tool definition and registration
  live in a dedicated registration module owned by the Tools layer. Registration MUST
  NOT occur inside a component render function, a JSX/template body, a reactive effect
  tied to a DOM node, or any code path that runs per-render.
- The registration module MUST be importable and executable headlessly, with no DOM
  mounted, so the full tool surface can be asserted in tests without rendering the app.
- Registration MUST be idempotent and lifecycle-safe: mounting, unmounting, remounting,
  or hot-reloading the UI MUST NOT duplicate, orphan, or silently drop a registered
  tool. Teardown MUST unregister exactly what it registered.
- No UI component may register, mutate, or unregister a tool as a side effect of
  rendering. The agent surface is defined by the registration module alone, and a
  reader MUST be able to enumerate every tool from that module without reading the view.

**Rationale**: The entire premise of the product is that a general-purpose agent can
drive this site without prior knowledge of it. That only holds if the site speaks the
standard exactly and self-describes completely.

### II. Zero-Backend, Client-Side Only

The application MUST be a 100% client-side static site. There is no server, no database,
and no runtime origin the app calls home to.

- No runtime network request to a first-party or third-party service is permitted for
  core functionality: puzzle generation, validation, solving, hinting, scoring, and
  agent tool execution MUST all run in the browser.
- Puzzles MUST be generated or solved locally. Fetching puzzles from a remote puzzle
  API is prohibited.
- Persistence MUST use browser-local storage only (`localStorage`, `sessionStorage`, or
  IndexedDB), MUST tolerate storage being unavailable or throwing, and MUST render a
  correct empty state when nothing is stored.
- No telemetry, analytics beacon, user account, or personal-data collection. No player
  data leaves the device.
- The build output MUST be deployable to any static host by copying files; it MUST NOT
  require server-side rendering, edge functions, or runtime environment variables.

**Rationale**: Zero backend removes an entire class of privacy, cost, latency, and
availability concerns, and it keeps the agent's view of the world identical to the
human's — everything either side can see is present in the page.

### III. Modular Architecture & Separation of Concerns

Code MUST be modular. The codebase MUST be organized into four layers with a strict one-directional
dependency rule: **Engine ← State ← Tools/View**. A lower layer MUST NOT import from a
higher one.

- **Engine (pure game logic)**: grid representation, generation, solving, constraint
  checking, difficulty rating, and hint derivation. MUST be pure and deterministic
  given an explicit seed, MUST NOT import DOM, framework, storage, or timer APIs, and
  MUST be runnable in a bare Node process.
- **State (session store)**: the single source of truth for the current board, move
  history, selection, notes, and settings. All mutations MUST flow through explicit,
  named actions. Undo/redo MUST be implemented here, not in the view.
- **Agent Tools (WebMCP adapter)**: thin, declarative adapters that validate input
  against their schema, call State actions or Engine functions, and serialize results.
  Tool handlers MUST NOT contain game rules and MUST NOT touch the DOM directly.
- **View (UI)**: renders State and dispatches actions. MUST NOT compute game rules
  and MUST NOT hold gameplay state that the State layer does not own.
- Human moves and agent moves MUST converge on the same State actions. A capability
  reachable by one actor and not the other is a defect unless the asymmetry is
  documented in the feature spec.

Within every layer, modularity rules apply:

- **Single responsibility**: each module MUST have one stated purpose, expressible in a
  single sentence at the top of the file. A module that needs "and" to describe what it
  does MUST be split.
- **Explicit public surface**: each module MUST export a named, intentional API. Deep
  imports into another module's internal files are prohibited; consumers import from the
  module's entry point only. Anything not exported from that entry point is private.
- **No circular dependencies** between modules, in either direction, enforced by an
  automated lint rule rather than by review.
- **Composition over accretion**: shared behaviour MUST be extracted into a named module
  rather than duplicated, and MUST NOT be bolted onto an unrelated module for
  convenience. There are no `utils`, `helpers`, `misc`, or `common` dumping grounds; a
  module is named for what it does.
- **Replaceability**: every module MUST be independently testable and replaceable behind
  its public API without editing its consumers. If swapping an implementation requires
  touching callers, the boundary is wrong.
- **Size as a smell**: a module exceeding roughly 300 lines, or a function exceeding
  roughly 50, MUST be reviewed for splitting. This is a review trigger, not a hard
  failure, and a deliberate exception MUST be justified in the pull request.
- **Sudoku techniques are modules**: each solving or hinting technique MUST be its own
  Engine module with a uniform interface, so techniques can be added, tested, and
  difficulty-weighted in isolation. No monolithic solver switch statement.

**Rationale**: Two independent actors mutating one board is only tractable when there
is exactly one place where mutation happens and exactly one place where rules live.
Modularity is what makes that structure survive contact with growth: small, named,
independently testable units keep the agent surface, the rules, and the pixels from
leaking into one another.

### IV. Puzzle Integrity & Performance Budgets

Mathematical correctness of puzzles is a hard requirement, and it MUST be delivered
inside an explicit performance budget.

- Every generated puzzle MUST have exactly one solution, proven by a solver that counts
  solutions and terminates at 2. Puzzles with zero or multiple solutions MUST never be
  presented to a player.
- Every puzzle obtained from a third-party generator MUST be independently verified
  against the uniqueness rule above, by this project's own counting solver, before it is
  presented to a player. A generator's claim of validity is not evidence; a vendor's
  puzzle that fails verification MUST be discarded and regenerated.
- Generation MUST be reproducible: any board a player has seen MUST be exactly
  reconstructable from what the session records. This is satisfied either by recording a
  generation seed that deterministically reproduces the puzzle, or -- where the generator
  exposes no seed -- by recording the resulting puzzle definition itself. Reproducibility
  is the requirement; a seed is one way to achieve it, not the requirement itself.
- A claimed difficulty rating MUST be derived from the solving techniques actually
  required, not from clue count alone.
- Hints MUST be logically sound: a hint MUST cite the technique and the cells that
  justify it, and MUST never depend on reading the stored solution when the deduction
  is not actually available from the visible board.
- Performance budgets, measured at p95 on a mid-tier laptop and enforced by automated
  performance tests:
  - Puzzle generation (including uniqueness proof): **≤ 500 ms**
  - Full-board validation or constraint check: **≤ 16 ms**
  - Hint / next-technique derivation: **≤ 250 ms**
  - Agent tool call, invocation to returned result: **≤ 100 ms** (excluding generation)
  - Interaction to next paint for a human cell entry: **≤ 100 ms**
  - Initial load: **≤ 250 KB** gzipped JS, time-to-interactive **≤ 2 s** on simulated 4G
- Any operation that can exceed its budget MUST run off the main thread (Web Worker) or
  yield cooperatively. Blocking the main thread beyond one frame (16 ms) is prohibited.

**Rationale**: A Sudoku that is not uniquely solvable is not a Sudoku, and an agent that
must wait seconds for a tool result cannot collaborate in real time with a human.

### V. Test-First & Non-Blocking Feedback (NON-NEGOTIABLE)

**Tests MUST be written before the code they test.** No production code is written until
a failing test demands it, and the interface never makes either actor wait.

- TDD is mandatory across the entire codebase -- Engine, State, WebMCP tools, and View
  logic alike -- with no module exempt: write the test, run it, watch it fail for the
  right reason, then write the minimum code to pass, then refactor. Red-Green-Refactor
  is enforced in review.
- Tests retrofitted after the implementation do not satisfy this principle. The commit
  history MUST show the failing test arriving before or with the code that satisfies it,
  and a pull request whose tests were written afterwards MUST say so explicitly and
  justify it as a deviation under the Violations rule.
- A bug fix MUST begin with a regression test that reproduces the bug and fails before
  the fix is applied.
- Every WebMCP tool MUST have a contract test asserting its registered name, its input
  schema (including rejection of invalid input), its success result shape, and its
  error result shape.
- The Engine MUST have property-based tests for its invariants: uniqueness of solution,
  solver correctness against generated puzzles, and seed determinism.
- At least one integration test MUST exercise a full human-and-agent collaborative
  session: agent tool call → State mutation → rendered view, including undo.
- Every module MUST be testable without a browser or with a headless DOM only. Code
  that can only be verified by manual clicking is not acceptable.
- Visual feedback MUST be non-blocking: no modal dialog, spinner, or animation may
  prevent the human from continuing to play or prevent an agent tool from returning.
  Long operations report progress; they do not lock the board.
- All animation MUST honour `prefers-reduced-motion`, and all feedback conveyed by
  colour (conflicts, hints, agent-placed cells) MUST also be conveyed by a
  non-colour cue (icon, text, or pattern) and be exposed to assistive technology.
- Agent-originated changes MUST be visually distinguishable from human-originated
  changes, and that distinction MUST also be readable from State by tests.

**Rationale**: Collaboration is a shared real-time surface. A blocking spinner stalls
both actors at once, and untested tool contracts fail silently in the one place —
the agent boundary — where no human is watching.

## Technology & Architecture Constraints

The stack below is mandated. Replacing any named element is an amendment to this document,
not a planning decision.

- **Framework**: Next.js using the App Router, with React client components. Every
  interactive component is a client component; the App Router is used for routing and
  build output only, never for server behaviour.
- **Execution**: 100% client-side with zero server runtime. The build MUST produce a fully
  static export deployable by copying files. Server Actions, Route Handlers, middleware,
  server-side rendering of dynamic data, incremental regeneration, and any server-only
  runtime API are prohibited -- not merely unused, but unavailable by configuration, so
  that a violation fails the build rather than shipping silently.
- **WebMCP**: the native browser API via `document.modelContext`, used directly. No
  wrapper library, no SDK, and no abstraction layer may stand between this project's tool
  registration module and the browser API.
- **Styling**: Tailwind CSS. The Japandi palette MUST be defined once as named theme
  tokens; raw hex values and arbitrary-value utilities are prohibited in components, so the
  palette has exactly one place it can be audited for contrast.
- **Icons**: Lucide React, imported icon by icon. Barrel imports of the full icon set are
  prohibited against the bundle budget.
- **Puzzle generation**: `sudoku-gen`. Its output MUST pass this project's own uniqueness
  verification before reaching a player (Principle IV), and the puzzle definition it
  returns MUST be recorded with the session to satisfy reproducibility.
- **Solution quarantine**: a puzzle's solution MUST NOT leave the Engine layer. It MUST NOT
  be reachable from the Tools layer, MUST NOT appear in any agent tool result, and MUST NOT
  be written to persisted session state in a form the page can read back and display.
- **Runtime**: modern evergreen browsers with `document.modelContext` support for the
  agentic path, and full human playability without it. No IE, no polyfilled WebMCP shim
  presented as the real thing.
- **Language**: TypeScript in `strict` mode. `any` requires an inline justification
  comment. Public Engine and Tool boundaries MUST be explicitly typed.
- **Dependencies**: minimal by default. Every added runtime dependency MUST be justified
  in the plan's Complexity Tracking section against the 250 KB budget. No dependency may
  introduce a network call, a backend requirement, or a build-time secret.
- **Determinism**: all first-party randomness MUST route through a single seeded PRNG in
  the Engine. Direct use of `Math.random()` in this project's own code, outside that
  module, is prohibited. A dependency's internal randomness is permitted only where its
  output is independently verified and recorded, as required for puzzle generation above.
- **Storage schema**: persisted state MUST carry a schema version and a migration path;
  unreadable or future-versioned stored state MUST be discarded safely, not crash.
- **Security posture**: no `eval`, no `innerHTML` with non-constant input, no remote
  script or style. Agent tool inputs are untrusted and MUST be schema-validated before
  reaching State or Engine.
- **Accessibility**: the board MUST be fully keyboard-operable and screen-reader
  navigable, targeting WCAG 2.1 AA. Accessibility is a gate, not a follow-up task.

## Development Workflow & Quality Gates

- **Spec Kit flow**: features proceed `/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`. Plans MUST pass the Constitution Check gate
  before task generation.
- **Definition of done** for any feature touching gameplay or the agent surface:
  1. Tests written first and now passing (unit, tool contract, integration as
     applicable), with the failing-test-first order visible in the commit history.
  2. Layer boundaries from Principle III respected — verified by an import-direction
     lint rule, not by reviewer memory.
  3. Module boundaries from Principle III respected: single responsibility, entry-point
     imports only, no circular dependencies — all enforced by lint.
  4. WebMCP registration confined to the registration module (Principle I), with a test
     that enumerates the tool surface headlessly, with no DOM mounted.
  5. Performance budgets from Principle IV measured and recorded, not asserted.
  6. New or changed WebMCP tools documented in the tool registry with schema and
     example invocation.
  7. Keyboard and screen-reader paths verified; `prefers-reduced-motion` honoured.
  8. No new runtime network request introduced (Principle II).
  9. The production build completes as a fully static export with no server runtime, and
     the output is verified to run from a plain file server.
  10. Any puzzle reaching a player is verified to have exactly one solution by this
      project's own solver, regardless of which generator produced it.
- **Review**: every change MUST be reviewed against these principles by name. A reviewer
  citing "Principle II" or "Principle IV budget" is making a binding objection.
- **Violations**: a deliberate deviation MUST be recorded in the feature plan's
  Complexity Tracking table with the principle violated, the concrete reason, and the
  simpler alternative that was rejected and why. Undocumented deviations block merge.
- **Runtime agent guidance**: `CLAUDE.md` at the repository root carries day-to-day
  development guidance for AI coding assistants. It elaborates this constitution and is
  subordinate to it; where they conflict, this document wins.

## Governance

This constitution supersedes all other development practices, style guides, and
conventions in this repository. Where any other document conflicts with it, this
document controls.

**Amendment procedure**: Amendments MUST be proposed as a change to this file via
`/speckit-constitution`, MUST state the principle added, modified, or removed, MUST
include the rationale, and MUST include a migration note describing how existing code
and in-flight specs come into compliance. An amendment takes effect when merged.

**Versioning policy**: this constitution follows semantic versioning.
- **MAJOR**: a principle is removed or redefined in a backward-incompatible way, or
  governance rules change such that previously compliant work becomes non-compliant.
- **MINOR**: a new principle or section is added, or existing guidance is materially
  expanded.
- **PATCH**: clarifications, wording, typo fixes, and non-semantic refinements.

**Compliance review**: compliance is verified at three points — the Constitution Check
gate in every feature plan, the Definition of Done checklist on every pull request, and
a review of this document at the close of each milestone to confirm that its budgets
and principles still reflect how the project is actually built. Budgets in Principle IV
MUST be re-validated whenever a runtime dependency is added or the build target changes.

**Version**: 1.2.0 | **Ratified**: 2026-08-29 | **Last Amended**: 2026-08-29
