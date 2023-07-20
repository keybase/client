import {createNavigationContainerRef, StackActions, CommonActions} from '@react-navigation/core'
import * as Z from '../util/zustand'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Tabs from '../constants/tabs'
import isEqual from 'lodash/isEqual'
import logger from '../logger'
import shallowEqual from 'shallowequal'
import type {NavState, Route} from './types/route-tree'
import type {ConversationIDKey} from './types/chat2/common'

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

// Helper to convert old route tree actions to new actions. Likely goes away as we make
// actual routing actions (or make RouteTreeGen append/up the only action)
const oldActionToNewActions = (action: RTGActions, navigationState: any, allowAppendDupe?: boolean) => {
  switch (action.type) {
    case RouteTreeGen.navigateAppend: {
      if (!navigationState) {
        return
      }
      const p = action.payload.path[action.payload.path.length - 1]
      if (!p) {
        return
      }
      let routeName: string | undefined
      let params: any

      if (typeof p === 'string') {
        routeName = p
      } else {
        routeName = p.selected
        params = p.props
      }

      if (!routeName) {
        return
      }

      const path = getVisiblePath(navigationState)
      const visible = path[path.length - 1]
      if (visible) {
        if (!allowAppendDupe && routeName === visible.name && shallowEqual(visible.params, params)) {
          console.log('Skipping append dupe')
          return
        }
      }

      if (action.payload.fromKey) {
        const {fromKey} = action.payload
        if (fromKey !== visible?.key) {
          logger.warn('Skipping append on wrong screen')
          return
        }
      }

      if (action.payload.replace) {
        if (visible?.name === routeName) {
          return [CommonActions.setParams(params)]
        } else {
          return [StackActions.replace(routeName, params)]
        }
      }

      return [StackActions.push(routeName, params)]
    }
    default:
      return undefined
  }
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

type RTGActions = RouteTreeGen.NavigateAppendPayload

export const dispatchOldAction = (action: RTGActions) => {
  const rs = getRootState()
  if (!rs) {
    return
  }
  const actions = oldActionToNewActions(action, rs) || []
  try {
    actions.forEach(a => {
      navigationRef_.dispatch(a)
    })
  } catch (e) {
    logger.error('Nav error', e)
  }
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
    navigateUp: () => void
    navUpToScreen: (name: string) => void
    popStack: () => void
    resetState: 'default'
    switchTab: (tab: Tabs.AppTab) => void
  }
}

export const useState = Z.createZustand<State>(() => {
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
    navigateUp: () => {
      const n = _getNavigator()
      return n?.dispatch(CommonActions.goBack())
    },
    popStack: () => {
      const n = _getNavigator()
      n?.dispatch(StackActions.popToTop())
    },
    resetState: 'default',
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
