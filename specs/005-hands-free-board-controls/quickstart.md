# Quickstart: Restart, Undo, and Prompt-Free Board Replacement

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-02

Three parts: the automated gate, a look at the page, and a live agent session. The third is where the
repealed confirmation is actually felt, and it is the one worth doing carefully.

---

## Part 1 — Automated

```bash
npm test && npm run lint && npm run typecheck
```

**Record the suite count before you start and after you finish.** This feature deletes tests, and a
count that drops by more than the two deliberately removed files means coverage was lost by accident:

```bash
npm test 2>&1 | grep -E "Test Files|Tests "
```

| Deliberately deleted | Why |
|---|---|
| `tests/unit/agentSession.confirmation.test.ts` | the prompt is the whole of what it tests |
| `tests/a11y/agent-confirmation.spec.ts` | same |

Everything else that mentions the confirmation is **edited, not removed** — see
[contracts/board-replacement.md](./contracts/board-replacement.md#test-rule-for-the-removal).

Then the browser suites, which is where the deleted banner would show up as a surprise:

```bash
npm run test:e2e
npm run test:a11y
npm run test:perf
```

**`test:perf` is worth watching.** `switch_difficulty` no longer waits on a human, so its latency
should *improve*. If it did not, the waiter was not actually removed.

---

## Part 2 — Look at the page

**Three purely visual defects have shipped past a green suite in this project.** Counting elements
proves nothing about whether anything is drawn.

```bash
npm run build && npm start
```

| Check | Expected |
|---|---|
| The Restart control exists | Beside the Difficulty select — **not** beside Erase and Undo ([R7](./research.md#r7--where-does-the-restart-button-go)) |
| Press it on a half-solved board | A different grid, same difficulty, clock at `00:00`, Undo greyed out |
| Press it repeatedly and fast | One board settles; no half-drawn grid ever appears |
| The difficulty select afterwards | Still reads the level you were on |
| At 360 px wide | The control fits, no horizontal page scroll (001/FR-050) |
| Keyboard only | Tab reaches it, the focus ring is visible, Enter activates it |
| No confirmation banner anywhere | It should be impossible to make one appear by any route |

**The mis-click check that motivated R7**: with the board half solved, use the page normally for a
minute — press Erase and Undo a few times as you would while playing. If your hand ever lands on
Restart, the placement is wrong, and the consequence is a board you cannot get back.

---

## Part 3 — The live agent session

Needs Codex with the skill installed (see the README) and the deployed board, or a local build with
the skill repointed.

### Restart and undo

| Say | Expect |
|---|---|
| *"Start me a fresh one"* | A different grid at the same difficulty, the agent's reason on screen |
| *"Take that back"* after it places a digit | The digit goes, one step, reason on screen |
| *"Take that back"* on a fresh board | A refusal saying there is nothing to undo — not a crash, not a no-op |
| *"Undo"* after **you** placed a digit | It succeeds and the agent says it took back **your** move — that is `undone_origin` doing its job |
| *"Undo"* after it fills all pencil marks | Every candidate it wrote disappears **in one step** |

**Check your selection does not move** during any of it, and that your next keypress lands where you
left it (FR-018, SC-010).

### The repealed confirmation — the part to do carefully

| Say | Expect |
|---|---|
| *"Give me a harder one"* on a board with real progress | The board switches **immediately**. No prompt. No button. |
| | The agent's explanation of why is on screen |
| *"Give me a drill"* | Same — no prompt there either |

**Then sit with what just happened.** An hour of work would have gone the same way. There is no undo
for it, no copy retained, and nothing asked you first. That is the feature working as specified, and
it is the thing to decide you are still happy with now rather than later.

### The last protection

| Check | Why it matters |
|---|---|
| The **Disconnect** button is present while an agent is connected | FR-026 — after this feature it is the learner's *only* protection against an unwanted replacement |
| Press it, then ask the agent to restart | The tools are gone; it must say so and not fall back to clicking |
| Your own Restart and Undo still work afterwards | They are ordinary game controls and never depended on an agent |

### With no agent at all

Load the page in an ordinary browser with no WebMCP host.

| Check | Expected |
|---|---|
| Restart and Undo | Present and working |
| Agent-related elements | **Zero** — no badge, no live region, no banner (SC-012, 002/FR-013) |
| Everything from features 001–003 | Unchanged |

---

## What to record

In `tasks.md`:

- Suite counts before and after, and the delta explained
- Whether `switch_difficulty`'s measured latency improved
- The Restart placement decision, if the mis-click check changed your mind
- Anything the live session surfaced about the repealed confirmation — that is the finding most worth
  having, and the one the next feature would act on
