import * as C from '@/constants'
import * as Constants from '@/constants/router2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Tabs from '@/constants/tabs'
import * as Common from './common.native'
import {shim, getOptions} from './shim'
import logger from '@/logger'
import {StatusBar, View, Linking} from 'react-native'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import {PlatformPressable} from '@react-navigation/elements'
import {HeaderLeftCancel2} from '@/common-adapters/header-hoc'
import {NavigationContainer, getFocusedRouteNameFromRoute} from '@react-navigation/native'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import {createBottomTabNavigator, type BottomTabBarButtonProps} from '@react-navigation/bottom-tabs'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import {createNativeStackNavigator} from '@react-navigation/native-stack'

if (module.hot) {
  module.hot.accept('', () => {})
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

const TabBarIcon = React.memo(function TabBarIconImpl(props: {isFocused: boolean; routeName: Tabs.Tab}) {
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
  const {width: screenWidth} = useSafeAreaFrame()
  const data = tabToData.get(routeName)
  return data ? (
    <View
      style={[
        styles.tabContainer,
        C.isTablet ? {minHeight: 50} : {minHeight: 40, minWidth: screenWidth / tabs.length},
      ]}
    >
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      badge: Kb.Styles.platformStyles({
        common: {
          left: 36,
          position: 'absolute',
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

const TabStackNavigator = createNativeStackNavigator()
const tabStackOptions = {
  ...Common.defaultNavigationOptions,
  animation: 'simple_push',
  animationDuration: 250,
  orientation: 'portrait',
} as const
const TabStack = React.memo(function TabStack(p: {route: {name: Tabs.Tab}}) {
  const tab = p.route.name
  const screens = React.useMemo(
    () => makeNavScreens(shim(tabRoutes, false, false), TabStackNavigator.Screen as Screen, false),
    []
  )
  return (
    <TabStackNavigator.Navigator initialRouteName={tabRoots[tab]} screenOptions={tabStackOptions}>
      {screens}
    </TabStackNavigator.Navigator>
  )
})

// so we have a stack per tab
const tabScreenOptions = ({route}: {route: {name: string}}) => {
  let routeName
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
        C.useRouterState.getState().dispatch.dynamic.tabLongPress?.(tab)
      },
    }}
    component={TabStack}
    options={tabScreenOptions}
  />
))

type TabIconProps = {routeName: Tabs.Tab; focused: boolean}
const TabBarIconWrapper = React.memo(function TabBarIconWrapper(p: TabIconProps) {
  return <TabBarIcon isFocused={p.focused} routeName={p.routeName} />
})
const TabBarLabelWrapper = React.memo(function TabBarLabelWrapper(p: TabIconProps) {
  const data = tabToData.get(p.routeName)
  return (
    <Kb.Text
      style={Kb.Styles.collapseStyles([
        styles.label,
        Kb.Styles.isDarkMode()
          ? p.focused
            ? styles.labelDarkModeFocused
            : styles.labelDarkMode
          : p.focused
            ? styles.labelLightModeFocused
            : styles.labelLightMode,
      ])}
      type="BodyBig"
    >
      {data?.label}
    </Kb.Text>
  )
})

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
      <TabBarIconWrapper routeName={route.name as Tabs.Tab} focused={focused} />
    ),
    tabBarInactiveBackgroundColor: Kb.Styles.globalColors.transparent,
    tabBarLabel: ({focused}: {focused: boolean}) => (
      <TabBarLabelWrapper routeName={route.name as Tabs.Tab} focused={focused} />
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

const LoggedOutStack = createNativeStackNavigator()

const LoggedOutScreens = makeNavScreens(
  shim(loggedOutRoutes, false, true),
  LoggedOutStack.Screen as Screen,
  false
)
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

const useInitialState = (loggedInLoaded: boolean) => {
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

    if (!loggedInLoaded) {
      return
    }
    if (initialStateState !== 'init') {
      return
    }
    setInitialStateState('loading')
    const loadInitialURL = async () => {
      let url = await Linking.getInitialURL()

      // don't try and resume or follow links if we're signed out
      if (!loggedIn) {
        return
      }

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
    androidShare,
    initialState,
    initialStateState,
    loggedIn,
    loggedInLoaded,
    showMonster,
    startupConversation,
    startupFollowUser,
    startupLoaded,
    startupTab,
  ])

  return {initialState, initialStateState}
}

// on android we rerender everything on dark mode changes
const useRootKey = () => {
  const [rootKey, setRootKey] = React.useState('')
  const isDarkMode = Kb.Styles.useIsDarkMode()
  React.useEffect(() => {
    if (!C.isAndroid) return
    setRootKey(isDarkMode ? 'android-dark' : 'android-light')
  }, [isDarkMode])

  return rootKey
}

const RootStack = createNativeStackNavigator()
const rootStackScreenOptions = {
  headerShown: false, // eventually do this after we pull apart modal2 etc
}
const ModalScreens = makeNavScreens(shim(modalRoutes, true, false), RootStack.Screen as Screen, true)
const modalScreenOptions = {
  headerLeft: () => <HeaderLeftCancel2 />,
  presentation: 'modal',
} as const
const RNApp = React.memo(function RNApp() {
  const everLoadedRef = React.useRef(false)
  const loggedInLoaded = C.useDaemonState(s => {
    const loaded = everLoadedRef.current || s.handshakeState === 'done'
    everLoadedRef.current = loaded
    return loaded
  })

  const {initialState, initialStateState} = useInitialState(loggedInLoaded)
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
  const rootKey = useRootKey()

  if (initialStateState !== 'loaded' || !loggedInLoaded) {
    return (
      <Kb.Box2 direction="vertical" style={styles.loading}>
        <Shared.SimpleLoading />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" pointerEvents="box-none" fullWidth={true} fullHeight={true} key={rootKey}>
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
        <RootStack.Navigator key="root" screenOptions={rootStackScreenOptions}>
          {loggedIn ? (
            <>
              <RootStack.Screen name="loggedIn" component={AppTabs} />
              <RootStack.Group screenOptions={modalScreenOptions}>{ModalScreens}</RootStack.Group>
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
