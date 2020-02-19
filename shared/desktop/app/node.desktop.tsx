// Entry point for the node part of the electron app
// MUST be first
import './preload.desktop'
// ^^^^^^^^
import MainWindow, {showDockIcon, hideDockIcon} from './main-window.desktop'
import * as Electron from 'electron'
import devTools from './dev-tools.desktop'
import installer from './installer.desktop'
import menuBar from './menu-bar.desktop'
import menuHelper from './menu-helper.desktop'
import os from 'os'
import fs from 'fs'
import * as ConfigGen from '../../actions/config-gen'
import * as DeeplinksGen from '../../actions/deeplinks-gen'
import {showDevTools, skipSecondaryDevtools, allowMultipleInstances} from '../../local-debug.desktop'
import startWinService from './start-win-service.desktop'
import {isDarwin, isLinux, isWindows, cacheRoot} from '../../constants/platform.desktop'
import {mainWindowDispatch} from '../remote/util.desktop'
import {quit} from './ctl.desktop'
import logger from '../../logger'
import {resolveRoot, resolveRootAsURL} from './resolve-root.desktop'

const {join} = KB.path
const {env} = KB.process

let mainWindow: ReturnType<typeof MainWindow> | null = null
let appStartedUp = false
let startupURL: string | null = null

const installCrashReporter = () => {
  if (env.KEYBASE_CRASH_REPORT) {
    console.log(`Adding crash reporting (local). Crash files located in ${Electron.app.getPath('temp')}`)
    Electron.crashReporter.start({
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
  return Electron.app.requestSingleInstanceLock()
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
      Electron.dialog.showErrorBox('Keybase Error', "This version of macOS isn't currently supported.")
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
    mainWindow && mainWindow.focus()
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
  Electron.app.commandLine.appendSwitch('ignore-connections-limit', 'localhost')

  if (__DEV__) {
    // too noisy any higher than 0 now
    // SafeElectron.getApp().commandLine.appendSwitch('enable-logging')
    // SafeElectron.getApp().commandLine.appendSwitch('v', 0)
  }
}

const fixWindowsNotifications = () => {
  // Windows needs this for notifications to show on certain versions
  // https://msdn.microsoft.com/en-us/library/windows/desktop/dd378459(v=vs.85).aspx
  Electron.app.setAppUserModelId('Keybase.Keybase.GUI')
}

const isRelevantDeepLink = (x: string) => {
  return x.startsWith('web+stellar:') || x.startsWith('keybase://')
}

const handleCrashes = () => {
  process.on('uncaughtException', e => {
    console.log('Uncaught exception on main thread:', e)
  })

  if (__DEV__) {
    return
  }

  Electron.app.on('browser-window-created', (_, win) => {
    if (!win) {
      return
    }

    win.on('unresponsive', (e: Electron.Event) => {
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

const handleActivate = () => {
  mainWindow && mainWindow.show()
  const dock = Electron.app.dock
  dock.show()
}

const handleQuitting = (event: Electron.Event) => {
  console.log('Quit through before-quit')
  event.preventDefault()
  quit()
}

const willFinishLaunching = () => {
  Electron.app.on('open-url', (event, link) => {
    event.preventDefault()
    if (!appStartedUp) {
      startupURL = link
    } else {
      mainWindowDispatch(DeeplinksGen.createLink({link}))
    }
  })
}

let menubarWindowID = 0

type Action =
  | {type: 'appStartedUp'}
  | {
      type: 'activeChanged'
      payload: {
        changedAtMs: number
        isUserActive: boolean
      }
    }
  | {type: 'requestWindowsStartService'}
  | {type: 'closeWindows'}
  | {
      type: 'makeRenderer'
      payload: {
        windowComponent: string
        windowParam: string
        windowOpts: {
          width: number
          height: number
        }
        windowPositionBottomRight: boolean
      }
    }
  | {
      type: 'closeRenderer'
      payload: {
        windowComponent: string
        windowParam: string
      }
    }
  | {
      type: 'rendererNewProps'
      payload: {
        propsStr: string
        windowComponent: string
        windowParam: string
      }
    }
  | {type: 'showMainWindow'}

const remoteURL = (windowComponent: string, windowParam: string) =>
  resolveRootAsURL('dist', `${windowComponent}${__DEV__ ? '.dev' : ''}.html?param=${windowParam}`)

const findRemoteComponent = (windowComponent: string, windowParam: string) => {
  const url = remoteURL(windowComponent, windowParam)
  return Electron.BrowserWindow.getAllWindows().find(w => {
    const wc = w.webContents
    return wc && wc.getURL() === url
  })
}

const plumbEvents = () => {
  Electron.ipcMain.handle('KBdispatchAction', (_: any, action: any) => {
    mainWindow?.webContents.send('KBdispatchAction', action)
  })

  Electron.ipcMain.handle('KBkeybase', async (_event, action: Action) => {
    switch (action.type) {
      case 'showMainWindow':
        {
          mainWindow?.show()
          showDockIcon()
        }
        break
      case 'activeChanged':
        // the installer reads this file to understand the gui state to not interrupt
        // TODO change how this works
        try {
          fs.writeFileSync(
            join(Electron.app.getPath('userData'), 'app-state.json'),
            JSON.stringify({
              changedAtMs: action.payload.changedAtMs,
              isUserActive: action.payload.isUserActive,
            }),
            {encoding: 'utf8'}
          )
        } catch (e) {
          console.warn('update app state failed' + e)
        }
        break
      case 'appStartedUp':
        appStartedUp = true
        if (menubarWindowID) {
          mainWindowDispatch(ConfigGen.createUpdateMenubarWindowID({id: menubarWindowID}))
          // reset it
          menubarWindowID = 0
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
        installer(mainWindowDispatch, err => {
          err && console.log('Error: ', err)
          mainWindowDispatch(ConfigGen.createInstallerRan())
        })
        break
      case 'requestWindowsStartService':
        if (isWindows) {
          console.log('requestWindowsStartService: starting keybase.exe')
          startWinService()
        }
        break
      case 'closeWindows': {
        const windows = Electron.BrowserWindow.getAllWindows()
        windows.forEach(w => {
          // We tell it to close, we can register handlers for the 'close' event if we want to
          // keep this window alive or hide it instead.
          w.close()
        })
        hideDockIcon()
        break
      }
      case 'rendererNewProps': {
        const w = findRemoteComponent(action.payload.windowComponent, action.payload.windowParam)
        w && w.emit('KBprops', action.payload.propsStr)
        break
      }
      case 'closeRenderer': {
        const w = findRemoteComponent(action.payload.windowComponent, action.payload.windowParam)
        w && w.close()
        break
      }
      case 'makeRenderer': {
        const opts = {
          frame: false,
          fullscreen: false,
          height: 300,
          resizable: false,
          show: false, // Start hidden and show when we actually get props
          titleBarStyle: 'customButtonsOnHover' as const,
          webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: false,
            preload: resolveRoot('dist', `preload-main${__DEV__ ? '.dev' : ''}.bundle.js`),
            spellcheck: true,
          },
          width: 500,
          ...action.payload.windowOpts,
        }

        const remoteWindow = new Electron.BrowserWindow(opts)

        if (action.payload.windowPositionBottomRight && Electron.screen.getPrimaryDisplay()) {
          const {width, height} = Electron.screen.getPrimaryDisplay().workAreaSize
          remoteWindow.setPosition(
            width - action.payload.windowOpts.width - 100,
            height - action.payload.windowOpts.height - 100,
            false
          )
        }

        remoteWindow.loadURL(remoteURL(action.payload.windowComponent, action.payload.windowParam))

        if (action.payload.windowComponent !== 'menubar') {
          menuHelper(remoteWindow)
        }

        if (showDevTools && remoteWindow.webContents && !skipSecondaryDevtools) {
          remoteWindow.webContents.openDevTools({mode: 'detach'})
        }

        showDockIcon()
        break
      }
    }
  })
}

const start = () => {
  handleCrashes()
  installCrashReporter()

  if (appShouldDieOnStartup()) {
    Electron.app.quit()
    return
  }

  console.log('Version:', Electron.app.getVersion())

  // Foreground if another instance tries to launch, look for SEP7 link
  Electron.app.on('second-instance', (_, commandLine) => focusSelfOnAnotherInstanceLaunching(commandLine))

  fixWindowsNotifications()
  changeCommandLineSwitches()

  devTools()

  // Load menubar and get its browser window id so we can tell the main window
  menuBar(id => {
    // its possible the app started up way before we get this id in rare cases
    if (appStartedUp && id) {
      mainWindowDispatch(ConfigGen.createUpdateMenubarWindowID({id}))
    } else {
      // else stash it for later
      menubarWindowID = id
    }
  })

  plumbEvents()

  Electron.app.once('will-finish-launching', willFinishLaunching)
  Electron.app.once('ready', () => {
    mainWindow = MainWindow()
  })

  // Called when the user clicks the dock icon
  Electron.app.on('activate', handleActivate)

  // quit through dock. only listen once
  Electron.app.once('before-quit', handleQuitting)
}

start()
