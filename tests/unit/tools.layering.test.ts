import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Principle III at the new boundary, asserted rather than reviewed.
 *
 * `eslint-plugin-import` enforces the import DIRECTIONS. These are the two rules
 * it cannot express:
 *
 *   1. "Tool handlers MUST NOT touch the DOM directly." Only registry.ts may see
 *      `document`, because `document.modelContext` is where the standard lives.
 *   2. The UI and Tools layers meet ONLY at the agent session store -- which is
 *      what lets playback stop on learner input, and the Disconnect button
 *      unregister tools, without either side knowing the other exists.
 */

const src = (p: string) => fileURLToPath(new URL(`../../src/${p}`, import.meta.url));

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? filesIn(full) : /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const toolFiles = filesIn(src('tools'));
const uiFiles = filesIn(src('ui'));
const stateFiles = filesIn(src('state'));
const engineFiles = filesIn(src('engine'));

const read = (file: string) => readFileSync(file, 'utf8');
const name = (file: string) => file.slice(file.lastIndexOf('/') + 1);

describe('only the registration module touches the DOM', () => {
  const allowed = new Set(['registry.ts', 'webmcp.d.ts', 'AgentBootstrap.tsx']);

  it.each(toolFiles.filter((f) => !allowed.has(name(f))))(
    '%s references neither document nor window',
    (file) => {
      const source = read(file);
      expect(source, `${name(file)} touches document`).not.toMatch(/\bdocument\b/);
      expect(source, `${name(file)} touches window`).not.toMatch(/\bwindow\b/);
    },
  );

  it('registry.ts is the one place document.modelContext appears', () => {
    const offenders = toolFiles.filter(
      (f) => name(f) !== 'registry.ts' && name(f) !== 'webmcp.d.ts' && read(f).includes('modelContext'),
    );
    expect(offenders.map(name)).toEqual([]);
  });
});

describe('the UI and the Tools layer never import each other', () => {
  it('no tools module imports a UI module', () => {
    const offenders = toolFiles.filter((f) => /from '@\/ui\//.test(read(f)));
    expect(offenders.map(name)).toEqual([]);
  });

  it('no UI module imports a tools module', () => {
    const offenders = uiFiles.filter((f) => /from '@\/tools\//.test(read(f)));
    expect(offenders.map(name)).toEqual([]);
  });

  it('they both import the agent session store, which is the seam', () => {
    const toolsUse = toolFiles.some((f) => read(f).includes('@/state/agentSession'));
    const uiUse = uiFiles.some((f) => read(f).includes('agentSession') || read(f).includes('useAgentStore'));
    expect(toolsUse && uiUse).toBe(true);
  });
});

describe('the lower layers never reach up', () => {
  it('no engine module imports state, ui, or tools', () => {
    for (const file of engineFiles) {
      const source = read(file);
      expect(source, name(file)).not.toMatch(/from '@\/(state|ui|tools)\//);
    }
  });

  it('no state module imports ui or tools', () => {
    for (const file of stateFiles) {
      const source = read(file);
      expect(source, name(file)).not.toMatch(/from '@\/(ui|tools)\//);
    }
  });

  it('no engine or state module imports React', () => {
    for (const file of [...engineFiles, ...stateFiles]) {
      expect(read(file), name(file)).not.toMatch(/from 'react'/);
    }
  });
});

describe('module sizes against Principle III"s 300-line review trigger', () => {
  const all = [...engineFiles, ...stateFiles, ...toolFiles, ...uiFiles];

  it('reports the largest modules', () => {
    const sizes = all
      .map((file) => ({ file: name(file), lines: read(file).split('\n').length }))
      .sort((a, b) => b.lines - a.lines);

    console.log('largest modules:', sizes.slice(0, 5));
    expect(sizes.length).toBeGreaterThan(0);
  });

  it('no module has crossed the trigger without being split', () => {
    const over = all
      .map((file) => ({ file: name(file), lines: read(file).split('\n').length }))
      .filter((entry) => entry.lines > 300);

    // 001 split actions.ts at 296; 002 split agentSession.ts at 366. The rule is
    // a REVIEW trigger, not a hard failure -- but nothing here should be over it
    // without a recorded reason, and nothing currently is.
    expect(over).toEqual([]);
  });
});
