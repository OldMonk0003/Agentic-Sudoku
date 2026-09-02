# Specification Quality Checklist: Restart, Undo, and Prompt-Free Board Replacement

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-02
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic (no implementation details)
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

**Iteration 2 — all items pass. The one marker is resolved by the author.**

**FR-028 (now FR-020 through FR-027) — the confirmation prompt is repealed.** Three routes were put
to the author: keep the prompt and let the agent answer it, declare consent inline on the call, or
drop the prompt entirely. **They chose to drop it.** That is the simplest of the three, and it is
recorded as a full repeal of 002/FR-053 and 003/FR-030 rather than a softening of them.

**A consequence the author should see, flagged rather than assumed away.** Every confirmation in this
product is raised by an agent-initiated replacement. Repealing it for those leaves no code path that
can raise one — so the mechanism does not become optional, it becomes dead. FR-024 therefore requires
it to be retired rather than left in place unreachable, because a dormant safeguard reads to a future
maintainer like a live one.

**The cost, since a checklist is where it should be legible.** Two features were built around the
rule that an agent may not discard the learner's board unasked. After this, an agent that misreads
"this is too easy" as "replace this" destroys an hour of work with no question, no undo — a replaced
board is not in the undo history — and no retained copy, since only one game is saved. The learner's
sole remaining protection is Disconnect, which helps only if reached first. The spec states this in
the Assumptions rather than burying it, and names the follow-up feature (recovering a replaced board)
that would blunt it.

**What survives**: the narration contract, untouched. The replacement still cannot happen silently,
and the agent's reason still appears on screen. FR-022 makes that non-negotiable precisely because it
is now the learner's *only* account of why their board changed.

**Deliberately not asked**: whether the agent may undo the learner's own moves. Recorded as an
assumption instead, with its cost (no redo exists, so the work is destroyed) and its three bounds
(narrated, attributed, and the agent can be disconnected). The alternative — restricting the agent to
its own changes — would make "undo" mean something other than what the button does, which is worse.
