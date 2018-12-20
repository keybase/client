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
import {refreshRouteDef, setInitialRouteDef} from '../actions/route-tree'

module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in shared/index.native')
    if (global.store) {
      console.log('updating route defs due to hot reload')
      const appRouteTree = require('./routes-app').default
      const loginRouteTree = require('./routes-login').default
      global.store.dispatch(refreshRouteDef(loginRouteTree, appRouteTree))
    }
  })

class Keybase extends Component<any> {
  componentDidMount() {
    AppState.addEventListener('change', this._handleAppStateChange)
    Linking.addEventListener('url', this._handleOpenURL)
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this._handleAppStateChange)
    Linking.removeEventListener('url', this._handleOpenURL)
  }

  _handleOpenURL(event: {url: string}) {
    global.store.dispatch(ConfigGen.createLink({link: event.url}))
  }

  _handleAppStateChange = (nextAppState: 'active' | 'background' | 'inactive') => {
    global.store.dispatch(ConfigGen.createMobileAppState({nextAppState}))
  }

  render() {
    return (
      <Provider store={global.store}>
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
