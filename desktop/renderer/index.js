/* @flow */

import React, {Component} from '../../react-native/react/base-react'
import ReactDOM from 'react-dom'
import {Provider} from 'react-redux'
import configureStore from '../../react-native/react/store/configure-store'
import Nav from '../../react-native/react/nav'
import injectTapEventPlugin from 'react-tap-event-plugin'
import {reduxDevToolsSelect} from '../../react-native/react/local-debug.desktop'

import ListenForNotifications from '../../react-native/react/native/notifications'
import ListenLogUi from '../../react-native/react/native/listen-log-ui'

// For Remote Components
import {ipcRenderer} from 'electron'
import RemoteManager from '../../react-native/react/native/remote-manager'
import {ipcMain} from 'remote'
import consoleHelper from '../app/console-helper'
import _ from 'lodash'

consoleHelper()

let DevTools = null
let DebugPanel = null
let LogMonitor = null

if (module.hot) {
  module.hot.accept()
}

if (__DEV__) { // eslint-disable-line no-undef
  const RDT = require('redux-devtools/lib/react')
  DevTools = RDT.DevTools
  DebugPanel = RDT.DebugPanel
  LogMonitor = RDT.LogMonitor
}

const store = configureStore()

function NotifyPopup (title: string, opts: Object): void {
  new Notification(title, opts) //eslint-disable-line
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

    ipcMain.on('subscribeStore', (event, substore) => {
      const sender = event.sender // cache this since this is actually a sync-rpc call...

      const getStore = () => {
        if (substore) {
          return store.getState()[substore] || {}
        } else {
          return store.getState() || {}
        }
      }

      sender.send('stateChange', getStore())
      store.subscribe(() => {
        // TODO: use transit
        sender.send('stateChange', getStore())
      })
    })

    ipcRenderer.send('remoteStoreReady')

    // Handle notifications from the service
    ListenForNotifications(NotifyPopup)

    // Handle logUi.log
    ListenLogUi()
  }

  renderNav () {
    return (
      <Provider store={store}>
        <div style={{display: 'flex', flex: 1}}>
          <RemoteManager />
          <Nav />
        </div>
      </Provider>
    )
  }

  render () {
    if (__DEV__) { // eslint-disable-line no-undef
      return (
        <div style={{position: 'absolute', width: '100%', height: '100%', display: 'flex'}}>
          {this.renderNav()}
          <DebugPanel style={{height: '100%', width: this.state.panelShowing ? '30%' : 0, position: 'relative', maxHeight: 'initial'}}>
            <DevTools store={store} monitor={LogMonitor} visibleOnLoad={false} select={reduxDevToolsSelect}/>
          </DebugPanel>
        </div>
      )
    } else {
      return this.renderNav()
    }
  }
}

ReactDOM.render(<Keybase/>, document.getElementById('app'))
