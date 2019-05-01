// @flow
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import * as React from 'react'
import GlobalError from '../app/global-errors/container'
import {connect} from '../util/container'
import {createAppContainer} from '@react-navigation/native'
import {createSwitchNavigator, StackActions} from '@react-navigation/core'
import {createBottomTabNavigator} from 'react-navigation-tabs'
import {createStackNavigator} from 'react-navigation-stack'
import * as Tabs from '../constants/tabs'
import {modalRoutes, routes, loggedOutRoutes} from './routes'
import {LeftAction} from '../common-adapters/header-hoc'
import * as Constants from '../constants/router2'
import * as Shared from './router.shared'
import {useScreens} from 'react-native-screens'
import * as Shim from './shim.native'
import {debounce} from 'lodash-es'
import logger from '../logger'
import OutOfDate from '../app/out-of-date'

// turn on screens
useScreens()

// Options used by default on all navigators
// For info on what is passed to what see here: https://github.com/react-navigation/react-navigation-stack/blob/master/src/views/Header/Header.js
const defaultNavigationOptions = {
  backBehavior: 'none',
  header: null,
  headerLeft: hp => {
    return hp.scene.index === 0 ? null : (
      <LeftAction badgeNumber={0} leftAction="back" onLeftAction={hp.onPress} />
    )
  },
  headerTitle: hp => (
    <Kb.Text type="BodyBig" style={styles.headerTitle} lineClamp={1}>
      {hp.children}
    </Kb.Text>
  ),
}
const headerMode = 'float'

const tabs = Shared.mobileTabs
const tabRoots = Shared.tabRoots
const icons = {
  [Tabs.chatTab]: 'iconfont-nav-2-chat',
  [Tabs.fsTab]: 'iconfont-nav-2-files',
  [Tabs.teamsTab]: 'iconfont-nav-2-teams',
  [Tabs.peopleTab]: 'iconfont-nav-2-people',
  [Tabs.settingsTab]: 'iconfont-nav-2-more',
  [Tabs.walletsTab]: 'iconfont-nav-2-wallets',
}

const TabBarIcon = ({badgeNumber, focused, routeName}) => (
  <Kb.NativeView style={tabStyles.container}>
    <Kb.Icon
      type={icons[routeName]}
      fontSize={32}
      style={tabStyles.tab}
      color={focused ? Styles.globalColors.white : Styles.globalColors.darkBlue4}
    />
    {!!badgeNumber && <Kb.Badge badgeNumber={badgeNumber} badgeStyle={tabStyles.badge} />}
  </Kb.NativeView>
)

const ConnectedTabBarIcon = connect<{|focused: boolean, routeName: Tabs.Tab|}, _, _, _, _>(
  (state, {routeName}) => ({badgeNumber: state.notifications.navBadges.get(routeName)}),
  () => ({}),
  (s, _, o) => ({
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

const TabNavigator = createBottomTabNavigator(
  tabs.reduce((map, tab) => {
    map[tab] = createStackNavigator(Shim.shim(routes), {
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
        <ConnectedTabBarIcon focused={focused} routeName={navigation.state.routeName} />
      ),
    }),
    order: tabs,
    tabBarOptions: {
      activeBackgroundColor: Styles.globalColors.darkBlue2,
      inactiveBackgroundColor: Styles.globalColors.darkBlue2,
      // else keyboard avoiding is racy on ios and won't work correctly
      keyboardHidesTabBar: Styles.isAndroid,
      showLabel: false,
      style: {backgroundColor: Styles.globalColors.darkBlue2},
    },
  }
)

const tabStyles = Styles.styleSheetCreate({
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
})

const LoggedInStackNavigator = createStackNavigator(
  {
    Main: TabNavigator,
    ...Shim.shim(modalRoutes),
  },
  {
    headerMode: 'none',
    mode: 'modal',
  }
)

const LoggedOutStackNavigator = createStackNavigator(
  {...Shim.shim(loggedOutRoutes)},
  {
    defaultNavigationOptions,
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

class RNApp extends React.PureComponent<any, any> {
  _nav = null
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
    nav.dispatch(StackActions.pop())
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

  getNavState = () => this._nav?.state?.nav

  render() {
    return (
      <>
        <AppContainer ref={nav => (this._nav = nav)} onNavigationStateChange={this._persistRoute} />
        <GlobalError />
        <OutOfDate />
      </>
    )
  }
}

const styles = Styles.styleSheetCreate({
  headerTitle: {color: Styles.globalColors.black},
  keyboard: {
    flexGrow: 1,
    position: 'relative',
  },
})

export default RNApp
