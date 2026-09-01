import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reading the Codex skill package from disk, for the tests that guard it.
 *
 * The skill is a DATA FILE, and the four tests over it assert properties of that
 * data against the code that owns the truth -- `descriptors` from the Tools
 * layer, `TECHNIQUES` from the Engine. That is the same move
 * tests/unit/palette.contrast.test.ts makes on app/globals.css, and for the same
 * reason: a hand-maintained copy of a contract drifts, and the drift is silent.
 *
 * One definition of "the skill directory" lives here so four test files cannot
 * disagree about what they are reading.
 */

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * `.agents/skills`, NOT `.codex/skills`.
 *
 * Codex scans `.agents/skills` from the working directory up to the repository
 * root, and `$HOME/.agents/skills` for personal skills
 * (specs/004-codex-sudoku-skill/research.md R1). The recalled path is wrong and
 * fails SILENTLY -- no error, just a skill that never triggers, which is exactly
 * how `navigator.modelContext` vs `document.modelContext` fails.
 */
export const SKILL_DIR = join(repoRoot, '.agents', 'skills', 'agentic-sudoku');
export const SKILL_NAME = 'agentic-sudoku';
export const SKILL_MD = join(SKILL_DIR, 'SKILL.md');
export const OPENAI_YAML = join(SKILL_DIR, 'agents', 'openai.yaml');
export const README = join(repoRoot, 'README.md');

/** Every file in the skill package, recursively. Absolute paths. */
export function skillFilePaths(): readonly string[] {
  if (!existsSync(SKILL_DIR)) return [];

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });

  return walk(SKILL_DIR).sort();
}

/**
 * Everything the skill says, concatenated.
 *
 * The prohibition tests ask "does this string appear ANYWHERE in the package?",
 * so they need the whole package as one haystack -- a tool name is no less
 * leaked for being in `openai.yaml` rather than `SKILL.md`.
 */
export function skillText(): string {
  return skillFilePaths()
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
}

export function readSkillMd(): string {
  return existsSync(SKILL_MD) ? readFileSync(SKILL_MD, 'utf8') : '';
}

export function readReadme(): string {
  return readFileSync(README, 'utf8');
}

/**
 * The YAML frontmatter, parsed just far enough.
 *
 * Deliberately not a YAML dependency: the frontmatter Codex requires is two
 * scalar keys, and adding a parser to read them would be a runtime dependency
 * added to check a two-line header.
 */
export function frontmatter(): Record<string, string> | null {
  const source = readSkillMd();
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return null;

  const fields: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) fields[key] = value;
  }
  return fields;
}

/** The body, with the frontmatter removed. */
export function skillBody(): string {
  return readSkillMd().replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}
