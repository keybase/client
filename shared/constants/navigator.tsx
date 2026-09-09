// The one seam between the app and React Navigation.
//
// Everything that changes navigation goes through a Navigator: a thing that can
// dispatch an action, read the root state, say whether it is ready, and be listened
// to. There are exactly two implementations - the real binding to the app's
// NavigationContainerRef (below), and the in-memory fake in test/fake-navigator.
//
// The operations here are the ones that need the tree shape to decide what to
// dispatch; they read it through NavTree and never re-derive it. Dispatches that
// target a *specific* navigator rather than the root (e.g. a tab bar acting on the
// navigation object handed to it by its own navigator) stay where they are - they
// are not this seam.
import * as NavTree from './nav-tree'
import * as Tabs from './tabs'
import {
  CommonActions,
  StackActions,
  TabActions,
  createNavigationContainerRef,
  type NavigationContainerRef,
} from '@react-navigation/core'
import {registerDebugClear} from '@/util/debug-registry'
import {shallowEqual} from './utils'
import type {NavigateAppendType, RouteKeys, RootParamList} from '@/router-v2/route-params'

type ContainerRef = NavigationContainerRef<RootParamList>
export type NavAction = Parameters<ContainerRef['dispatch']>[0]

// What an adapter has to provide. Deliberately the smallest surface that the
// operations below need, so a fake is a handful of lines rather than a mock of
// React Navigation.
export type NavigatorRef = {
  isReady: () => boolean
  getRootState: () => NavTree.NavState | undefined
  dispatch: (action: NavAction) => void
  addListener: (type: 'state', cb: () => void) => () => void
}

export type Navigator = NavigatorRef & {
  navigateUp: () => void
  popStack: () => void
  clearModals: () => void
  // Returns whether the target is now the visible route - either because we dispatched,
  // or because we were already there. False means nothing happened and nothing will.
  navigateAppend: (path: NavigateAppendType, replace?: boolean) => boolean
  navUpToScreen: (nameOrPath: RouteKeys | NavigateAppendType, replaceIfMissing?: boolean) => void
  switchTab: (name: Tabs.AppTab) => void
  // Returns whether chatRoot now carries these params - by dispatch, or because it
  // already did. False means the nav tree was not in a state where anything could happen.
  setChatRootParams: (params: Partial<NonNullable<RootParamList['chatRoot']>>) => boolean
}

const DEBUG_NAV = __DEV__ && (false as boolean)

