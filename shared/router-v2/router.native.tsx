import * as Constants from '../constants/router2'
import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Shim from './shim.native'
import * as Styles from '../styles'
import * as Tabs from '../constants/tabs'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as RouterLinking from './router-linking.native'
import * as Common from './common.native'
import * as ConfigConstants from '../constants/config'
import {useMemo} from '../util/memoize'
import {StatusBar} from 'react-native'
import {HeaderLeftCancel} from '../common-adapters/header-hoc'
import {NavigationContainer} from '@react-navigation/native'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import {enableFreeze} from 'react-native-screens'
import createNoDupeStackNavigator from './stack'
import {TransitionPresets} from '@react-navigation/stack'

enableFreeze()

if (module.hot) {
  module.hot.accept('', () => {
    tabScreensCache.clear()
  })
}

const settingsTabChildren = Container.isPhone ? Tabs.settingsTabChildrenPhone : Tabs.settingsTabChildrenTablet
const tabs = Container.isTablet ? Tabs.tabletTabs : Tabs.phoneTabs
const tabToData = {
  [Tabs.chatTab]: {icon: 'iconfont-nav-2-chat', label: 'Chat'},
  [Tabs.fsTab]: {icon: 'iconfont-nav-2-files', label: 'Files'},
  [Tabs.teamsTab]: {icon: 'iconfont-nav-2-teams', label: 'Teams'},
  [Tabs.peopleTab]: {icon: 'iconfont-nav-2-people', label: 'People'},
  [Tabs.settingsTab]: {icon: 'iconfont-nav-2-hamburger', label: 'More'},
  [Tabs.walletsTab]: {icon: 'iconfont-nav-2-wallets', label: 'Wallet'},
} as const

const makeNavScreens = (rs, Screen, isModal) => {
  return Object.keys(rs).map(name => {
    return (
      <Screen
        key={name}
        name={name}
        getComponent={rs[name].getScreen}
        options={({route, navigation}) => {
          const no = rs[name].getOptions ?? rs[name].getScreen().navigationOptions
          const opt = typeof no === 'function' ? no({navigation, route}) : no
          const skipAnim =
            route.params?.animationEnabled === undefined
              ? {}
              : {
                  // immediate pop in, default back animation
                  transitionSpec: {
                    close: TransitionPresets.DefaultTransition,
                    open: {
                      animation: 'timing',
                      config: {duration: 0},
                    },
                  },
                }
          return {
            ...opt,
            ...(isModal ? {animationEnabled: true} : {}),
            ...skipAnim,
          }
        }}
      />
    )
  })
}

const TabBarIcon = React.memo((props: {isFocused: boolean; routeName: Tabs.Tab}) => {
  const {isFocused, routeName} = props
  const onSettings = routeName === Tabs.settingsTab
  const navBadges = Container.useSelector(state => state.notifications.navBadges)
  const pushHasPermissions = Container.useSelector(state => state.push.hasPermissions)
  const tabsToCount: ReadonlyArray<Tabs.Tab> = onSettings ? settingsTabChildren : [routeName]
  const badgeNumber = tabsToCount.reduce(
    (res, tab) => res + (navBadges.get(tab) || 0),
    // notifications gets badged on native if there's no push, special case
    onSettings && !pushHasPermissions ? 1 : 0
  )

  return tabToData[routeName] ? (
    <Kb.NativeView style={styles.container}>
      <Kb.Icon
        type={tabToData[routeName].icon}
        fontSize={32}
        style={styles.tab}
        color={isFocused ? Styles.globalColors.whiteOrWhite : Styles.globalColors.blueDarkerOrBlack}
      />
      {!!badgeNumber && <Kb.Badge badgeNumber={badgeNumber} badgeStyle={styles.badge} />}
      {routeName === Tabs.fsTab && <Shared.FilesTabBadge />}
    </Kb.NativeView>
  ) : null
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: Styles.platformStyles({
        common: {
          position: 'absolute',
          right: 8,
          top: 3,
        },
      }),
      container: Styles.platformStyles({
        common: {
          flex: 1,
          justifyContent: 'center',
        },
        isTablet: {
          // This is to circumvent a React Navigation AnimatedComponent with minWidth: 64 that wraps TabBarIcon
          minWidth: Styles.globalMargins.xlarge,
        },
      }),
      keyboard: {
        flexGrow: 1,
        position: 'relative',
      },
      label: {marginLeft: Styles.globalMargins.medium},
      labelDarkMode: {color: Styles.globalColors.black_50},
      labelDarkModeFocused: {color: Styles.globalColors.black},
      labelLightMode: {color: Styles.globalColors.blueLighter},
      labelLightModeFocused: {color: Styles.globalColors.white},
      tab: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
          paddingBottom: 6,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 6,
        },
        isTablet: {width: '100%'},
      }),
    } as const)
)

const Tab = createBottomTabNavigator()

const fastTransitionSpec = {
  animation: 'spring',
  config: {
    damping: 500,
    mass: 0.3,
    overshootClamping: true,
    restDisplacementThreshold: 10,
    restSpeedThreshold: 10,
    stiffness: 1000,
  },
}

// we must ensure we don't keep remaking these components
const tabScreensCache = new Map()
const makeTabStack = (tab: string) => {
  const S = createNoDupeStackNavigator()

  let tabScreens = tabScreensCache.get(tab)
  if (!tabScreens) {
    tabScreens = makeNavScreens(Shim.shim(routes, false, false), S.Screen, false)
    tabScreensCache.set(tab, tabScreens)
  }

  const Comp = React.memo(
    () => {
      return (
        <S.Navigator
          initialRouteName={tabRoots[tab]}
          screenOptions={{
            ...Common.defaultNavigationOptions,
            transitionSpec: {
              close: fastTransitionSpec,
              open: fastTransitionSpec,
            },
          }}
        >
          {tabScreens}
        </S.Navigator>
      )
    },
    () => true
  )
  return Comp
}

