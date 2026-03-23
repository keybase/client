import MainWindow from './main-window.desktop'
import * as Electron from 'electron'
import * as R from '@/constants/remote'
import devTools from './dev-tools.desktop'
import installer from './installer.desktop'
import menuBar from './menu-bar.desktop'
import * as RemoteGen from '@/constants/remote-actions'
import {isDarwin, isLinux} from '@/constants/platform.desktop'
import {makeEngine} from '@/engine'
import {
  installCrashReporter,
  appShouldDieOnStartup,
  changeCommandLineSwitches,
  fixWindowsNotifications,
  handleCrashes,
  stopNav,
  focusSelfOnAnotherInstanceLaunching,
  getStartupProcessArgs,
  handleActivate,
  handleQuitting,
  willFinishLaunching,
} from './app-events.desktop'
import {setupIPCHandlers} from './ipc-handlers.desktop'

let mainWindow: Electron.BrowserWindow | null = null
let appStartedUp = false
let startupURL: string | undefined
let saltpackFilePath: string | undefined

Electron.app.commandLine.appendSwitch('disk-cache-size', '1')

const start = () => {
  handleCrashes()
  stopNav()
  installCrashReporter()

  if (appShouldDieOnStartup()) {
    Electron.app.quit()
    return
  }

  console.log('Version:', Electron.app.getVersion())

  // Foreground if another instance tries to launch, look for SEP7 link
  Electron.app.on('second-instance', (_, commandLine) =>
    focusSelfOnAnotherInstanceLaunching(() => mainWindow, commandLine)
  )

  fixWindowsNotifications()
  changeCommandLineSwitches()

  devTools()

  // this crashes on newer electron, unclear why
  if (!isLinux) {
    Electron.powerMonitor.on('suspend', () => {
      R.remoteDispatch(RemoteGen.createPowerMonitorEvent({event: 'suspend'}))
    })
    Electron.powerMonitor.on('resume', () => {
      R.remoteDispatch(RemoteGen.createPowerMonitorEvent({event: 'resume'}))
    })
    Electron.powerMonitor.on('shutdown', () => {
      R.remoteDispatch(RemoteGen.createPowerMonitorEvent({event: 'shutdown'}))
    })
    Electron.powerMonitor.on('lock-screen', () => {
      R.remoteDispatch(RemoteGen.createPowerMonitorEvent({event: 'lock-screen'}))
    })
    Electron.powerMonitor.on('unlock-screen', () => {
      R.remoteDispatch(RemoteGen.createPowerMonitorEvent({event: 'unlock-screen'}))
    })
  }

  const nodeEngine = makeEngine(
    () => {},
    (c: boolean) => {
      R.remoteDispatch(RemoteGen.createEngineConnection({connected: c}))
    }
  )

  setupIPCHandlers({
    getMainWindow: () => mainWindow,
    nodeEngine,
    onAppStartedUp: () => {
      appStartedUp = true
      nodeEngine.listenersAreReady()

      if (startupURL) {
        R.remoteDispatch(RemoteGen.createLink({link: startupURL}))
        startupURL = undefined
      } else if (saltpackFilePath) {
        R.remoteDispatch(RemoteGen.createSaltpackFileOpen({path: saltpackFilePath}))
        saltpackFilePath = undefined
      } else if (!isDarwin) {
        getStartupProcessArgs()
      }

      installer(err => {
        err && console.log('Error: ', err)
        R.remoteDispatch(RemoteGen.createInstallerRan())
      })
    },
  })

  menuBar()

  Electron.app.once('will-finish-launching', () => {
    willFinishLaunching({
      getAppStartedUp: () => appStartedUp,
      setSaltpackFilePath: (p: string) => {
        saltpackFilePath = p
      },
      setStartupURL: (url: string) => {
        startupURL = url
      },
    })
  })
  Electron.app.once('ready', () => {
    mainWindow = MainWindow()
  })

  // Called when the user clicks the dock icon
  Electron.app.on('activate', () => handleActivate(() => mainWindow))

  // quit through dock. only listen once
  Electron.app.once('before-quit', handleQuitting)
}

start()
