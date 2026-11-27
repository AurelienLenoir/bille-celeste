import { useSyncExternalStore } from 'preact/compat';
import type { StoreApi } from 'zustand/vanilla';

/** Subscribes a component to a Zustand store; `select` should return a stable value (state field). */
export const useStore = <S, T>(store: StoreApi<S>, select: (state: S) => T): T =>
  useSyncExternalStore(store.subscribe, () => select(store.getState()));
