// @flow
import {ipcRenderer} from 'electron'

import type {AsyncAction} from '../constants/types/flux'

function showShareActionSheet (options: {url?: ?any, message?: ?any}): Promise<{completed: boolean, method: string}> {
  throw new Error('Show Share Action - unsupported on this platform')
}

type NextURI = string
function saveAttachment (filePath: string): Promise<NextURI> {
  throw new Error('Save Attachment - unsupported on this platform')
}

function requestPushPermissions (): Promise<*> {
  throw new Error('Push permissions unsupported on this platform')
}

function clearLocalPushNotifications () {
  throw new Error('Clear local push notifications not needed on this platform')
}

function configurePush () {
  throw new Error('Configure Push not needed on this platform')
}

function showMainWindow (): AsyncAction {
  return () => {
    ipcRenderer && ipcRenderer.send('showMain')
  }
}

export {
  clearLocalPushNotifications,
  requestPushPermissions,
  showMainWindow,
  configurePush,
  saveAttachment,
  showShareActionSheet,
}
