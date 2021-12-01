import * as Constants from '../constants/router2'
import * as ChatConstants from '../constants/chat2'
// import * as ConfigGen from '../actions/config-gen'
// import HiddenString from '../util/hidden-string'
// import * as LoginGen from '../actions/login-gen'
import * as Kbfs from '../fs/common'
import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Shim from './shim.native'
// import {getRenderDebug} from './shim.shared'
import {createStackNavigator} from '@react-navigation/stack'
import * as Styles from '../styles'
import * as Tabs from '../constants/tabs'
import * as FsConstants from '../constants/fs'
import * as Container from '../util/container'
// import shallowEqual from 'shallowequal'
// import logger from '../logger'
import {IconType} from '../common-adapters/icon.constants-gen'
import {HeaderLeftArrow, HeaderLeftCancel} from '../common-adapters/header-hoc'
// import {Props} from './router'
// import {connect} from '../util/container'
import {
  NavigationContainer,
  getFocusedRouteNameFromRoute,
  CommonActions,
  getStateFromPath,
} from '@react-navigation/native'
import {useHeaderHeight, getDefaultHeaderHeight, SafeAreaProviderCompat} from '@react-navigation/elements'
import {TransitionPresets} from '@react-navigation/stack'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
// import {createSwitchNavigator, StackActions} from '@react-navigation/core'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import {enableFreeze} from 'react-native-screens'
// import {getPersistenceFunctions} from './persist.native'
import Loading from '../login/loading'
import * as ConfigGen from '../actions/config-gen'
import * as ConfigConstants from '../constants/config'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as DeeplinksGen from '../actions/deeplinks-gen'

// const Stack = createStackNavigator()

// enableFreeze()

