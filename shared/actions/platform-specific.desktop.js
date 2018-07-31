// @flow
import {showDockIcon} from '../desktop/app/dock-icon.desktop'
import {getMainWindow} from '../desktop/remote/util.desktop'
import * as SafeElectron from '../util/safe-electron.desktop'
import * as GregorGen from './gregor-gen'
import * as ConfigGen from './config-gen'
import * as Saga from '../util/saga'
import {writeLogLinesToFile} from '../util/forward-logs'
import logger from '../logger'
import {quit} from '../util/quit-helper'
import {execFile} from 'child_process'
import path from 'path'
import {isWindows, socketPath} from '../constants/platform.desktop'
import {getEngine} from '../engine'

function showShareActionSheet(options: {
  url?: ?any,
  message?: ?any,
}): Promise<{completed: boolean, method: string}> {
  throw new Error('Show Share Action - unsupported on this platform')
}

function downloadAndShowShareActionSheet(fileURL: string) {
  throw new Error('Download and show share action - unsupported on this platform')
}

type NextURI = string
function saveAttachmentDialog(filePath: string): Promise<NextURI> {
  throw new Error('Save Attachment - unsupported on this platform')
}

async function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  throw new Error('Save Attachment to camera roll - unsupported on this platform')
}

function requestPushPermissions() {
  throw new Error('Push permissions unsupported on this platform')
}

function configurePush() {
  throw new Error('Configure Push not needed on this platform')
}

const showMainWindow = () => {
  const mw = getMainWindow()
  mw && mw.show()
  showDockIcon()
}

function displayNewMessageNotification(
  text: string,
  convID: ?string,
  badgeCount: ?number,
  myMsgID: ?number,
  soundName: ?string
) {
  throw new Error('Display new message notification not available on this platform')
}

function clearAllNotifications() {
  throw new Error('Clear all notifications not available on this platform')
}

function checkPermissions() {
  throw new Error('Push permissions unsupported on this platform')
}

function getShownPushPrompt(): Promise<string> {
  throw new Error('Push permissions unsupported on this platform')
}

const getContentTypeFromURL = (
  url: string,
  cb: ({error?: any, statusCode?: number, contentType?: string}) => void
) => {
  const req = SafeElectron.getRemote().net.request({url, method: 'HEAD'})
  req.on('response', response => {
    let contentType = ''
    if (response.statusCode === 200) {
      const contentTypeHeader = response.headers['content-type']
      contentType = Array.isArray(contentTypeHeader) && contentTypeHeader.length ? contentTypeHeader[0] : ''
    }
    cb({statusCode: response.statusCode, contentType})
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

const checkRPCOwnership = () =>
  new Promise((resolve, reject) => {
    if (!isWindows) {
      return resolve()
    }
    logger.info('Checking RPC ownership')

    const localAppData = String(process.env.LOCALAPPDATA)
    var binPath = localAppData ? path.resolve(localAppData, 'Keybase', 'keybase.exe') : 'keybase.exe'
    const args = ['pipeowner', socketPath]
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
      getEngine().reset()
      reject(new Error(`pipeowner check failed`))
    })
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

function* platformConfigSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToAction(ConfigGen.setOpenAtLogin, writeElectronSettingsOpenAtLogin)
  yield Saga.actionToAction(ConfigGen.setNotifySound, writeElectronSettingsNotifySound)
  yield Saga.actionToAction(ConfigGen.showMain, showMainWindow)
  yield Saga.actionToAction(ConfigGen.dumpLogs, dumpLogs)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, checkRPCOwnership)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupReachabilityWatcher)

  yield Saga.fork(initializeAppSettingsState)
}

export {
  checkPermissions,
  getShownPushPrompt,
  requestPushPermissions,
  configurePush,
  saveAttachmentDialog,
  saveAttachmentToCameraRoll,
  showShareActionSheet,
  downloadAndShowShareActionSheet,
  displayNewMessageNotification,
  clearAllNotifications,
  getContentTypeFromURL,
  platformConfigSaga,
}
