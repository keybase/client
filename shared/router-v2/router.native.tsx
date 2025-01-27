import * as C from '@/constants'
import * as Constants from '@/constants/router2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Tabs from '@/constants/tabs'
import * as Common from './common.native'
import {shim, getOptions} from './shim'
import logger from '@/logger'
import {StatusBar, View, useWindowDimensions, Linking} from 'react-native'
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
          // eslint-disable-next-line
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
  const {width: screenWidth} = useWindowDimensions()
  const data = tabToData.get(routeName)
  return data ? (
    <View style={[styles.tabContainer, {minHeight: 40, minWidth: screenWidth / tabs.length}]}>
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
          left: 36,
          position: 'absolute',
          // new arch? right: 8,
          top: 3,
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
      loading: Kb.Styles.globalStyles.fillAbsolute,
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
      tabContainer: Kb.Styles.platformStyles({
        common: {
          flex: 1,
          justifyContent: 'center',
        },
        isTablet: {
          // This is to circumvent a React Navigation AnimatedComponent with minWidth: 64 that wraps TabBarIcon
          minWidth: Kb.Styles.globalMargins.xlarge,
        },
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

type InitialStateState = 'init' | 'loading' | 'loaded'

const argArrayGood = (arr: Array<string>, len: number) => {
  return arr.length === len && arr.every(p => !!p.length)
}
const isValidLink = (link: string) => {
  const urlPrefix = 'https://keybase.io/'
  if (link.startsWith(urlPrefix)) {
    if (link.substring(urlPrefix.length).split('/').length === 1) {
      return true
    }
  }
  const prefix = 'keybase://'
  if (!link.startsWith(prefix)) {
    return false
  }
  const path = link.substring(prefix.length)
  const [root, ...parts] = path.split('/')

  switch (root) {
    case 'profile':
      switch (parts[0]) {
        case 'new-proof':
          return argArrayGood(parts, 2) || argArrayGood(parts, 3)
        case 'show':
          return argArrayGood(parts, 2)
        default:
      }
      return false
    case 'private':
      return true
    case 'public':
      return true
    case 'team':
      return true
    case 'convid':
      return argArrayGood(parts, 1)
    case 'chat':
      return argArrayGood(parts, 1) || argArrayGood(parts, 2)
    case 'team-page':
      return argArrayGood(parts, 3)
    case 'incoming-share':
      return true
    case 'team-invite-link':
      return argArrayGood(parts, 1)
    case 'settingsPushPrompt':
      return true
    default:
      return false
  }
}

const useInitialState = () => {
  const startup = C.useConfigState(s => s.startup)
  const {tab: startupTab, followUser: startupFollowUser, loaded: startupLoaded} = startup
  let {conversation: startupConversation} = startup

  if (!C.Chat.isValidConversationIDKey(startupConversation)) {
    startupConversation = ''
  }

  const showMonster = C.usePushState(s => {
    const {hasPermissions, justSignedUp, showPushPrompt} = s
    return loggedIn && !justSignedUp && showPushPrompt && !hasPermissions
  })
  const loggedIn = C.useConfigState(s => s.loggedIn)
  const androidShare = C.useConfigState(s => s.androidShare)

  const [initialState, setInitialState] = React.useState<undefined | object>(undefined)
  const [initialStateState, setInitialStateState] = React.useState<InitialStateState>('init')

  React.useEffect(() => {
    if (!startupLoaded) return
    if (initialStateState !== 'init') {
      return
    }
    setInitialStateState('loading')
    const loadInitialURL = async () => {
      let url = await Linking.getInitialURL()

      // don't try and resume or follow links if we're signed out
      if (!loggedIn) return

      if (!url && showMonster) {
        url = 'keybase://settingsPushPrompt'
      }
      if (!url && androidShare) {
        url = `keybase://incoming-share`
      }

      if (url && isValidLink(url)) {
        setTimeout(() => url && C.useDeepLinksState.getState().dispatch.handleAppLink(url), 1)
      } else if (startupFollowUser && !startupConversation) {
        url = `keybase://profile/show/${startupFollowUser}`
        if (isValidLink(url)) {
          const initialTabState = {
            state: {
              index: 1,
              routes: [{name: 'peopleRoot'}, {name: 'profile', params: {username: startupFollowUser}}],
            },
          }
          setInitialState({
            index: 0,
            routes: [
              {
                name: 'loggedIn',
                state: {
                  index: 0,
                  routeNames: [Tabs.peopleTab],
                  routes: [{name: Tabs.peopleTab, ...initialTabState}],
                },
              },
            ],
          })
        }
      } else if (startupTab || startupConversation) {
        try {
          const tab = startupConversation ? Tabs.chatTab : startupTab
          C.Chat.useState_.getState().dispatch.unboxRows([startupConversation])
          C.Chat.getConvoState_(startupConversation).dispatch.loadMoreMessages({
            reason: 'savedLastState',
          })

          const initialTabState = startupConversation
            ? {
                state: {
                  index: 1,
                  routes: [
                    {name: 'chatRoot'},
                    {name: 'chatConversation', params: {conversationIDKey: startupConversation}},
                  ],
                },
              }
            : {}

          setInitialState({
            index: 0,
            routes: [
              {
                name: 'loggedIn',
                state: {
                  index: 0,
                  routeNames: [tab],
                  routes: [{name: tab, ...initialTabState}],
                },
              },
            ],
          })
        } catch {}
      }
    }

    const f = async () => {
      await loadInitialURL()
      setInitialStateState('loaded')
    }

    C.ignorePromise(f())
  }, [
    loggedIn,
    startupLoaded,
    initialState,
    initialStateState,
    androidShare,
    showMonster,
    startupConversation,
    startupFollowUser,
    startupTab,
  ])

  return {initialState, initialStateState}
}

const RNApp = React.memo(function RNApp() {
  const everLoadedRef = React.useRef(false)
  const loggedInLoaded = C.useDaemonState(s => {
    const loaded = everLoadedRef.current || s.handshakeState === 'done'
    everLoadedRef.current = loaded
    return loaded
  })

  const {initialState, initialStateState} = useInitialState()
  const loggedIn = C.useConfigState(s => s.loggedIn)
  const setNavState = C.useRouterState(s => s.dispatch.setNavState)
  const onStateChange = React.useCallback(() => {
    const ns = C.Router2.getRootState()
    setNavState(ns)
  }, [setNavState])

  const onUnhandledAction = React.useCallback((a: Readonly<{type: string}>) => {
    logger.info(`[NAV] Unhandled action: ${a.type}`, a, C.Router2.logState())
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
  const barStyle = useBarStyle()
  const bar = barStyle === 'default' ? null : <StatusBar barStyle={barStyle} />

  if (initialStateState !== 'loaded' || !loggedInLoaded) {
    return (
      <Kb.Box2 direction="vertical" style={styles.loading}>
        <Shared.SimpleLoading />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" pointerEvents="box-none" fullWidth={true} fullHeight={true}>
      {bar}
      <NavigationContainer
        navigationInChildEnabled={true}
        fallback={<View style={{backgroundColor: Kb.Styles.globalColors.white, flex: 1}} />}
        ref={
          // eslint-disable-next-line
          Constants.navigationRef_ as any
        }
        theme={Shared.theme}
        initialState={initialState as any}
        onUnhandledAction={onUnhandledAction}
        onStateChange={onStateChange}
      >
        <RootStack.Navigator
          key="root"
          screenOptions={{
            headerShown: false, // eventually do this after we pull apart modal2 etc
          }}
        >
          {loggedIn ? (
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
          ) : (
            <RootStack.Screen name="loggedOut" component={LoggedOut} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </Kb.Box2>
  )
})

export default RNApp
