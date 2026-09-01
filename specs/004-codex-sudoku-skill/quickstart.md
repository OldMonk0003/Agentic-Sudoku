# Quickstart: Agentic Sudoku Codex Skill

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-01

Two halves. The first runs in seconds and gates the build. The second needs a person, a Codex session,
and about fifteen minutes — and it is the half that closes an item open since feature 002.

---

## Part 1 — Automated (gates the build)

```bash
npm test
```

Expected: the existing 1183 pass, plus the four new skill files.

| File | Asserts | Requirement |
|---|---|---|
| `tests/unit/skill.package.test.ts` | `SKILL.md` exists, frontmatter parses, `name` equals the directory, no path into this repo | FR-001–004 |
| `tests/unit/skill.no-tool-copy.test.ts` | No descriptor `name` from the live registry appears in the skill | FR-014, SC-011 |
| `tests/unit/skill.content-free.test.ts` | No Engine `TECHNIQUES` id appears in the skill | FR-027/029, SC-011 |
| `tests/unit/skill.address.test.ts` | The address occurs exactly once in the skill, and not at all in the README | FR-007a, SC-013 |

**Prove the important one actually bites**, rather than trusting it:

```bash
node -e "require('fs').appendFileSync('.agents/skills/agentic-sudoku/SKILL.md','\nfill_cell\n')" && npx vitest run --project node skill.no-tool-copy
```

It must **fail**. Then remove the line and watch it pass. A test that has never failed is testing
nothing — and this is the one guarding the property that makes the whole feature meaningful.

---

## Part 2 — The live run (manual; this is the point of the feature)

**Prerequisites**, from [R2](./research.md#r2--does-codexs-in-app-browser-actually-support-webmcp):

- ChatGPT desktop app, latest version, with the built-in browser
- **GPT-5.6 Sol or Terra.** Not Luna — WebMCP is disabled there
- Not an Enterprise or Edu workspace
- Site tools enabled under Settings → Browser → Permissions
- The skill installed — **`mkdir -p` first**; the directory does not exist until you have installed a
  skill, and `cp -R` into a missing path fails confusingly instead of creating it:
  `mkdir -p ~/.agents/skills && cp -R .agents/skills/agentic-sudoku ~/.agents/skills/`

Serve the site the way it ships — `npm run dev` cannot prove there is no server runtime:

```bash
npm run build && npm start
```

### Step 0 — the open question, answered first

**Before anything else**, open `http://localhost:3000` in Codex's built-in browser by hand and check
whether **Site tools** appears in the address bar.

This is [R5](./research.md#r5--will-the-built-in-browser-load-httplocalhost3000), the feature's one
unresolved risk, and it is five minutes of experiment rather than any amount of reading. `localhost`
is a secure context by W3C definition so the gate *should* pass, but whether the desktop app permits
navigation to a local server is undocumented.

- **Site tools listed** → continue.
- **Page loads, no Site tools** → check the model (Luna?) and the browser permission before concluding
  anything.
- **Page will not load at all** → deploy to Vercel and repoint the skill's single address line. That
  is the fallback the author already planned, and FR-007a made it a one-line edit.

**Record the answer in `tasks.md`.** It is the fact this feature most needs written down.

### Step 1 — invocation (SC-001, US1)

In a Codex session, type `$agentic-sudoku`.

| Expect | Criterion |
|---|---|
| The site opens in the built-in browser with a playable puzzle, in under 30 seconds | SC-001 |
| You supplied no address and no further instruction | FR-010 |
| The board looks exactly as it always does — no banner, no wrapper | US1 scenario 2 |

Then invoke it a second time: your in-progress puzzle must survive (SC-012, FR-008).

### Step 2 — the surface report (SC-002, US2)

The agent should now list the tools it found.

Check it against the truth:

```bash
npx vitest run --project node tools.surface
```

| Expect | Criterion |
|---|---|
| Every tool the page publishes is reported — currently sixteen | SC-002 |
| No tool is invented | SC-002 |
| Each carries a short description | FR-012 |
| Observers are distinguished from changers | FR-015 |

**Then the test that matters most for FR-014.** Ask the agent: *"where did that list come from?"* It
must be able to say it read it from the page. If it recites a list the skill gave it, the feature has
failed at its central claim — and `skill.no-tool-copy.test.ts` should have caught it, so a failure here
is also a failure of that test worth fixing.

**SC-003, and it is cheap**: temporarily reword one tool's `description` in `src/tools/tools/`,
rebuild, reload, invoke again. The agent's report must reflect the change **with no edit to the
skill**. Revert afterwards.

### Step 3 — 002/SC-001, open since feature 002 (SC-006)

**This is the step the feature exists for.**

Say only: *"What should I do next?"* — no technique names, no hints, no explanation of the site.

| Expect | Criterion |
|---|---|
| The agent reads the board, identifies a valid next move, and explains it | **SC-006 = 002/SC-001** |
| It used only the site's own tool descriptions to get there | 002/FR-006 |

**If it fails, the finding is real and it belongs to the site.** FR-028 is explicit: if a run needs the
skill to explain the site, that is a defect in the tool descriptions, to be fixed in
`src/tools/tools/*.ts` — not patched by adding guidance to the skill. Record which description was
inadequate; that is worth more than a pass.

### Step 4 — tools only (SC-004, US3)

Ask for, in order: a hint; a digit placed; the grid numbered; a harder puzzle; a pause; a resume.

| Expect | Criterion |
|---|---|
| Every board change arrived through a tool — nothing clicked, typed, or scripted | SC-004 |
| Each change carried the agent's explanation on screen | 002/SC-002 |
| Agent digits are marked as the agent's — italic, sage corner glyph | 002/FR-044 |
| The difficulty change asked you to confirm first | 003/FR-030 |
| One press of your Undo reverses an agent digit | 002/SC-005 |

**Watch your selection.** Park it on a cell before asking the agent to fill a different one. It must
not move, and your next keypress must land where you left it (SC-010, 003/FR-019). This is the
behaviour feature 003 built the spotlight for — you should see the agent's dashed band appear around
its cell while your own crosshair stays put.

### Step 5 — refusals (SC-005)

Ask for three things the surface does not offer:

1. *"Erase row 3, column 4"* — there is no erase tool
2. *"Undo your last move"* — there is no undo tool
3. *"Is my 7 in row 1 correct?"* — the solution never leaves the Engine, for anyone

| Expect | Criterion |
|---|---|
| A plain refusal naming what it *can* do | SC-005 |
| No workaround — no clicking your Erase button, no reading the source | FR-020, FR-021 |

**These three refusals are a finding, not a bug.** They are the surface's real shape, and a live run is
how you learn whether the gaps matter. A seventeenth tool is out of scope here (spec, Out of Scope) —
note it and move on.

### Step 6 — the absent surface (SC-008)

Press **Disconnect** on the agent badge (002/FR-057), then ask the agent to change the board.

| Expect | Criterion |
|---|---|
| It reports the tools are gone | SC-008 |
| It does **not** fall back to clicking or typing | FR-026, US3 scenario 6 |

The constitution forbids a shim presented as the real thing. An agent that quietly starts clicking
when the surface disappears is that failure, wearing a different hat.

---

## Recording the result

Write the outcome into `tasks.md` — pass or fail, per criterion. **A failure of SC-006 is a finding
about the site's tool descriptions and belongs in `src/tools/tools/`.** A failure of SC-004 is a
finding about the skill's wording and belongs in `SKILL.md`. Keeping those two straight is what makes
the run worth doing.

`002/T126` has stood open across two features. This is the run that closes it or tells you why it
cannot be closed.
