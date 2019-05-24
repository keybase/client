import * as ConfigGen from '../actions/config-gen'
import Main from './main.native'
import React, {Component} from 'react'
import configureStore from '../store/configure-store'
import {AppRegistry, AppState, Linking} from 'react-native'
import {GatewayProvider} from 'react-gateway'
import {Provider} from 'react-redux'
import {makeEngine} from '../engine'

// @ts-ignore
module.hot &&
  // @ts-ignore
  module.hot.accept(() => {
    console.log('accepted update in shared/index.native')
  })

class Keybase extends Component<any> {
  store: any

  constructor(props: any) {
    super(props)

    // @ts-ignore
    if (!global.keybaseLoaded) {
      // @ts-ignore
      global.keybaseLoaded = true
      const {store, runSagas} = configureStore()
      this.store = store
      // @ts-ignore
      global.store = this.store
      if (__DEV__) {
        // @ts-ignore
        global.DEBUGStore = this.store
      }
      const eng = makeEngine(this.store.dispatch, this.store.getState)
      runSagas()
      eng.sagasAreReady()

      // On mobile there is no installer
      this.store.dispatch(ConfigGen.createInstallerRan())
    } else {
      // @ts-ignore
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
