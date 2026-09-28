import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {castDraft} from 'immer'
import type {NavState} from '@/constants/nav-tree'

export {type NavState} from '@/constants/nav-tree'

type Store = T.Immutable<{
  navState?: NavState
}>

const initialStore: Store = {
  navState: undefined,
}

export type State = Store & {
  dispatch: {
    resetState: () => void
    setNavState: (ns: T.Immutable<NavState>) => void
  }
}

export const useRouterState = Z.createZustand<State>('router', (set, get) => {
  const dispatch: State['dispatch'] = {
    resetState: () => {
      set(s => ({
        ...s,
        dispatch: s.dispatch,
      }))
    },
    setNavState: next => {
      const DEBUG_NAV = __DEV__ && (false as boolean)
      if (DEBUG_NAV) {
        console.log('[Nav] setNavState')
      }
      const prev = get().navState
      if (prev === next) return
      set(s => {
        s.navState = castDraft(next)
      })
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
