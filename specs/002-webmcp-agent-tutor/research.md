# Phase 0 Research: WebMCP Agent Tutor

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-29

Eleven decisions, each recorded as Decision / Rationale / Alternatives. Where a decision is forced by
the constitution rather than chosen, that is said plainly.

Feature 001 left three things in place specifically for this feature — a framework-agnostic store, an
`origin` parameter on every mutating action, and a reserved `--color-mark-agent` token. This research
is largely about the parts 001 could *not* pre-build: the standard's real API shape, where ephemeral
agent state lives, and how any of it is testable when the host browser may not exist yet.

---

## R1. The actual WebMCP API surface

**This was verified against the specification, not recalled.** The published draft at
<https://webmachinelearning.github.io/webmcp/> defines:

```webidl
partial interface Document {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};

interface ModelContext : EventTarget {
  Promise<undefined> registerTool(ModelContextTool tool,
                                  optional ModelContextRegisterToolOptions options = {});
  Promise<sequence<RegisteredTool>> getTools(optional ModelContextGetToolOptions options = {});
  Promise<DOMString> executeTool(RegisteredTool tool, optional object inputObject = {},
                                 optional ModelContextExecuteToolOptions options = {});
};

callback ToolExecuteCallback = Promise<any> (object inputObject, ToolExecuteCallbackOptions options);
```

- `ModelContextTool`: `name` (1–128 chars, `[A-Za-z0-9_.-]`), `description` (non-empty), `execute`
  (required); `title`, `inputSchema`, `annotations` optional.
- `ToolAnnotations`: `readOnlyHint` (default false), `untrustedContentHint` (default false).
  **There is no `destructiveHint`** in this draft.
- `ModelContextRegisterToolOptions`: `exposedTo` (origin allowlist), **`signal` (an `AbortSignal`;
  aborting unregisters the tool)**.
- `registerTool` **rejects with `InvalidStateError` if the name is already registered.**
- A `toolchange` event fires at `ModelContext` when the tool set changes.
- Gated on `SecureContext` **and** a Permissions Policy feature named `tools`, default allowlist
  `['self']`.

**Decision**: target this draft exactly — `document.modelContext`, `registerTool`, `AbortSignal`
teardown, `readOnlyHint`, `untrustedContentHint`.

**Rationale**: three consequences fall straight out of the IDL and shape the whole feature.

