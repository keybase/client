// Entry point for the node part of the electron app
import MainWindow from './main-window.desktop'
import devTools from './dev-tools.desktop'
import installer from './installer.desktop'
import menuBar from './menu-bar.desktop'
import os from 'os'
import * as DeeplinksGen from '../../actions/deeplinks-gen'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {setupExecuteActionsListener, executeActionsForContext} from '../../util/quit-helper.desktop'
import {allowMultipleInstances} from '../../local-debug.desktop'
import startWinService from './start-win-service.desktop'
import {isDarwin, isLinux, isWindows, cacheRoot} from '../../constants/platform.desktop'
import {sendToMainWindow} from '../remote/util.desktop'
import logger from '../../logger'

let mainWindow: (ReturnType<typeof MainWindow>) | null = null
let reduxLaunched = false
let startupURL: string | null = null

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

const focusSelfOnAnotherInstanceLaunching = (_, commandLine) => {
  if (!mainWindow) {
    return
  }

  mainWindow.show()
  if (isWindows || isLinux) {
    mainWindow.window && mainWindow.window.focus()
  }

  // The new instance might be due to a URL schema handler launch.
  logger.info('Launched with URL', commandLine)
  if (commandLine.length > 1 && commandLine[1]) {
    const link = commandLine[1]
    if (link.startsWith('web+stellar:') || link.startsWith('keybase://')) {
      sendToMainWindow('dispatchAction', {payload: {link}, type: DeeplinksGen.link})
    }
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
    SafeElectron.getApp().on('browser-window-created', (_, win) => {
      if (!win) {
        return
      }

      win.on('unresponsive', e => {
        console.log('Browser window unresponsive: ', e)
        win.reload()
      })

      if (win.webContents) {
        win.webContents.on('crashed', (_, killed) => {
          if (killed) {
            console.log('browser window killed')
          } else {
            console.log('browser window crashed')
          }
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

  SafeElectron.getIpcMain().on('reduxLaunched', () => {
    reduxLaunched = true
    if (startupURL) {
      // Mac calls open-url for a launch URL before redux is up, so we
      // stash a startupURL to be dispatched when we're ready for it.
      sendToMainWindow('dispatchAction', {payload: {link: startupURL}, type: DeeplinksGen.link})
      startupURL = null
    } else if (!isDarwin && process.argv.length > 1 && process.argv[1].startsWith('web+stellar:')) {
      // Windows and Linux instead store a launch URL in argv.
      sendToMainWindow('dispatchAction', {payload: {link: process.argv[1]}, type: DeeplinksGen.link})
    }
  })
}

const handleInstallCheck = event => {
  installer(err => {
    if (err) {
      console.log('Error: ', err)
    }
    event.sender.send('installed')
  })
}

const handleKBServiceCheck = () => {
  if (isWindows) {
    console.log('kb-service-check: starting keybase.exe')
    startWinService()
  }
}

const handleActivate = () => mainWindow && mainWindow.show()

const handleCloseWindows = () => {
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

const willFinishLaunching = () => {
  SafeElectron.getApp().on('open-url', (event, link) => {
    event.preventDefault()
    if (!reduxLaunched) {
      startupURL = link
    } else {
      sendToMainWindow('dispatchAction', {payload: {link}, type: DeeplinksGen.link})
    }
  })
}

const start = () => {
  handleCrashes()
  installCrashReporter()

  if (appShouldDieOnStartup()) {
    SafeElectron.getApp().quit()
    return
  }

  console.log('Version:', SafeElectron.getApp().getVersion())

  // Foreground if another instance tries to launch, look for SEP7 link
  SafeElectron.getApp().on('second-instance', focusSelfOnAnotherInstanceLaunching)

  fixWindowsNotifications()
  changeCommandLineSwitches()

  devTools()
  // Load menubar and get its browser window id so we can tell the main window
  setupMenubar()

  SafeElectron.getApp().once('will-finish-launching', willFinishLaunching)
  SafeElectron.getApp().once('ready', createMainWindow)
  SafeElectron.getIpcMain().on('install-check', handleInstallCheck)
  SafeElectron.getIpcMain().on('kb-service-check', handleKBServiceCheck)

  // Called when the user clicks the dock icon
  SafeElectron.getApp().on('activate', handleActivate)

  // Don't quit the app, instead try to close all windows
  // @ts-ignore not in the docs so maybe it doesn't exist anymore? scared to change it now
  SafeElectron.getApp().on('close-windows', handleCloseWindows)

  // quit through dock. only listen once
  SafeElectron.getApp().once('before-quit', handleQuitting)

  setupExecuteActionsListener()
}

start()
