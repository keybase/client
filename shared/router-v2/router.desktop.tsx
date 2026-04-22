import * as Common from './common.desktop'
import * as C from '@/constants'
import {useConfigState} from '@/stores/config'
import {useDarkModeState} from '@/stores/darkmode'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Tabs from '@/constants/tabs'
import logger from '@/logger'
import Header from './header/index.desktop'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'
import {NavigationContainer} from '@react-navigation/native'
import {createLeftTabNavigator} from './left-tab-navigator.desktop'
import {createLinkingConfig} from './linking'
import {handleAppLink} from '@/constants/deeplinks'
import {modalRoutes, routes, loggedOutRoutes, tabRoots, routeMapToStaticScreens} from './routes'
import {registerDebugClear} from '@/util/debug'
import {useDaemonState} from '@/stores/daemon'
import {useCurrentUserState} from '@/stores/current-user'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {LoadedTeamsListProvider} from '@/teams/use-teams-list'

import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'
import {makeLayout} from './screen-layout.desktop'
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

const tabScreensConfig = routeMapToStaticScreens(routes, makeLayout, false, false, true)

const tabComponents: Record<string, React.ComponentType> = {}
for (const tab of Tabs.desktopTabs) {
  const nav = createNativeStackNavigator({
    initialRouteName: tabRoots[tab],
    screenOptions: Common.defaultNavigationOptions as NativeStackNavigationOptions,
    screens: tabScreensConfig,
  })
  tabComponents[tab] = nav.getComponent()
}

function AppTabsInner() {
  return (
    <LoadedTeamsListProvider>
      <Tab.Navigator backBehavior="none" screenOptions={appTabsInnerOptions}>
        {Tabs.desktopTabs.map(tab => (
          <Tab.Screen key={tab} name={tab} component={tabComponents[tab]!} />
        ))}
      </Tab.Navigator>
    </LoadedTeamsListProvider>
  )
}

const AppTabs = () => <AppTabsInner />

const loggedOutScreensConfig = routeMapToStaticScreens(loggedOutRoutes, makeLayout, false, true, false)
const loggedOutOptions = {
  header: p => {
    const options: React.ComponentProps<typeof Header>['options'] = {
      ...(p.options as React.ComponentProps<typeof Header>['options']),
      headerBottomStyle: {height: 0},
      headerShadowVisible: false,
    }
    return <Header {...p} options={options} />
  },
} satisfies NativeStackNavigationOptions
const loggedOutNav = createNativeStackNavigator({
  initialRouteName: 'login',
  screenOptions: loggedOutOptions,
  screens: loggedOutScreensConfig,
})
const LoggedOut = loggedOutNav.getComponent()

const documentTitle = {
  formatter: () => {
    const t = C.Router2.getTab()
    const m = t ? C.Tabs.desktopTabMeta[t] : undefined
    const tabLabel: string = m?.label ?? ''
    return `Keybase: ${tabLabel}`
  },
}

const rootScreenOptions = {
  headerLeft: () => <HeaderLeftButton mode="cancel" />,
  headerShown: false, // eventually do this after we pull apart modal2 etc
  presentation: 'transparentModal' as const,
  title: '',
} satisfies NativeStackNavigationOptions

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
          window.KBINBOX = require('@/stores/chat')
          window.KBCONVOSTATE = require('@/stores/convostate')
          registerDebugClear(() => {
            window.DEBUGNavigator = undefined
            window.DEBUGRouter2 = undefined
            window.KBCONSTANTS = undefined
            window.KBINBOX = undefined
            window.KBCONVOSTATE = undefined
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

const modalScreensConfig = routeMapToStaticScreens(modalRoutes, makeLayout, true, false, false)

const rootNav = createNativeStackNavigator({
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
})
const RootComponent = rootNav.getComponent()

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

  const isDarkMode = useDarkModeState(s => s.isDarkMode())
  const username = useCurrentUserState(s => s.username)
  // Only remount the navigator when switching between logged-in users.
  // Ignore '' → username (initial login) so in-flight unbox requests aren't interrupted.
  const [navKey, setNavKey] = React.useState('')
  const prevUsernameRef = React.useRef(username)
  React.useEffect(() => {
    const prev = prevUsernameRef.current
    prevUsernameRef.current = username
    if (prev && username && prev !== username) {
      setNavKey(username)
    }
  }, [username])

  return (
    <NavigationContainer
      key={navKey}
      documentTitle={documentTitle}
      onStateChange={onStateChange}
      onUnhandledAction={onUnhandledAction}
      ref={navRef}
      theme={isDarkMode ? Shared.darkTheme : Shared.lightTheme}
    >
      <RootComponent />
    </NavigationContainer>
  )
}

export default ElectronApp
