// @flow
import * as ConfigGen from '../actions/config-gen'
import Main from './main.native'
import React, {Component} from 'react'
import configureStore from '../store/configure-store'
import loginRouteTree from './routes-login'
import {AppRegistry, AppState, Linking} from 'react-native'
import {GatewayProvider} from 'react-gateway'
import {Provider} from 'react-redux'
import {makeEngine} from '../engine'
import * as RouteTreeGen from '../actions/route-tree-gen'

module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in shared/index.native')
    if (global.store) {
      console.log('updating route defs due to hot reload')
      const appRouteTree = require('./routes-app').default
      const loginRouteTree = require('./routes-login').default
      global.store.dispatch(RouteTreeGen.createRefreshRouteDef({appRouteTree, loginRouteTree}))
    }
  })

class Keybase extends Component<any> {
  store: any

  constructor(props: any) {
    super(props)

    if (!global.keybaseLoaded) {
      global.keybaseLoaded = true
      const {store, runSagas} = configureStore()
      this.store = store
      global.store = this.store
      if (__DEV__) {
        global.DEBUGStore = this.store
      }
      makeEngine(this.store.dispatch, this.store.getState)
      runSagas()
      this.store.dispatch(RouteTreeGen.createSetInitialRouteDef({routeDef: loginRouteTree}))

      // On mobile there is no installer
      this.store.dispatch(ConfigGen.createInstallerRan())
    } else {
      this.store = global.store
    }

    AppState.addEventListener('change', this._handleAppStateChange)
  }

  componentDidMount() {
    Linking.addEventListener('url', this._handleOpenURL)
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this._handleAppStateChange)
    Linking.removeEventListener('url', this._handleOpenURL)
  }

  _handleOpenURL(event: {url: string}) {
    this.store.dispatch(ConfigGen.createLink({link: event.url}))
  }

  _handleAppStateChange = (nextAppState: 'active' | 'background' | 'inactive') => {
    this.store.dispatch(ConfigGen.createMobileAppState({nextAppState}))
  }

  render() {
    return (
      <Provider store={this.store}>
        <GatewayProvider>
          <Main />
        </GatewayProvider>
      </Provider>
    )
  }
}

function load() {
  AppRegistry.registerComponent('Keybase', () => Keybase)
}

export {load}
