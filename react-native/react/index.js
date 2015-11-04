'use strict'
/* @flow */

import React, { AppRegistry, Component, NativeAppEventEmitter, AsyncStorage } from 'react-native'
import { Provider, connect } from 'react-redux/native'
import configureStore from './store/configure-store'
import Nav from './nav'

import { STATE_KEY } from './constants/reducer-types'
import { SERIALIZE_RESTORE, SERIALIZE_SAVE, TIME_TRAVEL, TIME_TRAVEL_FORWARD, TIME_TRAVEL_BACK } from './constants/dev'

const store = configureStore()

class Keybase extends Component {
  constructor () {
    super()
  }

  componentWillMount () {
    this.subscriptions = []
    // TODO move this __DEV__ to a module
    if (__DEV__) { // eslint-disable-line no-undef
      AsyncStorage.getItem(STATE_KEY, (err, stateJSON) => {
        if (err != null) {
          console.error('Error in reading state:', err)
        }
        if (stateJSON != null) {
          store.dispatch({type: SERIALIZE_RESTORE, payload: stateJSON})
        }
      })

      this.subscriptions = [
        NativeAppEventEmitter.addListener('backInTime', () => store.dispatch({type: TIME_TRAVEL, payload: {direction: TIME_TRAVEL_BACK}})),
        NativeAppEventEmitter.addListener('forwardInTime', () => store.dispatch({type: TIME_TRAVEL, payload: {direction: TIME_TRAVEL_FORWARD}})),
        NativeAppEventEmitter.addListener('saveState', () => store.dispatch({type: SERIALIZE_SAVE})),
        NativeAppEventEmitter.addListener('clearState', () => AsyncStorage.removeItem(STATE_KEY))
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
