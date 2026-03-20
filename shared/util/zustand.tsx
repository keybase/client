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
    resetState: (isDebug?: boolean) => void
  }
}

export type InitialDispatch<T extends HasReset['dispatch']> = Omit<T, 'resetState'> &
  {
    resetState?: T['resetState']
    resetStateDefault?: true
  }

type InitialState<T extends HasReset> = Omit<T, 'dispatch'> & {
  dispatch: InitialDispatch<T['dispatch']>
}

const resetters: ((isDebug?: boolean) => void)[] = []
const resettersAndDelete: ((isDebug?: boolean) => void)[] = []

// HMR store registry — preserves store instances across hot module reloads
// Uses globalThis so the registry survives module re-evaluation during HMR
// eslint-disable-next-line
const _hmrRegistry: Map<string, unknown> = __DEV__ ? ((globalThis as any).__ZUSTAND_HMR__ ??= new Map()) : new Map()

// Auto adds immer and keeps track of resets
export const createZustand = <T extends HasReset>(
  hmrKeyOrInitializer: string | StateCreator<T, [['zustand/immer', never]], [], InitialState<T>>,
  maybeInitializer?: StateCreator<T, [['zustand/immer', never]], [], InitialState<T>>
) => {
  const hmrKey = typeof hmrKeyOrInitializer === 'string' ? hmrKeyOrInitializer : undefined
  const initializer = typeof hmrKeyOrInitializer === 'string' ? maybeInitializer! : hmrKeyOrInitializer

  const f = immerZustand(initializer as any)
  const store = create<T, [['zustand/immer', never]]>(f as any)

  // During HMR, return the existing store to preserve state and subscribers
  if (__DEV__ && hmrKey && _hmrRegistry.has(hmrKey)) {
    return _hmrRegistry.get(hmrKey) as typeof store
  }
  // includes dispatch, custom overrides typically don't
  const initialState = store.getState() as unknown as InitialState<T>
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

  const hasDefaultReset = initialState.dispatch.resetStateDefault === true
  let initialDispatch!: T['dispatch']
  let resetFunc: (isDebug?: boolean) => void
  if (hasDefaultReset) {
    resetFunc = () => {
      const currentDefer = store.getState().dispatch.defer
      const hasInitialDefer = Object.hasOwn(initialDispatch, 'defer')
      const nextDispatch =
        hasInitialDefer || currentDefer !== undefined
          ? {...initialDispatch, defer: currentDefer}
          : initialDispatch
      // eslint-disable-next-line
      store.setState({...initialState, dispatch: nextDispatch} as any, true)
    }
    unsafeISD['resetState'] = wrapErrors(resetFunc, 'resetState')
  } else {
    const reset = initialState.dispatch.resetState
    if (!reset) {
      throw new Error('createZustand requires dispatch.resetState or dispatch.resetStateDefault')
    }
    resetFunc = reset
  }

  delete unsafeISD['resetStateDefault']
  initialDispatch = {...unsafeISD} as T['dispatch']

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

export type ImmerStateCreator<T extends HasReset> = StateCreator<
  T,
  [['zustand/immer', never]],
  [],
  InitialState<T>
>
export {useShallow} from 'zustand/react/shallow'

export function useDeep<S, U>(selector: (state: S) => U): (state: S) => U {
  const prev = React.useRef<U>(undefined)

  return state => {
    const next = selector(state)
    return isEqual(prev.current, next) ? (prev.current as U) : (prev.current = next)
  }
}
