import * as Electron from 'electron'
import {showDevTools, skipExtensions} from '../../local-debug.desktop'
import flags from '../../util/feature-flags'

export function setupDevToolsExtensions() {
  if (!skipExtensions && process.env.KEYBASE_DEV_TOOL_EXTENSIONS) {
    process.env.KEYBASE_DEV_TOOL_EXTENSIONS.split(',').forEach(p => {
      Electron.app
        .whenReady()
        .then(async () => {
          await Electron.session.defaultSession.loadExtension(p, {allowFileAccess: true})
        })
        .catch(e => {
          console.log('loading dev extensions failed', e)
        })
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

export default function () {
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
