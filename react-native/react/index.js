import React, {AppRegistry, Component, NativeAppEventEmitter, AsyncStorage} from './base-react'
import {Provider} from 'react-redux/native'
import configureStore from './store/configure-store'
import Nav from './nav'

import {isDev} from './constants/platform'
import {stateKey} from './constants/reducer'
import {serializeRestore, serializeSave, timeTravel, timeTravelForward, timeTravelBack} from './constants/dev'

const store = configureStore()

class Keybase extends Component {
  componentWillMount () {
    this.subscriptions = []
    if (isDev) {
      AsyncStorage.getItem(stateKey, (err, stateJSON) => {
        if (err != null) {
          console.error('Error in reading state:', err)
        }
        if (stateJSON != null) {
          store.dispatch({type: serializeRestore, payload: stateJSON})
        }
      })

      this.subscriptions = [
        NativeAppEventEmitter.addListener('backInTime', () => store.dispatch({type: timeTravel, payload: {direction: timeTravelBack}})),
        NativeAppEventEmitter.addListener('forwardInTime', () => store.dispatch({type: timeTravel, payload: {direction: timeTravelForward}})),
        NativeAppEventEmitter.addListener('saveState', () => store.dispatch({type: serializeSave})),
        NativeAppEventEmitter.addListener('clearState', () => AsyncStorage.removeItem(stateKey))
      ]
    }
  }

  componentWillUnmount () {
    this.subscriptions.forEach(s => s.remove())
  }

  render () {
    return (
      <Provider store={store}>
        {() => <Nav/>}
      </Provider>
    )
  }
}

AppRegistry.registerComponent('Keybase', () => Keybase)