export const headerDefaultStyle = {
  get backgroundColor() {
    // return 'green'
    return Styles.globalColors.fastBlank
  },
  get borderBottomColor() {
    return Styles.globalColors.black_10
  },
  borderBottomWidth: 1,
  borderStyle: 'solid',
  elevation: undefined, // since we use screen on android turn off drop shadow
  // alignItems: 'center',
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

// // workaround for https://github.com/react-navigation/react-navigation/issues/4872 else android will eat clicks
// const headerMode = Styles.isAndroid ? 'screen' : 'float'

// const tabs = Styles.isTablet ? Shared.tabletTabs : Shared.phoneTabs

type TabData = {
  icon: IconType
  label: string
}
const tabToData: {[key: string]: TabData} = {
  [Tabs.chatTab]: {icon: 'iconfont-nav-2-chat', label: 'Chat'},
  [Tabs.fsTab]: {icon: 'iconfont-nav-2-files', label: 'Files'},
  [Tabs.teamsTab]: {icon: 'iconfont-nav-2-teams', label: 'Teams'},
  [Tabs.peopleTab]: {icon: 'iconfont-nav-2-people', label: 'People'},
  [Tabs.settingsTab]: {icon: 'iconfont-nav-2-hamburger', label: 'More'},
  [Tabs.walletsTab]: {icon: 'iconfont-nav-2-wallets', label: 'Wallet'},
}

const FilesTabBadge = () => {
  const uploadIcon = FsConstants.getUploadIconForFilesTab(Container.useSelector(state => state.fs.badge))
  return uploadIcon ? <Kbfs.UploadIcon uploadIcon={uploadIcon} style={styles.fsBadgeIconUpload} /> : null
}

const TabBarIcon = props => {
  const {isFocused, routeName} = props
  const onSettings = routeName === Tabs.settingsTab
  const navBadges = Container.useSelector(state => state.notifications.navBadges)
  const pushHasPermissions = Container.useSelector(state => state.push.hasPermissions)
  const badgeNumber = (onSettings ? settingsTabChildren : [routeName]).reduce(
    (res, tab) => res + (navBadges.get(tab) || 0),
    // notifications gets badged on native if there's no push, special case
    onSettings && !pushHasPermissions ? 1 : 0
  )
  return tabToData[routeName] ? (
    <Kb.NativeView style={tabStyles.container}>
      <Kb.Icon
        type={tabToData[routeName].icon}
        fontSize={32}
        style={tabStyles.tab}
        color={isFocused ? Styles.globalColors.whiteOrWhite : Styles.globalColors.blueDarkerOrBlack}
      />
      {!!badgeNumber && <Kb.Badge badgeNumber={badgeNumber} badgeStyle={tabStyles.badge} />}
      {routeName === Tabs.fsTab && <FilesTabBadge />}
    </Kb.NativeView>
  ) : null
}

const settingsTabChildrenPhone: Array<Tabs.Tab> = [
  Tabs.gitTab,
  Tabs.devicesTab,
  Tabs.walletsTab,
  Tabs.settingsTab,
]
const settingsTabChildrenTablet: Array<Tabs.Tab> = [Tabs.gitTab, Tabs.devicesTab, Tabs.settingsTab]
const settingsTabChildren = Container.isPhone ? settingsTabChildrenPhone : settingsTabChildrenTablet

// TODO
// const TabBarPeopleIconContainer = props => {
// const {onPress} = props
// const dispatch = Container.useDispatch()
// const accountRows = Container.useSelector(state => state.config.configuredAccounts)
// const current = Container.useSelector(state => state.config.username)
// const onQuickSwitch = React.useCallback(() => {
// const row = accountRows.find(a => a.username !== current && a.hasStoredSecret)
// if (row) {
// dispatch(ConfigGen.createSetUserSwitching({userSwitching: true}))
// dispatch(LoginGen.createLogin({password: new HiddenString(''), username: row.username}))
// } else {
// onPress()
// }
// }, [accountRows, dispatch, current, onPress])
// return (
// <Kb.NativeTouchableWithoutFeedback
// style={props.style}
// onPress={props.onPress}
// onLongPress={onQuickSwitch}
// >
// <Kb.Box children={props.children} style={props.style} />
// </Kb.NativeTouchableWithoutFeedback>
// )
// }

// // globalColors automatically respects dark mode pref
// const getBg = () => Styles.globalColors.white

// const BlankScreen = () => null

// const VanillaTabNavigator = createBottomTabNavigator(
// tabs.reduce(
// (map, tab) => {
// const Stack = createStackNavigator(Shim.shim(routes), {
// bgOnlyDuringTransition: Styles.isAndroid ? getBg : undefined,
// cardStyle: Styles.isAndroid ? {backgroundColor: 'rgba(0,0,0,0)'} : undefined,
// defaultNavigationOptions,
// headerMode,
// initialRouteKey: tabRoots[tab],
// initialRouteName: tabRoots[tab],
// initialRouteParams: undefined,
// transitionConfig: () => ({
// containerStyle: {
// get backgroundColor() {
// return Styles.globalColors.white
// },
// },
// transitionSpec: {
// // the 'accurate' ios one is very slow to stop so going back leads to a missed taps
// duration: 250,
// easing: Kb.NativeEasing.bezier(0.2833, 0.99, 0.31833, 0.99),
// timing: Kb.NativeAnimated.timing,
// },
// }),
// })
// class CustomStackNavigator extends React.Component<any> {
// static router = {
// ...Stack.router,
// getStateForAction: (action, lastState) => {
// // disallow dupe pushes or replaces. We have logic for this in oldActionToNewActions but it can be
// // racy, this should work no matter what as this is effectively the reducer for the state
// const nextState = Stack.router.getStateForAction(action, lastState)

// const visiblePath = Constants._getStackPathHelper([], nextState)
// const last = visiblePath?.[visiblePath.length - 1]
// const nextLast = visiblePath?.[visiblePath.length - 2]

// // last two are dupes?
// if (last?.routeName === nextLast?.routeName && shallowEqual(last?.params, nextLast?.params)) {
// // just pop it
// return Stack.router.getStateForAction(StackActions.pop({}), nextState)
// }

// return nextState
// },
// }

// render() {
// const {navigation} = this.props
// return <Stack navigation={navigation} />
// }
// }
// map[tab] = CustomStackNavigator
// return map
// },
// // Start with a blank screen w/o a tab icon so we dont' render the people tab on start always
// {blank: {screen: BlankScreen}}
// ),
// {
// backBehavior: 'none',
// defaultNavigationOptions: ({navigation}) => {
// const routeName = navigation.state.index && navigation.state.routes[navigation.state.index].routeName
// const tabBarVisible = routeName !== 'chatConversation'

// return {
// tabBarButtonComponent:
// navigation.state.routeName === 'blank'
// ? BlankScreen
// : navigation.state.routeName === Tabs.peopleTab
// ? TabBarPeopleIconContainer
// : TabBarIconContainer,
// tabBarIcon: ({focused}) => (
// <ConnectedTabBarIcon focused={focused} routeName={navigation.state.routeName as Tabs.Tab} />
// ),
// tabBarLabel: ({focused}) =>
// navigation.state.routeName === 'blank' ? (
// <></>
// ) : (
// <Kb.Text
// style={Styles.collapseStyles([
// tabStyles.label,
// Styles.isDarkMode()
// ? focused
// ? tabStyles.labelDarkModeFocused
// : tabStyles.labelDarkMode
// : focused
// ? tabStyles.labelLightModeFocused
// : tabStyles.labelLightMode,
// ])}
// type="BodyBig"
// >
// {data[navigation.state.routeName].label}
// </Kb.Text>
// ),
// tabBarVisible,
// }
// },
// order: ['blank', ...tabs],
// tabBarOptions: {
// get activeBackgroundColor() {
// return Styles.globalColors.blueDarkOrGreyDarkest
// },
// get inactiveBackgroundColor() {
// return Styles.globalColors.blueDarkOrGreyDarkest
// },
// // else keyboard avoiding is racy on ios and won't work correctly
// keyboardHidesTabBar: Styles.isAndroid,
// labelPosition: Styles.isTablet ? 'beside-icon' : undefined,
// showLabel: Styles.isTablet,
// get style() {
// return {backgroundColor: Styles.globalColors.blueDarkOrGreyDarkest}
// },
// },
// }
// )

// class UnconnectedTabNavigator extends React.PureComponent<any> {
// static router = VanillaTabNavigator.router
// render() {
// const {navigation, isDarkMode, renderDebug} = this.props
// const key = `${isDarkMode ? 'dark' : 'light'}: ${renderDebug ? 'd' : ''}`
// return <VanillaTabNavigator navigation={navigation} key={key} />
// }
// }

// const TabNavigator = Container.connect(
// () => ({isDarkMode: Styles.isDarkMode(), renderDebug: getRenderDebug()}),
// undefined,
// (s, _, o: any) => ({
// ...s,
// ...o,
// })
// )(UnconnectedTabNavigator)

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

// const LoggedInStackNavigator = createStackNavigator()
// {
// Main: TabNavigator,
// ...Shim.shim(modalRoutes),
// },
// {
// bgOnlyDuringTransition: Styles.isAndroid ? getBg : undefined,
// cardStyle: Styles.isAndroid ? {backgroundColor: 'rgba(0,0,0,0)'} : undefined,
// headerMode: 'none',
// initialRouteKey: 'Main',
// initialRouteName: 'Main',
// mode: 'modal',
// }
// )

// const LoggedOutStackNavigator = createStackNavigator(
// {...Shim.shim(loggedOutRoutes)},
// {
// defaultNavigationOptions: {
// ...defaultNavigationOptions,
// // show the header
// header: undefined,
// },
// headerMode,
// initialRouteName: 'login',
// initialRouteParams: undefined,
// }
// )

const SimpleLoading = React.memo(() => {
  console.log('bbb simle loading render')
  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={{
        backgroundColor: Styles.globalColors.white,
        // backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
      }}
    >
      <Loading allowFeedback={false} failed="" status="" onRetry={null} onFeedback={null} />
    </Kb.Box2>
  )
})

