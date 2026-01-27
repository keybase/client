// Entry point to the chrome part of the app
import Main from '@/app/main.desktop'
// order of the above must NOT change. needed for patching / hot loading to be correct
import * as C from '@/constants'
import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import * as RemoteGen from '@/actions/remote-gen'
import Root from './container.desktop'
import {makeEngine} from '@/engine'
import {disableDragDrop} from '@/util/drag-drop.desktop'
import {initDesktopStyles} from '@/styles/index.desktop'
import {isWindows} from '@/constants/platform'
import KB2 from '@/util/electron.desktop'
import {ignorePromise} from '@/constants/utils'
import {useConfigState} from '@/stores/config'
import {usePinentryState} from '@/stores/pinentry'
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import {switchTab} from '@/constants/router2'
import {storeRegistry} from '@/stores/store-registry'
import {onEngineConnected, onEngineDisconnected} from '@/constants/init/index.desktop'
import {handleAppLink} from '@/constants/deeplinks'
import * as Crypto from '@/constants/crypto'
import * as Tabs from '@/constants/tabs'
import {isPathSaltpackEncrypted, isPathSaltpackSigned} from '@/util/path'
import type HiddenString from '@/util/hidden-string'
import {useCryptoState} from '@/stores/crypto'
import logger from '@/logger'
import {debugWarning} from '@/util/debug-warning'
import type {default as NewMainType} from '../../app/main.desktop'
import {setServiceDecoration} from '@/common-adapters/markdown/react'
import ServiceDecoration from '@/common-adapters/markdown/service-decoration'
import {useDarkModeState} from '@/stores/darkmode'
import {initPlatformListener, onEngineIncoming} from '@/constants/init/index.desktop'
setServiceDecoration(ServiceDecoration)

const {ipcRendererOn, requestWindowsStartService, appStartedUp, ctlQuit, dumpNodeLogger} = KB2.functions

const handleSaltPackOpen = (_path: string | HiddenString) => {
  const path = typeof _path === 'string' ? _path : _path.stringValue()

  if (!useConfigState.getState().loggedIn) {
    console.warn('Tried to open a saltpack file before being logged in')
    return
  }
  let operation: T.Crypto.Operations | undefined
  if (isPathSaltpackEncrypted(path)) {
    operation = Crypto.Operations.Decrypt
  } else if (isPathSaltpackSigned(path)) {
    operation = Crypto.Operations.Verify
  } else {
    logger.warn(
      'Deeplink received saltpack file path not ending in ".encrypted.saltpack" or ".signed.saltpack"'
    )
    return
  }
  useCryptoState.getState().dispatch.onSaltpackOpenFile(operation, path)
  switchTab(Tabs.cryptoTab)
}

const dumpLogs = async (reason?: string) => {
  await logger.dump()
  await (dumpNodeLogger?.() ?? Promise.resolve([]))
  // quit as soon as possible
  if (reason === 'quitting through menu') {
    ctlQuit?.()
  }
}

const updateApp = () => {
  const f = async () => {
    await T.RPCGen.configStartUpdateIfNeededRpcPromise()
  }
  ignorePromise(f())
  // * If user choose to update:
  //   We'd get killed and it doesn't matter what happens here.
  // * If user hits "Ignore":
  //   Note that we ignore the snooze here, so the state shouldn't change,
  //   and we'd back to where we think we still need an update. So we could
  //   have just unset the "updating" flag.However, in case server has
  //   decided to pull out the update between last time we asked the updater
  //   and now, we'd be in a wrong state if we didn't check with the service.
  //   Since user has interacted with it, we still ask the service to make
  //   sure.

  useConfigState.getState().dispatch.setUpdating()
}