const AppTabsInner = () => {
  const dispatch = Container.useDispatch()

  // so we have a stack per tab
  const tabStacks = useMemo(
    () =>
      tabs.map(tab => (
        <Tab.Screen
          key={tab}
          name={tab}
          component={makeTabStack(tab)}
          listeners={() => ({
            tabLongPress: () => {
              dispatch(RouteTreeGen.createTabLongPress({tab}))
            },
          })}
        />
      )),
    [dispatch]
  )

  return (
    <Tab.Navigator
      backBehavior="none"
      screenOptions={({route}) => {
        return {
          ...Common.defaultNavigationOptions,
          headerShown: false,
          tabBarActiveBackgroundColor: Styles.globalColors.transparent,
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({focused}) => <TabBarIcon isFocused={focused} routeName={route.name as Tabs.Tab} />,
          tabBarInactiveBackgroundColor: Styles.globalColors.transparent,
          tabBarLabel: ({focused}) => (
            <Kb.Text
              style={Styles.collapseStyles([
                styles.label,
                Styles.isDarkMode()
                  ? focused
                    ? styles.labelDarkModeFocused
                    : styles.labelDarkMode
                  : focused
                  ? styles.labelLightModeFocused
                  : styles.labelLightMode,
              ])}
              type="BodyBig"
            >
              {tabToData[route.name].label}
            </Kb.Text>
          ),
          tabBarShowLabel: Styles.isTablet,
          tabBarStyle: Common.tabBarStyle,
        }
      }}
    >
      {tabStacks}
    </Tab.Navigator>
  )
}

const AppTabs = React.memo(
  AppTabsInner,
  () => true // ignore all props
)

const LoggedOutStack = createNoDupeStackNavigator()
const LoggedOutScreens = makeNavScreens(Shim.shim(loggedOutRoutes, false, true), LoggedOutStack.Screen, false)
const LoggedOut = React.memo(() => (
  <LoggedOutStack.Navigator
    initialRouteName="login"
    screenOptions={{
      headerShown: false,
    }}
  >
    {LoggedOutScreens}
  </LoggedOutStack.Navigator>
))

const useInitialStateChangeAfterLinking = (
  goodLinking: any,
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
  const lastLoggedInTab = React.useRef<string | undefined>(undefined)
  const lastLoggedIn = Container.usePrevious(loggedIn)
  if (!loggedIn && lastLoggedIn) {
    lastLoggedInTab.current = Constants.getCurrentTab()
  }

  React.useEffect(() => {
    if (loggedIn && !lastLoggedIn && lastLoggedInTab.current) {
      Constants.navigationRef_.navigate(lastLoggedInTab.current as any)
    }
  }, [loggedIn, lastLoggedIn])

  return onReady
}

enum GoodLinkingState {
  GoodLinkingExists,
  GoodLinkingHandled,
}

const RootStack = createNoDupeStackNavigator()
const ModalScreens = makeNavScreens(Shim.shim(modalRoutes, true, false), RootStack.Screen, true)

const useBarStyle = () => {
  const isDarkMode = Container.useSelector(state => ConfigConstants.isDarkMode(state.config))
  const darkModePreference = Container.useSelector(state => state.config.darkModePreference)

  if (!darkModePreference || darkModePreference === 'system') {
    return 'default'
  }
  return isDarkMode ? 'light-content' : 'dark-content'
}

const RNApp = React.memo(() => {
  const {loggedInLoaded, loggedIn, appState, onStateChange, navKey, initialState} = Shared.useShared()
  const goodLinking: any = RouterLinking.useReduxToLinking(appState.current)
  // we only send certain params to the container depending on the state so we can remount w/ the right data
  // instead of using useEffect and flashing all the time
  // we use linking and force a key change if we're in NEEDS_INIT
  // while inited we can use initialStateRef when dark mode changes, we never want both at the same time

  Shared.useSharedAfter(appState)

  const onReady = useInitialStateChangeAfterLinking(goodLinking, onStateChange, loggedIn)

  const DEBUG_RNAPP_RENDER = __DEV__ && false
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

  return (
    <Kb.KeyboardAvoidingView style={styles.keyboard} behavior={Styles.isIOS ? 'padding' : undefined}>
      <StatusBar barStyle={barStyle} />
      <NavigationContainer
        fallback={<Kb.NativeView style={{backgroundColor: Styles.globalColors.white, flex: 1}} />}
        linking={goodLinking}
        ref={Constants.navigationRef_ as any}
        key={String(navKey)}
        theme={Shared.theme}
        initialState={initialState}
        onStateChange={onStateChange}
        onReady={onReady}
      >
        <RootStack.Navigator
          key="root"
          screenOptions={{
            animationEnabled: false,
            headerLeft: () => <HeaderLeftCancel />,
            headerShown: false, // eventually do this after we pull apart modal2 etc
            presentation: 'modal',
            title: '',
          }}
        >
          {!loggedInLoaded && (
            <RootStack.Screen key="loading" name="loading" component={Shared.SimpleLoading} />
          )}
          {loggedInLoaded && loggedIn && (
            <>
              <RootStack.Screen name="loggedIn" component={AppTabs} />
              {ModalScreens}
            </>
          )}
          {loggedInLoaded && !loggedIn && <RootStack.Screen name="loggedOut" component={LoggedOut} />}
        </RootStack.Navigator>
      </NavigationContainer>
    </Kb.KeyboardAvoidingView>
  )
})

export default RNApp
