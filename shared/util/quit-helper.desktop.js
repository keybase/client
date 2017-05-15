// @flow
import {ipcRenderer, ipcMain, app} from 'electron'
import {quit} from '../desktop/app/ctl'
import {hideDockIcon} from '../desktop/app/dock-icon'

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
  // $FlowIssue
  return process.type === 'browser'
}

function _executeActions(actions: Array<Action>) {
  actions.forEach(a => {
    switch (a) {
      case 'quitMainWindow':
        hideDockIcon()
        break
      case 'closePopups':
        app.emit('close-windows')
        break
      case 'quitApp':
        quit()
        break
    }
  })
}

// Takes an array of actions, but makes an ipc call to have the main thread execute the actions
function _executeActionsFromRenderer(actions: Array<Action>) {
  ipcRenderer.send('executeActions', actions)
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
  ipcMain.on('executeActions', (event, actions) => {
    console.log('executeActionsRecieved', actions)
    _executeActions(actions)
  })
}
