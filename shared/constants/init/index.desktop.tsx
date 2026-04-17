// links all the stores together, stores never import this
import * as Chat from '@/stores/chat'
import {ignorePromise} from '@/constants/utils'
import {useConfigState} from '@/stores/config'
import * as ConfigConstants from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {useFSState} from '@/stores/fs'
import type * as EngineGen from '@/constants/rpc'
import * as T from '@/constants/types'
import InputMonitor from '@/util/platform-specific/input-monitor.desktop'
import KB2 from '@/util/electron.desktop'
import logger from '@/logger'
import type {RPCError} from '@/util/errors'
import {getEngine} from '@/engine'
import {isLinux, isWindows} from '@/constants/platform.desktop'
import {kbfsNotification} from '@/util/platform-specific/kbfs-notifications'
import {skipAppFocusActions} from '@/local-debug.desktop'
import {NotifyPopup} from '@/util/misc'
import {noKBFSFailReason} from '@/constants/config'
import {initSharedSubscriptions, _onEngineIncoming, onEngineConnected as onSharedEngineConnected} from './shared'
import {dumpLogs} from '@/util/storeless-actions'

const {activeChanged, requestWindowsStartService} = KB2.functions
const {quitApp, exitApp, setOpenAtLogin} = KB2.functions

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
    case 'keybase.1.logsend.prepareLogsend': {
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
    case 'keybase.1.NotifyApp.exit':
      console.log('App exit requested')
      exitApp?.(0)
      break
    case 'keybase.1.NotifyFS.FSActivity':
      kbfsNotification(action.payload.params.notification, NotifyPopup)
      break
    case 'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile': {
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
    case 'keybase.1.NotifyService.shutdown': {
      const {code} = action.payload.params
      if (isWindows && code !== (T.RPCGen.ExitCode.restart as number)) {
        console.log('Quitting due to service shutdown with code: ', code)
        // Quit just the app, not the service
        quitApp?.()
      }
      break
    }

    case 'keybase.1.logUi.log': {
      const {params} = action.payload
      const {level, text} = params
      logger.info('keybase.1.logUi.log:', params.text.data)
      if (level >= T.RPCGen.LogLevel.error) {
        NotifyPopup(text.data)
      }
      break
    }

    case 'keybase.1.NotifySession.clientOutOfDate': {
      const {upgradeTo, upgradeURI, upgradeMsg} = action.payload.params
      const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
      NotifyPopup('Client out of date!', {body}, 60 * 60)
      // This is from the API server. Consider notifications from server always critical.
      useConfigState
        .getState()
        .dispatch.setOutOfDate({critical: true, message: upgradeMsg, outOfDate: true, updating: false})
      break
    }
    case 'keybase.1.NotifySession.loggedOut': {
      if (useConfigState.getState().userSwitching) {
        logger.info('Resetting renderer engine for account switch logout')
        getEngine().reset()
      }
      break
    }
    case 'keybase.1.NotifySession.loggedIn': {
      if (useConfigState.getState().userSwitching) {
        logger.info('Refreshing renderer session registration for account switch login')
        getEngine().reset()
        onSharedEngineConnected()
      }
      break
    }
    default:
  }
}

const _platformUnsubs: Array<() => void> = __DEV__
  ? (globalThis.__hmr_platformUnsubs ??= [])
  : []

let _oneTimeInitDone: boolean = __DEV__
  ? (globalThis.__hmr_oneTimeInitDone ?? false)
  : false

export const initPlatformListener = () => {
  // HMR cleanup: unsubscribe old store subscriptions before re-subscribing
  for (const unsub of _platformUnsubs) unsub()
  _platformUnsubs.length = 0

  _platformUnsubs.push(useConfigState.subscribe((s, old) => {
    if (s.appFocused === old.appFocused) return
    useFSState.getState().dispatch.onChangedFocus(s.appFocused)
  }))

  _platformUnsubs.push(useConfigState.subscribe((s, old) => {
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
  }))

  // One-time setup: window event listeners and input monitor (skip on HMR to avoid duplicates)
  if (!_oneTimeInitDone) {
    _oneTimeInitDone = true
    if (__DEV__) globalThis.__hmr_oneTimeInitDone = true

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

    if (isLinux) {
      useConfigState.getState().dispatch.initUseNativeFrame()
    }

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
  }

  _platformUnsubs.push(useDaemonState.subscribe((s, old) => {
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
  }))

  useDaemonState.setState(s => {
    s.dispatch.onRestartHandshakeNative = () => {
      const {handshakeFailedReason} = useDaemonState.getState()
      if (isWindows && handshakeFailedReason === noKBFSFailReason) {
        requestWindowsStartService?.()
      }
    }
  })
  if (!isLinux) {
    useFSState.getState().dispatch.afterKbfsDaemonRpcStatusChanged()
  }

  initSharedSubscriptions()
}

export {onEngineConnected, onEngineDisconnected} from './shared'