// const Stack = createStackNavigator();

// // const RootStackNavigator = createSwitchNavigator(
// // {
// // loading: {screen: SimpleLoading},
// // loggedIn: LoggedInStackNavigator,
// // loggedOut: LoggedOutStackNavigator,
// // },
// // {initialRouteName: 'loading'}
// // )

// // const AppContainer = createAppContainer(RootStackNavigator)

// class RNApp extends React.PureComponent<Props> {
// private nav: any = null

// dispatchOldAction = (old: any) => {
// const nav = this.nav
// if (!nav) {
// throw new Error('Missing nav?')
// }

// const actions = Shared.oldActionToNewActions(old, this.getNavState()) || []
// try {
// actions.forEach(a => nav.dispatch(a))
// } catch (e) {
// logger.error('Nav error', e)
// }
// }

// dispatch = (a: any) => {
// const nav = this.nav
// if (!nav) {
// throw new Error('Missing nav?')
// }
// nav.dispatch(a)
// }

// getNavState = () => {
// const n = this.nav
// // try the local internal state first, this should be synchronously correct
// if (n._navState) {
// return n._navState
// }
// // else fallback to the react state version
// return (n && n.state && n.state.nav) || null
// }

// private setNav = (n: any) => {
// this.nav = n
// this.props.updateNavigator(n && this)
// }