export const makeNavigator = (ref: NavigatorRef): Navigator => {
  // A push dispatched this tick isn't in getRootState() until React Navigation commits, so the
  // visible-route dupe check below misses repeat taps that land before the commit (e.g. a janky JS
  // thread queueing both). Track the in-flight push until the next state event; the time bound is a
  // backstop in case the container tears down before the listener fires.
  let pendingAppend: {name: string; params?: object; time: number} | undefined

  const navigateUp = () => {
    if (DEBUG_NAV) {
      console.log('[Nav] navigateUp')
    }
    if (!ref.isReady()) return
    ref.dispatch(CommonActions.goBack())
  }

  const popStack = () => {
    if (DEBUG_NAV) {
      console.log('[Nav] popStack')
    }
    if (!ref.isReady()) return
    ref.dispatch(StackActions.popToTop())
  }

  const clearModals = () => {
    if (DEBUG_NAV) {
      console.log('[Nav] clearModals')
    }
    if (!ref.isReady()) return
    const ns = ref.getRootState()
    if (!NavTree.isLoggedIn(ns)) {
      return
    }
    const rootRoutes = ns?.routes ?? []
    const keepRoutes = rootRoutes.filter((route, index) => index === 0 || !NavTree.isModalRouteName(route.name))
    if (keepRoutes.length !== rootRoutes.length) {
      ref.dispatch({
        ...CommonActions.reset({
          ...ns,
          index: keepRoutes.length - 1,
          routes: keepRoutes,
        } as Parameters<typeof CommonActions.reset>[0]),
        target: ns?.key,
      })
    }
  }

  const navigateAppend = (path: NavigateAppendType, replace?: boolean): boolean => {
    if (DEBUG_NAV) {
      console.log('[Nav] navigateAppend', {path})
    }
    if (!ref.isReady()) {
      return false
    }
    const ns = ref.getRootState()
    if (!ns) {
      return false
    }
    const nextPath = path as {name: string | number | symbol; params: object}
    const routeName = typeof nextPath.name === 'string' ? nextPath.name : String(nextPath.name)
    const params = nextPath.params
    if (!routeName) {
      if (DEBUG_NAV) {
        console.log('[Nav] navigateAppend no routeName bail', routeName)
      }
      return false
    }
    const visible = NavTree.visibleScreen(ns)
    if (visible) {
      if (routeName === visible.name && shallowEqual(visible.params, params)) {
        console.log('Skipping append dupe')
        // Already the visible route with these params - the caller's goal is met.
        return true
      }
    }

    if (replace) {
      if (visible?.name === routeName) {
        ref.dispatch(CommonActions.setParams(params))
        return true
      } else {
        ref.dispatch(StackActions.replace(routeName, params))
        return true
      }
    }

    if (
      pendingAppend?.name === routeName &&
      shallowEqual(pendingAppend.params, params) &&
      Date.now() - pendingAppend.time < 1000
    ) {
      console.log('Skipping append dupe (uncommitted)')
      // An identical push is already in flight and uncommitted.
      return true
    }
    pendingAppend = {name: routeName, params, time: Date.now()}
    const unsub = ref.addListener('state', () => {
      pendingAppend = undefined
      unsub()
    })
    ref.dispatch(StackActions.push(routeName, params))
    return true
  }

  const navUpToScreen = (nameOrPath: RouteKeys | NavigateAppendType, replaceIfMissing = false) => {
    if (DEBUG_NAV) {
      console.log('[Nav] navUpToScreen', {nameOrPath, replaceIfMissing})
    }
    if (!ref.isReady()) return
    const activeStackState = NavTree.activeStack(ref.getRootState())
    const activeStackKey = activeStackState?.key
    if (typeof nameOrPath === 'string') {
      const action = StackActions.popTo(nameOrPath)
      ref.dispatch(activeStackKey ? {...action, target: activeStackKey} : action)
      return
    }

    const routeName = nameOrPath.name
    const params = nameOrPath.params as object

    const activeStackRoutes = activeStackState?.routes as Array<NavTree.Route> | undefined
    let routeIndex = -1
    if (activeStackRoutes) {
      for (let i = activeStackRoutes.length - 1; i >= 0; i--) {
        if (activeStackRoutes[i]?.name === routeName) {
          routeIndex = i
          break
        }
      }
    }
    if (routeIndex >= 0 && activeStackState) {
      const nextRoutes = activeStackRoutes!
        .slice(0, routeIndex + 1)
        .map((route, index) => (index === routeIndex ? {...route, params} : route))
      ref.dispatch({
        ...CommonActions.reset({
          ...activeStackState,
          index: routeIndex,
          routes: nextRoutes,
        } as Parameters<typeof CommonActions.reset>[0]),
        target: activeStackKey,
      })
      return
    }

    if (replaceIfMissing) {
      const action = StackActions.replace(routeName, params)
      ref.dispatch(activeStackKey ? {...action, target: activeStackKey} : action)
      return
    }

    const action = StackActions.popTo(routeName)
    ref.dispatch(activeStackKey ? {...action, target: activeStackKey} : action)
  }

  const switchTab = (name: Tabs.AppTab) => {
    if (DEBUG_NAV) {
      console.log('[Nav] switchTab', {name})
    }
    if (!ref.isReady()) return
    const tabNavState = NavTree.tabNavigatorState(ref.getRootState())
    if (!tabNavState?.key) return
    ref.dispatch({
      ...TabActions.jumpTo(name),
      target: tabNavState.key,
    })
  }

  const setChatRootParams = (params: Partial<NonNullable<RootParamList['chatRoot']>>): boolean => {
    if (!ref.isReady()) return false
    const tabNavState = NavTree.tabNavigatorState(ref.getRootState())
    if (!tabNavState?.key) return false
    const tabRoutes = tabNavState.routes as Array<NavTree.Route>
    const chatTabIndex = tabRoutes.findIndex(r => r.name === Tabs.chatTab)
    if (chatTabIndex < 0) return false
    const chatTabRoute = tabRoutes[chatTabIndex]
    const chatStackState = chatTabRoute?.state
    const chatStackRoutes = chatStackState?.routes as Array<NavTree.Route> | undefined
    const chatStackIndex = chatStackState?.index ?? 0
    const currentChatRoute = chatStackRoutes?.[chatStackIndex]
    const currentChatRoot = chatStackRoutes?.[0]
    const updatedRoutes = tabRoutes.map((route, i) => {
      if (i !== chatTabIndex) return route
      const currentParams = currentChatRoot?.name === 'chatRoot' ? currentChatRoot.params : undefined
      return {
        ...route,
        state: {
          ...(route.state ?? {}),
          index: 0,
          routes: [{name: 'chatRoot', params: {...currentParams, ...params}}],
        },
      }
    })
    const nextChatRoot = updatedRoutes[chatTabIndex]?.state?.routes[0]
    if (
      tabNavState.index === chatTabIndex &&
      currentChatRoute?.name === 'chatRoot' &&
      chatStackState?.key &&
      nextChatRoot?.params
    ) {
      // When split chat is already showing chatRoot, update that route in place instead of
      // resetting the whole tab navigator. This avoids an extra same-screen navigation when
      // the tab becomes visible and chat selects a thread immediately afterward.
      if (!shallowEqual(currentChatRoute.params, nextChatRoot.params)) {
        ref.dispatch({
          ...CommonActions.navigate('chatRoot', nextChatRoot.params, {merge: true}),
          target: chatStackState.key,
        })
      }
      // Either we just merged the params in, or they were already what we wanted.
      return true
    }
    ref.dispatch({
      ...CommonActions.reset({...tabNavState, index: chatTabIndex, routes: updatedRoutes} as Parameters<
        typeof CommonActions.reset
      >[0]),
      target: tabNavState.key,
    })
    return true
  }

  return {
    addListener: ref.addListener,
    clearModals,
    dispatch: ref.dispatch,
    getRootState: ref.getRootState,
    isReady: ref.isReady,
    navUpToScreen,
    navigateAppend,
    navigateUp,
    popStack,
    setChatRootParams,
    switchTab,
  }
}

// ---- The real adapter ----

export const navigationRef = createNavigationContainerRef()

registerDebugClear(() => {
  navigationRef.current = null
})

const containerRefAdapter: NavigatorRef = {
  addListener: (type, cb) => (navigationRef.isReady() ? navigationRef.addListener(type, cb) : () => {}),
  dispatch: action => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(action)
    }
  },
  getRootState: () => (navigationRef.isReady() ? navigationRef.getRootState() : undefined),
  isReady: () => navigationRef.isReady(),
}

const realNavigator = makeNavigator(containerRefAdapter)

let currentNavigator: Navigator = realNavigator

export const getNavigator = () => currentNavigator

// Swaps in another adapter - the in-memory fake in tests. Passing nothing restores
// the real one.
export const setNavigator = (navigator?: Navigator) => {
  currentNavigator = navigator ?? realNavigator
}
