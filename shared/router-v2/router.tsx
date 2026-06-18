/// <reference types="webpack-env" />
import * as C from '@/constants'
import * as Common from './common'
import {useConfigState} from '@/stores/config'
import {useDarkModeState} from '@/stores/darkmode'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Tabs from '@/constants/tabs'
import logger from '@/logger'
import {Splash} from '../login/loading'
import type {Theme} from '@react-navigation/native'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'
import {NavigationContainer} from '@react-navigation/native'
import {createLinkingConfig} from './linking'
import {handleAppLink} from '@/constants/deeplinks'
import {modalRoutes, routes, loggedOutRoutes, tabRoots, routeMapToStaticScreens} from './routes'
import {useDaemonState} from '@/stores/daemon'
import {LoadedTeamsListProvider} from '@/teams/use-teams-list'
import {makeLayout} from './screen-layout'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'
import type {SFSymbol} from 'sf-symbols-typescript'
import type {NavigationProp} from '@react-navigation/native'
import type {RootParamList} from './route-params'
import {useCurrentUserState} from '@/stores/current-user'
import * as Constants from '@/constants/router'
import {useNotifState} from '@/stores/notifications'
import {usePushState} from '@/stores/push'
import {colors, darkColors} from '@/styles/colors'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import {isLiquidGlassSupported as _isLiquidGlassSupported} from '@callstack/liquid-glass'
import {Platform, StatusBar, View, useColorScheme} from 'react-native'
const isLiquidGlassSupported = isMobile ? (_isLiquidGlassSupported as boolean) : false
// `bubble`/`bubble.fill` SF Symbols only exist on iOS 17+; older sims render blank.
const isIOS17Plus = isIOS && parseInt(Platform.Version as string, 10) >= 17

// Tell the router constants which root-stack routes are modals (vs genuinely-visible
// pushed screens like chatConversation). modalRoutes is the single source of truth.
Constants.setModalRouteNames(Object.keys(modalRoutes))

function SimpleLoading() {
  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={{backgroundColor: Kb.Styles.globalColors.white}}
    >
      <Splash allowFeedback={false} failed="" status="" />
    </Kb.Box2>
  )
}

