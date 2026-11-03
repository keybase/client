// The one seam between the app and React Navigation.
//
// Everything that changes navigation goes through a Navigator: a thing that can
// dispatch an action, read the root state, say whether it is ready, and be listened
// to. It is bound to the app's NavigationContainerRef (below); tests mount the real
// library on that same ref (test/navigation).
//
// React Navigation has a dispatch in getRootState() as soon as dispatch returns; only
// the 'state' event waits for React to render it. So an operation can read the tree
// straight after an earlier one and see its result. The exception is a navigator a
// reset rebuilds or a tab focused for the first time: its nested state is in the tree
// once it has rendered.
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
type NavAction = Parameters<ContainerRef['dispatch']>[0]

// What an adapter has to provide: the smallest surface the operations below need.
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
  navigateAppendOnceRootHas: (rootRouteName: string, path: NavigateAppendType, timeoutMs?: number) => void
  navUpToScreen: (nameOrPath: RouteKeys | NavigateAppendType, replaceIfMissing?: boolean) => void
  switchTab: (name: Tabs.AppTab) => void
  // Returns whether chatRoot now carries these params - by dispatch, or because it
  // already did. False means the nav tree was not in a state where anything could happen.
  setChatRootParams: (params: Partial<NonNullable<RootParamList['chatRoot']>>) => boolean
  // Phone: select `tab` on its root screen and push `screen` above the tab bar, in one reset.
  // Returns whether it dispatched.
  showAboveTabs: (tab: Tabs.AppTab, screen: NavTree.ScreenSpec) => boolean
  // Split layouts: select `tab` and push `screen` on its stack, in one reset of the tab navigator.
  // A push dispatched after switchTab to a tab never focused before is dropped, since that tab's
  // stack has not mounted yet. Returns whether it dispatched.
  pushInTab: (tab: Tabs.AppTab, screen: NavTree.ScreenSpec) => boolean
  // Merges params into the route with this key, in place and without a transition. Returns
  // whether it dispatched.
  setRouteParams: (routeKey: string | undefined, params: object) => boolean
  // Runs cb once no modal route is up: now, or at the state commit that removes the last one
  // within modalsWaitMs. One wait at a time: a new one drops the one before it. Returns a cancel.
  whenModalsGone: (cb: () => void) => () => void
}


// long enough for a modal's dismissal to commit; a callback run much later would act on whatever the
// user has moved on to
const modalsWaitMs = 1000

let nextRouteKey = 0

// A tab navigator reset is taken as given, history included. The app's tab navigators go back with
// backBehavior 'none', for which the router keeps only the focused tab in history; a reset that
// focuses another tab writes the same.
const tabHistoryOf = (focusedTabKey: string) => [{key: focusedTabKey, type: 'route' as const}]

