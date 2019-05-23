import * as SafeElectron from '../../util/safe-electron.desktop'
import {showDevTools} from '../../local-debug.desktop'
import flags from '../../util/feature-flags'

function setupDevToolsExtensions() {
  if (process.env.KEYBASE_DEV_TOOL_EXTENSIONS) {
    process.env.KEYBASE_DEV_TOOL_EXTENSIONS.split(',').forEach(p => {
      try {
        SafeElectron.BrowserWindow.addDevToolsExtension(p)
      } catch (e) {
        console.error('Dev tool loading crash', p, e)
      }
    })
  }
}

function setupOpenDevtools() {
  let devToolsState = showDevTools

  if (flags.admin) {
    SafeElectron.getGlobalShortcut().register('CommandOrControl+Alt+k+b', () => {
      devToolsState = !devToolsState
      SafeElectron.BrowserWindow.getAllWindows().map(bw =>
        devToolsState ? bw.webContents.openDevTools({mode: 'detach'}) : bw.webContents.closeDevTools()
      )
    })
  }
}

function cleanupOpenDevtools() {
  if (flags.admin) {
    SafeElectron.getGlobalShortcut().unregister('CommandOrControl+Alt+k+b')
  }
}

export default function() {
  const app = SafeElectron.getApp()
  if (app.isReady()) {
    setupOpenDevtools()
    setupDevToolsExtensions()
  } else {
    app.on('ready', () => {
      setupOpenDevtools()
      setupDevToolsExtensions()
    })
  }

  SafeElectron.getApp().on('will-quit', () => {
    cleanupOpenDevtools()
  })
}
