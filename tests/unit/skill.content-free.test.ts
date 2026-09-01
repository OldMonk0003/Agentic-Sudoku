import { describe, it, expect } from 'vitest';
import { TECHNIQUES } from '@/engine/techniques';
import { skillBody, skillText } from '../support/skillFiles';

/**
 * The skill teaches nothing about Sudoku (004/FR-027, FR-029, SC-011).
 *
 * The author chose "content-free" deliberately when asked. The skill says four
 * things -- open the board, read the surface, report it, act only through it --
 * and carries one address. It contains no solving guidance, no technique, no
 * coaching tone, and no suggested opening move.
 *
 * WHY THAT IS WORTH ENFORCING RATHER THAN JUST INTENDING. Feature 002 decided
 * that teaching content comes from the agent, not the site: the site supplies
 * the board and the tools and holds no lesson text of its own. A skill full of
 * coaching would quietly relocate the curriculum back into this repository,
 * where it would be unversioned, untested, and invisible to the site's own
 * design.
 *
 * And it would make 002/SC-001 unmeasurable. If a session goes well because the
 * skill explained how to play, nothing has been learned about whether the tool
 * descriptions are adequate -- which is the one thing this feature was built to
 * find out.
 *
 * As with the tool-name guard, the technique list is IMPORTED from the Engine
 * rather than transcribed, so a sixth technique is covered the day it is added.
 */

/**
 * Solving vocabulary. A skill that needs any of these words is explaining the
 * game, which is the agent's job and the site's business -- not this file's.
 */
const SOLVING_VOCABULARY: readonly string[] = [
  'technique', 'strategy', 'candidate', 'pencil mark',
  'deduce', 'deduction', 'eliminate', 'elimination',
  'naked', 'hidden single', 'x-wing', 'constraint',
];

/**
 * Coaching vocabulary. FR-029 forbids a tone or a teaching style as much as it
 * forbids technique names: "be encouraging" is content, and it is content that
 * would shape a run.
 */
const COACHING_VOCABULARY: readonly string[] = [
  'encourage', 'encouraging', 'praise', 'friendly tone',
  'be patient', 'gently', 'tutor them', 'teaching style', 'pedagog',
];

describe('the skill teaches nothing about Sudoku', () => {
  it('reads a non-empty technique registry, so the assertion below is not vacuous', () => {
    expect(TECHNIQUES.length).toBeGreaterThan(0);
  });

  it('names no solving technique', () => {
    const text = skillText().toLowerCase();
    for (const technique of TECHNIQUES) {
      expect(
        text,
        `The skill must not name the technique "${technique.id}". Teaching content comes from the agent, not from this repository (002 Out of Scope, 004/FR-027).`,
      ).not.toContain(technique.id.toLowerCase());
    }
  });

  it('uses no solving vocabulary', () => {
    const text = skillText().toLowerCase();
    for (const word of SOLVING_VOCABULARY) {
      expect(text, `The skill must not use the solving term "${word}"`).not.toContain(word);
    }
  });

  it('carries no coaching tone or teaching style', () => {
    const text = skillText().toLowerCase();
    for (const word of COACHING_VOCABULARY) {
      expect(text, `The skill must not coach ("${word}") -- FR-029`).not.toContain(word);
    }
  });

  it('stays short enough that content cannot have crept in unnoticed', () => {
    /*
      A blunt instrument, and the honest one.

      The vocabulary lists above catch the failures anyone thought of in advance.
      They cannot catch a well-meaning paragraph of guidance written in words
      nobody predicted -- and that is the realistic way this file decays: not one
      forbidden word, but a section that "just helps a bit".

      Four instructions and an address fit comfortably. If this trips, something
      was added, and the question to ask is what it is doing here rather than how
      to raise the ceiling.
    */
    expect(skillBody().length).toBeLessThan(6000);
  });
});
