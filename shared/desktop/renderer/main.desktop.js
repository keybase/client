// @flow
// Entry point to the chrome part of the app
import '../../util/user-timings'
import Main from '../../app/main.desktop'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as NotificationsGen from '../../actions/notifications-gen'
import * as React from 'react'
import * as ConfigGen from '../../actions/config-gen'
import {setupLoginHMR} from '../../actions/login'
import ReactDOM from 'react-dom'
import RemoteProxies from '../remote/proxies.desktop'
import Root from './container.desktop'
import configureStore from '../../store/configure-store'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {makeEngine, getEngine} from '../../engine'
import loginRouteTree from '../../app/routes-login'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {throttle, merge} from 'lodash-es'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {setupContextMenu} from '../app/menu-helper.desktop'
import flags from '../../util/feature-flags'
import {dumpLogs} from '../../actions/platform-specific/index.desktop'
import {initDesktopStyles} from '../../styles/index.desktop'

// Top level HMR accept
if (module.hot) {
  module.hot.accept()
}

let _store

function setupStore() {
  let store = _store
  let runSagas
  if (!_store) {
    const configured = configureStore()
    store = configured.store
    runSagas = configured.runSagas

    _store = store
    if (__DEV__ && flags.admin) {
      window.DEBUGStore = _store
    }
  }

  return {runSagas, store}
}

function setupApp(store, runSagas) {
  disableDragDrop()
  const eng = makeEngine(store.dispatch, store.getState)
  runSagas?.()

  setupContextMenu(SafeElectron.getRemote().getCurrentWindow())

  // Listen for the menubarWindowID
  SafeElectron.getIpcRenderer().on('updateMenubarWindowID', (event, id) => {
    store.dispatch(ConfigGen.createUpdateMenubarWindowID({id}))
  })

  SafeElectron.getIpcRenderer().on('dispatchAction', (event, action) => {
    // we MUST convert this else we'll run into issues with redux. See https://github.com/rackt/redux/issues/830
    // This is because this is touched due to the remote proxying. We get a __proto__ which causes the _.isPlainObject check to fail. We use
    // _.merge() to get a plain object back out which we can send
    setImmediate(() => {
      try {
        store.dispatch(merge({}, action))
      } catch (_) {}
    })
  })

  SafeElectron.getIpcRenderer().send('mainWindowWantsMenubarWindowID')

  // See if we're connected, and try starting keybase if not
  setImmediate(() => {
    if (!eng.hasEverConnected()) {
      SafeElectron.getIpcRenderer().send('kb-service-check')
    }
  })

  // After a delay dump logs in case some startup stuff happened
  setTimeout(() => {
    dumpLogs()
  }, 5 * 1000)

  // Run installer
  SafeElectron.getIpcRenderer().on('installed', (event, message) => {
    store.dispatch(ConfigGen.createInstallerRan())
  })
  SafeElectron.getIpcRenderer().send('install-check')

  const subsetsRemotesCareAbout = store => {
    return {
      tracker: store.tracker,
    }
  }

  let _currentStore
  store.subscribe(
    throttle(() => {
      let previousStore = _currentStore
      _currentStore = subsetsRemotesCareAbout(store.getState())

      if (JSON.stringify(previousStore) !== JSON.stringify(_currentStore)) {
        SafeElectron.getIpcRenderer().send('stateChange', store.getState())
      }
    }, 1000)
  )

  // Handle notifications from the service
  store.dispatch(NotificationsGen.createListenForNotifications())

  // Introduce ourselves to the service
  getEngine().actionOnConnect('hello', () => {
    RPCTypes.configHelloIAmRpcPromise({
      details: {
        argv: process.argv,
        clientType: RPCTypes.commonClientType.guiMain,
        desc: 'Main Renderer',
        pid: process.pid,
        version: __VERSION__, // eslint-disable-line no-undef
      },
    }).catch(_ => {})
  })
}

const FontLoader = () => (
  <div style={{height: 0, overflow: 'hidden', width: 0}}>
    <p style={{fontFamily: 'kb'}}>kb</p>
    <p style={{fontFamily: 'Source Code Pro', fontWeight: 500}}>source code pro 500</p>
    <p style={{fontFamily: 'Source Code Pro', fontWeight: 600}}>source code pro 600</p>
    <p style={{fontFamily: 'Keybase', fontWeight: 400}}>keybase 400</p>
    <p style={{fontFamily: 'Keybase', fontStyle: 'italic', fontWeight: 400}}>keybase 400 i</p>
    <p style={{fontFamily: 'Keybase', fontWeight: 600}}>keybase 600</p>
    <p style={{fontFamily: 'Keybase', fontStyle: 'italic', fontWeight: 600}}>keybase 600 i</p>
    <p style={{fontFamily: 'Keybase', fontWeight: 700}}>keybase 700</p>
  </div>
)

function render(store, MainComponent) {
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('No root element?')
  }
  ReactDOM.render(
    <Root store={store}>
      <div style={{display: 'flex', flex: 1}}>
        <RemoteProxies />
        <FontLoader />
        <MainComponent />
      </div>
    </Root>,
    root
  )
}

function setupRoutes(store) {
  store.dispatch(RouteTreeGen.createSetInitialRouteDef({routeDef: loginRouteTree}))
}

function setupHMR(store) {
  const accept = module.hot?.accept
  if (!accept) {
    return
  }

  const refreshRoutes = () => {
    const appRouteTree = require('../../app/routes-app').default
    const loginRouteTree = require('../../app/routes-login').default
    store.dispatch(RouteTreeGen.createRefreshRouteDef({appRouteTree, loginRouteTree}))
    try {
      const NewMain = require('../../app/main.desktop').default
      render(store, NewMain)
    } catch (_) {}
  }

  accept(['../../app/main.desktop', '../../app/routes-app', '../../app/routes-login'], refreshRoutes)
  accept('../../common-adapters/index.js', () => {})
  setupLoginHMR(refreshRoutes)
}

function load() {
  if (global.loaded) {
    // only load once
    console.log('Bail on load() on HMR')
    return
  }
  global.loaded = true
  initDesktopStyles()
  const {store, runSagas} = setupStore()
  setupApp(store, runSagas)
  setupRoutes(store)
  setupHMR(store)
  render(store, Main)
}

load()
