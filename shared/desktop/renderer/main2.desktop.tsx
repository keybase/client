// Entry point to the chrome part of the app
import Main from '../../app/main.desktop'
// order of the above must NOT change. needed for patching / hot loading to be correct
import * as C from '../../constants'
import * as WaitingConstants from '../../constants/waiting'
import * as ConfigConstants from '../../constants/config'
import * as RemoteGen from '../../actions/remote-gen'
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
import {isWindows} from '../../constants/platform'
import type {TypedActions} from '../../actions/typed-actions-gen'
import KB2 from '../../util/electron.desktop'

const {ipcRendererOn, requestWindowsStartService, appStartedUp} = KB2.functions

// node side plumbs through initial pref so we avoid flashes
const darkModeFromNode = window.location.search.match(/darkModePreference=(alwaysLight|alwaysDark|system)/)
const isDarkFromNode = window.location.search.match(/isDarkMode=(0|1)/)

const {setDarkModePreference, setSystemDarkMode} = C.useDarkModeState.getState().dispatch

if (darkModeFromNode) {
  const dm = darkModeFromNode[1]
  switch (dm) {
    case 'alwaysLight':
    case 'alwaysDark':
    case 'system':
      setDarkModePreference(dm)
  }
}

if (isDarkFromNode) {
  setSystemDarkMode(isDarkFromNode[1] === '1')
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

const setupApp = (store: any, initListeners: any) => {
  disableDragDrop()

  const {batch} = WaitingConstants.useWaitingState.getState().dispatch
  const eng = makeEngine(store.dispatch, batch)
  initListeners()
  eng.listenersAreReady()

  ipcRendererOn?.('KBdispatchAction', (_: any, action: TypedActions) => {
    // we MUST convert this else we'll run into issues with redux. See https://github.com/rackt/redux/issues/830
    // This is because this is touched due to the remote proxying. We get a __proto__ which causes the _.isPlainObject check to fail. We use
    setTimeout(() => {
      try {
        if (action.type.startsWith(RemoteGen.typePrefix)) {
          ConfigConstants.useConfigState.getState().dispatch.eventFromRemoteWindows(action as any)
        } else {
          store.dispatch({
            payload: action.payload,
            type: action.type,
          })
        }
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

let store: any

const DarkCSSInjector = () => {
  const isDark = C.useDarkModeState(s => s.isDarkMode())
  const [lastIsDark, setLastIsDark] = React.useState<boolean | undefined>()
  if (lastIsDark !== isDark) {
    setLastIsDark(isDark)
    // inject it in body so modals get darkMode also
    if (isDark) {
      document.body.classList.add('darkMode')
      document.body.classList.remove('lightMode')
    } else {
      document.body.classList.remove('darkMode')
      document.body.classList.add('lightMode')
    }
  }
  return null
}

const render = (Component = Main) => {
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('No root element?')
  }

  // Wrap Root here if you want the app to be strict, it currently doesn't work with react-native-web
  // until 0.19.1+ lands. I tried this when it just did but there's other issues so we have to keep it off
  // else all nav stuff is broken
  // <React.StrictMode>
  // </React.StrictMode>
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

const setupHMR = () => {
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
  setupHMR()

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
