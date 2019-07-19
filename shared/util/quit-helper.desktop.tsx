import * as SafeElectron from '../util/safe-electron.desktop'
import {quit} from '../desktop/app/ctl.desktop'
import {hideDockIcon} from '../desktop/app/dock-icon.desktop'

export type Context = 'uiWindow' | 'mainThread' | 'quitButton' | 'beforeQuit'
export type Action = 'closePopups' | 'quitMainWindow' | 'quitApp'

// Logic to figure out what to do given your context
function quitOnContext(context: Context): Array<Action> {
  switch (context) {
    case 'uiWindow':
      return ['closePopups', 'quitMainWindow']
    case 'mainThread':
    case 'beforeQuit':
    case 'quitButton':
      return ['quitApp']
  }

  return []
}

function isMainThread() {
  // the main thread's process.type is browser: https://github.com/electron/electron/blob/master/docs/api/process.md
  return process.type === 'browser'
}

function _executeActions(actions: Array<Action>) {
  actions.forEach(a => {
    switch (a) {
      case 'quitMainWindow':
        hideDockIcon()
        break
      case 'closePopups':
        SafeElectron.getApp().emit('close-windows')
        break
      case 'quitApp':
        quit()
        break
    }
  })
}

// Takes an array of actions, but makes an ipc call to have the main thread execute the actions
function _executeActionsFromRenderer(actions: Array<Action>) {
  SafeElectron.getIpcRenderer().send('executeActions', actions)
}

export function executeActionsForContext(context: Context) {
  const actions = quitOnContext(context)
  if (isMainThread()) {
    _executeActions(actions)
  } else {
    _executeActionsFromRenderer(actions)
  }
}

export function setupExecuteActionsListener() {
  SafeElectron.getIpcMain().on('executeActions', (_, actions) => {
    console.log('executeActionsRecieved', actions)
    _executeActions(actions)
  })
}

const crossplatformQuit = (reason: Context) => {
  executeActionsForContext(reason)
}

export {crossplatformQuit as quit}

export function hideWindow() {
  SafeElectron.getRemote()
    .getCurrentWindow()
    .hide()
}
