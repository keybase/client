// @flow
import './globals.native'
// $FlowIssue
import Nav from './nav'
import DumbSheet from './dev/dumb-sheet'
import React, {Component} from 'react'
import configureStore from './store/configure-store'
import {AppRegistry, NativeAppEventEmitter, AsyncStorage} from 'react-native'
import {Provider} from 'react-redux'
import {makeEngine} from './engine'
import {serializeRestore, serializeSave, timeTravel, timeTravelForward, timeTravelBack} from './constants/dev'
import {setup as setupLocalDebug, dumbSheetOnly} from './local-debug'
import {stateKey} from './constants/reducer'

module.hot && module.hot.accept(() => {
  console.log('accepted update in shared/index.native')
})

class Keybase extends Component {
  store: any;
  subscriptions: Array<{remove: () => void}>
  componentWillMount () {
    this.store = configureStore()
    setupLocalDebug(this.store)
    makeEngine()
    this.subscriptions = []
    if (__DEV__) {
      AsyncStorage.getItem(stateKey, (err, stateJSON) => {
        if (err != null) {
          console.warn('Error in reading state:', err)
        }
        if (stateJSON != null) {
          this.store.dispatch({type: serializeRestore, payload: stateJSON})
        }
      })

      this.subscriptions = [
        NativeAppEventEmitter.addListener('backInTime', () => this.store.dispatch({type: timeTravel, payload: {direction: timeTravelBack}})),
        NativeAppEventEmitter.addListener('forwardInTime', () => this.store.dispatch({type: timeTravel, payload: {direction: timeTravelForward}})),
        NativeAppEventEmitter.addListener('saveState', () => this.store.dispatch({type: serializeSave})),
        NativeAppEventEmitter.addListener('clearState', () => AsyncStorage.removeItem(stateKey)),
      ]
    }
  }

  componentWillUnmount () {
    this.subscriptions.forEach(s => s.remove())
  }

  render () {
    return (
      <Provider store={this.store}>
        {dumbSheetOnly ? <DumbSheet /> : <Nav />}
      </Provider>
    )
  }
}

AppRegistry.registerComponent('Keybase', () => Keybase)
