import {ignorePromise} from '../utils'
import {useConfigState} from '../config'
import {usePinentryState} from '../pinentry'
import * as RemoteGen from '@/actions/remote-gen'
import * as T from '../types'
import * as Chat from '../chat2'
import KB2 from '@/util/electron.desktop'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {switchTab} from '../router2/util'
import {storeRegistry} from '../store-registry'
import {onEngineConnected, onEngineDisconnected} from '@/constants/platform-specific/shared'

const {ctlQuit, dumpNodeLogger} = KB2.functions

export const requestPermissionsToWrite = async () => {
  return Promise.resolve(true)
}

export function showShareActionSheet() {
  throw new Error('Show Share Action - unsupported on this platform')
}
export async function saveAttachmentToCameraRoll() {
  return Promise.reject(new Error('Save Attachment to camera roll - unsupported on this platform'))
}

export const requestLocationPermission = async (_perm: T.RPCChat.UIWatchPositionPerm): Promise<void> => {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser.')
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      () => {
        resolve()
      },
      error => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Please allow Keybase to access your location in browser settings.'))
            break
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information is unavailable.'))
            break
          case error.TIMEOUT:
            reject(new Error('Location request timed out.'))
            break
          default:
            reject(new Error('An unknown error occurred while requesting location.'))
            break
        }
      },
      {enableHighAccuracy: true, timeout: 10000}
    )
  })
}

export const watchPositionForMap = async (
  conversationIDKey: T.Chat.ConversationIDKey
): Promise<() => void> => {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser.')
  }

  return new Promise(resolve => {
    const watchId = navigator.geolocation.watchPosition(
      position => {
        const coord = {
          accuracy: Math.floor(position.coords.accuracy ?? 0),
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }
        Chat.useChatState.getState().dispatch.updateLastCoord(coord)
      },
      error => {
        const conversationIDKeyStr = T.Chat.conversationIDKeyToString(conversationIDKey)
        const setCommandStatusInfo = storeRegistry
          .getConvoState(conversationIDKey)
          .dispatch.setCommandStatusInfo

        let errorMessage = 'Failed to access location.'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please allow Keybase to access your location in browser settings.'
            setCommandStatusInfo({
              actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
              displayText: errorMessage,
              displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
            })
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.'
            setCommandStatusInfo({
              actions: [],
              displayText: errorMessage,
              displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
            })
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.'
            setCommandStatusInfo({
              actions: [],
              displayText: errorMessage,
              displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
            })
            break
          default:
            errorMessage = 'An unknown error occurred while accessing location.'
            setCommandStatusInfo({
              actions: [],
              displayText: errorMessage,
              displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
            })
            break
        }
        logger.info(`[location] watch error for ${conversationIDKeyStr}: ${errorMessage}`)
      },
      {enableHighAccuracy: true}
    )

    const cleanup = () => {
      navigator.geolocation.clearWatch(watchId)
    }

    resolve(cleanup)
  })
}

export const dumpLogs = async (reason?: string) => {
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
      storeRegistry.getState('fs').dispatch.dynamic.openFilesFromWidgetDesktop?.(action.payload.path)
      break
    }
    case RemoteGen.saltpackFileOpen: {
      storeRegistry.getState('deeplinks').dispatch.handleSaltPackOpen(action.payload.path)
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
      storeRegistry.getState('fs').dispatch.dynamic.openPathInSystemFileManagerDesktop?.(action.payload.path)
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
        storeRegistry.getState('deeplinks').dispatch.handleAppLink(link)
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
