# Contract: The Skill Package

**Feature**: [../spec.md](../spec.md) | **Date**: 2026-09-01

What a valid Agentic Sudoku skill directory is, stated precisely enough to be asserted by test.

The format below is transcribed from OpenAI's published documentation, not recalled — see
[R1](../research.md#r1--what-is-a-codex-skill-exactly). **The path is `.agents/skills`, not
`.codex/skills`.** A skill at the recalled path fails silently.

---

## Layout

```text
.agents/skills/agentic-sudoku/
├── SKILL.md              REQUIRED
└── agents/
    └── openai.yaml       OPTIONAL — used here for the display name
```

`scripts/`, `references/`, and `assets/` are permitted by the format and **deliberately unused**: this
skill is instructions only, and a script would be a second place behaviour could live.

---

## `SKILL.md`

### Frontmatter

```yaml
---
name: agentic-sudoku
description: <trigger conditions and scope boundaries>
---
```

| Field | Required | Contract |
|---|---|---|
| `name` | yes | Must be `agentic-sudoku` and must equal the directory name. This is the invocation token: `$agentic-sudoku`. |
| `description` | yes | States when the skill should trigger **and when it should not**. Trigger words front-loaded — Codex matches on this field and may truncate it, and it is all the host sees before deciding to load the body. |

Codex loads only `name` and `description` for every installed skill up front, capped at 2% of the
context window or 8,000 characters. **The body is read only once the skill is selected**, which is why
the body can be prose and the description must be dense.

### Body

Exactly five things. Nothing else.

| # | Content | Requirements |
|---|---|---|
| 1 | Open the site in the built-in browser; reuse an already-open board | FR-006, FR-008, FR-010 |
| 2 | Enumerate the tools the page publishes; report each with a short description, marking observers from changers; report a declared surface version if one is available | FR-011–FR-018 |
| 3 | Act on the board only by invoking a published tool | FR-019–FR-025 |
| 4 | Report plainly when the surface is absent or a request is uncovered; never substitute another route | FR-009, FR-022, FR-026 |
| 5 | The site address — **once** | FR-007, FR-007a |

### Prohibited content — each asserted by a test

| Prohibition | Requirement | Test |
|---|---|---|
| No tool name | FR-014 | `skill.no-tool-copy.test.ts`, against the live `descriptors` |
| No tool description | FR-014 | same |
| No Sudoku technique, strategy, or solving guidance | FR-027, FR-029 | `skill.content-free.test.ts`, against the Engine's `TECHNIQUES` |
| No coaching tone or teaching style | FR-029 | reviewed against the five-item body above |
| No second copy of the address | FR-007a | `skill.address.test.ts` |
| No path into this repository | FR-002, FR-003 | `skill.package.test.ts` |

**Why the first two are asserted against the live registry rather than a transcribed list**: a
transcribed list is itself a copy, and would need editing when the surface grows. Importing
`descriptors` means a seventeenth tool is covered the day it is registered, with no test edit.

---

## `agents/openai.yaml`

```yaml
interface:
  display_name: "Agentic Sudoku"
  short_description: <one line>

policy:
  allow_implicit_invocation: true
```

| Field | Value | Why |
|---|---|---|
| `display_name` | `"Agentic Sudoku"` | The request asked for a skill *named* Agentic Sudoku. `name` must be a slug for invocation, so the human-readable name lives here. |
| `allow_implicit_invocation` | `true` | The skill's whole value is that one call is enough; a narrow `description` gates it. **One line to flip** if unprompted browser-opening proves intrusive during development in this repo — explicit `$agentic-sudoku` is unaffected either way. |

`icon_small`, `icon_large`, `brand_color`, and `dependencies` are available and unused. An icon would
need an asset file and buys nothing testable.

---

## Installation contract

| Scope | Path | When |
|---|---|---|
| **Global (primary)** | `$HOME/.agents/skills/agentic-sudoku/` | The documented install. Unaffected by [openai/codex#16012](https://github.com/openai/codex/issues/16012). |
| Symlink | `$HOME/.agents/skills/agentic-sudoku` → this repo's copy | For repo holders; keeps the install current automatically. Codex follows symlinks. |
| Repo-local | `$REPO_ROOT/.agents/skills/agentic-sudoku/` | Free for anyone running Codex in this repo — **but see the issue above**, which is why it is documented as a convenience rather than as the install. |

**Invocation is documented as explicit — `$agentic-sudoku`** — because it works whether or not the
skill made it into the implicit listing.

---

## Verification

| Property | How |
|---|---|
| Layout, frontmatter, name/directory match | `skill.package.test.ts` |
| No tool copy | `skill.no-tool-copy.test.ts` |
| No solving content | `skill.content-free.test.ts` |
| One address, one place, absent from README | `skill.address.test.ts` |
| Codex actually discovers and runs it | Manual — [quickstart.md](../quickstart.md). Third-party host; see [Deviation 1](../plan.md#complexity-tracking). |
