// @flow
import * as Kb from '../common-adapters'
// import * as Styles from '../styles'
import * as React from 'react'
import TabBar from './tab-bar/container'
import {
  createNavigator,
  SwitchRouter,
  NavigationActions,
  getNavigation,
  NavigationProvider,
  SceneView,
} from '@react-navigation/core'
import routes from './routes'

const AppView = p => {
  const activeKey = p.navigation.state.routes[p.navigation.state.index].key
  const descriptor = p.descriptors[activeKey]
  return (
    <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
      <TabBar selectedTab={activeKey} />
      <SceneView navigation={descriptor.navigation} component={descriptor.getComponent()} />
    </Kb.Box2>
  )
}

const AppNavigator = createNavigator(
  AppView,
  // TODO don't hardcode this
  SwitchRouter(routes, {initialRouteName: 'tabs:peopleTab:root'}),
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
    navigate = route => this._dispatch(NavigationActions.navigate(route))
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

export default ElectronApp
