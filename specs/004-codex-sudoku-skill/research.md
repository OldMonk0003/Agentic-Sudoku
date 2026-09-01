# Phase 0 Research: Agentic Sudoku Codex Skill

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-01

Seven questions had to be answered before this feature could be planned. Six are now resolved from
primary sources; the seventh is an empirical unknown that no amount of further reading will settle,
and it is recorded as such with the experiment that settles it.

**The discipline applied here is the project's own.** `CLAUDE.md` says of WebMCP: *"do not recall it,
look it up — most secondary sources describe a different API from the one this code targets, and
getting it from memory will produce something that looks right and is wrong."* That warning earned
its keep again in R1 below: the skill discovery path is **not** where recall says it is.

---

## R1 — What is a Codex skill, exactly?

**Decision**: A skill is a directory containing a `SKILL.md` file with YAML frontmatter carrying
`name` and `description`, plus optional bundled resources. Codex discovers it by scanning
**`.agents/skills`**, not `.codex/skills`.

```
my-skill/
├── SKILL.md                 (required)
├── scripts/                 (optional)
├── references/              (optional)
├── assets/                  (optional)
└── agents/openai.yaml       (optional)
```

`SKILL.md`, verbatim from the documentation:

```md
---
name: skill-name
description: Explain exactly when this skill should and should not trigger.
---

Skill instructions for ChatGPT or Codex to follow.
```

Discovery locations, in precedence order:

| Scope | Path |
|---|---|
| REPO | `$CWD/.agents/skills` |
| REPO | `$CWD/../.agents/skills` (upward to the repo root) |
| REPO | `$REPO_ROOT/.agents/skills` |
| USER | `$HOME/.agents/skills` |
| ADMIN | `/etc/codex/skills` |
| SYSTEM | bundled with Codex |

Symlinked skill folders are supported and followed.

**Invocation**: explicitly as `$skill-name`, or implicitly when the `description` matches the user's
prompt. Codex loads only each skill's `name` and `description` up front — capped at 2% of the context
window or 8,000 characters — and reads the full `SKILL.md` only once it selects the skill.

**Rationale**: taken from OpenAI's own documentation rather than from memory.

**THE TRAP THIS AVOIDED, NAMED SO IT IS NOT WALKED INTO AGAIN**: recall says `~/.codex/skills`. The
documentation says `$HOME/.agents/skills` and `$REPO_ROOT/.agents/skills`. A skill placed at the
recalled path would be silently invisible — no error, no warning, just a skill that never triggers.
This is the identical failure mode `CLAUDE.md` records for `navigator.modelContext` versus
`document.modelContext`, and it was one search away from being repeated.

**Alternatives considered**: `~/.codex/skills` (wrong — that path appears in secondary write-ups and
for Codex's own bundled `.system` skills, not for user skills); an `AGENTS.md` entry (rejected — not
invocable by name, and it would load into every session rather than on request).

