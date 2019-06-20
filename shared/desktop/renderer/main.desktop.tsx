// Entry point to the chrome part of the app
import '../../util/user-timings'
import Main from '../../app/main.desktop'
// order of the above 2 must NOT change. needed for patching / hot loading to be correct
import * as NotificationsGen from '../../actions/notifications-gen'
import * as React from 'react'
import * as ConfigGen from '../../actions/config-gen'
import ReactDOM from 'react-dom'
import RemoteProxies from '../remote/proxies.desktop'
import Root from './container.desktop'
import configureStore from '../../store/configure-store'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {makeEngine} from '../../engine'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {merge} from 'lodash-es'
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
      // @ts-ignore codemode issue
      window.DEBUGStore = _store
    }
  }

  return {runSagas, store}
}

function setupApp(store, runSagas) {
  disableDragDrop()
  const eng = makeEngine(store.dispatch, store.getState)
  runSagas && runSagas()
  eng.sagasAreReady()

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

  // Handle notifications from the service
  store.dispatch(NotificationsGen.createListenForNotifications())

  // Check for a startup URL
  SafeElectron.getIpcRenderer().send('reduxLaunched')
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
    <p style={{fontFamily: 'Keybase', fontStyle: 'italic', fontWeight: 700}}>keybase 700 i</p>
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

function setupHMR(store) {
  const accept = module.hot && module.hot.accept
  if (!accept) {
    return
  }

  const refreshMain = () => {
    try {
      const NewMain = require('../../app/main.desktop').default
      render(store, NewMain)
    } catch (_) {}
  }

  accept(['../../app/main.desktop'], refreshMain)
  accept('../../common-adapters/index.js', () => {})
}

function load() {
  if (global.DEBUGLoaded) {
    // only load once
    console.log('Bail on load() on HMR')
    return
  }
  global.DEBUGLoaded = true
  initDesktopStyles()
  const {store, runSagas} = setupStore()
  setupApp(store, runSagas)
  setupHMR(store)
  render(store, Main)
}

load()
