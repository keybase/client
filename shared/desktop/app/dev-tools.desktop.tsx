import * as Electron from 'electron'
import {showDevTools} from '../../local-debug.desktop'
import flags from '../../util/feature-flags'

function setupDevToolsExtensions() {
  if (process.env.KEYBASE_DEV_TOOL_EXTENSIONS) {
    process.env.KEYBASE_DEV_TOOL_EXTENSIONS.split(',').forEach(p => {
      try {
        Electron.BrowserWindow.addDevToolsExtension(p)
      } catch (e) {
        console.error('Dev tool loading crash', p, e)
      }
    })
  }
}

function setupOpenDevtools() {
  let devToolsState = showDevTools

  if (flags.admin) {
    Electron.globalShortcut.register('CommandOrControl+Alt+k+b', () => {
      devToolsState = !devToolsState
      Electron.BrowserWindow.getAllWindows().map(bw =>
        devToolsState ? bw.webContents.openDevTools({mode: 'detach'}) : bw.webContents.closeDevTools()
      )
    })
  }
}

function cleanupOpenDevtools() {
  if (flags.admin) {
    Electron.globalShortcut.unregister('CommandOrControl+Alt+k+b')
  }
}

export default function() {
  if (Electron.app.isReady()) {
    setupOpenDevtools()
    setupDevToolsExtensions()
  } else {
    Electron.app.on('ready', () => {
      setupOpenDevtools()
      setupDevToolsExtensions()
    })
  }

  Electron.app.on('will-quit', () => {
    cleanupOpenDevtools()
  })
}