const eventFromRemoteWindows = (action: RemoteGen.Actions) => {
  switch (action.type) {
    case RemoteGen.resetStore:
      break
    case RemoteGen.openChatFromWidget: {
      useConfigState.getState().dispatch.showMain()
      storeRegistry.getConvoState(action.payload.conversationIDKey).dispatch.navigateToThread('inboxSmall')
      break
    }
    case RemoteGen.inboxRefresh: {
      storeRegistry.getState('chat').dispatch.inboxRefresh('widgetRefresh')
      break
    }
    case RemoteGen.engineConnection: {
      if (action.payload.connected) {
        onEngineConnected()
      } else {
        onEngineDisconnected()
      }
      break
    }
    case RemoteGen.switchTab: {
      switchTab(action.payload.tab)
      break
    }
    case RemoteGen.setCriticalUpdate: {
      storeRegistry.getState('fs').dispatch.setCriticalUpdate(action.payload.critical)
      break
    }
    case RemoteGen.userFileEditsLoad: {
      storeRegistry.getState('fs').dispatch.userFileEditsLoad()
      break
    }
    case RemoteGen.openFilesFromWidget: {
      storeRegistry.getState('fs').dispatch.defer.openFilesFromWidgetDesktop?.(action.payload.path)
      break
    }
    case RemoteGen.saltpackFileOpen: {
      handleSaltPackOpen(action.payload.path)
      break
    }
    case RemoteGen.pinentryOnCancel: {
      usePinentryState.getState().dispatch.dynamic.onCancel?.()
      break
    }
    case RemoteGen.pinentryOnSubmit: {
      usePinentryState.getState().dispatch.dynamic.onSubmit?.(action.payload.password)
      break
    }
    case RemoteGen.openPathInSystemFileManager: {
      storeRegistry.getState('fs').dispatch.defer.openPathInSystemFileManagerDesktop?.(action.payload.path)
      break
    }
    case RemoteGen.unlockFoldersSubmitPaperKey: {
      T.RPCGen.loginPaperKeySubmitRpcPromise({paperPhrase: action.payload.paperKey}, 'unlock-folders:waiting')
        .then(() => {
          useConfigState.getState().dispatch.openUnlockFolders([])
        })
        .catch((e: unknown) => {
          if (!(e instanceof RPCError)) return
          useConfigState.setState(s => {
            s.unlockFoldersError = e.desc
          })
        })
      break
    }
    case RemoteGen.closeUnlockFolders: {
      T.RPCGen.rekeyRekeyStatusFinishRpcPromise()
        .then(() => {})
        .catch(() => {})
      useConfigState.getState().dispatch.openUnlockFolders([])
      break
    }
    case RemoteGen.stop: {
      storeRegistry.getState('settings').dispatch.stop(action.payload.exitCode)
      break
    }
    case RemoteGen.trackerChangeFollow: {
      storeRegistry.getState('tracker2').dispatch.changeFollow(action.payload.guiID, action.payload.follow)
      break
    }
    case RemoteGen.trackerIgnore: {
      storeRegistry.getState('tracker2').dispatch.ignore(action.payload.guiID)
      break
    }
    case RemoteGen.trackerCloseTracker: {
      storeRegistry.getState('tracker2').dispatch.closeTracker(action.payload.guiID)
      break
    }
    case RemoteGen.trackerLoad: {
      storeRegistry.getState('tracker2').dispatch.load(action.payload)
      break
    }
    case RemoteGen.link:
      {
        const {link} = action.payload
        handleAppLink(link)
      }
      break
    case RemoteGen.installerRan:
      useConfigState.getState().dispatch.installerRan()
      break
    case RemoteGen.updateNow:
      updateApp()
      break
    case RemoteGen.powerMonitorEvent:
      useConfigState.getState().dispatch.powerMonitorEvent(action.payload.event)
      break
    case RemoteGen.showMain:
      useConfigState.getState().dispatch.showMain()
      break
    case RemoteGen.dumpLogs:
      ignorePromise(useConfigState.getState().dispatch.dumpLogs(action.payload.reason))
      break
    case RemoteGen.remoteWindowWantsProps:
      useConfigState
        .getState()
        .dispatch.remoteWindowNeedsProps(action.payload.component, action.payload.param)
      break
    case RemoteGen.updateWindowMaxState:
      useConfigState.setState(s => {
        s.windowState.isMaximized = action.payload.max
      })
      break
    case RemoteGen.updateWindowState:
      useConfigState.getState().dispatch.updateWindowState(action.payload.windowState)
      break
    case RemoteGen.updateWindowShown: {
      const win = action.payload.component
      useConfigState.setState(s => {
        s.windowShownCount.set(win, (s.windowShownCount.get(win) ?? 0) + 1)
      })
      break
    }
    case RemoteGen.previewConversation:
      storeRegistry
        .getState('chat')
        .dispatch.previewConversation({participants: [action.payload.participant], reason: 'tracker'})
      break
  }
}

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
