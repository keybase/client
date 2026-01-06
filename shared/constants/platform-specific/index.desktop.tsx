import * as Chat from '../chat2'
import {ignorePromise} from '../utils'
import {useActiveState} from '../active'
import {useConfigState} from '../config'
import * as ConfigConstants from '../config'
import {useDaemonState} from '../daemon'
import {useFSState} from '../fs'
import {usePinentryState} from '../pinentry'
import {useProfileState} from '../profile'
import {useRouterState} from '../router2'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as RemoteGen from '@/actions/remote-gen'
import * as T from '../types'
import InputMonitor from './input-monitor.desktop'
import KB2 from '@/util/electron.desktop'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {getEngine} from '@/engine'
import {isLinux, isWindows} from '../platform.desktop'
import {kbfsNotification} from './kbfs-notifications'
import {skipAppFocusActions} from '@/local-debug.desktop'
import NotifyPopup from '@/util/notify-popup'
import {noKBFSFailReason} from '@/constants/config/util'
import {initSharedSubscriptions} from './shared'
import {switchTab} from '../router2/util'
import {storeRegistry} from '../store-registry'
import {wrapErrors} from '@/util/debug'
import {getSelectedConversation} from '@/constants/chat2/common'

const {showMainWindow, activeChanged, requestWindowsStartService, dumpNodeLogger} = KB2.functions
const {quitApp, exitApp, setOpenAtLogin, ctlQuit, copyToClipboard} = KB2.functions

export const requestPermissionsToWrite = async () => {
  return Promise.resolve(true)
}

export function showShareActionSheet() {
  throw new Error('Show Share Action - unsupported on this platform')
}
export async function saveAttachmentToCameraRoll() {
  return Promise.reject(new Error('Save Attachment to camera roll - unsupported on this platform'))
}

export const requestLocationPermission = async () => Promise.resolve()
export const watchPositionForMap = async () => Promise.resolve(() => {})

