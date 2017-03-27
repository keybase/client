// @flow
import 'core-js/es6/reflect'  // required for babel-plugin-transform-builtin-extend in RN iOS and Android
import './globals.native'
import DumbSheet from './dev/dumb-sheet'
import DumbChatOnly from './dev/chat-only.native'
import Main from './main'
import React, {Component} from 'react'
import configureStore from './store/configure-store'
import {AppRegistry, AppState, AsyncStorage, NativeAppEventEmitter} from 'react-native'
import {Provider} from 'react-redux'
import {makeEngine} from './engine'
import {serializeRestore, serializeSave, timeTravel, timeTravelForward, timeTravelBack} from './constants/dev'
import {setup as setupLocalDebug, dumbSheetOnly, dumbChatOnly} from './local-debug'
import {stateKey} from './constants/reducer'
import routeDefs from './routes'
import {setRouteDef} from './actions/route-tree'
import {setupSource} from './util/forward-logs'

module.hot && module.hot.accept(() => {
  console.log('accepted update in shared/index.native')
  if (global.devStore) {
    // We use global.devStore because module scope variables seem to be cleared
    // out after a hot reload. Wacky.
    console.log('updating route defs due to hot reload')
    global.devStore.dispatch(setRouteDef(require('./routes').default))
  }
})

class Keybase extends Component {
  store: any;
  subscriptions: Array<{remove: () => void}>
  componentWillMount () {
    setupSource()
    this.store = configureStore()
    setupLocalDebug(this.store)
    this.store.dispatch(setRouteDef(routeDefs))
    makeEngine()
    AppState.addEventListener('change', this._handleAppStateChange)
    this.subscriptions = []
    if (__DEV__) {
      global.devStore = this.store
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
    AppState.removeEventListener('change', this._handleAppStateChange)
    this.subscriptions.forEach(s => s.remove())
  }

  _handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'active') {
      this.store.dispatch({payload: true, type: 'app:changedFocus'})
    } else if (nextAppState === 'inactive') {
      this.store.dispatch({payload: false, type: 'app:changedFocus'})
    }
  }

  render () {
    let child

    if (dumbSheetOnly) {
      child = <DumbSheet />
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

AppRegistry.registerComponent('Keybase', () => Keybase)
