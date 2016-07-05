// @flow
import {ipcRenderer, ipcMain, app} from 'electron'
import {quit} from '../../desktop/app/ctl'

export type Context = {type: 'uiWindow'} | {type: 'mainThread'} | {type: 'quitButton'}

export type Action = {type: 'closePopups'} | {type: 'hideMainWindow'} | {type: 'quitApp'}

// Logic to figure out what to do given your context
export function quitOnContext (context: Context): Array<Action> {
  switch (context.type) {
    case 'uiWindow':
      return [{type: 'closePopups'}, {type: 'hideMainWindow'}]
    case 'mainThread':
    case 'quitButton':
      return [{type: 'quitApp'}]
  }

  return []
}

function isMainThread () {
  // the main thread's process.type is browser: https://github.com/electron/electron/blob/master/docs/api/process.md
  // $FlowIssue
  return process.type === 'browser'
}

function _executeActions (actions: Array<Action>) {
  actions.forEach(a => {
    switch (a.type) {
      case 'hideMainWindow':
      case 'closePopups':
        app.emit('close-windows')
        return
      case 'quitApp':
        quit()
        return
    }
  })
}

// Takes an array of actions, but makes an ipc call to have the main thread execute the actions
function _executeActionsFromRenderer (actions: Array<Action>) {
  ipcRenderer.send('executeActions', actions)
}

export function executeActions (actions: Array<Action>) {
  if (isMainThread()) {
    _executeActions(actions)
  } else {
    _executeActionsFromRenderer(actions)
  }
}

export function setupExecuteActionsListener () {
  ipcMain.on('executeActions', (event, actions) => {
    executeActions(actions)
  })
}
