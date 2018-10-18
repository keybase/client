// @flow
import * as ConfigGen from '../config-gen'
import * as ConfigConstants from '../../constants/config'
import * as GregorGen from '../gregor-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as SafeElectron from '../../util/safe-electron.desktop'
import * as Saga from '../../util/saga'
import logger from '../../logger'
import path from 'path'
import {NotifyPopup} from '../../native/notifications'
import {execFile} from 'child_process'
import {getEngine} from '../../engine'
import {getMainWindow} from '../../desktop/remote/util.desktop'
import {isWindows, socketPath} from '../../constants/platform.desktop'
import {kbfsNotification} from '../../util/kbfs-notifications'
import {quit} from '../../util/quit-helper'
import {showDockIcon} from '../../desktop/app/dock-icon.desktop'
import {writeLogLinesToFile} from '../../util/forward-logs'
import type {TypedState} from '../../constants/reducer'
import {createSetLastSentXLM, SetLastSentXLMPayload, setLastSentXLM} from '../wallets-gen'

export function showShareActionSheetFromURL(options: {url?: ?any, message?: ?any}): void {
  throw new Error('Show Share Action - unsupported on this platform')
}
export function showShareActionSheetFromFile(fileURL: string): Promise<void> {
  throw new Error('Show Share Action - unsupported on this platform')
}

export function saveAttachmentDialog(filePath: string): Promise<void> {
  throw new Error('Save Attachment - unsupported on this platform')
}

export async function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  throw new Error('Save Attachment to camera roll - unsupported on this platform')
}

const showMainWindow = () => {
  const mw = getMainWindow()
  mw && mw.show()
  showDockIcon()
}

export function displayNewMessageNotification(
  text: string,
  convID: ?string,
  badgeCount: ?number,
  myMsgID: ?number,
  soundName: ?string
) {
  throw new Error('Display new message notification not available on this platform')
}

export function clearAllNotifications() {
  throw new Error('Clear all notifications not available on this platform')
}

export const getContentTypeFromURL = (
  url: string,
  cb: ({error?: any, statusCode?: number, contentType?: string, disposition?: string}) => void
) => {
  const req = SafeElectron.getRemote().net.request({url, method: 'HEAD'})
  req.on('response', response => {
    let contentType = ''
    let disposition = ''
    if (response.statusCode === 200) {
      const contentTypeHeader = response.headers['content-type']
      contentType = Array.isArray(contentTypeHeader) && contentTypeHeader.length ? contentTypeHeader[0] : ''
      const dispositionHeader = response.headers['content-disposition']
      disposition = Array.isArray(dispositionHeader) && dispositionHeader.length ? dispositionHeader[0] : ''
    }
    cb({statusCode: response.statusCode, contentType, disposition})
  })
  req.on('error', error => cb({error}))
  req.end()
}

const writeElectronSettingsOpenAtLogin = (_: any, action: ConfigGen.SetOpenAtLoginPayload) =>
  action.payload.writeFile &&
  SafeElectron.getIpcRenderer().send('setAppState', {openAtLogin: action.payload.open})

const writeElectronSettingsNotifySound = (_: any, action: ConfigGen.SetNotifySoundPayload) =>
  action.payload.writeFile &&
  SafeElectron.getIpcRenderer().send('setAppState', {notifySound: action.payload.sound})

const writeLastSentXLM = (_: any, action: SetLastSentXLMPayload) =>
  action.payload.writeFile &&
  SafeElectron.getIpcRenderer().send('setAppState', {lastSentXLM: action.payload.lastSentXLM})

// get this value from electron and update our store version
function* initializeAppSettingsState(): Generator<any, void, any> {
  const getAppState = () =>
    new Promise((resolve, reject) => {
      SafeElectron.getIpcRenderer().once('getAppStateReply', (event, data) => resolve(data))
      SafeElectron.getIpcRenderer().send('getAppState')
    })

  const state = yield Saga.call(getAppState)
  if (state) {
    yield Saga.put(ConfigGen.createSetOpenAtLogin({open: state.openAtLogin, writeFile: false}))
    yield Saga.put(ConfigGen.createSetNotifySound({sound: state.notifySound, writeFile: false}))
    yield Saga.put(createSetLastSentXLM({lastSentXLM: state.lastSentXLM, writeFile: false}))
  }
}

export const dumpLogs = (_: any, action: ?ConfigGen.DumpLogsPayload) =>
  logger
    .dump()
    .then(fromRender => {
      // $ForceType
      const globalLogger: typeof logger = SafeElectron.getRemote().getGlobal('globalLogger')
      return globalLogger.dump().then(fromMain => writeLogLinesToFile([...fromRender, ...fromMain]))
    })
    .then(() => {
      // quit as soon as possible
      if (action && action.payload.reason === 'quitting through menu') {
        quit('quitButton')
      }
    })

