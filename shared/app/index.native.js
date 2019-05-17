// @flow
import * as ConfigGen from '../actions/config-gen'
import Main from './main.native'
import React, {Component} from 'react'
import configureStore from '../store/configure-store'
import {AppRegistry, AppState, Linking} from 'react-native'
import {GatewayProvider} from 'react-gateway'
import {Provider} from 'react-redux'
import {makeEngine} from '../engine'
import {isAndroid} from '../constants/platform'

module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in shared/index.native')
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
      const eng = makeEngine(this.store.dispatch, this.store.getState)
      runSagas()
      eng.sagasAreReady()

      // On mobile there is no installer
      this.store.dispatch(ConfigGen.createInstallerRan())
    } else {
      this.store = global.store
    }

    AppState.addEventListener('change', this._handleAppStateChange)
  }

  componentDidMount() {
    Linking.addEventListener('url', this._handleOpenURL)

    if (isAndroid) {
      Linking.getInitialURL().then(event => event?.url && this._handleOpenURL(event))
    }
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this._handleAppStateChange)
    Linking.removeEventListener('url', this._handleOpenURL)
  }

  _handleOpenURL(event: {url: string}) {
    console.warn('in _handleOpenURL with', event.url)
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