// private onNavigationStateChange = (prevNav: any, nav: any, action: any) => {
// // RN emits this extra action type which we ignore from a redux perspective
// if (action.type !== 'Navigation/COMPLETE_TRANSITION') {
// this.props.onNavigationStateChange(prevNav, nav, action)
// }
// }

// // hmr messes up startup, so only set this after its rendered once
// // private hmrProps = () => {
// // if (this.nav) {
// // return getPersistenceFunctions()
// // } else {
// // return {}
// // }
// // }

// render() {
// return (
// <NavigationContainer ref={this.setNav} onStateChange={this.onNavigationStateChange}>
// <RootStackNavigator  />
// </NavigationContainer>
// )
// }
// }

const styles = Styles.styleSheetCreate(() => ({
  fsBadgeIconUpload: {
    bottom: Styles.globalMargins.tiny,
    height: Styles.globalMargins.small,
    position: 'absolute',
    right: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
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
const tabs = [/*'blank', */ ...(Styles.isTablet ? Shared.tabletTabs : Shared.phoneTabs)]

// const {routesMinusChatConvo, noTabRoutes} = Object.keys(routes).reduce(
// (m, k) => {
// if (k === 'chatConversation') {
// m.noTabRoutes[k] = routes[k]
// } else {
// m.routesMinusChatConvo[k] = routes[k]
// }
// return m
// },
// {routesMinusChatConvo: {}, noTabRoutes: {}}
// )

// so we have a stack per tab?
const tabToStack = new Map()
const makeTabStack = tab => {
  let Comp = tabToStack.get(tab)
  if (!Comp) {
    const S = createStackNavigator()
    Comp = ({navigation, route}) => {
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
          }}
        >
          {makeNavScreens(Shim.shim(routes, false), S.Screen, false)}
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

// const isBlank = name => name === 'blank'
// const BlankComponent = () => null

const ShowMonsterSelector = (state: Container.TypedState) =>
  state.config.loggedIn && !state.push.justSignedUp && state.push.showPushPrompt && !state.push.hasPermissions

const AppTabs = () => {
  // let startupTab = Container.useSelector(state => state.config.startupTab)
  // const showMonster = Container.useSelector(ShowMonsterSelector)
  // const startupFollowUser = Container.useSelector(state => state.config.startupFollowUser)

  // if (showMonster || startupFollowUser) {
  // startupTab = Tabs.peopleTab
  // }

  console.log('aaa appTab rendering') //, {startupTab})

  // const initedOnce = React.useRef(false)
  // React.useEffect(() => {
  // if (initedOnce.current || !loggedInLoaded) {
  // return
  // }
  // }, [initedOnce.current, loggedInLoaded])
  // initialRouteName={startupTab}
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
          // tabBarButton: isBlank(route.name) ? () => null : undefined,
        }
      }}
    >
      {tabs.map(tab => (
        // isBlank(tab) ? (
        // <Tab.Screen key={tab} name={tab} component={BlankComponent} />
        /*) :*/ <Tab.Screen key={tab} name={tab} getComponent={() => makeTabStack(tab)} />
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

const ConnectNavToRedux = () => {
  console.log('bbb ConnectNavToRedux rendering ')
  const dispatch = Container.useDispatch()
  const setNavOnce = React.useRef(false)
  React.useEffect(() => {
    console.log('bbb ConnectNavToRedux useeffect ', setNavOnce.current)
    if (!setNavOnce.current) {
      if (Constants.navigationRef_.isReady()) {
        setNavOnce.current = true
        dispatch(ConfigGen.createSetNavigator({navigator}))

        if (__DEV__) {
          window.DEBUGNavigator = Constants.navigationRef_.current
          window.DEBUGRouter2 = Constants
          console.log('aaaa debug nav', Constants.navigationRef_.current)
        }
      }
    }
  }, [setNavOnce])
  return null
}

// routing we do on first load
// could possibly move this back into saga land but maybe best to keep this here since its so special
// const InitialRouteSubNav = props => {
// const {initialRouting, onRouted} = props
// console.log('bbb rendering InitialRouteSubNav ')
// const showMonster = Container.useSelector(ShowMonsterSelector)
// const dispatch = Container.useDispatch()
// const startupFollowUser = Container.useSelector(state => state.config.startupFollowUser)
// const startupConversation = Container.useSelector(state => {
// const {startupConversation} = state.config
// return ChatConstants.isValidConversationIDKey(startupConversation) &&
// state.config.startupTab === Tabs.chatTab
// ? startupConversation
// : undefined
// })

// const startupLink = Container.useSelector(state => state.config.startupLink)

// // Load any subscreens we need, couldn't find a great way to do this
// React.useEffect(() => {
// onRouted()
// if (showMonster) {
// Constants.navigationRef_.dispatch(CommonActions.navigate({name: 'settingsPushPrompt'}))
// } else if (startupConversation) {
// return // TEMP
// // will already be on the chat tab
// // Constants.navigationRef_.dispatch(state => {
// // console.log('bbb startup convo', state)
// // return CommonActions.reset(
// // Container.produce(state, draft => {
// // draft.index = 1
// // draft.routes.push({
// // name: 'chatConversation',
// // params: {conversationIDKey: startupConversation, animationEnabled: false},
// // })
// // })
// // )
// // })
// } else if (startupFollowUser) {
// // will already be on people tab
// Constants.navigationRef_.dispatch(
// CommonActions.navigate({
// name: 'profile',
// params: {username: startupFollowUser, animationEnabled: false},
// })
// )
// } else if (startupLink) {
// dispatch(DeeplinksGen.createLink({link: startupLink}))
// // try {
// // if (
// // ['keybase://private/', 'keybase://public/', 'keybase://team/'].some(prefix =>
// // startupLink.startsWith(prefix)
// // )
// // ) {
// // const path = `/keybase/${decodeURIComponent(startupLink.substr('keybase://'.length))}`
// // Constants.navigationRef_.dispatch(
// // CommonActions.navigate({
// // name: 'fsRoot',
// // params: {animationEnabled: false, path},
// // })
// // )
// // } else {
// }
// })

// return null
// }

const RootStack = createStackNavigator()

enum RNAppState {
  UNINIT, // haven't rendered the nav yet
  NEEDS_INIT, // rendered but need to bootstrap
  INITED, // regular app now
}

const theme = {
  dark: false,
  colors: {
    get primary() {
      return 'blue' // Styles.globalColors.fastBlank
    },
    get background() {
      return 'green' // Styles.globalColors.fastBlank
    },
    get card() {
      return 'red' // Styles.globalColors.white
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

const makeLinking = options => {
  let {startupTab, showMonster, startupFollowUser, startupConversation} = options
  // TEMP
  // startupConversation = '00009798d7df6d682254f9b9cce9a0ad481d8699f5835809dd0d56b8fab032e5' // TEMP
  // startupConversation = ''
  // startupTab = Tabs.chatTab
  // showMonster = true
  // TEMP
  //
  // let startupTab = Container.useSelector(state => state.config.startupTab)
  // const showMonster = Container.useSelector(ShowMonsterSelector)
  // const startupFollowUser = Container.useSelector(state => state.config.startupFollowUser)

  if (showMonster || startupFollowUser) {
    startupTab = Tabs.peopleTab
  }

  return {
    prefixes: ['keybase://', 'https://keybase.io'],

    // Custom function to get the URL which was used to open the app
    async getInitialURL() {
      // First, you may want to do the default deep link handling
      // Check if app was opened from a deep link
      const url = await Kb.NativeLinking.getInitialURL()

      console.log('bbbb linking get initial', {url})

      if (url != null) {
        return url
      }

      console.log('bbbb linking get initial startuptab', {
        startupTab,
        showMonster,
        startupFollowUser,
        startupConversation,
      })

      if (showMonster) {
        return 'keybase://settingsPushPrompt'
        // Constants.navigationRef_.dispatch(CommonActions.navigate({name: 'settingsPushPrompt'}))
      } else if (startupConversation) {
        // return `keybase://loggedIn/${startupTab}/chatRoot/chatConversation?conversationIDKey=${startupConversation}`
        // debugger
        return `keybase://chat?conversationIDKey=${startupConversation}`
        // TODO support actual existing chat links
        //keybase://chat/${conv}/${messageID}`
      }
      return `keybase://${startupTab ?? ''}`
    },

    // Custom function to subscribe to incoming links
    subscribe(listener) {
      // Listen to incoming links from deep linking
      const unsub = Kb.NativeLinking.addEventListener('url', ({url}: {url: string}) => listener(url))
      return () => {
        unsub.remove()
      }
    },

    config: {
      initialRouteName: 'loggedIn',
      screens: {
        initialRouteName: 'loggedIn',
        loggedIn: {
          screens: {
            ...tabs.reduce((m, name) => {
              m[name] = name
              return m
            }, {}),
            [Tabs.chatTab]: {
              initialRouteName: 'chatRoot',
              screens: {
                chatConversation: 'chat',
                chatRoot: Tabs.chatTab,
              },
            },
          },
        },
        settingsPushPrompt: 'settingsPushPrompt',
      },
    },
    // getStateFromPath: (path, options) => {
    // let def = getStateFromPath(path, options)
    // if (path === 'settingsPushPrompt') {
    // def = Container.produce(def, draft => {
    // draft.index = 1
    // draft.unshift({name: 'loggedIn'})
    // })
    // }
    // return def
    // // Return a state object here
    // // You can also reuse the default logic by importing `getStateFromPath` from `@react-navigation/native`
    // },
  }
}

const RNApp = props => {
  // We use useRef and usePrevious so we can understand how our state has changed and do the right thing
  // if we use useEffect and useState we'll have to deal with extra renders which look really bad
  const loggedInLoaded = Container.useSelector(state => state.config.daemonHandshakeState === 'done')
  const loggedIn = Container.useSelector(state => state.config.loggedIn)
  const dispatch = Container.useDispatch()
  const startupTab = Container.useSelector(state => state.config.startupTab)
  const startupConversation = Container.useSelector(state => {
    const {startupConversation} = state.config
    return ChatConstants.isValidConversationIDKey(startupConversation) &&
      state.config.startupTab === Tabs.chatTab
      ? startupConversation
      : undefined
  })
  const showMonster = Container.useSelector(ShowMonsterSelector)
  const startupFollowUser = Container.useSelector(state => state.config.startupFollowUser)
  const isDarkMode = Container.useSelector(state => ConfigConstants.isDarkMode(state.config))
  const navContainerKey = React.useRef(1)
  const oldNavPath = React.useRef<any>([])
  // keep track if we went to an init route yet or not
  const rnappState = React.useRef(loggedInLoaded ? RNAppState.NEEDS_INIT : RNAppState.UNINIT)

  if (rnappState.current === RNAppState.UNINIT && loggedInLoaded) {
    rnappState.current = RNAppState.NEEDS_INIT
  }

  const darkChanged = Container.usePrevious(isDarkMode) !== isDarkMode
  if (darkChanged) {
    navContainerKey.current++
  }
  // we only send certain params to the container depending on the state so we can remount w/ the right data
  // instead of using useEffect and flashing all the time
  // we use linking and force a key change if we're in NEEDS_INIT
  // while inited we cna use initialStateRef when dark mode changes, we never want both at the same time
  const goodLinking =
    rnappState.current === RNAppState.NEEDS_INIT
      ? makeLinking({
          startupConversation,
          startupTab,
          showMonster,
          startupFollowUser,
        })
      : undefined
  const goodKey = rnappState.current === RNAppState.NEEDS_INIT ? -1 : navContainerKey.current

  const goodInitialState = darkChanged
    ? Constants.navigationRef_?.isReady()
      ? Constants.navigationRef_?.getRootState()
      : undefined
    : undefined

  console.log('bbb RNApp render', {
    rnappState: rnappState.current,
    goodLinking,
    goodKey,
    goodInitialState,
    darkChanged,
    loggedIn,
    loggedInLoaded,
  })

  // if we handled NEEDS_INIT we're done
  if (rnappState.current === RNAppState.NEEDS_INIT) {
    rnappState.current = RNAppState.INITED
  }

  const onStateChange = () => {
    const old = oldNavPath.current
    const vp = Constants.getVisiblePath()
    console.log('bbb onstatechnaged', vp)
    dispatch(
      RouteTreeGen.createOnNavChanged({
        navAction: undefined,
        next: vp,
        prev: old,
      })
    )
    oldNavPath.current = vp
  }

  // send onNavChanged on initial render after handling linking
  React.useEffect(() => {
    if (goodLinking) {
      console.log('bbb use effect good linking onstatechange')
      setTimeout(() => onStateChange(), 1)
    }
  }, [goodLinking])
  return (
    <Kb.KeyboardAvoidingView style={styles.keyboard} behavior={Styles.isIOS ? 'padding' : undefined}>
      <NavigationContainer
        fallback={<Kb.NativeView style={{backgroundColor: Styles.globalColors.white, flex: 1}} />}
        linking={goodLinking}
        ref={Constants.navigationRef_}
        key={String(goodKey)}
        theme={theme}
        initialState={goodInitialState}
        onStateChange={onStateChange}
      >
        <RootStack.Navigator
          key="root"
          initialRouteName={loggedIn ? 'loggedIn' : 'loggedOut' /* in case linking fails */}
          screenOptions={{
            animationEnabled: false,
            presentation: 'modal',
            headerLeft: HeaderLeftCancel,
            title: '',
            headerShown: false, // eventually do this after we pull apart modal2 etc
          }}
        >
          <RootStack.Screen key="loading" name="loading" component={SimpleLoading} />
          {loggedInLoaded && loggedIn && (
            <>
              <RootStack.Screen name="loggedIn" component={AppTabs} />
              {makeNavScreens(Shim.shim(modalRoutes, true), RootStack.Screen, true)}
            </>
          )}
          {loggedInLoaded && !loggedIn && <RootStack.Screen name="loggedOut" component={LoggedOut} />}
        </RootStack.Navigator>
      </NavigationContainer>
      <ConnectNavToRedux />
      {
        // loaded and only once and onStateChange called
        /*loggedInLoaded && loggedIn && rnappState === RNAppState.NEEDS_INIT && (
          <InitialRouteSubNav onRouted={() => setRNAppState(RNAppState.INITED)} />
          )*/
      }
    </Kb.KeyboardAvoidingView>
  )
}
export default RNApp
