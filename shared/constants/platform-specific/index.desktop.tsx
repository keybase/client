import * as Chat from '../chat2'
import {ignorePromise} from '../utils'
import {storeRegistry} from '../store-registry'
import * as ConfigConstants from '../config'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as T from '../types'
import InputMonitor from './input-monitor.desktop'
import KB2 from '@/util/electron.desktop'
import logger from '@/logger'
import type {RPCError} from '@/util/errors'
import {getEngine} from '@/engine'
import {isLinux, isWindows} from '../platform.desktop'
import {kbfsNotification} from './kbfs-notifications'
import {skipAppFocusActions} from '@/local-debug.desktop'
import NotifyPopup from '@/util/notify-popup'
import {noKBFSFailReason} from '@/constants/config/util'
import {wrapErrors} from '@/util/debug'

const {showMainWindow, activeChanged, requestWindowsStartService, dumpNodeLogger} = KB2.functions
const {quitApp, exitApp, setOpenAtLogin, ctlQuit, copyToClipboard} = KB2.functions

export const fsCacheDir = ''

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
  const {appFocused} = storeRegistry.getState('config')
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
  storeRegistry.getStore('config').setState(s => {
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
          storeRegistry
            .getState('config')
            .dispatch.setOutOfDate({critical: true, message: upgradeMsg, outOfDate: true, updating: false})
          break
        }
        default:
      }
    })
  })

  storeRegistry.getStore('config').subscribe((s, old) => {
    if (s.loggedIn === old.loggedIn) return
    storeRegistry.getState('config').dispatch.osNetworkStatusChanged(navigator.onLine, 'notavailable', true)
  })

  storeRegistry.getStore('config').subscribe((s, prev) => {
    if (s.appFocused !== prev.appFocused) {
      maybePauseVideos()
    }
  })

  storeRegistry.getStore('daemon').subscribe((s, old) => {
    if (s.handshakeVersion === old.handshakeVersion) return
    if (!isWindows) return

    const f = async () => {
      const waitKey = 'pipeCheckFail'
      const version = s.handshakeVersion
      const {wait} = storeRegistry.getState('daemon').dispatch
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
  })

  const handleWindowFocusEvents = () => {
    const handle = (appFocused: boolean) => {
      if (skipAppFocusActions) {
        console.log('Skipping app focus actions!')
      } else {
        storeRegistry.getState('config').dispatch.changedFocus(appFocused)
      }
    }
    window.addEventListener('focus', () => handle(true))
    window.addEventListener('blur', () => handle(false))
  }
  handleWindowFocusEvents()

  const setupReachabilityWatcher = () => {
    window.addEventListener('online', () =>
      storeRegistry.getState('config').dispatch.osNetworkStatusChanged(true, 'notavailable')
    )
    window.addEventListener('offline', () =>
      storeRegistry.getState('config').dispatch.osNetworkStatusChanged(false, 'notavailable')
    )
  }
  setupReachabilityWatcher()

  storeRegistry.getStore('config').subscribe((s, old) => {
    if (s.openAtLogin === old.openAtLogin) return
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
  })

  storeRegistry.getStore('daemon').subscribe((s, old) => {
    if (s.handshakeState === old.handshakeState || s.handshakeState !== 'done') return
    storeRegistry.getState('config').dispatch.setStartupDetails({
      conversation: Chat.noConversationIDKey,
      followUser: '',
      link: '',
      tab: undefined,
    })
  })

  if (isLinux) {
    storeRegistry.getState('config').dispatch.initUseNativeFrame()
  }
  storeRegistry.getState('config').dispatch.initNotifySound()
  storeRegistry.getState('config').dispatch.initForceSmallNav()
  storeRegistry.getState('config').dispatch.initOpenAtLogin()
  storeRegistry.getState('config').dispatch.initAppUpdateLoop()

  storeRegistry.getStore('profile').setState(s => {
    s.dispatch.editAvatar = () => {
      storeRegistry
        .getState('router')
        .dispatch.navigateAppend({props: {image: undefined}, selected: 'profileEditAvatar'})
    }
  })

  const initializeInputMonitor = () => {
    const inputMonitor = new InputMonitor()
    inputMonitor.notifyActive = (userActive: boolean) => {
      if (skipAppFocusActions) {
        console.log('Skipping app focus actions!')
      } else {
        storeRegistry.getState('active').dispatch.setActive(userActive)
        // let node thread save file
        activeChanged?.(Date.now(), userActive)
      }
    }
  }
  initializeInputMonitor()

  storeRegistry.getStore('daemon').setState(s => {
    s.dispatch.onRestartHandshakeNative = () => {
      const {handshakeFailedReason} = storeRegistry.getState('daemon')
      if (isWindows && handshakeFailedReason === noKBFSFailReason) {
        requestWindowsStartService?.()
      }
    }
  })

  ignorePromise(storeRegistry.getState('fs').dispatch.setupSubscriptions())
}
