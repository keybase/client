import * as C from '@/constants'
import * as Constants from '@/constants/router2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './router.shared'
import {shim, getOptions} from './shim'
import * as Tabs from '@/constants/tabs'
import * as Container from '@/util/container'
import * as RouterLinking from './router-linking.native'
import * as Common from './common.native'
import {StatusBar, View} from 'react-native'
import {HeaderLeftCancel2} from '@/common-adapters/header-hoc'
import {NavigationContainer, getFocusedRouteNameFromRoute} from '@react-navigation/native'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import {createNativeStackNavigator} from '@react-navigation/native-stack'

if (module.hot) {
  module.hot.accept('', () => {
    tabScreensCache.clear()
  })
}

// just to get badge rollups
const settingsTabChildren = [Tabs.gitTab, Tabs.devicesTab, Tabs.settingsTab] as const
const tabs = C.isTablet ? Tabs.tabletTabs : Tabs.phoneTabs
const tabToData = new Map<C.Tabs.Tab, {icon: Kb.IconType; label: string}>([
  [Tabs.chatTab, {icon: 'iconfont-nav-2-chat', label: 'Chat'}],
  [Tabs.fsTab, {icon: 'iconfont-nav-2-files', label: 'Files'}],
  [Tabs.teamsTab, {icon: 'iconfont-nav-2-teams', label: 'Teams'}],
  [Tabs.peopleTab, {icon: 'iconfont-nav-2-people', label: 'People'}],
  [Tabs.settingsTab, {icon: 'iconfont-nav-2-hamburger', label: 'More'}],
] as const)

type Screen = (p: {
  navigationKey?: string
  name: keyof KBRootParamList
  getComponent?: () => React.ComponentType<any>
  options: unknown
}) => React.ReactNode

const makeNavScreens = (rs: typeof tabRoutes, Screen: Screen, isModal: boolean) => {
  return Object.keys(rs).map(_name => {
    const name = _name as keyof KBRootParamList
    const val = rs[name]
    if (!val?.getScreen) return null
    return (
      <Screen
        key={String(name)}
        name={name}
        getComponent={val.getScreen}
        options={({route, navigation}: {route: unknown; navigation: unknown}) => {
          const no = getOptions(val)
          const opt = typeof no === 'function' ? no({navigation, route} as any) : no
          return {
            ...opt,
            ...(isModal ? {animationEnabled: true} : {}),
          }
        }}
      />
    )
  })
}

const TabBarIconImpl = React.memo(function TabBarIconImpl(props: {isFocused: boolean; routeName: Tabs.Tab}) {
  const {isFocused, routeName} = props
  const navBadges = C.useNotifState(s => s.navBadges)
  const hasPermissions = C.usePushState(s => s.hasPermissions)
  const onSettings = routeName === Tabs.settingsTab
  const tabsToCount: ReadonlyArray<Tabs.Tab> = onSettings ? settingsTabChildren : [routeName]
  const badgeNumber = tabsToCount.reduce(
    (res, tab) => res + (navBadges.get(tab) || 0),
    // notifications gets badged on native if there's no push, special case
    onSettings && !hasPermissions ? 1 : 0
  )

  const data = tabToData.get(routeName)
  return data ? (
    <View style={styles.container}>
      <Kb.Icon
        type={data.icon}
        fontSize={32}
        style={styles.tab}
        color={isFocused ? Kb.Styles.globalColors.whiteOrWhite : Kb.Styles.globalColors.blueDarkerOrBlack}
      />
      {!!badgeNumber && <Kb.Badge badgeNumber={badgeNumber} badgeStyle={styles.badge} />}
      {routeName === Tabs.fsTab && <Shared.FilesTabBadge />}
    </View>
  ) : null
})

const TabBarIcon = (p: {isFocused: boolean; routeName: Tabs.Tab}) => (
  <TabBarIconImpl isFocused={p.isFocused} routeName={p.routeName} />
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      badge: Kb.Styles.platformStyles({
        common: {
          position: 'absolute',
          right: 8,
          top: 3,
        },
      }),
      container: Kb.Styles.platformStyles({
        common: {
          flex: 1,
          justifyContent: 'center',
        },
        isTablet: {
          // This is to circumvent a React Navigation AnimatedComponent with minWidth: 64 that wraps TabBarIcon
          minWidth: Kb.Styles.globalMargins.xlarge,
        },
      }),
      keyboard: {
        flexGrow: 1,
        position: 'relative',
      },
      label: {marginLeft: Kb.Styles.globalMargins.medium},
      labelDarkMode: {color: Kb.Styles.globalColors.black_50},
      labelDarkModeFocused: {color: Kb.Styles.globalColors.black},
      labelLightMode: {color: Kb.Styles.globalColors.blueLighter},
      labelLightModeFocused: {color: Kb.Styles.globalColors.white},
      tab: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueDarkOrGreyDarkest,
          paddingBottom: 6,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 6,
        },
        isTablet: {width: '100%'},
      }),
    }) as const
)