const makeNavigator = (ref: NavigatorRef): Navigator => {
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
      }
      // A modal replaces only a modal. With none up, the replace would reach the root stack and
      // replace loggedIn, taking the tabs with it; there the modal opens above them instead.
      if (!NavTree.isModalRouteName(routeName) || NavTree.modalStack(ns).length > 0) {
        ref.dispatch(StackActions.replace(routeName, params))
        return true
      }
    }

    ref.dispatch(StackActions.push(routeName, params))
    return true
  }

  const navigateAppendOnceRootHas = (
    rootRouteName: string,
    path: NavigateAppendType,
    timeoutMs = 5000
  ) => {
    const rootHas = () => ref.getRootState()?.routes?.some(r => r.name === rootRouteName) ?? false
    if (rootHas()) {
      navigateAppend(path)
      return
    }
    if (!ref.isReady()) {
      logger.warn(`[Nav] navigateAppendOnceRootHas: no navigator, dropping ${path.name}`)
      return
    }
    const timer = setTimeout(() => {
      unsub()
      logger.warn(`[Nav] navigateAppendOnceRootHas: ${rootRouteName} never mounted, dropping ${path.name}`)
    }, timeoutMs)
    const unsub = ref.addListener('state', () => {
      if (!rootHas()) return
      clearTimeout(timer)
      unsub()
      navigateAppend(path)
    })
  }

  const navUpToScreen = (nameOrPath: RouteKeys | NavigateAppendType, replaceIfMissing = false) => {
    if (DEBUG_NAV) {
      console.log('[Nav] navUpToScreen', {nameOrPath, replaceIfMissing})
    }
    if (!ref.isReady()) return
    const rs = ref.getRootState()
    const routeName = typeof nameOrPath === 'string' ? nameOrPath : nameOrPath.name
    const target = NavTree.upToScreenTarget(rs, routeName)
    const rootScreen = rs?.routes?.[0]?.name
    if (target?.closeAboveTabs && rs?.key && rootScreen) {
      ref.dispatch({...StackActions.popTo(rootScreen), target: rs.key})
    }
    // another tab's root on a phone: no stack here can take it, so closing what was above is all
    if (target && !target.found) return

    const found = target?.found
    const stack = found?.stack ?? NavTree.activeStack(rs)
    const stackKey = stack?.key
    const targeted = (action: {type: string; payload?: object}) => (stackKey ? {...action, target: stackKey} : action)

    if (typeof nameOrPath === 'string') {
      ref.dispatch(targeted(StackActions.popTo(nameOrPath)))
      return
    }

    const params = nameOrPath.params as object
    if (found) {
      const nextRoutes = (found.stack.routes as Array<NavTree.Route>)
        .slice(0, found.index + 1)
        .map((route, index) => (index === found.index ? {...route, params} : route))
      ref.dispatch({
        ...CommonActions.reset({
          ...found.stack,
          index: found.index,
          routes: nextRoutes,
        } as Parameters<typeof CommonActions.reset>[0]),
        target: stackKey,
      })
      return
    }

    if (replaceIfMissing) {
      ref.dispatch(targeted(StackActions.replace(routeName, params)))
      return
    }

    ref.dispatch(targeted(StackActions.popTo(routeName)))
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
      const reused = currentChatRoot?.name === 'chatRoot' ? currentChatRoot : undefined
      // A mounted stack's state is stale: false, which the library takes as given, keys included, so
      // the route needs its own: the chat root keeps its key (its screen is not remounted), and a new
      // one gets a fresh key.
      return {
        ...route,
        state: {
          ...(route.state ?? {}),
          index: 0,
          routes: [{key: reused?.key ?? `chatRoot-${nextRouteKey++}`, name: 'chatRoot', params: {...reused?.params, ...params}}],
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
      ...CommonActions.reset({
        ...tabNavState,
        history: tabHistoryOf(tabRoutes[chatTabIndex]!.key),
        index: chatTabIndex,
        routes: updatedRoutes,
      } as Parameters<typeof CommonActions.reset>[0]),
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

  const pushInTab = (tab: Tabs.AppTab, screen: NavTree.ScreenSpec): boolean => {
    if (DEBUG_NAV) {
      console.log('[Nav] pushInTab', {screen, tab})
    }
    if (!ref.isReady()) return false
    const tabNavState = NavTree.tabNavigatorState(ref.getRootState())
    if (!tabNavState?.key) return false
    const tabRoutes = tabNavState.routes as Array<NavTree.Route>
    const tabIndex = tabRoutes.findIndex(r => r.name === tab)
    if (tabIndex < 0) return false
    // A mounted stack's state is stale: false, so every route in it needs its own key.
    const stackRoutes = (tabRoutes[tabIndex]?.state?.routes ?? [{name: NavTree.tabRoots[tab]}]).map(r => ({
      ...r,
      key: r.key ?? `${r.name}-${nextRouteKey++}`,
    }))
    // the screen already on top of that stack, with the same params, only gets its tab shown
    const top = stackRoutes.at(-1)
    const alreadyOnTop = top?.name === screen.name && shallowEqual(top.params, screen.params)
    const nextStack = alreadyOnTop ? stackRoutes : [...stackRoutes, {key: `${screen.name}-${nextRouteKey++}`, ...screen}]
    const updatedRoutes = tabRoutes.map((route, i) =>
      i === tabIndex
        ? {...route, state: {...(route.state ?? {}), index: nextStack.length - 1, routes: nextStack}}
        : route
    )
    ref.dispatch({
      ...CommonActions.reset({
        ...tabNavState,
        history: tabHistoryOf(tabRoutes[tabIndex]!.key),
        index: tabIndex,
        routes: updatedRoutes,
      } as Parameters<typeof CommonActions.reset>[0]),
      target: tabNavState.key,
    })
    return true
  }

  // Targets the route's own navigator: React Navigation hands an action to the focused navigator,
  // and SET_PARAMS never travels down from it, so under a modal a route in a tab stack is out of reach.
  const setRouteParams = (routeKey: string | undefined, params: object): boolean => {
    if (!ref.isReady()) return false
    const holder = routeKey ? NavTree.navigatorHoldingRoute(ref.getRootState(), routeKey) : undefined
    // A navigator a reset just rebuilt has no key until it renders; the focused one gets it then.
    ref.dispatch({
      ...CommonActions.setParams(params),
      source: routeKey,
      ...(holder?.key ? {target: holder.key} : {}),
    })
    return true
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
    pushInTab,
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

export const getNavigator = () => realNavigator
