import {NavState} from './types/route-tree'
import {getActiveKey as _getActiveKey} from '../router-v2/util'
import {createNavigationContainerRef, StackActions, CommonActions} from '@react-navigation/core'
import shallowEqual from 'shallowequal'
import * as RouteTreeGen from '../actions/route-tree-gen'
// import {tabRoots} from '../router-v2/routes'
import logger from '../logger'
import * as Tabs from '../constants/tabs'
import * as Container from '../util/container'

// let _navigator: Navigator | undefined
// // Private API only used by config sagas
// export const _setNavigator = (navigator: Navigator) => {
// _navigator = navigator
// if (__DEV__) {
// if (require('./platform').isMobile) {
// global.DEBUGNavigator = _navigator
// } else {
// // @ts-ignore
// window.DEBUGNavigator = _navigator
// }
// }
// }
// export const _getNavigator = () => {
// return _navigator
// }

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

// this returns the full path as seen from a stack. So if you pop you'll go up
// this path stack
// TODO this depends on our specific nav setup, check for it somehow
// export const _getStackPathHelper = (arr: Array<NavState>, s: NavState): Array<NavState> => {
// if (!s) return arr
// if (!s.routes) return arr
// const route = s.routes[s.index]
// if (!route) return arr
// if (route.routes) return _getStackPathHelper([...arr, s.routes[s.index]], route)
// if (s.name === 'loggedIn' && s.index !== 0) {
// // Modal stack is selected, make sure we get app routes too
// // modals are at indices >= 1
// return [...arr, ..._getStackPathHelper([], s.routes[0]), ...s.routes.slice(1)]
// }
// // leaf router - this is a stack router within a tab
// // start slice at 0 to also get the pages stacked below the current one
// return [...arr, ...s.routes.slice(0, s.index + 1)]
// }

// const findFullRoute = (s: NavState) => {
// if (!s) {
// return []
// }
// const loggedInOut = s.routes && s.routes[s.index]
// if (loggedInOut?.name === 'loggedIn') {
// return _getStackPathHelper([], s)
// }
// return (loggedInOut && loggedInOut.routes) || []
// }
// Private API used by navigator itself
export const _getVisiblePathForNavigator = (navState: NavState) => {
  if (!navState) return []
  return findVisibleRoute([], navState)
}

// export const _getFullRouteForNavigator = (navState: NavState) => {
// if (!navState) return []
// return findFullRoute(navState)
// }

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

export const getActiveKey = (): string => {
  if (!navigationRef_.isReady()) return ''
  return _getActiveKey(navigationRef_.getRootState())
}

// Helper to convert old route tree actions to new actions. Likely goes away as we make
// actual routing actions (or make RouteTreeGen append/up the only action)
const oldActionToNewActions = (action: any, navigationState: any, allowAppendDupe?: boolean) => {
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
        return [StackActions.replace(routeName, params)]
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
      // return [CommonActions.navigate({name: action.payload.loggedIn ? 'loggedIn' : 'loggedOut'})]
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
      // TODO
      return []
      // const fullPath = _getFullRouteForNavigator(navigationState)
      // const popActions: Array<unknown> = []
      // const isInStack = fullPath.reverse().some(r => {
      // if (r.name === action.payload.routeName) {
      // return true
      // }
      // popActions.push(StackActions.pop())
      // return false
      // })
      // return isInStack ? popActions : []
    }
    case RouteTreeGen.resetStack: {
      return [
        CommonActions.reset({
          ...navigationState,
          index: 0,
          routes: [{name: action.payload.path}],
        }),
      ]
      // TODO check for append dupes within these
      // const actions = action.payload.actions.reduce(
      // (arr, a) => [...arr, ...(oldActionToNewActions(a, navigationState, true) || [])],
      // // 'loggedOut' is the root
      // action.payload.tab === 'loggedOut' ? [] : [StackActions.push(tabRoots[action.payload.tab])]
      // )
      // return undefined // TEMP
      // return [
      // StackActions.reset({
      // actions,
      // index: action.payload.index,
      // key: action.payload.tab,
      // }),
      // ]
    }
    default:
      return undefined
  }
}

export const dispatchOldAction = (
  action:
    | RouteTreeGen.SetParamsPayload
    | RouteTreeGen.NavigateAppendPayload
    | RouteTreeGen.NavigateUpPayload
    | RouteTreeGen.SwitchLoggedInPayload
    | RouteTreeGen.ClearModalsPayload
    | RouteTreeGen.NavUpToScreenPayload
    | RouteTreeGen.SwitchTabPayload
    | RouteTreeGen.ResetStackPayload
) => {
  if (!navigationRef_.isReady()) {
    return
  }
  const actions = oldActionToNewActions(action, navigationRef_.getRootState()) || []
  try {
    actions.forEach(a => {
      console.log('aaaa nav dispatchOldAction', a)
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

export const navToThread = conversationIDKey => {
  const rs: any = _getNavigator()?.getRootState() ?? {}
  const nextState: any = Container.produce(rs as any, draft => {
    // app stack
    draft.index = 0
    // select chat tab
    const chatTabIdx = draft.routes[0]?.state.routes.findIndex(r => r.name === Tabs.chatTab)
    draft.routes[0].state.index = chatTabIdx
    const chatStack = draft.routes[0].state.routes[chatTabIdx]
    // set inbox + convo
    chatStack.state = chatStack.state ?? {}
    chatStack.state.index = 1
    chatStack.state.routes = [{name: 'chatRoot'}, {name: 'chatConversation', params: {conversationIDKey}}]
  })

  rs.key && _getNavigator()?.dispatch({...CommonActions.reset(nextState), target: rs.key})
}

export const chatRootKey = () => {
  const rs: any = _getNavigator()?.getRootState() ?? {}
  const chatTabIdx = rs.routes[0]?.state.routes.findIndex(r => r.name === Tabs.chatTab)
  return rs.routes[0].state.routes[chatTabIdx].state.routes[0].key
}
