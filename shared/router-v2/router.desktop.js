// @flow
// TODO look at whats shared w/ native and move it around
import * as Kb from '../common-adapters'
// import * as I from 'immutable'
import * as Styles from '../styles'
import * as React from 'react'
// import GlobalError from '../app/global-errors/container'
// import Offline from '../offline/container'
import TabBar from './tab-bar/container'
import {
  createNavigator,
  // SwitchRouter,
  StackRouter,
  // StackActions,
  NavigationActions,
  // NavigationContext,
  getNavigation,
  NavigationProvider,
  SceneView,
  createSwitchNavigator,
} from '@react-navigation/core'
import {modalRoutes, routes, nameToTab, loggedOutRoutes} from './routes'
import * as Shared from './router.shared'
import Header from './header/index.desktop'
import * as Shim from './shim.desktop'

/**
 * How this works:
 * There are 3 layers
 * Normal screens
 * Modal screens
 * Floating screens
 *
 * You have 2 nested routers, a normal stack and modal stack
 * When the modal has a valid route ModalView is rendered, which renders AppView underneath
 * When there are no modals AppView is rendered
 * Floating is rendered to a portal on top
 */
// TODO modals
// <Kb.ErrorBoundary>
// {!options.skipOffline && <Offline />}
// <GlobalError />

// The app with a tab bar on the left and content area on the right
// A single content view and n modals on top
class AppView extends React.PureComponent<any> {
  render() {
    const navigation = this.props.navigation
    const index = navigation.state.index
    const activeKey = navigation.state.routes[index].key
    const descriptor = this.props.descriptors[activeKey]
    const childNav = descriptor.navigation

    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <TabBar selectedTab={nameToTab[descriptor.state.routeName]} />
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.contentArea}>
          <Header options={descriptor.options} onPop={childNav.pop} allowBack={index !== 0} />
          <SceneView
            navigation={childNav}
            component={descriptor.getComponent()}
            screenProps={this.props.screenProps}
          />
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

class ModalView extends React.PureComponent<any> {
  render() {
    const navigation = this.props.navigation
    const index = navigation.state.index
    const activeKey = navigation.state.routes[index].key
    const descriptor = this.props.descriptors[activeKey]
    const childNav = descriptor.navigation

    // We render the app below us
    const appKey = this.props.navigation.state.routes[0].key
    const appNav = this.props.navigation.getChildNavigation(appKey)
    const appDescriptor = this.props.descriptors[appKey]

    // <MainNavigator navigation={appNav} />
    // <AppView navigation={appNav} descriptors={this.props.descriptors} />
    return (
      <>
        <SceneView
          navigation={appNav}
          component={appDescriptor.getComponent()}
          screenProps={this.props.screenProps}
        />
        {index > 0 && (
          <SceneView
            navigation={childNav}
            component={descriptor.getComponent()}
            screenProps={this.props.screenProps}
          />
        )}
      </>
    )
  }
}

const MainNavigator = createNavigator(
  AppView,
  StackRouter(Shim.shim(routes), {initialRouteName: 'tabs:peopleTab'}),
  {}
)

const LoggedInStackNavigator = createNavigator(
  ModalView,
  StackRouter(
    {
      Main: {screen: MainNavigator},
      ...Shim.shim(modalRoutes),
    },
    {}
  ),
  {}
)

const LoggedOutStackNavigator = createNavigator(
  AppView,
  StackRouter({...Shim.shim(loggedOutRoutes)}, {initialRouteName: 'login'}),
  {}
)

const RootStackNavigator = createSwitchNavigator(
  {
    loggedIn: LoggedInStackNavigator,
    loggedOut: LoggedOutStackNavigator,
  },
  {initialRouteName: 'loggedOut'}
)

const createElectronApp = App => {
  const initAction = NavigationActions.init()

  // Based on https://github.com/react-navigation/react-navigation-web/blob/master/src/createBrowserApp.js
  class ElectronApp extends React.Component<any, any> {
    _nav: any // always use this value and not whats in state since thats async
    _actionEventSubscribers = new Set()
    _navigation: any

    constructor(props: any) {
      super(props)
      this._nav = App.router.getStateForAction(initAction)
      this.state = {nav: this._nav}
    }

    componentDidMount() {
      this._actionEventSubscribers.forEach(subscriber =>
        subscriber({action: initAction, lastState: null, state: this.state.nav, type: 'action'})
      )
    }
    render() {
      if (!this._navigation || this._navigation.state !== this.state.nav) {
        this._navigation = getNavigation(
          App.router,
          this.state.nav,
          this.dispatch,
          this._actionEventSubscribers,
          () => this.props.screenProps,
          () => this._navigation
        )
      }
      return (
        <NavigationProvider value={this._navigation}>
          <App navigation={this._navigation} />
        </NavigationProvider>
      )
    }
    getNavState = () => this._nav
    dispatchOldAction = (old: any) => {
      const actions = Shared.oldActionToNewActions(old, this._navigation) || []
      actions.forEach(a => this.dispatch(a))
    }
    dispatch = (action: any) => {
      const lastState = this._nav
      const newState = App.router.getStateForAction(action, lastState)
      this._nav = newState
      const dispatchEvents = () =>
        this._actionEventSubscribers.forEach(subscriber =>
          subscriber({action, lastState, state: newState, type: 'action'})
        )
      if (newState && newState !== lastState) {
        this.setState({nav: newState}, dispatchEvents)
        return true
      } else {
        dispatchEvents()
      }
      return false
    }
  }
  return ElectronApp
}

const ElectronApp = createElectronApp(RootStackNavigator)

const styles = Styles.styleSheetCreate({
  back: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
    },
  }),
  contentArea: {
    flexGrow: 1,
    position: 'relative',
  },
  modalContainer: {},
})

export default ElectronApp
