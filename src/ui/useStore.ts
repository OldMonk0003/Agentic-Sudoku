'use client';

import { useSyncExternalStore } from 'react';
import { store } from '@/state/store';
import type { GameSession } from '@/state/types';

/**
 * The ONLY binding between React and the store. Keeping this to one file is what
 * lets the state layer stay React-free -- see src/state/store.ts for why that
 * matters to feature 002.
 */
export function useSession(): GameSession {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState, // server snapshot: identical, since there is no server
  );
}

export function useSelector<T>(select: (session: GameSession) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getState()),
    () => select(store.getState()),
  );
}

export { store };
