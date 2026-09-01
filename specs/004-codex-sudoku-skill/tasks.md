---

description: "Task list for feature 004 — Agentic Sudoku Codex Skill"
---

# Tasks: Agentic Sudoku Codex Skill

**Input**: Design documents from `specs/004-codex-sudoku-skill/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **MANDATORY, not optional.** Constitution Principle V is NON-NEGOTIABLE and exempts no
module: *"write the test, run it, watch it fail for the right reason, then write the minimum code to
pass."* The commit history must show the failing test arriving before the thing it tests. The tasks
template calls tests optional; this repository's constitution overrides it.

**Organization**: Tasks are grouped by user story. **Read the note below before planning parallel
work — this feature's stories do not parallelise, and that is unusual for this repo.**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependencies
- **[Story]**: US1–US4, mapping to the user stories in [spec.md](./spec.md)

---

## ⚠️ The structural fact that shapes this whole list

**Every user story edits the same file.** US1, US2, and US3 are three *instructions inside one
`SKILL.md`*, not three modules. Feature 003's four stories owned disjoint files and could be built by
four people at once; **these cannot**. They are strictly sequential.

What that changes:

- **Stories are incremental, not parallel.** A `SKILL.md` carrying only instruction 1 is a real,
  shippable skill — invoke it, the board opens. Instruction 2 is appended, then 3 and 4. Each
  checkpoint is a working skill that does less.
- **Parallelism lives only inside phases**, among the test files, which *are* separate.
- **The merge point is the whole feature.** Do not split this across people by story.

---

## Phase 1: Setup

**Purpose**: Answer the open risk before building anything, and prepare the ground.

- [ ] T001 **Do this first.** Serve the site with `npm run build && npm start`, open
      `http://localhost:3000` in Codex's built-in browser **by hand**, and check whether **Site tools**
      appears in the address bar. This is [R5](./research.md#r5--will-the-built-in-browser-load-httplocalhost3000),
      the feature's one unresolved risk. It needs no skill, no code, and five minutes — and if it
      fails, you learn *before* writing anything that the Vercel deploy has to come first. Record the
      answer at the bottom of this file.
- [ ] T002 Confirm the prerequisites from [R2](./research.md#r2--does-codexs-in-app-browser-actually-support-webmcp)
      hold on this machine: ChatGPT desktop app up to date, model set to **GPT-5.6 Sol or Terra**
      (**not Luna** — WebMCP is disabled there), workspace is not Enterprise or Edu, and Site tools is
      enabled under Settings → Browser → Permissions. A failure at T001 is meaningless until these are
      ruled out.
- [X] T003 Create the directory `.agents/skills/agentic-sudoku/agents/` at the repository root, per
      [R3](./research.md#r3--where-does-the-skill-live-in-this-repository). **`.agents/skills`, not
      `.codex/skills`** — the recalled path fails silently.
- [X] T004 [P] Verify tooling ignores the new directory: run `npm run lint` and `npm run build` with
      the empty directory present and confirm both are unaffected, and confirm `.agents/` is not
      matched by `.gitignore`.
- [X] T005 [P] Confirm the address decision is recorded and singular: `http://localhost:3000` today,
      the deployed address later, living in exactly one line of `SKILL.md` (FR-007a).

**Checkpoint**: the risk is known, the ground is prepared, nothing is written yet.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: The one shared thing all four test files need.

**⚠️ CRITICAL**: No story work begins until T006 exists.

- [X] T006 Create the test helper `tests/support/skillFiles.ts` exposing the skill directory's path
      and a function returning the concatenated text of every file inside it. All four test files read
      the skill through this, so "the skill directory" has one definition. Follows the existing
      `tests/support/` convention (`fakeModelContext.ts`, `agentPage.ts`).
- [X] T007 [P] Confirm `tests/unit/**/*.test.ts` runs in the **`node`** Vitest project with no DOM, and
      that `import { descriptors } from '@/tools/registry'` resolves there — the property
      `tests/unit/tools.surface.test.ts` already depends on, and the one that makes T016 possible.

**Checkpoint**: tests can read the skill and the live registry. Story work can begin.

---

## Phase 3: User Story 1 — One Call and the Board Is There (P1) 🎯 MVP

**Goal**: Invoking `$agentic-sudoku` opens the site in Codex's built-in browser with a playable board.

**Independent Test**: In a Codex session with nothing open, type `$agentic-sudoku`. The board appears,
with no address supplied and no further instruction. Invoke again — the in-progress puzzle survives.

### Tests (write first, watch fail) ⚠️

- [X] T008 [P] [US1] Write `tests/unit/skill.package.test.ts`: `.agents/skills/agentic-sudoku/SKILL.md`
      exists; the YAML frontmatter parses; `name` and `description` are both present and non-empty;
      `name` equals the directory name `agentic-sudoku`; the skill body contains no path into this
      repository (FR-001–FR-004, [contracts/skill-package.md](./contracts/skill-package.md)).
- [X] T009 [P] [US1] Write `tests/unit/skill.address.test.ts`: the address string occurs **exactly
      once** across the whole skill directory, and **zero times** in `README.md` — so the two cannot
      drift (FR-007a, FR-007b, SC-013).
- [X] T010 [US1] Run both. They must **fail** — no `SKILL.md` exists yet. A test that passes on its
      first run is testing nothing.

### Implementation

- [X] T011 [US1] Create `.agents/skills/agentic-sudoku/SKILL.md` with the frontmatter from
      [contracts/skill-package.md](./contracts/skill-package.md): `name: agentic-sudoku` and a
      `description` that front-loads the trigger words and states when the skill should **not** fire.
      Codex matches on this field and may truncate it, so density matters more than prose.
- [X] T012 [US1] Write **instruction 1** into the body: open the site at `http://localhost:3000` in the
      built-in browser; reuse an already-open board rather than opening a second one; require nothing
      from the person beyond invoking the skill; if the site cannot be reached, say so, say what would
      make it reachable, and stop rather than proceeding as though a board were present (FR-006–FR-010).
- [X] T013 [P] [US1] Create `.agents/skills/agentic-sudoku/agents/openai.yaml` with
      `display_name: "Agentic Sudoku"` — the human-readable name the request asked for, while `name`
      stays a slug for `$` invocation — plus `short_description` and
      `policy.allow_implicit_invocation: true`.
- [ ] T014 [US1] Run T008 and T009. Both pass. Then install and try it for real:
      `mkdir -p ~/.agents/skills && cp -R .agents/skills/agentic-sudoku ~/.agents/skills/` (the mkdir is
      required -- the directory does not exist until a skill is installed), and invoke `$agentic-sudoku` in a Codex
      session (quickstart Part 2, Step 1).

**Checkpoint**: **a shippable skill.** One call and the board is on screen. It does nothing else, and
that is a complete increment.

---

## Phase 4: User Story 2 — The Agent Tells Me What It Can Do (P2)

**Goal**: The agent reads the tool surface from the live page and reports every tool with a short
description — **discovered, never recited**.

**Independent Test**: On a loaded board, the agent lists the tools it found. The list matches what the
page publishes exactly. Ask *"where did that list come from?"* — it must say it read it from the page.

### Tests (write first, watch fail) ⚠️

- [X] T015 [P] [US2] Write `tests/unit/skill.no-tool-copy.test.ts`: import `descriptors` from
      `@/tools/registry` and assert that **no descriptor `name` appears anywhere in the skill
      directory** (FR-014, SC-011). Import the live array rather than transcribing sixteen names — a
      transcription is itself a copy, and importing means a seventeenth tool is covered the day it is
      registered, with no test edit. This is the same move `palette.contrast.test.ts` makes on
      `globals.css`.
- [X] T016 [US2] Run it against the US1 skill. It must **pass** — nothing has been added yet. Then
      **prove it bites**: append a real tool name to `SKILL.md`, re-run, watch it **fail**, remove the
      line. This is the single most important test in the feature and a green run proves nothing until
      you have seen it go red.

### Implementation

- [X] T017 [US2] Append **instruction 2** to `SKILL.md`: enumerate the tools the page publishes; report
      each with a short description drawn from what the page published; mark which observe the board
      and which change it; re-read after a reload, after reconnecting, or whenever asked again
      (FR-011–FR-013, FR-015, FR-017, FR-018).
- [X] T018 [US2] Add the version clause, worded **generically** — *"if the page or any
      observation-only result declares a version for its tool surface, report it"*. This site declares
      `surface_version` in tool *results*, not in the descriptor listing, so naming which call to make
      would put a tool name in the skill and breach FR-014. Report it *if available*; never make it a
      precondition, because [R2](./research.md#r2--does-codexs-in-app-browser-actually-support-webmcp)
      says every invocation gets a safety review and a read-only introduction should not prompt the
      person (FR-016, [R6](./research.md#r6--how-does-the-agent-report-the-surface-without-the-skill-containing-a-copy-of-it)).
- [ ] T019 [US2] Run T015 — still passing with instruction 2 present. Then verify against the truth:
      `npx vitest run --project node tools.surface`, and check the agent's live report lists all
      sixteen with observers distinguished from changers (quickstart Step 2).
- [ ] T020 [US2] **Verify SC-003, and it is cheap.** Temporarily reword one tool's `description` in
      `src/tools/tools/`, rebuild, reload, invoke again. The agent's report must reflect the change
      **with no edit to the skill**. Revert. This is the proof that FR-014 bought something real.

**Checkpoint**: the agent reports a surface it discovered. The skill still contains no tool name.

---

## Phase 5: User Story 3 — Everything It Does, It Does Through the Tools (P3)

**Goal**: The agent acts on the board only by invoking published tools, and refuses plainly when no
tool covers a request.

**Independent Test**: Across a session — a hint, a fill, the ruler, a difficulty change, a pause and a
resume — every board change arrived through a tool. A request no tool covers produced a refusal, not a
workaround.

### Tests (write first, watch fail) ⚠️

- [X] T021 [P] [US3] Write `tests/unit/skill.content-free.test.ts`: import `TECHNIQUES` from
      `@/engine/techniques` and assert **no technique id appears in the skill directory**; assert the
      skill contains no Sudoku strategy vocabulary and no coaching guidance (FR-027, FR-029, SC-011).
      Asserted against the Engine registry for the same reason as T015 — the source of truth owns the
      list.
- [X] T022 [US3] Run it. It must pass on the current skill, then **prove it bites** by appending a
      technique name and watching it fail.

### Implementation

- [X] T023 [US3] Append **instruction 3** to `SKILL.md`: every change to the board is made by invoking
      a published tool. Name the closed routes explicitly — no clicking cells, no typing, no operating
      the site's own on-screen controls, no scripting or evaluating JavaScript in the page, no
      screenshotting or scraping to read the board, no reading this project's source or stored data to
      decide a move (FR-019–FR-021, [contracts/session-behaviour.md](./contracts/session-behaviour.md)).
      **The site cannot enforce any of this** — it can refuse a silent change, but it cannot stop an
      agent clicking. These routes are closed here or not at all.
- [X] T024 [US3] Append **instruction 4**: when no published tool covers a request, say so and name
      what can be done instead; when a tool rejects a call, relay the reason and correct rather than
      repeating it or routing around it; when the host publishes no tools at all, report the surface
      is unavailable and **never** substitute direct operation of the page (FR-022, FR-023, FR-026).
- [X] T025 [US3] Add the non-erosion clause (FR-024, FR-025): the skill must not instruct the agent to
      shorten explanations, skip the confirmation before a board is replaced, or work around the
      paused-board refusal. **This is the one way this feature could quietly damage the product** —
      protections two features were built to provide — so it is forbidden in writing rather than left
      to good sense.
- [X] T026 [US3] Run the full unit suite. All four skill tests green, existing 1183 unaffected.
- [ ] T027 [US3] Live-verify the tools-only constraint and the refusals (quickstart Steps 4 and 5),
      including: your selection does not move when the agent fills elsewhere; the agent's spotlight
      appears while your crosshair stays put; one Undo reverses an agent digit; and the three
      uncovered requests — *erase*, *undo*, *is this correct?* — each produce a refusal.

**Checkpoint**: the skill is complete at four instructions and one address.

---

## Phase 6: User Story 4 — Someone Else Can Install It (P4)

**Goal**: A person who has never seen this repository installs the skill from the README and runs it.

**Independent Test**: Hand the README to someone with Codex and no knowledge of this project. They
install and invoke it from the written steps alone, without asking a question.

### Tests (write first, watch fail) ⚠️

- [X] T028 [P] [US4] Extend `tests/unit/skill.address.test.ts` (T009) to assert the README contains an
      installation section referencing `.agents/skills` and the explicit `$agentic-sudoku` invocation —
      and still contains the address **zero** times (FR-030, FR-007b).

### Implementation

- [X] T029 [US4] Add the installation section to `README.md`. **Global install
      (`$HOME/.agents/skills/`) is the primary instruction**, not the fallback:
      [openai/codex#16012](https://github.com/openai/codex/issues/16012) reports repo-local
      `.agents/skills` skills not reaching a fresh session's listing
      ([R4](./research.md#r4--how-is-it-installed-by-someone-who-has-not-cloned-the-repository)).
      Document the symlink variant for repo holders, and **document `$agentic-sudoku` as the way to
      run it** — explicit invocation works whether or not implicit listing does.
- [X] T030 [US4] Document every prerequisite in that section (FR-031, FR-033): the site must be
      reachable; **GPT-5.6 Sol or Terra, not Luna**; latest desktop app; not Enterprise or Edu; Site
      tools enabled in browser permissions. State honestly that the skill cannot work where the host
      does not publish site tools, rather than presenting it as working everywhere.
- [X] T031 [US4] State what the skill does when invoked (FR-032), and **where the single address lives
      and what changes on deploy — as a location, not a restated value** (FR-007b), so the README
      cannot drift from the skill. T028 enforces this.
- [X] T032 [US4] Add a feature 004 row to the status tables in `README.md` and `CLAUDE.md` (FR-034).
- [ ] T033 [US4] Run T028. Then hand the README to someone who has not seen this repo and watch them
      install it without help (SC-007).

**Checkpoint**: all four stories complete. The feature is deliverable.

---

## Phase 7: Polish, Verification & Closing an Old Item

- [X] T034 [P] Run `npm test` — 1183 existing plus the four new files, all green.
- [X] T035 [P] Run `npm run lint` and `npm run typecheck` — both clean.
- [X] T036 [P] Run `npm run build && npm start` and confirm the static export is unaffected. The skill
      ships zero bytes to the browser; this proves it.
- [ ] T037 Confirm the commit history shows each phase's tests committed **before** its implementation
      (Principle V). 002's T131 was left open for exactly this; 003 closed it by example. Do the same.
- [X] T038 Re-run the negative checks from T016 and T022 one final time on the finished skill — append
      a tool name, watch red; append a technique id, watch red; revert both. **The guards must be
      proven on the artifact that ships**, not only on an intermediate draft.

### The live run — this is what the feature is for

- [ ] T039 Execute [quickstart.md](./quickstart.md) Part 2 end to end and record pass/fail per
      criterion in the results table below.
- [ ] T040 ⚠️ **SC-006 — the run that closes `002/SC-001`.** Say only *"What should I do next?"* — no
      technique names, no hints, no explanation of the site. The agent must read the board, identify a
      valid next move, and explain it, from the tool descriptions alone. **This criterion has been open
      since feature 002 and was widened from eleven tools to sixteen by feature 003.**
- [ ] T041 If T040 fails, record **which tool description was inadequate**. FR-028 is explicit: the fix
      belongs in `src/tools/tools/*.ts`, **not** in the skill. A failure here is a real finding worth
      more than a pass — adding guidance to the skill to paper over it would destroy the measurement
      and is forbidden.
- [ ] T042 Record the answer to [R5](./research.md#r5--will-the-built-in-browser-load-httplocalhost3000)
      from T001 in the Results section below. It is the fact this feature most needs written down.

### Closing the old items

- [ ] T043 Update `specs/002-webmcp-agent-tutor/tasks.md` T126 and
      `specs/003-agent-board-controls/tasks.md` T097 with the outcome of T040 — closed, or open with a
      named reason. **Do not close them on the basis of the skill existing.** They close on the basis
      of a run.
- [X] T044 [P] Update the Open Items section of `CLAUDE.md`: SC-001's status, and the fact that Codex's
      built-in browser is now a confirmed WebMCP host.
- [ ] T045 Record any tool-surface gaps the live run exposed — the absent erase and undo tools are
      already predicted by [contracts/session-behaviour.md](./contracts/session-behaviour.md). **These
      are findings, not this feature's work**: a seventeenth tool is scoped out. Note them for a future
      feature.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies. **T001 first** — it can invalidate the address before anything
  is built.
- **Foundational (Phase 2)**: depends on Setup. Blocks every story.
- **US1 (Phase 3)**: depends on Phase 2.
- **US2 (Phase 4)**: depends on **US1** — it appends to the file US1 creates.
- **US3 (Phase 5)**: depends on **US2**.
- **US4 (Phase 6)**: depends on US1 at minimum; write it after US3 so the README describes the finished
  skill.
- **Polish (Phase 7)**: depends on everything.

### Story independence — the honest version

| Story | Independently deliverable? | Independently *developable*? |
|---|---|---|
| US1 | **Yes** — a skill that only opens the board is real and useful | Yes |
| US2 | Yes, as an increment | **No** — appends to US1's file |
| US3 | Yes, as an increment | **No** — appends to US2's file |
| US4 | Yes — README only | Yes, once US1 exists |

**This differs from features 001–003, where stories owned disjoint modules and could be built
simultaneously.** Here there is one artifact and one editor. Splitting this across people by story
produces merge conflicts in a 60-line markdown file, which is worse than doing it in order.

### Parallel opportunities

Real, but small — and confined to test files, which are separate:

- Setup: T004, T005
- US1 tests: T008, T009
- Across stories, if one person runs ahead: T015 and T021 are different files from T008/T009 and could
  all be written up front
- Polish: T034, T035, T036, T044

**Never parallel**: T011, T012, T017, T018, T023, T024, T025 — all edit `SKILL.md`.

### Within each story

Tests written and **failing** first, then the instruction that satisfies them. Commit the tests, then
the implementation, per phase.

---

## Parallel Example: the four test files

```bash
# All four guards, written together, before any skill exists — all failing:
Task: "tests/unit/skill.package.test.ts"        # T008
Task: "tests/unit/skill.address.test.ts"        # T009
Task: "tests/unit/skill.no-tool-copy.test.ts"   # T015
Task: "tests/unit/skill.content-free.test.ts"   # T021
```

That is the whole parallel surface of this feature. Everything after it is one file, in order.

---

## Implementation Strategy

### MVP: User Story 1 only

1. Phase 1 (Setup) — **T001 answers the open risk before you build anything**
2. Phase 2 (Foundational)
3. Phase 3 (US1)
4. **Stop and invoke it in a real Codex session.** Not "run the tests" — invoke it.
5. You have a skill that opens the board in one call. That is worth shipping on its own.

### Incremental delivery

| After | The skill can | Instructions |
|---|---|---|
| US1 | Open the board in one call | 1 |
| US2 | Also report the tool surface it discovered | 2 |
| US3 | Also act only through that surface, and refuse honestly | 4 |
| US4 | Also be installed by someone else | 4 + README |

### Notes

- `[P]` = different files, no dependencies
- **Verify tests fail before implementing**, and for T015 and T021 verify they fail *for the right
  reason* by deliberately breaking the skill
- **The artifact is read by an agent, not rendered.** This repo's "look at the page, don't just run
  the tests" rule becomes **"run it against a real agent and read what comes back"** — which is T039
  and T040, and they are not optional
- Commit after each phase, tests first

---

## What is built, and what is left

**Built and verified automatically (31 tasks)**: the skill package, all four guard tests, the README
install section, the status tables. `npm test` is green at **1206**, lint and typecheck are clean, and
the production build is unaffected — the skill ships zero bytes to the browser.

**Left (14 tasks), and every one of them needs a live Codex session** — which is
[Deviation 1](./plan.md#complexity-tracking), not an oversight:

| Task | What it needs from you |
|---|---|
| T001, T002 | Open the board in Codex's browser by hand; confirm **Site tools** appears and the prerequisites hold |
| T014, T019, T027, T033 | The live half of each story's verification (the automated half is done and green) |
| T020 | Reword one tool description, rebuild, confirm the agent's report changes with **no skill edit** (SC-003) |
| T037 | Commit the tests before the implementation, per phase, so Principle V's order is visible in history |
| T039–T042 | The scripted run in [quickstart.md](./quickstart.md), including **T040 — the SC-006 measurement** |
| T043 | Close or re-scope `002/T126` and `003/T097` **on the basis of the run**, never on the basis of the skill existing |
| T045 | Record the tool-surface gaps the run exposes |

### Known limitation: FR-003 is only partly met, and not by anything this feature can fix

FR-003 requires the skill to be "installable and usable by a person who has this repository neither
cloned nor open". **The skill itself satisfies that** — two text files, no scripts, no dependencies,
no path into this repo, all asserted by `tests/unit/skill.package.test.ts`. What is missing is
somewhere to *get* them from: **this repository has no git remote, and the site is not deployed.**

So a stranger today can neither fetch the skill nor reach a board to point it at. Both unblock on the
same two actions, neither of them this feature's work:

1. **Publish the repository** → the skill becomes a clone-or-`curl` away.
2. **Deploy the site** → the `Site address:` line changes once (FR-007a, SC-013) and the skill points
   somewhere a stranger can actually reach.

Recorded here rather than quietly satisfied by an install command that would only work for someone
who already has the files.

---

## Results

*Fill this in as the live run happens. It is the record the next person needs.*

### R5 — does the built-in browser load `http://localhost:3000`? (T001, T042)

- **Answer**: _not yet run_
- **Site tools visible in the address bar**: _not yet run_
- **If no**: model checked (Sol/Terra, not Luna)? permission enabled? → otherwise deploy to Vercel and
  repoint the single address line

### Live run (T039, T040)

| Criterion | What it checks | Result |
|---|---|---|
| SC-001 | Board on screen in under 30 s, one call | _not yet run_ |
| SC-002 | Reported tools match the published surface exactly | _not yet run_ |
| SC-003 | A reworded description shows up with no skill edit | _not yet run_ |
| SC-004 | 100% of board changes went through a tool | _not yet run_ |
| SC-005 | Uncovered requests refused, never worked around | _not yet run_ |
| **SC-006** | **`002/SC-001` — valid next move explained, no site-specific instructions** | _not yet run_ |
| SC-007 | Newcomer installs from the README alone, under 5 min | _not yet run_ |
| SC-008 | Absent surface reported, never simulated | _not yet run_ |
| SC-010 | Selection and focus never moved | _not yet run_ |
| SC-012 | Second invocation preserves the puzzle | _not yet run_ |

### Findings for future features

- _Tool-surface gaps observed during the run — e.g. no erase tool, no undo tool_
- _Tool descriptions that proved inadequate (these belong in `src/tools/tools/`, per FR-028)_
