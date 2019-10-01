import * as Constants from '../constants/router2'
import * as Container from '../util/container'
import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Shared from './router.shared'
import * as Shim from './shim.native'
import * as Stack from 'react-navigation-stack'
import * as Styles from '../styles'
import * as Tabs from '../constants/tabs'
import GlobalError from '../app/global-errors/container'
import OutOfDate from '../app/out-of-date'
import RuntimeStats from '../app/runtime-stats/container'
import logger from '../logger'
import {IconType} from '../common-adapters/icon.constants-gen'
import {LeftAction} from '../common-adapters/header-hoc'
import {Props} from './router'
import {connect} from '../util/container'
import {createAppContainer} from '@react-navigation/native'
import {createBottomTabNavigator} from 'react-navigation-tabs'
import {createSwitchNavigator, StackActions} from '@react-navigation/core'
import {debounce} from 'lodash-es'
import {modalRoutes, routes, loggedOutRoutes, tabRoots} from './routes'
import {useScreens} from 'react-native-screens'

const {createStackNavigator} = Stack

// turn on screens. lint thinks this is a hook, but its not
// eslint-disable-next-line
useScreens()

// Options used by default on all navigators
// For info on what is passed to what see here: https://github.com/react-navigation/stack/blob/478c354248f2aedfc304a1c4b479c3df359d3868/src/views/Header/Header.js
const defaultNavigationOptions: any = {
  backBehavior: 'none',
  header: null,
  headerLeft: hp =>
    hp.scene.index === 0 ? null : (
      <LeftAction
        badgeNumber={0}
        leftAction="back"
        onLeftAction={hp.onPress} // react navigation makes sure this onPress can only happen once
        customIconColor={hp.tintColor}
      />
    ),
  headerStyle: {
    get backgroundColor() {
      return Styles.globalColors.fastBlank
    },
    get borderBottomColor() {
      return Styles.globalColors.black_10
    },
    borderBottomWidth: 1,
    borderStyle: 'solid',
    elevation: undefined, // since we use screen on android turn off drop shadow
  },
  headerTitle: hp => (
    <Kb.Text type="BodyBig" style={styles.headerTitle} lineClamp={1}>
      {hp.children}
    </Kb.Text>
  ),
}
// workaround for https://github.com/react-navigation/react-navigation/issues/4872 else android will eat clicks
const headerMode = Styles.isAndroid ? 'screen' : 'float'

const tabs = Shared.mobileTabs
const icons: {[key: string]: IconType} = {
  [Tabs.chatTab]: 'iconfont-nav-2-chat',
  [Tabs.fsTab]: 'iconfont-nav-2-files',
  [Tabs.teamsTab]: 'iconfont-nav-2-teams',
  [Tabs.peopleTab]: 'iconfont-nav-2-people',
  [Tabs.settingsTab]: 'iconfont-nav-2-hamburger',
  [Tabs.walletsTab]: 'iconfont-nav-2-wallets',
}

const TabBarIcon = ({badgeNumber, focused, routeName}) => (
  <Kb.NativeView style={tabStyles.container}>
    <Kb.Icon
      type={icons[routeName]}
      fontSize={32}
      style={tabStyles.tab}
      color={focused ? Styles.globalColors.whiteOrWhite : Styles.globalColors.blueDarkerOrBlack_60}
    />
    {!!badgeNumber && <Kb.Badge badgeNumber={badgeNumber} badgeStyle={tabStyles.badge} />}
  </Kb.NativeView>
)

const settingsTabChildren: Array<Tabs.Tab> = [Tabs.gitTab, Tabs.devicesTab, Tabs.walletsTab, Tabs.settingsTab]

type OwnProps = {focused: boolean; routeName: Tabs.Tab}
const ConnectedTabBarIcon = connect(
  (state, {routeName}: OwnProps) => {
    const onSettings = routeName === Tabs.settingsTab
    const badgeNumber = (onSettings ? settingsTabChildren : [routeName]).reduce(
      (res, tab) => res + (state.notifications.navBadges.get(tab) || 0),
      // notifications gets badged on native if there's no push, special case
      onSettings && !state.push.hasPermissions ? 1 : 0
    )
    return {badgeNumber}
  },
  () => ({}),
  (s, _, o: OwnProps) => ({
    badgeNumber: s.badgeNumber,
    focused: o.focused,
    routeName: o.routeName,
  })
)(TabBarIcon)

// The default container has some `hitSlop` set which messes up the clickable
// area
const TabBarIconContainer = props => (
  <Kb.NativeTouchableWithoutFeedback style={props.style} onPress={props.onPress}>
    <Kb.Box children={props.children} style={props.style} />
  </Kb.NativeTouchableWithoutFeedback>
)

