// @flow
import Main from './main'
import React, {Component} from 'react'
import configureStore from '../store/configure-store'
import routeDefs from './routes'
import {AppRegistry, AppState, Linking, Text} from 'react-native'
import {Box} from '../common-adapters'
import {Provider} from 'react-redux'
import {appLink, mobileAppStateChanged} from '../actions/app'
import {makeEngine} from '../engine'
import {setRouteDef} from '../actions/route-tree'
import {setup as setupLocalDebug, dumbSheetOnly, dumbChatOnly} from '../local-debug'
import {setupSource} from '../util/forward-logs'

// We don't want global font scaling as this messes up a TON of stuff. let's opt in
function disallowFontScalingByDefault() {
  Text.defaultProps.allowFontScaling = false
}

disallowFontScalingByDefault()

module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in shared/index.native')
    if (global.store) {
      // We use global.devStore because module scope variables seem to be cleared
      // out after a hot reload. Wacky.
      console.log('updating route defs due to hot reload')
      global.store.dispatch(setRouteDef(require('./routes').default))
    }
  })

class Keybase extends Component {
  store: any

  constructor(props: any) {
    super(props)

    if (!global.keybaseLoaded) {
      global.keybaseLoaded = true
      setupSource()
      this.store = configureStore()
      global.store = this.store
      setupLocalDebug(this.store)
      this.store.dispatch(setRouteDef(routeDefs))
      makeEngine()
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
    this.store.dispatch(appLink(event.url))
  }

  _handleAppStateChange = (nextAppState: string) => {
    this.store.dispatch(mobileAppStateChanged(nextAppState))
  }

  render() {
    let child

    if (dumbSheetOnly) {
      // Defer loading this
      const DumbSheet = require('../dev/dumb-sheet').default
      child = (
        <Box style={{flex: 1, marginTop: 40}}>
          <DumbSheet />
        </Box>
      )
    } else if (dumbChatOnly) {
      const DumbChatOnly = require('../dev/chat-only.native').default
      child = <DumbChatOnly />
    } else {
      child = <Main />
    }

    return (
      <Provider store={this.store}>
        {child}
      </Provider>
    )
  }
}

function load() {
  AppRegistry.registerComponent('Keybase', () => Keybase)
}

export {load}
