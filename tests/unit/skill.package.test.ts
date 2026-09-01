import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  SKILL_DIR, SKILL_MD, SKILL_NAME, OPENAI_YAML,
  frontmatter, skillFilePaths, skillText,
} from '../support/skillFiles';

/**
 * The skill package is a VALID Codex skill (004/FR-001 -- FR-004).
 *
 * Every constraint here is transcribed from OpenAI's published documentation
 * rather than recalled (004/research.md R1). The one that matters most is the
 * PATH: Codex scans `.agents/skills`, and a skill at the widely-recalled
 * `.codex/skills` is simply never found -- no error, no warning, no trigger.
 * `SKILL_DIR` encodes the correct path, so this file fails if it ever moves.
 */

describe('the skill package is a valid Codex skill', () => {
  it('lives at .agents/skills/agentic-sudoku', () => {
    expect(existsSync(SKILL_DIR)).toBe(true);
    // The path is the load-bearing part. Assert it explicitly rather than
    // trusting the helper, so a future edit to SKILL_DIR cannot silently move
    // the skill somewhere Codex will not look.
    expect(SKILL_DIR.endsWith('/.agents/skills/agentic-sudoku')).toBe(true);
    expect(SKILL_DIR).not.toContain('.codex');
  });

  it('has a SKILL.md, which is the only required file', () => {
    expect(existsSync(SKILL_MD)).toBe(true);
  });

  it('has parseable YAML frontmatter carrying name and description', () => {
    const fields = frontmatter();
    expect(fields).not.toBeNull();
    expect(fields!.name).toBeTruthy();
    expect(fields!.description).toBeTruthy();
  });

  it('has a name matching its directory, because that name is the invocation token', () => {
    // Invoked as `$agentic-sudoku`. A mismatch between the frontmatter name and
    // the folder is the kind of thing that works on one host and not another.
    expect(frontmatter()!.name).toBe(SKILL_NAME);
  });

  it('has a description that says when NOT to trigger, not only when to', () => {
    const description = frontmatter()?.description ?? '';
    // Codex matches implicitly on this field and may truncate it, so it has to
    // be dense and it has to bound itself. A description that only says "use
    // this for sudoku" will fire on someone editing this repository's source.
    expect(description.length).toBeGreaterThan(80);
    expect(description.toLowerCase()).toMatch(/\bnot\b/);
  });

  it('declares the human-readable name in agents/openai.yaml', () => {
    // `name` must be a slug for `$` invocation, so the name the request actually
    // asked for -- "Agentic Sudoku" -- lives here.
    expect(existsSync(OPENAI_YAML)).toBe(true);
    expect(readFileSync(OPENAI_YAML, 'utf8')).toContain('Agentic Sudoku');
  });

  it('is self-contained: nothing in it points into this repository', () => {
    // FR-002/FR-003. A copy of this directory alone must be a working skill, so
    // it may not reference a path that only exists inside the repo. Someone who
    // installs it has never cloned this project.
    const text = skillText();
    for (const path of ['src/', 'tests/', 'specs/', 'app/', '@/', 'node_modules']) {
      expect(text, `skill must not reference the repository path "${path}"`).not.toContain(path);
    }
  });

  it('ships instructions only -- no scripts to execute', () => {
    // The format permits scripts/. This skill deliberately has none: a script
    // would be a second place behaviour could live, and the whole artifact is
    // meant to be readable by a person deciding whether to trust it (FR-004).
    for (const path of skillFilePaths()) {
      expect(path).toMatch(/\.(md|yaml|yml)$/);
    }
  });
});
