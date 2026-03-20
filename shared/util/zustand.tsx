// helpers for zustand
import * as React from 'react'
import isEqual from 'lodash/isEqual'
import {type StateCreator} from 'zustand'
import {create} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'
import {wrapErrors} from '@/util/debug'

// needed for tsc
export type {WritableDraft} from 'immer'

type HasReset = {
  dispatch: {
    defer?: Record<string, unknown>
    resetDeleteMe?: boolean
    resetState: 'default' | (() => void)
  }
}

const resetters: ((isDebug?: boolean) => void)[] = []
const resettersAndDelete: ((isDebug?: boolean) => void)[] = []

// HMR store registry — preserves store instances across hot module reloads
// Uses globalThis so the registry survives module re-evaluation during HMR
// eslint-disable-next-line
const _hmrRegistry: Map<string, unknown> = __DEV__ ? ((globalThis as any).__ZUSTAND_HMR__ ??= new Map()) : new Map()

// Auto adds immer and keeps track of resets
export const createZustand = <T extends HasReset>(
  hmrKeyOrInitializer: string | StateCreator<T, [['zustand/immer', never]]>,
  maybeInitializer?: StateCreator<T, [['zustand/immer', never]]>
) => {
  const hmrKey = typeof hmrKeyOrInitializer === 'string' ? hmrKeyOrInitializer : undefined
  const initializer = typeof hmrKeyOrInitializer === 'string' ? maybeInitializer! : hmrKeyOrInitializer

  const f = immerZustand(initializer)
  const store = create<T, [['zustand/immer', never]]>(f)

  // During HMR, return the existing store to preserve state and subscribers
  if (__DEV__ && hmrKey && _hmrRegistry.has(hmrKey)) {
    return _hmrRegistry.get(hmrKey) as typeof store
  }
  // includes dispatch, custom overrides typically don't
  const initialState = store.getState()
  // wrap so we log all exceptions

  const dispatches = Object.keys(initialState.dispatch)
  const unsafeISD = (initialState as {dispatch: {[key: string]: unknown}}).dispatch
  for (const d of dispatches) {
    const orig = unsafeISD[d]
    if (typeof orig === 'function') {
      unsafeISD[d] = wrapErrors(orig as () => void, d)
      // copy over things like .cancel etc
      Object.assign(unsafeISD[d] as object, orig)
    }
  }

  const reset = initialState.dispatch.resetState
  let resetFunc: () => void
  if (reset === 'default') {
    resetFunc = () => {
      const currentDefer = store.getState().dispatch.defer
      // eslint-disable-next-line
      store.setState({...initialState, dispatch: {...initialState.dispatch, defer: currentDefer}} as any, true)
    }
    unsafeISD.resetState = wrapErrors(resetFunc, 'resetState')
  } else {
    resetFunc = reset
  }

  if (initialState.dispatch.resetDeleteMe) {
    resettersAndDelete.push(resetFunc)
  } else {
    resetters.push(resetFunc)
  }

  if (__DEV__ && hmrKey) {
    _hmrRegistry.set(hmrKey, store)
  }

  return store
}

export const resetAllStores = (isDebug?: boolean) => {
  for (const resetter of resetters) {
    resetter(isDebug)
  }
  for (const resetter of resettersAndDelete) {
    resetter(isDebug)
  }
  resettersAndDelete.length = 0
}

export type ImmerStateCreator<T> = StateCreator<T, [['zustand/immer', never]]>
export {useShallow} from 'zustand/react/shallow'

export function useDeep<S, U>(selector: (state: S) => U): (state: S) => U {
  const prev = React.useRef<U>(undefined)

  return state => {
    const next = selector(state)
    return isEqual(prev.current, next) ? (prev.current as U) : (prev.current = next)
  }
}
