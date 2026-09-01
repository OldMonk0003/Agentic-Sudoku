# Phase 1 Data Model: Agentic Sudoku Codex Skill

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-01

**This feature stores nothing and holds no runtime state.** There is no store, no schema version, no
persistence key, no entity that outlives a session. What follows are the four things the feature has
*shapes* for: a file layout, a thing read from the page, a thing that happens in a conversation, and a
section of documentation.

Recording them is still worth it, because three of the four carry constraints that tests assert.

---

## 1. Skill Package

The deliverable. A directory on disk, read by Codex at session start.

**Location**: `.agents/skills/agentic-sudoku/`

| Field | Where | Constraint |
|---|---|---|
| directory name | path | `agentic-sudoku` — must equal the frontmatter `name` |
| `name` | `SKILL.md` frontmatter | Required. Slug form. Matches the directory. Invoked as `$agentic-sudoku`. |
| `description` | `SKILL.md` frontmatter | Required. States when the skill should and should not trigger. Front-loads the trigger words, because implicit matching reads this and it may be truncated ([R1](./research.md#r1--what-is-a-codex-skill-exactly)). |
| body | `SKILL.md` after frontmatter | The four instructions and exactly one address. Nothing else. |
| `display_name` | `agents/openai.yaml` | `"Agentic Sudoku"` — the user-facing name the request asked for, while `name` stays a slug. |
| `allow_implicit_invocation` | `agents/openai.yaml` | `true`. The description is narrow enough to gate it, and the skill's whole point is that one call is enough. Flipping it to `false` is a one-line change if unprompted browser-opening proves annoying; explicit `$` invocation is unaffected either way. |

**Invariants, each asserted by a test:**

- **Contains no tool name and no tool description** (FR-014, SC-011). Asserted against the live
  `descriptors` array, so it covers a seventeenth tool the day one is registered.
- **Contains no Sudoku solving content** (FR-027, FR-029, SC-011). Asserted against the Engine's
  `TECHNIQUES` registry.
- **Contains the site address exactly once** (FR-007a, SC-013).
- **Is self-contained** (FR-002): no reference to a path elsewhere in this repository, so a copy of
  this directory alone is a working skill.

**Lifecycle**: created once, edited when the address changes (local → deployed). Nothing else in it is
expected to change, because everything that could change lives on the site instead. **That is the
design, not an accident**: a skill that needs editing when the site's tools change is a skill carrying
a copy of them.

---

## 2. Published Capability Surface

What the page advertises about itself, read fresh at the moment of invocation. **Owned by the site,
never by the skill, never cached across a reload** (FR-017).

| Property | Source | Used for |
|---|---|---|
| tool name | the page's registration | Reporting the list (FR-012, FR-013) |
| tool description | the page's registration | The short description in the report (FR-012, FR-018) |
| observes vs. changes | `readOnlyHint`, already registered by `registry.ts` | FR-015 — telling the person which requests will alter their puzzle |
| surface version | `surface_version`, carried in every tool result | FR-016 — reported *if available*, never a precondition ([R6](./research.md#r6--how-does-the-agent-report-the-surface-without-the-skill-containing-a-copy-of-it)) |

**The property that makes FR-015 free**: the site already registers `readOnlyHint` per tool. The skill
asks the agent to report something the page publishes; it does not ask it to infer anything.

**Read, never remembered.** The surface is re-read after a reload, after a disconnect and reconnect,
and whenever the person asks again what the agent can do. An earlier reading is not evidence about the
current page.

---

## 3. Session

One run, from invocation to the person stopping. Nothing about it is persisted.

**States it can be in:**

| State | Meaning | What the agent may do |
|---|---|---|
| `not-opened` | The site could not be reached | Report why; make no board-dependent claim (FR-009) |
| `open, surface-absent` | Board loaded; the host publishes no tools | Report the surface is unavailable. **Never** substitute direct page operation (FR-026) |
| `open, surface-read` | Board loaded; tools enumerated and reported | Act — only through published tools (FR-019, FR-020) |
| `surface-lost` | The person pressed Disconnect (002/FR-057) | Report tools are gone; do not fall back to clicking (US3 scenario 6) |

**Transitions worth naming:**

- `surface-read → surface-lost` is one-way within a session: the site's registry unregisters and does
  not re-register without a reload.
- Any state → `open, surface-read` on reload, because registration re-runs and the agent re-reads
  (FR-017). Agent annotations are discarded by the site on reload (002 edge cases), so an earlier view
  of the board is stale too.
- A second invocation of the skill **does not** reset the session or the board (FR-008, SC-012). It is
  idempotent, matching how the site's own ruler tools behave (003/FR-011).

**The invariant across every state**: the person's control is untouched — no control disabled, no
selection moved, no input refused because of the skill (FR-024, SC-010).

---

## 4. Installation Instruction

The README's account of how a newcomer gets the skill working. Not a runtime entity; listed because
FR-030–FR-034 make its *content* testable.

| Element | Requirement |
|---|---|
| Install path | `$HOME/.agents/skills/` — the global install is primary, because of [openai/codex#16012](https://github.com/openai/codex/issues/16012) ([R4](./research.md#r4--how-is-it-installed-by-someone-who-has-not-cloned-the-repository)) |
| Symlink variant | For anyone who has the repo, so the installed skill stays current |
| Invocation | `$agentic-sudoku` — the explicit form is documented as *the* way to run it, since it works even when implicit listing does not |
| Prerequisites | The site must be reachable; GPT-5.6 Sol or Terra; latest desktop app; not Enterprise or Edu (FR-031, FR-033) |
| Address note | Where the single address lives and what changes on deploy (FR-007b) — **stated as a location, not restated as a value**, so the README cannot drift from the skill |
| Status table | A row for feature 004 (FR-034) |

**The subtle constraint**: FR-007a says the address lives in exactly one place *in the skill*. If the
README also printed it, there would be two copies to update and one would rot. So the README points at
the line to change rather than reproducing it — and `skill.address.test.ts` asserts the README does not
contain the address.

---

## What this feature deliberately does not model

- **No progress, score, or history** of how an agent performed. Same exclusion 001/FR-051 applies to
  the person's own statistics, for the same reason.
- **No stored tool list**, in any form, anywhere. See FR-014 — this is the whole point.
- **No session persistence.** A skill run leaves nothing behind on disk.
- **No configuration file** beyond `agents/openai.yaml`. A settings file would be a second place the
  address could live.
