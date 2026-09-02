import { ANNOTATION_TTL_MS, materialise, unexpired } from './annotations';
import { EXPLANATION_TTL_MS, TOAST_TTL_MS, toastOrNull, unexpiredExplanations } from './explanations';
import { liveSpotlight, makeSpotlight } from './spotlight';
import type { AgentAction } from './agentActions';
import type { AgentSession } from './agentSession';

/**
 * How each agent action changes the session.
 *
 * Split out of agentSession.ts at Principle III's 300-line review trigger. Two
 * comments in here are load-bearing rather than decorative -- the one on
 * `clearAnnotations` and the one on `expire` -- because both encode a decision
 * that looks like an oversight until you know why.
 */

/** Returns the next session, or null when nothing changed. */
export function reduceAgent(session: AgentSession, action: AgentAction): AgentSession | null {
  switch (action.type) {
    case 'agentConnected':
      return session.connection === 'connected' ? null : { ...session, connection: 'connected' };

    case 'agentDisconnected':
      return session.connection === 'disconnected' ? null : { ...session, connection: 'disconnected' };

    case 'agentAbsent':
      return session.connection === 'absent' ? null : { ...session, connection: 'absent' };

    case 'requestDisconnect':
      return { ...session, disconnectRequests: session.disconnectRequests + 1 };

    case 'learnerActed':
      return { ...session, learnerActivity: session.learnerActivity + 1 };

    case 'addAnnotations': {
      if (action.annotations.length === 0) return null;
      const { annotations, nextId } = materialise(
        action.annotations,
        session.nextId,
        action.now + (action.ttlMs ?? ANNOTATION_TTL_MS),
      );
      return { ...session, annotations: [...session.annotations, ...annotations], nextId };
    }

    case 'clearAnnotations': {
      // Deliberately does NOT clear the explanation queue: clear_visual_annotations
      // would otherwise erase its own narration the instant it made it.
      // The spotlight IS cleared -- it is one of the agent's marks (003/FR-023).
      if (session.annotations.length === 0 && session.toast === null && session.spotlight === null) {
        return null;
      }
      return { ...session, annotations: [], toast: null, spotlight: null };
    }

    case 'raiseSpotlight': {
      // `makeSpotlight` returns null above the cell threshold, and assigning
      // that null is DELIBERATE: leaving the previous spotlight up would point
      // at a cell that is no longer the most recent change, which is worse than
      // showing nothing (003/R3).
      const spotlight = makeSpotlight(action.cells, action.now);
      if (spotlight === null && session.spotlight === null) return null;
      return { ...session, spotlight };
    }

    case 'pushExplanation':
      return {
        ...session,
        explanations: [
          ...session.explanations,
          {
            id: `e${session.nextId}`,
            text: action.text,
            tool: action.tool,
            createdAt: action.now,
            expiresAt: action.now + (action.ttlMs ?? EXPLANATION_TTL_MS),
          },
        ],
        nextId: session.nextId + 1,
      };

    case 'dismissExplanation': {
      const remaining = session.explanations.filter((e) => e.id !== action.id);
      if (remaining.length === session.explanations.length) return null;
      return { ...session, explanations: remaining };
    }

    case 'showToast':
      // One at a time: a queue of coaching notes would outlive the moment they
      // were coaching about.
      return {
        ...session,
        toast: {
          id: `t${session.nextId}`,
          text: action.text,
          expiresAt: action.now + (action.ttlMs ?? TOAST_TTL_MS),
        },
        nextId: session.nextId + 1,
      };

    case 'dismissToast':
      return session.toast === null ? null : { ...session, toast: null };

    case 'expire': {
      const annotations = unexpired(session.annotations, action.now);
      const explanations = unexpiredExplanations(session.explanations, action.now);
      const toast = toastOrNull(session.toast, action.now);
      const spotlight = liveSpotlight(session.spotlight, action.now);

      // Reporting "no change" is what stops the View's expiry interval from
      // notifying subscribers twice a second for nothing.
      if (
        annotations.length === session.annotations.length &&
        explanations.length === session.explanations.length &&
        toast === session.toast &&
        spotlight === session.spotlight
      ) {
        return null;
      }

      return { ...session, annotations, explanations, toast, spotlight };
    }

    case 'setReducedMotion':
      return session.reducedMotion === action.value ? null : { ...session, reducedMotion: action.value };

    case 'playbackStarted':
      return {
        ...session,
        playback: { running: true, totalSteps: action.totalSteps, completedSteps: 0 },
      };

    case 'playbackAdvanced':
      if (!session.playback) return null;
      return {
        ...session,
        playback: { ...session.playback, completedSteps: session.playback.completedSteps + 1 },
      };

    case 'playbackEnded':
      if (!session.playback) return null;
      return { ...session, playback: { ...session.playback, running: false } };


    case 'requestPuzzle':
      return {
        ...session,
        puzzleRequest: { difficulty: action.difficulty, id: session.puzzleRequests + 1 },
        puzzleRequests: session.puzzleRequests + 1,
      };

    case 'puzzleGenerationFailed':
      return { ...session, puzzleFailures: session.puzzleFailures + 1 };
  }
}

