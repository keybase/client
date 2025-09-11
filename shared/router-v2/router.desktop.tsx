import * as Common from './common.desktop'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Tabs from '@/constants/tabs'
import {makeNavScreens, type Screen} from './shim'
import logger from '@/logger'
import Header from './header/index.desktop'
import {HeaderLeftCancel} from '@/common-adapters/header-hoc'
import {NavigationContainer} from '@react-navigation/native'
import {createLeftTabNavigator} from './left-tab-navigator.desktop'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import {registerDebugClear} from '@/util/debug'
import './router.css'

// eslint-disable-next-line
const Tab = createLeftTabNavigator()
type DesktopTabs = (typeof Tabs.desktopTabs)[number]

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

const TabStackNavigator = createNativeStackNavigator() as {Screen: Screen; Navigator: any}
const tabScreens = makeNavScreens(routes, TabStackNavigator.Screen, false, false)
const TabStack = React.memo(function TabStack(p: {route: {name: string}}) {
  const tab = p.route.name as DesktopTabs
  return (
    <TabStackNavigator.Navigator
      initialRouteName={tabRoots[tab]}
      screenOptions={Common.defaultNavigationOptions}
    >
      {tabScreens}
    </TabStackNavigator.Navigator>
  )
})

const AppTabsInner = React.memo(function AppTabsInner() {
  return (
    <Tab.Navigator backBehavior="none" screenOptions={appTabsInnerOptions}>
      {Tabs.desktopTabs.map(tab => (
        <Tab.Screen key={tab} name={tab} component={TabStack} />
      ))}
    </Tab.Navigator>
  )
})

const AppTabs = () => <AppTabsInner />

const LoggedOutStack = createNativeStackNavigator()
const LoggedOutScreens = makeNavScreens(loggedOutRoutes, LoggedOutStack.Screen as Screen, false, true)
const loggedOutOptions = {
  header: ({navigation}: {navigation: {pop: () => void}}) => (
    <Header navigation={navigation} options={{headerBottomStyle: {height: 0}, headerShadowVisible: false}} />
  ),
}
const LoggedOut = React.memo(function LoggedOut() {
  return (
    <LoggedOutStack.Navigator initialRouteName="login" screenOptions={loggedOutOptions}>
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

const useConnectNavToState = () => {
  const setNavOnce = React.useRef(false)
  React.useEffect(() => {
    if (!setNavOnce.current) {
      if (C.Router2.navigationRef_.isReady()) {
        setNavOnce.current = true

        if (__DEV__) {
          window.DEBUGNavigator = C.Router2.navigationRef_.current
          window.DEBUGRouter2 = C.Router2
          window.KBCONSTANTS = require('@/constants')
          registerDebugClear(() => {
            window.DEBUGNavigator = undefined
            window.DEBUGRouter2 = undefined
            window.KBCONSTANTS = undefined
          })
        }
      }
    }
  }, [setNavOnce])
}

const modalScreens = makeNavScreens(modalRoutes, RootStack.Screen as Screen, true, false)
const ElectronApp = React.memo(function ElectronApp() {
  useConnectNavToState()
  const loggedInUser = C.useCurrentUserState(s => s.username)
  const loggedIn = C.useConfigState(s => s.loggedIn)
  const everLoadedRef = React.useRef(false)
  const loggedInLoaded = C.useDaemonState(s => {
    const loaded = everLoadedRef.current || s.handshakeState === 'done'
    everLoadedRef.current = loaded
    return loaded
  })

  const onUnhandledAction = React.useCallback((a: Readonly<{type: string}>) => {
    logger.info(`[NAV] Unhandled action: ${a.type}`, a, C.Router2.logState())
  }, [])

  const setNavState = C.useRouterState(s => s.dispatch.setNavState)
  const onStateChange = React.useCallback(() => {
    const ns = C.Router2.getRootState()
    setNavState(ns)
  }, [setNavState])

  return (
    <NavigationContainer
      navigationInChildEnabled={true}
      // eslint-disable-next-line
      ref={C.Router2.navigationRef_ as any}
      theme={Shared.theme}
      onStateChange={onStateChange}
      onUnhandledAction={onUnhandledAction}
      documentTitle={documentTitle}
    >
      <RootStack.Navigator key="root" screenOptions={rootScreenOptions}>
        {!loggedInLoaded && (
          <RootStack.Screen key="loading" name="loading" component={Shared.SimpleLoading} />
        )}
        {loggedInLoaded && loggedIn && (
          <React.Fragment key={`${loggedInUser}loggedIn`}>
            <RootStack.Screen key={`${loggedInUser}loggedIn`} name="loggedIn" component={AppTabs} />
            {modalScreens}
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
