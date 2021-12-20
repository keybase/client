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
import {HeaderLeftArrow, HeaderLeftCancel} from '../common-adapters/header-hoc'
import {NavigationContainer, getFocusedRouteNameFromRoute, Theme} from '@react-navigation/native'
import {createStackNavigator, TransitionPresets} from '@react-navigation/stack'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import {enableFreeze} from 'react-native-screens'

enableFreeze()

export const headerDefaultStyle = {
  get backgroundColor() {
    return Styles.globalColors.fastBlank
  },
  get borderBottomColor() {
    return Styles.globalColors.black_10
  },
  borderBottomWidth: 1,
  borderStyle: 'solid',
  elevation: undefined, // since we use screen on android turn off drop shadow
  // headerExtraHeight is only hooked up for tablet. On other platforms, react-navigation calculates header height.
  ...(Styles.isTablet ? {height: 44 + Styles.headerExtraHeight} : {}),
}

const actionWidth = 64

// Options used by default on all navigators
const defaultNavigationOptions: any = {
  headerLeft: HeaderLeftArrow,
  headerStyle: headerDefaultStyle,
  headerTitleContainerStyle: {
    alignItems: 'stretch',
    // backgroundColor: 'red',
    flexGrow: 1,
  },
  headerBackTitle: 'temp',
  headerBackVisible: true,
  headerRightContainerStyle: {
    // backgroundColor: 'orange',
    width: actionWidth,
    paddingRight: 8,
  },
  headerLeftContainerStyle: {
    // backgroundColor: 'yellow',
    paddingLeft: 8,
    width: actionWidth,
  },
  headerTitle: hp => (
    <Kb.Text type="BodyBig" style={styles.headerTitle} lineClamp={1} center={true}>
      {hp.children}
    </Kb.Text>
  ),
}

const TabBarIcon = props => {
  const {isFocused, routeName} = props
  const onSettings = routeName === Tabs.settingsTab
  const navBadges = Container.useSelector(state => state.notifications.navBadges)
  const pushHasPermissions = Container.useSelector(state => state.push.hasPermissions)
  const badgeNumber = (onSettings ? Shared.settingsTabChildren : [routeName]).reduce(
    (res, tab) => res + (navBadges.get(tab) || 0),
    // notifications gets badged on native if there's no push, special case
    onSettings && !pushHasPermissions ? 1 : 0
  )
  return Shared.tabToData[routeName] ? (
    <Kb.NativeView style={tabStyles.container}>
      <Kb.Icon
        type={Shared.tabToData[routeName].icon}
        fontSize={32}
        style={tabStyles.tab}
        color={isFocused ? Styles.globalColors.whiteOrWhite : Styles.globalColors.blueDarkerOrBlack}
      />
      {!!badgeNumber && <Kb.Badge badgeNumber={badgeNumber} badgeStyle={tabStyles.badge} />}
      {routeName === Tabs.fsTab && <Shared.FilesTabBadge />}
    </Kb.NativeView>
  ) : null
}

const tabStyles = Styles.styleSheetCreate(
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
          justifyContent: 'center',
          flex: 1,
        },
        isTablet: {
          // This is to circumvent a React Navigation AnimatedComponent with minWidth: 64 that wraps TabBarIcon
          minWidth: Styles.globalMargins.xlarge,
        },
      }),
      label: {marginLeft: Styles.globalMargins.medium},
      labelDarkMode: {color: Styles.globalColors.black_50},
      labelDarkModeFocused: {color: Styles.globalColors.black},
      labelLightMode: {color: Styles.globalColors.blueLighter},
      labelLightModeFocused: {color: Styles.globalColors.white},
      tab: Styles.platformStyles({
        common: {
          paddingBottom: 6,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 6,
        },
        isTablet: {
          width: '100%',
        },
      }),
    } as const)
)

const styles = Styles.styleSheetCreate(() => ({
  headerTitle: {
    // backgroundColor: 'pink',
    color: Styles.globalColors.black,
  },
  keyboard: {
    flexGrow: 1,
    position: 'relative',
  },
}))

// export default RNApp
const Tab = createBottomTabNavigator()

const fastTransitionSpec = {
  animation: 'spring',
  config: {
    stiffness: 1000,
    damping: 500,
    mass: 0.3,
    overshootClamping: true,
    restDisplacementThreshold: 10,
    restSpeedThreshold: 10,
  },
}

// so we have a stack per tab?
const tabToStack = new Map()
const makeTabStack = tab => {
  let Comp = tabToStack.get(tab)
  if (!Comp) {
    const S = createStackNavigator()
    Comp = ({navigation, route}) => {
      const dispatch = Container.useDispatch()
      React.useEffect(() => {
        const unsubscribe = navigation.addListener('tabLongPress', e => {
          dispatch(RouteTreeGen.createTabLongPress({tab}))
        })
        return unsubscribe
      }, [navigation, dispatch])
      React.useLayoutEffect(() => {
        const routeName = getFocusedRouteNameFromRoute(route)
        const hideTabs = routeName === 'chatConversation'
        navigation.setOptions({tabBarStyle: hideTabs ? {display: 'none'} : tabBarStyle})
      }, [navigation, route])
      return (
        <S.Navigator
          initialRouteName={tabRoots[tab]}
          screenOptions={{
            ...defaultNavigationOptions,
            transitionSpec: {
              open: fastTransitionSpec,
              close: fastTransitionSpec,
            },
          }}
        >
          {makeNavScreens(Shim.shim(routes, false, false), S.Screen, false)}
        </S.Navigator>
      )
    }
    tabToStack.set(tab, Comp)
  }
  return Comp
}

