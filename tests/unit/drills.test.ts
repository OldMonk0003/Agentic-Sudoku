import { describe, it, expect } from 'vitest';
import { DRILLS, DRILLABLE_TECHNIQUES, drillFor } from '@/engine/drills';
import { requiresTechnique } from '@/engine/requiresTechnique';
import { countSolutions } from '@/engine/solver';
import { parsePuzzleString } from '@/engine/puzzleString';
import { TECHNIQUES } from '@/engine/techniques';

/**
 * SC-009: "100% of curated practice puzzles have exactly one solution and are
 * solvable using the technique they are tagged with."
 *
 * Both halves are checked here, and the second is checked against a DECIDABLE
 * definition rather than a claim -- see src/engine/requiresTechnique.ts. A
 * puzzle that merely permits an X-Wing teaches nothing about X-Wings, because
 * the learner will solve it another way and never see one.
 */

describe('every bundled drill', () => {
  it('there is at least one', () => {
    expect(DRILLS.length).toBeGreaterThan(0);
  });

  it.each(DRILLS)('$id is a well-formed 81-character puzzle', (drill) => {
    expect(drill.puzzleString).toHaveLength(81);
    expect(() => parsePuzzleString(drill.puzzleString)).not.toThrow();
  });

  it.each(DRILLS)('$id has EXACTLY ONE solution (Principle IV)', (drill) => {
    // A bundled puzzle earns no exemption from the uniqueness rule. This is our
    // own counting solver, not a claim by whoever authored the string.
    expect(countSolutions(parsePuzzleString(drill.puzzleString))).toBe(1);
  });

  it.each(DRILLS)('$id genuinely requires $technique (SC-009)', (drill) => {
    expect(requiresTechnique(parsePuzzleString(drill.puzzleString), drill.technique)).toBe(true);
  });

  it.each(DRILLS)('$id tags a technique that actually exists', (drill) => {
    expect(TECHNIQUES.map((t) => t.id)).toContain(drill.technique);
  });

  it('has a unique id per drill', () => {
    const ids = DRILLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the drillable list', () => {
  it('names exactly the techniques that have a drill', () => {
    expect([...DRILLABLE_TECHNIQUES].sort()).toEqual(
      [...new Set(DRILLS.map((d) => d.technique))].sort(),
    );
  });

  it('resolves a drill for each of them, and null for anything else', () => {
    for (const technique of DRILLABLE_TECHNIQUES) {
      expect(drillFor(technique)).not.toBeNull();
    }
    expect(drillFor('swordfish')).toBeNull();
    expect(drillFor('')).toBeNull();
  });

  it('does NOT claim a drill it cannot back up', () => {
    // The point of FR-054: partial coverage is a supported state, and the
    // rejection lists what is really available rather than pretending.
    for (const technique of TECHNIQUES.map((t) => t.id)) {
      if (DRILLABLE_TECHNIQUES.includes(technique)) continue;
      expect(drillFor(technique)).toBeNull();
    }
  });
});
