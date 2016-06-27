import {BrowserWindow, app, globalShortcut} from 'electron'
import {showDevTools, skipLauncherDevtools} from '../shared/local-debug.desktop'

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
  globalShortcut.register('CommandOrControl+Alt+k+b', () => {
    BrowserWindow.getAllWindows().map(bw => {
      bw.openDevTools()
    })
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

  if (!showDevTools) {
    return
  }

  app.on('browser-window-created', (e, win) => {
    win = win || BrowserWindow.getFocusedWindow()

    if (win) {
      if (skipLauncherDevtools) {
        win.webContents.addListener('did-finish-load', () => {
          if (win.webContents.getURL().indexOf('launcher.') !== -1) {
            win.closeDevTools()
          }
        })
      }
      win.openDevTools()
    }
  })
}
