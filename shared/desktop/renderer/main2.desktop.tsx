// Entry point to the chrome part of the app
import Main from '@/app/main.desktop'
// order of the above must NOT change. needed for patching / hot loading to be correct
import * as C from '@/constants'
import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import type * as RemoteGen from '@/actions/remote-gen'
import {GlobalKeyEventHandler} from '@/common-adapters/key-event-handler.desktop'
import {CanFixOverdrawContext} from '@/styles'
import {makeEngine} from '@/engine'
import {disableDragDrop} from '@/util/drag-drop.desktop'
import {initDesktopStyles} from '@/styles/index.desktop'
import {isWindows} from '@/constants/platform'
import KB2 from '@/util/electron.desktop'
import {useConfigState} from '@/stores/config'
import {setServiceDecoration} from '@/common-adapters/markdown/react'
import ServiceDecoration from '@/common-adapters/markdown/service-decoration'
import {useDarkModeState} from '@/stores/darkmode'
import {initPlatformListener, onEngineIncoming} from '@/constants/init/index.desktop'
import {eventFromRemoteWindows} from './remote-event-handler.desktop'
import type {default as NewMainType} from '../../app/main.desktop'
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
  const eng = makeEngine(
    batch,
    () => {
      // do nothing we wait for the remote version from node
    },
    onEngineIncoming
  )
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
    useConfigState
      .getState()
      .dispatch.dumpLogs('startup')
      .then(() => {})
      .catch(() => {})
  }, 5 * 1000)

  appStartedUp?.()
}

const useDarkHookup = () => {
  const initedRef = React.useRef(false)
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)
  React.useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    if (!initedRef.current) {
      initedRef.current = true
      setSystemDarkMode(m.matches)
    }

    const handler = (e: MediaQueryListEvent) => {
      setSystemDarkMode(e.matches)
    }
    m.addEventListener('change', handler)
    return () => {
      m.removeEventListener('change', handler)
    }
  }, [setSystemDarkMode])
}

const Root = ({children}: {children: React.ReactNode}) => {
  useDarkHookup()
  return (
    <GlobalKeyEventHandler>
      <CanFixOverdrawContext.Provider value={true}>{children}</CanFixOverdrawContext.Provider>
    </GlobalKeyEventHandler>
  )
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
    // HMR detected — reinit subscriptions on new store instances
    console.log('HMR: reinitializing store subscriptions')
    initPlatformListener()
    return
  }
  global.DEBUGLoaded = true
  initDesktopStyles()
  setupApp()
  setupHMR()
  render()
}

load()
