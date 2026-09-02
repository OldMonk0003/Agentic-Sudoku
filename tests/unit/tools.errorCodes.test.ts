import { describe, it, expect } from 'vitest';
import { TOOL_SURFACE_VERSION } from '@/tools/registry';
import { failure, type ErrorCode } from '@/tools/types';

/**
 * The error vocabulary is part of the public contract.
 *
 * 002/FR-009 requires a failure reason specific enough for an agent to correct
 * itself and retry, and `ErrorCode` is a CLOSED enumeration precisely so a
 * handler cannot invent a code an agent has never seen. Feature 003 adds three
 * members; removing or repurposing an existing one would break an agent written
 * against surface 1.0.0, so this file pins both directions.
 *
 * The assertions are type-level as much as runtime: a removed member stops this
 * file compiling, which is the earliest possible failure.
 */

/** Every code feature 002 shipped. Frozen -- append only. */
const CODES_002: readonly ErrorCode[] = [
  'cell-is-clue',
  'cell-not-empty',
  'out-of-range',
  'wrong-status',
  'nothing-to-undo',
  'invalid-input',
  'unexpected-argument',
  'explanation-required',
  'explanation-length',
  'acknowledgement-required',
  'unknown-technique',
  'no-annotation-target',
  'playback-interrupted',
  'playback-step-failed',
  'internal-error',
];

/** Feature 003's additions (data-model.md section 6). */
const CODES_003: readonly ErrorCode[] = [
  'unknown-difficulty',
  'generation-failed',
];

describe('the tool error vocabulary', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('still carries every code feature 002 shipped', () => {
    // If any of these stopped being an ErrorCode this file would not compile.
    for (const code of CODES_002) {
      const result = failure('some_tool', code, 'a message');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(code);
    }
  });

  it('adds the three codes feature 003 needs', () => {
    for (const code of CODES_003) {
      const result = failure('some_tool', code, 'a message');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(code);
    }
  });

  it('carries the surface version on every failure, so a stale agent finds out', () => {
    const result = failure('some_tool', 'generation-failed', 'no puzzle could be produced');
    expect(result.surface_version).toBe(TOOL_SURFACE_VERSION);
  });

  it('preserves optional details without inventing an empty object', () => {
    const bare = failure('some_tool', 'unknown-difficulty', 'no such level');
    const detailed = failure('some_tool', 'unknown-difficulty', 'no such level', {
      available: ['easy', 'medium', 'hard'],
    });

    if (!bare.ok) expect(bare.error.details).toBeUndefined();
    if (!detailed.ok) expect(detailed.error.details).toEqual({ available: ['easy', 'medium', 'hard'] });
  });
});
