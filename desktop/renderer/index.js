/* @flow */

import React, {Component} from '../../react-native/react/base-react'
import ReactDOM from 'react-dom'
import {Provider} from 'react-redux'
import configureStore from '../../react-native/react/store/configure-store'
import Nav from '../../react-native/react/nav'
import injectTapEventPlugin from 'react-tap-event-plugin'
import ListenLogUi from '../../react-native/react/native/listen-log-ui'
import {reduxDevToolsEnable} from '../../react-native/react/local-debug'
import {listenForNotifications} from '../../react-native/react/actions/notifications'

// For Remote Components
import {ipcRenderer} from 'electron'
import RemoteManager from '../../react-native/react/native/remote-manager'
import {ipcMain} from 'remote'
import consoleHelper from '../app/console-helper'
import _ from 'lodash'

consoleHelper()

if (module.hot) {
  module.hot.accept()
}

const store = configureStore()

// Shallow diff of two objects, returns an object that can be merged with
// the oldObj to yield the newObj. Doesn't handle deleted keys.
function shallowDiff (oldObj: Object, newObj: Object): Object {
  return Object.keys(newObj).reduce((acc, k) => newObj[k] !== oldObj[k] ? (acc[k] = newObj[k]) && acc : acc, {})
}

class Keybase extends Component {
  constructor () {
    super()

    this.state = {
      panelShowing: false
    }

    if (__DEV__) { // eslint-disable-line no-undef
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', event => {
          if (event.ctrlKey && event.keyCode === 72) {
            this.setState({panelShowing: !this.state.panelShowing})
          }
        })
      }
    }

    // Used by material-ui widgets.
    injectTapEventPlugin()

    // For remote window components
    ipcMain.removeAllListeners('dispatchAction')
    ipcMain.removeAllListeners('stateChange')
    ipcMain.removeAllListeners('subscribeStore')

    ipcMain.on('dispatchAction', (event, action) => {
      // we MUST clone this else we'll run into issues with redux. See https://github.com/rackt/redux/issues/830
      // This is because we get a remote proxy object, instead of a normal object
      setImmediate(() => store.dispatch(_.cloneDeep(action)))
    })

    ipcMain.on('subscribeStore', event => {
      const sender = event.sender // cache this since this is actually a sync-rpc call...

      // Keep track of the last state sent so we can make the diffs.
      let oldState = {}
      const getStore = () => {
        const newState = store.getState()
        const diffState = shallowDiff(oldState, newState) || {}
        oldState = newState
        return diffState
      }

      if (!sender.isDestroyed()) {
        sender.send('stateChange', getStore())
      }

      let unsubscribe = store.subscribe(() => {
        if (sender.isDestroyed()) {
          if (unsubscribe) {
            unsubscribe()
            unsubscribe = null
          }
          return
        }

        const diffState = getStore()
        if (Object.keys(diffState).length !== 0) {
          if (!sender.isDestroyed()) { // We need this extra check due to timing issues
            sender.send('stateChange', diffState)
          }
        }
      })
    })

    ipcRenderer.send('remoteStoreReady')

    // Handle notifications from the service
    store.dispatch(listenForNotifications())

    // Handle logUi.log
    ListenLogUi()
  }

  render () {
    let dt = null
    if (__DEV__ && reduxDevToolsEnable) { // eslint-disable-line no-undef
      const DevTools = require('./redux-dev-tools')
      dt = <DevTools />
    }

    return (
      <Provider store={store}>
        <div style={{display: 'flex', flex: 1}}>
          <RemoteManager />
          <Nav />
          {dt}
        </div>
      </Provider>
    )
  }
}

ReactDOM.render(<Keybase/>, document.getElementById('app'))
