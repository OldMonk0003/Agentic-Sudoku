# Contract: Session Behaviour

**Feature**: [../spec.md](../spec.md) | **Date**: 2026-09-01

What the agent must and must not do once the skill is invoked. This is the contract the skill's four
instructions have to produce, stated as observable behaviour so the [quickstart](../quickstart.md)
script can check it.

**None of this is enforceable by the site.** The site already refuses silent changes, refuses writes
on a paused board, and refuses a fill into a clue — but it cannot stop an agent clicking a cell
instead of calling a tool, and it cannot stop one reading `src/engine/solver.ts` to find an answer.
Those routes are closed here, by instruction, or not at all. **That asymmetry is the reason this
contract exists.**

---

## 1. Opening

| Must | Requirement |
|---|---|
| Open the site in the built-in browser on invocation | FR-006 |
| Reuse an already-open board rather than opening a second one | FR-008, SC-012 |
| Require nothing from the person beyond invoking the skill | FR-010, SC-001 |
| On failure to reach the site: say so, say what would fix it, and stop | FR-009 |

| Must not | Requirement |
|---|---|
| Discard an in-progress puzzle | FR-008 |
| Proceed as though a board were present when it is not | FR-009 |

---

## 2. Reading and reporting the surface

| Must | Requirement |
|---|---|
| Read the published tools from the live page, at invocation | FR-011, FR-017 |
| Report every tool found, each with a short description | FR-012 |
| Report exactly what the page publishes — nothing added, nothing omitted | FR-013, SC-002 |
| Mark which tools observe and which change the board | FR-015 |
| Report a declared surface version if one is available | FR-016 |
| Re-read after a reload, after reconnecting, or when asked again | FR-017 |

| Must not | Requirement |
|---|---|
| Recite a list from the skill, from memory, or from an earlier reading | FR-014, FR-017 |
| Embellish a tool with behaviour the page did not describe | FR-018 |
| Treat the version as a precondition for the session | [R6](../research.md#r6--how-does-the-agent-report-the-surface-without-the-skill-containing-a-copy-of-it) |

**The version instruction is written generically on purpose.** This site declares `surface_version` in
tool *results*, not in the descriptor listing, so obtaining it means making a call — and naming which
call would put a tool name in the skill, breaching FR-014. The instruction therefore says *"if the page
or any observation-only result declares a version, report it"*, which an agent that has just read the
descriptions can satisfy without the skill knowing any tool's name.

---

## 3. Acting

**The rule**: every change to the board is made by invoking a published tool. There is no second route.

| Route | Permitted | Requirement |
|---|---|---|
| Invoking a published tool | **yes** | FR-019 |
| Clicking a cell | no | FR-020 |
| Typing at the keyboard | no | FR-020 |
| Operating the site's own controls — Pause, difficulty select, ruler toggle, Disconnect | no | FR-020, and see below |
| Scripting or evaluating JavaScript in the page | no | FR-020 |
| Screenshotting or scraping the page to read the board | no | FR-021, and see below |
| Reading this project's source or stored data to decide a move | no | FR-021 |
| Conversing, explaining, answering questions | **yes** | Assumption: talking is not acting |

**On the site's own controls**: the surface publishes tools that pause, change difficulty, and toggle
the ruler. The agent uses *those*. The on-screen buttons belong to the person — that is what makes
"the learner can always resume a board the agent paused" (003/FR-043) meaningful rather than
decorative.

**On reading the board**: the surface publishes an observation tool, so screenshotting is not a
convenience, it is a way around the contract. It would also break the site's own guarantee that the
agent reasons from the visible board exactly as the person does (002/FR-026) — the guarantee that
makes the tutor checkable.

---

## 4. Refusing

| Situation | Required behaviour | Requirement |
|---|---|---|
| No published tool covers the request | Say so; name what can be done instead; do not achieve it another way | FR-022, SC-005 |
| A tool rejects the call | Relay the reason; correct and retry differently — not identically, not by another route | FR-023 |
| The host publishes no tools at all | Report the surface is unavailable; do not simulate it or drive the page instead | FR-026, SC-008 |
| The person disconnected the agent | Report the tools are gone; do not fall back to clicking | US3 scenario 6 |
| The board is paused | Reads still work, changes are refused — report that, do not treat it as a fault | 002/FR-045 |
| A confirmation is on screen | Wait for the person; a decline is an ordinary outcome, not a retry cue | 002/FR-053, 003/FR-030 |

**Three requests this surface deliberately does not cover**, and each must produce a refusal rather
than a workaround:

| Request | Why there is no tool | What the agent says |
|---|---|---|
| "Erase that cell" | The surface has no erase tool | Points at the person's own Erase control |
| "Undo that" | The surface has no undo tool | Points at the person's own Undo control |
| "Is this digit correct?" | The solution never leaves the Engine, for anyone | Answers only from the visible board (001/FR-029, 002/FR-026) |

The first two are a genuine finding about the surface, surfaced by this contract. **They are not a
defect to fix inside this feature** — the spec scopes a seventeenth tool out — but they are exactly
the kind of thing a live run exists to reveal.

---

## 5. What the agent may never erode

| Guarantee | Requirement |
|---|---|
| The person's selection never moves | 002/FR-056, 003/FR-019, FR-024 |
| No control is disabled and no input refused because of the skill | FR-024, SC-010 |
| Every board change carries the agent's own explanation on screen | 002/SC-002, FR-025 |
| The confirmation gate before a board is replaced is honoured | 002/FR-053, FR-025 |
| Explanations are real reasoning, not filler to satisfy a length check | US3 scenario 7 |

**FR-025 is the one that could quietly break the product.** A skill that said "keep explanations
short" or "skip the confirmation to save a step" would defeat protections two features were built to
provide. The skill is forbidden from instructing any of it — explicitly, rather than left to good
sense.

---

## Verification

Behaviour in this contract is verified by the scripted run in [quickstart.md](../quickstart.md), not
by automated test: it depends on a third-party host, which is [Deviation
1](../plan.md#complexity-tracking). The skill *content* that produces this behaviour is asserted by
the tests in [skill-package.md](./skill-package.md).
