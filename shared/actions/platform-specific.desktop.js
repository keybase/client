// @flow
import {showDockIcon} from '../desktop/app/dock-icon.desktop'
import {getMainWindow} from '../desktop/remote/util.desktop'
import * as SafeElectron from '../util/safe-electron.desktop'
import * as ConfigGen from './config-gen'
import * as LoginGen from './login-gen'
import * as Saga from '../util/saga'
import {writeLogLinesToFile} from '../util/forward-logs'
import logger from '../logger'
import {quit} from '../util/quit-helper'
import {type TypedState} from '../constants/reducer'

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

function openAppSettings(): void {
  throw new Error('Cannot open app settings on desktop')
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

const writeElectronSettings = (action: ConfigGen.SetOpenAtLoginPayload) =>
  action.payload.writeFile &&
  SafeElectron.getIpcRenderer().send('setAppState', {openAtLogin: action.payload.open})

// get this value from electron and update our store version
function* initializeOpenAtLoginState(): Generator<any, void, any> {
  const getAppState = () =>
    new Promise((resolve, reject) => {
      SafeElectron.getIpcRenderer().once('getAppStateReply', (event, data) => resolve(data))
      SafeElectron.getIpcRenderer().send('getAppState')
    })

  const state = yield Saga.call(getAppState)
  if (state) {
    yield Saga.put(ConfigGen.createSetOpenAtLogin({open: state.openAtLogin, writeFile: false}))
  }
}

export const dumpLogs = (action: ?ConfigGen.DumpLogsPayload) =>
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

const onBootstrapped = (state: TypedState) => Saga.put(LoginGen.createNavBasedOnLoginAndInitialState())

function* platformConfigSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(ConfigGen.setOpenAtLogin, writeElectronSettings)
  yield Saga.safeTakeLatestPure(ConfigGen.showMain, showMainWindow)
  yield Saga.safeTakeEveryPure(ConfigGen.dumpLogs, dumpLogs)
  yield Saga.fork(initializeOpenAtLoginState)
  yield Saga.safeTakeEveryPureSimple(ConfigGen.bootstrapSuccess, onBootstrapped)
}

export {
  checkPermissions,
  getShownPushPrompt,
  openAppSettings,
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
