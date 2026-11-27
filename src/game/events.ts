export type GameEvents = {
  /** The level was (re)initialised: counters are back to zero. */
  reset: { total: number };
  respawned: { x: number; y: number; z: number };
  tick: { time: number };
  crystalCollected: { collected: number; total: number };
  allCrystalsCollected: undefined;
  checkpointReached: undefined;
  fell: { falls: number };
  goalLocked: { missing: number };
  levelWon: { time: number; falls: number };
};

type Listener<T> = (payload: T) => void;

export type EventBus<E> = {
  on: <K extends keyof E>(type: K, listener: Listener<E[K]>) => () => void;
  emit: <K extends keyof E>(type: K, ...payload: E[K] extends undefined ? [] : [E[K]]) => void;
};

/** Typed synchronous event bus: game/ emits, ui/ and audio listen. */
export const createEventBus = <E>(): EventBus<E> => {
  const listeners = new Map<keyof E, Set<Listener<never>>>();
  return {
    on: (type, listener) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
      return () => set.delete(listener);
    },
    emit: (type, ...payload) => {
      listeners.get(type)?.forEach((listener) => (listener as Listener<unknown>)(payload[0]));
    },
  };
};
