'use client';

import { useSyncExternalStore } from 'react';
import { preferencesStore } from '@/state/preferences';
import type { Preferences } from '@/state/preferences';

/**
 * The ONLY binding between React and the preferences store, mirroring
 * useStore.ts and useAgentStore.ts.
 *
 * Keeping it to one file is what lets `src/state/preferences.ts` stay
 * React-free -- which is what lets the ruler tools drive the same data with no
 * DOM mounted, and what lets the store be contract-tested in bare Node.
 */
export function usePreferences(): Preferences {
  return useSyncExternalStore(
    preferencesStore.subscribe,
    preferencesStore.getState,
    preferencesStore.getState, // server snapshot: identical, since there is no server
  );
}

export function useRulerVisible(): boolean {
  return useSyncExternalStore(
    preferencesStore.subscribe,
    () => preferencesStore.getState().rulerVisible,
    () => preferencesStore.getState().rulerVisible,
  );
}

export { preferencesStore };