const Tab = createBottomTabNavigator()
const tabRoutes = routes

// we must ensure we don't keep remaking these components
const tabScreensCache = new Map<(typeof tabs)[number], ReturnType<typeof makeNavScreens>>()
const makeTabStack = (tab: (typeof tabs)[number]) => {
  const S = createNativeStackNavigator()

  let tabScreens = tabScreensCache.get(tab)
  if (!tabScreens) {
    tabScreens = makeNavScreens(shim(tabRoutes, false, false), S.Screen as Screen, false)
    tabScreensCache.set(tab, tabScreens)
  }

  const TabStack = React.memo(function TabStack() {
    return (
      <S.Navigator
        initialRouteName={tabRoots[tab]}
        screenOptions={{
          ...Common.defaultNavigationOptions,
          animation: 'simple_push',
          animationDuration: 250,
          orientation: 'portrait',
        }}
      >
        {tabScreens}
      </S.Navigator>
    )
  })
  const Comp = () => <TabStack />
  return Comp
}

const AppTabsImpl = React.memo(function AppTabsImpl() {
  // so we have a stack per tab
  const tabStacks = React.useMemo(
    () =>
      tabs.map(tab => (
        <Tab.Screen
          key={tab}
          name={tab}
          component={makeTabStack(tab)}
          options={({route}) => {
            const routeName = getFocusedRouteNameFromRoute(route)
            return {
              tabBarStyle: routeName === 'chatConversation' ? Common.tabBarStyleHidden : Common.tabBarStyle,
            }
          }}
          listeners={{
            tabLongPress: () => {
              C.useRouterState.getState().dispatch.dynamic.tabLongPress?.(tab)
            },
          }}
        />
      )),
    []
  )

  const makeTabBarIcon =
    (routeName: string) =>
    ({focused}: {focused: boolean}) => <TabBarIcon isFocused={focused} routeName={routeName as Tabs.Tab} />
  const makeTabBarLabel =
    (routeName: string) =>
    ({focused}: {focused: boolean}) => (
      <Kb.Text
        style={Kb.Styles.collapseStyles([
          styles.label,
          Kb.Styles.isDarkMode()
            ? focused
              ? styles.labelDarkModeFocused
              : styles.labelDarkMode
            : focused
              ? styles.labelLightModeFocused
              : styles.labelLightMode,
        ])}
        type="BodyBig"
      >
        {tabToData.get(routeName as C.Tabs.Tab)?.label}
      </Kb.Text>
    )

  return (
    <Tab.Navigator
      backBehavior="none"
      screenOptions={({route}) => {
        return {
          ...Common.defaultNavigationOptions,
          headerShown: false,
          tabBarActiveBackgroundColor: Kb.Styles.globalColors.transparent,
          tabBarHideOnKeyboard: true,
          tabBarIcon: makeTabBarIcon(route.name),
          tabBarInactiveBackgroundColor: Kb.Styles.globalColors.transparent,
          tabBarLabel: makeTabBarLabel(route.name),
          tabBarShowLabel: Kb.Styles.isTablet,
          tabBarStyle: Common.tabBarStyle,
        }
      }}
    >
      {tabStacks}
    </Tab.Navigator>
  )
})

const AppTabs = () => <AppTabsImpl />

const LoggedOutStack = createNativeStackNavigator()

const LoggedOutScreens = makeNavScreens(
  shim(loggedOutRoutes, false, true),
  LoggedOutStack.Screen as Screen,
  false
)
const LoggedOut = React.memo(function LoggedOut() {
  return (
    // TODO show header and use nav headers
    <LoggedOutStack.Navigator
      initialRouteName="login"
      screenOptions={{
        ...Common.defaultNavigationOptions,
        headerShown: false,
      }}
    >
      {LoggedOutScreens}
    </LoggedOutStack.Navigator>
  )
})

