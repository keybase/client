import * as C from '@/constants'
import * as Constants from '@/stores/router2'
import {useConfigState} from '@/stores/config'
import {useDarkModeState} from '@/stores/darkmode'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Tabs from '@/constants/tabs'
import * as Common from './common.native'
import {makeNavScreens} from './shim'
import logger from '@/logger'
import {StatusBar, View} from 'react-native'
import {PlatformPressable} from '@react-navigation/elements'
import {HeaderLeftCancel2} from '@/common-adapters/header-hoc'
import {NavigationContainer, getFocusedRouteNameFromRoute} from '@react-navigation/native'
import {createBottomTabNavigator, type BottomTabBarButtonProps} from '@react-navigation/bottom-tabs'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import * as Hooks from './hooks.native'
import * as TabBar from './tab-bar.native'
import type {RootParamList} from '@/router-v2/route-params'
import {useColorScheme} from 'react-native'
import {useDaemonState} from '@/stores/daemon'

if (module.hot) {
  module.hot.accept('', () => {})
}

// just to get badge rollups
const tabs = C.isTablet ? Tabs.tabletTabs : Tabs.phoneTabs

const Tab = createBottomTabNavigator()
const tabRoutes = routes

const TabStackNavigator = createNativeStackNavigator<RootParamList>()
const tabStackOptions = {
  ...Common.defaultNavigationOptions,
  animation: 'simple_push',
  animationDuration: 250,
  orientation: 'portrait',
} as const

const tabScreens = makeNavScreens(tabRoutes, TabStackNavigator.Screen, false, false)
const TabStack = React.memo(function TabStack(p: {route: {name: Tabs.Tab}}) {
  return (
    <TabStackNavigator.Navigator
      initialRouteName={tabRoots[p.route.name] || undefined}
      screenOptions={tabStackOptions}
    >
      {tabScreens}
    </TabStackNavigator.Navigator>
  )
})

// so we have a stack per tab
const tabScreenOptions = ({route}: {route: {name: string}}) => {
  let routeName: string | undefined
  try {
    routeName = getFocusedRouteNameFromRoute(route)
  } catch {}
  return {
    tabBarStyle: routeName === 'chatConversation' ? Common.tabBarStyleHidden : Common.tabBarStyle,
  }
}
const tabStacks = tabs.map(tab => (
  <Tab.Screen
    key={tab}
    name={tab}
    listeners={{
      tabLongPress: () => {
        C.useRouterState.getState().dispatch.defer.tabLongPress?.(tab)
      },
    }}
    component={TabStack}
    options={tabScreenOptions}
  />
))

const android_rippleFix = {color: 'transparent'}
const appTabsScreenOptions = ({route}: {route: {name: string}}) => {
  return {
    ...Common.defaultNavigationOptions,
    headerShown: false,
    tabBarActiveBackgroundColor: Kb.Styles.globalColors.transparent,
    tabBarButton: (p: BottomTabBarButtonProps) => (
      <PlatformPressable {...p} android_ripple={android_rippleFix}>
        {p.children}
      </PlatformPressable>
    ),
    tabBarHideOnKeyboard: true,
    tabBarIcon: ({focused}: {focused: boolean}) => (
      <TabBar.TabBarIconWrapper routeName={route.name as Tabs.Tab} focused={focused} />
    ),
    tabBarInactiveBackgroundColor: Kb.Styles.globalColors.transparent,
    tabBarLabel: ({focused}: {focused: boolean}) => (
      <TabBar.TabBarLabelWrapper routeName={route.name as Tabs.Tab} focused={focused} />
    ),
    tabBarShowLabel: Kb.Styles.isTablet,
    tabBarStyle: Common.tabBarStyle,
  }
}
const AppTabs = React.memo(
  function AppTabsImpl() {
    return (
      <Tab.Navigator backBehavior="none" screenOptions={appTabsScreenOptions}>
        {tabStacks}
      </Tab.Navigator>
    )
  },
  // ignore all props from the nav layer which we don't control or use
  () => true
)

