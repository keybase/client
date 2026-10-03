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
import {useRouterState} from '@/stores/router'
import {DEBUG_NAV} from './nav-debug'
import {registerDebugClear} from '@/util/debug-registry'
import {shallowEqual} from './utils'
import type {NavigateAppendType, RouteKeys, RootParamList} from '@/router-v2/route-params'

type ContainerRef = NavigationContainerRef<RootParamList>
export type NavAction = Exclude<Parameters<ContainerRef['dispatch']>[0], (...args: never) => unknown>

// What an adapter has to provide. Deliberately the smallest surface that the
// operations below need, so a fake is a handful of lines rather than a mock of
// React Navigation.
export type NavigatorRef = {
  isReady: () => boolean
  getRootState: () => NavTree.NavState | undefined
  dispatch: (action: NavAction) => void
  addListener: (type: 'state', cb: () => void) => () => void
  // Every root state change, and the container becoming ready, before which addListener is a no-op
  subscribeRoot: (cb: () => void) => () => void
}

// A navigateAppendOnceRootHas wait. It checks at once, at every root state change (the router
// store's copy, which also changes when the container becomes ready), at whatever recheckOn adds, and
// at its timeout. It ends at the first push that happens, or when it gives up; a push the navigator
// refuses leaves it waiting.
export type RootWait = {
  // The screen to push on this root; undefined when it has no place there
  path: (rootName: string) => NavigateAppendType | undefined
  // Whether to push on this root now; read at every check. Absent: any root path has a place on.
  rootOk?: (rootName: string) => boolean
  // How long rootOk is waited for. Default 5000.
  timeoutMs?: number
  // At the timeout: give up ('giveUp', the default), or push on whichever root is mounted then,
  // or the next one the path has a place on, until rootWaitLimitMs in all ('anyRoot')
  atTimeout?: 'giveUp' | 'anyRoot'
  // Checked at every check: false ends the wait without a push
  isStillWanted?: () => boolean
  // More moments to check at (a store the root predicate reads); torn down with the wait
  recheckOn?: (check: () => void) => () => void
  // Once, unless cancelled: whether the push happened
  onEnd?: (pushed: boolean) => void
}

// No wait for a root outlasts this, whatever its policy
export const rootWaitLimitMs = 30_000

export type Navigator = Omit<NavigatorRef, 'dispatch' | 'subscribeRoot'> & {
  navigateUp: () => void
  popStack: () => void
  clearModals: () => void
  // Returns whether the target is now the visible route - either because we dispatched,
  // or because we were already there. False means nothing happened and nothing will.
  navigateAppend: (path: NavigateAppendType, replace?: boolean) => boolean
  // Pushes once the mounted root (the root stack's first route: loggedIn, loggedOut or desktop's
  // loading) is one to push on. For a push whose target lives in a root a store change is about to
  // mount: one dispatched before then reaches no navigator that can handle it and is dropped. Returns
  // a cancel.
  navigateAppendOnceRootHas: (wait: RootWait) => () => void
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
  // where it is: one reset per stack that holds one, built from the root state as it is now (which
  // already has every navigation dispatched before). On iOS a route under one that stays in the root
  // stack is kept: taking a covered screen out of the presented ones crashes react-native-screens
  // ("Modally presented controllers are being reshuffled").
  removeRoutes: (keys: Iterable<string>) => void
  // Runs cb once no modal route is up: now, or at the state commit that removes the last one
  // within modalsWaitMs. One wait at a time: a new one drops the one before it. Returns a cancel.
  whenModalsGone: (cb: () => void) => () => void
}


// long enough for a modal's dismissal to commit; a callback run much later would act on whatever the
// user has moved on to
const modalsWaitMs = 1000

