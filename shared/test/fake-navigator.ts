// The in-memory Navigator adapter: the second implementation of the seam, so that
// substituting navigation in a test is installing an adapter rather than mocking a
// module. It records what was dispatched and folds each action into its root state
// the way React Navigation's routers would, so an operation that reads the tree
// after an earlier navigation sees what it would see in the app.
//
// By default every dispatch commits at once. With commit: 'manual' actions queue until
// commit(), for tests about the window between a dispatch and React Navigation's commit.
import * as NavTree from '@/constants/nav-tree'
import * as Tabs from '@/constants/tabs'
import {makeNavigator, setNavigator, type Navigator, type NavigatorRef} from '@/constants/navigator'

// The action shapes React Navigation's creators produce, narrowed to what assertions need.
export type RecordedAction = {
  type: string
  payload?: Record<string, unknown>
  target?: string
  source?: string
}

export type FakeNavigator = Navigator & {
  actions: Array<RecordedAction>
  // The adapter's raw dispatch, which the Navigator itself does not expose.
  dispatch: NavigatorRef['dispatch']
  lastAction: () => RecordedAction | undefined
  // Every route name pushed, in order, with the params it was pushed with.
  pushes: () => Array<{name?: unknown; params?: unknown}>
  // Every screen navigateAppend asked for, in order: pushes plus the replaces it
  // dispatches when called with replace=true.
  navigations: () => Array<{name?: unknown; params?: unknown; replace: boolean}>
  // Whether clearModals dispatched a reset of the root stack that left no modal behind.
  modalsCleared: () => boolean
  // The dispatched action types, in order (PUSH, RESET, GO_BACK, JUMP_TO, ...).
  types: () => Array<string>
  clearActions: () => void
  // Folds any queued actions into the root state and fires the 'state' listeners. Only
  // needed with commit: 'manual'.
  commit: () => void
  // Replaces the root state and fires the 'state' listeners, as a real commit would.
  setRootState: (state?: NavTree.NavState) => void
  setReady: (ready: boolean) => void
  // How many 'state' listeners are subscribed right now.
  listenerCount: () => number
}

type RouteSpec = {name: string; params?: object}

// A keyed, logged-in root state. Keys are stable and readable so that `target`/`source`
// assertions can name them: 'root', 'tabs', '<tab>-stack', '<name>-<index>'.
export const makeRootState = (p?: {
  tab?: Tabs.AppTab
  // screens inside the selected tab's stack; defaults to that tab's root screen
  tabStack?: ReadonlyArray<RouteSpec>
  // screens in the root stack above the tab navigator: modals and phone-pushed screens
  above?: ReadonlyArray<RouteSpec>
  // false builds the logged-out root instead; `above` still applies, `tab`/`tabStack` do not
  loggedIn?: boolean
}): NavTree.NavState => {
  const tab = p?.tab ?? Tabs.chatTab
  const above = p?.above ?? []
  if (p?.loggedIn === false) {
    // The logged-out root is a real stack with its own key and screens, so a reader that
    // forgets to check which root it is looking at finds something to act on.
    return {
      index: above.length,
      key: 'root',
      routes: [
        {
          key: 'loggedOut',
          name: 'loggedOut',
          state: {
            index: 0,
            key: 'loggedOut-stack',
            routes: [{key: 'login-0', name: 'login'}],
            type: 'stack',
          },
        },
        ...above.map((r, i) => ({key: `${r.name}-above-${i}`, name: r.name, params: r.params})),
      ],
      type: 'stack',
    }
  }
  const tabStack = p?.tabStack ?? [{name: NavTree.tabRoots[tab]}]
  return {
    index: above.length,
    key: 'root',
    routes: [
      {
        key: 'loggedIn',
        name: 'loggedIn',
        state: {
          index: 0,
          key: 'tabs',
          routes: [
            {
              key: tab,
              name: tab,
              state: {
                index: tabStack.length - 1,
                key: `${tab}-stack`,
                routes: tabStack.map((r, i) => ({key: `${r.name}-${i}`, name: r.name, params: r.params})),
                type: 'stack',
              },
            },
          ],
          type: 'tab',
        },
      },
      ...above.map((r, i) => ({key: `${r.name}-above-${i}`, name: r.name, params: r.params})),
    ],
    type: 'stack',
  }
}

// ---- The reducer ----
//
// A deliberately small model of React Navigation's stack and tab routers, covering the
// actions the Navigator dispatches. An action it does not model throws, so a test can
// never silently run against a tree that stopped tracking the app.

type FakeRoute = {key: string; name: string; params?: object; state?: FakeState}
type FakeState = {key: string; index: number; routes: Array<FakeRoute>; type: string}

// Copies the navigators and routes; params are copied shallowly and otherwise kept as they
// are, so an undefined-valued key survives like it does in the app.
const cloneState = (s: FakeState): FakeState => ({
  ...s,
  routes: s.routes.map(r => ({
    ...r,
    ...(r.params ? {params: {...r.params}} : {}),
    ...(r.state ? {state: cloneState(r.state)} : {}),
  })),
})

