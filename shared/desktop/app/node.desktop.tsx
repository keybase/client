// Entry point for the node part of the electron app
import MainWindow from './main-window.desktop'
import {showDockIcon} from './dock-icon.desktop'
import * as Electron from 'electron'
import devTools from './dev-tools.desktop'
import installer from './installer.desktop'
import menuBar from './menu-bar.desktop'
import os from 'os'
import * as ConfigGen from '../../actions/config-gen'
import * as DeeplinksGen from '../../actions/deeplinks-gen'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {allowMultipleInstances} from '../../local-debug.desktop'
import startWinService from './start-win-service.desktop'
import {isDarwin, isLinux, isWindows, cacheRoot} from '../../constants/platform.desktop'
import {mainWindowDispatch} from '../remote/util.desktop'
import {quit} from './ctl.desktop'
import logger from '../../logger'

let mainWindow: (ReturnType<typeof MainWindow>) | null = null
let appStartedUp = false
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

const focusSelfOnAnotherInstanceLaunching = (commandLine: Array<string>) => {
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
    // Allow both argv1 and argv2 to be the link to support "/usr/lib/electron/electron path-to-app"-style
    // invocations (used in the Arch community packages).
    for (let link of commandLine.slice(1, 3)) {
      if (isRelevantDeepLink(link)) {
        mainWindowDispatch(DeeplinksGen.createLink({link}))
        return
      }
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

const isRelevantDeepLink = x => {
  return x.startsWith('web+stellar:') || x.startsWith('keybase://')
}

const handleCrashes = () => {
  process.on('uncaughtException', e => {
    console.log('Uncaught exception on main thread:', e)
  })

  if (__DEV__) {
    return
  }

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

const handleActivate = () => mainWindow && mainWindow.show()

const handleCloseWindows = () => {
  const windows = SafeElectron.BrowserWindow.getAllWindows()
  windows.forEach(w => {
    // We tell it to close, we can register handlers for the 'close' event if we want to
    // keep this window alive or hide it instead.
    w.close()
  })
}

const handleQuitting = (event: Electron.Event) => {
  console.log('Quit through before-quit')
  event.preventDefault()
  quit()
}

const willFinishLaunching = () => {
  SafeElectron.getApp().on('open-url', (event, link) => {
    event.preventDefault()
    if (!appStartedUp) {
      startupURL = link
    } else {
      mainWindowDispatch(DeeplinksGen.createLink({link}))
    }
  })
}

let menubarWindowID = 0

type IPCPayload = {type: 'appStartedUp'} | {type: 'requestStartService'} | {type: 'requestShowDockIcon'}

const plumbEvents = () => {
  Electron.app.on('KBkeybase' as any, (_: string, payload: IPCPayload) => {
    switch (payload.type) {
      case 'appStartedUp':
        appStartedUp = true
        if (menubarWindowID) {
          mainWindowDispatch(ConfigGen.createUpdateMenubarWindowID({id: menubarWindowID}))
        }
        if (startupURL) {
          // Mac calls open-url for a launch URL before redux is up, so we
          // stash a startupURL to be dispatched when we're ready for it.
          mainWindowDispatch(DeeplinksGen.createLink({link: startupURL}))
          startupURL = null
        } else if (!isDarwin) {
          // Windows and Linux instead store a launch URL in argv.
          let link: string | undefined
          if (process.argv.length > 1 && isRelevantDeepLink(process.argv[1])) {
            link = process.argv[1]
          } else if (process.argv.length > 2 && isRelevantDeepLink(process.argv[2])) {
            link = process.argv[2]
          }
          if (link) {
            mainWindowDispatch(DeeplinksGen.createLink({link}))
          }
        }

        // run installer
        installer(err => {
          err && console.log('Error: ', err)
          mainWindowDispatch(ConfigGen.createInstallerRan())
        })
        break
      case 'requestStartService':
        if (isWindows) {
          console.log('requestStartService: starting keybase.exe')
          startWinService()
        }
        break
      case 'requestShowDockIcon':
        showDockIcon()
        break
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
  SafeElectron.getApp().on('second-instance', (_, commandLine) =>
    focusSelfOnAnotherInstanceLaunching(commandLine)
  )

  fixWindowsNotifications()
  changeCommandLineSwitches()

  devTools()

  // Load menubar and get its browser window id so we can tell the main window
  menuBar(id => {
    menubarWindowID = id
  })

  plumbEvents()

  Electron.app.once('will-finish-launching', willFinishLaunching)
  Electron.app.once('ready', () => {
    mainWindow = MainWindow()
  })

  // Called when the user clicks the dock icon
  Electron.app.on('activate', handleActivate)

  // Don't quit the app, instead try to close all windows
  // @ts-ignore not in the docs so maybe it doesn't exist anymore? scared to change it now
  Electron.app.on('close-windows', handleCloseWindows)

  // quit through dock. only listen once
  Electron.app.once('before-quit', handleQuitting)
}

start()
