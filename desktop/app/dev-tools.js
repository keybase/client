// @flow
import {BrowserWindow, app, globalShortcut} from 'electron'
import {showDevTools, skipSecondaryDevtools} from '../shared/local-debug.desktop'

function setupDevToolsExtensions () {
  if (__DEV__ && process.env.KEYBASE_LOCAL_DEBUG) {
    if (process.env.KEYBASE_DEV_TOOL_EXTENSIONS) {
      process.env.KEYBASE_DEV_TOOL_EXTENSIONS.split(',').forEach(p => {
        BrowserWindow.addDevToolsExtension(p)
      })
    }
  }
}

function setupOpenDevtools () {
  let devToolsState = showDevTools

  globalShortcut.register('CommandOrControl+Alt+k+b', () => {
    devToolsState = !devToolsState
    BrowserWindow.getAllWindows().map(bw => devToolsState ? bw.webContents.openDevTools() : bw.webContents.closeDevTools())
  })
}

function cleanupOpenDevtools () {
  globalShortcut.unregister('CommandOrControl+Alt+k+b')
}

export default function () {
  app.on('ready', () => {
    setupDevToolsExtensions()
    setupOpenDevtools()
  })

  app.on('will-quit', () => {
    cleanupOpenDevtools()
  })

  if (showDevTools) {
    app.on('browser-window-created', (e, win) => {
      win = win || BrowserWindow.getFocusedWindow()

      if (win) {
        win.webContents.addListener('did-navigate', () => {
          if (!skipSecondaryDevtools || win.webContents.getURL().indexOf('renderer/index.html') !== -1) {
            win.openDevTools()
          }
        })
      }
    })
  }
}
