import { describe, it, expect } from 'vitest';
import { readReadme, siteAddress, skillText } from '../support/skillFiles';

/**
 * The site address has ONE source of truth (004/FR-007a, SC-013).
 *
 * The rule was originally "the address appears exactly once, and nowhere else"
 * -- written while the board was only on localhost and a deployed address was a
 * known, pending change. That change has now happened, which is the moment such
 * a rule either proves its worth or turns out to have been the wrong shape.
 *
 * It was slightly the wrong shape. What matters is not that the address appears
 * once in the world, but that there is never MORE THAN ONE ANSWER to "where is
 * the board?". A README that links to the live site is ordinary and useful; a
 * README that links to a *different* address than the skill opens is a bug that
 * would take a confused person to find.
 *
 * So the rule is now NO DIVERGENCE rather than NO DUPLICATION:
 *
 *   - the skill names the address exactly once, and that occurrence is canonical
 *   - anything else that names a board address must name that same one
 *
 * The canonical value is READ FROM THE SKILL rather than written here. A test
 * with its own copy of the address would be exactly the second source of truth
 * it exists to forbid -- and would need editing on the next move, which is how
 * these rules quietly rot.
 */

/** Every occurrence, not merely the first -- the point is the count. */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Anything that looks like it might be where the board lives. */
function boardAddressesIn(text: string): readonly string[] {
  const urls = text.match(/https?:\/\/[^\s)"'`,<>\]]+/g) ?? [];
  return urls
    .map((url) => url.replace(/[.,]$/, ''))
    .filter((url) => /localhost|127\.0\.0\.1|vercel\.app/.test(url));
}

describe('the site address has one source of truth', () => {
  it('is declared on exactly one line of the skill', () => {
    const address = siteAddress();
    expect(address, 'SKILL.md must carry a "Site address:" line').not.toBeNull();
    expect(occurrences(skillText(), address!)).toBe(1);
  });

  it('is served from a secure context, or WebMCP will not exist there', () => {
    // `document.modelContext` is [SecureContext]-gated. https qualifies and so
    // does localhost; a plain-http remote address would leave the skill opening
    // a board with no tools on it, which is a silent and very confusing failure.
    const address = siteAddress()!;
    const secure = address.startsWith('https://')
      || address.startsWith('http://localhost')
      || address.startsWith('http://127.0.0.1');
    expect(secure, `"${address}" is not a secure context, so the tool surface would not be published there`).toBe(true);
  });

  it('is the only board address the skill names', () => {
    // Two addresses would satisfy "one copy of this string" while reintroducing
    // precisely the ambiguity the rule is about.
    expect(boardAddressesIn(skillText())).toEqual([siteAddress()!]);
  });

  it('is the only board address the README names', () => {
    // The README may link to the live site -- that is useful and expected. What
    // it may not do is name a DIFFERENT one, which is how a stale localhost
    // survives a deployment and sends someone to a board that is not running.
    const address = siteAddress()!;
    for (const found of boardAddressesIn(readReadme())) {
      expect(
        found.replace(/\/$/, ''),
        `README names "${found}" but the skill opens "${address}" -- there must be one answer to where the board is`,
      ).toBe(address.replace(/\/$/, ''));
    }
  });
});

/**
 * The README can get a newcomer from nothing to a working skill
 * (004/FR-030 -- FR-034).
 *
 * Assertions about documentation, which is unusual, and they are here because
 * these particular facts fail SILENTLY when wrong: a skill installed to the
 * wrong path simply never triggers, and the wrong model publishes no tools at
 * all. Neither produces an error a reader could act on.
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
    // `$agentic-sudoku` works whether or not the skill made it into the implicit
    // listing -- which matters, because repo-local discovery has a known defect
    // (openai/codex#16012, research.md R4).
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