const useInitialStateChangeAfterLinking = (
  goodLinking: unknown,
  onStateChange: () => void,
  loggedIn: boolean
) => {
  // When we load an initial state we use goodLinking. When an initial state is loaded we need to
  //manually call onStateChange as the framework itself won't call in this case. This is only valid
  // *after* we get a onReady callback so we need to keep track of 1. a valid goodLinking, 2. onReady called
  const goodLinkingState = React.useRef<GoodLinkingState>(
    goodLinking ? GoodLinkingState.GoodLinkingExists : GoodLinkingState.GoodLinkingHandled
  )
  React.useEffect(() => {
    if (goodLinking) {
      if (goodLinkingState.current === GoodLinkingState.GoodLinkingHandled) {
        goodLinkingState.current = GoodLinkingState.GoodLinkingExists
      }
    }
  }, [goodLinking])

  const onReady = React.useCallback(() => {
    if (goodLinkingState.current === GoodLinkingState.GoodLinkingExists) {
      goodLinkingState.current = GoodLinkingState.GoodLinkingHandled
      onStateChange()
    }
  }, [onStateChange])

  // When we do a quick user switch let's go back to the last tab we were on
  const lastLoggedInTab = React.useRef<Tabs.Tab | undefined>(undefined)
  const lastLoggedIn = Container.usePrevious(loggedIn)
  if (!loggedIn && lastLoggedIn) {
    lastLoggedInTab.current = Constants.getTab()
  }

  React.useEffect(() => {
    if (loggedIn && !lastLoggedIn && lastLoggedInTab.current) {
      const navRef = Constants.navigationRef_
      navRef.navigate(lastLoggedInTab.current)
    }
  }, [loggedIn, lastLoggedIn])

  return onReady
}

enum GoodLinkingState {
  GoodLinkingExists,
  GoodLinkingHandled,
}

const RootStack = createNativeStackNavigator()
const ModalScreens = makeNavScreens(shim(modalRoutes, true, false), RootStack.Screen as Screen, true)

const useBarStyle = () => {
  const darkModePreference = C.useDarkModeState(s => s.darkModePreference)
  const isDarkMode = C.useDarkModeState(s => s.isDarkMode())

  if (darkModePreference === 'system') {
    return 'default'
  }
  return isDarkMode ? 'light-content' : 'dark-content'
}

const RNApp = React.memo(function RNApp() {
  const s = Shared.useShared()
  const {loggedInLoaded, loggedIn, appState, onStateChange} = s
  const {navKey, initialState, onUnhandledAction} = s
  const goodLinking = RouterLinking.useStateToLinking(appState.current)
  // we only send certain params to the container depending on the state so we can remount w/ the right data
  // instead of using useEffect and flashing all the time
  // we use linking and force a key change if we're in NEEDS_INIT
  // while inited we can use initialStateRef when dark mode changes, we never want both at the same time

  Shared.useSharedAfter(appState)

  const onReady = useInitialStateChangeAfterLinking(goodLinking, onStateChange, loggedIn)

  const DEBUG_RNAPP_RENDER = __DEV__ && (false as boolean)
  if (DEBUG_RNAPP_RENDER) {
    console.log('DEBUG RNApp render', {
      appState,
      goodLinking,
      initialState,
      loggedIn,
      loggedInLoaded,
      navKey,
      onStateChange,
    })
  }
  const barStyle = useBarStyle()
  const bar = barStyle === 'default' ? null : <StatusBar barStyle={barStyle} />

  return (
    <Kb.Box2 direction="vertical" pointerEvents="box-none" fullWidth={true} fullHeight={true}>
      {bar}
      <NavigationContainer
        fallback={<View style={{backgroundColor: Kb.Styles.globalColors.white, flex: 1}} />}
        linking={goodLinking as any}
        ref={Constants.navigationRef_ as any}
        key={String(navKey)}
        theme={Shared.theme}
        initialState={initialState}
        onUnhandledAction={onUnhandledAction}
        onStateChange={onStateChange}
        onReady={onReady}
      >
        <RootStack.Navigator
          key="root"
          screenOptions={{
            headerShown: false, // eventually do this after we pull apart modal2 etc
          }}
        >
          {!loggedInLoaded && (
            <RootStack.Screen key="loading" name="loading" component={Shared.SimpleLoading} />
          )}
          {loggedInLoaded && loggedIn && (
            <>
              <RootStack.Screen name="loggedIn" component={AppTabs} />
              <RootStack.Group
                screenOptions={{
                  headerLeft: () => <HeaderLeftCancel2 />,
                  // hard to fight overdraw on android with this on so just treat modals as screens
                  presentation: Kb.Styles.isAndroid ? undefined : 'modal',
                  title: '',
                }}
              >
                {ModalScreens}
              </RootStack.Group>
            </>
          )}
          {loggedInLoaded && !loggedIn && <RootStack.Screen name="loggedOut" component={LoggedOut} />}
        </RootStack.Navigator>
      </NavigationContainer>
    </Kb.Box2>
  )
})

export default RNApp
