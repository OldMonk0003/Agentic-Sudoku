import { describe, it, expect } from 'vitest';
import { descriptors } from '@/tools/registry';
import { skillText } from '../support/skillFiles';

/**
 * THE test this feature exists to be protected by (004/FR-014, SC-011).
 *
 * The skill instructs an agent to read the tool surface FROM THE LIVE PAGE. It
 * must therefore contain no copy of that surface -- no tool name, no tool
 * description -- and the reason is not tidiness:
 *
 *   1. A copy is a second, unversioned statement of a contract the site already
 *      publishes. It drifts on the first change to the site, and nothing tells
 *      anyone it has.
 *   2. Worse, a copy lets a session SUCCEED that the site's own descriptions
 *      could not have carried -- which masks the exact defect this feature was
 *      built to detect. 002/SC-001 ("an agent that has never encountered this
 *      site can use it from the tool descriptions alone") has been unverified
 *      since feature 002. A skill that quietly explains the tools makes that
 *      criterion permanently unmeasurable while appearing to satisfy it.
 *
 * The temptation to paste the list in is strong precisely because it would make
 * the skill feel more helpful. So this is not defended by review.
 *
 * IT READS THE LIVE REGISTRY, NOT A TRANSCRIPTION. A hard-coded list of sixteen
 * names would itself be a copy, and would need editing when a seventeenth tool
 * arrives. Importing `descriptors` means a new tool is covered the day it is
 * registered, with no edit here.
 *
 * That import works in this `node` project with no DOM because Principle I
 * requires the registration module to be enumerable headlessly -- the same
 * property tests/unit/tools.surface.test.ts asserts directly. This test is a
 * second consumer of it.
 *
 * It is the same move tests/unit/palette.contrast.test.ts makes on
 * app/globals.css: assert a property of a data file against the code that owns
 * the truth.
 */

describe('the skill contains no copy of the tool surface', () => {
  it('reads a non-empty live surface, so the assertions below are not vacuous', () => {
    // Without this, an import that silently resolved to nothing would make every
    // "none of these appear" assertion below pass by having nothing to look for.
    // That is the failure mode of a prohibition test, and it is invisible.
    expect(descriptors.length).toBeGreaterThan(0);
  });

  it('names no registered tool', () => {
    const text = skillText();
    for (const descriptor of descriptors) {
      expect(
        text,
        `The skill must not name "${descriptor.name}". The agent reads the tool surface from the page at run time (FR-014); a copy here would drift from the site and would mask an inadequate description on the site rather than exposing it.`,
      ).not.toContain(descriptor.name);
    }
  });

  it('does not reproduce a registered tool description', () => {
    const text = skillText();
    for (const descriptor of descriptors) {
      // A heuristic where the name check is exact: descriptions are long
      // sentences, and any paste of one starts at its beginning. Enough to catch
      // the realistic failure -- someone copying the surface in wholesale.
      const opening = descriptor.description.slice(0, 40);
      expect(
        text,
        `The skill must not reproduce the description of "${descriptor.name}"; it is published by the page and read from there.`,
      ).not.toContain(opening);
    }
  });

  it('does not state how many tools there are', () => {
    // "the sixteen tools" is a copy of the surface in the one place it is most
    // tempting, and it is wrong the moment a seventeenth is registered. The
    // agent reports what it found; it is never told what to expect to find.
    const text = skillText().toLowerCase();
    for (const count of ['sixteen tools', '16 tools', 'eleven tools', 'eleven', 'sixteen']) {
      expect(text, `The skill must not assert a tool count ("${count}")`).not.toContain(count);
    }
  });
});
