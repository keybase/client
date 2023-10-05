// helpers for redux / zustand
import * as React from 'react'
import isEqual from 'lodash/isEqual'
import {type StateCreator} from 'zustand'
import {create} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'

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

type HasReset = {dispatch: {resetState: 'default' | (() => void)}}

const resetters: (() => void)[] = []
// Auto adds immer and keeps track of resets
export const createZustand = <T extends HasReset>(
  initializer: StateCreator<T, [['zustand/immer', never]]>
) => {
  const f = immerZustand(initializer)
  const store = create<T, [['zustand/immer', never]]>(f)
  // includes dispatch, custom overrides typically don't
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

export type ImmerStateCreator<T> = StateCreator<T, [['zustand/immer', never]]>
export {useShallow} from 'zustand/shallow'

export function useDeep<S, U>(selector: (state: S) => U): (state: S) => U {
  const prev = React.useRef<U>()

  return state => {
    const next = selector(state)
    return isEqual(prev.current, next) ? (prev.current as U) : (prev.current = next)
  }
}
