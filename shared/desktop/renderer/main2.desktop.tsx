// Entry point to the chrome part of the app
import '../../util/user-timings'
import Main from '../../app/main.desktop'
// order of the above 2 must NOT change. needed for patching / hot loading to be correct
import * as Electron from 'electron'
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
import flags from '../../util/feature-flags'
import {dumpLogs} from '../../actions/platform-specific/index.desktop'
import {initDesktopStyles} from '../../styles/index.desktop'
import {_setDarkModePreference} from '../../styles/dark-mode'
import {isDarwin, isWindows} from '../../constants/platform'
import {useSelector} from '../../util/container'
import {isDarkMode} from '../../constants/config'
import {TypedActions} from '../../actions/typed-actions-gen'

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
  let runSagas: any
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

const setupApp = (store, runSagas) => {
  disableDragDrop()
  const eng = makeEngine(store.dispatch, store.getState)
  runSagas && runSagas()
  eng.sagasAreReady()

  Electron.ipcRenderer.on('KBdispatchAction', (_: any, action: TypedActions) => {
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
      Electron.ipcRenderer.invoke('KBkeybase', {type: 'requestWindowsStartService'})
    }, 0)
  }

  // After a delay dump logs in case some startup stuff happened
  setTimeout(() => {
    dumpLogs()
  }, 5 * 1000)

  // Handle notifications from the service
  store.dispatch(NotificationsGen.createListenForNotifications())

  Electron.ipcRenderer.invoke('KBkeybase', {type: 'appStartedUp'})
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

  ReactDOM.render(
    <Root store={store}>
      <DarkCSSInjector />
      <RemoteProxies />
      <FontLoader />
      <div style={{display: 'flex', flex: 1}}>
        <Component />
      </div>
    </Root>,
    root
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

const setupDarkMode = () => {
  if (isDarwin && SafeElectron.getSystemPreferences().subscribeNotification) {
    SafeElectron.getSystemPreferences().subscribeNotification(
      'AppleInterfaceThemeChangedNotification',
      () => {
        store.dispatch(
          ConfigGen.createSetSystemDarkMode({
            dark: SafeElectron.workingIsDarkMode(),
          })
        )
      }
    )
  }
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
  const {runSagas} = temp
  store = temp.store
  setupApp(store, runSagas)
  setupHMR(store)
  setupDarkMode()
  render()
}

load()
