// @flow
import {showDockIcon} from '../desktop/app/dock-icon'
import {getMainWindow} from '../desktop/remote/util'
import {ipcRenderer} from 'electron'
import {isWindows, socketPath} from '../constants/platform'
import logger from '../logger'
import {execFile} from 'child_process'
import path from 'path'

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

function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  throw new Error('Save Attachment to camera roll - unsupported on this platform')
}

function requestPushPermissions(): Promise<*> {
  throw new Error('Push permissions unsupported on this platform')
}

function configurePush() {
  throw new Error('Configure Push not needed on this platform')
}

function setAppState(toMerge: Object) {
  ipcRenderer.send('setAppState', toMerge)
}

function getAppState(): Promise<*> {
  return new Promise((resolve, reject) => {
    ipcRenderer.once('getAppStateReply', (event, data) => resolve(data))
    ipcRenderer.send('getAppState')
  })
}

function showMainWindow() {
  const mw = getMainWindow()
  mw && mw.show()
  showDockIcon()
}

function displayNewMessageNotification(text: string, convID: ?string, badgeCount: ?number, myMsgID: ?number) {
  throw new Error('Display new message notification not available on this platform')
}

function clearAllNotifications() {
  throw new Error('Clear all notifications not available on this platform')
}

function checkPermissions(): Promise<*> {
  throw new Error('Push permissions unsupported on this platform')
}

function setShownPushPrompt(): Promise<*> {
  throw new Error('Push permissions unsupported on this platform')
}

function getShownPushPrompt(): Promise<string> {
  throw new Error('Push permissions unsupported on this platform')
}

function openAppSettings(): void {
  throw new Error('Cannot open app settings on desktop')
}

function checkRPCOwnership(): Promise<*> {
  return new Promise((resolve, reject) => {
    if (!isWindows) {
      return resolve({})
    }
    logger.info('Checking RPC ownership')

    const localAppData = String(process.env.LOCALAPPDATA)
    var binPath = localAppData ? path.resolve(localAppData, 'Keybase', 'keybase.exe') : 'keybase.exe'
    const args = ['pipeowner', socketPath]
    execFile(binPath, args, {windowsHide: true}, (error, stdout, stderr) => {
      if (error) {
        logger.info(`pipeowner check returns: ${error.message}`)
        reject(error)
        return
      }
      const result = stdout.trim()
      logger.info(`pipeowner check returns: ${result}`)
      if (result === 'true') {
        resolve()
        return
      }
      reject(new Error(`pipeowner check returns: ${result}`))
    })
  })
}

export {
  checkPermissions,
  setShownPushPrompt,
  getShownPushPrompt,
  openAppSettings,
  requestPushPermissions,
  showMainWindow,
  configurePush,
  getAppState,
  setAppState,
  saveAttachmentDialog,
  saveAttachmentToCameraRoll,
  showShareActionSheet,
  downloadAndShowShareActionSheet,
  displayNewMessageNotification,
  clearAllNotifications,
  checkRPCOwnership,
}
