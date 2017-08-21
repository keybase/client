// @flow
/*
 * The main renderer. Holds the global store. When it changes we send it to the main thread which then sends it out to subscribers
 */

import Main from '../../app/main.desktop'
import React from 'react'
import ReactDOM from 'react-dom'
import RemoteManager from './remote-manager'
import Root from './container'
import configureStore from '../../store/configure-store'
import electron, {ipcRenderer} from 'electron'
import engine, {makeEngine} from '../../engine'
import hello from '../../util/hello'
import loadPerf from '../../util/load-perf'
import routeDefs from '../../app/routes'
import {AppContainer} from 'react-hot-loader'
import {bootstrap} from '../../actions/config'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {getUserImageMap, loadUserImageMap, getTeamImageMap, loadTeamImageMap} from '../../util/pictures'
import {initAvatarLookup, initAvatarLoad} from '../../common-adapters'
import {listenForNotifications} from '../../actions/notifications'
import {changedFocus} from '../../actions/app'
import merge from 'lodash/merge'
import throttle from 'lodash/throttle'
import {resetEngineOnHMR} from '../../local-debug.desktop'
import {selector as menubarSelector} from '../../menubar/selector'
import {selector as pineentrySelector} from '../../pinentry/selector'
import {selector as remotePurgeMessageSelector} from '../../pgp/selector'
import {selector as unlockFoldersSelector} from '../../unlock-folders/selector'
import {setRouteDef} from '../../actions/route-tree'
import {setupContextMenu} from '../app/menu-helper'
import {setupSource} from '../../util/forward-logs'
import flags from '../../util/feature-flags'
import {updateDebugConfig} from '../../actions/dev'
import {updateReloading} from '../../constants/dev'

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

function setupAvatar() {
  initAvatarLookup(getUserImageMap, getTeamImageMap)
  initAvatarLoad(loadUserImageMap, loadTeamImageMap)
}

function setupApp(store) {
  setupSource()
  disableDragDrop()
  const eng = makeEngine()
  loadPerf()
  setupAvatar()

  if (__DEV__ && process.env.KEYBASE_LOCAL_DEBUG) {
    require('devtron').install()
  }

  setupContextMenu(electron.remote.getCurrentWindow())

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

  // After a delay, see if we're connected, and try starting keybase if not
  setTimeout(() => {
    if (!eng.hasEverConnected()) {
      ipcRenderer.send('kb-service-check')
    }
  }, 3 * 1000)

  // Run installer
  ipcRenderer.on('installed', (event, message) => {
    store.dispatch({payload: undefined, type: 'config:readyForBootstrap'})
    store.dispatch(bootstrap())
  })
  ipcRenderer.send('install-check')

  window.addEventListener('focus', () => {
    store.dispatch(changedFocus(true))
  })
  window.addEventListener('blur', () => {
    store.dispatch(changedFocus(false))
  })

  const _menubarSelector = menubarSelector()
  const _unlockFoldersSelector = unlockFoldersSelector()
  const _pineentrySelector = pineentrySelector()
  const _remotePurgeMessageSelector = remotePurgeMessageSelector()

  const subsetsRemotesCareAbout = store => {
    return {
      tracker: store.tracker,
      menubar: _menubarSelector(store),
      unlockFolder: _unlockFoldersSelector(store),
      pinentry: _pineentrySelector(store),
      pgpPurgeMessage: _remotePurgeMessageSelector(store),
    }
  }

  let _currentStore
  store.subscribe(
    throttle(() => {
      let previousStore = _currentStore
      _currentStore = subsetsRemotesCareAbout(store.getState())

      if (JSON.stringify(previousStore) !== JSON.stringify(_currentStore)) {
        ipcRenderer.send('stateChange', {
          ...store.getState(),
          // this is a HACK workaround where we can't send immutable over the wire to the main thread (and out again).
          // I have a much better way to handle this we can prioritize post-mobile launch (CN)
          notifications: _currentStore.menubar.notifications,
        })
      }
    }, 1000)
  )

  // Handle notifications from the service
  store.dispatch(listenForNotifications())

  // Introduce ourselves to the service
  hello(process.pid, 'Main Renderer', process.argv, __VERSION__, true) // eslint-disable-line no-undef

  store.dispatch(updateDebugConfig(require('../../local-debug-live')))
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
  ReactDOM.render(
    <AppContainer>
      <Root store={store}>
        <div style={{display: 'flex', flex: 1}}>
          <RemoteManager />
          <FontLoader />
          <MainComponent />
        </div>
      </Root>
    </AppContainer>,
    document.getElementById('root')
  )
}

function setupRoutes(store) {
  store.dispatch(setRouteDef(routeDefs))
}

function setupHMR(store) {
  if (!module || !module.hot || typeof module.hot.accept !== 'function') {
    return
  }

  module.hot &&
    module.hot.accept(['../../app/main.desktop', '../../app/routes'], () => {
      store.dispatch(setRouteDef(require('../../app/routes').default))
      try {
        store.dispatch({type: updateReloading, payload: {reloading: true}})
        const NewMain = require('../../app/main.desktop').default
        render(store, NewMain)
        if (resetEngineOnHMR) {
          engine().reset()
        }
      } finally {
        setTimeout(() => store.dispatch({type: updateReloading, payload: {reloading: false}}), 10e3)
      }
    })

  module.hot &&
    module.hot.accept('../../local-debug-live', () => {
      store.dispatch(updateDebugConfig(require('../../local-debug-live')))
    })

  module.hot && module.hot.accept('../../common-adapters/index.js', () => {})
}

function load() {
  const store = setupStore()
  setupRoutes(store)
  setupApp(store)
  setupHMR(store)
  render(store, Main)
}

window.load = load
