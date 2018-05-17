// @flow
import * as SafeElectron from '../../util/safe-electron.desktop'
import {showDevTools} from '../../local-debug.desktop'
import flags from '../../util/feature-flags'

function setupDevToolsExtensions() {
  if (process.env.KEYBASE_DEV_TOOL_EXTENSIONS) {
    process.env.KEYBASE_DEV_TOOL_EXTENSIONS.split(',').forEach(p => {
      SafeElectron.BrowserWindow.addDevToolsExtension(p)
    })
  }
}

function setupOpenDevtools() {
  let devToolsState = showDevTools

  if (flags.admin) {
    SafeElectron.getGlobalShortcut().register('CommandOrControl+Alt+k+b', () => {
      devToolsState = !devToolsState
      SafeElectron.BrowserWindow.getAllWindows().map(
        bw => (devToolsState ? bw.webContents.openDevTools('detach') : bw.webContents.closeDevTools())
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
  SafeElectron.getApp().on('ready', () => {
    setupDevToolsExtensions()
    setupOpenDevtools()
  })

  SafeElectron.getApp().on('will-quit', () => {
    cleanupOpenDevtools()
  })
}
