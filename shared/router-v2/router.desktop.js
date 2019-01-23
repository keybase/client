// @flow
import * as Kb from '../common-adapters'
import * as I from 'immutable'
import * as Styles from '../styles'
import * as React from 'react'
import GlobalError from '../app/global-errors/container'
import Offline from '../offline/container'
import TabBar from './tab-bar/container'
import {
  createNavigator,
  SwitchRouter,
  StackRouter,
  StackActions,
  NavigationActions,
  NavigationContext,
  getNavigation,
  NavigationProvider,
  SceneView,
} from '@react-navigation/core'
import {routes, nameToTab} from './routes'

// deprecating routestate concept entirely
const emptyMap = I.Map()
// don't path this likely
const emptyList = I.List()
class BridgeSceneView extends React.PureComponent {
  _routeProps = {
    get: key => this.props.navigation.getParam(key),
  }
  _pop = () => this.props.navigation.pop()

  // TODO remove all the routeprops etc
  render() {
    const Component = this.props.component
    const options = Component.navigationOptions || {}
    return (
      <NavigationContext.Provider value={this.props.navigation}>
        <BackBar onBack={this._pop} />
        <Kb.ErrorBoundary>
          <Component
            routeProps={this._routeProps}
            routePath={emptyList}
            routeState={emptyMap}
            navigation={this.props.navigation}
          />
        </Kb.ErrorBoundary>
        {!options.skipOffline && <Offline />}
        <GlobalError />
      </NavigationContext.Provider>
    )
  }
}

const BackBar = p => (
  <Kb.Box2
    noShrink={true}
    direction="horizontal"
    gap="small"
    gapStart={true}
    style={styles.backBar}
    fullWidth={true}
  >
    <Kb.Icon type="iconfont-arrow-left" onClick={p.onBack} />
  </Kb.Box2>
)

// The app with a tab bar on the left and content area on the right
// A single content view and n modals on top
class AppView extends React.PureComponent {
  render() {
    const p = this.props
    const index = p.navigation.state.index
    // Find topmost non modal
    let nonModalIndex = index
    let modals = []
    while (nonModalIndex >= 0) {
      const activeKey = p.navigation.state.routes[nonModalIndex].key
      const descriptor = p.descriptors[activeKey]
      const Component = descriptor.getComponent()
      const options = Component.navigationOptions || {}
      if (!options.isModal) {
        break
      }
      modals.unshift(descriptor)
      --nonModalIndex
    }

    const activeKey = p.navigation.state.routes[nonModalIndex].key
    const descriptor = p.descriptors[activeKey]

    // maybe move tabbar etc to  ElectronApp
    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <TabBar selectedTab={nameToTab[descriptor.state.routeName]} />
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.contentArea}>
          <BridgeSceneView navigation={descriptor.navigation} component={descriptor.getComponent()} />
        </Kb.Box2>
        {modals.map(modal => {
          const Component = modal.getComponent()
          return (
            <Component
              key={modal.key}
              routeProps={{get: key => modal.navigation.getParam(key)}}
              routePath={emptyList}
              routeState={emptyMap}
              navigation={modal.navigation}
            />
          )
        })}
      </Kb.Box2>
    )
  }
}

const AppNavigator = createNavigator(
  AppView,
  // TODO don't hardcode this
  StackRouter(routes, {initialRouteName: 'tabs:peopleTab'}),
  {}
)

const createElectronApp = App => {
  const initAction = NavigationActions.init()

  // Based on https://github.com/react-navigation/react-navigation-web/blob/master/src/createBrowserApp.js
  class ElectronApp extends React.Component<any, any> {
    state = {nav: App.router.getStateForAction(initAction)}
    _actionEventSubscribers = new Set()
    _navigation: any
    componentDidMount() {
      this._actionEventSubscribers.forEach(subscriber =>
        subscriber({action: initAction, lastState: null, state: this.state.nav, type: 'action'})
      )
    }
    render() {
      this._navigation = getNavigation(
        App.router,
        this.state.nav,
        this.dispatch,
        this._actionEventSubscribers,
        () => this.props.screenProps,
        () => this._navigation
      )
      return (
        <NavigationProvider value={this._navigation}>
          <App navigation={this._navigation} />
        </NavigationProvider>
      )
    }
    dispatch = action => {
      const lastState = this.state.nav
      const newState = App.router.getStateForAction(action, lastState)
      const dispatchEvents = () =>
        this._actionEventSubscribers.forEach(subscriber =>
          subscriber({action, lastState, state: newState, type: 'action'})
        )
      if (newState && newState !== lastState) {
        this.setState({nav: newState}, dispatchEvents)
      } else {
        dispatchEvents()
      }
    }
  }
  return ElectronApp
}

const ElectronApp = createElectronApp(AppNavigator)

const styles = Styles.styleSheetCreate({
  back: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
    },
  }),
  backBar: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      ...Styles.desktopStyles.windowDragging,
      height: 36,
    },
  }),
  contentArea: {
    flexGrow: 1,
    position: 'relative',
  },
  modalContainer: {},
})

export default ElectronApp
