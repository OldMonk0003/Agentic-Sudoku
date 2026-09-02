# Agentic Sudoku

A Sudoku board a human and an AI agent solve **together**. The page publishes its own capabilities
through the [WebMCP](https://webmachinelearning.github.io/webmcp/) browser standard, so any agent
that speaks the standard can read the board, point at things, and place digits — without a private
API, an MCP server, or any prior knowledge of this site.

**Live at [agentic-sudoku.vercel.app](https://agentic-sudoku.vercel.app)** — play it yourself, or
point an agent at it.

Everything runs in the browser. No server, no database, no network request after load.

The agent is a **tutor, not an autosolver**: every change it makes to the board must arrive with a
one-or-two-line explanation, shown to the learner and undoable with their own Undo button.

| | |
|---|---|
| **Live site** | [agentic-sudoku.vercel.app](https://agentic-sudoku.vercel.app) |
| **WebMCP tools** | 18, surface version `1.2.0` |
| **Tool implementations** | [`src/tools/tools/`](src/tools/tools/) — one file per tool |
| **Registration** | [`src/tools/registry.ts`](src/tools/registry.ts) — the only module that touches `document` |
| **Codex skill** | [`.agents/skills/agentic-sudoku/`](.agents/skills/agentic-sudoku/) |

---

## Play with an agent in Codex

Codex's built-in browser supports WebMCP. The bundled **Agentic Sudoku** skill opens the live board
and constrains the agent to work only through the tools that board publishes.

**You do not need to run anything locally** — the skill points at the deployed site.

### 1. Check your Codex setup

Each of these will stop it working, and none of them produce a useful error:

- ChatGPT desktop app, latest version, with the built-in browser
- Model set to **GPT-5.6 Sol or Terra** — **WebMCP is disabled on Luna**, so the board opens and
  then nothing works
- Not an Enterprise or Edu workspace
- Site tools enabled under Settings → Browser → Permissions

### 2. Install the skill

Get the skill directory — either clone this repository, or copy
[`.agents/skills/agentic-sudoku/`](.agents/skills/agentic-sudoku/) (two text files, no scripts).
Then put it where Codex looks. **Create that directory first**: it does not exist until you have
installed a skill, and `cp -R` into a missing path fails with a confusing cascade rather than
creating it.

```bash
mkdir -p ~/.agents/skills && cp -R .agents/skills/agentic-sudoku ~/.agents/skills/
```

Symlink instead if you have the repo and want your install to track it:

```bash
mkdir -p ~/.agents/skills && ln -s "$PWD/.agents/skills/agentic-sudoku" ~/.agents/skills/agentic-sudoku
```

Confirm it landed, then restart Codex:

```bash
ls ~/.agents/skills/agentic-sudoku/SKILL.md
```

### 3. Run it

```text
$agentic-sudoku
```

Use the explicit `$` form — it works even when implicit skill listing doesn't ([known Codex
defect](https://github.com/openai/codex/issues/16012)). Codex also scans `.agents/skills` inside a
repository, so working in this project may give you the skill for free.

### 4. What to try

The board opens and the agent reports the tools it found. Then:

| Ask | What should happen |
|---|---|
| *"What should I do next?"* | It reads the board, names a move, and explains why — from the tool descriptions alone |
| *"Put a 4 in row 2, column 7"* | The digit appears marked as the agent's, with its reason on screen, undoable with your own Undo |
| *"Number the grid"* | Row and column guides appear, so you can name a cell without counting |
| *"Give me a harder one"* | Your board is replaced immediately — it does **not** ask first |
| *"Erase that cell"* | A plain refusal — there is no erase tool; that one is yours |

Park your selection on a cell and then ask it to fill a *different* one: your selection must not
move, and your next keypress must land where you left it.

**The skill contains no list of those
tools and no Sudoku guidance** — it reads the surface from the live page every time, because a copy
would drift from the site and would let a session succeed that the site's own tool descriptions
couldn't have carried. `tests/unit/skill.no-tool-copy.test.ts` enforces that against the live
registry.

> **Where the address lives.** The skill opens whatever is on the single `Site address:` line near
> the top of [`SKILL.md`](.agents/skills/agentic-sudoku/SKILL.md) — one line, one place, so moving
> the board is a one-line edit. Repoint it at a local build if you want to drive one.
> `tests/unit/skill.address.test.ts` reads that line as canonical and fails if anything else names a
> different address, so the skill and this README cannot drift apart.

---

## The WebMCP tool surface

Registered on `document.modelContext`. Every tool declares a strict JSON Schema, returns a
structured result on both success and failure, and never throws. **Every write tool requires an
`explanation`**, validated before the handler runs — so there is no path by which the board changes
silently.

### Reading — changes nothing

| Tool | Purpose |
|---|---|
| `get_board_state` | Every cell's digit, who placed it (clue / player / agent), its pencil marks, plus difficulty, elapsed time and status |
| `check_for_conflicts` | Every cell involved in a duplicate, grouped so the agent can see which cells collide |

### Teaching annotations — visual only, self-expiring

| Tool | Purpose |
|---|---|
| `highlight_pattern_cells` | Mark cells in two roles: what a deduction concludes, and what justifies it |
| `draw_constraint_beams` | Cast a ray along a row, column, or box to show a constraint |
| `show_pattern_hint_toast` | A short coaching note beside the board |
| `clear_visual_annotations` | Remove every highlight, beam, and note the agent placed |

### Changing the board — undoable, one step each

| Tool | Purpose |
|---|---|
| `fill_cell` | Place one digit in one empty, non-clue cell |
| `update_pencil_marks` | Set specific cells' candidates to exactly the digits listed |
| `auto_fill_all_pencil_marks` | Pencil every empty cell with the digits still legal there |
| `undo_move` | Take back the last change, whoever made it — exactly as the learner's Undo does |

### Guided flows

| Tool | Purpose |
|---|---|
| `playback_deduction_sequence` | Play a walkthrough — steps in order, each explained as it happens, interruptible the moment the learner touches the board |
| `load_technique_practice` | Replace the puzzle with a curated drill for one technique |

### Board and session controls

| Tool | Purpose |
|---|---|
| `show_coordinate_ruler` | Number the grid 1–9 on both axes, so the learner can name a cell without counting |
| `hide_coordinate_ruler` | Remove those guides |
| `switch_difficulty` | Load a fresh puzzle at a chosen level |
| `restart_puzzle` | A different grid at the level the board is already on |
| `pause_timer` | Stop the clock and cover the board, exactly as the learner's own Pause does |
| `resume_timer` | Restart the clock from where it stopped |

**The agent replaces the board without asking.** Feature 005 repealed the confirmation that used to
gate a difficulty switch, a drill, or a restart, so that a session can be run hands-free. The
narration contract is what remains: a replacement still cannot happen silently, and the agent's
stated reason appears on screen as it happens. The **Disconnect** control is the learner's means of
stopping an agent that gets it wrong.

**Three rules hold across the whole surface.** The puzzle's solution never leaves the engine, so no
tool can reveal whether a digit is correct — the agent reasons from the visible board exactly as the
learner does. Agent writes are addressed by coordinate, so they never move the learner's selection.
And with no WebMCP host present, the site is an ordinary human Sudoku game with zero agent-related
elements on screen.

---

## Architecture

Four layers, one-way dependencies, **enforced by lint rather than by review**:

```
engine  ←  state  ←  ui          workers → engine only
              ↑
            tools                tools ↔ ui: forbidden, both directions
```

| Layer | Path | Rules |
|---|---|---|
| **Engine** | `src/engine/` | Pure and deterministic. No DOM, React, storage, or timers. Runs in bare Node. Each solving technique is its own module. |
| **State** | `src/state/` | The single source of truth. **Imports no React.** Every mutation goes through a named action; there is no other write path. |
| **UI** | `src/ui/` | React client components. Renders state, dispatches actions. No game rules. |
| **Tools** | `src/tools/` | The WebMCP adapter. Validates agent input, calls state actions, serialises results. No game rules, no DOM outside `registry.ts`. |
| **Workers** | `src/workers/` | Puzzle generation off the main thread. Depends only on Engine. |

`app/` holds the Next.js shell and the design tokens — nothing else.

**The state store is a plain TypeScript module** bound into React through `useSyncExternalStore`,
and the whole agent surface rests on that: WebMCP registration must happen outside the component
tree and be enumerable with no DOM mounted, which state reachable only through a React hook makes
impossible. It also means agent and human changes travel the same actions with a different `origin`,
so an agent's move undoes exactly like a human's by construction.

**UI and Tools never import each other** — they meet only at `src/state/agentSession.ts`, which is
how playback stops when the learner touches the board, and how the Disconnect button unregisters
tools, without either side knowing the other exists. There are three stores: the game, the agent
session (annotations and explanations, never persisted), and view preferences.

---

## Tools and libraries

| | |
|---|---|
| **Framework** | Next.js 16 (App Router, static export — zero server runtime) |
| **UI** | React 19 client components |
| **Styling** | Tailwind CSS 4. The Japandi palette lives only in `app/globals.css`; raw hex in a component is a lint error |
| **Icons** | Lucide React, imported one by one against the bundle budget |
| **Puzzles** | `sudoku-gen` — its output is re-verified for a unique solution and re-rated by technique before any player sees it |
| **Language** | TypeScript 5.9, `strict` |
| **Unit / property / contract tests** | Vitest 4 (three projects: `node` with no DOM, `component`, `contract`), `fast-check` |
| **Browser tests** | Playwright — e2e, accessibility (`@axe-core/playwright`), performance budgets |
| **Lint** | ESLint 9, `typescript-eslint`, `eslint-plugin-import` for the layer boundaries |

No runtime dependency introduces a network call, a backend, or a build-time secret.

---

## Scripts

```bash
npm install
npm run dev          # development server
npm run build        # static export to out/
npm start            # serve the export from a plain file server
npm test             # Vitest: unit, property, component, tool contracts
npm run test:e2e     # Playwright end-to-end
npm run test:a11y    # axe, keyboard-only, greyscale
npm run test:perf    # budgets, including agent tool-call latency
npm run lint         # includes the layer-boundary rules
npm run typecheck
```

**Verify the build the way it ships.** `npm run dev` cannot prove there is no server runtime — the
dev server *is* a server. Use `npm run build && npm start`.

---

## Status

| Feature | State |
|---|---|
| [001 — Core play experience](specs/001-sudoku-play-experience/spec.md) | Complete |
| [002 — WebMCP agent tutor](specs/002-webmcp-agent-tutor/spec.md) | Complete — eleven tools |
| [003 — Agent board controls & coordinate ruler](specs/003-agent-board-controls/spec.md) | Complete — **sixteen tools**, ruler, agent spotlight |
| [004 — Codex skill](specs/004-codex-sudoku-skill/spec.md) | Built — **awaiting its live run** against a real agent |
| [005 — Restart, undo, prompt-free replacement](specs/005-hands-free-board-controls/spec.md) | Complete — **eighteen tools**, a Restart control, and the confirmation prompt repealed |

Specifications, plans, and task breakdowns live under [`specs/`](specs/), maintained with
[Spec Kit](https://github.com/github/spec-kit).
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) holds the project's
non-negotiable rules and supersedes this README where they disagree.
