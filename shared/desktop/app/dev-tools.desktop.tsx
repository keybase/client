import * as Electron from 'electron'
import {showDevTools} from '@/local-debug.desktop'
import flags from '@/util/feature-flags'

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

export default function DevTools() {
  if (Electron.app.isReady()) {
    setupOpenDevtools()
  } else {
    Electron.app.on('ready', () => {
      setupOpenDevtools()
    })
  }

  Electron.app.on('will-quit', () => {
    cleanupOpenDevtools()
  })
}
