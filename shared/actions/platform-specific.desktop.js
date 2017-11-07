// @flow
import {ipcRenderer} from 'electron'

import type {AsyncAction} from '../constants/types/flux'

function showShareActionSheet(options: {
  url?: ?any,
  message?: ?any,
}): Promise<{completed: boolean, method: string}> {
  throw new Error('Show Share Action - unsupported on this platform')
}

type NextURI = string
function saveAttachmentDialog(filePath: string): Promise<NextURI> {
  throw new Error('Save Attachment - unsupported on this platform')
}

function requestPushPermissions(): Promise<*> {
  throw new Error('Push permissions unsupported on this platform')
}

function configurePush() {
  throw new Error('Configure Push not needed on this platform')
}

function setNoPushPermissions(): Promise<*> {
  throw new Error('Push permissions unsupported on this platform')
}

function showMainWindow(): AsyncAction {
  return () => {
    ipcRenderer && ipcRenderer.send('showMain')
  }
}

function displayNewMessageNotification(text: string, convID: ?string, badgeCount: ?number, myMsgID: ?number) {
  throw new Error('Display new message notification not available on this platform')
}

export {
  requestPushPermissions,
  showMainWindow,
  configurePush,
  saveAttachmentDialog,
  showShareActionSheet,
  setNoPushPermissions,
  displayNewMessageNotification,
}