const LoggedOutStack = createNativeStackNavigator<RootParamList>()
const LoggedOutScreens = makeNavScreens(loggedOutRoutes, LoggedOutStack.Screen, false, true)
const loggedOutScreenOptions = {
  ...Common.defaultNavigationOptions,
  headerShown: false,
}
const LoggedOut = React.memo(function LoggedOut() {
  return (
    // TODO show header and use nav headers
    <LoggedOutStack.Navigator initialRouteName="login" screenOptions={loggedOutScreenOptions}>
      {LoggedOutScreens}
    </LoggedOutStack.Navigator>
  )
})

const RootStack = createNativeStackNavigator<
  RootParamList & {loggedIn: undefined; loggedOut: undefined; loading: undefined}
>()
const rootStackScreenOptions = {
  headerShown: false, // eventually do this after we pull apart modal2 etc
}
const modalScreens = makeNavScreens(modalRoutes, RootStack.Screen, true, false)
const modalScreenOptions = {
  headerLeft: () => <HeaderLeftCancel2 />,
  presentation: 'modal',
} as const
const RNApp = React.memo(function RNApp() {
  const everLoadedRef = React.useRef(false)
  const loggedInLoaded = useDaemonState(s => {
    const loaded = everLoadedRef.current || s.handshakeState === 'done'
    everLoadedRef.current = loaded
    return loaded
  })

  const {initialState, initialStateState} = Hooks.useInitialState(loggedInLoaded)
  const loggedIn = useConfigState(s => s.loggedIn)
  const setNavState = C.useRouterState(s => s.dispatch.setNavState)
  const onStateChange = React.useCallback(() => {
    const ns = C.Router2.getRootState()
    setNavState(ns)
  }, [setNavState])

  const onUnhandledAction = React.useCallback((a: Readonly<{type: string}>) => {
    logger.info(`[NAV] Unhandled action: ${a.type}`, a, C.Router2.logState())
  }, [])

  const navRef = React.useCallback((ref: typeof Constants.navigationRef.current) => {
    if (ref) {
      Constants.navigationRef.current = ref
    }
  }, [])

  const DEBUG_RNAPP_RENDER = __DEV__ && (false as boolean)
  if (DEBUG_RNAPP_RENDER) {
    console.log('DEBUG RNApp render', {
      initialState,
      initialStateState,
      loggedIn,
      loggedInLoaded,
      onStateChange,
    })
  }

  const isDarkMode = useColorScheme() === 'dark'
  const barStyle = useDarkModeState(s => {
    return s.darkModePreference === 'system' ? 'default' : isDarkMode ? 'light-content' : 'dark-content'
  })
  const bar = barStyle === 'default' ? null : <StatusBar barStyle={barStyle} />
  const rootKey = Hooks.useRootKey()

  if (initialStateState !== 'loaded' || !loggedInLoaded) {
    return (
      <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.fillAbsolute}>
        <Shared.SimpleLoading />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" pointerEvents="box-none" fullWidth={true} fullHeight={true} key={rootKey}>
      {bar}
      <NavigationContainer
        fallback={<View style={{backgroundColor: Kb.Styles.globalColors.white, flex: 1}} />}
        ref={navRef}
        theme={Shared.theme}
        // eslint-disable-next-line
        initialState={initialState as any}
        onUnhandledAction={onUnhandledAction}
        onStateChange={onStateChange}
      >
        <RootStack.Navigator key="root" screenOptions={rootStackScreenOptions}>
          {loggedIn ? (
            <>
              <RootStack.Screen name="loggedIn" component={AppTabs} />
              <RootStack.Group screenOptions={modalScreenOptions}>{modalScreens}</RootStack.Group>
            </>
          ) : (
            <RootStack.Screen name="loggedOut" component={LoggedOut} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </Kb.Box2>
  )
})

export default RNApp
