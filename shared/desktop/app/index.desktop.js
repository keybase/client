// @flow
import MainWindow from './main-window.desktop'
import devTools from './dev-tools.desktop'
import installer from './installer.desktop'
import menuBar from './menu-bar.desktop'
import os from 'os'
import windowHelper from './window-helper.desktop'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {setupExecuteActionsListener, executeActionsForContext} from '../../util/quit-helper.desktop'
import {allowMultipleInstances} from '../../local-debug.desktop'
import startWinService from './start-win-service.desktop'
import {isWindows, cacheRoot} from '../../constants/platform.desktop'

process.on('uncaughtException', e => {
  console.log('Uncaught exception on main thread:', e)
})

if (process.env.KEYBASE_CRASH_REPORT) {
  console.log(
    `Adding crash reporting (local). Crash files located in ${SafeElectron.getApp().getPath('temp')}`
  )
  SafeElectron.getCrashReporter().start({
    companyName: 'Keybase',
    crashesDirectory: cacheRoot,
    productName: 'Keybase',
    submitURL: '',
    uploadToServer: false,
  })
}

let mainWindow = null
let _menubarWindowID = 0

const _maybeTellMainWindowAboutMenubar = () => {
  if (mainWindow && _menubarWindowID) {
    mainWindow.window.webContents.send('updateMenubarWindowID', _menubarWindowID)
  }
}

function start() {
  if (!allowMultipleInstances) {
    // Only one app per app in osx...
    const shouldQuit = SafeElectron.getApp().makeSingleInstance(() => {
      if (mainWindow) {
        mainWindow.show()
        if (isWindows) {
          mainWindow.window && mainWindow.window.focus()
        }
      }
    })

    if (shouldQuit) {
      console.log('Only one instance of keybase GUI allowed, bailing!')
      SafeElectron.getApp().quit()
      return
    }
  }

  // Check supported OS version
  if (os.platform() === 'darwin') {
    // Release numbers for OS versions can be looked up here: https://en.wikipedia.org/wiki/Darwin_%28operating_system%29#Release_history
    // 14.0.0 == 10.10.0
    // 15.0.0 == 10.11.0
    if (parseInt(os.release().split('.')[0], 10) < 14) {
      SafeElectron.getDialog().showErrorBox(
        'Keybase Error',
        "This version of macOS isn't currently supported."
      )
      SafeElectron.getApp().quit()
      return
    }
  }

  // Windows needs this for notifications to show on certain versions
  // https://msdn.microsoft.com/en-us/library/windows/desktop/dd378459(v=vs.85).aspx
  SafeElectron.getApp().setAppUserModelId('Keybase.Keybase.GUI')

  // MUST do this else we get limited by simultaneous hot reload event streams
  SafeElectron.getApp().commandLine.appendSwitch('ignore-connections-limit', 'localhost')

  if (__DEV__) {
    // eslint-disable-line no-undef
    SafeElectron.getApp().commandLine.appendSwitch('enable-logging')
    SafeElectron.getApp().commandLine.appendSwitch('v', 3)
  }

  devTools()
  // Load menubar and get its browser window id so we can tell the main window
  menuBar(id => {
    _menubarWindowID = id
  })
  windowHelper(SafeElectron.getApp())

  console.log('Version:', SafeElectron.getApp().getVersion())

  SafeElectron.getApp().once('ready', () => {
    mainWindow = MainWindow()
    _maybeTellMainWindowAboutMenubar()
    SafeElectron.getIpcMain().on('mainWindowWantsMenubarWindowID', () => {
      _maybeTellMainWindowAboutMenubar()
    })

    SafeElectron.getIpcMain().on('remoteWindowWantsProps', (_, windowComponent, windowParam) => {
      mainWindow && mainWindow.window.webContents.send('remoteWindowWantsProps', windowComponent, windowParam)
    })
  })

  SafeElectron.getIpcMain().on('install-check', (event, arg) => {
    installer(err => {
      if (err) {
        console.log('Error: ', err)
      }
      event.sender.send('installed')
    })
  })

  SafeElectron.getIpcMain().on('kb-service-check', (event, arg) => {
    if (isWindows) {
      console.log('kb-service-check: starting keybase.exe')
      startWinService()
    }
  })

  // Called when the user clicks the dock icon
  SafeElectron.getApp().on('activate', () => {
    mainWindow && mainWindow.show()
  })

  // Don't quit the app, instead try to close all windows
  SafeElectron.getApp().on('close-windows', event => {
    const windows = SafeElectron.BrowserWindow.getAllWindows()
    windows.forEach(w => {
      // We tell it to close, we can register handlers for the 'close' event if we want to
      // keep this window alive or hide it instead.
      w.close()
    })
  })

  // quit through dock. only listen once
  SafeElectron.getApp().once('before-quit', event => {
    console.log('Quit through before-quit')
    event.preventDefault()
    executeActionsForContext('beforeQuit')
  })
}

start()
setupExecuteActionsListener()
