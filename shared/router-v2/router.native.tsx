import * as Constants from '../constants/router2'
import * as ChatConstants from '../constants/chat2'
import * as Kbfs from '../fs/common'
import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Shim from './shim.native'
import {createStackNavigator} from '@react-navigation/stack'
import * as Styles from '../styles'
import * as Tabs from '../constants/tabs'
import * as FsConstants from '../constants/fs'
import * as Container from '../util/container'
import {IconType} from '../common-adapters/icon.constants-gen'
import {HeaderLeftArrow, HeaderLeftCancel} from '../common-adapters/header-hoc'
import {NavigationContainer, getFocusedRouteNameFromRoute} from '@react-navigation/native'
import {TransitionPresets} from '@react-navigation/stack'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import {enableFreeze} from 'react-native-screens'
import Loading from '../login/loading'
import * as ConfigGen from '../actions/config-gen'
import * as ConfigConstants from '../constants/config'
import * as RouteTreeGen from '../actions/route-tree-gen'
// import * as DeeplinksGen from '../actions/deeplinks-gen'
import {isValidLink} from '../constants/deeplinks'

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
const tabs = [...(Styles.isTablet ? Shared.tabletTabs : Shared.phoneTabs)]

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

const ShowMonsterSelector = (state: Container.TypedState) =>
  state.config.loggedIn && !state.push.justSignedUp && state.push.showPushPrompt && !state.push.hasPermissions

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
      {tabs.map(tab => (
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

const useConnectNavToRedux = () => {
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
}

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

enum RNAppState {
  UNINIT, // haven't rendered the nav yet
  NEEDS_INIT, // rendered but need to bootstrap
  INITED, // regular app now
}

const theme = {
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

const makeLinking = options => {
  let {startupTab, showMonster, startupFollowUser, startupConversation} = options

  if (__DEV__) {
    console.log('aaa DEBUG force routes')
    const temp = ''
    switch (temp) {
      case 'follow':
        startupConversation = ''
        startupFollowUser = 'chrisnojima'
        break
      case 'convo':
        startupConversation = '00009798d7df6d682254f9b9cce9a0ad481d8699f5835809dd0d56b8fab032e5' // TEMP
        break
      case 'tab':
        startupConversation = ''
        startupTab = Tabs.fsTab
        break
      case 'monster':
        startupConversation = ''
        showMonster = true
        break
    }
  }

  const config = Container.produce(
    {
      initialRouteName: 'loggedIn',
      screens: {
        initialRouteName: 'loggedIn',
        loggedIn: {
          screens: {
            ...tabs.reduce((m, name) => {
              // m[name] = name
              m[name] = {
                initialRouteName: tabRoots[name],
                screens: {
                  [tabRoots[name]]: name,
                },
              }
              return m
            }, {}),
          },
        },
        settingsPushPrompt: 'settingsPushPrompt',
      },
    },
    draft => {
      const {screens} = draft.screens.loggedIn
      screens[Tabs.chatTab].screens.chatConversation = 'chat'
      screens[Tabs.peopleTab].screens.profile = 'profile/show/:username'
    }
  )

  return {
    prefixes: ['keybase://', 'https://keybase.io'],

    // Custom function to get the URL which was used to open the app
    async getInitialURL() {
      // First, you may want to do the default deep link handling
      // Check if app was opened from a deep link
      let url = await Kb.NativeLinking.getInitialURL()

      console.log('bbbb linking get initial', {url})

      if (url != null && isValidLink(url)) {
        return url
      }

      if (showMonster) {
        url = 'keybase://settingsPushPrompt'
      } else if (startupConversation) {
        url = `keybase://chat?conversationIDKey=${startupConversation}`
        // TODO support actual existing chat links
        //keybase://chat/${conv}/${messageID}`
      } else if (startupFollowUser) {
        url = `keybase://profile/show/${startupFollowUser}`
      } else {
        url = `keybase://${startupTab ?? ''}`
      }
      console.log('bbbb linking get initial startuptab', {
        url,
        startupTab,
        showMonster,
        startupFollowUser,
        startupConversation,
      })
      return url
    },
    config,
  }
}

// gets state from redux used to make the linking object
const useReduxToLinking = (appState: RNAppState) => {
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

  return appState === RNAppState.NEEDS_INIT
    ? makeLinking({
        startupConversation,
        startupTab,
        showMonster,
        startupFollowUser,
      })
    : undefined
}

const useIsDarkChanged = () => {
  const isDarkMode = Container.useSelector(state => ConfigConstants.isDarkMode(state.config))
  const darkChanged = Container.usePrevious(isDarkMode) !== isDarkMode
  return darkChanged
}

const useNavKey = (appState: RNAppState, key: React.MutableRefObject<number>) => {
  const darkChanged = useIsDarkChanged()
  if (darkChanged) {
    key.current++
  }

  return appState === RNAppState.NEEDS_INIT ? -1 : key.current
}

const useInitialState = () => {
  const darkChanged = useIsDarkChanged()
  return darkChanged
    ? Constants.navigationRef_?.isReady()
      ? Constants.navigationRef_?.getRootState()
      : undefined
    : undefined
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
const RNApp = props => {
  // We use useRef and usePrevious so we can understand how our state has changed and do the right thing
  // if we use useEffect and useState we'll have to deal with extra renders which look really bad
  const loggedInLoaded = Container.useSelector(state => state.config.daemonHandshakeState === 'done')
  const loggedIn = Container.useSelector(state => state.config.loggedIn)
  const dispatch = Container.useDispatch()

  const navContainerKey = React.useRef(1)
  const oldNavPath = React.useRef<any>([])
  // keep track if we went to an init route yet or not
  const rnappState = React.useRef(loggedInLoaded ? RNAppState.NEEDS_INIT : RNAppState.UNINIT)

  if (rnappState.current === RNAppState.UNINIT && loggedInLoaded) {
    rnappState.current = RNAppState.NEEDS_INIT
  }
  useConnectNavToRedux()
  const goodLinking = useReduxToLinking(rnappState.current)
  // we only send certain params to the container depending on the state so we can remount w/ the right data
  // instead of using useEffect and flashing all the time
  // we use linking and force a key change if we're in NEEDS_INIT
  // while inited we cna use initialStateRef when dark mode changes, we never want both at the same time
  const goodKey = useNavKey(rnappState.current, navContainerKey)
  const goodInitialState = useInitialState()

  console.log('bbb RNApp render', {
    rnappState: rnappState.current,
    goodLinking,
    goodKey,
    goodInitialState,
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

  useInitialStateChangeAfterLinking(goodLinking, onStateChange)

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
    </Kb.KeyboardAvoidingView>
  )
}
export default RNApp
