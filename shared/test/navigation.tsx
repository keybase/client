// The app's navigation tree on the real React Navigation library and the app's real navigationRef,
// so C.Router2 and the Navigator run exactly as they do in the app.
//
// The navigators are the real ones too: native-stack's stack (its web view, which jest loads), and on
// desktop the app's own left tab navigator, which mounts every tab under Activity. A phone's or
// tablet's native bottom tabs cannot run here, so their stand-in only mounts a tab once focused
// and keeps it, as the app's `lazy: true` does. Headers are not drawn.
//
// Known gap on phone and tablet: the native stack view keeps the screen just below the top (and one
// under a modal or sheet) running, where the web view pauses it. A phone test that needs a covered
// screen running should get there by navigating, as a user does, after that screen is up. Screens are registered as
// router.tsx registers them, from the real route names (route-names.ts), per layout.
//
// Recording what the app dispatched (actions, pushes) records our own output; what those
// actions do to the tree is always the library's answer, read back from getRootState().
import * as React from 'react'
import {act} from 'react'
import {flushSync} from 'react-dom'
import {createRoot, type Root} from 'react-dom/client'
import {
  TabRouter,
  createNavigatorFactory,
  useNavigationBuilder,
  type NavigationState,
  type ParamListBase,
  type PartialState,
  type RouteProp,
} from '@react-navigation/core'
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import * as NavTree from '@/constants/nav-tree'
import * as Tabs from '@/constants/tabs'
import {navigationRef} from '@/constants/navigator'
import {createLeftTabNavigator} from '@/router-v2/left-tab-navigator'
import {useRouterState, type NavState} from '@/stores/router'
import {loggedOutRouteNames, modalRouteNames, routeInitialParams, routeNames, routeScreenOptions} from './route-names'

// jsdom has no layout engine, so nothing is ever resized; the navigators measure through this.
const jsdomGlobals = globalThis as unknown as {
  ResizeObserver?: unknown
  HTMLCanvasElement?: {prototype: {getContext: () => null}}
}
jsdomGlobals.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom has no canvas; it logs before giving null, which the app's text measuring already handles.
if (jsdomGlobals.HTMLCanvasElement) {
  jsdomGlobals.HTMLCanvasElement.prototype.getContext = () => null
}

export type Layout = 'desktop' | 'tablet' | 'phone'

type NavigatorProps = Parameters<typeof useNavigationBuilder>[1]

