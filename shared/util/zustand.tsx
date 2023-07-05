// helpers for redux / zustand
import type {TypedActions} from '../actions/typed-actions-gen'
import type {TypedState} from '../constants/reducer'
import {create as _create, type StateCreator, type StoreMutatorIdentifier} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'

type TypedDispatch = (action: TypedActions) => void

export const getReduxDispatch: () => TypedDispatch = () => (a: TypedActions) =>
  require('../store/configure-store').getGlobalStore().dispatch(a)

export const getReduxStore: () => () => TypedState = () => () =>
  require('../store/configure-store').getGlobalStore().getState()

export const ignorePromise = (f: Promise<void>) => {
  f.then(() => {}).catch(() => {})
}

export async function neverThrowPromiseFunc<T>(f: () => Promise<T>) {
  try {
    return await f()
  } catch {
    return undefined
  }
}

export const timeoutPromise = async (timeMs: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), timeMs)
  })

export const dummyListenerApi = {
  delay: async () => Promise.resolve(),
  dispatch: () => {},
  fork: () => {
    throw new Error('dummy')
  },
  getState: () => {
    throw new Error('dummy')
  },
  take: () => {
    throw new Error('dummy')
  },
}

type HasReset = {dispatch: {resetState: 'default' | (() => void)}}

const resetters: (() => void)[] = []
// Auto adds immer and keeps track of resets
export const createZustand = <
  T extends HasReset,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  initializer: StateCreator<T, [...Mps, ['zustand/immer', never]], Mcs>
) => {
  const f = immerZustand(initializer)
  const store = _create<T>(f as StateCreator<T>)
  const initialState = store.getState()
  const reset = initialState.dispatch.resetState
  if (reset === 'default') {
    resetters.push(() => {
      store.setState(initialState, true)
    })
  } else {
    resetters.push(reset)
  }
  return store
}

export const resetAllStores = () => {
  for (const resetter of resetters) {
    resetter()
  }
}
