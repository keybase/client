// @flow
import {showDockIcon} from '../desktop/app/dock-icon'
import {getMainWindow} from '../desktop/remote/util'
import {ipcRenderer} from 'electron'

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

function setAppState(toMerge: Object) {
  ipcRenderer.send('setAppState', toMerge)
}

function getAppState() {
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

function checkPermissions() {
  throw new Error('Push permissions unsupported on this platform')
}

function setShownPushPrompt() {
  throw new Error('Push permissions unsupported on this platform')
}

function getShownPushPrompt(): Promise<string> {
  throw new Error('Push permissions unsupported on this platform')
}

function openAppSettings(): void {
  throw new Error('Cannot open app settings on desktop')
}

const getMimeTypeFromURL = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    function listener(event, res) {
      if (!res || res.url !== url) {
        return
      }
      res.error ? reject(res.error) : resolve(res.contentType.length ? res.contentType[0] : '')
      ipcRenderer.removeListener('getMimeTypeFromURLResult', listener)
    }
    ipcRenderer.on('getMimeTypeFromURLResult', listener)
    ipcRenderer.send('getMimeTypeFromURL', url)
  })

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
  getMimeTypeFromURL,
}
