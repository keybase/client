import * as RouterConstants from '../../constants/router2'
import * as ConfigConstants from '../../constants/config'
import * as ProfileConstants from '../../constants/profile'
import * as DaemonConstants from '../../constants/daemon'
import * as Container from '../../util/container'
import * as EngineGen from '../engine-gen-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Z from '../../util/zustand'
import InputMonitor from './input-monitor.desktop'
import KB2 from '../../util/electron.desktop'
import logger from '../../logger'
import type {RPCError} from '../../util/errors'
import {getEngine} from '../../engine'
import {isLinux, isWindows} from '../../constants/platform.desktop'
import {kbfsNotification} from './kbfs-notifications'
import {skipAppFocusActions} from '../../local-debug.desktop'
import NotifyPopup from '../../util/notify-popup'

const {showMainWindow, activeChanged, requestWindowsStartService, dumpNodeLogger} = KB2.functions
const {quitApp, exitApp, setOpenAtLogin, ctlQuit, copyToClipboard} = KB2.functions

const onLog = (_: unknown, action: EngineGen.Keybase1LogUiLogPayload) => {
  const {params} = action.payload
  const {level, text} = params
  logger.info('keybase.1.logUi.log:', params.text.data)
  if (level >= RPCTypes.LogLevel.error) {
    NotifyPopup(text.data, {})
  }
}

export const requestPermissionsToWrite = async () => {
  return Promise.resolve(true)
}

export function showShareActionSheet() {
  throw new Error('Show Share Action - unsupported on this platform')
}
export async function saveAttachmentToCameraRoll() {
  return Promise.reject(new Error('Save Attachment to camera roll - unsupported on this platform'))
}

const handleWindowFocusEvents = () => {
  const handle = (appFocused: boolean) => {
    if (skipAppFocusActions) {
      console.log('Skipping app focus actions!')
    } else {
      ConfigConstants.useConfigState.getState().dispatch.changedFocus(appFocused)
    }
  }
  window.addEventListener('focus', () => handle(true))
  window.addEventListener('blur', () => handle(false))
}

const initializeInputMonitor = () => {
  const inputMonitor = new InputMonitor()
  inputMonitor.notifyActive = (userActive: boolean) => {
    if (skipAppFocusActions) {
      console.log('Skipping app focus actions!')
    } else {
      ConfigConstants.useActiveState.getState().dispatch.setActive(userActive)
      // let node thread save file
      activeChanged?.(Date.now(), userActive)
    }
  }
}

const onExit = () => {
  console.log('App exit requested')
  exitApp?.(0)
}

const onFSActivity = (_: unknown, action: EngineGen.Keybase1NotifyFSFSActivityPayload) => {
  kbfsNotification(action.payload.params.notification, NotifyPopup)
}

const onPgpgKeySecret = async () =>
  RPCTypes.pgpPgpStorageDismissRpcPromise().catch(err => {
    console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
  })

const onShutdown = (_: unknown, action: EngineGen.Keybase1NotifyServiceShutdownPayload) => {
  const {code} = action.payload.params
  if (isWindows && code !== RPCTypes.ExitCode.restart) {
    console.log('Quitting due to service shutdown with code: ', code)
    // Quit just the app, not the service
    quitApp?.()
  }
}

export const requestLocationPermission = async () => Promise.resolve()
export const watchPositionForMap = async () => Promise.resolve(() => {})