export const makeNavigator = (ref: NavigatorRef): Navigator => {
  // getRootState() has a push as soon as it is dispatched: React Navigation updates its state at
  // once, and only the 'state' event waits for React's commit. So the visible-route dupe check below
  // already sees a repeat tap's first push. This drops an identical push until that event too; the
  // time bound is a backstop in case the container tears down before the listener fires.
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

  // The reset that leaves stack `s` holding only `kept`, still focused on the route it was, or the
  // nearest kept one below it once that route is gone
  const resetStackTo = (s: NonNullable<NavTree.NavState>, kept: ReadonlyArray<object>) => {
    const routes: ReadonlyArray<object> = s.routes ?? []
    const focused = s.index ?? routes.length - 1
    const index = Math.max(0, routes.filter((r, i) => i <= focused && kept.includes(r)).length - 1)
    return {
      ...CommonActions.reset({...s, index, routes: kept} as Parameters<typeof CommonActions.reset>[0]),
      target: s.key,
    }
  }

  const clearModals = () => {
    if (DEBUG_NAV) {
      console.log('[Nav] clearModals')
    }
    if (!ref.isReady()) return
    const ns = ref.getRootState()
    if (!ns || !NavTree.isLoggedIn(ns)) {
      return
    }
    const rootRoutes = ns.routes ?? []
    const keepRoutes = rootRoutes.filter((route, index) => index === 0 || !NavTree.isModalRouteName(route.name))
    if (keepRoutes.length !== rootRoutes.length) {
      ref.dispatch(resetStackTo(ns, keepRoutes))
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

  const navigateAppendOnceRootHas = (wait: RootWait) => {
    const {atTimeout = 'giveUp', isStillWanted, onEnd, path, recheckOn, rootOk, timeoutMs = 5000} = wait
    let ended = false
    let pushing = false
    let timedOut = false
    const teardown: Array<() => void> = []
    const cancel = () => {
      ended = true
      for (const t of teardown.splice(0)) {
        t()
      }
    }
    const end = (pushed: boolean) => {
      cancel()
      onEnd?.(pushed)
    }
    const rootName = () => ref.getRootState()?.routes?.[0]?.name
    const giveUp = () => {
      if (ended) return
      const root = rootName()
      const dropped = root === undefined ? undefined : path(root)?.name
      logger.warn(
        `[Nav] navigateAppendOnceRootHas: gave up on root ${root ?? '(none)'}${dropped ? `, dropping ${dropped}` : ''}`
      )
      end(false)
    }
    const check = () => {
      if (ended || pushing) return
      if (isStillWanted && !isStillWanted()) {
        end(false)
        return
      }
      const root = rootName()
      if (root === undefined || (!timedOut && rootOk && !rootOk(root))) return
      const target = path(root)
      if (!target) return
      if (push(target)) {
        end(true)
      }
    }
    // The push's own state change comes back to check before it returns
    const push = (target: NavigateAppendType) => {
      pushing = true
      try {
        return navigateAppend(target)
      } finally {
        pushing = false
      }
    }
    teardown.push(ref.subscribeRoot(check))
    if (recheckOn) {
      teardown.push(recheckOn(check))
    }
    const timers = [
      setTimeout(() => {
        if (atTimeout === 'giveUp') {
          giveUp()
        } else {
          timedOut = true
          check()
        }
      }, Math.min(timeoutMs, rootWaitLimitMs)),
    ]
    if (atTimeout === 'anyRoot') {
      timers.push(setTimeout(giveUp, rootWaitLimitMs))
    }
    teardown.push(() => timers.forEach(clearTimeout))
    check()
    return cancel
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
    const root = ref.getRootState()
    const prune = (s: NavTree.NavState | undefined) => {
      const routes = s?.routes
      if (!s || !routes) return
      // Only a keyed stack is rebuilt. A tab navigator holds no route this removes, and a state with
      // no key has nothing to target; their routes' stacks are pruned as they are.
      if (s.type !== 'stack' || !s.key) {
        for (const r of routes) {
          prune(r.state)
        }
        return
      }
      let underKept = false
      const kept = [...routes]
        .reverse()
        .filter(r => {
          const gone = !!r.key && remove.has(r.key) && !(isIOS && s === root && underKept)
          underKept ||= !gone
          return !gone
        })
        .reverse()
      if (kept.length !== routes.length) {
        if (!kept.length) {
          // A stack can't be left empty; its last route goes with whatever holds it
          logger.warn('[Nav] removeRoutes: not emptying a stack')
          return
        }
        ref.dispatch(resetStackTo(s, kept))
      }
      for (const r of kept) {
        prune(r.state)
      }
    }
    prune(root)
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
  // The router store's copy is set from the container's onReady and onStateChange
  subscribeRoot: cb =>
    useRouterState.subscribe((s, prev) => {
      if (s.navState !== prev.navState) {
        cb()
      }
    }),
}

const realNavigator = makeNavigator(containerRefAdapter)

let currentNavigator: Navigator = realNavigator

export const getNavigator = () => currentNavigator

// Swaps in another adapter - the in-memory fake in tests. Passing nothing restores
// the real one.
export const setNavigator = (navigator?: Navigator) => {
  currentNavigator = navigator ?? realNavigator
}
