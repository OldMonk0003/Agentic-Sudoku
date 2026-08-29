# Agentic Sudoku

A Sudoku board a human and an AI agent can solve together. The agent participates
through the [WebMCP](https://webmachinelearning.github.io/webmcp/) browser standard rather than a
private API, so any agent that speaks the standard can play — and the board works
perfectly well with no agent present.

Everything runs in the browser. There is no server, no database, and no network
request after the page loads.

## Status

| Feature | State |
|---|---|
| [001 — Core Sudoku play experience](specs/001-sudoku-play-experience/spec.md) | Implemented |
| [002 — WebMCP agent tutor](specs/002-webmcp-agent-tutor/spec.md) | Specified, not yet built |

## Getting started

Requires Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Static export to `out/` |
| `npm start` | Serve the static export from a plain file server |
| `npm test` | Unit, property, and component tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run test:a11y` | Accessibility suite (axe + keyboard + greyscale) |
| `npm run test:perf` | Performance budgets |
| `npm run lint` | ESLint, including the layer-boundary rules |
| `npm run typecheck` | TypeScript in `strict` mode |

**Verify the build the way it ships.** `npm run dev` cannot prove there is no
server runtime — the dev server *is* a server. Build and serve the static output
instead:

```bash
npm run build && npm start
```

## Architecture

Four layers with a strict one-way dependency rule, enforced by lint rather than by
review:

```
engine  ←  state  ←  ui
   ↑
workers
```

| Layer | Path | Rules |
|---|---|---|
| **Engine** | `src/engine/` | Pure and deterministic. No DOM, no React, no storage, no timers. Runs in a bare Node process. |
| **State** | `src/state/` | The single source of truth. Framework-agnostic — imports no React. Every mutation goes through a named action; there is no other write path. |
| **UI** | `src/ui/` | React client components. Renders state and dispatches actions; holds no gameplay state and computes no game rules. |
| **Workers** | `src/workers/` | Depends only on Engine. Keeps puzzle generation off the main thread. |

`app/` is deliberately near-empty: the Next.js shell and the design tokens, nothing
else, so the App Router never becomes a place where logic hides.

### Why State is framework-agnostic

This is the most consequential decision in the codebase, and it is driven by
feature 002. The constitution requires the WebMCP tool surface to be registered
*outside* the component tree and enumerable with **no DOM mounted**. State reachable
only through a React hook makes that impossible.

So the store is a plain TypeScript module bound into React through
`useSyncExternalStore`. `tests/unit/store.headless.test.ts` plays an entire puzzle
to completion in a `node` environment with no DOM at all — if that test ever needs a
browser, the agent layer is no longer buildable.

It also means agent and human changes travel the same path: both dispatch the same
actions with a different `origin`, so "an agent's move undoes exactly like a human's"
is true by construction rather than retrofitted.

## Conventions worth knowing

- **The palette lives only in `app/globals.css`.** Raw hex or arbitrary-value colour
  utilities in a component are a lint error, so contrast has exactly one place to be
  audited. `tests/unit/palette.contrast.test.ts` parses that block — change a token
  and the suite fails.
- **The puzzle's solution never leaves the Engine.** Three separate tests assert it
  is absent from generator output, from store state, and from persisted data.
- **Difficulty is derived, never stored as truth.** The rating comes from which
  techniques a puzzle actually requires, re-derived even when restoring from storage.
- **Stored data is untrusted input.** Every field is validated on read, and a
  restored puzzle is re-checked for a unique solution before it reaches a player.
- **Tests come first.** This is a constitutional requirement, not a preference.

## Governance

[`.specify/memory/constitution.md`](.specify/memory/constitution.md) holds the
project's non-negotiable rules. It supersedes this README where they disagree.

The feature specifications, plans, and task breakdowns live under
[`specs/`](specs/), generated and maintained with
[Spec Kit](https://github.com/github/spec-kit).
