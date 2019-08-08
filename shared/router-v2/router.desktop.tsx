import * as Kb from '../common-adapters'
import * as Tabs from '../constants/tabs'
import * as Styles from '../styles'
import * as React from 'react'
import TabBar from './tab-bar/container.desktop'
import {
  NavigationViewProps,
  createNavigator,
  StackRouter,
  SwitchRouter,
  NavigationActions,
  getNavigation,
  NavigationContext,
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

const noScreenProps = {}
// The app with a tab bar on the left and content area on the right
// A single content view and n-modals on top
class AppView extends React.PureComponent<NavigationViewProps<any>> {
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
        screenProps={this.props.screenProps || noScreenProps}
      />
    )
    // if the header is transparent this needs to be on the same layer
    const scene = descriptor.options.headerTransparent ? (
      <Kb.Box2 direction="vertical" style={styles.transparentSceneUnderHeader}>
        {sceneView}
      </Kb.Box2>
    ) : (
      <Kb.BoxGrow style={styles.sceneContainer}>{sceneView}</Kb.BoxGrow>
    )

    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <Kb.Box2
          direction={direction}
          fullHeight={true}
          style={selectedTab ? styles.contentArea : styles.contentAreaLogin}
        >
          {scene}
          <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true}>
            {/*
          // @ts-ignore Header typing not finished yet */}
            <Header
              loggedIn={!!selectedTab}
              options={descriptor.options}
              onPop={() => childNav.goBack(activeKey)}
              allowBack={activeIndex !== 0}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

class ModalView extends React.PureComponent<NavigationViewProps<any>> {
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
          screenProps={this.props.screenProps || noScreenProps}
        />
        {index > 0 && (
          <Kb.Box2 direction="vertical" style={styles.modalContainer}>
            <SceneView
              key="ModalLayer"
              navigation={childNav}
              component={descriptor.getComponent()}
              screenProps={this.props.screenProps || noScreenProps}
            />
          </Kb.Box2>
        )}
        <GlobalError />
        <OutOfDate />
      </>
    )
  }
}

class TabView extends React.PureComponent<NavigationViewProps<any>> {
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
        screenProps={this.props.screenProps || noScreenProps}
      />
    )
    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <TabBar navigation={navigation} selectedTab={selectedTab as Tabs.AppTab} />
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
    {backBehavior: 'none', resetOnBlur: false}
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
      // @ts-ignore TODO add custom nav options somewhere
      defaultNavigationOptions: () => ({headerHideBorder: true}),
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

type Subscriber = (data: {action: Object | null; lastState: Object | null; state: any; type: string}) => void

const createElectronApp = Component => {
  // Based on https://github.com/react-navigation/react-navigation-native/blob/master/src/createAppContainer.js
  class ElectronApp extends React.PureComponent<any, any> {
    private navState: any = null // always use this value and not whats in state since thats async
    private actionEventSubscribers = new Set<Subscriber>()
    private navigation: any
    private initialAction: any = null

    constructor(props: any) {
      super(props)
      this.initialAction = NavigationActions.init()
      this.state = {nav: Component.router.getStateForAction(this.initialAction)}
    }

    componentDidUpdate() {
      // Clear cached navState every tick
      if (this.navState === this.state.nav) {
        this.navState = null
      }
    }

    componentDidMount() {
      let action = this.initialAction
      let startupState = this.state.nav
      if (!startupState) {
        startupState = Component.router.getStateForAction(action)
      }
      const dispatchActions = () =>
        this.actionEventSubscribers.forEach(subscriber =>
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
      this.navState = this.navState || this.state.nav
      const lastNavState = this.navState
      const reducedState = Component.router.getStateForAction(action, lastNavState)
      const navState = reducedState === null ? lastNavState : reducedState

      const dispatchActionEvents = () => {
        this.actionEventSubscribers.forEach(subscriber =>
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
        this.navState = navState
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
      if (!this.navigation || this.navigation.state !== navState) {
        this.navigation = getNavigation(
          Component.router,
          navState,
          this.dispatch,
          this.actionEventSubscribers,
          this._getScreenProps,
          () => this.navigation
        )
      }
      navigation = this.navigation
      return (
        <NavigationContext.Provider key={this.props.isDarkMode ? 'dark' : 'light'} value={navigation}>
          <Component {...this.props} navigation={navigation} />
        </NavigationContext.Provider>
      )
    }

    getNavState = () => this.navState || this.state.nav

    dispatchOldAction = (old: any) => {
      const actions = Shared.oldActionToNewActions(old, this.navigation) || []
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
  modalContainer: {...Styles.globalStyles.fillAbsolute},
  sceneContainer: {flexDirection: 'column'},
  transparentSceneUnderHeader: {...Styles.globalStyles.fillAbsolute},
})

export default ElectronApp
