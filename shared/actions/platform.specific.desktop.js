// @flow
import {ipcRenderer} from 'electron'

import type {AsyncAction} from '../constants/types/flux'

function requestPushPermissions (): Promise<*> {
  throw new Error('Push permissions unsupported on this platform')
}

function showMainWindow (): AsyncAction {
  return () => {
    ipcRenderer && ipcRenderer.send('showMain')
  }
}

export {
  requestPushPermissions,
  showMainWindow,
}
