import * as Common from './common.desktop'
import * as C from '@/constants'
import {useConfigState} from '@/stores/config'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Tabs from '@/constants/tabs'
import logger from '@/logger'
import Header from './header/index.desktop'
import {HeaderLeftCancel} from '@/common-adapters/header-hoc'
import {NavigationContainer} from '@react-navigation/native'
import {createComponentForStaticNavigation} from '@react-navigation/core'
import {createLeftTabNavigator} from './left-tab-navigator.desktop'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {createLinkingConfig} from './linking'
import {handleAppLink} from '@/constants/deeplinks'
import {modalRoutes, routes, loggedOutRoutes, tabRoots, routeMapToStaticScreens, routeMapToScreenElements} from './routes'
import {registerDebugClear} from '@/util/debug'
import type {RootParamList} from '@/router-v2/route-params'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'
import {makeLayout} from './screen-layout.desktop'
import type {RouteDef, GetOptionsParams} from '@/constants/types/router'
import './router.css'

const Tab = createLeftTabNavigator()

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

const makeOptions = (rd: RouteDef) => {
  return ({route, navigation}: GetOptionsParams) => {
    const no = rd.getOptions
    const opt = typeof no === 'function' ? no({navigation, route}) : no
    return {...opt}
  }
}

const tabScreensConfig = routeMapToStaticScreens(routes, makeLayout, makeOptions, false, false)

const tabComponents: Record<string, React.ComponentType> = {}
for (const tab of Tabs.desktopTabs) {
  const nav = createNativeStackNavigator({
    initialRouteName: tabRoots[tab],
    screenOptions: Common.defaultNavigationOptions as any,
    screens: tabScreensConfig as any,
  })
  tabComponents[tab] = createComponentForStaticNavigation(nav, `TabStack_${tab}`)
}

function AppTabsInner() {
  return (
    <Tab.Navigator backBehavior="none" screenOptions={appTabsInnerOptions}>
      {Tabs.desktopTabs.map(tab => (
        <Tab.Screen key={tab} name={tab} component={tabComponents[tab]!} />
      ))}
    </Tab.Navigator>
  )
}

const AppTabs = () => <AppTabsInner />

const loggedOutScreensConfig = routeMapToStaticScreens(loggedOutRoutes, makeLayout, makeOptions, false, true)
const loggedOutOptions: NativeStackNavigationOptions = {
  header: ({navigation}) => (
    <Header navigation={navigation} options={{headerBottomStyle: {height: 0}, headerShadowVisible: false}} />
  ),
}
const LoggedOutNav = createNativeStackNavigator({
  initialRouteName: 'login',
  screenOptions: loggedOutOptions as any,
  screens: loggedOutScreensConfig as any,
})
const LoggedOut = createComponentForStaticNavigation(LoggedOutNav, 'LoggedOut')

const RootStack = createNativeStackNavigator<RootParamList>()
const documentTitle = {
  formatter: () => {
    const t = C.Router2.getTab()
    const m = t ? C.Tabs.desktopTabMeta[t] : undefined
    const tabLabel: string = m?.label ?? ''
    return `Keybase: ${tabLabel}`
  },
}

const rootScreenOptions: NativeStackNavigationOptions = {
  headerLeft: () => <HeaderLeftCancel />,
  headerShown: false, // eventually do this after we pull apart modal2 etc
  presentation: 'transparentModal',
  title: '',
}

const useConnectNavToState = () => {
  const setNavOnce = React.useRef(false)
  React.useEffect(() => {
    if (!setNavOnce.current) {
      if (C.Router2.navigationRef.isReady()) {
        setNavOnce.current = true

        if (__DEV__) {
          window.DEBUGNavigator = C.Router2.navigationRef.current
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

// Set up the fallback handler for emitDeepLink on desktop (no linking prop needed on Electron)
createLinkingConfig(handleAppLink)

const modalScreens = routeMapToScreenElements(modalRoutes, RootStack.Screen, makeLayout, makeOptions, true, false)
function ElectronApp() {
  useConnectNavToState()
  const loggedInUser = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const everLoadedRef = React.useRef(false)
  const loggedInLoaded = useDaemonState(s => {
    const loaded = everLoadedRef.current || s.handshakeState === 'done'
    everLoadedRef.current = loaded
    return loaded
  })

  const onUnhandledAction = (a: Readonly<{type: string}>) => {
    logger.info(`[NAV] Unhandled action: ${a.type}`, a, C.Router2.logState())
  }

  const setNavState = C.useRouterState(s => s.dispatch.setNavState)
  const onStateChange = () => {
    const ns = C.Router2.getRootState()
    setNavState(ns)
  }

  const navRef = (ref: typeof C.Router2.navigationRef.current) => {
    if (ref) {
      C.Router2.navigationRef.current = ref
    }
  }

  return (
    <NavigationContainer
      documentTitle={documentTitle}
      onStateChange={onStateChange}
      onUnhandledAction={onUnhandledAction}
      ref={navRef}
      theme={Shared.theme}
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
}

export default ElectronApp
