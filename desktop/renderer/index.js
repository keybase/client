// @flow
/*
 * The main renderer. Holds the global store. When it changes we send it to the main thread which then sends it out to subscribers
 */

import React from 'react'
import ReactDOM from 'react-dom'
import Root from './container'
import configureStore from '../shared/store/configure-store'
import electron, {ipcRenderer} from 'electron'
import engine, {makeEngine} from '../shared/engine'
import hello from '../shared/util/hello'
import injectTapEventPlugin from 'react-tap-event-plugin'
import loadPerf from '../shared/util/load-perf'
import {merge} from 'lodash'
import {AppContainer} from 'react-hot-loader'
import {bootstrap} from '../shared/actions/config'
import {devEditAction} from '../shared/reducers/dev-edit'
import {devStoreChangingFunctions} from '../shared/local-debug.desktop'
import {listenForNotifications} from '../shared/actions/notifications'
import {setupContextMenu} from '../app/menu-helper'
// $FlowIssue
import {setupSource} from '../shared/util/forward-logs'
import {updateDebugConfig} from '../shared/actions/dev'
import {updateReloading} from '../shared/constants/dev'

function setupApp (store) {
  setupSource()
  makeEngine()

  loadPerf()

  if (devStoreChangingFunctions) {
    window.devEdit = (path, value) => store.dispatch(devEditAction(path, value))
  }

  if (__DEV__ && process.env.KEYBASE_LOCAL_DEBUG) {
    require('devtron').install()
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

  store.subscribe(() => {
    ipcRenderer.send('stateChange', store.getState())
  })

  // Handle notifications from the service
  store.dispatch(listenForNotifications())

  // Introduce ourselves to the service
  hello(process.pid, 'Main Renderer', process.argv, __VERSION__) // eslint-disable-line no-undef

  store.dispatch(updateDebugConfig(require('../shared/local-debug-live')))

  store.dispatch(bootstrap())
  // Restartup when we connect online.
  // If you startup while offline, you'll stay in an errored state
  window.addEventListener('online', () => store.dispatch(bootstrap()))
}

const store = configureStore()

setupApp(store)

const appEl = document.getElementById('app')

ReactDOM.render(
  <AppContainer><Root store={store} /></AppContainer>,
  appEl,
)

module.hot && typeof module.hot.accept === 'function' && module.hot.accept('./container', () => {
  try {
    store.dispatch({type: updateReloading, payload: {reloading: true}})
    const NewRoot = require('./container').default
    ReactDOM.render(
      <AppContainer><NewRoot store={store} /></AppContainer>,
      appEl,
    )
    engine().reset()
  } finally {
    setTimeout(() => store.dispatch({type: updateReloading, payload: {reloading: false}}), 10e3)
  }
})

module.hot && typeof module.hot.accept === 'function' && module.hot.accept('../shared/local-debug-live', () => {
  store.dispatch(updateDebugConfig(require('../shared/local-debug-live')))
})
