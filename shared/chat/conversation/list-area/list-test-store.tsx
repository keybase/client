// Test support shared by the thread list harnesses: a tiny external store the tests drive in place
// of the thread, center and input providers.
import * as React from 'react'

export type Store<S> = {
  get: () => S
  reset: (s: S) => void
  set: (partial: Partial<S>) => void
  subscribe: (listener: () => void) => () => void
}

export const makeStore = <S extends object>(initial: S): Store<S> => {
  let state = initial
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(l => l())
  return {
    get: () => state,
    reset: (s: S) => {
      state = s
      emit()
    },
    set: (partial: Partial<S>) => {
      state = {...state, ...partial}
      emit()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const useStore = <S extends object, R>(store: Store<S>, selector: (s: S) => R): R =>
  React.useSyncExternalStore(store.subscribe, () => selector(store.get()))
