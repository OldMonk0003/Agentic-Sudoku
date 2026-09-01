import { describe, it, expect } from 'vitest';
import { readReadme, skillText } from '../support/skillFiles';

/**
 * The site address exists in exactly ONE place (004/FR-007a, SC-013).
 *
 * WHY THIS TEST EXISTS AT ALL. The address is `http://localhost:3000` today and
 * becomes a deployed one when the site reaches Vercel -- the author said so, so
 * **the edit is known in advance**. A change you know is coming has exactly one
 * failure mode: a second copy somewhere that nobody remembers to update, left
 * pointing at a dead address.
 *
 * So the rule is not "document the address well". It is "there is one of it",
 * and that is mechanically checkable. The README therefore says WHERE the
 * address lives rather than repeating its value (FR-007b) -- which is why the
 * second test below asserts the README does not contain it.
 */

const ADDRESS = 'http://localhost:3000';

/** Every occurrence, not merely the first -- the point is the count. */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('the site address lives in exactly one place', () => {
  it('appears exactly once across the whole skill package', () => {
    expect(occurrences(skillText(), ADDRESS)).toBe(1);
  });

  it('does not appear in the README at all', () => {
    // Two copies is the drift this whole test file exists to prevent, and the
    // README is the obvious place a second one would appear. It points at the
    // line to change instead of reproducing its value.
    expect(occurrences(readReadme(), ADDRESS)).toBe(0);
  });

  it('is not accompanied by a fallback or alternative address', () => {
    // A skill carrying both a local and a deployed address would satisfy "one
    // copy of this string" while reintroducing exactly the ambiguity the rule
    // is about. Two addresses is two addresses.
    const text = skillText();
    const urls = text.match(/https?:\/\/[^\s)"'`,]+/g) ?? [];
    const siteUrls = urls.filter((url) => !url.includes('learn.chatgpt.com') && !url.includes('github.com'));
    expect(siteUrls).toEqual([ADDRESS]);
  });
});

/**
 * The README carries what a newcomer needs (004/FR-030 -- FR-034).
 *
 * These are assertions about DOCUMENTATION, which is unusual, and they are here
 * because the requirements are specific enough to check: the install path is the
 * one Codex actually scans, the invocation form is the one that works even when
 * implicit listing does not, and the prerequisites that will silently break the
 * skill are named rather than left to be discovered by failure.
 */
describe('the README can get a newcomer from nothing to a working skill', () => {
  it('names the install location Codex actually scans', () => {
    const readme = readReadme();
    expect(readme).toContain('.agents/skills');
    // The recalled path. If it appears, someone has "corrected" the right answer
    // to the wrong one, and the skill will never be found.
    expect(readme).not.toContain('.codex/skills');
  });

  it('documents the explicit invocation form', () => {
    // Explicit `$agentic-sudoku` works whether or not the skill made it into the
    // implicit listing -- which matters, because repo-local discovery has a known
    // defect (openai/codex#16012, research.md R4).
    expect(readReadme()).toContain('$agentic-sudoku');
  });

  it('names the prerequisites that would otherwise fail silently', () => {
    const readme = readReadme();
    // WebMCP is disabled on Luna. A person on the wrong model sees a skill that
    // opens the board and then cannot do anything, with nothing on screen
    // explaining why (research.md R2).
    expect(readme).toMatch(/Luna/);
    expect(readme).toMatch(/Sol|Terra/);
  });
});