**Sources**: [Build skills](https://learn.chatgpt.com/docs/build-skills.md) ·
[openai/codex docs](https://github.com/openai/codex/blob/main/docs/skills.md)

---

## R2 — Does Codex's in-app browser actually support WebMCP?

**Decision**: **Yes**, and it reads `document.modelContext.registerTool()` — precisely the API this
project targets and the constitution mandates.

The documentation's own feature-detection example is
`if (typeof document.modelContext?.registerTool === 'function')`, which is the same shape
`registry.ts` already uses in `hostOrNull()`. Registered tools appear to the user under **Site tools**
in the browser's address bar, and the agent discovers them on visiting the page.

**Why this is the most consequential finding in the feature.** The spec recorded, as an unresolved
risk, that *"Codex's in-app browser may not publish this standard at all"* — and made SC-006
contingent on it. That risk is now closed. The sixteen tools this project has built and never tested
against a live agent are, on paper, callable by exactly the host the author asked for.

**Constraints this brings with it**, all of which become README prerequisites (FR-031, FR-033):

| Constraint | Consequence |
|---|---|
| "Use GPT-5.6 Sol or GPT-5.6 Terra for site tools. GPT-5.6 Luna currently has WebMCP disabled." | The README must name the models; on Luna the skill reports an unavailable surface and is correct to. |
| "Site tools aren't available in Enterprise or Edu workspaces." | A whole class of user cannot run this, through no fault of the skill. |
| "Update the ChatGPT desktop app to the latest version." | Version floor. |
| Users can disable site tools under Settings → Browser → Permissions | An absent surface may be a *setting*, not a defect — the skill's failure message should not assert a cause it cannot know. |
| "In the built-in browser, each tool invocation receives a safety review before it runs." | Every tool call may be gated. See R6. |

**Sources**: [Site tools](https://learn.chatgpt.com/docs/webmcp) ·
[OpenAI Developer Community](https://community.openai.com/t/build-agent-ready-websites-with-chatgpt/1392588)

---

## R3 — Where does the skill live in this repository?

**Decision**: `.agents/skills/agentic-sudoku/` — a folder at the repository root, and simultaneously
the only location Codex will discover automatically.

**Rationale**: the author asked for "a folder in root of repository". Two readings were available and
only one of them works:

- A plainly named folder such as `codex-skill/` at the root is visible and obvious — **and Codex will
  never find it.** It would require a copy step even for someone working inside this very repository,
  while looking exactly like something that ought to work. A skill that is invisible without an
  undocumented step is worse than one in a dotfolder.
- `.agents/skills/agentic-sudoku/` puts `.agents/` at the repository root, satisfies the request, and
  is on the documented discovery path — so anyone running Codex in this repo has the skill available
  with no installation at all.

**This is an interpretation of the request, and it is flagged for objection.** If "a folder in root"
meant specifically a non-hidden folder, the resolution is a visible folder plus a symlink from
`.agents/skills/` — symlinks are explicitly supported (R1) — at the cost of one more moving part.

**Alternatives considered**: `src/` (rejected — the skill is not application code, and the layer lint
would have no opinion on it, which is itself a sign it does not belong there); `specs/004-.../`
(rejected — spec artifacts describe work, they are not the deliverable).

---

## R4 — How is it installed by someone who has not cloned the repository?

**Decision**: copy or symlink the skill directory into `$HOME/.agents/skills/`. The README documents
the symlink form first for anyone who does have the repo, because it keeps the installed copy current
as the repo changes, and the copy form for anyone who does not.

**A known defect makes the global install the primary instruction, not the fallback.**
[openai/codex#16012](https://github.com/openai/codex/issues/16012) reports repo-local
`.agents/skills` skills not being injected into a fresh session's available-skills list, despite the
documentation saying they are discovered. Two mitigations, both cheap:

1. The README's primary path is the **global** install (`$HOME/.agents/skills`), which is unaffected.
2. **Explicit `$agentic-sudoku` invocation works regardless of whether the skill made it into the
   implicit listing** — so the documented way to run it is the explicit way.

Recording this now costs a sentence. Discovering it during a demo costs the demo.

---

## R5 — Will the built-in browser load `http://localhost:3000`?

**Decision**: **Unresolved, and unresolvable by reading.** Recorded as the feature's one open risk,
with the experiment that settles it and the fallback that survives it.

What is known: `localhost` is a secure context by W3C definition, so the `[SecureContext]` gate on
`document.modelContext` should not bar it. What is *not* documented anywhere: whether the ChatGPT
desktop app's built-in browser permits navigation to a local development server at all.

**This is an empirical question, not a research question.** Five minutes with the app answers it, and
no further reading will. The plan therefore schedules it as the **first task after the skill exists**,
not as a design assumption.

**The fallback is already the author's plan**: deploy to Vercel and repoint the skill. That is why
FR-007a insists the address live in exactly one place and SC-013 measures it — the edit is known in
advance, and the only way it goes wrong is a second copy nobody remembers.

**Alternatives considered**: pre-emptively deploying to Vercel to avoid the question (rejected — the
author scoped deployment out, and it may well be unnecessary); shipping both addresses with a fallback
(rejected — two addresses is exactly the drift FR-007a exists to prevent).

---

## R6 — How does the agent report the surface without the skill containing a copy of it?

**Decision**: the skill instructs the agent to enumerate the site tools the page publishes and report
each one's name, a short description drawn from what the page published, and whether it observes or
changes the board. The skill names no tool.

**This is harder than it sounds, and one instruction had to be written carefully.** FR-016 asks for
the surface's declared version. This project declares `surface_version` in every **tool result**, not
in the descriptor listing — so obtaining it means making a call. But naming *which* call would put a
tool name in the skill and breach FR-014.

**Resolution**: the instruction is written generically — *"if the page or any observation-only result
declares a version for its tool surface, report it"* — which is satisfiable from the surface alone,
by an agent that has read the descriptions, without the skill knowing a single tool name.

**What makes this work at all is a property the site already has.** `registry.ts` registers each tool
with `annotations: { readOnlyHint: descriptor.readOnly }`, so "which observe versus which change"
(FR-015) is readable straight from the surface. The skill asks for something the site already
publishes; it does not ask the agent to infer it.

**The safety review from R2 lands here.** If every tool invocation is gated by a review, an agent that
must call a tool to learn the surface version may prompt the user during what should be a read-only
introduction. The skill therefore treats the version as *reported if available*, never as a
precondition for the rest of the session.

---

## R7 — How is a markdown file tested, under a NON-NEGOTIABLE test-first principle?

**Decision**: the skill's checkable properties are asserted in the existing `node` Vitest project,
**against the live tool registry** rather than against a transcribed list. The end-to-end session is a
scripted manual verification, recorded as a deviation rather than waved through.

The insight that makes this work: **`descriptors` in `registry.ts` is enumerable with no DOM
mounted** — that is Principle I's requirement and `tests/unit/tools.surface.test.ts` already relies on
it. So a test can import the real sixteen descriptors and assert things about a markdown file:

| Requirement | Test |
|---|---|
| FR-014, SC-011 — no capability names or descriptions in the skill | Import `descriptors`; assert **no** descriptor `name` appears anywhere in the skill directory. Grows automatically with the surface. |
| FR-027/029, SC-011 — no solving content | Import `TECHNIQUES` from the Engine; assert no technique id appears in the skill. |
| FR-007a, SC-013 — one address, one place | Assert the address string occurs exactly once across the skill directory. |
| FR-001, R1 — a valid skill | Assert `SKILL.md` exists, frontmatter parses, `name` and `description` are present, and `name` matches the directory. |
| FR-030–034 — documentation | Assert the README carries an install section and that the address is **not** duplicated there. |

**Why this is a genuinely good test and not a box-tick**: the FR-014 test fails the instant someone
pastes the tool list into the skill "to make it more helpful" — which is the exact, well-intentioned
regression that would quietly destroy this feature's reason to exist. It is the same trick
`palette.contrast.test.ts` plays on `globals.css`: assert a property of a data file against the code
that owns the truth.

**What cannot be automated**: SC-001, SC-004, SC-006, SC-008 all require a live Codex session against
a third-party host. That is [Deviation 1](./plan.md#complexity-tracking).

**Alternatives considered**: a snapshot test of `SKILL.md` (rejected — pins the text without asserting
any property, and would pass with the tool list pasted in); no tests at all on the grounds that
markdown is not code (rejected — Principle V says *no module is exempt*, and the properties that
matter here are mechanically checkable, so exemption would be laziness rather than pragmatism).

---

## Summary of decisions

| # | Question | Decision |
|---|---|---|
| R1 | Skill format | `.agents/skills/<name>/SKILL.md` + YAML frontmatter. **Not** `.codex/skills`. |
| R2 | Codex + WebMCP | Supported, `document.modelContext`. **The spec's biggest recorded risk is closed.** |
| R3 | Location in repo | `.agents/skills/agentic-sudoku/` — root folder *and* discovery path. Interpretation flagged. |
| R4 | Installation | Global `$HOME/.agents/skills` primary, symlink for repo holders, explicit `$` invocation documented. |
| R5 | localhost | **Open.** Empirical, answered in five minutes, fallback is the planned Vercel deploy. |
| R6 | Reporting without a copy | Generic instruction; `readOnlyHint` already published; version reported if available. |
| R7 | Testing | Properties asserted against the live registry in the `node` project; session verified manually. |

## Sources

- [Build skills — ChatGPT Learn](https://learn.chatgpt.com/docs/build-skills.md)
- [Site tools (WebMCP) — ChatGPT Learn](https://learn.chatgpt.com/docs/webmcp)
- [openai/codex — docs/skills.md](https://github.com/openai/codex/blob/main/docs/skills.md)
- [openai/codex#16012 — repo-local `.agents/skills` not injected](https://github.com/openai/codex/issues/16012)
- [Build Agent Ready Websites with ChatGPT — OpenAI Developer Community](https://community.openai.com/t/build-agent-ready-websites-with-chatgpt/1392588)
