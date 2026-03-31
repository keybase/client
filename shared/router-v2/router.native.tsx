/// <reference types="webpack-env" />
import * as C from '@/constants'
import * as Constants from '@/constants/router'
import {useConfigState} from '@/stores/config'
import {useDarkModeState} from '@/stores/darkmode'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Tabs from '@/constants/tabs'
import * as Common from './common.native'
import logger from '@/logger'
import {Platform, StatusBar, View} from 'react-native'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'
import {NavigationContainer, type NavigationProp} from '@react-navigation/native'
// NAV8: import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import {createNativeBottomTabNavigator} from '@react-navigation/bottom-tabs/unstable' // NAV7
import {modalRoutes, routes, loggedOutRoutes, tabRoots, routeMapToStaticScreens} from './routes'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {isLiquidGlassSupported as _isLiquidGlassSupported} from '@callstack/liquid-glass'
import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'
import type {SFSymbol} from 'sf-symbols-typescript'
import {makeLayout} from './screen-layout.native'
import {useRootKey} from './hooks.native'
import {createLinkingConfig} from './linking'
import {handleAppLink} from '@/constants/deeplinks'
import {useDaemonState} from '@/stores/daemon'
import {useNotifState} from '@/stores/notifications'
import {usePushState} from '@/stores/push'
import {colors, darkColors} from '@/styles/colors'

const isLiquidGlassSupported = _isLiquidGlassSupported as boolean

if (module.hot) {
  module.hot.accept('', () => {})
}

const tabToLabel = new Map<string, string>([
  [Tabs.chatTab, 'Chat'],
  [Tabs.fsTab, 'Files'],
  [Tabs.teamsTab, 'Teams'],
  [Tabs.peopleTab, 'People'],
  [Tabs.settingsTab, 'More'],
])

// just to get badge rollups
const tabs = C.isTablet ? Tabs.tabletTabs : Tabs.phoneTabs

// NAV8: const Tab = createBottomTabNavigator()
const Tab = createNativeBottomTabNavigator() // NAV7
const tabRoutes = routes
const settingsTabChildren = [Tabs.gitTab, Tabs.devicesTab, Tabs.settingsTab] as const

const tabStackOptions = ({
  navigation,
}: {
  navigation: {canGoBack: () => boolean}
}): NativeStackNavigationOptions => ({
  ...Common.defaultNavigationOptions,
  ...(Platform.OS === 'ios' ? {contentStyle: {backgroundColor: Kb.Styles.globalColors.transparent}} : {}),
  // Use the native back button (liquid glass pill on iOS 26) for non-root screens;
  // omit headerLeft entirely on root screens so no empty glass circle appears.
  headerBackVisible: navigation.canGoBack(),
  headerLeft: undefined,
})

// On phones, each tab stack only contains its root screen. All other routes live in
// the root stack (alongside chatConversation) so they render above the tab bar.
const tabRootNameSet = new Set<string>(Object.values(tabRoots).filter(Boolean))
const phoneRootRoutes = Object.fromEntries(
  Object.entries(tabRoutes).filter(([name]) => !tabRootNameSet.has(name))
) as typeof tabRoutes

const tabScreensConfig = routeMapToStaticScreens(tabRoutes, makeLayout, false, false, true)
const phoneRootScreensConfig = routeMapToStaticScreens(
  C.isTablet ? {} : phoneRootRoutes,
  makeLayout,
  false,
  false,
  false
)

const tabComponents: Record<string, React.ComponentType> = {}
for (const tab of tabs) {
  if (C.isTablet) {
    const nav = createNativeStackNavigator({
      initialRouteName: tabRoots[tab],
      screenOptions: tabStackOptions,
      screens: tabScreensConfig,
    })
    tabComponents[tab] = nav.getComponent()
  } else {
    const rootName = tabRoots[tab]
    const rootScreenConfig = routeMapToStaticScreens(
      {[rootName]: tabRoutes[rootName as keyof typeof tabRoutes]} as typeof tabRoutes,
      makeLayout,
      false,
      false,
      true
    )
    const nav = createNativeStackNavigator({
      initialRouteName: rootName,
      screenOptions: tabStackOptions,
      screens: rootScreenConfig,
    })
    tabComponents[tab] = nav.getComponent()
  }
}

