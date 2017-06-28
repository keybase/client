// @flow
import 'core-js/es6/reflect' // required for babel-plugin-transform-builtin-extend in RN iOS and Android
import './globals.native'

import DumbSheet from './dev/dumb-sheet'
import DumbChatOnly from './dev/chat-only.native'
import Main from './main'
import React, {Component} from 'react'
import {Box} from './common-adapters'
import configureStore from './store/configure-store'
import {AppRegistry, AppState, Linking, Text} from 'react-native'
import {Provider} from 'react-redux'
import {makeEngine} from './engine'
import {setup as setupLocalDebug, dumbSheetOnly, dumbChatOnly} from './local-debug'
import routeDefs from './routes'
import {setRouteDef} from './actions/route-tree'
import {appLink, mobileAppStateChanged} from './actions/app'
import {setupSource} from './util/forward-logs'
import {globalColors} from './styles'
import {iconMeta} from './common-adapters/icon.constants'

import {Navigation} from 'react-native-navigation'

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
      child = <Box style={{flex: 1, marginTop: 40}}><DumbSheet /></Box>
    } else if (dumbChatOnly) {
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
  const navigatorStyle = {
    navBarHidden: true,
  }
  Navigation.registerComponent('one', () => Box, global.store, Provider)
  Navigation.registerComponent('two', () => Box, global.store, Provider)
  Navigation.startTabBasedApp({
    tabs: [
      {
        navigatorStyle,
        screen: 'one', // this is a registered name for a screen
        title: 'Screen One',
        icon: iconMeta['icon-GPG-export'].require,
      },
      {
        navigatorStyle,
        screen: 'two',
        icon: iconMeta['icon-bitcoin-logo-16'].require,
      },
    ],
    tabsStyle: {
      tabBarButtonColor: 'rgba(255, 255, 255, 0.6)',
      tabBarSelectedButtonColor: 'white',
      tabBarBackgroundColor: globalColors.darkBlue2,
    },
  })
}

export {load}
