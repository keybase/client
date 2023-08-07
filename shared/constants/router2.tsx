import {createNavigationContainerRef, StackActions, CommonActions} from '@react-navigation/core'
import * as Z from '../util/zustand'
import * as Container from '../util/container'
import * as Tabs from '../constants/tabs'
import isEqual from 'lodash/isEqual'
import logger from '../logger'
import shallowEqual from 'shallowequal'
import type {ConversationIDKey} from './types/chat2/common'
import type {NavigationState} from '@react-navigation/core'
import type {NavigateAppendType} from '../router-v2/route-params'
export type PathParam = NavigateAppendType
type Route = NavigationState['routes'][0]
export type NavState = Route['state']

export const navigationRef_ = createNavigationContainerRef()
export const _getNavigator = () => {
  return navigationRef_.isReady() ? navigationRef_ : undefined
}

export const getRootState = (): NavState | undefined => {
  if (!navigationRef_.isReady()) return
  return navigationRef_.getRootState()
}

const _isLoggedIn = (s: NavState) => {
  if (!s) {
    return false
  }
  return s?.routes?.[0]?.name === 'loggedIn'
}

// Public API
// gives you loggedin/tab/stackitems + modals
export const getVisiblePath = (navState?: NavState) => {
  const rs = navState || getRootState()

  const findVisibleRoute = (arr: Array<Route>, s: NavState, depth: number): Array<Route> => {
    if (!s || !s.routes || s.index === undefined) {
      return arr
    }
    let childRoute: Route = s.routes[s.index] as Route
    if (!childRoute) {
      return arr
    }

    let toAdd: Array<Route>
    let toAddModals: Array<Route> = []
    // special handling of modals, we keep them to the side to add them later, then go down the visible tab
    if (depth === 0) {
      childRoute = s.routes[0] as Route
      toAdd = [childRoute]
      toAddModals = s.routes.slice(1) as Array<Route>
    } else {
      // include items in the stack
      if (s.type === 'stack') {
        toAdd = s.routes as Array<Route>
      } else {
        toAdd = [childRoute]
      }
    }

    const nextArr = [...arr, ...toAdd]
    const children = findVisibleRoute(nextArr, childRoute.state, depth + 1)
    return [...children, ...toAddModals]
  }

  if (!rs) return []
  const vs = findVisibleRoute([], rs, 0)
  return vs
}

export const getModalStack = (navState?: NavState) => {
  const rs = navState || getRootState()
  if (!rs) {
    return []
  }
  if (!_isLoggedIn(rs)) {
    return []
  }
  return rs.routes?.slice(1) ?? []
}

export const getVisibleScreen = (navState?: NavState) => {
  const visible = getVisiblePath(navState)
  return visible[visible.length - 1]
}

type DeepWriteable<T> = {-readonly [P in keyof T]: DeepWriteable<T[P]>}

const navUpHelper = (s: DeepWriteable<NavState>, name: string) => {
  const route = s?.routes[s?.index ?? -1] as DeepWriteable<Route>
  if (!route) {
    return
  }

  // found?
  if (route.name === name) {
    // selected a root stack? choose just the root item
    if (route.state?.type === 'stack') {
      route.state.routes.length = 1
      route.state.index = 0
    } else {
      // leave alone? maybe this never happens
      route.state = undefined
    }
    return
  }

  // search stack for target
  if (route.state?.type === 'stack') {
    const idx = route.state.routes.findIndex(r => r.name === name)
    // found
    if (idx !== -1) {
      route.state.index = idx
      route.state.routes.length = idx + 1
      return
    }
  }
  // try the incoming s
  if (s?.type === 'stack') {
    const idx = s.routes.findIndex(r => r.name === name)
    // found
    if (idx !== -1) {
      s.index = idx
      s.routes.length = idx + 1
      return
    }
  }

  navUpHelper(route.state, name)
}

export const getTab = (navState?: NavState) => {
  const s = navState || getRootState()
  const loggedInRoute = s?.routes[0]
  if (loggedInRoute?.name === 'loggedIn') {
    return loggedInRoute.state?.routes?.[loggedInRoute.state?.index ?? 0]?.name
  }
  return undefined
}

const isSplit = !Container.isMobile || Container.isTablet // Whether the inbox and conversation panels are visible side-by-side.

