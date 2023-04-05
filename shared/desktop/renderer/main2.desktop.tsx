// Entry point to the chrome part of the app
import Main from '../../app/main.desktop'
// order of the above 2 must NOT change. needed for patching / hot loading to be correct
import * as NotificationsGen from '../../actions/notifications-gen'
import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import RemoteProxies from '../remote/proxies.desktop'
import Root from './container.desktop'
import makeStore from '../../store/configure-store'
import {makeEngine} from '../../engine'
import {disableDragDrop} from '../../util/drag-drop.desktop'
import flags from '../../util/feature-flags'
import {dumpLogs} from '../../actions/platform-specific/index.desktop'
import {initDesktopStyles} from '../../styles/index.desktop'
import {_setDarkModePreference} from '../../styles/dark-mode'
import {isWindows} from '../../constants/platform'
import {useSelector} from '../../util/container'
import {isDarkMode} from '../../constants/config'
import type {TypedActions} from '../../actions/typed-actions-gen'
import KB2 from '../../util/electron.desktop'

const {ipcRendererOn, requestWindowsStartService, appStartedUp} = KB2.functions

// node side plumbs through initial pref so we avoid flashes
const darkModeFromNode = window.location.search.match(/darkModePreference=(alwaysLight|alwaysDark|system)/)

if (darkModeFromNode) {
  const dm = darkModeFromNode[1]
  switch (dm) {
    case 'alwaysLight':
    case 'alwaysDark':
    case 'system':
      _setDarkModePreference(dm)
  }
}

// Top level HMR accept
if (module.hot) {
  module.hot.accept()
}

let _store: any

const setupStore = () => {
  let store = _store
  let initListeners: any
  if (!_store) {
    const configured = makeStore()
    store = configured.store
    initListeners = configured.initListeners

    _store = store
    if (__DEV__ && flags.admin) {
      // @ts-ignore codemode issue
      window.DEBUGStore = _store
    }
  }

  return {initListeners, store}
}

const setupApp = (store, initListeners) => {
  disableDragDrop()
  const eng = makeEngine(store.dispatch)
  initListeners()
  eng.listenersAreReady()

  ipcRendererOn?.('KBdispatchAction', (_: any, action: TypedActions) => {
    // we MUST convert this else we'll run into issues with redux. See https://github.com/rackt/redux/issues/830
    // This is because this is touched due to the remote proxying. We get a __proto__ which causes the _.isPlainObject check to fail. We use
    setTimeout(() => {
      try {
        store.dispatch({
          payload: action.payload,
          type: action.type,
        })
      } catch (_) {}
    }, 0)
  })

  // See if we're connected, and try starting keybase if not
  if (isWindows) {
    setTimeout(() => {
      requestWindowsStartService?.()
    }, 0)
  }

  // After a delay dump logs in case some startup stuff happened
  setTimeout(() => {
    dumpLogs()
      .then(() => {})
      .catch(() => {})
  }, 5 * 1000)

  // Handle notifications from the service
  store.dispatch(NotificationsGen.createListenForNotifications())

  appStartedUp?.()
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

let store

const DarkCSSInjector = () => {
  const isDark = useSelector(state => isDarkMode(state.config))
  React.useEffect(() => {
    // inject it in body so modals get darkMode also
    if (isDark) {
      document.body.classList.add('darkMode')
      document.body.classList.remove('lightMode')
    } else {
      document.body.classList.remove('darkMode')
      document.body.classList.add('lightMode')
    }
  }, [isDark])
  return null
}

const render = (Component = Main) => {
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('No root element?')
  }

  ReactDOM.createRoot(root).render(
    <Root store={store}>
      <DarkCSSInjector />
      <RemoteProxies />
      <FontLoader />
      <div style={{display: 'flex', flex: 1}}>
        <Component />
      </div>
    </Root>
  )
}

const setupHMR = _ => {
  const accept = module.hot && module.hot.accept
  if (!accept) {
    return
  }

  const refreshMain = () => {
    try {
      const NewMain = require('../../app/main.desktop').default
      render(NewMain)
    } catch (_) {}
  }

  accept(['../../app/main.desktop'], refreshMain)
  accept('../../common-adapters/index.js', () => {})
}

const load = () => {
  if (global.DEBUGLoaded) {
    // only load once
    console.log('Bail on load() on HMR')
    return
  }
  global.DEBUGLoaded = true
  initDesktopStyles()
  const temp = setupStore()
  const {initListeners} = temp
  store = temp.store
  setupApp(store, initListeners)
  setupHMR(store)

  if (__DEV__) {
    // let us load devtools first
    const DEBUG_DEFER = false
    if (DEBUG_DEFER) {
      for (let i = 0; i < 10; ++i) {
        console.log('DEBUG_DEFER on!!!')
      }
      const e: any = <div>temp</div>
      ReactDOM.createRoot(document.getElementById('root')!, e)
      setTimeout(() => {
        render()
      }, 5000)
    } else {
      render()
    }
  } else {
    render()
  }
}

load()
