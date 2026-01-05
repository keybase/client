import type * as T from '../types'
import * as Z from '@/util/zustand'
import * as Tabs from '../tabs'
import type {RouteKeys} from '@/router-v2/route-params'
import {storeRegistry} from '../store-registry'
import {
  navigationRef,
  getTab,
  getRootState,
  getVisibleScreen,
  type NavState,
  type PathParam,
  type Navigator,
  _getNavigator,
  logState,
  getVisiblePath,
  getModalStack,
  navToProfile,
  navToThread,
  getRouteTab,
  getRouteLoggedIn,
  useSafeFocusEffect,
  makeScreen,
  clearModals as clearModalsUtil,
  navigateAppend as navigateAppendUtil,
  navigateUp as navigateUpUtil,
  navUpToScreen as navUpToScreenUtil,
  popStack as popStackUtil,
  switchTab as switchTabUtil,
  appendEncryptRecipientsBuilder,
  appendNewChatBuilder,
  appendNewTeamBuilder,
  appendPeopleBuilder,
  setNavState as setNavStateUtil,
  type SetNavStateCallbacks,
} from './util'

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
  clearModalsUtil as clearModals,
  navigateAppendUtil as navigateAppend,
  navigateUpUtil as navigateUp,
  navUpToScreenUtil as navUpToScreen,
  popStackUtil as popStack,
  switchTabUtil as switchTab,
  appendEncryptRecipientsBuilder,
  appendNewChatBuilder,
  appendNewTeamBuilder,
  appendPeopleBuilder,
}
export type {PathParam, Navigator}

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
    navigateAppend: (path: PathParam, replace?: boolean) => void
    navigateUp: () => void
    navUpToScreen: (name: RouteKeys) => void
    popStack: () => void
    resetState: () => void
    setNavState: (ns: NavState) => void
    switchTab: (tab: Tabs.AppTab) => void
  }
  appendEncryptRecipientsBuilder: () => void
  appendNewChatBuilder: () => void
  appendNewTeamBuilder: (teamID: T.Teams.TeamID) => void
  appendPeopleBuilder: () => void
}

export const useRouterState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    clearModals: clearModalsUtil,
    dynamic: {
      tabLongPress: undefined,
    },
    navUpToScreen: navUpToScreenUtil,
    navigateAppend: navigateAppendUtil,
    navigateUp: navigateUpUtil,
    popStack: popStackUtil,
    resetState: () => {
      set(s => ({
        ...s,
        dispatch: s.dispatch,
      }))
    },
    setNavState: next => {
      const prev = get().navState as NavState
      if (prev === next) return
      set(s => {
        s.navState = next
      })

      const callbacks: SetNavStateCallbacks = {
        onRouteChanged: (prev, next) => {
          storeRegistry.getState('chat').dispatch.onRouteChanged(prev, next)
        },
        updateFS: (prev, next) => {
          if (
            prev &&
            getTab(prev) === Tabs.fsTab &&
            next &&
            getTab(next) !== Tabs.fsTab &&
            storeRegistry.getState('fs').criticalUpdate
          ) {
            const {dispatch} = storeRegistry.getState('fs')
            dispatch.setCriticalUpdate(false)
          }
          const fsRrouteNames = ['fsRoot', 'barePreview']
          const wasScreen = fsRrouteNames.includes(getVisibleScreen(prev)?.name ?? '')
          const isScreen = fsRrouteNames.includes(getVisibleScreen(next)?.name ?? '')
          if (wasScreen !== isScreen) {
            const {dispatch} = storeRegistry.getState('fs')
            if (wasScreen) {
              dispatch.userOut()
            } else {
              dispatch.userIn()
            }
          }
        },
        updatePeople: (prev, next) => {
          if (prev && getTab(prev) === Tabs.peopleTab && next && getTab(next) !== Tabs.peopleTab) {
            storeRegistry.getState('people').dispatch.markViewed()
          }
        },
        updateSettings: (prev, next) => {
          if (
            prev &&
            getTab(prev) === Tabs.settingsTab &&
            next &&
            getTab(next) !== Tabs.settingsTab &&
            storeRegistry.getState('settings-email').addedEmail
          ) {
            storeRegistry.getState('settings-email').dispatch.resetAddedEmail()
          }
        },
        updateSignup: (prev, next) => {
          if (
            prev &&
            getTab(prev) === Tabs.peopleTab &&
            next &&
            getTab(next) !== Tabs.peopleTab &&
            storeRegistry.getState('signup').justSignedUpEmail
          ) {
            storeRegistry.getState('signup').dispatch.clearJustSignedUpEmail()
          }
        },
        updateTeamBuilding: (prev, next) => {
          const namespaces = ['chat2', 'crypto', 'teams', 'people'] as const
          const namespaceToRoute = new Map([
            ['chat2', 'chatNewChat'],
            ['crypto', 'cryptoTeamBuilder'],
            ['teams', 'teamsTeamBuilder'],
            ['people', 'peopleTeamBuilder'],
          ])
          for (const namespace of namespaces) {
            const wasTeamBuilding = namespaceToRoute.get(namespace) === getVisibleScreen(prev)?.name
            if (wasTeamBuilding) {
              const isTeamBuilding = namespaceToRoute.get(namespace) === getVisibleScreen(next)?.name
              if (!isTeamBuilding) {
                storeRegistry.getTBStore(namespace).dispatch.cancelTeamBuilding()
              }
            }
          }
        },
        updateTeams: (prev, next) => {
          if (prev && getTab(prev) === Tabs.teamsTab && next && getTab(next) !== Tabs.teamsTab) {
            storeRegistry.getState('teams').dispatch.clearNavBadges()
          }
        },
      }

      setNavStateUtil(prev, next, callbacks)
    },
    switchTab: switchTabUtil,
  }

  return {
    ...initialStore,
    appendEncryptRecipientsBuilder,
    appendNewChatBuilder,
    appendNewTeamBuilder,
    appendPeopleBuilder,
    dispatch,
  }
})
