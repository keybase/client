// Entry point for the node part of the electron app.
import '../renderer/preload.desktop'
import * as Electron from 'electron'
import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import {isDarwin} from '@/constants/platform.desktop'
import KB2 from '@/util/electron.desktop'
import {configOverload} from './dynamic-config'
import MainWindow from './main-window.desktop'
import devTools from './dev-tools.desktop'
import installer from './installer.desktop'
import menuBar from './menu-bar.desktop'
import {makeEngine} from '@/engine'
import {
  installCrashReporter,
  appShouldDieOnStartup,
  changeCommandLineSwitches,
  fixWindowsNotifications,
  getStartupProcessArgs,
  registerCrashHandling,
  registerLifecycleHandlers,
  registerNavigationGuards,
  registerOpenHandlers,
  registerPowerMonitorEvents,
  registerSecondInstanceHandler,
} from './app-events.desktop'
import {setupIPCHandlers} from './ipc-handlers.desktop'

type DeferredLaunch = {
  saltpackFilePath?: string
  startupURL?: string
}

type AppRuntime = {
  appStartedUp: boolean
  deferredLaunch: DeferredLaunch
  mainWindow: Electron.BrowserWindow | null
}

const dispatchStartupURL = (link: string) => {
  R.remoteDispatch(RemoteGen.createLink({link}))
}

const dispatchSaltpackFile = (path: string) => {
  R.remoteDispatch(RemoteGen.createSaltpackFileOpen({path}))
}

const flushDeferredLaunch = (
  runtime: AppRuntime,
  getStartupProcessArgs: () => void
) => {
  const {startupURL, saltpackFilePath} = runtime.deferredLaunch
  runtime.deferredLaunch = {}

  if (startupURL) {
    dispatchStartupURL(startupURL)
  } else if (saltpackFilePath) {
    dispatchSaltpackFile(saltpackFilePath)
  } else if (!isDarwin) {
    getStartupProcessArgs()
  }
}

const startApp = () => {
  const runtime: AppRuntime = {
    appStartedUp: false,
    deferredLaunch: {},
    mainWindow: null,
  }
  const getMainWindow = () => runtime.mainWindow

  registerCrashHandling()
  registerNavigationGuards()
  installCrashReporter()

  if (appShouldDieOnStartup()) {
    Electron.app.quit()
    return
  }

  console.log('Version:', Electron.app.getVersion())

  registerSecondInstanceHandler({getMainWindow})
  fixWindowsNotifications()
  changeCommandLineSwitches()
  devTools()
  registerPowerMonitorEvents()

  const nodeEngine = makeEngine(
    () => {},
    (connected: boolean) => {
      R.remoteDispatch(RemoteGen.createEngineConnection({connected}))
    }
  )

  setupIPCHandlers({
    getMainWindow,
    markAppStartedUp: () => {
      if (runtime.appStartedUp) {
        // Renderer reloaded (e.g. Command+R). Reset the transport so replies
        // from the old renderer session can't leak into the new one, then
        // re-notify the renderer so it can complete its handshake and
        // re-register UIs.
        console.log('Renderer reload detected; resetting node engine transport')
        nodeEngine.reset()
        nodeEngine.listenersAreReady()
        R.remoteDispatch(RemoteGen.createInstallerRan())
        return
      }

      runtime.appStartedUp = true
      nodeEngine.listenersAreReady()
      flushDeferredLaunch(runtime, getStartupProcessArgs)

      installer(err => {
        if (err) {
          console.log('Error: ', err)
        }
        R.remoteDispatch(RemoteGen.createInstallerRan())
      })
    },
    nodeEngine,
  })

  registerOpenHandlers({
    getAppStartedUp: () => runtime.appStartedUp,
    openSaltpackFile: dispatchSaltpackFile,
    openURL: dispatchStartupURL,
    queueSaltpackFilePath: (path: string) => {
      runtime.deferredLaunch.saltpackFilePath = path
    },
    queueStartupURL: (url: string) => {
      runtime.deferredLaunch.startupURL = url
    },
  })
  registerLifecycleHandlers({getMainWindow})

  Electron.app
    .whenReady()
    .then(() => {
      menuBar()
      runtime.mainWindow = MainWindow()
    })
    .catch((err: unknown) => {
      console.log('Electron app failed to initialize:', err)
      Electron.app.quit()
    })
}

KB2.constants.configOverload = configOverload
Electron.app.commandLine.appendSwitch('disk-cache-size', '1')
startApp()
