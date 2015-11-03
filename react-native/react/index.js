'use strict'
/* @flow */

import React, { AppRegistry, Component } from 'react-native'
import { Provider, connect } from 'react-redux/native'
import configureStore from './store/configure-store'
import Nav from './nav'

const store = configureStore()

class Keybase extends Component {
  constructor () {
    super()
  }

  componentWillMount () {
    this.subscriptions = []
    // TODO move this __DEV__ to a module
    if (__DEV__) { // eslint-disable-line no-undef
      this.subscriptions = [
        NativeAppEventEmitter.addListener('backInTime', () => store.dispatch({type: 'timetravel', payload: {direction: 'forward'}})),
        NativeAppEventEmitter.addListener('forwardInTime', () => store.dispatch({type: 'timetravel', payload: {direction: 'back'}})),
      ]
    }
  }

  componentWillUnmount () {
    this.subscriptions.forEach((s) => s.remove())
  }

  render () {
    return (
      <Provider store={store}>
        {() => {
          // TODO(mm): maybe not pass in store?
          return React.createElement(connect(state => state)(Nav), {store: store})
        }}
      </Provider>
    )
  }
}

AppRegistry.registerComponent('Keybase', () => Keybase)
