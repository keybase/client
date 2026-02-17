import type * as T from '../types'
import * as Z from '@/util/zustand'
import * as Tabs from '../tabs'
import type {RouteKeys} from '@/router-v2/route-params'
import {storeRegistry} from '../store-registry'
import * as Util from './util'

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
  switchTab,
} from './util'
export type {PathParam, Navigator} from './util'

type Store = T.Immutable<{
  navState?: unknown
}>

const initialStore: Store = {
  navState: undefined,
}

export interface State extends Store {
  dispatch: {
    clearModals: () => void
    dynamic: {
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
    dynamic: {
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

      const updateTeamBuilding = () => {
        const namespaces = ['chat2', 'crypto', 'teams', 'people'] as const
        const namespaceToRoute = new Map([
          ['chat2', 'chatNewChat'],
          ['crypto', 'cryptoTeamBuilder'],
          ['teams', 'teamsTeamBuilder'],
          ['people', 'peopleTeamBuilder'],
        ])
        for (const namespace of namespaces) {
          const wasTeamBuilding = namespaceToRoute.get(namespace) === Util.getVisibleScreen(prev)?.name
          if (wasTeamBuilding) {
            // team building or modal on top of that still
            const isTeamBuilding = namespaceToRoute.get(namespace) === Util.getVisibleScreen(next)?.name
            if (!isTeamBuilding) {
              storeRegistry.getTBStore(namespace).dispatch.cancelTeamBuilding()
            }
          }
        }
      }
      updateTeamBuilding()

      const updateFS = () => {
        // Clear critical update when we nav away from tab
        if (
          prev &&
          Util.getTab(prev) === Tabs.fsTab &&
          next &&
          Util.getTab(next) !== Tabs.fsTab &&
          storeRegistry.getState('fs').criticalUpdate
        ) {
          const {dispatch} = storeRegistry.getState('fs')
          dispatch.setCriticalUpdate(false)
        }
        const fsRrouteNames = ['fsRoot', 'barePreview']
        const wasScreen = fsRrouteNames.includes(Util.getVisibleScreen(prev)?.name ?? '')
        const isScreen = fsRrouteNames.includes(Util.getVisibleScreen(next)?.name ?? '')
        if (wasScreen !== isScreen) {
          const {dispatch} = storeRegistry.getState('fs')
          if (wasScreen) {
            dispatch.userOut()
          } else {
            dispatch.userIn()
          }
        }
      }
      updateFS()

      const updateSignup = () => {
        // Clear "just signed up email" when you leave the people tab after signup
        if (
          prev &&
          Util.getTab(prev) === Tabs.peopleTab &&
          next &&
          Util.getTab(next) !== Tabs.peopleTab &&
          storeRegistry.getState('signup').justSignedUpEmail
        ) {
          storeRegistry.getState('signup').dispatch.clearJustSignedUpEmail()
        }
      }
      updateSignup()

      const updatePeople = () => {
        if (prev && Util.getTab(prev) === Tabs.peopleTab && next && Util.getTab(next) !== Tabs.peopleTab) {
          storeRegistry.getState('people').dispatch.markViewed()
        }
      }
      updatePeople()

      const updateTeams = () => {
        if (prev && Util.getTab(prev) === Tabs.teamsTab && next && Util.getTab(next) !== Tabs.teamsTab) {
          storeRegistry.getState('teams').dispatch.clearNavBadges()
        }
      }
      updateTeams()

      const updateSettings = () => {
        // Clear "check your inbox" in settings when you leave the settings tab
        if (
          prev &&
          Util.getTab(prev) === Tabs.settingsTab &&
          next &&
          Util.getTab(next) !== Tabs.settingsTab &&
          storeRegistry.getState('settings-email').addedEmail
        ) {
          storeRegistry.getState('settings-email').dispatch.resetAddedEmail()
        }
      }
      updateSettings()

      storeRegistry.getState('chat').dispatch.onRouteChanged(prev, next)
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
