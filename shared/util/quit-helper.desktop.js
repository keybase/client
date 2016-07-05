// @flow
import electron from 'electron'
import {ipcRenderer, ipcMain} from 'electron'
import {quit} from '../../desktop/app/ctl'

const app = electron.app || electron.remote.app
const BrowserWindow = electron.BrowserWindow || electron.remote.BrowserWindow

type WindowContext = {type: 'uiWindow'} | {type: 'menubar'} | {type: 'popup'} | {type: 'mainWindow'} | {type: 'mainThread'}

export type Context = {type: 'mainThread'} | {type: 'quitButton'} | WindowContext

export type Action = {type: 'closePopups'} | {type: 'hideMainWindow'} | {type: 'quitApp'}

// Logic to figure out what to do given your context
export function quitOnContext (context: Context): Array<Action> {
  switch (context.type) {
    case 'uiWindow':
    case 'popup':
    case 'mainWindow':
      return [{type: 'closePopups'}, {type: 'hideMainWindow'}]
    case 'mainThread':
    case 'quitButton':
      return [{type: 'quitApp'}]
  }

  return []
}

export function getContextFromWindowId (windowId: number): Context {
  // $FlowIssue
  if (process.type === 'browser') {
    return {type: 'mainThread'}
  }

  const w = BrowserWindow.fromId(windowId)
  const url = w && w.getURL()

  if (url && url.indexOf('renderer/index')) {
    return {type: 'mainWindow'}
  }

  return {type: 'popup'}
}

export function executeActions (actions: Array<Action>) {
  if (getContextFromWindowId(-1).type !== 'mainThread') {
    console.error('Tried to call executeActions from renderer thread')
    return
  }

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
export function executeActionsFromRenderer (actions: Array<Action>) {
  ipcRenderer.send('executeActions', actions)
}

export function setupExecuteActionsListener () {
  ipcMain.on('executeActions', (event, actions) => {
    executeActions(actions)
  })
}
