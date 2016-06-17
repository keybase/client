/* @flow */
/*
 * The main renderer. Holds the global store. When it changes we send it to the main thread which then sends it out to subscribers
 */

import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import {Provider} from 'react-redux'
import configureStore from '../shared/store/configure-store'
import Nav from '../shared/nav.desktop'
import injectTapEventPlugin from 'react-tap-event-plugin'
import ListenLogUi from '../shared/native/listen-log-ui'
import {reduxDevToolsEnable, devStoreChangingFunctions} from '../shared/local-debug.desktop'
import {listenForNotifications} from '../shared/actions/notifications'
import hello from '../shared/util/hello'

import {devEditAction} from '../shared/reducers/dev-edit'
import {setupContextMenu} from '../app/menu-helper'

// For Remote Components
import electron, {ipcRenderer} from 'electron'
import RemoteManager from './remote-manager'
import {ipcLogsRenderer} from '../app/console-helper'
import loadPerf from '../shared/util/load-perf'
import merge from 'lodash/merge'
import {MuiThemeProvider} from 'material-ui/styles'
import materialTheme from '../shared/styles/material-theme.desktop'

ipcLogsRenderer()

if (module.hot) {
  module.hot.accept()
}

const store = configureStore()

if (devStoreChangingFunctions) {
  window.devEdit = (path, value) => store.dispatch(devEditAction(path, value))
}

class Keybase extends Component {
  state: {
    panelShowing: boolean
  };

  constructor () {
    super()

    loadPerf()

    this.state = {
      panelShowing: false,
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

    setupContextMenu(electron.remote.getCurrentWindow())

    // Used by material-ui widgets.
    if (module.hot) {
      // Don't reload this thing if we're hot reloading
      if (module.hot.data === undefined) {
        injectTapEventPlugin()
      }
    } else {
      injectTapEventPlugin()
    }

    this.setupDispatchAction()
    this.setupStoreSubscriptions()

    // Handle notifications from the service
    store.dispatch(listenForNotifications())

    // Handle logUi.log
    ListenLogUi()

    // Introduce ourselves to the service
    hello(process.pid, 'Main Renderer', process.argv, __VERSION__) // eslint-disable-line no-undef
  }

  setupDispatchAction () {
    ipcRenderer.on('dispatchAction', (event, action) => {
      // we MUST convert this else we'll run into issues with redux. See https://github.com/rackt/redux/issues/830
      // This is because this is touched due to the remote proxying. We get a __proto__ which causes the _.isPlainObject check to fail. We use
      // _.merge() to get a plain object back out which we can send
      setImmediate(() => {
        try {
          store.dispatch(merge({}, action))
        } catch (_) {
        }
      })
    })
  }

  setupStoreSubscriptions () {
    store.subscribe(() => {
      ipcRenderer.send('stateChange', store.getState())
    })
  }

  render () {
    let dt = null
    if (__DEV__ && reduxDevToolsEnable) { // eslint-disable-line no-undef
      const DevTools = require('./redux-dev-tools').default
      dt = <DevTools />
    }

    return (
      <MuiThemeProvider muiTheme={materialTheme}>
        <Provider store={store}>
          <div style={{display: 'flex', flex: 1}}>
            <RemoteManager />
            <Nav />
            {dt}
          </div>
        </Provider>
      </MuiThemeProvider>
    )
  }
}

ReactDOM.render(<Keybase />, document.getElementById('app'))