export const navToThread = (conversationIDKey: ConversationIDKey) => {
  const rs = getRootState()
  // some kind of unknown race, just bail
  if (!rs) {
    console.log('Avoiding trying to nav to thread when missing nav state, bailing')
    return
  }
  if (!rs.routes) {
    console.log('Avoiding trying to nav to thread when malformed nav state, bailing')
    return
  }

  const nextState = Container.produce(rs, draft => {
    const loggedInRoute = draft.routes[0]
    const loggedInTabs = loggedInRoute?.state?.routes
    if (!loggedInTabs) {
      return
    }
    const chatTabIdx = loggedInTabs.findIndex(r => r.name === Tabs.chatTab)
    const chatStack = loggedInTabs[chatTabIdx]

    if (!chatStack) {
      return
    }

    // select tabs
    draft.index = 0
    // remove modals
    draft.routes.length = 1

    // select chat tab
    if (loggedInRoute.state) {
      loggedInRoute.state.index = chatTabIdx
    }

    if (isSplit) {
      // set inbox + convo
      chatStack.state = chatStack.state ?? {index: 0, routes: []}
      chatStack.state.index = 0

      let chatRoot = chatStack.state?.routes?.[0]
      // key is required or you'll run into issues w/ the nav
      chatRoot = {
        key: chatRoot?.key || `chatRoot-${conversationIDKey}`,
        name: 'chatRoot',
        params: {conversationIDKey},
      }
      // @ts-ignore
      chatStack.state.routes = [chatRoot]
    } else {
      // set inbox + convo
      chatStack.state = chatStack.state ?? {index: 0, routes: []}
      chatStack.state.index = 1
      // key is required or you'll run into issues w/ the nav
      let convoRoute: any = {
        key: `chatConversation-${conversationIDKey}`,
        name: 'chatConversation',
        params: {conversationIDKey},
      }
      // reuse visible route if it's the same
      const visible = chatStack.state?.routes?.[chatStack.state?.routes?.length - 1]
      if (visible) {
        // @ts-ignore TODO better route types
        if (visible.name === 'chatConversation' && visible.params?.conversationIDKey === conversationIDKey) {
          convoRoute = visible
        }
      }

      const chatRoot = chatStack.state.routes?.[0]
      chatStack.state.routes = [chatRoot, convoRoute]
    }
  })

  if (!isEqual(rs, nextState)) {
    rs.key && _getNavigator()?.dispatch({...CommonActions.reset(nextState), target: rs.key})
  }
}

export const getRouteTab = (route: Array<Route>) => {
  return route[1]?.name
}

export const getRouteLoggedIn = (route: Array<Route>) => {
  return route[0]?.name === 'loggedIn'
}

type Store = {
  // only used for subscribing
  navState?: NavState
}

const initialStore: Store = {
  navState: undefined,
}

