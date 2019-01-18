// @flow
import * as Kb from '../common-adapters'
import * as I from 'immutable'
import * as Styles from '../styles'
import * as React from 'react'
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
// TEMP component to give the old routeprops stuff
class BridgeSceneView extends React.PureComponent {
  _routeProps = {
    get: key => this.props.navigation.getParam(key),
  }
  render() {
    const Component = this.props.component
    return (
      <NavigationContext.Provider value={this.props.navigation}>
        <Component
          routeProps={this._routeProps}
          routePath={emptyList}
          routeState={emptyMap}
          screenProps={this.props.screenProps}
          navigation={this.props.navigation}
        />
      </NavigationContext.Provider>
    )
  }
}

const AppView = p => {
  const activeKey = p.navigation.state.routes[p.navigation.state.index].key
  const descriptor = p.descriptors[activeKey]
  return (
    <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
      <TabBar selectedTab={nameToTab[descriptor.state.routeName]} />
      <Kb.Box2 direction="vertical" fullHeight={true} style={styles.contentArea}>
        <BridgeSceneView navigation={descriptor.navigation} component={descriptor.getComponent()} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const AppNavigator = createNavigator(
  AppView,
  // TODO don't hardcode this
  StackRouter(routes, {initialRouteName: 'tabs:peopleTab'}),
  {
    navigationOptions: () => ({}),
  }
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
        this._dispatch,
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
    // just so we have nice access to this in the action
    push = route => this._dispatch(StackActions.push(route))
    goBack = () => this._dispatch(NavigationActions.back())
    _dispatch = action => {
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
  contentArea: {
    flexGrow: 1,
    position: 'relative',
  },
})

export default ElectronApp