// The navigators from the root down along the focused routes.
const focusChain = (root: FakeState): Array<FakeState> => {
  const chain = [root]
  for (;;) {
    const s = chain.at(-1)!
    const child = s.routes[s.index]?.state
    if (!child) return chain
    chain.push(child)
  }
}

// Modal screens are registered only on the root stack, so React Navigation hands an untargeted
// action for one up from the focused stack to the root. Everything else is registered on every
// tab stack and handled by the deepest focused one.
const isModal = (name?: string) => {
  try {
    return !!name && NavTree.isModalRouteName(name)
  } catch {
    // a test that registered no modal names has none
    return false
  }
}

const stackForName = (root: FakeState, name?: string) =>
  isModal(name) ? root : focusChain(root).filter(s => s.type === 'stack').at(-1)

const findState = (s: FakeState, key: string): FakeState | undefined => {
  if (s.key === key) return s
  for (const r of s.routes) {
    const found = r.state && findState(r.state, key)
    if (found) return found
  }
  return undefined
}

const findRoute = (s: FakeState, key: string): FakeRoute | undefined => {
  for (const r of s.routes) {
    if (r.key === key) return r
    const found = r.state && findRoute(r.state, key)
    if (found) return found
  }
  return undefined
}

export const makeFakeNavigator = (p?: {
  rootState?: NavTree.NavState
  ready?: boolean
  commit?: 'sync' | 'manual'
  // Called at the moment of dispatch, for tests that assert ordering against it.
  onDispatch?: (action: RecordedAction) => void
}): FakeNavigator => {
  const actions: Array<RecordedAction> = []
  const queued: Array<RecordedAction> = []
  // Actions dispatched from inside clearModals.
  const clearModalsActions = new Set<RecordedAction>()
  let insideClearModals = false
  let rootState = p?.rootState ?? makeRootState()
  let ready = p?.ready ?? true
  const listeners = new Set<() => void>()
  let nextKey = 0

  const newKey = (name: string) => `${name}-f${nextKey++}`

  // Keys, indices and navigator types for a partial state from a reset or a builder.
  const complete = (s: NavTree.PartialNavState, type: string, key?: string): FakeState => ({
    index: s.index ?? s.routes.length - 1,
    key: key ?? newKey(type),
    routes: s.routes.map(r => {
      const route = r as NavTree.PartialRoute & {key?: string}
      const state = route.state as (NavTree.PartialNavState & {key?: string; type?: string}) | undefined
      return {
        key: route.key ?? newKey(route.name),
        name: route.name,
        ...(route.params ? {params: route.params} : {}),
        ...(state
          ? {state: complete(state, state.type ?? (route.name === 'loggedIn' ? 'tab' : 'stack'), state.key)}
          : {}),
      }
    }),
    type,
  })

  const stackFor = (root: FakeState, a: RecordedAction) => {
    const s = a.target ? findState(root, a.target) : stackForName(root, a.payload?.['name'] as string | undefined)
    if (!s) throw new Error(`fake navigator: no navigator for ${a.type} (target ${String(a.target)})`)
    return s
  }

  const push = (s: FakeState, name: string, params?: object) => {
    s.routes = [...s.routes.slice(0, s.index + 1), {key: newKey(name), name, ...(params ? {params} : {})}]
    s.index = s.routes.length - 1
  }

  const reduce = (root: FakeState, a: RecordedAction) => {
    const name = a.payload?.['name'] as string | undefined
    const params = a.payload?.['params'] as object | undefined
    switch (a.type) {
      case 'PUSH':
        push(stackFor(root, a), name!, params)
        return
      case 'REPLACE': {
        const s = stackFor(root, a)
        s.routes[s.index] = {key: newKey(name!), name: name!, ...(params ? {params} : {})}
        return
      }
      case 'GO_BACK':
      case 'POP_TO_TOP': {
        const s = focusChain(root)
          .filter(n => n.type === 'stack' && n.index > 0)
          .at(-1)
        if (!s) return
        s.routes = s.routes.slice(0, a.type === 'GO_BACK' ? s.index : 1)
        s.index = s.routes.length - 1
        return
      }
      case 'POP_TO':
      case 'NAVIGATE': {
        const s = stackFor(root, a)
        // POP_TO (and NAVIGATE with pop) go back to the nearest route of that name; a plain
        // NAVIGATE only reuses the current route.
        const i =
          a.type === 'POP_TO' || a.payload?.['pop']
            ? s.routes.slice(0, s.index + 1).map(r => r.name).lastIndexOf(name!)
            : s.routes[s.index]?.name === name
              ? s.index
              : -1
        if (i < 0) {
          if (a.type === 'POP_TO') {
            // not in the stack: it takes the current route's place
            s.routes[s.index] = {key: newKey(name!), name: name!, ...(params ? {params} : {})}
            s.routes = s.routes.slice(0, s.index + 1)
          } else {
            push(s, name!, params)
          }
          return
        }
        s.routes = s.routes.slice(0, i + 1)
        s.index = i
        const route = s.routes[i]!
        if (params) {
          route.params = a.payload?.['merge'] ? {...route.params, ...params} : params
        }
        return
      }
      case 'SET_PARAMS': {
        const route = a.source ? findRoute(root, a.source) : focusChain(root).map(s => s.routes[s.index]).at(-1)
        if (!route) throw new Error(`fake navigator: no route for SET_PARAMS (source ${String(a.source)})`)
        route.params = {...route.params, ...params}
        return
      }
      case 'JUMP_TO': {
        const s = stackFor(root, a)
        let i = s.routes.findIndex(r => r.name === name)
        if (i < 0) {
          // The tab navigator in the app always holds every tab; makeRootState builds only the
          // selected one, so a tab jumped to for the first time appears on its root screen.
          const tabRoot = NavTree.tabRoots[name as Tabs.AppTab]
          s.routes.push({
            key: name!,
            name: name!,
            state: complete({routes: [{name: tabRoot}]}, 'stack', `${name!}-stack`),
          })
          i = s.routes.length - 1
        }
        s.index = i
        return
      }
      case 'RESET': {
        const s = a.target ? findState(root, a.target) : root
        if (!s) throw new Error(`fake navigator: no navigator for RESET (target ${String(a.target)})`)
        Object.assign(s, complete(a.payload as NavTree.PartialNavState, s.type, s.key))
        return
      }
      default:
        throw new Error(`fake navigator: ${a.type} is not modelled`)
    }
  }

  const fireListeners = () => {
    for (const cb of [...listeners]) {
      cb()
    }
  }

  const commit = () => {
    if (!queued.length) return
    const next = cloneState(rootState as FakeState)
    for (const a of queued.splice(0)) {
      reduce(next, a)
    }
    rootState = next as NavTree.NavState
    fireListeners()
  }

  const ref: NavigatorRef = {
    addListener: (_type, cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    dispatch: action => {
      if (!ready) return
      const recorded = action as unknown as RecordedAction
      actions.push(recorded)
      if (insideClearModals) {
        clearModalsActions.add(recorded)
      }
      p?.onDispatch?.(recorded)
      queued.push(recorded)
      if (p?.commit !== 'manual') {
        commit()
      }
    },
    getRootState: () => (ready ? rootState : undefined),
    isReady: () => ready,
  }

  const navigator = makeNavigator(ref)

  return {
    ...navigator,
    actions,
    clearActions: () => {
      actions.length = 0
      clearModalsActions.clear()
    },
    clearModals: () => {
      insideClearModals = true
      try {
        navigator.clearModals()
      } finally {
        insideClearModals = false
      }
    },
    commit,
    dispatch: ref.dispatch,
    lastAction: () => actions.at(-1),
    listenerCount: () => listeners.size,
    modalsCleared: () =>
      [...clearModalsActions].some(
        a =>
          a.type === 'RESET' &&
          a.target === 'root' &&
          ((a.payload?.['routes'] ?? []) as ReadonlyArray<{name: string}>).every(
            r => !NavTree.isModalRouteName(r.name)
          )
      ),
    navigations: () =>
      actions
        .filter(a => a.type === 'PUSH' || a.type === 'REPLACE')
        .map(a => ({name: a.payload?.['name'], params: a.payload?.['params'], replace: a.type === 'REPLACE'})),
    pushes: () =>
      actions
        .filter(a => a.type === 'PUSH')
        .map(a => ({name: a.payload?.['name'], params: a.payload?.['params']})),
    setReady: next => {
      ready = next
    },
    setRootState: next => {
      queued.length = 0
      rootState = next
      fireListeners()
    },
    types: () => actions.map(a => a.type),
  }
}

// The modal route registration from before the first install, put back by restoreNavigator.
let restoreModalRouteNames: (() => void) | undefined

// Installs the fake as the app-wide Navigator, so the free-function facade
// (C.Router2.navigateAppend and friends) drives it. Registers the modal route names
// only when given, and otherwise leaves whatever is registered: a test whose tree has
// routes above the tab navigator has to say which of them are modals, exactly as the
// app does at startup.
export const installFakeNavigator = (p?: {
  rootState?: NavTree.NavState
  ready?: boolean
  commit?: 'sync' | 'manual'
  modalRouteNames?: Iterable<string>
  onDispatch?: (action: RecordedAction) => void
}): FakeNavigator => {
  restoreModalRouteNames ??= NavTree.saveModalRouteNames()
  if (p?.modalRouteNames) {
    NavTree.setModalRouteNames(p.modalRouteNames)
  }
  const fake = makeFakeNavigator(p)
  setNavigator(fake)
  return fake
}

// Restores the real Navigator and the modal route registration from before the first install.
export const restoreNavigator = () => {
  setNavigator()
  restoreModalRouteNames?.()
  restoreModalRouteNames = undefined
}