export type State = Store & {
  dispatch: {
    clearModals: () => void
    dynamic: {
      tabLongPress?: (tab: string) => void
    }
    navigateAppend: (path: PathParam, replace?: boolean, fromKey?: string) => void
    navigateUp: () => void
    navUpToScreen: (name: string) => void
    popStack: () => void
    resetState: 'default'
    setNavState: (ns: NavState) => void
    switchTab: (tab: Tabs.AppTab) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    clearModals: () => {
      const n = _getNavigator()
      if (!n) return
      const ns = getRootState()
      if (_isLoggedIn(ns) && (ns?.routes?.length ?? 0) > 1) {
        n.dispatch({...StackActions.popToTop(), target: ns?.key})
      }
    },
    dynamic: {
      tabLongPress: undefined,
    },
    navUpToScreen: name => {
      const n = _getNavigator()
      if (!n) return
      const ns = getRootState()
      // some kind of unknown race, just bail
      if (!ns) {
        console.log('Avoiding trying to nav to thread when missing nav state, bailing')
        return
      }
      if (!ns.routes) {
        console.log('Avoiding trying to nav to thread when malformed nav state, bailing')
        return
      }

      const nextState = Container.produce(ns, draft => {
        navUpHelper(draft as DeepWriteable<NavState>, name)
      })
      n.dispatch(CommonActions.reset(nextState))
    },
    navigateAppend: (path, replace, fromKey) => {
      const n = _getNavigator()
      if (!n) return
      const ns = getRootState()
      if (!ns) {
        return
      }
      let routeName: string | undefined
      let params: any
      if (typeof path === 'string') {
        routeName = path
      } else {
        routeName = path.selected
        params = path.props
      }
      if (!routeName) {
        return
      }
      const vp = getVisiblePath(ns)
      const visible = vp[vp.length - 1]
      if (visible) {
        if (routeName === visible.name && shallowEqual(visible.params, params)) {
          console.log('Skipping append dupe')
          return
        }
      }
      if (fromKey) {
        if (fromKey !== visible?.key) {
          logger.warn('Skipping append on wrong screen')
          return
        }
      }
      if (replace) {
        if (visible?.name === routeName) {
          n.dispatch(CommonActions.setParams(params))
        } else {
          n.dispatch(StackActions.replace(routeName, params))
        }
      }
      n.dispatch(StackActions.push(routeName, params))
    },
    navigateUp: () => {
      const n = _getNavigator()
      return n?.dispatch(CommonActions.goBack())
    },
    popStack: () => {
      const n = _getNavigator()
      n?.dispatch(StackActions.popToTop())
    },
    resetState: 'default',
    setNavState: next => {
      const prev = get().navState
      if (prev === next) return
      set(s => {
        s.navState = next
      })

      const updateTeamBuilding = async () => {
        const TBConstants = await import('./team-building')
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
            // team building or modal on top of that still
            const isTeamBuilding = namespaceToRoute.get(namespace) === getVisibleScreen(next)?.name
            if (!isTeamBuilding) {
              TBConstants.stores.get(namespace)?.getState().dispatch.cancelTeamBuilding()
            }
          }
        }
      }
      Z.ignorePromise(updateTeamBuilding())

      const updateFS = async () => {
        const FS = await import('./fs')
        const {criticalUpdate, dispatch} = FS.useState.getState()
        // Clear critical update when we nav away from tab
        if (criticalUpdate && prev && getTab(prev) === Tabs.fsTab && next && getTab(next) !== Tabs.fsTab) {
          dispatch.setCriticalUpdate(false)
        }
        const fsRrouteNames = ['fsRoot', 'barePreview']
        const wasScreen = fsRrouteNames.includes(getVisibleScreen(prev)?.name ?? '')
        const isScreen = fsRrouteNames.includes(getVisibleScreen(next)?.name ?? '')
        if (wasScreen !== isScreen) {
          if (wasScreen) {
            dispatch.userOut()
          } else {
            dispatch.userIn()
          }
        }
      }
      Z.ignorePromise(updateFS())

      const updateSignup = async () => {
        const Signup = await import('./signup')
        // Clear "just signed up email" when you leave the people tab after signup
        if (
          Signup.useState.getState().justSignedUpEmail &&
          prev &&
          getTab(prev) === Tabs.peopleTab &&
          next &&
          getTab(next) !== Tabs.peopleTab
        ) {
          Signup.useState.getState().dispatch.clearJustSignedUpEmail()
        }
      }
      Z.ignorePromise(updateSignup())

      const updatePeople = async () => {
        if (prev && getTab(prev) === Tabs.peopleTab && next && getTab(next) !== Tabs.peopleTab) {
          const People = await import('./people')
          People.useState.getState().dispatch.markViewed()
        }
      }
      Z.ignorePromise(updatePeople())

      const updateTeams = async () => {
        const Teams = await import('./teams')
        if (prev && getTab(prev) === Tabs.teamsTab && next && getTab(next) !== Tabs.teamsTab) {
          Teams.useState.getState().dispatch.clearNavBadges()
        }
      }
      Z.ignorePromise(updateTeams())

      const updateSettings = async () => {
        const Settings = await import('./settings')
        // Clear "check your inbox" in settings when you leave the settings tab
        if (
          Settings.useEmailState.getState().addedEmail &&
          prev &&
          getTab(prev) === Tabs.settingsTab &&
          next &&
          getTab(next) !== Tabs.settingsTab
        ) {
          Settings.useEmailState.getState().dispatch.resetAddedEmail()
        }
      }
      Z.ignorePromise(updateSettings())

      const updateChat = async () => {
        const ChatConstants = await import('./chat2')
        ChatConstants.useState.getState().dispatch.onRouteChanged(prev, next)
      }
      Z.ignorePromise(updateChat())
    },
    switchTab: name => {
      const n = _getNavigator()
      if (!n) return
      const ns = getRootState()
      if (!ns) return
      n.dispatch({
        ...CommonActions.navigate({name}),
        target: ns.routes[0]?.state?.key,
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
