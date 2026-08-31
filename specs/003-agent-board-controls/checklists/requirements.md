# Specification Quality Checklist: Agent Board Controls & Coordinate Ruler

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-31
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
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

## Notes

**Three clarifications were resolved with the author before the spec was written**, rather than left
as markers:

1. **Ruler scope** — one call shows the complete 1-through-9 ruler on both axes (as in the supplied
   screenshot), not a targeted row/column. → FR-009.
2. **Ruler persistence and ownership** — sticky until explicitly removed, exempt from 002/FR-033's
   auto-expiry, with the learner given their own toggle. → FR-012, FR-013.
3. **What moves when the agent fills** — a separate agent-attributed spotlight, *not* the learner's
   selection. This preserves 002/FR-056 rather than overriding it, and preserves the
   coordinate-addressed write design. → FR-018 through FR-020.

**Three points a reviewer should object to by name if they disagree**, all recorded in Assumptions:

- **An agent pause obscures the board**, which sits closest of anything here to 002/FR-056. Accepted
  on the grounds that the learner's own Resume control is always present and never agent-dependent
  (FR-043). This is the only place in the feature where an agent action obscures the board.
- **Resuming is carved out of 002/FR-045** (changes rejected while paused). Without the carve-out the
  pause tool is a one-way door for the agent. → FR-040.
- **The ruler is the single exemption from 002/FR-033** (annotations expire automatically). It is
  classed as a learner view preference rather than a teaching annotation, which is what earns the
  exemption. → FR-012, FR-014.

**Deliberately out of scope**, and unchanged by this feature: the missing `x-wing` and `naked-single`
drills, the offline-reload gap (SC-009 of feature 001), and the deferred 250 KB bundle budget.

**One item for `/speckit-plan` to settle, not the spec**: whether the ruler preference belongs in the
existing persisted session schema or beside it. FR-015 states the requirement; where it is stored is a
design decision, and the stored-data schema version will need attention either way.

> **Settled by the plan** ([research.md R2](../research.md#r2), 2026-08-31): **beside it** — a third
> store with its own key, `agentic-sudoku/preferences`. This leaves the session's `SCHEMA_VERSION` at
> 1, so no existing saved game is discarded. The alternative, bumping the session schema to 2, would
> have thrown away every player's in-progress board to gain one boolean that is not session data.