const darkTheme: Theme = {
  colors: {
    background: darkColors.white,
    border: darkColors.black_10,
    card: darkColors.white,
    notification: darkColors.black,
    primary: darkColors.black,
    text: darkColors.black,
  },
  dark: true,
  fonts: {
    bold: Kb.Styles.globalStyles.fontBold,
    heavy: Kb.Styles.globalStyles.fontExtrabold,
    medium: Kb.Styles.globalStyles.fontSemibold,
    regular: Kb.Styles.globalStyles.fontRegular,
  },
}
const lightTheme: Theme = {
  colors: {
    background: colors.white,
    border: colors.black_10,
    card: colors.white,
    notification: colors.black,
    primary: colors.black,
    text: colors.black,
  },
  dark: false,
  fonts: {
    bold: Kb.Styles.globalStyles.fontBold,
    heavy: Kb.Styles.globalStyles.fontExtrabold,
    medium: Kb.Styles.globalStyles.fontSemibold,
    regular: Kb.Styles.globalStyles.fontRegular,
  },
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

if (!isMobile) {
  // Set up the fallback handler for emitDeepLink on desktop (no linking prop needed on Electron)
  createLinkingConfig(handleAppLink)
}

// Inline structural type for the left-tab navigator (avoids importing from .desktop.tsx)
type LeftTabNavigatorType = {
  Navigator: React.ComponentType<{
    backBehavior?: string
    screenOptions?: object
    children?: React.ReactNode
  }>
  Screen: React.ComponentType<{
    name: string
    component: React.ComponentType
    key?: string
  }>
}

let desktopTab: LeftTabNavigatorType | undefined
const desktopTabComponents: Record<string, React.ComponentType> = {}
let DesktopRootComponent: React.ComponentType
let LoggedOutDesktop: React.ComponentType

if (!isMobile) {
  const {createLeftTabNavigator} = require('./left-tab-navigator.desktop') as {
    createLeftTabNavigator: () => LeftTabNavigatorType
  }
  desktopTab = createLeftTabNavigator()

  const desktopTabScreensConfig = routeMapToStaticScreens(routes, makeLayout, false, false, true)

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

  for (const tab of Tabs.desktopTabs) {
    const nav = createNativeStackNavigator({
      initialRouteName: tabRoots[tab],
      screenOptions: Common.defaultNavigationOptions as NativeStackNavigationOptions,
      screens: desktopTabScreensConfig,
    })
    desktopTabComponents[tab] = nav.getComponent()
  }

  // Keep appTabsInnerOptions stable (defined above before the loop)
  const capturedOptions = appTabsInnerOptions
  const capturedTab = desktopTab

  function AppTabsInnerDesktop() {
    return (
      <capturedTab.Navigator backBehavior="none" screenOptions={capturedOptions}>
        {Tabs.desktopTabs.map(tab => (
          <capturedTab.Screen key={tab} name={tab} component={desktopTabComponents[tab]!} />
        ))}
      </capturedTab.Navigator>
    )
  }
  const AppTabsDesktop = () => <AppTabsInnerDesktop />

  type DesktopHeaderProps = Record<string, unknown> & {options: Record<string, unknown>}
  const DesktopHeaderComponent = (
    require('./header/index.desktop') as {default: React.ComponentType<DesktopHeaderProps>}
  ).default

  const desktopLoggedOutScreensConfig = routeMapToStaticScreens(loggedOutRoutes, makeLayout, false, true, false)
  const desktopLoggedOutOptions = {
    header: (p: Record<string, unknown>) => {
      const options = {
        ...((p['options'] as Record<string, unknown> | undefined) ?? {}),
        headerBottomStyle: {height: 0},
        headerShadowVisible: false,
      }
      return <DesktopHeaderComponent {...p} options={options} />
    },
  } satisfies NativeStackNavigationOptions

  const loggedOutNav = createNativeStackNavigator({
    initialRouteName: 'login',
    screenOptions: desktopLoggedOutOptions,
    screens: desktopLoggedOutScreensConfig,
  })
  LoggedOutDesktop = loggedOutNav.getComponent()

  const desktopRootScreenOptions = {
    headerLeft: () => <HeaderLeftButton mode="cancel" />,
    headerShown: false, // eventually do this after we pull apart modal2 etc
    presentation: 'transparentModal' as const,
    title: '',
  } satisfies NativeStackNavigationOptions

  const useIsLoadingDesktop = () => {
    const everLoadedRef = React.useRef(false)
    return !useDaemonState(s => {
      const loaded = everLoadedRef.current || s.handshakeState === 'done'
      everLoadedRef.current = loaded
      return loaded
    })
  }

  const useIsLoggedInDesktop = () => {
    const everLoadedRef = React.useRef(false)
    const loggedInLoaded = useDaemonState(s => {
      const loaded = everLoadedRef.current || s.handshakeState === 'done'
      everLoadedRef.current = loaded
      return loaded
    })
    const loggedIn = useConfigState(s => s.loggedIn)
    return loggedInLoaded && loggedIn
  }

  const useIsLoggedOutDesktop = () => {
    const everLoadedRef = React.useRef(false)
    const loggedInLoaded = useDaemonState(s => {
      const loaded = everLoadedRef.current || s.handshakeState === 'done'
      everLoadedRef.current = loaded
      return loaded
    })
    const loggedIn = useConfigState(s => s.loggedIn)
    return loggedInLoaded && !loggedIn
  }

  const desktopModalScreensConfig = routeMapToStaticScreens(modalRoutes, makeLayout, true, false, false)

  const desktopRootNav = createNativeStackNavigator({
    groups: {
      loggedIn: {
        if: useIsLoggedInDesktop,
        screens: {
          loggedIn: {screen: AppTabsDesktop},
          ...desktopModalScreensConfig,
        },
      },
      loggedOut: {
        if: useIsLoggedOutDesktop,
        screens: {
          loggedOut: {screen: LoggedOutDesktop},
        },
      },
    },
    screenOptions: desktopRootScreenOptions,
    screens: {
      loading: {
        if: useIsLoadingDesktop,
        screen: SimpleLoading,
      },
    },
  })
  DesktopRootComponent = desktopRootNav.getComponent()
}

const useConnectNavToState = () => {
  const setNavOnce = React.useRef(false)
  React.useEffect(() => {
    if (!setNavOnce.current) {
      if (C.Router2.navigationRef.isReady()) {
        setNavOnce.current = true

        if (__DEV__) {
          const w = window as unknown as Record<string, unknown> | undefined
          if (w) {
            w['DEBUGNavigator'] = C.Router2.navigationRef.current
            w['DEBUGRouter2'] = C.Router2
            w['KBCONSTANTS'] = require('@/constants')
            w['KBINBOX'] = require('@/constants/chat')
            const {registerDebugClear} = require('@/util/debug') as {registerDebugClear: (cb: () => void) => void}
            registerDebugClear(() => {
              w['DEBUGNavigator'] = undefined
              w['DEBUGRouter2'] = undefined
              w['KBCONSTANTS'] = undefined
              w['KBINBOX'] = undefined
            })
          }
        }
      }
    }
  }, [setNavOnce])
}

function DesktopRouter() {
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

  const documentTitle = {
    formatter: () => {
      const t = C.Router2.getTab()
      const m = t ? C.Tabs.desktopTabMeta[t] : undefined
      const tabLabel: string = m?.label ?? ''
      return `Keybase: ${tabLabel}`
    },
  }

  return (
    <NavigationContainer
      key={navKey}
      documentTitle={documentTitle}
      onStateChange={onStateChange}
      onUnhandledAction={onUnhandledAction}
      ref={navRef}
      theme={isDarkMode ? darkTheme : lightTheme}
    >
      <LoadedTeamsListProvider>
        <DesktopRootComponent />
      </LoadedTeamsListProvider>
    </NavigationContainer>
  )
}

// ─── Native ───────────────────────────────────────────────────────────────────

if (isMobile) {
  if (module.hot) {
    module.hot.accept('', () => {})
  }
}

const tabToLabel = new Map<string, string>([
  [Tabs.chatTab, 'Chat'],
  [Tabs.fsTab, 'Files'],
  [Tabs.teamsTab, 'Teams'],
  [Tabs.peopleTab, 'People'],
  [Tabs.settingsTab, 'More'],
])

const tabToTestID = new Map<string, string>([
  [Tabs.chatTab, TestIDs.NAV_TAB_CHAT],
  [Tabs.fsTab, TestIDs.NAV_TAB_FILES],
  [Tabs.teamsTab, TestIDs.NAV_TAB_TEAMS],
  [Tabs.peopleTab, TestIDs.NAV_TAB_PEOPLE],
  [Tabs.settingsTab, TestIDs.NAV_TAB_SETTINGS],
])

// just to get badge rollups
const nativeTabs = C.isTablet ? Tabs.tabletTabs : Tabs.phoneTabs
const settingsTabChildren = [Tabs.gitTab, Tabs.devicesTab, Tabs.settingsTab] as const

const tabStackOptions = ({
  navigation,
}: {
  navigation: {canGoBack: () => boolean}
}): NativeStackNavigationOptions => ({
  ...Common.defaultNavigationOptions,
  // Use the native back button (liquid glass pill on iOS 26) for non-root screens;
  // omit headerLeft entirely on root screens so no empty glass circle appears.
  headerBackVisible: navigation.canGoBack(),
  headerLeft: undefined,
})

// On phones, each tab stack only contains its root screen. All other routes live in
// the root stack (alongside chatConversation) so they render above the tab bar.
const tabRootNameSet = new Set<string>(Object.values(tabRoots).filter(Boolean))
const phoneRootRoutes = Object.fromEntries(
  Object.entries(routes).filter(([name]) => !tabRootNameSet.has(name))
) as typeof routes

const nativeTabComponents: Record<string, React.ComponentType> = {}

if (isMobile) {
  const nativeTabScreensConfig = routeMapToStaticScreens(routes, makeLayout, false, false, true)

  for (const tab of nativeTabs) {
    if (C.isTablet) {
      const nav = createNativeStackNavigator({
        initialRouteName: tabRoots[tab],
        screenOptions: tabStackOptions,
        screens: nativeTabScreensConfig,
      })
      nativeTabComponents[tab] = nav.getComponent()
    } else {
      const rootName = tabRoots[tab]
      const rootScreenConfig = routeMapToStaticScreens(
        {[rootName]: routes[rootName as keyof typeof routes]} as typeof routes,
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
      nativeTabComponents[tab] = nav.getComponent()
    }
  }
}

const androidTabIcons = new Map<Tabs.Tab, number>(
  isMobile
    ? [
        [Tabs.chatTab, require('../images/icons/icon-nav-chat-32.png')],
        [Tabs.fsTab, require('../images/icons/icon-nav-folders-32.png')],
        [Tabs.peopleTab, require('../images/icons/icon-nav-people-32.png')],
        [Tabs.settingsTab, require('../images/icons/icon-nav-settings-32.png')],
        [Tabs.teamsTab, require('../images/icons/icon-nav-teams-32.png')],
      ]
    : []
)

const iosTabIcons = new Map<Tabs.Tab, {active: SFSymbol; inactive: SFSymbol}>(
  isMobile
    ? [
        [
          Tabs.chatTab,
          isIOS17Plus
            ? {active: 'bubble.fill', inactive: 'bubble'}
            : {active: 'message.fill', inactive: 'message'},
        ],
        [Tabs.fsTab, {active: 'folder.fill', inactive: 'folder'}],
        [Tabs.peopleTab, {active: 'person.crop.rectangle.fill', inactive: 'person.crop.rectangle'}],
        [Tabs.settingsTab, {active: 'line.3.horizontal.circle.fill', inactive: 'line.3.horizontal'}],
        [Tabs.teamsTab, {active: 'person.2.fill', inactive: 'person.2'}],
      ]
    : []
)

const getNativeTabIcon = (tab: Tabs.Tab) => {
  if (isIOS) {
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
    overrideScrollViewContentInsetAdjustmentBehavior: true,
    tabBarBadge: getBadgeNumber(routeName, navBadges, hasPermissions),
    tabBarBadgeStyle: {
      backgroundColor: isLiquidGlassSupported ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.orange,
    },
    ...(isIOS
      ? {
          tabBarActiveIndicatorEnabled: false,
          tabBarMinimizeBehavior: Common.tabBarMinimizeBehavior,
          ...(isLiquidGlassSupported
            ? {
                tabBarBlurEffect: Common.tabBarBlurEffect,
              }
            : {
                tabBarActiveTintColor: Kb.Styles.globalColors.whiteOrWhite,
                tabBarInactiveTintColor: isDarkMode ? colors.black : colors.blueDarker,
              }),
        }
      : {
          tabBarActiveIndicatorColor: 'rgba(255,255,255,0.15)',
          tabBarActiveIndicatorEnabled: true,
          tabBarActiveTintColor: Kb.Styles.globalColors.white,
          tabBarInactiveTintColor: Kb.Styles.globalColors.blueLighter,
        }),
    tabBarIcon: getNativeTabIcon(routeName),
    tabBarLabel: tabToLabel.get(routeName) ?? routeName,
    tabBarTestID: tabToTestID.get(routeName),
    tabBarLabelVisibilityMode: 'labeled' as const,
    tabBarStyle: {backgroundColor: isDarkMode ? colors.greyDarkest : colors.blueDark},
    title: tabToLabel.get(routeName) ?? routeName,
  }
}

function AppTabsNative() {
  const Tab = React.useMemo(() => createBottomTabNavigator(), [])
  const navBadges = useNotifState(s => s.navBadges)
  const hasPermissions = usePushState(s => s.hasPermissions)
  const isDarkMode = useDarkModeState(s => s.isDarkMode())

  return (
    <Tab.Navigator backBehavior="none">
      {nativeTabs.map(tab => (
        <Tab.Screen
          key={tab}
          name={tab}
          component={nativeTabComponents[tab]!}
          options={appTabsScreenOptions(tab, navBadges, hasPermissions, isDarkMode)}
        />
      ))}
    </Tab.Navigator>
  )
}

let NativeLoggedOut: React.ComponentType
let NativeRootComponent: React.ComponentType

if (isMobile) {
  const nativeLoggedOutScreensConfig = routeMapToStaticScreens(loggedOutRoutes, makeLayout, false, true, false)
  const nativeLoggedOutScreenOptions = {
    ...Common.defaultNavigationOptions,
  } as NativeStackNavigationOptions

  const loggedOutNav = createNativeStackNavigator({
    initialRouteName: 'login',
    screenOptions: nativeLoggedOutScreenOptions,
    screens: nativeLoggedOutScreensConfig,
  })
  NativeLoggedOut = loggedOutNav.getComponent()

  const rootStackScreenOptions = {
    headerBackButtonDisplayMode: 'minimal',
    headerTitleAlign: isAndroid ? 'center' : undefined,
    // Lock to portrait by default. Only full-screen attachment views (chat/files)
    // opt back into rotation via orientation: 'all'.
    orientation: 'portrait',
  } satisfies NativeStackNavigationOptions

  const modalScreenOptions = ({
    navigation,
  }: {
    navigation: NavigationProp<RootParamList>
  }): NativeStackNavigationOptions => {
    const cancelItem: NativeStackNavigationOptions =
      isIOS
        ? {
            unstable_headerLeftItems: () => [
              {label: 'Cancel', onPress: () => navigation.goBack(), type: 'button' as const},
            ],
          }
        : {headerBackVisible: false, headerLeft: () => <HeaderLeftButton mode="cancel" />}
    return {
      ...cancelItem,
      headerShown: true,
      presentation: 'modal',
      title: '',
    }
  }

  const useIsLoggedInNative = () => useConfigState(s => s.loggedIn)
  const useIsLoggedOutNative = () => !useConfigState(s => s.loggedIn)

  const nativeModalScreensConfig = routeMapToStaticScreens(modalRoutes, makeLayout, true, false, false)
  const nativePhoneRootScreensConfig = routeMapToStaticScreens(
    C.isTablet ? {} : phoneRootRoutes,
    makeLayout,
    false,
    false,
    false
  )

  const nativeRootNav = createNativeStackNavigator({
    groups: {
      loggedIn: {
        if: useIsLoggedInNative,
        screens: {
          loggedIn: {options: {headerShown: false}, screen: AppTabsNative},
          ...nativePhoneRootScreensConfig,
        },
      },
      loggedOut: {
        if: useIsLoggedOutNative,
        screens: {
          loggedOut: {options: {headerShown: false}, screen: NativeLoggedOut},
        },
      },
      modals: {
        if: useIsLoggedInNative,
        screenOptions: modalScreenOptions as NativeStackNavigationOptions,
        screens: nativeModalScreensConfig,
      },
    },
    screenOptions: rootStackScreenOptions,
  })
  NativeRootComponent = nativeRootNav.getComponent()
}

// Create once, stable across renders. handleAppLink is used as fallback for
// URL patterns not yet handled by the linking config.
const nativeLinkingConfig = isMobile ? createLinkingConfig(handleAppLink) : undefined

function NativeRouter() {
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
  // Inline useRootKey (from hooks.native.tsx — can't require *.native files from shared code)
  const nativeIsDarkMode = useColorScheme() === 'dark'
  const nativeUsername = useCurrentUserState(s => s.username)
  const [nativeNavKey, setNativeNavKey] = React.useState('')
  const nativePrevUsernameRef = React.useRef(nativeUsername)
  React.useEffect(() => {
    const prev = nativePrevUsernameRef.current
    nativePrevUsernameRef.current = nativeUsername
    if (prev && nativeUsername && prev !== nativeUsername) {
      setNativeNavKey(nativeUsername)
    }
  }, [nativeUsername])
  const nativeDarkSuffix = isAndroid ? (nativeIsDarkMode ? '-dark' : '-light') : ''
  const rootKey = nativeNavKey ? `${nativeNavKey}${nativeDarkSuffix}` : ''

  if (!loggedInLoaded || (loggedIn && !startupLoaded)) {
    return (
      <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.fillAbsolute}>
        <SimpleLoading />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" pointerEvents="box-none" fullWidth={true} fullHeight={true} key={rootKey}>
      {bar}
      <NavigationContainer<RootParamList>
        fallback={<View style={{backgroundColor: Kb.Styles.globalColors.white, flex: 1}} />}
        linking={loggedIn ? nativeLinkingConfig : undefined}
        onReady={onReady}
        onStateChange={onStateChange}
        onUnhandledAction={onUnhandledAction}
        ref={navRef}
        theme={isDarkMode ? darkTheme : lightTheme}
      >
        <LoadedTeamsListProvider>
          <NativeRootComponent />
        </LoadedTeamsListProvider>
      </NavigationContainer>
    </Kb.Box2>
  )
}

export default isMobile ? NativeRouter : DesktopRouter
