// The shape of the navigation tree, in one place.
//
// Every screen lives at one of three depths:
//   root stack        routes[0] is the root screen - the 'loggedIn' tab navigator when
//                     signed in, otherwise 'loggedOut' (or 'loading' on desktop);
//                     routes[1+] hold modals AND non-modal screens pushed above the
//                     tab bar on phones.
//   tab navigator     one route per tab; its index selects the visible tab.
//   tab stack         the screens pushed inside that tab, rooted at tabRoots[tab].
//
// Readers take a plain NavState and are pure. Builders return a PartialNavState suitable
// for CommonActions.reset or React Navigation's linking getStateFromPath. Nothing here
// touches a navigator, dispatches, or knows anything about chat.
import * as Tabs from './tabs'
import type {Immutable} from 'immer'
import type {NavigationState} from '@react-navigation/core'
import type {RootParamList} from '@/router-v2/route-params'

export type Route = NavigationState<RootParamList>['routes'][0]
// still a little paranoid about some things being missing in this type
export type NavState = Partial<Route['state']>

export type PartialRoute = {
  name: string
  params?: Record<string, unknown>
  state?: PartialNavState
}

export type PartialNavState = {
  routes: Array<PartialRoute>
  index?: number
}

export type ScreenSpec = {name: string; params?: Record<string, unknown>}

// The root screen of each tab's stack. Kept here rather than with the route table so the
// tree shape has no dependency on the (very heavy) router config; router-v2/routes
// re-exports this for the navigator definitions.
export const tabRoots = {
  [Tabs.peopleTab]: 'peopleRoot',
  [Tabs.chatTab]: 'chatRoot',
  [Tabs.cryptoTab]: 'cryptoRoot',
  [Tabs.fsTab]: 'fsRoot',
  [Tabs.teamsTab]: 'teamsRoot',
  [Tabs.gitTab]: 'gitRoot',
  [Tabs.devicesTab]: 'devicesRoot',
  [Tabs.settingsTab]: 'settingsRoot',

  [Tabs.loginTab]: '',
  [Tabs.searchTab]: '',
} as const

// Modal route names, registered at startup from the router config (the single source
// of truth — see modalRoutes in router-v2/routes). A serialized NavigationState route
// does not carry its `presentation`, so we cannot detect modals structurally: a route
// living in the root stack (alongside the tab navigator) is a modal iff its name is in
// this set. Everything else there (e.g. chatConversation, and any other non-modal screen
// pushed above the tab bar on phones) is a genuinely-visible screen.
let modalRouteNames: ReadonlySet<string> | undefined
export const setModalRouteNames = (names: Iterable<string>) => {
  modalRouteNames = new Set<string>(names)
}
export const isModalRouteName = (name: string) => {
  if (!modalRouteNames) {
    throw new Error('modalRouteNames not registered; call setModalRouteNames at startup')
  }
  return modalRouteNames.has(name)
}

// ---- Readers ----

export const isLoggedIn = (state?: Immutable<NavState>) => state?.routes?.[0]?.name === 'loggedIn'

export const currentTab = (state?: Immutable<NavState>): Tabs.Tab | undefined => {
  const loggedInRoute = state?.routes?.[0]
  if (loggedInRoute?.name === 'loggedIn') {
    // eslint-disable-next-line
    return loggedInRoute.state?.routes?.[loggedInRoute.state.index ?? 0]?.name as Tabs.Tab
  }
  return undefined
}

// The tab navigator's own state - routes[0] of the root stack. Undefined when logged out.
export const tabNavigatorState = (state?: Immutable<NavState>): Immutable<NavState> | undefined =>
  isLoggedIn(state) ? state?.routes?.[0]?.state : undefined

// The routes in the root stack above the tab navigator that are real modals.
export const modalStack = (state?: Immutable<NavState>): Immutable<Array<Route>> => {
  if (!state || !isLoggedIn(state)) {
    return []
  }
  return (state.routes?.slice(1) ?? []).filter(r => isModalRouteName(r.name)) as Immutable<Array<Route>>
}

// The innermost stack the user is looking at - the one a push/pop should target.
export const activeStack = (state?: Immutable<NavState>): Immutable<NavState> | undefined => {
  const descend = (s: Immutable<NavState> | undefined, depth: number): Immutable<NavState> | undefined => {
    if (!s?.routes || s.index === undefined) {
      return undefined
    }
    if (depth === 0) {
      const topModal = (s.routes.slice(1) as Array<Route>).filter(route => isModalRouteName(route.name)).at(-1)
      if (topModal) {
        return descend(topModal.state, depth + 1) ?? s
      }
      const loggedInRoute = s.routes[0] as Route | undefined
      return descend(loggedInRoute?.state, depth + 1) ?? (s.type === 'stack' ? s : undefined)
    }
    const childRoute = s.routes[s.index] as Route | undefined
    return descend(childRoute?.state, depth + 1) ?? (s.type === 'stack' ? s : undefined)
  }
  return descend(state, 0)
}

// loggedIn/tab/stack items, plus whatever sits above the tab navigator.
export const visiblePath = (
  state?: Immutable<NavState>,
  opts?: {includeModals?: boolean}
): Immutable<Array<Route>> => {
  const includeModals = opts?.includeModals ?? true

  const findVisibleRoute = (
    arr: Immutable<Array<Route>>,
    s: Immutable<NavState>,
    depth: number
  ): Immutable<Array<Route>> => {
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
      // routes[1+] holds both real modals and root non-modal screens (e.g.
      // chatConversation on phones, stacked above the tab bar). The latter are
      // genuinely visible, so always include them; only gate real modals on includeModals.
      const rest = s.routes.slice(1) as Array<Route>
      toAddModals = includeModals ? rest : rest.filter(r => !isModalRouteName(r.name))
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

  if (!state) return []
  return findVisibleRoute([], state, 0)
}

export const visibleScreen = (state?: Immutable<NavState>, opts?: {includeModals?: boolean}) =>
  visiblePath(state, opts).at(-1)

// ---- Builders ----

// Tabs at the root, `tab` selected, optionally with screens pushed inside that tab's stack.
export const tabState = (tab: Tabs.Tab, screenStack?: ReadonlyArray<ScreenSpec>): PartialNavState => {
  const tabRoute: PartialRoute = {name: tab}
  if (screenStack?.length) {
    tabRoute.state = {index: screenStack.length - 1, routes: [...screenStack]}
  }
  return {
    index: 0,
    routes: [{name: 'loggedIn', state: {index: 0, routes: [tabRoute]}}],
  }
}

// A modal in the root stack. underTab selects which tab sits beneath it; without it
// loggedIn falls back to the initial (people) tab.
export const modalState = (
  modalName: string,
  params?: Record<string, unknown>,
  underTab?: Tabs.AppTab
): PartialNavState => ({
  index: 1,
  routes: [
    underTab ? {name: 'loggedIn', state: {index: 0, routes: [{name: underTab}]}} : {name: 'loggedIn'},
    {name: modalName, ...(params ? {params} : {})},
  ],
})

// Phone shape: the tab navigator sits at the root with `tab` selected on its root screen,
// and `screen` is pushed above it so it covers the tab bar.
export const pushedAboveTabs = (tab: Tabs.AppTab, screen: ScreenSpec): PartialNavState => ({
  index: 1,
  routes: [
    {
      name: 'loggedIn',
      state: {
        index: 0,
        routes: [{name: tab, state: {index: 0, routes: [{name: tabRoots[tab]}]}}],
      },
    },
    screen,
  ],
})
