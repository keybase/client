import {NavState} from './types/route-tree'
import {createNavigationContainerRef, StackActions, CommonActions} from '@react-navigation/core'
import shallowEqual from 'shallowequal'
import * as RouteTreeGen from '../actions/route-tree-gen'
import logger from '../logger'
import * as Tabs from '../constants/tabs'
import * as Container from '../util/container'
import isEqual from 'lodash/isEqual'
import {ConversationIDKey} from './types/chat2/common'

export const navigationRef_ = createNavigationContainerRef()
export const _getNavigator = () => {
  return navigationRef_.isReady() ? navigationRef_ : undefined
}

export const findVisibleRoute = (arr: Array<NavState>, s: NavState): Array<NavState> => {
  if (!s) {
    return arr
  }
  // @ts-ignore TODO this next line seems incorrect
  if (!s.routes) {
    return s
  }
  const route = s.routes[s.index]
  if (!route) {
    return arr
  }
  if (route.state?.routes) {
    return findVisibleRoute([...arr, route], route.state)
  }
  return [...arr, route]
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

  return s.routes.slice(1) ?? []
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
      const p = action.payload.path.last
        ? action.payload.path.last()
        : action.payload.path[action.payload.path.length - 1]
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
        {...CommonActions.navigate({name: action.payload.tab}), target: navigationState.routes[0].state.key},
      ]
    }
    case RouteTreeGen.switchLoggedIn: {
      // no longer used
      return []
    }
    case RouteTreeGen.clearModals: {
      if (_isLoggedIn(navigationState) && navigationState.routes.length > 1) {
        return [{...StackActions.popToTop(), target: navigationState.key}]
      }
      return []
    }
    case RouteTreeGen.navigateUp:
      return [{...CommonActions.goBack(), source: action.payload.fromKey}]
    case RouteTreeGen.navUpToScreen: {
      const {routeName} = action.payload
      return [CommonActions.navigate(routeName)]
    }
    case RouteTreeGen.popStack: {
      return [StackActions.popToTop()]
    }
    default:
      return undefined
  }
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

export const navToThread = (conversationIDKey: ConversationIDKey) => {
  const rs: any = _getNavigator()?.getRootState() ?? {}
  const nextState: any = Container.produce(rs as any, draft => {
    // select tabs
    draft.index = 0
    // remove modals
    draft.routes.length = 1

    const loggedInRoute = draft.routes[0]
    const loggedInTabs = loggedInRoute?.state.routes
    // select chat tab
    const chatTabIdx = loggedInTabs.findIndex(r => r.name === Tabs.chatTab)
    loggedInRoute.state.index = chatTabIdx

    const chatStack = loggedInTabs[chatTabIdx]
    // set inbox + convo
    chatStack.state = chatStack.state ?? {}
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
      if (visible.name === 'chatConversation' && visible.params?.conversationIDKey === conversationIDKey) {
        convoRoute = visible
      }
    }

    const chatRoot = chatStack.state.routes?.[0]
    chatStack.state.routes = [chatRoot, convoRoute]
  })

  if (!isEqual(rs, nextState)) {
    rs.key && _getNavigator()?.dispatch({...CommonActions.reset(nextState), target: rs.key})
  }
}

export const chatRootKey = () => {
  const rs: any = _getNavigator()?.getRootState() ?? {}
  const chatTabIdx = rs.routes[0]?.state.routes.findIndex(r => r.name === Tabs.chatTab)
  return rs.routes[0].state.routes[chatTabIdx].state.routes[0].key
}
