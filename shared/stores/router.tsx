import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import type * as Util from '@/constants/router'

export {type NavState} from '@/constants/router'

type Store = T.Immutable<{
  navState?: unknown
}>

const initialStore: Store = {
  navState: undefined,
}

export type State = Store & {
  dispatch: {
    resetState: () => void
    setNavState: (ns: Util.NavState) => void
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
      DEBUG_NAV && console.log('[Nav] setNavState')
      const prev = get().navState as Util.NavState
      if (prev === next) return
      set(s => {
        s.navState = next
      })
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
