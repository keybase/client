// links all the stores together, stores never import this
import * as Chat from '../chat2'
import {ignorePromise} from '../utils'
import {useConfigState} from '../config'
import * as ConfigConstants from '../config'
import {useDaemonState} from '../daemon'
import {useFSState} from '../fs'
import {useProfileState} from '../profile'
import {useRouterState} from '../router2'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as T from '../types'
import InputMonitor from '../platform-specific/input-monitor.desktop'
import KB2 from '@/util/electron.desktop'
import logger from '@/logger'
import type {RPCError} from '@/util/errors'
import {getEngine} from '@/engine'
import {isLinux, isWindows} from '../platform.desktop'
import {kbfsNotification} from '../platform-specific/kbfs-notifications'
import {skipAppFocusActions} from '@/local-debug.desktop'
import NotifyPopup from '@/util/notify-popup'
import {noKBFSFailReason} from '../config/util'
import {initSharedSubscriptions, _onEngineIncoming} from './shared'
import {wrapErrors} from '@/util/debug'
import {dumpLogs} from '../platform-specific/index.desktop'

const {showMainWindow, activeChanged, requestWindowsStartService} = KB2.functions
const {quitApp, exitApp, setOpenAtLogin, copyToClipboard} = KB2.functions

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

export const onEngineIncoming = (action: EngineGen.Actions) => {
  _onEngineIncoming(action)
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
  })

  useConfigState.subscribe((s, old) => {
    if (s.loggedIn !== old.loggedIn) {
      s.dispatch.osNetworkStatusChanged(navigator.onLine, 'notavailable', true)
    }

    if (s.appFocused !== old.appFocused) {
      maybePauseVideos()
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
        useConfigState.getState().dispatch.setActive(userActive)
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

export {onEngineConnected, onEngineDisconnected} from './shared'
