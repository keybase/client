// @flow
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import * as React from 'react'
import GlobalError from '../app/global-errors/container'
import TabBar from './tab-bar/container'
import {createAppContainer} from '@react-navigation/native'
import {createSwitchNavigator, StackActions, NavigationActions} from '@react-navigation/core'
import {createBottomTabNavigator} from 'react-navigation-tabs'
import {createStackNavigator} from 'react-navigation-stack'
import {modalRoutes, routes, nameToTab, loggedOutRoutes} from './routes'
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
    return (
      <LeftAction
        badgeNumber={0}
        leftAction="back"
        onLeftAction={hp.onPress}
        disabled={hp.scene.index === 0}
      />
    )
  },
  headerTitle: hp => (
    <Kb.Text type="BodyBig" style={styles.headerTitle} lineClamp={1}>
      {hp.children}
    </Kb.Text>
  ),
}
const headerMode = 'float'

// Where the main app stuff happens. You're logged in and have a tab bar etc
// const MainStackNavigatorPlain = createStackNavigator(Shim.shim(routes), {
// defaultNavigationOptions,
// headerMode,
// initialRouteName: 'tabs.peopleTab',
// initialRouteParams: undefined,
// })
// class MainStackNavigator extends React.PureComponent<any> {
// static router = MainStackNavigatorPlain.router

// render() {
// const routeName = this.props.navigation.state.routes[this.props.navigation.state.index].routeName
// return (
// <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
// <MainStackNavigatorPlain navigation={this.props.navigation} />
// <TabBar selectedTab={nameToTab[routeName]} />
// <GlobalError />
// <OutOfDate />
// </Kb.Box2>
// )
// }
// }

const routesForTab = tab =>
  Object.keys(routes).reduce((map, name) => {
    if (nameToTab[name] === tab) {
      map[name] = routes[name]
    }
    return map
  }, {})

const PeopleStack = createStackNavigator(Shim.shim(routesForTab('tabs.peopleTab')), {
  defaultNavigationOptions,
  headerMode,
  initialRouteName: 'peopleRoot',
  initialRouteParams: undefined,
})
const ChatStack = createStackNavigator(Shim.shim(routesForTab('tabs.chatTab')), {
  defaultNavigationOptions,
  headerMode,
  initialRouteName: 'chatRoot',
  initialRouteParams: undefined,
})

const tabs = ['tabs.peopleTab', 'tabs.chatTab']

const TabNavigator = createBottomTabNavigator(
  {
    'tabs.chatTab': ChatStack,
    'tabs.peopleTab': PeopleStack,
  },
  {
    backBehavior: 'history',
    order: tabs,
  }
)

const LoggedInStackNavigator = createStackNavigator(
  {
    // Main: {screen: MainStackNavigator},
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

// we bookkeep which navigations actually resulted in a tab switch. if there is one we store the key so we can do an additional tab switch on a back action
const keyToRouteSwitch = {}
const originalRootRouter = RootStackNavigator.router
RootStackNavigator.router = {
  ...originalRootRouter,
  getStateForAction: (action, state) => {
    // console.log('aaa override router', action)
    const nextState = originalRootRouter.getStateForAction(action, state)

    // bookkeep navigate navigate only
    if (action.type === NavigationActions.NAVIGATE) {
      // ignore tab switches
      if (tabs.includes(action.routeName)) return nextState

      // making assumptions about the nesting of the routes to simplify this logic
      const rootState = state
      const loggedInState = rootState?.routes[rootState.index]
      // logged in
      if (loggedInState?.routeName !== 'loggedIn') return nextState

      const mainState = loggedInState?.routes[loggedInState.index]
      // main screens only
      if (mainState?.routeName !== 'Main') return nextState

      const oldTabState = mainState?.routes[mainState.index]

      // const oldTabState = state?.routes[0]?.routes[0]?.index
      const nextTabState = nextState?.routes[0]?.routes[0]?.routes[nextState?.routes[0]?.routes[0]?.index]

      if (oldTabState?.key === nextTabState?.key) return nextState
      const path = Constants._getVisiblePathForNavigator(nextState)
      if (!path.length) return nextState
      const last = path[path.length - 1]
      if (!last) return nextState

      keyToRouteSwitch[last.key] = oldTabState?.key
      console.log('aaa override navigate back store:', last.key, oldTabState?.key) // oldTabState, nextTabState, path, last.key, oldTabState?.key)
    } else if (action.type === NavigationActions.BACK) {
      // watch back
      const key = action.key
      // const path = Constants._getVisiblePathForNavigator(nextState)
      // if (!path.length) return nextState
      // const last = path[path.length - 1]
      // if (!last) return nextState
      const oldTab = keyToRouteSwitch[key]
      if (!oldTab) return nextState
      keyToRouteSwitch[key] = undefined

      console.log('aaa override tab back replace:')
      const nextStateWithTabSwitch = originalRootRouter.getStateForAction(
        NavigationActions.navigate({routeName: oldTab}),
        nextState
      )
      return nextStateWithTabSwitch
    }
    return nextState
  },
}

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
      console.log('aaa nav actions', actions)
      actions.forEach(a => {
        nav.dispatch(a)
        console.log('aaaa after nav history', nav?._navState?.routes[0]?.routes[0]?.routeKeyHistory, a)
      })
    } catch (e) {
      logger.error('Nav error', e)
    }

    this._persistRoute()
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
        <AppContainer ref={nav => (this._nav = nav)} />
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
