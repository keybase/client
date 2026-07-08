/// <reference types="webpack-env" />
import * as C from '@/constants'
import * as CChat from '@/constants/chat'
import {registerDebugClear} from '@/util/debug'
import {createLeftTabNavigator} from './left-tab-navigator'
import DesktopHeader from './header'
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
import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'
import type {SFSymbol} from 'sf-symbols-typescript'
import type {NavigationProp} from '@react-navigation/native'
import type {RootParamList} from './route-params'
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
C.Router2.setModalRouteNames(Object.keys(modalRoutes))

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

const makeTheme = (palette: {white: string; black: string; black_10: string}, dark: boolean): Theme => ({
  colors: {
    background: palette.white,
    border: palette.black_10,
    card: palette.white,
    notification: palette.black,
    primary: palette.black,
    text: palette.black,
  },
  dark,
  fonts: {
    bold: Kb.Styles.globalStyles.fontBold,
    heavy: Kb.Styles.globalStyles.fontExtrabold,
    medium: Kb.Styles.globalStyles.fontSemibold,
    regular: Kb.Styles.globalStyles.fontRegular,
  },
})
const darkTheme = makeTheme(darkColors, true)
const lightTheme = makeTheme(colors, false)

// Shared NavigationContainer plumbing (identical on both platforms)
const onUnhandledAction = (a: Readonly<{type: string}>) => {
  logger.info(`[NAV] Unhandled action: ${a.type}`, a, C.Router2.logState())
}
const onStateChange = () => {
  C.useRouterState.getState().dispatch.setNavState(C.Router2.getRootState())
}
const setNavRef = (ref: typeof C.Router2.navigationRef.current) => {
  if (ref) {
    C.Router2.navigationRef.current = ref
  }
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

if (!isMobile) {
  // Set up the fallback handler for emitDeepLink on desktop (no linking prop needed on Electron)
  createLinkingConfig(handleAppLink)
}

// Sticky: once the handshake finishes we never go back to the splash, even if it
// restarts later (engine reconnect); the disconnected overlay covers that case.
// Module-level so it survives the navigator remount on user switch (a ref would
// reset and flash the splash while the post-switch handshake is still running).
let handshakeEverDone = false
const useHandshakeEverDone = () => {
  return useDaemonState(s => {
    handshakeEverDone = handshakeEverDone || s.handshakeState === 'done'
    return handshakeEverDone
  })
}

let DesktopRootComponent: React.ComponentType

if (!isMobile) {
  const desktopTab = createLeftTabNavigator()
  const desktopTabComponents: Record<string, React.ComponentType> = {}

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

  function AppTabsDesktop() {
    return (
      <desktopTab.Navigator backBehavior="none" screenOptions={appTabsInnerOptions}>
        {Tabs.desktopTabs.map(tab => (
          <desktopTab.Screen key={tab} name={tab} component={desktopTabComponents[tab]!} />
        ))}
      </desktopTab.Navigator>
    )
  }

  type DesktopHeaderProps = Record<string, unknown> & {options: Record<string, unknown>}
  const DesktopHeaderComponent = DesktopHeader as React.ComponentType<DesktopHeaderProps>

  const desktopLoggedOutScreensConfig = routeMapToStaticScreens(
    loggedOutRoutes,
    makeLayout,
    false,
    true,
    false
  )
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
  const LoggedOutDesktop = loggedOutNav.getComponent()

  const desktopRootScreenOptions = {
    headerLeft: () => <HeaderLeftButton mode="cancel" />,
    headerShown: false, // eventually do this after we pull apart modal2 etc
    presentation: 'transparentModal' as const,
    title: '',
  } satisfies NativeStackNavigationOptions

  const useIsLoadingDesktop = () => !useHandshakeEverDone()

  // During an account switch loggedIn flaps false between the service's loggedOut and
  // loggedIn notifications; keep the app (and its left nav) mounted through that gap.
  const useIsLoggedInDesktop = () => {
    const loaded = useHandshakeEverDone()
    const loggedIn = useConfigState(s => s.loggedIn || s.userSwitching)
    return loaded && loggedIn
  }

  const useIsLoggedOutDesktop = () => {
    const loaded = useHandshakeEverDone()
    const loggedIn = useConfigState(s => s.loggedIn || s.userSwitching)
    return loaded && !loggedIn
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
            w['KBCONSTANTS'] = C
            w['KBINBOX'] = CChat
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

  const isDarkMode = useDarkModeState(s => s.isDarkMode())
  const navKey = Common.useUserSwitchNavKey()

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
      ref={setNavRef}
      theme={isDarkMode ? darkTheme : lightTheme}
    >
      <LoadedTeamsListProvider>
        <DesktopRootComponent />
      </LoadedTeamsListProvider>
    </NavigationContainer>
  )
}

// ─── Native ───────────────────────────────────────────────────────────────────

// Self-accept HMR so an edit here doesn't bubble up and reload the whole app
if (isMobile && module.hot) {
  module.hot.accept()
}

const tabToLabel = new Map<string, string>([
  [Tabs.chatTab, 'Chat'],
  [Tabs.fsTab, 'Files'],
  [Tabs.teamsTab, 'Teams'],
  [Tabs.peopleTab, 'People'],
  [Tabs.settingsTab, 'More'],
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
  // Tablet tab stacks hold every route; phone tab stacks hold only their root screen
  // (everything else lives in the root stack so it renders above the tab bar).
  const tabletScreensConfig = C.isTablet
    ? routeMapToStaticScreens(routes, makeLayout, false, false, true)
    : undefined

  for (const tab of nativeTabs) {
    const rootName = tabRoots[tab]
    const screens =
      tabletScreensConfig ??
      routeMapToStaticScreens(
        {[rootName]: routes[rootName as keyof typeof routes]} as typeof routes,
        makeLayout,
        false,
        false,
        true
      )
    const nav = createNativeStackNavigator({
      initialRouteName: rootName,
      screenOptions: tabStackOptions,
      screens,
    })
    nativeTabComponents[tab] = nav.getComponent()
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
    tabBarTestID: Common.tabToTestID.get(routeName),
    tabBarLabelVisibilityMode: 'labeled' as const,
    tabBarStyle: {backgroundColor: isDarkMode ? colors.greyDarkest : colors.blueDark},
    title: tabToLabel.get(routeName) ?? routeName,
  }
}

let NativeRootComponent: React.ComponentType

if (isMobile) {
  // Created inside the isMobile guard: on desktop @react-navigation/bottom-tabs is
  // aliased to the null module, so calling it at module scope would crash startup.
  const NativeTab = createBottomTabNavigator()

  function AppTabsNative() {
    const navBadges = useNotifState(s => s.navBadges)
    const hasPermissions = usePushState(s => s.hasPermissions)
    const isDarkMode = useDarkModeState(s => s.isDarkMode())

    return (
      <NativeTab.Navigator backBehavior="none">
        {nativeTabs.map(tab => (
          <NativeTab.Screen
            key={tab}
            name={tab}
            component={nativeTabComponents[tab]!}
            options={appTabsScreenOptions(tab, navBadges, hasPermissions, isDarkMode)}
          />
        ))}
      </NativeTab.Navigator>
    )
  }

  const nativeLoggedOutScreensConfig = routeMapToStaticScreens(
    loggedOutRoutes,
    makeLayout,
    false,
    true,
    false
  )

  const loggedOutNav = createNativeStackNavigator({
    initialRouteName: 'login',
    screenOptions: Common.defaultNavigationOptions as NativeStackNavigationOptions,
    screens: nativeLoggedOutScreensConfig,
  })
  const NativeLoggedOut = loggedOutNav.getComponent()

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
  const loggedInLoaded = useHandshakeEverDone()

  const {loggedIn, startupLoaded} = useConfigState(
    C.useShallow(s => ({loggedIn: s.loggedIn, startupLoaded: s.startup.loaded}))
  )

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
  // Android also remounts on dark mode changes
  const nativeIsDarkMode = useColorScheme() === 'dark'
  const navKey = Common.useUserSwitchNavKey()
  const nativeDarkSuffix = isAndroid ? (nativeIsDarkMode ? '-dark' : '-light') : ''
  const rootKey = navKey ? `${navKey}${nativeDarkSuffix}` : ''

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
      <NavigationContainer
        fallback={<View style={{backgroundColor: Kb.Styles.globalColors.white, flex: 1}} />}
        linking={loggedIn ? nativeLinkingConfig : undefined}
        // Sync the initial state from the linking config into the router store.
        // onStateChange doesn't fire for the initial state, so this ensures
        // onRouteChanged runs and conversation data gets loaded on startup.
        onReady={onStateChange}
        onStateChange={onStateChange}
        onUnhandledAction={onUnhandledAction}
        ref={setNavRef}
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
