import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as React from 'react'
import TabBar from './tab-bar/container.desktop'
import {
  createNavigator,
  StackRouter,
  SwitchRouter,
  NavigationActions,
  getNavigation,
  NavigationProvider,
  SceneView,
  createSwitchNavigator,
} from '@react-navigation/core'
import {modalRoutes, routes, nameToTab, loggedOutRoutes, tabRoots} from './routes'
import {getActiveIndex, getActiveKey} from './util'
import * as Shared from './router.shared'
import Header from './header/index.desktop'
import * as Shim from './shim.desktop'
import GlobalError from '../app/global-errors/container'
import OutOfDate from '../app/out-of-date'

/**
 * How this works:
 * There are 3 layers
 * Normal screens
 * Modal screens
 * Floating screens
 *
 * You have 2 nested routers, a tab router and modal stack
 * When the modal has a valid route ModalView is rendered, which renders AppView underneath
 * When there are no modals AppView is rendered
 * Floating is rendered to a portal on top
 */

// The app with a tab bar on the left and content area on the right
// A single content view and n-modals on top
class AppView extends React.PureComponent<any> {
  render() {
    const navigation = this.props.navigation
    const index = navigation.state.index
    const activeRootKey = navigation.state.routes[index].key
    const descriptor = this.props.descriptors[activeRootKey]
    const childNav = descriptor.navigation
    const selectedTab = nameToTab[descriptor.state.routeName]
    // transparent headers use position absolute and need to be rendered last so they go on top w/o zindex
    const direction = descriptor.options.headerTransparent ? 'vertical' : 'verticalReverse'
    const activeIndex = getActiveIndex(navigation.state)
    const activeKey = getActiveKey(navigation.state)

    const sceneView = (
      <SceneView
        navigation={childNav}
        component={descriptor.getComponent()}
        screenProps={this.props.screenProps}
        options={descriptor.options}
      />
    )
    // if the header is transparent this needs to be on the same layer
    const scene = descriptor.options.headerTransparent ? (
      <Kb.Box2 direction="vertical" style={styles.transparentSceneUnderHeader}>
        {sceneView}
      </Kb.Box2>
    ) : (
      sceneView
    )

    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <Kb.Box2
          direction={direction}
          fullHeight={true}
          style={selectedTab ? styles.contentArea : styles.contentAreaLogin}
        >
          {scene}
          <Header
            loggedIn={!!selectedTab}
            options={descriptor.options}
            onPop={() => childNav.goBack(activeKey)}
            allowBack={activeIndex !== 0}
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

    // TODO we might want all the click handling / grey background stuff handled by the routing
    return (
      <>
        <SceneView
          key="AppLayer"
          navigation={appNav}
          component={appDescriptor.getComponent()}
          screenProps={this.props.screenProps}
        />
        {index > 0 && (
          <Kb.Box2 direction="vertical" style={styles.modalContainer}>
            <SceneView
              key="ModalLayer"
              navigation={childNav}
              component={descriptor.getComponent()}
              screenProps={this.props.screenProps}
            />
          </Kb.Box2>
        )}
        <GlobalError />
        <OutOfDate />
      </>
    )
  }
}

class TabView extends React.PureComponent<any> {
  render() {
    const navigation = this.props.navigation
    const index = navigation.state.index
    const activeKey = navigation.state.routes[index].key
    const descriptor = this.props.descriptors[activeKey]
    const childNav = descriptor.navigation
    const selectedTab = descriptor.state.routeName
    const sceneView = (
      <SceneView
        navigation={childNav}
        component={descriptor.getComponent()}
        screenProps={this.props.screenProps}
        options={descriptor.options}
      />
    )
    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <TabBar navigation={navigation} selectedTab={selectedTab} />
        {sceneView}
      </Kb.Box2>
    )
  }
}

const tabs = Shared.desktopTabs

const TabNavigator = createNavigator(
  TabView,
  SwitchRouter(
    tabs.reduce((map, tab) => {
      map[tab] = createNavigator(
        AppView,
        StackRouter(Shim.shim(routes), {
          initialRouteName: tabRoots[tab],
          initialRouteParams: undefined,
        }),
        {}
      )
      return map
    }, {}),
    {resetOnBlur: false}
  ),
  {}
)

const LoggedInStackNavigator = createNavigator(
  ModalView,
  StackRouter(
    {
      Main: {screen: TabNavigator},
      ...Shim.shim(modalRoutes),
    },
    {}
  ),
  {}
)

