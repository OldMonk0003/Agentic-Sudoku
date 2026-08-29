# Specification Quality Checklist: WebMCP Agent Tutor

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-29
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — *with one justified exception, below*
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Accepted Exception: naming the standard

`WebMCP` and `document.modelContext` appear in FR-001 and are named in the Assumptions. This is a
deliberate, justified exception to "no APIs", not an oversight:

- The integration standard *is* the requirement here. The feature does not exist independently of it,
  and the author and the constitution (Principle I) both mandate it by name.
- Naming it is a product-level constraint, not a technology choice made during planning. There is no
  alternative implementation of the requirement that would be discovered later.
- No method signatures, argument shapes, event names, or lifecycle mechanics appear in the spec. How
  registration, unregistration, cancellation, and result serialisation actually work is deferred
  entirely to `/speckit-plan`.

The eleven tool names are likewise treated as product vocabulary, since they form the public contract
the author specified and that agents will depend on.

## Validation Record

**Iteration 1** — one internal contradiction found and fixed:

| Item | Issue found | Resolution |
|------|-------------|------------|
| Requirements testable and unambiguous | FR-043 required any multi-cell tool call to be one undo step, while FR-050 required walkthrough steps to be individually undoable. A walkthrough is a multi-cell tool call, so the two rules contradicted for playback | FR-043 now names `playback_deduction_sequence` as its sole explicit exception, with the reasoning |

**Iteration 2** — re-validated. All items pass, subject to the accepted exception above. Zero
`[NEEDS CLARIFICATION]` markers; ambiguities resolved as documented defaults in Assumptions.

## Source Verification

The WebMCP specification at <https://webmachinelearning.github.io/webmcp/> was fetched and read
before writing this spec. Findings that shaped requirements:

- Registration is `registerTool(tool, options)`; tools carry `name`, `description`, `execute`, and
  optional `title`, `inputSchema`, `annotations`. Informs FR-001, FR-003, FR-006.
- `annotations.readOnlyHint` exists, giving the read/write distinction a standard home. Informs FR-005.
- Tool names are limited to 1–128 characters of ASCII alphanumerics, underscore, hyphen, or period.
  **All eleven names in the author's table comply.**
- Handlers return a promise whose value is serialised to JSON — there is no built-in error channel, so
  success and failure must be modelled in the returned value. Informs FR-008 and FR-009.
- There is no in-place tool update; changing a tool means unregistering and re-registering. Informs
  FR-012 and the versioning rule in FR-010.
- Unregistration is driven by an abort signal, and execution can be cancelled mid-flight — which is
  what makes the interruptible walkthrough of FR-048 achievable rather than aspirational.
- The interface is `[SecureContext]` and gated by a `tools` permissions policy defaulting to `self`.
  Informs the HTTPS assumption, FR-013, and the permission-refused edge case.

## Constitution Alignment

Checked against `.specify/memory/constitution.md` v1.1.0:

- **Principle I (WebMCP compliance)** — FR-001 through FR-013 carry it in full: standard-only surface,
  strict schemas, structured results rather than thrown errors, feature detection with unimpaired
  human play, a versioned tool contract, and registration isolated from rendering and enumerable
  headlessly.
- **Principle II (Zero-backend)** — FR-055 and FR-059 keep drills bundled and the surface offline.
- **Principle III (Modularity)** — no structural claims made; deferred to `/speckit-plan`.
- **Principle IV (Puzzle integrity & budgets)** — FR-052 and SC-009 hold drills to unique solutions.
  SC-008 carries the responsiveness budget, with `playback_deduction_sequence` documented in
  Assumptions as its one deliberate exemption.
- **Principle V (Test-first & non-blocking)** — FR-018, FR-051, FR-056, and SC-007 carry non-blocking;
  FR-035, FR-044, FR-060, and SC-004 carry the non-colour-cue and agent-vs-human distinction the
  constitution requires; FR-061 carries reduced motion.
- **Security posture** — FR-021 and SC-012 treat agent text as untrusted and forbid interpreting it as
  markup, matching the constitution's rule against rendering non-constant input as markup.

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- Fourteen assumptions are recorded. Three are departures from the author's brief rather than gap
  filling, and should be confirmed or overridden before planning: **`check_for_conflicts` reclassified
  as read-only**, **`playback_deduction_sequence` exempted from the responsiveness budget**, and
  **agent-initiated board replacement gated behind learner confirmation**.
