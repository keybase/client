// @flow
import * as ConfigGen from '../actions/config-gen'
import Main from './main.native'
import React, {Component} from 'react'
import configureStore from '../store/configure-store'
import loginRouteTree from './routes-login'
import {AppRegistry, AppState, Linking, Text} from 'react-native'
import {GatewayProvider} from 'react-gateway'
import {Provider} from 'react-redux'
import {makeEngine} from '../engine'
import {refreshRouteDef, setInitialRouteDef} from '../actions/route-tree'
import {appStart} from '../constants/platform'
import log from '../logger'

// We don't want global font scaling as this messes up a TON of stuff. let's opt in
function disallowFontScalingByDefault() {
  Text.defaultProps.allowFontScaling = false
}

const now = new Date()
const elapsed = (now - appStart) / 1000.0
log.info(`JS code started on ${now.toString()} (${elapsed}s after app start)`)

disallowFontScalingByDefault()

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
  store: any

  constructor(props: any) {
    super(props)

    if (!global.keybaseLoaded) {
      global.keybaseLoaded = true
      this.store = configureStore()
      global.store = this.store
      if (__DEV__) {
        global.DEBUGStore = this.store
      }
      this.store.dispatch(setInitialRouteDef(loginRouteTree))
      makeEngine(this.store.dispatch, this.store.getState)

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
