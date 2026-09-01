# CLAUDE.md

Guidance for AI assistants working in this repository.

**This file is subordinate to [`.specify/memory/constitution.md`](.specify/memory/constitution.md).**
Where they disagree, the constitution wins. Read it before making structural decisions —
it is short, and several of its rules are non-obvious.

## What this is

A browser-based Sudoku board that a human and an AI agent solve together, the agent
participating through the [WebMCP](https://webmachinelearning.github.io/webmcp/)
standard. 100% client-side: no server, no database, no network request after load.

| Feature | State |
|---|---|
| [001 — Core play experience](specs/001-sudoku-play-experience/) | **Complete.** 124/124 tasks, 241 unit + 90 browser tests |
| [002 — WebMCP agent tutor](specs/002-webmcp-agent-tutor/) | **Complete.** 130/132 tasks, 851 unit + 204 browser tests, 11 tools |
| [003 — Agent board controls](specs/003-agent-board-controls/) | **Complete.** 1183 unit + 263 browser tests, **16 tools** |
| [004 — Codex skill](specs/004-codex-sudoku-skill/) | **Built, unverified.** A Codex skill at `.agents/skills/agentic-sudoku/`; 1206 unit tests. The live run that closes SC-001 has not happened |

## Where things stand (read this first)

Check it rather than trusting it — this section is the thing most likely to be stale:

```bash
git log --oneline -3 && git rev-parse --abbrev-ref HEAD && cat .specify/feature.json
```

As of 2026-09-01:

- **Features 002 and 003 are both on the branch `002-webmcp-agent-tutor`, and `main` is still at
  `a5ad72f`.** Neither has been merged, and **there is no git remote configured**. Decide
  deliberately where a new feature branches from.
- **002's T131 is now closed by example**: 003 was committed tests-first, one commit per phase, so
  the ordering Principle V wants is visible in history. Do the same.
- **002's T126 remains open, and 003 made it bigger**: SC-001 is still unverified against a live
  agent, and the untested surface has grown from 11 tools to 16.
- **`LICENSE` (MIT) is at the repo root** as of `08b09d8`. GitHub reads it from the *default* branch
  to fill the repo's About sidebar, so it will not show there until this branch reaches `main`.
- The working tree was clean, the full suite green: **1183 unit, 263 browser**.

## Commands

```bash
npm test             # Vitest: unit, property, component, tool contracts
npm run test:e2e     # Playwright end-to-end
npm run test:a11y    # axe, keyboard-only, greyscale
npm run test:perf    # budgets, including agent tool-call latency
npm run lint         # includes layer-boundary enforcement
npm run typecheck
npm run review:agent # headed agent review harness — see 002/quickstart.md
npm run review:003   # screenshots: ruler + spotlight, 360px and desktop, colour and greyscale
```

**The review harnesses run under `playwright.review.config.ts`, not the main config.** The main one
carries a `testIgnore` for `tests/review/**` so they never run in CI — and that applies even when a
file is named explicitly on the command line, which is why `npm run review:agent` silently matched
zero tests from feature 002 until 003 noticed. Use the npm scripts.

Vitest runs **three projects**: `node` (no DOM at all), `component` (jsdom), and `contract`
(jsdom, `tests/contract/**` — the WebMCP tool contracts). Target one with
`npx vitest run --project node`.

**Verify builds the way they ship.** `npm run dev` cannot prove there is no server
runtime — the dev server *is* a server:

```bash
npm run build && npm start
```

## Layers — enforced by lint, not by review

```
engine  ←  state  ←  ui          workers → engine only
              ↑
            tools                tools ↔ ui: FORBIDDEN, both directions
```

**State holds THREE stores, not one.** `store.ts` (the game), `agentSession.ts` (annotations,
explanations, spotlight, confirmation — never persisted), and `preferences.ts` (the coordinate
ruler — persisted under its **own** storage key, `agentic-sudoku/preferences`). The third exists
because the ruler is neither game data nor an agent mark, and because a separate key left the
session's `SCHEMA_VERSION` at 1 — no saved game was invalidated. See
[003/research.md R2](specs/003-agent-board-controls/research.md).

- `src/engine/` — pure, deterministic. **No DOM, React, storage, or timers.** Runs in bare Node.
- `src/state/` — single source of truth. **Imports no React.** Every mutation goes through a named action in `actions.ts`; there is no other write path.
- `src/ui/` — React client components. Renders state, dispatches actions. No game rules, no gameplay state of its own.
- `src/tools/` — the WebMCP adapter. Thin handlers over State actions; **no game rules**, and **no
  `document` outside `registry.ts`** (both asserted by `tests/unit/tools.layering.test.ts`).
- `app/` — Next.js shell and design tokens only. Never put logic here. The one exception is
  `<AgentBootstrap />`: a server component's imports never reach the browser, and a static export has
  no server runtime, so registration has to be pulled in by a client module.

`eslint-plugin-import` will fail the build on a wrong-direction import. That rule has
already caught one real violation (Engine importing types from State); trust it.

## Constraints that will bite you

These are easy to violate by accident and each has tests guarding it.

- **The palette lives only in `app/globals.css`.** Raw hex or arbitrary-value colour
  utilities in a component are a lint error. `tests/unit/palette.contrast.test.ts`
  parses that block, so changing a token can fail the suite on contrast grounds.
- **A puzzle's solution must never leave `src/engine/`.** Not into store state, not
  into persisted data, not into any future agent tool result. Three tests assert this.
- **Difficulty is derived, never trusted.** It comes from which techniques a puzzle
  actually requires — re-derived even when restoring from storage. `sudoku-gen`'s own
  label is only a hint about which band to draw from.
- **Every puzzle is verified unique by our own solver**, whatever the generator claims,
  including puzzles restored from storage.
- **Stored data is untrusted input.** Validate every field on read; discard rather than
  partially apply.
- **Tests come first.** Principle V is NON-NEGOTIABLE and requires the failing test to
  arrive before or with the code, visible in commit history.
- **`origin` is a parameter on every mutating action** (`'clue' | 'player' | 'agent'`).
  Do not hardcode `'player'` — feature 002 reuses these actions unchanged, and that is
  what makes "an agent's move undoes exactly like a human's" true by construction.
- **Agent writes are coordinate-addressed** (`enterDigitAt`, not `enterDigit`). An agent must never
  move the learner's selection; the selection-based forms delegate to the coordinate ones so both
  actors run one implementation.
- **Every write tool goes through `defineWriteTool`.** It injects `explanation` into the schema and
  validates it before the handler runs, so "nothing changes silently" is structural rather than
  nine implementations being careful.
- **Nothing in `src/tools/` may import `@/engine/solver`** — it exports `solve()`, which returns a
  completed grid. Ask `@/engine/uniqueness` instead; it answers with a boolean.
- **A tool that needs a generated puzzle must SIGNAL, not call.** `requestPuzzle()` lives in
  `src/ui/puzzleLoader.ts` because `Worker` is a browser API, and `src/tools → src/ui` is a lint
  error. `switch_difficulty` raises a request on the agent session store; `GameScreen` is subscribed
  and does the generation. Same seam `requestDisconnect` already uses, arrow reversed
  ([003/R1](specs/003-agent-board-controls/research.md)). `tests/unit/tools.layering.test.ts`
  asserts it, so lint is not the only guard.
- **The agent's marks are FORM, the learner's are WASH.** Outlines, dashes, hatching, rays for the
  agent; flat washes for the learner. That is what survives greyscale, and it is why the spotlight
  is a dashed edge rule rather than a tint. Never put a new mark *underneath* a digit — see the
  hatch incident below.
- **The coordinate ruler is the one exemption from 002/FR-033** (annotations self-expire). It is a
  learner view preference, not a teaching annotation, and a guide that vanished mid-conversation
  would defeat its purpose.
- **`resume_timer` is the one exemption from 002/FR-045** (no agent writes while paused). It needs
  no code: `resumeSession` already requires `status === 'paused'` and the write wrapper does not
  gate on status. Do not add a blanket paused-board guard to `defineWriteTool` — a contract test
  will catch it, but the reason is that `pause_timer` would become a one-way door for the agent.

## The WebMCP API — do not recall it, look it up

**Most secondary sources describe a different API from the one this code targets**, and getting it
from memory will produce something that looks right and is wrong. The verified IDL, transcribed from
the published spec, is in [002/research.md § R1](specs/002-webmcp-agent-tutor/research.md) and typed
in `src/tools/webmcp.d.ts`. The three facts that shaped the whole feature:

| Fact | Consequence in this codebase |
|---|---|
| `registerTool` **rejects a duplicate name** with `InvalidStateError` | Registration is not natively idempotent; `registry.ts` guards on a module-level handle |
| There is **no `unregisterTool`** — teardown is an `AbortSignal` passed at registration | One `AbortController` registers everything, so teardown cannot drift from what was registered |
| `executeTool` **collapses a rejected handler into an opaque `UnknownError`** | Every handler resolves with a structured result and **never throws** — a rejection destroys the reason the agent needs |

Older/blog descriptions use `navigator.modelContext` with `provideContext()` / `unregisterTool()` /
`clearContext()`. The constitution mandates `document.modelContext`, and a compatibility shim for
the other shape would be the abstraction layer Principle I forbids — that is an amendment, not a
patch.

`tests/support/fakeModelContext.ts` (Node) and `tests/support/browserFakeHost.ts` (page) implement
the standard strictly, because no browser here ships it. Both are pinned by
`tests/unit/fakeModelContext.test.ts`, so they cannot quietly become laxer than the real thing.

## Why State is framework-agnostic

The most consequential decision in the codebase. Constitution Principle I requires the
WebMCP tool surface to be registered **outside the component tree** and enumerable with
**no DOM mounted**. State reachable only through a React hook makes that impossible —
which is also why the `webmcp-react` wrapper was evaluated and rejected.

So the store is a plain TypeScript module bound into React through
`useSyncExternalStore`. `tests/unit/store.headless.test.ts` plays a full puzzle to
completion in a `node` environment with no DOM. **If that test ever needs a browser,
feature 002 is no longer buildable.**

## Spec Kit workflow

Features proceed `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement`. Artifacts live in `specs/<NNN-name>/`.

**What `/speckit-specify` does for you**, so you do not do it by hand:

- Picks the next number by scanning `specs/` — with 001 and 002 present, the next is **003**.
- Creates `specs/003-<short-name>/spec.md` from the template.
- **Repoints `.specify/feature.json` at the new feature itself.** You do not need to check or edit
  it beforehand.

**What it does NOT do: create or switch a git branch.** It prints a `BRANCH_NAME` and an
`export SPECIFY_FEATURE=…` hint, but the git extension hook is not installed here, so nothing
touches git. Both existing specs say "Feature Branch: `main`" for that reason, which is now
misleading — 002 actually lives on `002-webmcp-agent-tutor`. Branch yourself, deliberately.

**The gotcha is `/speckit-plan`, not `/speckit-specify`.** `setup-plan.sh` overwrites `plan.md`
**unconditionally**, so running it while `feature.json` still points at an already-planned feature
destroys that plan. Before `/speckit-plan`, confirm the target:

```bash
cat .specify/feature.json
```

`feature.json` is gitignored — machine-local, and absent in a fresh clone.

## Delivery style

Work proceeds in **vertical slices**, each ending in a deployable site that can be
opened and reviewed — not "add the data layer" but "the board now does X". Each slice's
demo script is in [quickstart.md](specs/001-sudoku-play-experience/quickstart.md), and
each checkpoint in [tasks.md](specs/001-sudoku-play-experience/tasks.md) records what
was found along the way.

**Look at the page, don't just run the tests.** **Three** purely visual defects have shipped past
a fully green suite in this project: an invisible grid (all 81 cells in the DOM, zero borders
rendered), a board shrink-wrapped to half size, and an agent annotation whose diagonal hatch ran
straight through the digit underneath. The third is the instructive one — the palette contrast test
computes ratios against a *flat* token, while the damage was done by *stripes crossing a glyph*, so
no assertion could have caught it. Counting elements proves nothing about whether anything is drawn.

Screenshotting is cheap: a throwaway Playwright spec plus the Read tool takes about a minute, and
it is what caught the hatch.

## Open items

- **SC-009's offline-*reload* clause is unmet.** Generation, play, and saving work
  offline; reloading needs a service worker, which no requirement calls for. Documented
  in `tests/integration/offline.spec.ts`. Needs a scope decision.
- **The 250 KB bundle budget is deferred** by author decision, recorded in
  [plan.md § Complexity Tracking](specs/001-sudoku-play-experience/plan.md). CI reports
  the number (**206.7 KB gzipped**, measured 2026-08-31) but nothing gates on it.
- **Drills exist for three of five techniques.** `naked-single` and `x-wing` have none: measured
  against `requiresTechnique`, no qualifying puzzle appeared in hundreds of thousands of candidates.
  FR-054 handles it by design, but **the spec's own worked example is an X-Wing drill**, so this
  wants a scope decision — accept three, or add a harder technique module so X-Wing-exact puzzles
  become findable.
- **The coordinate ruler's colour is a decision awaiting the author** (003/T096). The supplied
  screenshot showed the row/column numbers in saturated red; the implementation uses
  `--color-ink-note`, because red would borrow the board's conflict vocabulary and 001/FR-052
  mandates a low-saturation palette. Everything else in that screenshot is reproduced as shown. If
  the red was load-bearing it is a **palette amendment** in `app/globals.css` with a contrast
  re-run, not a component change.
- **SC-001 has not been verified against a live agent, and feature 003 grew the untested surface from eleven tools to sixteen.** Nothing in this environment implements
  `document.modelContext`, so the surface has only ever been driven through a spec-conformant fake.
  Point a real agent at it before believing the "no site-specific instructions" claim.
