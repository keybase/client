'use strict'
/* @flow */

import React, { AppRegistry, Component, NativeAppEventEmitter, AsyncStorage } from 'react-native'
import { Provider, connect } from 'react-redux/native'
import configureStore from './store/configure-store'
import Nav from './nav'

import { STATE_KEY } from './constants/reducer-types'

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
        NativeAppEventEmitter.addListener('backInTime', () => store.dispatch({type: 'timetravel', payload: {direction: 'back'}})),
        NativeAppEventEmitter.addListener('forwardInTime', () => store.dispatch({type: 'timetravel', payload: {direction: 'forward'}})),
        NativeAppEventEmitter.addListener('saveState', () => store.dispatch({type: 'saveState'})),
        NativeAppEventEmitter.addListener('restoreState', () => {
          AsyncStorage.getItem(STATE_KEY, (err, stateJSON) => {
            if (err != null) {
              console.error('Error in reading state:', err)
            }
            store.dispatch({type: 'restoreState', payload: stateJSON})
          })
        })
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