1. **There is no `unregisterTool`. Teardown is an `AbortController`.** FR-012 ("teardown MUST remove
   exactly the tools it registered") is therefore satisfied by registering every tool with one
   controller's signal and aborting it once. This is *better* than a manual unregister loop: it
   cannot drift out of step with what was registered.
2. **`registerTool` rejects on a duplicate name, so registration is not natively idempotent.**
   FR-012's idempotency requirement lands on us: `registerTools()` keeps a module-level handle and
   returns the existing one instead of re-registering. Without that guard, React strict-mode double
   evaluation or a hot reload throws `InvalidStateError`.
3. **`executeTool` resolves to a `DOMString` — the handler's return value, JSON-serialised — and a
   rejected handler collapses into an opaque `UnknownError` DOMException.** The reason is destroyed.
   That is the mechanical justification for FR-008 and FR-009: a thrown error cannot carry the "why"
   an agent needs to correct itself, so **every handler resolves, always, with a structured result
   object that carries `ok: false` and a specific code.** Never throwing is not a style preference
   here; throwing loses information.

**Alternatives considered**: The `navigator.modelContext` surface with `provideContext()`,
`unregisterTool()`, and `clearContext()` is widely described in secondary sources and was the earlier
shape of this API; the getter moved from `Navigator` to `Document` in the May 2026 draft. Coding to
the older shape was rejected — the constitution names `document.modelContext` explicitly, and
`provideContext()` is actively hostile to our requirements: it *clears the whole tool set first*,
which would silently stamp on a second registration rather than surfacing the collision FR-012 wants
us to prevent.

**Recorded risk**: a shipping browser may still expose the older `navigator.modelContext` shape. We
do **not** write a compatibility shim — the constitution's Technology Constraints forbid "a wrapper
library, an SDK, or an abstraction layer" between our registration module and the browser API, and
supporting a second entry point would be exactly that. If a host exposes only the navigator form,
this site sees no agent and behaves as feature 001 — which FR-013 already requires to be a supported
mode, not a degraded one. Adding navigator support later is a constitution amendment, not a patch.

---

## R2. Registering outside the component tree, in a client-only static export

**Decision**: `src/tools/registry.ts` self-registers when the module is evaluated. It reaches the
client bundle through `src/tools/AgentBootstrap.tsx` — a `'use client'` component that renders
`null`, mounted once by `app/layout.tsx`.

**Rationale**: Principle I forbids registration inside "a component render function, a JSX/template
body, a reactive effect tied to a DOM node, or any code path that runs per-render". That rules out
the obvious `useEffect` in `GameScreen`. But a static export has no server runtime to run a startup
hook in, and **imports of a server component never reach the browser** — so a bare side-effect import
in `app/layout.tsx` would execute at build time in Node (where `document` is undefined) and never in
the browser at all. Registration must therefore be pulled in by *some* client module.

`AgentBootstrap` is that pull, and nothing more. Registration happens at module evaluation — once,
before any render — and the component body is `return null`. A test asserts both halves: that the
descriptors are enumerable from `registry.ts` with no DOM and no React imported, and that the
component renders nothing and registers nothing when rendered.

**Alternatives considered**:

- *Side-effect import in `GameScreen.tsx`*: works, but creates a `ui → tools` edge in the dependency
  graph for a module the UI never uses, which weakens the seam described in R3. Rejected.
- *Side-effect import in `app/layout.tsx`*: does not run in the browser at all under `output: 'export'`.
  Rejected as non-functional, not as impure.
- *`useEffect` in a provider component*: a direct Principle I violation. Rejected outright.

---

## R3. Where ephemeral agent state lives — and the seam it creates

Annotations, explanation popups, playback progress, the connection indicator, and the drill
confirmation prompt are all **presentation state**. FR-034 is explicit that annotations must not alter
board data, elapsed time, or undo history and must never be persisted.

**Decision**: a **second store**, `src/state/agentSession.ts`, structurally separate from the game
store. Same shape (`getState` / `subscribe` / `dispatch`), same framework-freedom, its own action set.
`persistence.ts` is not wired to it and never will be.

**Rationale**: this state has the same awkward pair of requirements the game store had in 001 — the
Tools layer must reach it with no DOM mounted, and React must render it — so the same answer applies:
a plain module bound in through `useSyncExternalStore`. Making it a *separate store* rather than a
branch of `GameSession` is what makes FR-034 true **by construction**: annotation data has no route
into the persisted payload because `serialiseSession` cannot see it. That is the same trick 001 used
for derived state, and it is why the guarantee needs one structural test rather than vigilance.

The more valuable consequence is architectural. This store becomes **the only seam between the UI and
the Tools layer, and neither imports the other**:

| Direction | Carried by | Example |
|---|---|---|
| Tools → UI | agent session store | agent highlights cells; the overlay renders them |
| UI → Tools | agent session store | learner touches the board; playback sees the activity counter rise and stops |
| UI → Tools | agent session store | learner clicks Disconnect; the registry sees it and aborts its controller |

So `playback_deduction_sequence` needs no callback from `Board.tsx`, and the Disconnect button needs
no import of the registry. Both are lint-enforced: `src/ui` may not import `src/tools`, and
`src/tools` may not import `src/ui`.

**Alternatives considered**: adding an `annotations` field to `GameSession` — rejected because every
annotation write would then push through the game store, land in the same subscriber that drives
persistence, and put FR-034 one forgotten field away from breaking. Component-local React state —
rejected: unreachable headlessly, so tools could not write it.

---

## R4. Enforcing the narration contract in one place

**Decision**: write tools are not written as free functions. Each is declared through a
`defineWriteTool()` wrapper in `src/tools/narration.ts` that (a) injects the `explanation` property
and its bounds into the declared `inputSchema`, (b) validates it before the handler runs, and (c)
publishes the explanation to the agent session store **only after** the handler reports success.

**Rationale**: SC-002 and SC-003 are absolutes — "there is no path by which the board changes
silently", "100% of attempted changes lacking valid explanation text are rejected". With six write
tools written independently, those absolutes hold only if six implementations are each correct and
stay correct. Through one wrapper, a write tool that forgets to narrate **cannot be declared** — the
type does not permit it, and the explanation is added to the schema rather than trusted to the author.
This is the same reasoning that put `origin` on the actions in 001: make the guarantee structural, not
behavioural.

Ordering matters and is deliberate: validate → mutate → publish. An explanation for a change that was
rejected must never appear on screen, and a change must never land without its explanation queued.

**Alternatives considered**: a per-tool checklist enforced in review (rejected — this is precisely
what Principle V says review cannot be trusted for); validating the explanation inside each handler
(rejected — six places to get right, and the failing case is invisible because nothing appears on
screen when it goes wrong).

---

## R5. Input validation without a dependency, and without drift

**Decision**: one small schema interpreter, `src/tools/validate.ts`, that validates an input object
against **the same `inputSchema` object we hand the browser**. It supports only the JSON Schema subset
this surface uses: `type: object` with `properties`, `required`, `additionalProperties: false`;
`string` with `minLength`/`maxLength`/`enum`/`pattern`; `integer` with `minimum`/`maximum`; `array`
with `items`/`minItems`/`maxItems`/`uniqueItems`; and `boolean`. Roughly 120 lines.

**Rationale**: the host may validate arguments against `inputSchema`, but we cannot assume it does,
and FR-003 and SC-012 require unrecognised arguments to be *rejected rather than ignored*. So we must
validate ourselves. The critical property is **no second source of truth**: hand-written type guards
alongside a hand-written schema will diverge, and the divergence surfaces as a tool that advertises
one contract and enforces another — the worst possible failure at the agent boundary, because no human
is watching it. Driving both from one object makes drift impossible rather than merely tested-for.

Adding `ajv` was rejected on the bundle budget and on the constitution's minimal-dependency rule: a
full JSON Schema implementation for a nine-keyword subset is not justified.

**Alternatives considered**: trusting the host (rejected — SC-012 is a hostile-input criterion, and
"the browser probably checked" is not a defence); Zod with schema generation (rejected — a runtime
dependency, and the generated schema becomes a second artefact to keep honest).

---

## R6. Result and error envelope

**Decision**: every tool resolves with one of

```ts
{ ok: true,  tool: string, surfaceVersion: string, data: <tool-specific> }
{ ok: false, tool: string, surfaceVersion: string, error: { code: ErrorCode, message: string, details?: object } }
```

`ErrorCode` is a closed enumeration. The game store's existing `RejectionReason` values map onto it
one-for-one, plus tool-level codes for schema failures, narration failures, and human outcomes.

**Rationale**: FR-009 requires a reason "specific enough for the agent to correct itself and retry".
A code plus a human-readable message gives the agent both the branch and the explanation. Echoing
`surfaceVersion` in every result — not just at registration — means an agent holding a stale
description finds out on its next call rather than on its next confusing failure (FR-010).

`details` carries the machine-actionable extras FR-054 needs: the list of techniques that *do* have
drills, the cells that were out of range, the number of playback steps completed.

---

## R7. Annotation roles that survive greyscale, and the palette cost

**Decision**: annotation roles are distinguished by **form first, colour second**, and add three
tokens to `app/globals.css`:

| Role | Form (the primary cue) | Token |
|---|---|---|
| `target` — the cell a deduction concludes about | solid 2px sage outline + filled corner dot | `--color-mark-agent` (exists) |
| `because` — the cells that justify it | diagonal hatch fill + hollow corner dot | `--color-mark-agent-wash` (new) |
| `beam` — a constraint ray along a unit | a dashed centre line spanning the unit, with end caps | `--color-mark-agent` (exists) |
| annotation surface for toasts/popups | raised card distinct from `surface` | `--color-agent-surface` (new), `--color-agent-edge` (new) |

**Rationale**: FR-032 requires agent marks to be distinguishable from the learner's own crosshair, and
FR-035 requires roles to be distinguishable by more than colour and to survive greyscale. The
learner's own highlighting is **entirely wash-based** — flat fills, no outlines, no lines. So agent
annotations use outlines, hatching, and rays: shape categories the learner's own highlighting never
uses. That distinction holds in greyscale, in every colour-vision deficiency, and while a wash is
underneath, which is the case that actually matters since annotations sit on top of live highlighting.

**Cost, recorded honestly**: `tests/unit/palette.contrast.test.ts` parses the `@theme` block and
asserts a required-token list and computed ratios. Three new tokens mean extending that list and
computing new ratios — sage-on-hatch and ink-on-agent-surface both have to clear 4.5:1, and the
hatch fill has to stay light enough that `--color-ink-player` still clears 4.5:1 on top of it. This
is a real constraint on the token values, not a formality: 001's first candidate palette failed four
such checks. Slice 1 does this work before any annotation renders.

**Alternatives considered**: a distinct hue per role (rejected — dies in greyscale, FR-035); opacity
tiers (rejected — reads as "disabled" and destroys text contrast underneath); a bordered overlay per
role only (rejected — indistinguishable from the selection ring, which is 001's strongest cue and
must stay unique).

---

## R8. Playback: pacing, interruption, and where the timer lives

**Decision**: `src/tools/playback.ts`, a sequencer with an **injected scheduler** (defaulting to
`setTimeout`). It runs steps in order, dispatching one ordinary state action per step. Before each
step it compares the agent session store's `learnerActivity` counter against the value it saw at the
previous step; a change means the learner acted, and playback stops. It also honours the
`AbortSignal` the standard hands every handler.

**Rationale**: three constraints intersect. Principle III bars timers from the Engine but not from
Tools. 001 established that the View owns intervals and the store owns numbers — but a *paced
sequence of mutations* is not a display concern and cannot live in a component, because it must be
driveable headlessly for tests. And FR-048 requires interruption by learner input on the board.

The activity counter is what keeps the layering clean: the Board bumps it on any key or click
(one dispatch to the agent session store), and the sequencer observes it. `Board.tsx` needs no
knowledge that playback exists, and `playback.ts` needs no DOM. Injecting the scheduler makes the
whole sequence testable in Node with a fake clock — no waiting, no flake.

FR-049 forbids rolling back completed steps, which falls out for free: each step is an ordinary
dispatch, already committed to history. Stopping is simply not dispatching the next one — and FR-050
(each step individually undoable) holds because each step *is* one ordinary action with its own
`ChangeRecord`. This is the payoff from 001's decision to make agent and human writes the same code
path.

Reduced motion (FR-061) changes the pacing constant, not the mechanism: the sequencer reads a
`prefers-reduced-motion` value supplied through the agent session store by the UI, so the tools layer
never queries a media query itself.

---

## R9. Curated drills, and what "genuinely requires a technique" means

**Decision**: drills are authored constants in `src/engine/drills.ts` — an 81-character puzzle string
plus the technique it exercises. A new Engine function `requiresTechnique(clues, id)` defines the
guarantee, and a test asserts it for every drill.

```
requiresTechnique(clues, id) === true  ⟺
    solving with (every technique of equal or lower band, EXCLUDING id)  stalls
  AND solving with (that same set, INCLUDING id)                          completes
```

**Rationale**: FR-052 and SC-009 demand puzzles that "genuinely require the named technique", which is
otherwise an unfalsifiable claim. The definition above is decidable, runs on the technique modules
already built in 001, and fails loudly if someone pastes in a puzzle that merely *permits* the
technique. Uniqueness comes free from `countSolutions`, which every drill also passes — Principle IV
applies to a bundled puzzle exactly as it does to a generated one.

Bundling as constants satisfies FR-055 (no network) with no mechanism at all, and the size is
negligible: ~85 bytes per drill against a ~189 KB bundle.

**Alternatives considered**: generating drills at request time (rejected — the technique requirement
could not be guaranteed within the generation budget, and a drill that fails to require its technique
teaches the wrong lesson); shipping a JSON file fetched at runtime (rejected — a network request,
Principle II).

---

## R10. Testing a standard the browser may not implement

**Decision**: a conformant fake, `tests/support/fakeModelContext.ts`, implementing `registerTool`
(including `InvalidStateError` on duplicates and `AbortSignal` unregistration), `getTools`, and
`executeTool` (including JSON-serialising the handler's return value). Three test layers use it:

| Layer | Environment | Proves |
|---|---|---|
| `tests/unit/tools.surface.test.ts` | **node, no DOM** | descriptors enumerable, named, schema'd, versioned — with no `document` in existence (Principle I, FR-011) |
| `tests/contract/*.test.ts` | jsdom + fake host | per-tool: name, schema rejection, success shape, error shape (Principle V) |
| `tests/integration/agent-*.spec.ts` | Playwright, fake host injected | agent call → state mutation → rendered view → undo (Principle V's required integration test) |

**Rationale**: the standard is young, and gating our own test suite on a browser flag would mean the
agent boundary is only verified when someone remembers to run it manually — the exact failure Principle
V calls out ("untested tool contracts fail silently in the one place where no human is watching"). The
fake is written from the IDL in R1 and is deliberately *strict*: it rejects duplicate names and
enforces `SecureContext`-like absence, so our code cannot come to depend on a laxer host than the spec
describes.

**This does not replace real-browser review.** `document.modelContext` exists in Chrome behind the
origin trial, and the manual review script in [quickstart.md](./quickstart.md) drives every slice
through the *real* API from the DevTools console using `getTools()` and `executeTool()` — no agent
required. `npx serve out -l 4321` on localhost is a secure context, so the surface is reachable there.
When the browser lacks the API, the same review script has the reviewer paste the fake host in and
drive the identical calls.

---

## R11. Two tools cannot meet the 100 ms tool-call budget, by design

**Decision**: `playback_deduction_sequence` and `load_technique_practice` are exempt from Principle
IV's "agent tool call, invocation to returned result ≤ 100 ms". Recorded as a deviation in
[plan.md § Complexity Tracking](./plan.md). The other nine tools are measured and gate the build.

**Rationale**: both tools resolve only when something outside our control finishes.
`playback_deduction_sequence` paces steps for the learner to watch — its duration *is* the feature —
and FR-049 requires it to report how many steps completed and why it stopped, which is knowable only
at the end. `load_technique_practice` must wait for a human to answer a confirmation (FR-053) and
report their answer back.

The obvious escape — return an immediate acknowledgement and finish in the background — was rejected
because it makes FR-049 and FR-053 unimplementable: an ack cannot carry an outcome that has not
happened yet. The spec anticipated this and already exempts playback from SC-008; this extends the
same reasoning to the confirmation-gated tool and records it against the constitution rather than the
spec.

**What still holds, and is tested**: neither tool blocks the learner for a single frame (FR-051,
FR-056, SC-007), both are interruptible or declinable, and an unanswered confirmation resolves as
`declined` after 60 seconds rather than hanging forever.

---

## Decisions carried forward from feature 001

Not re-litigated, listed so the plan is self-contained:

| Decision | Where |
|---|---|
| Framework-agnostic store bound via `useSyncExternalStore` | 001 research R6 — the reason this feature is buildable at all |
| `origin: 'clue' \| 'player' \| 'agent'` on every mutating action | 001 `state/types.ts` — makes FR-042 true by construction |
| Solution quarantined inside the Engine | 001 `generate.ts` — makes FR-026 and FR-058 structural |
| Palette confined to `app/globals.css`, contrast computed | 001 research R3 |
| Bundle budget deferred, reported not gated | 001 plan § Complexity Tracking — carried forward unchanged; this feature adds **no runtime dependency** |
