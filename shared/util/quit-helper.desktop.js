// @flow
import electron from 'electron'

const app = electron.app || electron.remote.app
const BrowserWindow = electron.BrowserWindow || electron.remote.BrowserWindow

type WindowContext = {
  type: 'uiWindow',
} | {
  type: 'menubar',
} | {
  type: 'popup',
} | {
  type: 'mainWindow',
} | {
  type: 'mainThread',
}

export type Context = {
  type: 'mainThread',
} | {
  type: 'quitButton',
} | WindowContext

export type Action = {
  type: 'closePopups',
} | {
  type: 'hideMainWindow',
} | {
  type: 'quitApp',
}

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

  const url = BrowserWindow.fromId(windowId).getURL()

  if (url.indexOf('renderer/index')) {
    return {type: 'mainWindow'}
  }

  return {type: 'popup'}
}

export function executeActions (actions: Array<Action>) {
  actions.forEach(a => {
    switch (a.type) {
      case 'hideMainWindow':
      case 'closePopups':
        app.emit('close-windows')
        return
      case 'quitApp':
        app.quit()
        return
    }
  })
}