const VanillaTabNavigator = createBottomTabNavigator(
  tabs.reduce((map, tab) => {
    map[tab] = createStackNavigator(Shim.shim(routes), {
      bgOnlyDuringTransition: Styles.isAndroid,
      cardStyle: Styles.isAndroid ? {backgroundColor: 'rgba(0,0,0,0)'} : undefined,
      defaultNavigationOptions,
      headerMode,
      initialRouteName: tabRoots[tab],
      initialRouteParams: undefined,
      transitionConfig: () => ({
        transitionSpec: {
          // the 'accurate' ios one is very slow to stop so going back leads to a missed taps
          duration: 250,
          easing: Kb.NativeEasing.bezier(0.2833, 0.99, 0.31833, 0.99),
          timing: Kb.NativeAnimated.timing,
        },
      }),
    })
    return map
  }, {}),
  {
    defaultNavigationOptions: ({navigation}) => ({
      tabBarButtonComponent: TabBarIconContainer,
      tabBarIcon: ({focused}) => (
        <ConnectedTabBarIcon focused={focused} routeName={navigation.state.routeName as Tabs.Tab} />
      ),
    }),
    order: tabs,
    tabBarOptions: {
      get activeBackgroundColor() {
        return Styles.globalColors.blueDarkOrGreyDarkest
      },
      get inactiveBackgroundColor() {
        return Styles.globalColors.blueDarkOrGreyDarkest
      },
      // else keyboard avoiding is racy on ios and won't work correctly
      keyboardHidesTabBar: Styles.isAndroid,
      showLabel: false,
      get style() {
        return {backgroundColor: Styles.globalColors.blueDarkOrGreyDarkest}
      },
    },
  }
)

class UnconnectedTabNavigator extends React.PureComponent<any> {
  static router = VanillaTabNavigator.router
  render() {
    const {navigation, isDarkMode} = this.props
    return <VanillaTabNavigator navigation={navigation} key={isDarkMode ? 'dark' : 'light'} />
  }
}

const TabNavigator = Container.connect(() => ({isDarkMode: Styles.isDarkMode()}), undefined, (s, _, o) => ({
  ...s,
  ...o,
}))(UnconnectedTabNavigator)

const tabStyles = Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        position: 'absolute',
        right: 8,
        top: 3,
      },
      container: {
        justifyContent: 'center',
      },
      tab: {
        paddingBottom: 6,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 6,
      },
    } as const)
)

const LoggedInStackNavigator = createStackNavigator(
  {
    Main: TabNavigator,
    ...Shim.shim(modalRoutes),
  },
  {
    bgOnlyDuringTransition: Styles.isAndroid,
    cardStyle: Styles.isAndroid ? {backgroundColor: 'rgba(0,0,0,0)'} : undefined,
    headerMode: 'none',
    mode: 'modal',
  }
)

const LoggedOutStackNavigator = createStackNavigator(
  {...Shim.shim(loggedOutRoutes)},
  {
    defaultNavigationOptions: {
      ...defaultNavigationOptions,
      // show the header
      header: undefined,
    },
    headerMode,
    initialRouteName: 'login',
    initialRouteParams: undefined,
  }
)

const RootStackNavigator = createSwitchNavigator(
  {
    loggedIn: LoggedInStackNavigator,
    loggedOut: LoggedOutStackNavigator,
  },
  {initialRouteName: 'loggedOut'}
)

const AppContainer = createAppContainer(RootStackNavigator)

class RNApp extends React.PureComponent<Props> {
  _nav: any = null
  // TODO remove this eventually, just so we can handle the old style actions
  dispatchOldAction = (old: any) => {
    const nav = this._nav
    if (!nav) {
      throw new Error('Missing nav?')
    }

    const actions = Shared.oldActionToNewActions(old, nav._navigation) || []
    try {
      actions.forEach(a => nav.dispatch(a))
    } catch (e) {
      logger.error('Nav error', e)
    }
  }

  dispatch = (a: any) => {
    const nav = this._nav
    if (!nav) {
      throw new Error('Missing nav?')
    }
    nav.dispatch(a)
  }

  // debounce this so we don't persist a route that can crash and then keep them in some crash loop
  _persistRoute = debounce(() => {
    this.props.persistRoute(Constants.getVisiblePath())
  }, 3000)

  _handleAndroidBack = () => {
    const nav = this._nav
    if (!nav) {
      return
    }
    const path = Constants.getVisiblePath()

    // We determine if we're at the root if we're at the root of our navigation hierarchy, which is slightly different if you're logged in or out
    if (path[0].routeName === 'loggedIn') {
      if (path[1].routeName === 'Main') {
        if (path.length === 3) {
          return false
        }
      }
    } else {
      if (path.length === 2) {
        return false
      }
    }
    nav.dispatch(StackActions.pop({}))
    return true
  }

  componentDidMount() {
    if (Styles.isAndroid) {
      Kb.NativeBackHandler.addEventListener('hardwareBackPress', this._handleAndroidBack)
    }
  }

  componentWillUnmount() {
    if (Styles.isAndroid) {
      Kb.NativeBackHandler.removeEventListener('hardwareBackPress', this._handleAndroidBack)
    }
  }

  getNavState = () => {
    const n = this._nav
    return (n && n.state && n.state.nav) || null
  }

  render() {
    return (
      <>
        <Kb.NativeStatusBar
          barStyle={Styles.isAndroid ? 'default' : this.props.isDarkMode ? 'light-content' : 'dark-content'}
        />
        <AppContainer ref={nav => (this._nav = nav)} onNavigationStateChange={this._persistRoute} />
        <GlobalError />
        <OutOfDate />
        <RuntimeStats />
      </>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  headerTitle: {color: Styles.globalColors.black},
  keyboard: {
    flexGrow: 1,
    position: 'relative',
  },
}))

export default RNApp