const LoggedOutStackNavigator = createNavigator(
  AppView,
  StackRouter(
    {...Shim.shim(loggedOutRoutes)},
    {
      defaultNavigationOptions: p => ({headerHideBorder: true}),
      initialRouteName: 'login',
    }
  ),
  {}
)

const RootStackNavigator = createSwitchNavigator(
  {
    loggedIn: LoggedInStackNavigator,
    loggedOut: LoggedOutStackNavigator,
  },
  {initialRouteName: 'loggedOut'}
)

type Subscriber = (data: {action: Object; lastState: Object; state: any; type: string}) => void

const createElectronApp = Component => {
  // Based on https://github.com/react-navigation/react-navigation-native/blob/master/src/createAppContainer.js
  class ElectronApp extends React.PureComponent<any, any> {
    _navState: any = null // always use this value and not whats in state since thats async
    _actionEventSubscribers = new Set<Subscriber>()
    _navigation: any
    _initialAction = null

    constructor(props: any) {
      super(props)
      this._initialAction = NavigationActions.init()
      this.state = {nav: Component.router.getStateForAction(this._initialAction)}
    }

    componentDidUpdate() {
      // Clear cached _navState every tick
      if (this._navState === this.state.nav) {
        this._navState = null
      }
    }

    componentDidMount() {
      let action = this._initialAction
      let startupState = this.state.nav
      if (!startupState) {
        startupState = Component.router.getStateForAction(action)
      }
      const dispatchActions = () =>
        this._actionEventSubscribers.forEach(subscriber =>
          subscriber({
            action,
            lastState: null,
            state: this.state.nav,
            type: 'action',
          })
        )

      if (startupState === this.state.nav) {
        dispatchActions()
        return
      }

      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({nav: startupState}, () => {
        dispatchActions()
      })
    }

    dispatch = (action: any) => {
      // navState will have the most up-to-date value, because setState sometimes behaves asyncronously
      this._navState = this._navState || this.state.nav
      const lastNavState = this._navState
      const reducedState = Component.router.getStateForAction(action, lastNavState)
      const navState = reducedState === null ? lastNavState : reducedState

      const dispatchActionEvents = () => {
        this._actionEventSubscribers.forEach(subscriber =>
          subscriber({
            action,
            lastState: lastNavState,
            state: navState,
            type: 'action',
          })
        )
      }

      if (reducedState === null) {
        // The router will return null when action has been handled and the state hasn't changed.
        // dispatch returns true when something has been handled.
        dispatchActionEvents()
        return true
      }

      if (navState !== lastNavState) {
        // Cache updates to state.nav during the tick to ensure that subsequent calls will not discard this change
        this._navState = navState
        this.setState({nav: navState}, () => {
          dispatchActionEvents()
        })
        return true
      }

      dispatchActionEvents()
      return false
    }

    _getScreenProps = () => this.props.screenProps

    render() {
      let navigation = this.props.navigation
      const navState = this.state.nav
      if (!navState) {
        return null
      }
      if (!this._navigation || this._navigation.state !== navState) {
        this._navigation = getNavigation(
          Component.router,
          navState,
          this.dispatch,
          this._actionEventSubscribers,
          this._getScreenProps,
          () => this._navigation
        )
      }
      navigation = this._navigation
      return (
        <NavigationProvider value={navigation}>
          <Component {...this.props} navigation={navigation} />
        </NavigationProvider>
      )
    }

    getNavState = () => this._navState || this.state.nav

    dispatchOldAction = (old: any) => {
      const actions = Shared.oldActionToNewActions(old, this._navigation) || []
      actions.forEach(a => this.dispatch(a))
    }
  }
  return ElectronApp
}

const ElectronApp = createElectronApp(RootStackNavigator)

const styles = Styles.styleSheetCreate({
  contentArea: {
    flexGrow: 1,
    position: 'relative',
  },
  contentAreaLogin: Styles.platformStyles({
    isElectron: {
      flexGrow: 1,
      position: 'relative',
    },
    isMobile: {
      flexGrow: 1,
      position: 'relative',
    },
  }),
  modalContainer: {
    ...Styles.globalStyles.fillAbsolute,
  },
  transparentSceneUnderHeader: {
    ...Styles.globalStyles.fillAbsolute,
  },
})

export default ElectronApp
