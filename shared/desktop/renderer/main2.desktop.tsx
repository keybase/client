// Entry point to the chrome part of the app
import Main from '@/app/main.desktop'
// order of the above must NOT change. needed for patching / hot loading to be correct
import * as C from '@/constants'
import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import type * as RemoteGen from '@/actions/remote-gen'
import Root from './container.desktop'
import {makeEngine} from '@/engine'
import {disableDragDrop} from '@/util/drag-drop.desktop'
import {dumpLogs, eventFromRemoteWindows} from '@/constants/platform-specific/index.desktop'
import {initDesktopStyles} from '@/styles/index.desktop'
import {isWindows} from '@/constants/platform'
import KB2 from '@/util/electron.desktop'
import {debugWarning} from '@/util/debug-warning'
import type {default as NewMainType} from '../../app/main.desktop'
import {setServiceDecoration} from '@/common-adapters/markdown/react'
import ServiceDecoration from '@/common-adapters/markdown/service-decoration'
import {useDarkModeState} from '@/constants/darkmode'
import {initPlatformListener} from '@/constants/init/index.desktop'
setServiceDecoration(ServiceDecoration)

const {ipcRendererOn, requestWindowsStartService, appStartedUp} = KB2.functions

// node side plumbs through initial pref so we avoid flashes
const darkModeFromNode = window.location.search.match(/darkMode=(light|dark)/)
const setSystemDarkMode = useDarkModeState.getState().dispatch.setSystemDarkMode

if (darkModeFromNode) {
  const dm = darkModeFromNode[1]
  switch (dm) {
    case 'light':
      setSystemDarkMode(false)
      break
    case 'dark':
      setSystemDarkMode(true)
      break
    default:
  }
}

// Top level HMR accept
if (module.hot) {
  module.hot.accept()
}

const setupApp = () => {
  disableDragDrop()

  const {batch} = C.useWaitingState.getState().dispatch
  const eng = makeEngine(batch, () => {
    // do nothing we wait for the remote version from node
  })
  initPlatformListener()
  eng.listenersAreReady()

  ipcRendererOn?.('KBdispatchAction', (_: unknown, action: unknown) => {
    setTimeout(() => {
      try {
        eventFromRemoteWindows(action as RemoteGen.Actions)
      } catch {}
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

const UseStrict = true as boolean
const WRAP = UseStrict
  ? ({children}: {children: React.ReactNode}) => <React.StrictMode>{children}</React.StrictMode>
  : ({children}: {children: React.ReactNode}) => <>{children}</>

const render = (Component = Main) => {
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('No root element?')
  }

  // Wrap Root here if you want the app to be strict, it currently doesn't work with react-native-web
  // until 0.19.1+ lands. I tried this when it just did but there's other issues so we have to keep it off
  // else all nav stuff is broken
  ReactDOM.createRoot(root).render(
    <WRAP>
      <Root>
        <FontLoader />
        <div style={{display: 'flex', flex: 1}}>
          <Component />
        </div>
      </Root>
    </WRAP>
  )
}

const setupHMR = () => {
  if (!module.hot?.accept) {
    return
  }

  const refreshMain = () => {
    try {
      const {default: NewMain} = require('../../app/main.desktop') as {default: typeof NewMainType}
      render(NewMain)
    } catch {}
  }

  module.hot.accept(['../../app/main.desktop'], refreshMain)
  module.hot.accept(['../../common-adapters/index'], () => {})
}

const load = () => {
  if (global.DEBUGLoaded) {
    // only load once
    console.log('Bail on load() on HMR')
    return
  }
  global.DEBUGLoaded = true
  initDesktopStyles()
  setupApp()
  setupHMR()

  if (__DEV__) {
    // let us load devtools first
    const DEBUG_DEFER = false as boolean
    if (DEBUG_DEFER) {
      debugWarning('DEBUG_DEFER on!!!')
      const e = <div>temp</div>
      const root = document.getElementById('root')
      root && ReactDOM.createRoot(root).render(e)
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
