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
import {createLeftTabNavigator} from './left-tab-navigator.desktop'
import {createLinkingConfig} from './linking'
import {handleAppLink} from '@/constants/deeplinks'
import {createStaticStackComponent, modalRoutes, routes, loggedOutRoutes, tabRoots, routeMapToStaticScreens} from './routes'
import {registerDebugClear} from '@/util/debug'
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
  tabComponents[tab] = createStaticStackComponent(
    {
      initialRouteName: tabRoots[tab],
      screenOptions: Common.defaultNavigationOptions,
      screens: tabScreensConfig,
    },
    `TabStack_${tab}`
  )
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
const LoggedOut = createStaticStackComponent(
  {
    initialRouteName: 'login',
    screenOptions: loggedOutOptions,
    screens: loggedOutScreensConfig,
  },
  'LoggedOut'
)

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

const useIsLoading = () => {
  const everLoadedRef = React.useRef(false)
  return !useDaemonState(s => {
    const loaded = everLoadedRef.current || s.handshakeState === 'done'
    everLoadedRef.current = loaded
    return loaded
  })
}

const useIsLoggedIn = () => {
  const everLoadedRef = React.useRef(false)
  const loggedInLoaded = useDaemonState(s => {
    const loaded = everLoadedRef.current || s.handshakeState === 'done'
    everLoadedRef.current = loaded
    return loaded
  })
  const loggedIn = useConfigState(s => s.loggedIn)
  return loggedInLoaded && loggedIn
}

const useIsLoggedOut = () => {
  const everLoadedRef = React.useRef(false)
  const loggedInLoaded = useDaemonState(s => {
    const loaded = everLoadedRef.current || s.handshakeState === 'done'
    everLoadedRef.current = loaded
    return loaded
  })
  const loggedIn = useConfigState(s => s.loggedIn)
  return loggedInLoaded && !loggedIn
}

const modalScreensConfig = routeMapToStaticScreens(modalRoutes, makeLayout, makeOptions, true, false)

const RootComponent = createStaticStackComponent(
  {
    groups: {
      loggedIn: {
        if: useIsLoggedIn,
        screens: {
          loggedIn: {screen: AppTabs},
          ...modalScreensConfig,
        },
      },
      loggedOut: {
        if: useIsLoggedOut,
        screens: {
          loggedOut: {screen: LoggedOut},
        },
      },
    },
    screenOptions: rootScreenOptions,
    screens: {
      loading: {
        if: useIsLoading,
        screen: Shared.SimpleLoading,
      },
    },
  },
  'Root'
)

function ElectronApp() {
  useConnectNavToState()

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
      <RootComponent />
    </NavigationContainer>
  )
}

export default ElectronApp
