// @flow
// Entry point for the node part of the electron app
import MainWindow from './main-window.desktop'
import devTools from './dev-tools.desktop'
import installer from './installer.desktop'
import menuBar from './menu-bar.desktop'
import os from 'os'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {setupExecuteActionsListener, executeActionsForContext} from '../../util/quit-helper.desktop'
import {allowMultipleInstances} from '../../local-debug.desktop'
import startWinService from './start-win-service.desktop'
import {isWindows, cacheRoot} from '../../constants/platform.desktop'

let mainWindow = null

const installCrashReporter = () => {
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
}

const areWeThePrimaryInstance = () => {
  if (allowMultipleInstances) {
    return true
  }
  return SafeElectron.getApp().requestSingleInstanceLock()
}

const appShouldDieOnStartup = () => {
  if (!areWeThePrimaryInstance()) {
    console.log('Only one instance of keybase GUI allowed, bailing!')
    return true
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
      return true
    }
  }
  return false
}

const focusSelfOnAnotherInstanceLaunching = () => {
  if (!mainWindow) {
    return
  }

  mainWindow.show()
  if (isWindows) {
    mainWindow.window && mainWindow.window.focus()
  }
}

const changeCommandLineSwitches = () => {
  // MUST do this else we get limited by simultaneous hot reload event streams
  SafeElectron.getApp().commandLine.appendSwitch('ignore-connections-limit', 'localhost')

  if (__DEV__) {
    // too noisy any higher than 0 now
    // SafeElectron.getApp().commandLine.appendSwitch('enable-logging')
    // SafeElectron.getApp().commandLine.appendSwitch('v', 0)
  }
}

const fixWindowsNotifications = () => {
  // Windows needs this for notifications to show on certain versions
  // https://msdn.microsoft.com/en-us/library/windows/desktop/dd378459(v=vs.85).aspx
  SafeElectron.getApp().setAppUserModelId('Keybase.Keybase.GUI')
}

let menubarWindowID = 0

const tellMainWindowAboutMenubar = () => {
  if (mainWindow && menubarWindowID) {
    mainWindow.window.webContents.send('updateMenubarWindowID', menubarWindowID)
  }
}

const setupMenubar = () => {
  menuBar(id => {
    menubarWindowID = id
  })
}

const handleCrashes = () => {
  process.on('uncaughtException', e => {
    console.log('Uncaught exception on main thread:', e)
  })

  if (!__DEV__) {
    SafeElectron.getApp().on('browser-window-created', (e, win) => {
      if (!win) {
        return
      }

      win.on('unresponsive', e => {
        console.log('Browser window unresponsive: ', e)
        win.reload()
      })

      if (win.webContents) {
        win.webContents.on('crashed', e => {
          console.log('Browser window crashed: ', e)
          win.reload()
        })
      }
    })
  }
}

const createMainWindow = () => {
  mainWindow = MainWindow()
  tellMainWindowAboutMenubar()
  SafeElectron.getIpcMain().on('mainWindowWantsMenubarWindowID', () => {
    tellMainWindowAboutMenubar()
  })

  // A remote window wants props
  SafeElectron.getIpcMain().on('remoteWindowWantsProps', (_, windowComponent, windowParam) => {
    mainWindow && mainWindow.window.webContents.send('remoteWindowWantsProps', windowComponent, windowParam)
  })
}

const handleInstallCheck = (event, arg) => {
  installer(err => {
    if (err) {
      console.log('Error: ', err)
    }
    event.sender.send('installed')
  })
}

const handleKBServiceCheck = (event, arg) => {
  if (isWindows) {
    console.log('kb-service-check: starting keybase.exe')
    startWinService()
  }
}

const handleActivate = () => mainWindow && mainWindow.show()

const handleCloseWindows = event => {
  const windows = SafeElectron.BrowserWindow.getAllWindows()
  windows.forEach(w => {
    // We tell it to close, we can register handlers for the 'close' event if we want to
    // keep this window alive or hide it instead.
    w.close()
  })
}

const handleQuitting = event => {
  console.log('Quit through before-quit')
  event.preventDefault()
  executeActionsForContext('beforeQuit')
}

const start = () => {
  handleCrashes()
  installCrashReporter()

  if (appShouldDieOnStartup()) {
    SafeElectron.getApp().quit()
    return
  }

  console.log('Version:', SafeElectron.getApp().getVersion())

  // Foreground if another instance tries to launch
  SafeElectron.getApp().on('second-instance', focusSelfOnAnotherInstanceLaunching)

  fixWindowsNotifications()
  changeCommandLineSwitches()

  devTools()
  // Load menubar and get its browser window id so we can tell the main window
  setupMenubar()

  SafeElectron.getApp().once('ready', createMainWindow)
  SafeElectron.getIpcMain().on('install-check', handleInstallCheck)
  SafeElectron.getIpcMain().on('kb-service-check', handleKBServiceCheck)

  // Called when the user clicks the dock icon
  SafeElectron.getApp().on('activate', handleActivate)

  // Don't quit the app, instead try to close all windows
  SafeElectron.getApp().on('close-windows', handleCloseWindows)

  // quit through dock. only listen once
  SafeElectron.getApp().once('before-quit', handleQuitting)

  setupExecuteActionsListener()
}

start()