const androidTabIcons = new Map<Tabs.Tab, number>([
  [Tabs.chatTab, require('../images/icons/icon-nav-chat-32.png')],
  [Tabs.fsTab, require('../images/icons/icon-nav-folders-32.png')],
  [Tabs.peopleTab, require('../images/icons/icon-nav-people-32.png')],
  [Tabs.settingsTab, require('../images/icons/icon-nav-settings-32.png')],
  [Tabs.teamsTab, require('../images/icons/icon-folder-team-32.png')],
])

const iosTabIcons = new Map<Tabs.Tab, {active: SFSymbol; inactive: SFSymbol}>([
  [Tabs.chatTab, {active: 'message.fill', inactive: 'message'}],
  [Tabs.fsTab, {active: 'folder.fill', inactive: 'folder'}],
  [Tabs.peopleTab, {active: 'person.crop.circle.fill', inactive: 'person.crop.circle'}],
  [Tabs.settingsTab, {active: 'ellipsis.circle.fill', inactive: 'ellipsis.circle'}],
  [Tabs.teamsTab, {active: 'person.3.fill', inactive: 'person.3'}],
])

const getNativeTabIcon = (tab: Tabs.Tab) => {
  if (Platform.OS === 'ios') {
    const icon = iosTabIcons.get(tab)
    return icon
      ? ({focused}: {focused: boolean}) => ({
          name: focused ? icon.active : icon.inactive,
          type: 'sfSymbol' as const,
        })
      : undefined
  }
  const source = androidTabIcons.get(tab)
  return source ? {source, type: 'image' as const} : undefined
}

const getBadgeNumber = (
  routeName: Tabs.Tab,
  navBadges: ReadonlyMap<Tabs.Tab, number>,
  hasPermissions: boolean
) => {
  const onSettings = routeName === Tabs.settingsTab
  const tabsToCount: ReadonlyArray<Tabs.Tab> = onSettings ? settingsTabChildren : [routeName]
  const count = tabsToCount.reduce(
    (res, tab) => res + (navBadges.get(tab) || 0),
    onSettings && !hasPermissions ? 1 : 0
  )
  return count || undefined
}

const appTabsScreenOptions = (
  routeName: Tabs.Tab,
  navBadges: ReadonlyMap<Tabs.Tab, number>,
  hasPermissions: boolean,
  isDarkMode: boolean
) => {
  return {
    headerShown: false,
    tabBarActiveIndicatorEnabled: false,
    tabBarBadge: getBadgeNumber(routeName, navBadges, hasPermissions),
    tabBarBadgeStyle: {
      backgroundColor: isLiquidGlassSupported ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.orange,
    },
    ...(C.isIOS
      ? isLiquidGlassSupported
        ? {
            tabBarBlurEffect: Common.tabBarBlurEffect,
          }
        : {
            tabBarActiveTintColor: Kb.Styles.globalColors.whiteOrWhite,
            tabBarInactiveTintColor: isDarkMode ? colors.black : colors.blueDarker,
            tabBarMinimizeBehavior: Common.tabBarMinimizeBehavior,
          }
      : {
          tabBarActiveTintColor: Kb.Styles.globalColors.white,
          tabBarInactiveTintColor: Kb.Styles.globalColors.blueLighter,
        }),
    tabBarIcon: getNativeTabIcon(routeName),
    tabBarLabel: tabToLabel.get(routeName) ?? routeName,
    tabBarLabelVisibilityMode: C.isTablet ? ('labeled' as const) : ('unlabeled' as const),
    tabBarMinimizeBehavior: 'never' as const, // until this actually works on all screens, not sure why it only
    tabBarStyle: {backgroundColor: isDarkMode ? colors.greyDarkest : colors.blueDark},
    // works on chat inbox now
    title: tabToLabel.get(routeName) ?? routeName,
  }
}
function AppTabs() {
  const navBadges = useNotifState(s => s.navBadges)
  const hasPermissions = usePushState(s => s.hasPermissions)
  const isDarkMode = useDarkModeState(s => s.isDarkMode())

  return (
    <Tab.Navigator backBehavior="none">
      {tabs.map(tab => (
        <Tab.Screen
          key={tab}
          name={tab}
          component={tabComponents[tab]!}
          options={appTabsScreenOptions(tab, navBadges, hasPermissions, isDarkMode)}
        />
      ))}
    </Tab.Navigator>
  )
}