const maybePauseVideos = () => {
  const {appFocused} = ConfigConstants.useConfigState.getState()
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
  ConfigConstants.useConfigState.setState(s => {
    s.dispatch.dynamic.dumpLogsNative = dumpLogs
    s.dispatch.dynamic.showMainNative = () => showMainWindow?.()
    s.dispatch.dynamic.copyToClipboard = s => copyToClipboard?.(s)
    s.dispatch.dynamic.onEngineConnectedDesktop = () => {
      // Introduce ourselves to the service
      const f = async () => {
        await RPCTypes.configHelloIAmRpcPromise({details: KB2.constants.helloDetails})
      }
      Z.ignorePromise(f())
    }
  })
  getEngine().registerCustomResponse('keybase.1.logsend.prepareLogsend')
  Container.listenAction(EngineGen.keybase1LogsendPrepareLogsend, async (_, action) => {
    const response = action.payload.response
    try {
      await dumpLogs()
    } finally {
      response?.result()
    }
  })
  Container.listenAction(EngineGen.keybase1NotifyAppExit, onExit)
  Container.listenAction(EngineGen.keybase1NotifyFSFSActivity, onFSActivity)
  Container.listenAction(EngineGen.keybase1NotifyPGPPgpKeyInSecretStoreFile, onPgpgKeySecret)
  Container.listenAction(EngineGen.keybase1NotifyServiceShutdown, onShutdown)

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.loggedIn === old.loggedIn) return
    ConfigConstants.useConfigState
      .getState()
      .dispatch.osNetworkStatusChanged(navigator.onLine, 'notavailable', true)
  })

  ConfigConstants.useConfigState.subscribe((s, prev) => {
    if (s.appFocused !== prev.appFocused) {
      maybePauseVideos()
    }
  })

  Container.listenAction(EngineGen.keybase1LogUiLog, onLog)

  ConfigConstants.useDaemonState.subscribe((s, old) => {
    if (s.handshakeVersion === old.handshakeVersion) return
    if (!isWindows) return

    const f = async () => {
      const waitKey = 'pipeCheckFail'
      const version = s.handshakeVersion
      const {wait} = ConfigConstants.useDaemonState.getState().dispatch
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
    Z.ignorePromise(f())
  })

  Container.spawn(handleWindowFocusEvents, 'handleWindowFocusEvents')

  const setupReachabilityWatcher = () => {
    window.addEventListener('online', () =>
      ConfigConstants.useConfigState.getState().dispatch.osNetworkStatusChanged(true, 'notavailable')
    )
    window.addEventListener('offline', () =>
      ConfigConstants.useConfigState.getState().dispatch.osNetworkStatusChanged(false, 'notavailable')
    )
  }
  setupReachabilityWatcher()

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.openAtLogin === old.openAtLogin) return
    const {openAtLogin} = s
    const f = async () => {
      if (__DEV__) {
        console.log('onSetOpenAtLogin disabled for dev mode')
        return
      } else {
        await RPCTypes.configGuiSetValueRpcPromise({
          path: ConfigConstants.openAtLoginKey,
          value: {b: openAtLogin, isNull: false},
        })
      }
      if (isLinux || isWindows) {
        const enabled =
          (await RPCTypes.ctlGetOnLoginStartupRpcPromise()) === RPCTypes.OnLoginStartupStatus.enabled
        if (enabled !== openAtLogin) {
          await RPCTypes.ctlSetOnLoginStartupRpcPromise({enabled: openAtLogin}).catch(err => {
            logger.warn(`Error in sending ctlSetOnLoginStartup: ${err.message}`)
          })
        }
      } else {
        logger.info(`Login item settings changed! now ${openAtLogin ? 'on' : 'off'}`)
        await setOpenAtLogin?.(openAtLogin)
      }
    }
    Container.ignorePromise(f())
  })

  Container.listenAction(EngineGen.keybase1NotifySessionClientOutOfDate, (_, action) => {
    const {upgradeTo, upgradeURI, upgradeMsg} = action.payload.params
    const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
    NotifyPopup('Client out of date!', {body}, 60 * 60)
    // This is from the API server. Consider notifications from server always critical.
    ConfigConstants.useConfigState
      .getState()
      .dispatch.setOutOfDate({critical: true, message: upgradeMsg, outOfDate: true, updating: false})
  })

  ConfigConstants.useDaemonState.subscribe((s, old) => {
    if (s.handshakeState === old.handshakeState || s.handshakeState !== 'done') return
    ConfigConstants.useConfigState.getState().dispatch.setStartupDetailsLoaded()
  })

  if (isLinux) {
    ConfigConstants.useConfigState.getState().dispatch.initUseNativeFrame()
  }
  ConfigConstants.useConfigState.getState().dispatch.initNotifySound()
  ConfigConstants.useConfigState.getState().dispatch.initOpenAtLogin()
  ConfigConstants.useConfigState.getState().dispatch.initAppUpdateLoop()

  ProfileConstants.useState.setState(s => {
    s.dispatch.editAvatar = () => {
      RouterConstants.useState
        .getState()
        .dispatch.navigateAppend({props: {image: undefined}, selected: 'profileEditAvatar'})
    }
  })

  initializeInputMonitor()

  DaemonConstants.useDaemonState.setState(s => {
    s.dispatch.onRestartHandshakeNative = () => {
      const {handshakeFailedReason} = ConfigConstants.useDaemonState.getState()
      if (isWindows && handshakeFailedReason === ConfigConstants.noKBFSFailReason) {
        requestWindowsStartService?.()
      }
    }
  })
}
