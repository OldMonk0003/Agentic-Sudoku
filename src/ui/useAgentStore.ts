'use client';

import { useSyncExternalStore } from 'react';
import { agentStore } from '@/state/agentSession';
import type { AgentSession } from '@/state/agentSession';

/**
 * The ONLY binding between React and the agent session store, mirroring
 * useStore.ts for the game store.
 *
 * Keeping it to one file is what lets `src/state/agentSession.ts` stay
 * React-free -- which is what lets the Tools layer read and write the same data
 * with no DOM mounted.
 */
export function useAgentSession(): AgentSession {
  return useSyncExternalStore(
    agentStore.subscribe,
    agentStore.getState,
    agentStore.getState, // server snapshot: identical, since there is no server
  );
}

export function useAgentSelector<T>(select: (session: AgentSession) => T): T {
  return useSyncExternalStore(
    agentStore.subscribe,
    () => select(agentStore.getState()),
    () => select(agentStore.getState()),
  );
}

export { agentStore };
