import {createNavigationContainerRef, StackActions, CommonActions} from '@react-navigation/core'
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

export const findVisibleRoute = (arr: Array<Route>, s: NavState): Array<Route> => {
  if (!s || !s.routes || s.index === undefined) {
    return arr
  }
  const route: Route = s.routes[s.index] as Route
  if (!route) {
    return arr
  }

  let toAdd: Array<Route>
  // include items in the stack
  if (s.type === 'stack') {
    toAdd = s.routes as Array<Route>
  } else {
    toAdd = [route]
  }

  const nextArr = [...arr, ...toAdd]
  return route.state?.routes ? findVisibleRoute(nextArr, route.state) : nextArr
}

const _isLoggedIn = (s: NavState) => {
  if (!s) {
    return false
  }
  return s?.routes?.[0]?.name === 'loggedIn'
}

// Private API only used by config sagas
const findModalRoute = (s: NavState) => {
  if (!s) {
    return []
  }
  if (!_isLoggedIn(s)) {
    return []
  }

  return s.routes?.slice(1) ?? []
}

export const _getVisiblePathForNavigator = (navState: NavState) => {
  if (!navState) return []
  return findVisibleRoute([], navState)
}

// Public API
export const getVisiblePath = () => {
  if (!navigationRef_.isReady()) return []
  return findVisibleRoute([], navigationRef_.getRootState())
}

export const getModalStack = () => {
  if (!navigationRef_.isReady()) return []
  return findModalRoute(navigationRef_.getRootState())
}

export const getVisibleScreen = () => {
  const visible = getVisiblePath()
  return visible[visible.length - 1]
}

// Helper to convert old route tree actions to new actions. Likely goes away as we make
// actual routing actions (or make RouteTreeGen append/up the only action)
const oldActionToNewActions = (action: RTGActions, navigationState: any, allowAppendDupe?: boolean) => {
  switch (action.type) {
    case RouteTreeGen.setParams: {
      return [{...CommonActions.setParams(action.payload.params), source: action.payload.key}]
    }
    case RouteTreeGen.navigateAppend: {
      if (!navigationState) {
        return
      }
      const p = action.payload.path[action.payload.path.length - 1]
      if (!p) {
        return
      }
      let routeName: string | null = null
      let params: any | undefined

      if (typeof p === 'string') {
        routeName = p
      } else {
        routeName = p.selected
        params = p.props
      }

      if (!routeName) {
        return
      }

      const path = _getVisiblePathForNavigator(navigationState)
      const visible = path[path.length - 1]
      if (visible) {
        if (!allowAppendDupe && routeName === visible.name && shallowEqual(visible.params, params)) {
          console.log('Skipping append dupe')
          return
        }
      }

      if (action.payload.fromKey) {
        const {fromKey} = action.payload
        if (fromKey !== visible.key) {
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
    case RouteTreeGen.switchTab: {
      return [
        {
          ...CommonActions.navigate({name: action.payload.tab, params: action.payload.params}),
          target: navigationState.routes[0].state.key,
        },
      ]
    }
    case RouteTreeGen.switchLoggedIn: {
      // no longer used
      return []
    }
    case RouteTreeGen.clearModals: {
      if (_isLoggedIn(navigationState) && navigationState?.routes?.length > 1) {
        return [{...StackActions.popToTop(), target: navigationState.key}]
      }
      return []
    }
    case RouteTreeGen.navigateUp:
      return [{...CommonActions.goBack(), source: action.payload.fromKey}]
    case RouteTreeGen.navUpToScreen: {
      const {name, params} = action.payload
      // find with matching params
      // const path = _getVisiblePathForNavigator(navigationState)
      // const p = path.find(p => p.name === name)
      // return [CommonActions.navigate(name, params ?? p?.params)]

      const rs = _getNavigator()?.getRootState()
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
        navUpHelper(draft as DeepWriteable<NavState>, name, params)
      })

      return [CommonActions.reset(nextState)]
    }
    case RouteTreeGen.popStack: {
      return [StackActions.popToTop()]
    }
    default:
      return undefined
  }
}
type DeepWriteable<T> = {-readonly [P in keyof T]: DeepWriteable<T[P]>}

const navUpHelper = (s: DeepWriteable<NavState>, name: string, params: any) => {
  const route = s?.routes[s?.index ?? -1] as DeepWriteable<Route>
  if (!route) {
    return
  }

  // found?
  if (route.name === name && isEqual(route.params, params)) {
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
    const idx = route.state.routes.findIndex(r => r.name === name && isEqual(r.params, params))
    // found
    if (idx !== -1) {
      route.state.index = idx
      route.state.routes.length = idx + 1
      return
    }
  }
  // try the incoming s
  if (s?.type === 'stack') {
    const idx = s.routes.findIndex(r => r.name === name && isEqual(r.params, params))
    // found
    if (idx !== -1) {
      s.index = idx
      s.routes.length = idx + 1
      return
    }
  }

  navUpHelper(route.state, name, params)
}

type RTGActions =
  | RouteTreeGen.SetParamsPayload
  | RouteTreeGen.NavigateAppendPayload
  | RouteTreeGen.NavigateUpPayload
  | RouteTreeGen.SwitchLoggedInPayload
  | RouteTreeGen.ClearModalsPayload
  | RouteTreeGen.NavUpToScreenPayload
  | RouteTreeGen.SwitchTabPayload
  | RouteTreeGen.PopStackPayload

export const dispatchOldAction = (action: RTGActions) => {
  if (!navigationRef_.isReady()) {
    return
  }
  const actions = oldActionToNewActions(action, navigationRef_.getRootState()) || []
  try {
    actions.forEach(a => {
      navigationRef_.dispatch(a)
    })
  } catch (e) {
    logger.error('Nav error', e)
  }
}

export const getCurrentTab = () => {
  if (navigationRef_.isReady()) {
    const s = navigationRef_.getRootState()
    const loggedInRoute = s.routes[0]
    if (loggedInRoute?.name === 'loggedIn') {
      return loggedInRoute.state?.routes?.[loggedInRoute.state?.index ?? 0]?.name
    }
  }
  return undefined
}

export const isLoggedIn = () => {
  return _isLoggedIn(navigationRef_.getRootState())
}

export const getModalPath = () => {
  const rs = _getNavigator()?.getRootState()
  if (!rs) return []
  return rs.routes.slice(1)
}

export const getAppPath = () => {
  const rs = _getNavigator()?.getRootState()
  if (!rs) return []
  const root = rs.routes[0]
  return findVisibleRoute([rs.routes[0]], root?.state)
}

const isSplit = !Container.isMobile || Container.isTablet // Whether the inbox and conversation panels are visible side-by-side.

export const navToThread = (conversationIDKey: ConversationIDKey) => {
  const rs = _getNavigator()?.getRootState()
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

export const chatRootKey = () => {
  const rs = _getNavigator()?.getRootState()
  if (!rs) return
  const chatTabIdx = rs.routes[0]?.state?.routes.findIndex(r => r.name === Tabs.chatTab)
  if (!chatTabIdx) return
  return rs.routes[0]?.state?.routes?.[chatTabIdx]?.state?.routes?.[0]?.key
}

export const getRouteTab = (route: Array<Route>) => {
  return route[1]?.name
}

export const getRouteLoggedIn = (route: Array<Route>) => {
  return route[0]?.name === 'loggedIn'
}
