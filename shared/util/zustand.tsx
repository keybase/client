// helpers for zustand
import * as React from 'react'
import isEqual from 'lodash/isEqual'
import {type StateCreator} from 'zustand'
import {create} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'
import {registerDebugUnClear, registerDebugClear} from '@/util/debug'
import logger from '@/logger'
// needed for tsc
export type {WritableDraft} from 'immer'

type HasReset = {dispatch: {resetDeleteMe?: boolean; resetState: 'default' | (() => void)}}

const resetters: ((isDebug?: boolean) => void)[] = []
const resettersAndDelete: ((isDebug?: boolean) => void)[] = []

registerDebugClear(() => {
  resetAllStores(true)
})
// so we can rebootstrap
registerDebugUnClear(() => {
  resetAllStores()
})

// Auto adds immer and keeps track of resets
export const createZustand = <T extends HasReset>(
  initializer: StateCreator<T, [['zustand/immer', never]]>
) => {
  const f = immerZustand(initializer)
  const store = create<T, [['zustand/immer', never]]>(f)
  // includes dispatch, custom overrides typically don't
  const initialState = store.getState()
  // wrap so we log all exceptions

  const dispatches = Object.keys(initialState.dispatch)
  const unsafeID = (initialState as any).dispatch as any
  for (const d of dispatches) {
    const orig = unsafeID[d] as any
    unsafeID[d] = (...p: Array<any>) => {
      try {
        return orig(...p)
      } catch (e) {
        if (__DEV__) {
          logger.error('Error in dispatch', d, e)
          debugger
        } else {
          logger.error('Error in dispatch', d)
        }
        throw e
      }
    }
  }

  const reset = initialState.dispatch.resetState
  let resetFunc: () => void
  if (reset === 'default') {
    resetFunc = () => {
      store.setState(initialState, true)
    }
  } else {
    resetFunc = reset
  }

  if (initialState.dispatch.resetDeleteMe) {
    resettersAndDelete.push(resetFunc)
  } else {
    resetters.push(resetFunc)
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
  const prev = React.useRef<U>()

  return state => {
    const next = selector(state)
    return isEqual(prev.current, next) ? (prev.current as U) : (prev.current = next)
  }
}