const checkRPCOwnership = (_, action: ConfigGen.DaemonHandshakePayload) =>
  Saga.call(function*() {
    const waitKey = 'pipeCheckFail'
    yield Saga.put(
      ConfigGen.createDaemonHandshakeWait({increment: true, name: waitKey, version: action.payload.version})
    )
    try {
      logger.info('Checking RPC ownership')

      const localAppData = String(process.env.LOCALAPPDATA)
      var binPath = localAppData ? path.resolve(localAppData, 'Keybase', 'keybase.exe') : 'keybase.exe'
      const args = ['pipeowner', socketPath]
      yield Saga.call(
        () =>
          new Promise((resolve, reject) => {
            execFile(binPath, args, {windowsHide: true}, (error, stdout, stderr) => {
              if (error) {
                logger.info(`pipeowner check result: ${stdout.toString()}`)
                // error will be logged in bootstrap check
                getEngine().reset()
                reject(error)
                return
              }
              const result = JSON.parse(stdout.toString())
              if (result.isOwner) {
                resolve()
                return
              }
              logger.info(`pipeowner check result: ${stdout.toString()}`)
              reject(new Error('pipeowner check failed'))
            })
          })
      )
      yield Saga.put(
        ConfigGen.createDaemonHandshakeWait({
          increment: false,
          name: waitKey,
          version: action.payload.version,
        })
      )
    } catch (e) {
      yield Saga.put(
        ConfigGen.createDaemonHandshakeWait({
          failedFatal: true,
          failedReason: e.message || 'windows pipe owner fail',
          increment: false,
          name: waitKey,
          version: action.payload.version,
        })
      )
    }
  })

const setupReachabilityWatcher = () =>
  Saga.call(function*() {
    const channel = Saga.eventChannel(emitter => {
      window.addEventListener('online', () => emitter('online'))
      window.addEventListener('offline', () => emitter('offline'))
      return () => {}
    }, Saga.buffers.dropping(1))
    while (true) {
      yield Saga.take(channel)
      yield Saga.put(GregorGen.createCheckReachability())
    }
  })

const setupEngineListeners = () => {
  getEngine().setCustomResponseIncomingCallMap({
    'keybase.1.logsend.prepareLogsend': (_, response) => {
      dumpLogs().then(() => {
        response && response.result()
      })
    },
  })
  getEngine().setIncomingCallMap({
    'keybase.1.NotifyApp.exit': () => {
      console.log('App exit requested')
      SafeElectron.getApp().exit(0)
    },
    'keybase.1.NotifyFS.FSActivity': ({notification}) =>
      Saga.call(function*() {
        const state = yield Saga.select()
        kbfsNotification(notification, NotifyPopup, state)
      }),
    'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile': () => {
      RPCTypes.pgpPgpStorageDismissRpcPromise().catch(err => {
        console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
      })
    },
    'keybase.1.NotifyService.shutdown': code => {
      if (isWindows && code !== RPCTypes.ctlExitCode.restart) {
        console.log('Quitting due to service shutdown')
        // Quit just the app, not the service
        SafeElectron.getApp().quit()
      }
    },
    'keybase.1.NotifySession.clientOutOfDate': ({upgradeTo, upgradeURI, upgradeMsg}) => {
      const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
      NotifyPopup('Client out of date!', {body}, 60 * 60)
      // This is from the API server. Consider notifications from API server
      // always critical.
      return Saga.put(ConfigGen.createOutOfDate({critical: true, message: upgradeMsg}))
    },
  })
}

function* loadStartupDetails() {
  yield Saga.put(
    ConfigGen.createSetStartupDetails({
      startupConversation: null,
      startupFollowUser: '',
      startupLink: '',
      startupTab: null,
      startupWasFromPush: false,
    })
  )
}

const copyToClipboard = (_: any, action: ConfigGen.CopyToClipboardPayload) => {
  SafeElectron.getClipboard().writeText(action.payload.text)
}

const sendKBServiceCheck = (state: TypedState, action: ConfigGen.DaemonHandshakeWaitPayload) => {
  if (
    action.payload.version === state.config.daemonHandshakeVersion &&
    state.config.daemonHandshakeWaiters.size === 0 &&
    state.config.daemonHandshakeFailedReason === ConfigConstants.noKBFSFailReason
  ) {
    SafeElectron.getIpcRenderer().send('kb-service-check')
  }
}

const startOutOfDateCheckLoop = () =>
  Saga.call(function*() {
    while (1) {
      try {
        const {status, message} = yield Saga.call(RPCTypes.configGetUpdateInfoRpcPromise)
        if (status !== RPCTypes.configUpdateInfoStatus.upToDate) {
          yield Saga.put(
            ConfigGen.createOutOfDate({
              critical: status === RPCTypes.configUpdateInfoStatus.criticallyOutOfDate,
              message,
            })
          )
        }
        yield Saga.delay(3600 * 1000) // 1 hr
      } catch (err) {
        logger.warn('error getting update info: ', err)
        yield Saga.delay(60 * 1000) // 1 min
      }
    }
  })

const updateNow = () => RPCTypes.configStartUpdateIfNeededRpcPromise()

export function* platformConfigSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToAction(ConfigGen.setOpenAtLogin, writeElectronSettingsOpenAtLogin)
  yield Saga.actionToAction(ConfigGen.setNotifySound, writeElectronSettingsNotifySound)
  yield Saga.actionToAction(setLastSentXLM, writeLastSentXLM)
  yield Saga.actionToAction(ConfigGen.showMain, showMainWindow)
  yield Saga.actionToAction(ConfigGen.dumpLogs, dumpLogs)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupReachabilityWatcher)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, startOutOfDateCheckLoop)
  yield Saga.actionToAction(ConfigGen.copyToClipboard, copyToClipboard)
  yield Saga.actionToPromise(ConfigGen.updateNow, updateNow)
  yield Saga.fork(initializeAppSettingsState)
  yield Saga.actionToAction(ConfigGen.daemonHandshakeWait, sendKBServiceCheck)

  if (isWindows) {
    yield Saga.actionToAction(ConfigGen.daemonHandshake, checkRPCOwnership)
  }

  // Start this immediately
  yield Saga.fork(loadStartupDetails)
}
