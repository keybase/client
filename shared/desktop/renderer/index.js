// @flow
/*
 * The main renderer. Holds the global store. When it changes we send it to the main thread which then sends it out to subscribers
 */

import Main from '../../main.desktop'
import React from 'react'
import ReactDOM from 'react-dom'
import RemoteManager from './remote-manager'
import Root from './container'
import configureStore from '../../store/configure-store'
import electron, {ipcRenderer} from 'electron'
import engine, {makeEngine} from '../../engine'
import hello from '../../util/hello'
import injectTapEventPlugin from 'react-tap-event-plugin'
import loadPerf from '../../util/load-perf'
import routeDefs from '../../routes'
import {AppContainer} from 'react-hot-loader'
import {bootstrap} from '../../actions/config'
import {devEditAction} from '../../reducers/dev-edit'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {listenForNotifications} from '../../actions/notifications'
import {changedFocus} from '../../actions/window'
import {merge} from 'lodash'
import {reduxDevToolsEnable, devStoreChangingFunctions} from '../../local-debug.desktop'
import {setRouteDef} from '../../actions/route-tree'
import {setupContextMenu} from '../app/menu-helper'
import {setupSource} from '../../util/forward-logs'
import {updateDebugConfig} from '../../actions/dev'
import {updateReloading} from '../../constants/dev'

let _store
function setupStore () {
  if (!_store) {
    _store = configureStore()
  }
  return _store
}

function setupApp (store) {
  setupSource()
  disableDragDrop()
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

  const currentWindow = electron.remote.getCurrentWindow()
  currentWindow.on('focus', () => {
    store.dispatch(changedFocus(true))
  })
  currentWindow.on('blur', () => {
    store.dispatch(changedFocus(false))
  })

  store.subscribe(() => {
    ipcRenderer.send('stateChange', store.getState())
  })

  // Handle notifications from the service
  store.dispatch(listenForNotifications())

  // Introduce ourselves to the service
  hello(process.pid, 'Main Renderer', process.argv, __VERSION__) // eslint-disable-line no-undef

  store.dispatch(updateDebugConfig(require('../../local-debug-live')))

  store.dispatch(bootstrap())
}

function render (store, MainComponent) {
  let dt
  if (__DEV__ && reduxDevToolsEnable) { // eslint-disable-line no-undef
    const DevTools = require('./redux-dev-tools').default
    dt = <DevTools />
  }

  ReactDOM.render((
    <AppContainer>
      <Root store={store}>
        <div style={{display: 'flex', flex: 1}}>
          <RemoteManager />
          <MainComponent />
          {dt}
        </div>
      </Root>
    </AppContainer>), document.getElementById('root'))
}

function setupRoutes (store) {
  store.dispatch(setRouteDef(routeDefs))
}

function setupHMR (store) {
  if (!module || !module.hot || typeof module.hot.accept !== 'function') {
    return
  }

  module.hot && module.hot.accept(['../../main.desktop', '../../routes'], () => {
    store.dispatch(setRouteDef(require('../../routes').default))
    try {
      store.dispatch({type: updateReloading, payload: {reloading: true}})
      const NewMain = require('../../main.desktop').default
      render(store, NewMain)
      engine().reset()
    } finally {
      setTimeout(() => store.dispatch({type: updateReloading, payload: {reloading: false}}), 10e3)
    }
  })

  module.hot && module.hot.accept('../../local-debug-live', () => {
    store.dispatch(updateDebugConfig(require('../../local-debug-live')))
  })
}

function load () {
  const store = setupStore()
  setupRoutes(store)
  setupApp(store)
  setupHMR(store)
  render(store, Main)
}

window.load = load
