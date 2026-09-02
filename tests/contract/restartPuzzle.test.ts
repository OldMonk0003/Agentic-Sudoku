import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, pause, enterDigitAt } from '@/state/actions';
import { agentStore, clearAnnotations } from '@/state/agentSession';
import { createRestartPuzzleTool, restartPuzzle } from '@/tools/tools/restartPuzzle';
import { toCoord } from '@/engine/grid';
import type { PuzzleGenerator } from '@/tools/boardReplacement';
import type { Difficulty } from '@/state/types';

/**
 * Contract tests for `restart_puzzle` (005/FR-008 -- FR-011).
 *
 * The tool means "SAME LEVEL, NEW GRID", and takes no arguments because of it:
 * an agent that had to supply the difficulty could supply the wrong one, and
 * then this would be `switch_difficulty` wearing a different name.
 *
 * Generation is injected here, as it is for `switch_difficulty`, because the
 * real path needs the UI layer to be subscribed -- `src/tools -> src/ui` is a
 * lint error, so the tool raises a request and the View performs it. The
 * injected generator stands in for that subscriber.
 */

const EXPLANATION = 'Starting you a fresh board at the same level, since this one is not going anywhere.';

const succeeds = (difficulty: Difficulty = 'easy'): PuzzleGenerator => ({
  async generate() {
    // Stand in for the View: put a new board up, as `puzzleLoader` would.
    store.dispatch(newPuzzle(difficulty, Math.floor(Math.random() * 1e9)));
    return { ok: true };
  },
});

const fails: PuzzleGenerator = { async generate() { return { ok: false }; } };

const empty = () => {
  const index = store.getState().cells.findIndex((cell) => cell.value === null);
  return toCoord(index);
};

beforeEach(() => {
  store.dispatch(newPuzzle('medium', 24242));
  agentStore.dispatch(clearAnnotations());
});

describe('restart_puzzle: shape', () => {
  it('is named, mutating, and requires narration', () => {
    expect(restartPuzzle.name).toBe('restart_puzzle');
    expect(restartPuzzle.readOnly).toBe(false);
    expect(restartPuzzle.inputSchema.required).toContain('explanation');
  });

  it('takes no argument other than the explanation', () => {
    // FR: the difficulty comes from the board, never from the agent.
    expect(Object.keys(restartPuzzle.inputSchema.properties ?? {})).toEqual(['explanation']);
    expect(restartPuzzle.inputSchema.additionalProperties).toBe(false);
  });

  it('is rejected without an explanation, before anything changes', async () => {
    const before = store.getState().puzzle!.puzzleString;
    const tool = createRestartPuzzleTool({ generator: succeeds() });

    const result = await tool.execute({});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
    expect(store.getState().puzzle!.puzzleString).toBe(before);
  });

  it('describes itself without promising a confirmation', () => {
    // 005 repealed the prompt. A description that still promised one would be
    // the defect 002/FR-006 exists to prevent -- an agent reads this at runtime.
    expect(restartPuzzle.description.toLowerCase()).not.toMatch(/confirm|ask the human|permission/);
  });
});

describe('restart_puzzle: replacing the board', () => {
  it('keeps the difficulty the board was already on', async () => {
    const level = store.getState().puzzle!.difficulty;
    const tool = createRestartPuzzleTool({ generator: succeeds(level) });

    const result = await tool.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'restarted', difficulty: level });
  });

  it('resets the clock and clears the undo history', async () => {
    store.dispatch(enterDigitAt(empty(), 5, 'player'));
    expect(store.getState().history.length).toBe(1);

    const tool = createRestartPuzzleTool({ generator: succeeds('medium') });
    await tool.execute({ explanation: EXPLANATION });

    expect(store.getState().history.length).toBe(0);
    expect(store.getState().elapsedMs).toBe(0);
  });

  it('replaces a board with progress on it WITHOUT asking (005/FR-020)', async () => {
    store.dispatch(enterDigitAt(empty(), 5, 'player'));
    const tool = createRestartPuzzleTool({ generator: succeeds('medium') });

    const result = await tool.execute({ explanation: EXPLANATION });

    // The repeal, asserted. Before feature 005 this raised a prompt and waited.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'restarted' });
    // Falsy before US3 (slot present but never filled) and after (slot gone).
    expect((agentStore.getState() as unknown as Record<string, unknown>).confirmation).toBeFalsy();
  });
});

describe('restart_puzzle: status', () => {
  it('is rejected while the board is paused', async () => {
    store.dispatch(pause());
    const before = store.getState().puzzle!.puzzleString;
    const tool = createRestartPuzzleTool({ generator: succeeds() });

    const result = await tool.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('wrong-status');
    expect(store.getState().puzzle!.puzzleString).toBe(before);
  });

  it('leaves the board exactly as it was when generation fails', async () => {
    // 003/FR-036, inherited: an unverified puzzle must never reach a player, and
    // the agent must be TOLD rather than left to infer it from a timeout.
    const before = store.getState().puzzle!.puzzleString;
    const tool = createRestartPuzzleTool({ generator: fails });

    const result = await tool.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('generation-failed');
    expect(store.getState().puzzle!.puzzleString).toBe(before);
  });
});
