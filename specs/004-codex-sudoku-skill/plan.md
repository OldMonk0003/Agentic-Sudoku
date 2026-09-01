# Implementation Plan: Agentic Sudoku Codex Skill

**Branch**: `004-codex-sudoku-skill` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-codex-sudoku-skill/spec.md`

**Builds on**: features 001, 002, and 003 — all complete, all on `002-webmcp-agent-tutor`. **This
branch should be cut from `002-webmcp-agent-tutor`, not from `main`**: `main` is still at `a5ad72f`
and has no agent surface for this skill to consume.

## Summary

A Codex skill is added at `.agents/skills/agentic-sudoku/`. Invoking it opens the site in Codex's
built-in browser, has the agent enumerate the tool surface the page publishes, and constrains the
agent to act on the board only through that surface. The README gains an installation section.

**No application code changes. No new tool. No new dependency. Nothing new ships to the browser.**
The deliverable is one markdown file, one small metadata file, a README section, and a test suite that
guards the markdown against the one way it can go wrong.

Four findings from [research](./research.md) shape the whole plan, and two of them changed the design:

1. **Codex's built-in browser supports WebMCP through `document.modelContext`** — the exact API this
   project targets ([R2](./research.md#r2--does-codexs-in-app-browser-actually-support-webmcp)). The
   spec recorded "the host may not publish this standard at all" as its central unresolved risk.
   **That risk is closed**, and with it the path to finally measuring `002/SC-001`, open since feature
   002 and widened to sixteen tools by feature 003.
2. **Skills are discovered at `.agents/skills`, not `.codex/skills`**
   ([R1](./research.md#r1--what-is-a-codex-skill-exactly)). Recall says otherwise, and a skill at the
   recalled path fails silently — no error, just a skill that never triggers. This is the same trap
   `CLAUDE.md` records for `navigator.modelContext` versus `document.modelContext`, and it was one
   search away from being repeated.
3. **The skill must contain no tool name and no tool description** (FR-014) — and this is mechanically
   testable against the live registry, because `descriptors` is enumerable with no DOM mounted
   ([R7](./research.md#r7--how-is-a-markdown-file-tested-under-a-non-negotiable-test-first-principle)).
   The test fails the instant someone pastes the tool list in to be helpful, which is the exact
   well-meaning regression that would destroy the feature's reason to exist.
4. **Whether the built-in browser can load `http://localhost:3000` is unknown and undocumented**
   ([R5](./research.md#r5--will-the-built-in-browser-load-httplocalhost3000)). It is an empirical
   question worth five minutes, not a design question, so it is scheduled as the first task after the
   skill exists rather than assumed either way.

## Technical Context

**Language/Version**: Markdown with YAML frontmatter for the deliverable. TypeScript 5.9 `strict` for
the tests, which are the only code this feature adds.

**Primary Dependencies**: **None added.** The site's stack is untouched — Next.js 16, React 19,
Tailwind 4, Lucide, `sudoku-gen`. Principle IV's "re-validate budgets whenever a runtime dependency is
added" trigger is **not tripped**, because nothing this feature produces reaches the browser.

**Storage**: None. The skill is stateless; it holds no session, no progress, no preference. The site's
two storage keys are untouched.

**Testing**: Vitest, `node` project (`tests/unit/**`, no DOM). Four new test files, all asserting
properties of the skill directory against the live registry and Engine. **No new test tooling, no new
Vitest project, no Playwright involvement** — the skill never renders.

**Target Platform**: Codex with its built-in browser, on GPT-5.6 Sol or Terra. Not Luna (WebMCP
disabled), not Enterprise or Edu workspaces ([R2](./research.md#r2--does-codexs-in-app-browser-actually-support-webmcp)).

**Project Type**: Agent skill package — an instruction bundle consumed by an agent host. **The first
artifact in this repository whose reader is an agent rather than a browser**, which is why it has no
layer in the architecture and no pixels to look at.

**Performance Goals**: None applicable to the skill itself. The tool-call budgets of Principle IV
already govern the surface it consumes; this feature adds nothing to any call path. SC-001's 30 s and
SC-009's "few seconds" are properties of the site and the host, both already measured or out of our
control.

**Constraints**: The skill contains zero tool names, zero tool descriptions, zero solving content, and
exactly one copy of the address. No network request is added to the site. Nothing about the board, the
palette, the rules, or the surface changes.

**Scale/Scope**: One skill directory (2 files), one README section, 4 test files, ~0 lines of
application code.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — result unchanged.*

| Principle | Requirement | Initial | Post-design |
|---|---|---|---|
| **I. WebMCP standard compliance** | Capability exposed only through `document.modelContext`; surface self-describing and enumerable headlessly | **PASS, and reinforced** | **PASS.** This feature registers nothing and shadows nothing. FR-014 forbids the skill from restating the surface, which makes it an *active defence* of Principle I's self-description mandate rather than merely compliant with it: if a run fails because a description was inadequate, the defect surfaces where it belongs — in the site. |
| **II. Zero-backend, client-side only** | No runtime network request; no telemetry; static deployable | **PASS** | **PASS.** The skill adds no request to the application. The agent's browser loading the page is a page load, not a runtime call home. No data leaves the device that the connected agent was not already given by a tool result (002/FR-059). |
| **III. Modular architecture** | Engine ← State ← Tools/View; single responsibility; no dumping grounds | **PASS** | **PASS.** No source layer is touched. The skill sits outside `src/` entirely, so the import-direction lint has no opinion on it — correctly, because it is not application code. Tests import from the Tools layer's public entry point (`@/tools/registry`), which is the permitted direction. |
| **IV. Puzzle integrity & performance budgets** | Unique solutions; derived difficulty; ≤ 100 ms tool calls; ≤ 250 KB bundle | **PASS** | **PASS, trivially and worth stating.** Zero puzzle code touched. Zero bytes added to the bundle — the skill is never served to a browser. Zero runtime dependencies added, so the budget re-validation trigger does not fire. |
| **V. Test-first & non-blocking feedback** | Failing tests first, no module exempt; nothing verifiable only by manual clicking | **AT RISK** — the end-to-end behaviour depends on a third-party host we do not control | **PASS with one deviation recorded.** Every mechanically checkable property is tested headlessly and written first. The live-session criteria cannot be, and that is [Deviation 1](#complexity-tracking) rather than a quiet omission. |

**Solution quarantine**: strengthened, not merely preserved. FR-021 forbids the agent from consulting
the project's source or stored data to decide a move — closing a route the site's own architecture
could not close, because the site cannot govern what an agent reads outside the page.

**Security posture**: the skill introduces no input surface, no `eval`, no remote script. It is inert
text. The one security-adjacent property is FR-025: the skill must not instruct the agent to work
around the site's own protections — the narration requirement, the confirmation gate, the paused-board
refusal. A skill that said "skip the confirmation" would be the only way this feature could weaken the
product, and it is forbidden explicitly rather than left to good sense.

**Accessibility**: not applicable to the artifact — it renders nothing. The site's own accessibility is
untouched, and FR-024 preserves the learner's uninterrupted control, which is the property an agent
could otherwise erode.

**Definition of Done**: items 1–4 and 7–9 apply and are planned. Item 5 (performance budgets) and item
6 (new tools documented) are **N/A by construction** — no runtime code, no new tools. Item 10 (puzzle
uniqueness) is unaffected; puzzles reaching a player still come from paths 001 and 003 built.

**Result: PASS on both evaluations, with one deviation recorded below.**

## Project Structure

### Documentation (this feature)

```text
specs/004-codex-sudoku-skill/
├── spec.md              # Phase -1
├── plan.md              # This file
├── research.md          # Phase 0 — seven questions, six answered, one scheduled
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 — including the live-agent script that closes 002/SC-001
├── contracts/
│   ├── skill-package.md     # What a valid skill directory is
│   └── session-behaviour.md # What the agent must and must not do in a session
└── checklists/
    └── requirements.md
```

### Source (repository root)

```text
.agents/skills/agentic-sudoku/      # NEW — the deliverable
├── SKILL.md                        # frontmatter + four instructions + one address
└── agents/
    └── openai.yaml                 # display name "Agentic Sudoku", invocation policy

tests/unit/                         # NEW — four files, node project, no DOM
├── skill.package.test.ts           # valid skill: layout, frontmatter, name/dir match
├── skill.no-tool-copy.test.ts      # FR-014 — asserted against the LIVE registry
├── skill.content-free.test.ts      # FR-027/029 — asserted against the Engine's techniques
└── skill.address.test.ts           # FR-007a — exactly one address, exactly one place

README.md                           # CHANGED — install section, status table row
```

**Structure Decision**: the skill lives at `.agents/skills/agentic-sudoku/` because that is
simultaneously "a folder in the root of the repository" as requested and the only path Codex actually
scans ([R3](./research.md#r3--where-does-the-skill-live-in-this-repository)). **This is an
interpretation of the request and is flagged for objection**: a plainly named `codex-skill/` at the
root would be more visible and would never be found by Codex, which is the worse failure — it looks
like it should work. If a visible folder is wanted, the resolution is a visible folder plus a symlink
from `.agents/skills/`, which Codex explicitly supports, at the cost of one more moving part.

Nothing goes in `src/`. The skill is not application code, and the fact that the layer lint would have
no opinion on it is itself the evidence that it does not belong there.

## Phase 1 Design

### The skill's four instructions

`SKILL.md` says four things and nothing else. The count is the design: every additional sentence is a
sentence that could carry a run the site's own descriptions would not have carried, which is the
failure FR-028 exists to prevent.

| # | Instruction | Requirements |
|---|---|---|
| 1 | Open the site in the built-in browser, reusing an open board rather than duplicating it | FR-006, FR-008, FR-009, FR-010 |
| 2 | Enumerate the tool surface the page publishes; report every tool with a short description, marking which observe and which change | FR-011–FR-018 |
| 3 | Act on the board **only** by invoking a published tool — never clicking, typing, operating the site's controls, scripting the page, or reading the project's files | FR-019–FR-026 |
| 4 | Say plainly when the surface is unavailable or a request is uncovered; never substitute another route | FR-009, FR-022, FR-026 |

Plus one address, once ([R5](./research.md#r5--will-the-built-in-browser-load-httplocalhost3000),
FR-007a).

### The one property worth the most vigilance

**FR-014 — the skill contains no copy of the tool surface.** Everything else in this feature is
ordinary work. This is the part that decays.

A copy would be a second, unversioned statement of a contract the site already publishes. It would
drift on the first change to the site. Worse, it would let a run *succeed* that the site's own
descriptions could not have carried — masking the exact defect this feature exists to detect. The
temptation to add it is strong precisely because it would make the skill feel more useful.

So it is not defended by review. `skill.no-tool-copy.test.ts` imports the real `descriptors` array and
asserts that no descriptor `name` appears anywhere in the skill directory. It grows with the surface
automatically: a seventeenth tool is covered the day it is registered, with no test edit. This is the
same trick `palette.contrast.test.ts` plays on `globals.css` — assert a property of a data file
against the code that owns the truth.

### Test order (Principle V)

Tests first, watched fail, then the skill. Concretely: the four test files are written and run against
an absent `.agents/` directory, where they fail for the right reason (no skill), then `SKILL.md` is
written to satisfy them. Commit the tests, then the skill, so the ordering is visible in history —
which is what 002's T131 was left open for and what 003 closed by example.

### What cannot be tested, and how it is verified instead

SC-001, SC-004, SC-006, and SC-008 need a live Codex session against a host we do not control.
[quickstart.md](./quickstart.md) carries the script: exact steps, exact expected outcomes, and a place
to record what actually happened. **SC-006 is the one that matters** — it is `002/SC-001`, open since
feature 002, and this is the run that closes or refutes it.

## Complexity Tracking

One deviation. Recorded so a reviewer can object to it by name, which is what the constitution's
Violations rule asks for.

### Deviation 1 — the feature's headline outcome cannot be verified by an automated test

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Principle V — "Every module MUST be testable without a browser or with a headless DOM only. Code that can only be verified by manual clicking is not acceptable."** SC-001, SC-004, SC-006, and SC-008 are verifiable only by running a real Codex session against a real built-in browser. | The artifact's entire purpose is to be consumed by a third-party agent host. Nothing in this repository can stand in for Codex: a fake host would test our fake, which is precisely the gap this feature exists to close. `tests/support/fakeModelContext.ts` has driven all sixteen tools for two features and proved nothing about a real agent — that is the open item, not the solution. | **Simulating a Codex session** was rejected because it reproduces the exact failure being fixed, with more machinery. **Dropping the criteria** was rejected because SC-006 *is* the feature — closing `002/SC-001` is the reason to build this. **Deferring until a testable host exists** was rejected because a host now exists and works; waiting would leave a measurable claim unmeasured for no gain. |

**Scope: four success criteria, verification method only.** Every mechanically checkable property —
the skill's validity, the absence of a tool copy, the absence of solving content, the single address,
the README's completeness — **is** automated, headless, and written first. Nine of thirteen success
criteria are covered by the suite.

**What bounds it**: [quickstart.md](./quickstart.md) makes the manual run a *script* rather than an
exploration — numbered steps, stated expected outcomes, and a recorded result — so it is repeatable by
someone who did not write it, and so a failure is attributable to a step rather than to a vibe.

**The honest note**: this is the same category as `002/T126`, which has stood open across two
features. The difference is that there it was an omission; here it is the deliverable, scheduled, with
the host confirmed to support the standard. If the run fails, the finding is real and belongs to the
site's tool descriptions — which is exactly where FR-028 says a failure should point.
