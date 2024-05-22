import * as Common from './common.desktop'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './router.shared'
import {shim, getOptions} from './shim'
import * as Tabs from '@/constants/tabs'
import Header from './header/index.desktop'
import type {RouteDef, RouteMap} from '@/constants/types/router2'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import {HeaderLeftCancel} from '@/common-adapters/header-hoc'
import {NavigationContainer} from '@react-navigation/native'
import {createLeftTabNavigator} from './left-tab-navigator.desktop'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import './router.css'

const Tab = createLeftTabNavigator()

type DesktopTabs = (typeof Tabs.desktopTabs)[number]

const tabRootsVals = Object.values(tabRoots).filter(root => {
  return root !== tabRoots[Tabs.fsTab] && root !== tabRoots[Tabs.gitTab]
}) // we allow some root anywhere
// we don't want the other roots in other stacks
const routesMinusRoots = (tab: DesktopTabs) => {
  const keepVal = tabRoots[tab]
  return Object.keys(routes).reduce<RouteMap>((m, k) => {
    if (k === keepVal || !tabRootsVals.includes(k as (typeof tabRootsVals)[number])) {
      m[k] = routes[k]
    }
    return m
  }, {})
}

type Screen = (p: {
  navigationKey: string
  name: keyof KBRootParamList
  getComponent?: () => React.ComponentType<any>
  options: unknown
}) => React.ReactNode

// to reduce closing over too much memory
const makeOptions = (val: RouteDef) => {
  return ({route, navigation}: {route: C.Router2.Route; navigation: C.Router2.Navigator}) => {
    const no = getOptions(val)
    const opt = typeof no === 'function' ? no({navigation, route} as any) : no
    return {...opt}
  }
}

const makeNavScreens = (rs: typeof routes, Screen: Screen, _isModal: boolean) => {
  return Object.keys(rs).map(_name => {
    const name = _name as keyof KBRootParamList
    const val = rs[name]
    if (!val?.getScreen) return null
    return (
      <Screen
        key={name}
        navigationKey={name}
        name={name}
        getComponent={val.getScreen}
        options={makeOptions(val) as any}
      />
    )
  })
}

const appTabsInnerOptions = {
  ...Common.defaultNavigationOptions,
  header: undefined,
  headerShown: false,
  tabBarActiveBackgroundColor: Kb.Styles.globalColors.blueDarkOrGreyDarkest,
  tabBarHideOnKeyboard: true,
  tabBarInactiveBackgroundColor: Kb.Styles.globalColors.blueDarkOrGreyDarkest,
  tabBarShowLabel: Kb.Styles.isTablet,
  tabBarStyle: Common.tabBarStyle,
}

const TabStack = createNativeStackNavigator()
const TabStackNavigator = React.memo(function TabStackNavigator(p: {route: {name: string}}) {
  const tab = p.route.name as DesktopTabs
  const tabScreens = React.useMemo(
    () => makeNavScreens(shim(routesMinusRoots(tab), false, false), TabStack.Screen as Screen, false),
    [tab]
  )
  return (
    <TabStack.Navigator initialRouteName={tabRoots[tab]} screenOptions={Common.defaultNavigationOptions}>
      {tabScreens}
    </TabStack.Navigator>
  )
})

const AppTabsInner = React.memo(function AppTabsInner() {
  return (
    <Tab.Navigator backBehavior="none" screenOptions={appTabsInnerOptions}>
      {Tabs.desktopTabs.map(tab => (
        <Tab.Screen key={tab} name={tab} component={TabStackNavigator} />
      ))}
    </Tab.Navigator>
  )
})

const AppTabs = () => <AppTabsInner />

const LoggedOutStack = createNativeStackNavigator()
const LoggedOutScreens = makeNavScreens(
  shim(loggedOutRoutes, false, true),
  LoggedOutStack.Screen as Screen,
  false
)
const LoggedOut = React.memo(function LoggedOut() {
  return (
    <LoggedOutStack.Navigator
      initialRouteName="login"
      screenOptions={{
        header: ({navigation}) => (
          <Header
            navigation={navigation}
            options={{headerBottomStyle: {height: 0}, headerShadowVisible: false}}
          />
        ),
      }}
    >
      {LoggedOutScreens}
    </LoggedOutStack.Navigator>
  )
})

const RootStack = createNativeStackNavigator()
const documentTitle = {
  formatter: () => {
    const t = C.Router2.getTab()
    const m = t ? C.Tabs.desktopTabMeta[t] : undefined
    const tabLabel: string = m?.label ?? ''
    return `Keybase: ${tabLabel}`
  },
}

const rootScreenOptions = {
  headerLeft: () => <HeaderLeftCancel />,
  headerShown: false, // eventually do this after we pull apart modal2 etc
  presentation: 'transparentModal',
  title: '',
} as const

const ElectronApp = React.memo(function ElectronApp() {
  const s = Shared.useShared()
  const {loggedInLoaded, loggedIn, appState, onStateChange} = s
  const {navKey, initialState, onUnhandledAction} = s
  Shared.useSharedAfter(appState)

  const ModalScreens = React.useMemo(
    () => makeNavScreens(shim(modalRoutes, true, false), RootStack.Screen as Screen, true),
    []
  )

  return (
    <NavigationContainer
      ref={C.Router2.navigationRef_ as any}
      key={String(navKey)}
      theme={Shared.theme}
      initialState={initialState}
      onStateChange={onStateChange}
      onUnhandledAction={onUnhandledAction}
      documentTitle={documentTitle}
    >
      <RootStack.Navigator key="root" screenOptions={rootScreenOptions}>
        {!loggedInLoaded && (
          <RootStack.Screen key="loading" name="loading" component={Shared.SimpleLoading} />
        )}
        {loggedInLoaded && loggedIn && (
          <React.Fragment key="loggedIn">
            <RootStack.Screen key="loggedIn" name="loggedIn" component={AppTabs} />
            {ModalScreens}
          </React.Fragment>
        )}
        {loggedInLoaded && !loggedIn && (
          <RootStack.Screen key="loggedOut" name="loggedOut" component={LoggedOut} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  )
})

export default ElectronApp