const makeNavScreens = (rs, Screen, isModal) => {
  return Object.keys(rs).map(name => {
    return (
      <Screen
        key={name}
        name={name}
        getComponent={rs[name].getScreen}
        options={({route, navigation}) => {
          const no = rs[name].getScreen().navigationOptions
          const opt = typeof no === 'function' ? no({route, navigation}) : no
          const skipAnim =
            route.params?.animationEnabled === undefined
              ? {}
              : {
                  // immediate pop in, default back animation
                  transitionSpec: {
                    open: {
                      animation: 'timing',
                      config: {duration: 0},
                    },
                    close: TransitionPresets.DefaultTransition,
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

const tabBarStyle = {
  get backgroundColor() {
    return Styles.globalColors.blueDarkOrGreyDarkest
  },
}

const AppTabs = () => {
  console.log('aaa appTab rendering')

  return (
    <Tab.Navigator
      backBehavior="none"
      screenOptions={({route}) => {
        return {
          ...defaultNavigationOptions,
          tabBarHideOnKeyboard: true,
          headerShown: false,
          tabBarShowLabel: Styles.isTablet,
          tabBarStyle,
          tabBarActiveBackgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
          tabBarInactiveBackgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
          tabBarIcon: ({focused}) => <TabBarIcon isFocused={focused} routeName={route.name} />,
        }
      }}
    >
      {Shared.tabs.map(tab => (
        <Tab.Screen key={tab} name={tab} getComponent={() => makeTabStack(tab)} />
      ))}
    </Tab.Navigator>
  )
}

const LoggedOutStack = createStackNavigator()
const LoggedOut = () => (
  <LoggedOutStack.Navigator
    initialRouteName="login"
    screenOptions={{
      tabBarHideOnKeyboard: true,
      headerShown: false,
    }}
  >
    {makeNavScreens(Shim.shim(loggedOutRoutes, false, true), LoggedOutStack.Screen, false)}
  </LoggedOutStack.Navigator>
)

const theme: Theme = {
  dark: false,
  colors: {
    get primary() {
      return Styles.globalColors.fastBlank
    },
    get background() {
      return Styles.globalColors.fastBlank
    },
    get card() {
      return Styles.globalColors.white
    },
    get text() {
      return Styles.globalColors.black
    },
    get border() {
      return Styles.globalColors.black_10
    },
    get notification() {
      return Styles.globalColors.black
    },
  },
}

const useInitialStateChangeAfterLinking = (goodLinking, onStateChange) => {
  // send onNavChanged on initial render after handling linking
  React.useEffect(() => {
    if (goodLinking) {
      console.log('bbb use effect good linking onstatechange')
      setTimeout(() => onStateChange(), 1)
    }
  }, [goodLinking])
}

const RootStack = createStackNavigator()
const RNApp = () => {
  const {loggedInLoaded, loggedIn, appState, onStateChange, navKey, initialState} = Shared.useShared()
  const goodLinking = RouterLinking.useReduxToLinking(appState.current)
  // we only send certain params to the container depending on the state so we can remount w/ the right data
  // instead of using useEffect and flashing all the time
  // we use linking and force a key change if we're in NEEDS_INIT
  // while inited we cna use initialStateRef when dark mode changes, we never want both at the same time

  console.log('bbb RNApp render', {
    appState: appState.current,
    goodLinking,
    navKey,
    initialState,
    loggedIn,
    loggedInLoaded,
  })

  Shared.useSharedAfter(appState)

  useInitialStateChangeAfterLinking(goodLinking, onStateChange)

  return (
    <Kb.KeyboardAvoidingView style={styles.keyboard} behavior={Styles.isIOS ? 'padding' : undefined}>
      <NavigationContainer
        fallback={<Kb.NativeView style={{backgroundColor: Styles.globalColors.white, flex: 1}} />}
        linking={goodLinking}
        ref={Constants.navigationRef_}
        key={String(navKey)}
        theme={theme}
        initialState={initialState}
        onStateChange={onStateChange}
      >
        <RootStack.Navigator
          key="root"
          screenOptions={{
            animationEnabled: false,
            presentation: 'modal',
            headerLeft: HeaderLeftCancel,
            title: '',
            headerShown: false, // eventually do this after we pull apart modal2 etc
          }}
        >
          {!loggedInLoaded && (
            <RootStack.Screen key="loading" name="loading" component={Shared.SimpleLoading} />
          )}
          {loggedInLoaded && loggedIn && (
            <>
              <RootStack.Screen name="loggedIn" component={AppTabs} />
              {makeNavScreens(Shim.shim(modalRoutes, true, false), RootStack.Screen, true)}
            </>
          )}
          {loggedInLoaded && !loggedIn && <RootStack.Screen name="loggedOut" component={LoggedOut} />}
        </RootStack.Navigator>
      </NavigationContainer>
    </Kb.KeyboardAvoidingView>
  )
}

export default RNApp
