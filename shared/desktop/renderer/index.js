// @flow
/*
 * The main renderer. Holds the global store. When it changes we send it to the main thread which then sends it out to subscribers
 */
import '../../dev/user-timings'
import Main from '../../app/main.desktop'
import * as AppGen from '../../actions/app-gen'
import * as DevGen from '../../actions/dev-gen'
import * as NotificationsGen from '../../actions/notifications-gen'
import * as React from 'react'
import * as ConfigGen from '../../actions/config-gen'
import {setupLoginHMR} from '../../actions/login'
import ReactDOM from 'react-dom'
import RemoteProxies from '../remote/proxies.desktop'
import Root from './container'
import configureStore from '../../store/configure-store'
import electron, {ipcRenderer} from 'electron'
import {makeEngine} from '../../engine'
import hello from '../../util/hello'
import loadPerf from '../../util/load-perf'
import loginRouteTree from '../../app/routes-login'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {throttle, merge} from 'lodash-es'
import {refreshRouteDef, setInitialRouteDef} from '../../actions/route-tree'
import {setupContextMenu} from '../app/menu-helper'
import flags from '../../util/feature-flags'
import InputMonitor from './input-monitor'
import dumpLogs from '../../logger/dump-log-fs'

let _store
function setupStore() {
  if (!_store) {
    _store = configureStore()

    if (flags.admin) {
      window.DEBUGStore = _store
    }
  }

  return _store
}

function setupApp(store) {
  disableDragDrop()
  const eng = makeEngine(store.dispatch, store.getState)
  loadPerf()

  if (__DEV__ && process.env.KEYBASE_LOCAL_DEBUG) {
    require('devtron').install()
  }

  setupContextMenu(electron.remote.getCurrentWindow())

  // Tell the main window some remote window needs its props
  ipcRenderer.on('remoteWindowWantsProps', (event, windowComponent, windowParam) => {
    store.dispatch({type: 'remote:needProps', payload: {windowComponent, windowParam}})
  })

  // Listen for the menubarWindowID
  ipcRenderer.on('updateMenubarWindowID', (event, id) => {
    store.dispatch({type: 'remote:updateMenubarWindowID', payload: {id}})
  })

  ipcRenderer.on('dispatchAction', (event, action) => {
    // we MUST convert this else we'll run into issues with redux. See https://github.com/rackt/redux/issues/830
    // This is because this is touched due to the remote proxying. We get a __proto__ which causes the _.isPlainObject check to fail. We use
    // _.merge() to get a plain object back out which we can send
    setImmediate(() => {
      try {
        store.dispatch(merge({}, action))
      } catch (_) {}
    })
  })

  ipcRenderer.send('mainWindowWantsMenubarWindowID')

  // After a delay, see if we're connected, and try starting keybase if not
  setTimeout(() => {
    if (!eng.hasEverConnected()) {
      ipcRenderer.send('kb-service-check')
    }
  }, 3 * 1000)

  // After a delay dump logs in case some startup stuff happened
  setTimeout(() => {
    dumpLogs()
  }, 5 * 1000)

  // Run installer
  ipcRenderer.on('installed', (event, message) => {
    store.dispatch(ConfigGen.createReadyForBootstrap())
    store.dispatch(ConfigGen.createBootstrap({}))
  })
  ipcRenderer.send('install-check')

  var inputMonitor = new InputMonitor(function(isActive) {
    store.dispatch(AppGen.createChangedActive({userActive: isActive}))
    ipcRenderer.send('setAppState', {isUserActive: isActive})
  })
  inputMonitor.startActiveTimer()

  window.addEventListener('focus', () => {
    inputMonitor.goActive()
    store.dispatch(AppGen.createChangedFocus({appFocused: true}))
  })
  window.addEventListener('blur', () => {
    store.dispatch(AppGen.createChangedFocus({appFocused: false}))
  })

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
        ipcRenderer.send('stateChange', store.getState())
      }
    }, 1000)
  )

  // Handle notifications from the service
  store.dispatch(NotificationsGen.createListenForNotifications())

  // Introduce ourselves to the service
  hello(process.pid, 'Main Renderer', process.argv, __VERSION__, true) // eslint-disable-line no-undef

  // $FlowIssue doesn't like the require
  store.dispatch(DevGen.createUpdateDebugConfig({config: require('../../local-debug-live')}))
}

const FontLoader = () => (
  <div style={{height: 0, overflow: 'hidden', width: 0}}>
    <p style={{fontFamily: 'kb'}}>kb</p>
    <p style={{fontFamily: 'Source Code Pro', fontWeight: 400}}>source code pro 400</p>
    <p style={{fontFamily: 'Source Code Pro', fontWeight: 600}}>source code pro 600</p>
    <p style={{fontFamily: 'OpenSans', fontWeight: 400}}>open sans 400</p>
    <p style={{fontFamily: 'OpenSans', fontStyle: 'italic', fontWeight: 400}}>open sans 400 i</p>
    <p style={{fontFamily: 'OpenSans', fontWeight: 600}}>open sans 600</p>
    <p style={{fontFamily: 'OpenSans', fontStyle: 'italic', fontWeight: 600}}>open sans 600 i</p>
    <p style={{fontFamily: 'OpenSans', fontWeight: 700}}>open sans 700</p>
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
  store.dispatch(setInitialRouteDef(loginRouteTree))
}

function setupHMR(store) {
  if (!module || !module.hot || typeof module.hot.accept !== 'function') {
    return
  }

  const refreshRoutes = () => {
    const appRouteTree = require('../../app/routes-app').default
    const loginRouteTree = require('../../app/routes-login').default
    store.dispatch(refreshRouteDef(loginRouteTree, appRouteTree))
    try {
      const NewMain = require('../../app/main.desktop').default
      render(store, NewMain)
    } catch (_) {}
  }

  module.hot &&
    module.hot.accept(
      ['../../app/main.desktop', '../../app/routes-app', '../../app/routes-login'],
      refreshRoutes
    )

  module.hot &&
    module.hot.accept('../../local-debug-live', () => {
      // $FlowIssue doesn't like the require
      store.dispatch(DevGen.createUpdateDebugConfig({config: require('../../local-debug-live')}))
    })

  module.hot && module.hot.accept('../../common-adapters/index.js', () => {})

  setupLoginHMR(refreshRoutes)
}

function load() {
  const store = setupStore()
  setupRoutes(store)
  setupApp(store)
  setupHMR(store)
  render(store, Main)
}

window.load = load
