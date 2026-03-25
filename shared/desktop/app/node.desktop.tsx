// Entry point for the node part of the electron app.
import '../renderer/preload.desktop'
import * as Electron from 'electron'
import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import {isDarwin} from '@/constants/platform.desktop'
import KB2 from '@/util/electron.desktop'
import {configOverload} from './dynamic-config'

type DeferredLaunch = {
  saltpackFilePath?: string
  startupURL?: string
}

type AppRuntime = {
  appStartedUp: boolean
  deferredLaunch: DeferredLaunch
  mainWindow: Electron.BrowserWindow | null
}

const loadStartupModules = () => {
  const {default: MainWindow} = require('./main-window.desktop') as typeof import('./main-window.desktop')
  const {default: devTools} = require('./dev-tools.desktop') as typeof import('./dev-tools.desktop')
  const {default: installer} = require('./installer.desktop') as typeof import('./installer.desktop')
  const {default: menuBar} = require('./menu-bar.desktop') as typeof import('./menu-bar.desktop')
  const {makeEngine} = require('@/engine') as typeof import('@/engine')
  const {
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
  } = require('./app-events.desktop') as typeof import('./app-events.desktop')
  const {setupIPCHandlers} = require('./ipc-handlers.desktop') as typeof import('./ipc-handlers.desktop')

  return {
    MainWindow,
    appShouldDieOnStartup,
    changeCommandLineSwitches,
    devTools,
    fixWindowsNotifications,
    getStartupProcessArgs,
    installCrashReporter,
    installer,
    makeEngine,
    menuBar,
    registerCrashHandling,
    registerLifecycleHandlers,
    registerNavigationGuards,
    registerOpenHandlers,
    registerPowerMonitorEvents,
    registerSecondInstanceHandler,
    setupIPCHandlers,
  }
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
  const {
    MainWindow,
    appShouldDieOnStartup,
    changeCommandLineSwitches,
    devTools,
    fixWindowsNotifications,
    getStartupProcessArgs,
    installCrashReporter,
    installer,
    makeEngine,
    menuBar,
    registerCrashHandling,
    registerLifecycleHandlers,
    registerNavigationGuards,
    registerOpenHandlers,
    registerPowerMonitorEvents,
    registerSecondInstanceHandler,
    setupIPCHandlers,
  } = loadStartupModules()

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
        return
      }

      runtime.appStartedUp = true
      nodeEngine.listenersAreReady()
      flushDeferredLaunch(runtime, getStartupProcessArgs)

      installer(err => {
        err && console.log('Error: ', err)
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
