import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import type * as Tabs from '@/constants/tabs'
import type {RouteKeys} from '@/router-v2/route-params'
import * as Util from '@/constants/router2'

export {
  type NavState,
  getTab,
  navigationRef,
  getRootState,
  _getNavigator,
  logState,
  getVisiblePath,
  getModalStack,
  getVisibleScreen,
  navToProfile,
  navToThread,
  getRouteTab,
  getRouteLoggedIn,
  useSafeFocusEffect,
  makeScreen,
} from '@/constants/router2'
export type {PathParam, Navigator} from '@/constants/router2'

type Store = T.Immutable<{
  navState?: unknown
}>

const initialStore: Store = {
  navState: undefined,
}

export interface State extends Store {
  dispatch: {
    clearModals: () => void
    defer: {
      tabLongPress?: (tab: string) => void
    }
    navigateAppend: (path: Util.PathParam, replace?: boolean) => void
    navigateUp: () => void
    navUpToScreen: (name: RouteKeys) => void
    popStack: () => void
    resetState: () => void
    setNavState: (ns: Util.NavState) => void
    switchTab: (tab: Tabs.AppTab) => void
  }
  appendEncryptRecipientsBuilder: () => void
  appendNewChatBuilder: () => void
  appendNewTeamBuilder: (teamID: T.Teams.TeamID) => void
  appendPeopleBuilder: () => void
}

export const useRouterState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    clearModals: Util.clearModals,
    defer: {
      tabLongPress: undefined,
    },
    navUpToScreen: Util.navUpToScreen,
    navigateAppend: Util.navigateAppend,
    navigateUp: Util.navigateUp,
    popStack: Util.popStack,
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
    switchTab: Util.switchTab,
  }

  return {
    ...initialStore,
    appendEncryptRecipientsBuilder: Util.appendEncryptRecipientsBuilder,
    appendNewChatBuilder: Util.appendNewChatBuilder,
    appendNewTeamBuilder: Util.appendNewTeamBuilder,
    appendPeopleBuilder: Util.appendPeopleBuilder,
    dispatch,
  }
})