// Stand-in for native bottom tabs (lazy): a tab mounts once it is focused and then stays mounted. A
// tab that only had state written into it, never focused, is not mounted.
function NativeTabsStandIn(props: NavigatorProps) {
  const {state, descriptors, render} = useNavigationBuilder(TabRouter, props)
  const focusedKey = state.routes[state.index]?.key
  const [visited, setVisited] = React.useState<ReadonlySet<string>>(() => new Set())
  if (focusedKey && !visited.has(focusedKey)) {
    setVisited(new Set([...visited, focusedKey]))
  }
  return render(
    <>
      {state.routes.map(r =>
        r.key === focusedKey || visited.has(r.key) ? (
          <React.Fragment key={r.key}>{descriptors[r.key]?.render()}</React.Fragment>
        ) : null
      )}
    </>
  )
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
const RootStack: any = createNativeStackNavigator()
const TabStack: any = createNativeStackNavigator()
const LoggedOutStack: any = createNativeStackNavigator()
const DesktopTabs: any = createLeftTabNavigator()
const NativeTabs: any = createNavigatorFactory(NativeTabsStandIn)()
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

type ScreenContent = (route: RouteProp<ParamListBase>) => React.ReactNode
const ScreenContentContext = React.createContext<ScreenContent>(() => null)
const LayoutContext = React.createContext<Layout>('desktop')

function Leaf({route}: {route: RouteProp<ParamListBase>}): React.ReactNode {
  return React.use(ScreenContentContext)(route)
}

const tabsFor = (layout: Layout): ReadonlyArray<Tabs.AppTab> =>
  layout === 'desktop' ? Tabs.desktopTabs : layout === 'tablet' ? Tabs.tabletTabs : Tabs.phoneTabs

const tabRootNames = new Set<string>(Object.values(NavTree.tabRoots))

// A phone's tab stack registers only its root; tablet and desktop register every route there.
const tabStackScreens = (layout: Layout, tab: Tabs.AppTab): ReadonlyArray<string> =>
  layout === 'phone' ? [NavTree.tabRoots[tab]] : routeNames

const noHeader = {headerShown: false}
const screenOptionsOf = (layout: Layout, name: string) => ({
  ...noHeader,
  ...routeScreenOptions[layout === 'desktop' ? 'desktop' : 'phone'][name],
})

// router.tsx's root stack options: desktop draws every root screen as a transparent modal; native
// presents the modal group as modals.
const rootScreenOptions = (layout: Layout) =>
  layout === 'desktop' ? {...noHeader, presentation: 'transparentModal' as const} : noHeader
const modalOptions = (layout: Layout, name: string) =>
  layout === 'desktop' ? screenOptionsOf(layout, name) : {...screenOptionsOf(layout, name), presentation: 'modal' as const}

const tabStackComponents = Object.fromEntries(
  Tabs.desktopTabs.map(tab => [
    tab,
    function TabStackScreen() {
      const layout = React.use(LayoutContext)
      return (
        <TabStack.Navigator initialRouteName={NavTree.tabRoots[tab]} screenOptions={noHeader}>
          {tabStackScreens(layout, tab).map(name => (
            <TabStack.Screen key={name} name={name} component={Leaf} options={screenOptionsOf(layout, name)} initialParams={routeInitialParams[name]} />
          ))}
        </TabStack.Navigator>
      )
    },
  ])
) as unknown as Record<Tabs.AppTab, React.ComponentType>

function LoggedInTabs() {
  const layout = React.use(LayoutContext)
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  const Navigator = layout === 'desktop' ? DesktopTabs : NativeTabs
  return (
    <Navigator.Navigator backBehavior="none" screenOptions={noHeader}>
      {tabsFor(layout).map(tab => (
        <Navigator.Screen key={tab} name={tab} component={tabStackComponents[tab]} />
      ))}
    </Navigator.Navigator>
  )
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
}

function LoggedOut() {
  const layout = React.use(LayoutContext)
  return (
    <LoggedOutStack.Navigator initialRouteName="login" screenOptions={noHeader}>
      {loggedOutRouteNames.map(name => (
        <LoggedOutStack.Screen key={name} name={name} component={Leaf} options={screenOptionsOf(layout, name)} initialParams={routeInitialParams[name]} />
      ))}
    </LoggedOutStack.Navigator>
  )
}

// The root stack's registrations follow router.tsx's groups: logged in, the tabs, (on a phone) every
// non-root route above them, and the modals; logged out, only the logged-out stack.
function RootScreens({layout, loggedIn}: {layout: Layout; loggedIn: boolean}) {
  if (!loggedIn) {
    return (
      <RootStack.Navigator screenOptions={rootScreenOptions(layout)}>
        <RootStack.Screen name="loggedOut" component={LoggedOut} />
      </RootStack.Navigator>
    )
  }
  const above = layout === 'phone' ? routeNames.filter(name => !tabRootNames.has(name)) : []
  return (
    <RootStack.Navigator screenOptions={rootScreenOptions(layout)}>
      <RootStack.Screen name="loggedIn" component={LoggedInTabs} />
      {above.map(name => (
        <RootStack.Screen key={name} name={name} component={Leaf} options={screenOptionsOf(layout, name)} initialParams={routeInitialParams[name]} />
      ))}
      {modalRouteNames.map(name => (
        <RootStack.Screen key={name} name={name} component={Leaf} options={modalOptions(layout, name)} initialParams={routeInitialParams[name]} />
      ))}
    </RootStack.Navigator>
  )
}

type NavigationTreeProps = {
  layout: Layout
  loggedIn: boolean
  initialState?: NavTree.NavState
  screen: ScreenContent
  children?: React.ReactNode
}

// What router.tsx's onReady and onStateChange do with the state: feed the router store, from a new
// container's first state and from each change after. (Its onReady also marks navigation ready for
// the signed-in uid; tests set that themselves, as account state they arrange.)
const reportNavState = () => {
  useRouterState.getState().dispatch.setNavState(navigationRef.getRootState() as NavState)
}

export function NavigationTree(p: NavigationTreeProps) {
  const {layout, loggedIn, initialState, screen, children} = p
  return (
    <LayoutContext value={layout}>
      <ScreenContentContext value={screen}>
        <NavigationContainer
          ref={navigationRef}
          initialState={initialState as PartialState<NavigationState> | undefined}
          onReady={reportNavState}
          onStateChange={reportNavState}
        >
          <RootScreens layout={layout} loggedIn={loggedIn} />
        </NavigationContainer>
        {children}
      </ScreenContentContext>
    </LayoutContext>
  )
}

// What the app dispatched through navigationRef, in order.
type RecordedAction = {
  type: string
  payload?: Record<string, unknown>
  target?: string
  source?: string
}

const isActEnvironment = () => !!(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT

// React work done the way the surrounding test runs React: inside act where the test is an act
// environment (testing-library), and synchronously otherwise.
const runReact = (fn: () => void) => {
  if (isActEnvironment()) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    act(fn)
  } else {
    flushSync(fn)
  }
}

export type InstalledNavigation = {
  actions: Array<RecordedAction>
  lastAction: () => RecordedAction | undefined
  types: () => Array<string>
  pushes: () => Array<{name?: unknown; params?: unknown}>
  clearActions: () => void
  getRootState: () => NavTree.NavState | undefined
  // The route rendered on screen right now, from the library's own state.
  visibleScreen: () => ReturnType<typeof NavTree.visibleScreen>
  // Replaces the whole tree, as a deep link or account switch does: re-registers the root for the
  // state's logged-in side and resets the container onto it.
  setRootState: (state: NavTree.NavState) => void
  unmount: () => void
}

export type MountedNavigation = InstalledNavigation & {
  mount: () => void
  // Flips the root's groups on the mounted container, as router.tsx does when the session logs
  // in or out: the container stays up (its 'state' listeners with it) and the library settles the
  // tree onto the new registrations.
  setLoggedIn: (loggedIn: boolean) => void
}

let mounted: {root: Root; host: HTMLElement} | undefined

type InstallNavigationOptions = {
  rootState?: NavTree.NavState
  layout?: Layout
  // What a route's screen renders. Defaults to nothing.
  screen?: ScreenContent
  // Leave the container unmounted, so navigationRef is not ready, until mount() is called.
  ready?: boolean
}

// Mounts the tree in its own root. For a component under test, use navigationWrapper instead, which
// renders that component as a route of the same tree.
export const installNavigation = (p?: InstallNavigationOptions): MountedNavigation => {
  uninstallNavigation()
  // router.tsx registers these at startup
  NavTree.setModalRouteNames(modalRouteNames)
  const layout = p?.layout ?? 'desktop'
  const state = p?.rootState
  const screen = p?.screen ?? (() => null)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted = {host, root}
  let current = state
  let loggedIn = !state || NavTree.isLoggedIn(state)
  let generation = 0
  const render = () =>
    runReact(() =>
      root.render(
        <NavigationTree
          key={generation}
          layout={layout}
          loggedIn={loggedIn}
          initialState={current}
          screen={screen}
        />
      )
    )
  const recorder = recordDispatches()
  const mount = render
  if (p?.ready !== false) {
    mount()
  }
  return {
    ...recorder,
    mount,
    // A logged-in flip re-registers the root's groups, which the app does by re-rendering with the
    // group conditions changed. Remounting onto the new state lands where that settles.
    setLoggedIn: next => {
      loggedIn = next
      render()
    },
    setRootState: next => {
      generation++
      current = next
      loggedIn = NavTree.isLoggedIn(next)
      render()
    },
    unmount: uninstallNavigation,
  }
}

export const uninstallNavigation = () => {
  if (!mounted) return
  const {host, root} = mounted
  mounted = undefined
  runReact(() => root.unmount())
  document.body.removeChild(host as unknown as Parameters<typeof document.body.removeChild>[0])
  stopRecording?.()
}

let stopRecording: (() => void) | undefined

export type NavigationRecorder = ReturnType<typeof recordDispatches>

const recordDispatches = () => {
  stopRecording?.()
  const actions: Array<RecordedAction> = []
  const original = navigationRef.dispatch
  navigationRef.dispatch = action => {
    actions.push(action as unknown as RecordedAction)
    original(action)
  }
  stopRecording = () => {
    navigationRef.dispatch = original
    stopRecording = undefined
  }
  return {
    actions,
    clearActions: () => {
      actions.length = 0
    },
    getRootState: () => (navigationRef.isReady() ? (navigationRef.getRootState() as NavTree.NavState) : undefined),
    lastAction: () => actions.at(-1),
    pushes: () =>
      actions.filter(a => a.type === 'PUSH').map(a => ({name: a.payload?.['name'], params: a.payload?.['params']})),
    types: () => actions.map(a => a.type),
    visibleScreen: () =>
      navigationRef.isReady() ? NavTree.visibleScreen(navigationRef.getRootState() as NavTree.NavState) : undefined,
  }
}

type RouteSpec = {name: string; params?: object}

// A logged-in (or logged-out) tree to start from, as a partial state the library rehydrates: route
// keys are kept, navigator keys are the library's own. Read a navigator's key back from
// getRootState() rather than assuming one.
export const makeRootState = (p?: {
  tab?: Tabs.AppTab
  // screens inside the selected tab's stack; defaults to that tab's root screen
  tabStack?: ReadonlyArray<RouteSpec>
  // screens in the root stack above the tab navigator: modals, and on a phone pushed screens
  above?: ReadonlyArray<RouteSpec>
  // false builds the logged-out root instead; `above` then sits in the logged-out stack
  loggedIn?: boolean
}): NavTree.NavState => {
  const above = p?.above ?? []
  if (p?.loggedIn === false) {
    return {
      index: 0,
      routes: [
        {
          key: 'loggedOut',
          name: 'loggedOut',
          state: {
            index: above.length,
            routes: [{key: 'login-0', name: 'login'}, ...above.map((r, i) => routeOf(r, `above-${i}`))],
          },
        },
      ],
    } as NavTree.NavState
  }
  const tab = p?.tab ?? Tabs.chatTab
  const tabStack = p?.tabStack ?? [{name: NavTree.tabRoots[tab]}]
  return {
    index: above.length,
    routes: [
      {
        key: 'loggedIn',
        name: 'loggedIn',
        state: {
          index: 0,
          routes: [
            {
              key: tab,
              name: tab,
              state: {index: tabStack.length - 1, routes: tabStack.map((r, i) => routeOf(r, `${i}`))},
            },
          ],
        },
      },
      ...above.map((r, i) => routeOf(r, `above-${i}`)),
    ],
  } as NavTree.NavState
}

const routeOf = (r: RouteSpec, suffix: string) => ({
  key: `${r.name}-${suffix}`,
  name: r.name,
  ...(r.params ? {params: r.params} : {}),
})

// The first route in the library's state that `match` picks, and the key of the stack it is in.
const findRoute = (match: (r: NavTree.Route) => boolean) => {
  const find = (s?: NavTree.NavState): {route: NavTree.Route; stackKey?: string} | undefined => {
    for (const r of (s?.routes ?? []) as ReadonlyArray<NavTree.Route>) {
      if (match(r)) return {route: r, stackKey: s?.key}
      const inner = find(r.state as NavTree.NavState | undefined)
      if (inner) return inner
    }
    return undefined
  }
  return find(navigationRef.isReady() ? (navigationRef.getRootState() as NavTree.NavState) : undefined)
}

// The navigator key of the stack a route is in, read from the library's state.
export const stackKeyOf = (routeName: string) => findRoute(r => r.name === routeName)?.stackKey

export const routeByKey = (key: string) => findRoute(r => r.key === key)?.route

// The library emits 'state' and mounts screens after React renders a dispatch, on React's schedule:
// under jsdom that is a 1ms timer, so these wait in real 1ms turns. rendersUntil stops once `cond`
// holds; renders waits out a fixed number of turns, for a check that nothing (more) happens.
export const rendersUntil = async (cond: () => boolean, turns = 100) => {
  for (let i = 0; i < turns && !cond(); i++) {
    await new Promise(resolve => setTimeout(resolve, 1))
  }
}
export const renders = async (turns = 10) => rendersUntil(() => false, turns)

// A tree whose visible route is `route`: a modal goes above the tabs, a phone's non-root screen goes
// above the tabs, and anything else goes on top of `tab`'s stack.
export const stateShowing = (
  route: string,
  p?: {params?: object; tab?: Tabs.AppTab; layout?: Layout}
): NavTree.NavState => {
  const tab = p?.tab ?? Tabs.chatTab
  const spec = {name: route, ...(p?.params ? {params: p.params} : {})}
  const tabRoot = NavTree.tabRoots[tab]
  if ((modalRouteNames as ReadonlyArray<string>).includes(route)) {
    return makeRootState({above: [spec], tab})
  }
  if ((loggedOutRouteNames as ReadonlyArray<string>).includes(route)) {
    return makeRootState({above: route === 'login' ? [] : [spec], loggedIn: false})
  }
  if (route === tabRoot) {
    return makeRootState({tab, tabStack: [spec]})
  }
  if (p?.layout === 'phone') {
    return makeRootState({above: [spec], tab})
  }
  return makeRootState({tab, tabStack: [{name: tabRoot}, spec]})
}

export type RenderInNavigationOptions = {
  // the route the component is rendered as
  route: string
  params?: object
  tab?: Tabs.AppTab
  layout?: Layout
  // start from this tree instead; `route` must be in it for the component to render
  rootState?: NavTree.NavState
}

const treeFor = (children: React.ReactNode, p: RenderInNavigationOptions) => {
  const layout = p.layout ?? 'desktop'
  const state = p.rootState ?? stateShowing(p.route, {layout, params: p.params, tab: p.tab})
  return (
    <NavigationTree
      layout={layout}
      loggedIn={NavTree.isLoggedIn(state)}
      initialState={state}
      screen={(r): React.ReactNode => (r.name === p.route ? children : null)}
    />
  )
}

// A testing-library wrapper (render's or renderHook's) that renders its children as `route` of the
// real tree. Returns the recorder for what the app dispatched.
export const navigationWrapper = (p: RenderInNavigationOptions) => {
  uninstallNavigation()
  NavTree.setModalRouteNames(modalRouteNames)
  const recorder = recordDispatches()
  function NavigationWrapper({children}: {children?: React.ReactNode}) {
    return treeFor(children, p)
  }
  return {...recorder, wrapper: NavigationWrapper}
}

if (typeof afterEach === 'function') {
  afterEach(() => {
    uninstallNavigation()
    stopRecording?.()
  })
}
