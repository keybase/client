import type * as React from 'react'
import type * as T from './types'
import * as Tabs from './tabs'
import {
  StackActions,
  CommonActions,
  type NavigationContainerRef,
  useFocusEffect,
  createNavigationContainerRef,
  type NavigationState,
} from '@react-navigation/core'
import type {NavigateAppendType, RouteKeys, RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {GetOptionsRet} from './types/router2'
import {produce} from 'immer'
import isEqual from 'lodash/isEqual'
import {isMobile, isTablet} from './platform'
import {shallowEqual, type ViewPropsToPageProps} from './utils'
import {registerDebugClear} from '@/util/debug'

export const navigationRef = createNavigationContainerRef<KBRootParamList>()

registerDebugClear(() => {
  navigationRef.current = null
})

export type Route = NavigationState<KBRootParamList>['routes'][0]
// still a little paranoid about some things being missing in this type
export type NavState = Partial<Route['state']>
export type PathParam = NavigateAppendType
export type Navigator = NavigationContainerRef<KBRootParamList>

const DEBUG_NAV = __DEV__ && (false as boolean)

const isSplit = !isMobile || isTablet // Whether the inbox and conversation panels are visible side-by-side.

export const getRootState = (): NavState | undefined => {
  if (!navigationRef.isReady()) return
  return navigationRef.getRootState()
}

export const getTab = (navState?: T.Immutable<NavState>): undefined | Tabs.Tab => {
  const s = navState || getRootState()
  const loggedInRoute = s?.routes?.[0]
  if (loggedInRoute?.name === 'loggedIn') {
    // eslint-disable-next-line
    return loggedInRoute.state?.routes?.[loggedInRoute.state.index ?? 0]?.name as Tabs.Tab
  }
  return undefined
}

const _isLoggedIn = (s: T.Immutable<NavState>) => {
  if (!s) {
    return false
  }
  return s.routes?.[0]?.name === 'loggedIn'
}

export const _getNavigator = () => {
  return navigationRef.isReady() ? navigationRef : undefined
}

// Public API
// gives you loggedin/tab/stackitems + modals
export const getVisiblePath = (navState?: T.Immutable<NavState>, _inludeModals?: boolean) => {
  const rs = navState || getRootState()
  const inludeModals = _inludeModals ?? true

  const findVisibleRoute = (
    arr: T.Immutable<Array<Route>>,
    s: T.Immutable<NavState>,
    depth: number
  ): T.Immutable<Array<Route>> => {
    if (!s?.routes || s.index === undefined) {
      return arr
    }
    let childRoute = s.routes[s.index] as Route | undefined
    if (!childRoute) {
      return arr
    }

    let toAdd: Array<Route>
    let toAddModals: Array<Route> = []
    // special handling of modals, we keep them to the side to add them later, then go down the visible tab
    if (depth === 0) {
      childRoute = s.routes[0] as Route
      toAdd = [childRoute]
      if (inludeModals) {
        toAddModals = s.routes.slice(1) as Array<Route>
      }
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

export const getModalStack = (navState?: T.Immutable<NavState>) => {
  const rs = navState || getRootState()
  if (!rs) {
    return []
  }
  if (!_isLoggedIn(rs)) {
    return []
  }
  return rs.routes?.slice(1) ?? []
}

export const getVisibleScreen = (navState?: T.Immutable<NavState>, _inludeModals?: boolean) => {
  const visible = getVisiblePath(navState, _inludeModals ?? true)
  return visible.at(-1)
}

export const logState = () => {
  const rs = getRootState()
  const safePaths = (ps: ReadonlyArray<{key?: string; name?: string}>) =>
    ps.map(p => ({key: p.key, name: p.name}))
  const modals = safePaths(getModalStack(rs))
  const visible = safePaths(getVisiblePath(rs))
  return {loggedIn: _isLoggedIn(rs), modals, visible}
}

type DeepWriteable<T> = {-readonly [P in keyof T]: DeepWriteable<T[P]>}

const navUpHelper = (s: DeepWriteable<NavState>, name: string) => {
  const route = s?.routes?.[s.index ?? -1] as DeepWriteable<Route> | undefined
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
    const idx = route.state.routes.findIndex((r: {name: string}) => r.name === name)
    // found
    if (idx !== -1) {
      route.state.index = idx
      route.state.routes.length = idx + 1
      return
    }
  }
  // try the incoming s
  if (s?.type === 'stack') {
    const idx: number = s.routes?.findIndex((r: {name: string}) => r.name === name) ?? -1
    // found
    if (idx !== -1 && s.routes) {
      s.index = idx
      s.routes.length = idx + 1
      return
    }
  }

  navUpHelper(route.state, name)
}

export const getRouteTab = (route: Array<Route>) => {
  return route[1]?.name
}

export const getRouteLoggedIn = (route: Array<Route>) => {
  return route[0]?.name === 'loggedIn'
}

// if a toast is inside of a portal then its not in nav so we can't use useFocusEffect and
// maybe other places also
export const useSafeFocusEffect = (fn: () => void) => {
  try {
    useFocusEffect(fn)
  } catch {}
}

// Helper to reduce boilerplate in route definitions
// Works for components with or without route params
export function makeScreen<COM extends React.LazyExoticComponent<any>>(
  Component: COM,
  options?: {getOptions?: GetOptionsRet | ((props: ViewPropsToPageProps<COM>) => GetOptionsRet)}
) {
  return {
    ...options,
    screen: function Screen(p: ViewPropsToPageProps<COM>) {
      const Comp = Component as any
      return <Comp {...(p.route.params ?? {})} />
    },
  }
}

export const clearModals = () => {
  DEBUG_NAV && console.log('[Nav] clearModals')
  const n = _getNavigator()
  if (!n) return
  const ns = getRootState()
  if (_isLoggedIn(ns) && (ns?.routes?.length ?? 0) > 1) {
    n.dispatch({...StackActions.popToTop(), target: ns?.key})
  }
}

export const navigateUp = () => {
  DEBUG_NAV && console.log('[Nav] navigateUp')
  const n = _getNavigator()
  return n?.dispatch(CommonActions.goBack())
}

export const popStack = () => {
  DEBUG_NAV && console.log('[Nav] popStack')
  const n = _getNavigator()
  n?.dispatch(StackActions.popToTop())
}

export const navUpToScreen = (name: RouteKeys) => {
  DEBUG_NAV && console.log('[Nav] navUpToScreen', {name})
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

  const nextState = produce(ns, draft => {
    navUpHelper(draft as DeepWriteable<NavState>, name)
  })
  n.dispatch(CommonActions.reset(nextState as Parameters<typeof CommonActions.reset>[0]))
}

export const navigateAppend = (path: PathParam, replace?: boolean) => {
  DEBUG_NAV && console.log('[Nav] navigateAppend', {path})
  const n = _getNavigator()
  if (!n) {
    return
  }
  const ns = getRootState()
  if (!ns) {
    return
  }
  let routeName: string | undefined
  let params: object | undefined
  if (typeof path === 'string') {
    routeName = path
  } else {
    routeName = path.selected
    params = path.props as object
  }
  if (!routeName) {
    DEBUG_NAV && console.log('[Nav] navigateAppend no routeName bail', routeName)
    return
  }
  const vp = getVisiblePath(ns)
  const visible = vp.at(-1)
  if (visible) {
    if (routeName === visible.name && shallowEqual(visible.params, params)) {
      console.log('Skipping append dupe')
      return
    }
  }

  if (replace) {
    if (visible?.name === routeName) {
      params && n.dispatch(CommonActions.setParams(params))
      return
    } else {
      n.dispatch(StackActions.replace(routeName, params))
      return
    }
  }

  n.dispatch(StackActions.push(routeName, params))
}

export const switchTab = (name: Tabs.AppTab) => {
  DEBUG_NAV && console.log('[Nav] switchTab', {name})
  const n = _getNavigator()
  if (!n) return
  const ns = getRootState()
  if (!ns) return
  n.dispatch({
    ...CommonActions.navigate({name}),
    target: ns.routes?.[0]?.state?.key,
  })
}

export const navToProfile = (username: string) => {
  if (isMobile) {
    clearModals()
  }
  navigateAppend({props: {username}, selected: 'profile'})
}

export const navToThread = (conversationIDKey: T.Chat.ConversationIDKey) => {
  DEBUG_NAV && console.log('[Nav] navToThread', conversationIDKey)
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

  const nextState = produce(rs, draft => {
    const loggedInRoute = draft.routes?.[0]
    const loggedInTabs = loggedInRoute?.state?.routes
    if (!loggedInTabs) {
      return
    }
    const chatTabIdx = loggedInTabs.findIndex((r: {name: string}) => r.name === Tabs.chatTab)
    const chatStack = loggedInTabs[chatTabIdx]

    if (!chatStack) {
      return
    }

    // select tabs
    draft.index = 0
    // remove modals
    if (draft.routes) {
      draft.routes.length = 1
    }

    // select chat tab
    if (loggedInRoute.state) {
      loggedInRoute.state.index = chatTabIdx
    }

    const oldChatState = chatStack.state

    // setup root
    chatStack.state = {
      index: 0,
      routes: [{key: oldChatState?.routes[0]?.key ?? 'chatRoot', name: 'chatRoot'}],
    }

    if (isSplit) {
      const _chatRoot = oldChatState?.routes[0]
      // key is required or you'll run into issues w/ the nav
      const chatRoot = {
        key: _chatRoot?.key || `chatRoot-${conversationIDKey}`,
        name: 'chatRoot',
        params: {conversationIDKey},
      } as const
      chatStack.state.routes = [chatRoot]
    } else {
      // key is required or you'll run into issues w/ the nav
      let convoRoute = {
        key: `chatConversation-${conversationIDKey}`,
        name: 'chatConversation',
        params: {conversationIDKey},
      } as const
      // reuse visible route if it's the same
      const visible = oldChatState?.routes.at(-1)
      if (visible) {
        const vParams: undefined | {conversationIDKey?: T.Chat.ConversationIDKey} = visible.params
        if (visible.name === 'chatConversation' && vParams?.conversationIDKey === conversationIDKey) {
          convoRoute = visible as typeof convoRoute
        }
      }

      const chatRoot = chatStack.state.routes[0]
      chatStack.state.routes = [chatRoot, convoRoute] as typeof chatStack.state.routes
      chatStack.state.index = 1
    }
  })

  if (!isEqual(rs, nextState)) {
    rs.key &&
      _getNavigator()?.dispatch({
        ...CommonActions.reset(nextState as Parameters<typeof CommonActions.reset>[0]),
        target: rs.key,
      })
  }
}

export const appendPeopleBuilder = () => {
  navigateAppend({
    props: {
      filterServices: ['facebook', 'github', 'hackernews', 'keybase', 'reddit', 'twitter'],
      namespace: 'people',
      title: '',
    },
    selected: 'peopleTeamBuilder',
  })
}

export const appendNewChatBuilder = () => {
  navigateAppend({props: {namespace: 'chat2', title: 'New chat'}, selected: 'chatNewChat'})
}

// Unless you're within the add members wizard you probably should use `TeamsGen.startAddMembersWizard` instead
export const appendNewTeamBuilder = (teamID: T.Teams.TeamID) => {
  navigateAppend({
    props: {
      filterServices: ['keybase', 'twitter', 'facebook', 'github', 'reddit', 'hackernews'],
      goButtonLabel: 'Add',
      namespace: 'teams',
      teamID,
      title: '',
    },
    selected: 'teamsTeamBuilder',
  })
}

export const appendEncryptRecipientsBuilder = () => {
  navigateAppend({
    props: {
      filterServices: ['facebook', 'github', 'hackernews', 'keybase', 'reddit', 'twitter'],
      goButtonLabel: 'Add',
      namespace: 'crypto',
      recommendedHideYourself: true,
      title: 'Recipients',
    },
    selected: 'cryptoTeamBuilder',
  })
}
