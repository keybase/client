import * as RemoteGen from '@/constants/remote-actions'
import * as T from '@/constants/types'
import * as Crypto from '@/constants/crypto'
import * as Tabs from '@/constants/tabs'
import {RPCError} from '@/util/errors'
import {ignorePromise} from '@/constants/utils'
import {navigateAppend, navigateToThread, previewConversation, switchTab} from '@/constants/router'
import {onEngineConnected, onEngineDisconnected} from '@/constants/init/index.desktop'
import {emitDeepLink} from '@/router-v2/linking'
import {isPathSaltpackEncrypted, isPathSaltpackSigned} from '@/util/path'
import type HiddenString from '@/util/hidden-string'
import {useChatState} from '@/stores/chat'
import {useConfigState} from '@/stores/config'
import {useFSState} from '@/stores/fs'
import {useShellState} from '@/stores/shell'
import {useUnlockFoldersState} from '@/unlock-folders/store'
import logger from '@/logger'
import {makeUUID} from '@/util/uuid'
import {dumpLogs, showMain} from '@/util/storeless-actions'
import * as FSConstants from '@/constants/fs'
import {openPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
import * as Z from '@/util/zustand'

type RemoteActionOwner = 'pinentry' | 'tracker'

type OwnerActionMap = {
  pinentry: RemoteGen.PinentryOnCancelPayload | RemoteGen.PinentryOnSubmitPayload
  tracker:
    | RemoteGen.TrackerChangeFollowPayload
    | RemoteGen.TrackerCloseTrackerPayload
    | RemoteGen.TrackerIgnorePayload
    | RemoteGen.TrackerLoadPayload
}

type OwnerEntry = {
  handler: (action: OwnerActionMap[RemoteActionOwner]) => void
  token: number
}

type RemoteActionHandlerStore = {
  dispatch: {
    resetState: () => void
  }
  nextOwnerToken: number
  ownerHandlers: Map<RemoteActionOwner, OwnerEntry>
}

const useRemoteActionHandlerState = Z.createZustand<RemoteActionHandlerStore>(
  'desktop-remote-action-handlers',
  set => {
    const resetState = () => {
      set(s => {
        s.nextOwnerToken = 0
        s.ownerHandlers = new Map()
      })
    }
    return {
      dispatch: {resetState},
      nextOwnerToken: 0,
      ownerHandlers: new Map(),
    }
  }
)

const dispatchRemoteActionToOwner = <K extends RemoteActionOwner>(owner: K, action: OwnerActionMap[K]) => {
  const entry = useRemoteActionHandlerState.getState().ownerHandlers.get(owner)
  ;(entry?.handler as ((action: OwnerActionMap[K]) => void) | undefined)?.(action)
}

export const registerRemoteActionHandler = <K extends RemoteActionOwner>(
  owner: K,
  handler: (action: OwnerActionMap[K]) => void
) => {
  let token = 0
  useRemoteActionHandlerState.setState(s => {
    s.nextOwnerToken += 1
    token = s.nextOwnerToken
    s.ownerHandlers.set(owner, {handler: handler as OwnerEntry['handler'], token})
  })
  return () => {
    useRemoteActionHandlerState.setState(s => {
      if (s.ownerHandlers.get(owner)?.token === token) {
        s.ownerHandlers.delete(owner)
      }
    })
  }
}

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
      showMain()
      navigateToThread(action.payload.conversationIDKey, 'inboxSmall')
      break
    }
    case RemoteGen.inboxRefresh: {
      ignorePromise(useChatState.getState().dispatch.inboxRefresh('widgetRefresh'))
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
      useFSState.getState().dispatch.setCriticalUpdate(action.payload.critical)
      break
    }
    case RemoteGen.userFileEditsLoad: {
      useFSState.getState().dispatch.userFileEditsLoad()
      break
    }
    case RemoteGen.openFilesFromWidget: {
      showMain()
      if (action.payload.path) {
        FSConstants.navToPath(action.payload.path)
      } else {
        switchTab(Tabs.fsTab)
      }
      break
    }
    case RemoteGen.saltpackFileOpen: {
      handleSaltPackOpen(action.payload.path)
      break
    }
    case RemoteGen.pinentryOnCancel: {
      dispatchRemoteActionToOwner('pinentry', action)
      break
    }
    case RemoteGen.pinentryOnSubmit: {
      dispatchRemoteActionToOwner('pinentry', action)
      break
    }
    case RemoteGen.openPathInSystemFileManager: {
      openPathInSystemFileManagerDesktop(action.payload.path)
      break
    }
    case RemoteGen.unlockFoldersSubmitPaperKey: {
      T.RPCGen.loginPaperKeySubmitRpcPromise({paperPhrase: action.payload.paperKey}, 'unlock-folders:waiting')
        .then(() => {
          useUnlockFoldersState.getState().dispatch.close()
        })
        .catch((e: unknown) => {
          if (!(e instanceof RPCError)) return
          useUnlockFoldersState.getState().dispatch.setPaperKeyError(e.desc)
        })
      break
    }
    case RemoteGen.closeUnlockFolders: {
      T.RPCGen.rekeyRekeyStatusFinishRpcPromise()
        .then(() => {})
        .catch(() => {})
      useUnlockFoldersState.getState().dispatch.close()
      break
    }
    case RemoteGen.stop: {
      ignorePromise(T.RPCGen.ctlStopRpcPromise({exitCode: action.payload.exitCode}))
      break
    }
    case RemoteGen.trackerChangeFollow:
    case RemoteGen.trackerIgnore:
    case RemoteGen.trackerCloseTracker:
    case RemoteGen.trackerLoad: {
      dispatchRemoteActionToOwner('tracker', action)
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
      showMain()
      break
    case RemoteGen.dumpLogs:
      ignorePromise(dumpLogs(action.payload.reason))
      break
    case RemoteGen.remoteWindowWantsProps:
      useConfigState
        .getState()
        .dispatch.remoteWindowNeedsProps(action.payload.component, action.payload.param)
      break
    case RemoteGen.updateWindowMaxState:
      useShellState.getState().dispatch.setWindowMaximized(action.payload.max)
      break
    case RemoteGen.updateWindowState:
      useShellState.getState().dispatch.updateWindowState(action.payload.windowState)
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