const maybePauseVideos = () => {
  const {appFocused} = useConfigState.getState()
  const videos = document.querySelectorAll('video')
  const allVideos = Array.from(videos)

  allVideos.forEach(v => {
    if (appFocused) {
      if (v.hasAttribute('data-focus-paused')) {
        if (v.paused) {
          v.play()
            .then(() => {})
            .catch(() => {})
        }
      }
    } else {
      // only pause looping videos
      if (!v.paused && v.hasAttribute('loop') && v.hasAttribute('autoplay')) {
        v.setAttribute('data-focus-paused', 'true')
        v.pause()
      }
    }
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

export const initPlatformListener = () => {
  useConfigState.setState(s => {
    s.dispatch.dynamic.dumpLogsNative = dumpLogs
    s.dispatch.dynamic.showMainNative = wrapErrors(() => showMainWindow?.())
    s.dispatch.dynamic.copyToClipboard = wrapErrors((s: string) => copyToClipboard?.(s))
    s.dispatch.dynamic.onEngineConnectedDesktop = wrapErrors(() => {
      // Introduce ourselves to the service
      const f = async () => {
        await T.RPCGen.configHelloIAmRpcPromise({details: KB2.constants.helloDetails})
      }
      ignorePromise(f())
    })

    s.dispatch.dynamic.onEngineIncomingDesktop = wrapErrors((action: EngineGen.Actions) => {
      switch (action.type) {
        case EngineGen.keybase1LogsendPrepareLogsend: {
          const f = async () => {
            const response = action.payload.response
            try {
              await dumpLogs()
            } finally {
              response.result()
            }
          }
          ignorePromise(f())
          break
        }
        case EngineGen.keybase1NotifyAppExit:
          console.log('App exit requested')
          exitApp?.(0)
          break
        case EngineGen.keybase1NotifyFSFSActivity:
          kbfsNotification(action.payload.params.notification, NotifyPopup)
          break
        case EngineGen.keybase1NotifyPGPPgpKeyInSecretStoreFile: {
          const f = async () => {
            try {
              await T.RPCGen.pgpPgpStorageDismissRpcPromise()
            } catch (err) {
              console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
            }
          }
          ignorePromise(f())
          break
        }
        case EngineGen.keybase1NotifyServiceShutdown: {
          const {code} = action.payload.params
          if (isWindows && code !== (T.RPCGen.ExitCode.restart as number)) {
            console.log('Quitting due to service shutdown with code: ', code)
            // Quit just the app, not the service
            quitApp?.()
          }
          break
        }

        case EngineGen.keybase1LogUiLog: {
          const {params} = action.payload
          const {level, text} = params
          logger.info('keybase.1.logUi.log:', params.text.data)
          if (level >= T.RPCGen.LogLevel.error) {
            NotifyPopup(text.data)
          }
          break
        }

        case EngineGen.keybase1NotifySessionClientOutOfDate: {
          const {upgradeTo, upgradeURI, upgradeMsg} = action.payload.params
          const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
          NotifyPopup('Client out of date!', {body}, 60 * 60)
          // This is from the API server. Consider notifications from server always critical.
          useConfigState
            .getState()
            .dispatch.setOutOfDate({critical: true, message: upgradeMsg, outOfDate: true, updating: false})
          break
        }
        default:
      }
    })
  })

  useConfigState.subscribe((s, old) => {
    if (s.loggedIn !== old.loggedIn) {
      s.dispatch.osNetworkStatusChanged(navigator.onLine, 'notavailable', true)
    }

    if (s.appFocused !== old.appFocused) {
      maybePauseVideos()
      if (old.appFocused === false && s.appFocused === true) {
        const {dispatch} = storeRegistry.getConvoState(getSelectedConversation())
        dispatch.loadMoreMessages({reason: 'foregrounding'})
        dispatch.markThreadAsRead()
      }
    }

    if (s.openAtLogin !== old.openAtLogin) {
      const {openAtLogin} = s
      const f = async () => {
        if (__DEV__) {
          console.log('onSetOpenAtLogin disabled for dev mode')
          return
        } else {
          await T.RPCGen.configGuiSetValueRpcPromise({
            path: ConfigConstants.openAtLoginKey,
            value: {b: openAtLogin, isNull: false},
          })
        }
        if (isLinux || isWindows) {
          const enabled =
            (await T.RPCGen.ctlGetOnLoginStartupRpcPromise()) === T.RPCGen.OnLoginStartupStatus.enabled
          if (enabled !== openAtLogin) {
            try {
              await T.RPCGen.ctlSetOnLoginStartupRpcPromise({enabled: openAtLogin})
            } catch (error_) {
              const error = error_ as RPCError
              logger.warn(`Error in sending ctlSetOnLoginStartup: ${error.message}`)
            }
          }
        } else {
          logger.info(`Login item settings changed! now ${openAtLogin ? 'on' : 'off'}`)
          await setOpenAtLogin?.(openAtLogin)
        }
      }
      ignorePromise(f())
    }
  })

  const handleWindowFocusEvents = () => {
    const handle = (appFocused: boolean) => {
      if (skipAppFocusActions) {
        console.log('Skipping app focus actions!')
      } else {
        useConfigState.getState().dispatch.changedFocus(appFocused)
      }
    }
    window.addEventListener('focus', () => handle(true))
    window.addEventListener('blur', () => handle(false))
  }
  handleWindowFocusEvents()

  const setupReachabilityWatcher = () => {
    window.addEventListener('online', () =>
      useConfigState.getState().dispatch.osNetworkStatusChanged(true, 'notavailable')
    )
    window.addEventListener('offline', () =>
      useConfigState.getState().dispatch.osNetworkStatusChanged(false, 'notavailable')
    )
  }
  setupReachabilityWatcher()

  useDaemonState.subscribe((s, old) => {
    if (s.handshakeVersion !== old.handshakeVersion) {
      if (!isWindows) return

      const f = async () => {
        const waitKey = 'pipeCheckFail'
        const version = s.handshakeVersion
        const {wait} = s.dispatch
        wait(waitKey, version, true)
        try {
          logger.info('Checking RPC ownership')
          if (KB2.functions.winCheckRPCOwnership) {
            await KB2.functions.winCheckRPCOwnership()
          }
          wait(waitKey, version, false)
        } catch (error_) {
          // error will be logged in bootstrap check
          getEngine().reset()
          const error = error_ as RPCError
          wait(waitKey, version, false, error.message || 'windows pipe owner fail', true)
        }
      }
      ignorePromise(f())
    }

    if (s.handshakeState !== old.handshakeState && s.handshakeState === 'done') {
      useConfigState.getState().dispatch.setStartupDetails({
        conversation: Chat.noConversationIDKey,
        followUser: '',
        link: '',
        tab: undefined,
      })
    }
  })

  if (isLinux) {
    useConfigState.getState().dispatch.initUseNativeFrame()
  }
  useConfigState.getState().dispatch.initNotifySound()
  useConfigState.getState().dispatch.initForceSmallNav()
  useConfigState.getState().dispatch.initOpenAtLogin()
  useConfigState.getState().dispatch.initAppUpdateLoop()

  useProfileState.setState(s => {
    s.dispatch.editAvatar = () => {
      useRouterState
        .getState()
        .dispatch.navigateAppend({props: {image: undefined}, selected: 'profileEditAvatar'})
    }
  })

  const initializeInputMonitor = () => {
    const inputMonitor = new InputMonitor()
    inputMonitor.notifyActive = (userActive: boolean) => {
      if (skipAppFocusActions) {
        console.log('Skipping app focus actions!')
      } else {
        useActiveState.getState().dispatch.setActive(userActive)
        // let node thread save file
        activeChanged?.(Date.now(), userActive)
      }
    }
  }
  initializeInputMonitor()

  useDaemonState.setState(s => {
    s.dispatch.onRestartHandshakeNative = () => {
      const {handshakeFailedReason} = useDaemonState.getState()
      if (isWindows && handshakeFailedReason === noKBFSFailReason) {
        requestWindowsStartService?.()
      }
    }
  })

  initSharedSubscriptions()

  ignorePromise(useFSState.getState().dispatch.setupSubscriptions())
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
        storeRegistry.getState('engine').dispatch.onEngineConnected()
      } else {
        storeRegistry.getState('engine').dispatch.onEngineDisconnected()
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
