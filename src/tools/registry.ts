import { agentStore, agentAbsent, agentConnected, agentDisconnected } from '@/state/agentSession';
import { getBoardState } from './tools/getBoardState';
import { checkForConflicts } from './tools/checkForConflicts';
import { highlightPatternCells } from './tools/highlightPatternCells';
import { showPatternHintToast } from './tools/showPatternHintToast';
import { clearVisualAnnotations } from './tools/clearVisualAnnotations';
import { fillCell } from './tools/fillCell';
import { drawConstraintBeams } from './tools/drawConstraintBeams';
import { updatePencilMarks } from './tools/updatePencilMarks';
import { autoFillAllPencilMarks } from './tools/autoFillAllPencilMarks';
import { playbackDeductionSequence } from './tools/playbackDeductionSequence';
import { loadTechniquePractice } from './tools/loadTechniquePractice';
import { showCoordinateRuler } from './tools/showCoordinateRuler';
import { hideCoordinateRuler } from './tools/hideCoordinateRuler';
import { switchDifficulty } from './tools/switchDifficulty';
import { TOOL_SURFACE_VERSION, type ToolDescriptor } from './types';

/**
 * The WebMCP registration module (Principle I).
 *
 * Two properties are non-negotiable and both are asserted by test:
 *
 *   1. `descriptors` is enumerable with NO DOM MOUNTED. Nothing at module scope
 *      here touches `document`; feature detection happens inside a function.
 *      tests/unit/tools.surface.test.ts runs in bare Node and would crash
 *      otherwise.
 *   2. This is the ONLY module in the Tools layer permitted to touch `document`.
 *      Tool handlers must not (Principle III), and a test greps for it.
 *
 * The lifecycle is shaped entirely by the published IDL (research.md R1):
 *
 *   - `registerTool` REJECTS a duplicate name with InvalidStateError, so
 *     registration is not natively idempotent. The `handle` guard below is what
 *     makes FR-012 true under React strict mode and hot reload.
 *   - There is no `unregisterTool`. Teardown aborts the one AbortController
 *     every tool was registered with, so it removes exactly what it registered
 *     and cannot drift out of step with it.
 */

export { TOOL_SURFACE_VERSION } from './types';

/** The public contract. Order is the order an agent sees. */
export const descriptors: readonly ToolDescriptor[] = [
  getBoardState,
  checkForConflicts,
  highlightPatternCells,
  showPatternHintToast,
  clearVisualAnnotations,
  fillCell,
  drawConstraintBeams,
  updatePencilMarks,
  autoFillAllPencilMarks,
  playbackDeductionSequence,
  loadTechniquePractice,
  // Feature 003.
  showCoordinateRuler,
  hideCoordinateRuler,
  switchDifficulty,
];

export interface RegistrationHandle {
  readonly unregister: () => void;
}

let handle: RegistrationHandle | null = null;
let unsubscribe: (() => void) | null = null;

/**
 * Feature detection (FR-013). `document.modelContext` is `[SecureContext]`-gated
 * and behind a Permissions Policy, so its absence is an ordinary, supported
 * operating mode -- not an error, and never surfaced to the learner.
 */
function hostOrNull(): ModelContext | null {
  if (typeof document === 'undefined') return null;
  const context = document.modelContext;
  if (!context || typeof context.registerTool !== 'function') return null;
  return context;
}

/**
 * Register the whole surface. Idempotent: a second call returns the existing
 * handle rather than provoking InvalidStateError.
 *
 * Resolves to `null` when no host is present, and never throws -- the absence of
 * an agent must not be able to break the board.
 */
export async function registerTools(): Promise<RegistrationHandle | null> {
  if (handle) return handle;

  const host = hostOrNull();
  if (!host) {
    agentStore.dispatch(agentAbsent());
    return null;
  }

  const controller = new AbortController();

  try {
    for (const descriptor of descriptors) {
      await host.registerTool(
        {
          name: descriptor.name,
          description: descriptor.description,
          // The SAME object the validator uses. One source of truth (R5).
          inputSchema: descriptor.inputSchema,
          annotations: {
            readOnlyHint: descriptor.readOnly,
            // Results echo agent-authored text and learner input back to the
            // host. Saying so is free and correct (FR-021).
            untrustedContentHint: true,
          },
          execute: (input, options) => descriptor.execute(input, { signal: options?.signal }),
        },
        { signal: controller.signal },
      );
    }
  } catch {
    // A host that refuses registration (policy, quota, a stricter build) is not
    // a player-facing error. Leave no half-registered surface behind.
    controller.abort();
    agentStore.dispatch(agentAbsent());
    return null;
  }

  handle = {
    unregister() {
      controller.abort();
    },
  };

  // The learner's Disconnect button dispatches `requestDisconnect`; we are
  // subscribed. The button imports nothing from this layer (FR-057).
  let seenRequests = agentStore.getState().disconnectRequests;
  unsubscribe = agentStore.subscribe(() => {
    const { disconnectRequests } = agentStore.getState();
    if (disconnectRequests === seenRequests) return;
    seenRequests = disconnectRequests;
    unregisterTools();
  });

  agentStore.dispatch(agentConnected());
  return handle;
}

/** Remove exactly what was registered. Safe to call when nothing was. */
export function unregisterTools(): void {
  unsubscribe?.();
  unsubscribe = null;

  if (!handle) return;
  handle.unregister();
  handle = null;

  agentStore.dispatch(agentDisconnected());
}

/** Whether this module currently holds a registration. */
export function isRegistered(): boolean {
  return handle !== null;
}

// Re-exported so consumers need only one import.
export type { ToolDescriptor };
export const surfaceVersion = TOOL_SURFACE_VERSION;
