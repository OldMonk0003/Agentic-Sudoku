import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The palette contract (research.md R3).
 *
 * These ratios were COMPUTED, not eyeballed, and the first candidate palette
 * failed four of them. This suite is what stops that regressing: it parses the
 * single source of truth (app/globals.css @theme) so changing any token here
 * fails the build.
 */

const cssPath = fileURLToPath(new URL('../../app/globals.css', import.meta.url));

function loadTokens(): Record<string, string> {
  const css = readFileSync(cssPath, 'utf8');
  const tokens: Record<string, string> = {};
  for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[m[1]!] = m[2]!;
  }
  return tokens;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgbToLinear(r!) + 0.7152 * srgbToLinear(g!) + 0.0722 * srgbToLinear(b!);
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const REQUIRED_TOKENS = [
  'ground', 'surface', 'wash-crosshair', 'wash-matching', 'wash-conflict',
  'ring-selected', 'ink-clue', 'ink-player', 'ink-note', 'ink-conflict',
  'line-hairline', 'line-box', 'mark-agent',
];

describe('Japandi palette', () => {
  const tokens = loadTokens();

  it('declares every required token in app/globals.css', () => {
    for (const name of REQUIRED_TOKENS) {
      expect(tokens[name], `--color-${name} missing from @theme`).toBeDefined();
    }
  });

  // Text sits on these four surfaces. 'selected' is deliberately absent: it is a
  // RING, not a fill, precisely so text never has to survive a fourth dark tier.
  const textSurfaces = ['ground', 'wash-crosshair', 'wash-matching', 'wash-conflict'] as const;

  describe.each(['ink-clue', 'ink-player', 'ink-conflict', 'ink-note'])('%s', (ink) => {
    it.each(textSurfaces)(`is at least 4.5:1 on %s`, (surface) => {
      expect(contrast(tokens[ink]!, tokens[surface]!)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it.each(textSurfaces)('selection ring clears 3.0:1 on %s (WCAG 1.4.11)', (surface) => {
    expect(contrast(tokens['ring-selected']!, tokens[surface]!)).toBeGreaterThanOrEqual(3.0);
  });

  it('box grid lines clear 3.0:1 — they carry the 3x3 structure', () => {
    expect(contrast(tokens['line-box']!, tokens['ground']!)).toBeGreaterThanOrEqual(3.0);
  });

  it('clue and player ink stay separable in greyscale', () => {
    // SC-004: a reader must tell clues from their own entries with colour removed.
    expect(contrast(tokens['ink-clue']!, tokens['ink-player']!)).toBeGreaterThanOrEqual(1.5);
  });

  it('highlight tiers form a perceptible ladder', () => {
    const ground = tokens['ground']!;
    const crosshair = tokens['wash-crosshair']!;
    const matching = tokens['wash-matching']!;
    expect(luminance(ground)).toBeGreaterThan(luminance(crosshair));
    expect(luminance(crosshair)).toBeGreaterThan(luminance(matching));
    expect(contrast(ground, matching)).toBeGreaterThanOrEqual(1.38);
  });

  it('uses no pure black or pure white anywhere (FR-052)', () => {
    for (const [name, value] of Object.entries(tokens)) {
      expect(value.toUpperCase(), `--color-${name}`).not.toBe('#FFFFFF');
      expect(value.toUpperCase(), `--color-${name}`).not.toBe('#000000');
    }
  });
});
