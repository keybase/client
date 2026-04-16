import * as RemoteGen from '@/constants/remote-actions'
import * as T from '@/constants/types'
import * as Crypto from '@/constants/crypto'
import * as Tabs from '@/constants/tabs'
import {RPCError} from '@/util/errors'
import {ignorePromise} from '@/constants/utils'
import {navigateAppend, previewConversation, switchTab} from '@/constants/router'
import {storeRegistry} from '@/stores/store-registry'
import {onEngineConnected, onEngineDisconnected} from '@/constants/init/index.desktop'
import {emitDeepLink} from '@/router-v2/linking'
import {isPathSaltpackEncrypted, isPathSaltpackSigned} from '@/util/path'
import type HiddenString from '@/util/hidden-string'
import {useConfigState} from '@/stores/config'
import {usePinentryState} from '@/stores/pinentry'
import logger from '@/logger'
import {makeUUID} from '@/util/uuid'

const handleSaltPackOpen = (_path: string | HiddenString) => {
  const path = typeof _path === 'string' ? _path : _path.stringValue()

  if (!useConfigState.getState().loggedIn) {
    console.warn('Tried to open a saltpack file before being logged in')
    return
  }
  let name: typeof Crypto.decryptTab | typeof Crypto.verifyTab | undefined
  if (isPathSaltpackEncrypted(path)) {
    name = Crypto.decryptTab
  } else if (isPathSaltpackSigned(path)) {
    name = Crypto.verifyTab
  } else {
    logger.warn(
      'Deeplink received saltpack file path not ending in ".encrypted.saltpack" or ".signed.saltpack"'
    )
    return
  }
  switchTab(Tabs.cryptoTab)
  navigateAppend({
    name,
    params: {
      entryNonce: makeUUID(),
      seedInputPath: path,
      seedInputType: 'file',
    },
  }, true)
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

export const eventFromRemoteWindows = (action: RemoteGen.Actions) => {
  switch (action.type) {
    case RemoteGen.resetStore:
      break
    case RemoteGen.openChatFromWidget: {
      useConfigState.getState().dispatch.showMain()
      storeRegistry.getConvoState(action.payload.conversationIDKey).dispatch.navigateToThread('inboxSmall')
      break
    }
    case RemoteGen.inboxRefresh: {
      ignorePromise(storeRegistry.getState('chat').dispatch.inboxRefresh('widgetRefresh'))
      break
    }
    case RemoteGen.engineConnection: {
      logger.info('remote engineConnection', {connected: action.payload.connected})
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
      ignorePromise(T.RPCGen.ctlStopRpcPromise({exitCode: action.payload.exitCode}))
      break
    }
    case RemoteGen.trackerChangeFollow: {
      storeRegistry.getState('tracker').dispatch.changeFollow(action.payload.guiID, action.payload.follow)
      break
    }
    case RemoteGen.trackerIgnore: {
      storeRegistry.getState('tracker').dispatch.ignore(action.payload.guiID)
      break
    }
    case RemoteGen.trackerCloseTracker: {
      storeRegistry.getState('tracker').dispatch.closeTracker(action.payload.guiID)
      break
    }
    case RemoteGen.trackerLoad: {
      storeRegistry.getState('tracker').dispatch.load(action.payload)
      break
    }
    case RemoteGen.link:
      emitDeepLink(action.payload.link)
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
      previewConversation({participants: [action.payload.participant], reason: 'tracker'})
      break
  }
}
