// The in-memory Navigator adapter: the second implementation of the seam, so that
// substituting navigation in a test is installing an adapter rather than mocking a
// module. It records what was dispatched and serves whatever root state the test set;
// it deliberately does not reduce actions into state - a test that needs the tree to
// change says so with setRootState.
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
  lastAction: () => RecordedAction | undefined
  // Every route name pushed, in order, with the params it was pushed with.
  pushes: () => Array<{name?: unknown; params?: unknown}>
  // Every screen navigateAppend asked for, in order: pushes plus the replaces it
  // dispatches when called with replace=true.
  navigations: () => Array<{name?: unknown; params?: unknown; replace: boolean}>
  // Whether a reset of the root stack left no modal behind, which is what clearModals does.
  modalsCleared: () => boolean
  // The dispatched action types, in order (PUSH, RESET, GO_BACK, JUMP_TO, ...).
  types: () => Array<string>
  clearActions: () => void
  // Replaces the root state and fires the 'state' listeners, as a real commit would.
  setRootState: (state?: NavTree.NavState) => void
  setReady: (ready: boolean) => void
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

export const makeFakeNavigator = (p?: {
  rootState?: NavTree.NavState
  ready?: boolean
  // Called at the moment of dispatch, for tests that assert ordering against it.
  onDispatch?: (action: RecordedAction) => void
}): FakeNavigator => {
  const actions: Array<RecordedAction> = []
  let rootState = p?.rootState ?? makeRootState()
  let ready = p?.ready ?? true
  const listeners = new Set<() => void>()

  const ref: NavigatorRef = {
    addListener: (_type, cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    dispatch: action => {
      if (!ready) return
      const recorded = action as unknown as RecordedAction
      actions.push(recorded)
      p?.onDispatch?.(recorded)
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
    },
    lastAction: () => actions.at(-1),
    modalsCleared: () =>
      actions.some(
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
      rootState = next
      for (const cb of [...listeners]) {
        cb()
      }
    },
    types: () => actions.map(a => a.type),
  }
}

// Installs the fake as the app-wide Navigator, so the free-function facade
// (C.Router2.navigateAppend and friends) drives it. Also registers the modal route
// names, which the tree readers require.
export const installFakeNavigator = (p?: {
  rootState?: NavTree.NavState
  ready?: boolean
  modalRouteNames?: Iterable<string>
  onDispatch?: (action: RecordedAction) => void
}): FakeNavigator => {
  NavTree.setModalRouteNames(p?.modalRouteNames ?? [])
  const fake = makeFakeNavigator(p)
  setNavigator(fake)
  return fake
}

export const restoreNavigator = () => {
  setNavigator()
  NavTree.setModalRouteNames([])
}
