// The one seam between the app and React Navigation.
//
// Everything that changes navigation goes through a Navigator: a thing that can
// dispatch an action, read the root state, say whether it is ready, and be listened
// to. There are exactly two implementations - the real binding to the app's
// NavigationContainerRef (below), and the in-memory fake in test/fake-navigator.
//
// The operations here are the ones that need the tree shape to decide what to
// dispatch; they read it through NavTree and never re-derive it. The Navigator does
// not expose a raw dispatch, so every root-level navigation is one of them.
// Dispatches that target a *specific* navigator rather than the root (e.g. a tab bar
// acting on the navigation object handed to it by its own navigator) stay where they
// are - they are not this seam.
import * as NavTree from './nav-tree'
import * as Tabs from './tabs'
import {
  CommonActions,
  StackActions,
  TabActions,
  createNavigationContainerRef,
  type NavigationContainerRef,
} from '@react-navigation/core'
import logger from '@/logger'
import {DEBUG_NAV} from './nav-debug'
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

export type Navigator = Omit<NavigatorRef, 'dispatch'> & {
  navigateUp: () => void
  popStack: () => void
  clearModals: () => void
  // Returns whether the target is now the visible route - either because we dispatched,
  // or because we were already there. False means nothing happened and nothing will.
  navigateAppend: (path: NavigateAppendType, replace?: boolean) => boolean
  // Push once the root stack has a `rootRouteName` route. For a push whose target lives in a
  // conditional root group that a store change is about to mount (e.g. the logged-out stack): a
  // push dispatched before the group mounts reaches no navigator that can handle it and is
  // dropped. Gives up after `timeoutMs` so a group that never mounts can't fire the push at some
  // unrelated later time.
  // onGiveUp runs if the root never mounts and the push is dropped
  navigateAppendOnceRootHas: (
    rootRouteName: string,
    path: NavigateAppendType,
    timeoutMs?: number,
    onGiveUp?: () => void
  ) => void
  navUpToScreen: (nameOrPath: RouteKeys | NavigateAppendType, replaceIfMissing?: boolean) => void
  switchTab: (name: Tabs.AppTab) => void
  // Returns whether chatRoot now carries these params - by dispatch, or because it
  // already did. False means the nav tree was not in a state where anything could happen.
  setChatRootParams: (params: Partial<NonNullable<RootParamList['chatRoot']>>) => boolean
  // Phone: select `tab` on its root screen and push `screen` above the tab bar, in one reset.
  // Returns whether it dispatched.
  showAboveTabs: (tab: Tabs.AppTab, screen: NavTree.ScreenSpec) => boolean
  // Merges params into the route with this key, in place and without a transition. Returns
  // whether it dispatched.
  setRouteParams: (routeKey: string | undefined, params: object) => boolean
  // Takes the routes with these keys out of whichever stacks hold them, leaving every other route
  // where it is: one reset per stack that holds one, built from the root state as it is now.
  removeRoutes: (keys: Iterable<string>) => void
  // Runs cb once no modal route is up: now, or at the state commit that removes the last one
  // within modalsWaitMs. One wait at a time: a new one drops the one before it. Returns a cancel.
  whenModalsGone: (cb: () => void) => () => void
}


// long enough for a modal's dismissal to commit; a callback run much later would act on whatever the
// user has moved on to
const modalsWaitMs = 1000

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

  const navigateAppendOnceRootHas = (
    rootRouteName: string,
    path: NavigateAppendType,
    timeoutMs = 5000,
    onGiveUp?: () => void
  ) => {
    const rootHas = () => ref.getRootState()?.routes?.some(r => r.name === rootRouteName) ?? false
    const push = () => {
      if (!navigateAppend(path)) {
        logger.warn(`[Nav] navigateAppendOnceRootHas: push failed, dropping ${path.name}`)
        onGiveUp?.()
      }
    }
    if (rootHas()) {
      push()
      return
    }
    if (!ref.isReady()) {
      logger.warn(`[Nav] navigateAppendOnceRootHas: no navigator, dropping ${path.name}`)
      onGiveUp?.()
      return
    }
    const timer = setTimeout(() => {
      unsub()
      logger.warn(`[Nav] navigateAppendOnceRootHas: ${rootRouteName} never mounted, dropping ${path.name}`)
      onGiveUp?.()
    }, timeoutMs)
    const unsub = ref.addListener('state', () => {
      if (!rootHas()) return
      clearTimeout(timer)
      unsub()
      push()
    })
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

  const showAboveTabs = (tab: Tabs.AppTab, screen: NavTree.ScreenSpec): boolean => {
    if (DEBUG_NAV) {
      console.log('[Nav] showAboveTabs', {screen, tab})
    }
    if (!ref.isReady()) return false
    const rs = ref.getRootState()
    if (!rs?.key) return false
    ref.dispatch({
      ...CommonActions.reset(NavTree.pushedAboveTabs(tab, screen) as Parameters<typeof CommonActions.reset>[0]),
      target: rs.key,
    })
    return true
  }

  const setRouteParams = (routeKey: string | undefined, params: object): boolean => {
    if (!ref.isReady()) return false
    ref.dispatch({...CommonActions.setParams(params), source: routeKey})
    return true
  }

  const removeRoutes = (keys: Iterable<string>) => {
    if (DEBUG_NAV) {
      console.log('[Nav] removeRoutes')
    }
    const remove = new Set(keys)
    if (!ref.isReady() || !remove.size) return
    const prune = (s: NavTree.NavState | undefined) => {
      const routes = s?.routes
      if (!s || !routes) return
      const kept = routes.filter(r => !remove.has(r.key))
      if (kept.length !== routes.length) {
        if (!kept.length) {
          // A stack can't be left empty; its last route goes with whatever holds it
          logger.warn('[Nav] removeRoutes: not emptying a stack')
          return
        }
        ref.dispatch({
          ...CommonActions.reset({...s, index: kept.length - 1, routes: kept} as Parameters<
            typeof CommonActions.reset
          >[0]),
          target: s.key,
        })
      }
      for (const r of kept) {
        prune(r.state)
      }
    }
    prune(ref.getRootState())
  }

  let cancelModalsWait: (() => void) | undefined
  const whenModalsGone = (cb: () => void) => {
    cancelModalsWait?.()
    const modalsGone = () => NavTree.modalStack(ref.getRootState()).length === 0
    if (modalsGone()) {
      cb()
      return () => {}
    }
    const cancel = () => {
      clearTimeout(timer)
      unsub()
      if (cancelModalsWait === cancel) {
        cancelModalsWait = undefined
      }
    }
    const timer = setTimeout(cancel, modalsWaitMs)
    const unsub = ref.addListener('state', () => {
      if (!modalsGone()) return
      cancel()
      cb()
    })
    cancelModalsWait = cancel
    return cancel
  }

  return {
    addListener: ref.addListener,
    clearModals,
    getRootState: ref.getRootState,
    isReady: ref.isReady,
    navUpToScreen,
    navigateAppend,
    navigateAppendOnceRootHas,
    navigateUp,
    popStack,
    removeRoutes,
    setChatRootParams,
    setRouteParams,
    showAboveTabs,
    switchTab,
    whenModalsGone,
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