const loggedOutScreenOptions = {
  ...Common.defaultNavigationOptions,
} as const
const loggedOutScreensConfig = routeMapToStaticScreens(loggedOutRoutes, makeLayout, false, true, false)
const loggedOutNav = createNativeStackNavigator({
  initialRouteName: 'login',
  screenOptions: loggedOutScreenOptions as NativeStackNavigationOptions,
  screens: loggedOutScreensConfig,
})
const LoggedOut = loggedOutNav.getComponent()

const rootStackScreenOptions = {headerBackButtonDisplayMode: 'minimal'} satisfies NativeStackNavigationOptions
const modalScreenOptions = ({
  navigation,
}: {
  navigation: NavigationProp<ReactNavigation.RootParamList>
}): NativeStackNavigationOptions => {
  const cancelItem: NativeStackNavigationOptions =
    Platform.OS === 'ios'
      ? {
          unstable_headerLeftItems: () => [
            {label: 'Cancel', onPress: () => navigation.goBack(), type: 'button' as const},
          ],
        }
      : {headerLeft: () => <HeaderLeftButton mode="cancel" />}
  return {
    ...cancelItem,
    headerShown: true,
    presentation: 'modal',
    title: '',
  }
}

const useIsLoggedIn = () => useConfigState(s => s.loggedIn)
const useIsLoggedOut = () => !useConfigState(s => s.loggedIn)

const modalScreensConfig = routeMapToStaticScreens(modalRoutes, makeLayout, true, false, false)

const rootNav = createNativeStackNavigator({
  groups: {
    loggedIn: {
      if: useIsLoggedIn,
      screens: {
        loggedIn: {options: {headerShown: false}, screen: AppTabs},
        ...phoneRootScreensConfig,
      },
    },
    loggedOut: {
      if: useIsLoggedOut,
      screens: {
        loggedOut: {options: {headerShown: false}, screen: LoggedOut},
      },
    },
    modals: {
      if: useIsLoggedIn,
      screenOptions: modalScreenOptions as NativeStackNavigationOptions,
      screens: modalScreensConfig,
    },
  },
  screenOptions: rootStackScreenOptions,
})
const RootComponent = rootNav.getComponent()

// Create once, stable across renders. handleAppLink is used as fallback for
// URL patterns not yet handled by the linking config.
const linkingConfig = createLinkingConfig(handleAppLink)

function RNApp() {
  const everLoadedRef = React.useRef(false)
  const loggedInLoaded = useDaemonState(s => {
    const loaded = everLoadedRef.current || s.handshakeState === 'done'
    everLoadedRef.current = loaded
    return loaded
  })

  const {loggedIn, startupLoaded} = useConfigState(
    C.useShallow(s => ({loggedIn: s.loggedIn, startupLoaded: s.startup.loaded}))
  )
  const setNavState = C.useRouterState(s => s.dispatch.setNavState)
  const onStateChange = () => {
    const ns = C.Router2.getRootState()
    setNavState(ns)
  }
  // Sync the initial state from the linking config into the router store.
  // onStateChange doesn't fire for the initial state, so this ensures
  // onRouteChanged runs and conversation data gets loaded on startup.
  const onReady = onStateChange

  const onUnhandledAction = (a: Readonly<{type: string}>) => {
    logger.info(`[NAV] Unhandled action: ${a.type}`, a, C.Router2.logState())
  }

  const navRef = (ref: typeof Constants.navigationRef.current) => {
    if (ref) {
      Constants.navigationRef.current = ref
    }
  }

  const {barStyle, isDarkMode} = useDarkModeState(
    C.useShallow(s => {
      const isDarkMode = s.isDarkMode()
      const barStyle =
        s.darkModePreference === 'system'
          ? ('default' as const)
          : isDarkMode
            ? ('light-content' as const)
            : ('dark-content' as const)
      return {barStyle, isDarkMode}
    })
  )
  const bar = barStyle === 'default' ? null : <StatusBar barStyle={barStyle} />
  const rootKey = useRootKey()

  if (!loggedInLoaded || (loggedIn && !startupLoaded)) {
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
        linking={loggedIn ? linkingConfig : undefined}
        onReady={onReady}
        onStateChange={onStateChange}
        onUnhandledAction={onUnhandledAction}
        ref={navRef}
        theme={isDarkMode ? Shared.darkTheme : Shared.lightTheme}
      >
        <RootComponent />
      </NavigationContainer>
    </Kb.Box2>
  )
}

export default RNApp
