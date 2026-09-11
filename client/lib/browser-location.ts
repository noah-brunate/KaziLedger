'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const serverSnapshot = () => null;

export function useLocationPathname() {
  return useSyncExternalStore<string | null>(
    subscribe,
    () => window.location.pathname,
    serverSnapshot,
  );
}

export function useLocationSearch() {
  return useSyncExternalStore<string | null>(
    subscribe,
    () => window.location.search,
    serverSnapshot,
  );
}
