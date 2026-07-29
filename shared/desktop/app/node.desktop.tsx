// Entry point for the node part of the electron app.
import '../renderer/preload.desktop'
import * as Electron from 'electron'
import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import {isDarwin} from '@/constants/platform'
import './dynamic-config'
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
import {localFileScheme} from '@/util/file-url'
import {pathToFileURL} from 'url'

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

const flushDeferredLaunch = (runtime: AppRuntime, getStartupProcessArgs: () => void) => {
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
      // See registerSchemesAsPrivileged below.
      if (__HOT__) {
        Electron.protocol.handle(localFileScheme, async req => {
          // Windows paths are carried with a leading slash (/C:/...) so the URL
          // stays absolute; pathToFileURL wants them without it.
          const path = decodeURIComponent(new URL(req.url).pathname).replace(/^\/([a-zA-Z]:)/, '$1')
          return Electron.net.fetch(pathToFileURL(path).toString())
        })
      }
      if (!process.env['KB_E2E_TEST']) {
        menuBar()
      }
      runtime.mainWindow = MainWindow()
    })
    .catch((err: unknown) => {
      console.log('Electron app failed to initialize:', err)
      Electron.app.quit()
    })
}

// In hot dev the renderer's document comes from the Vite dev server, and Chromium
// refuses to load file:// subresources into an http origin, so local previews
// (drag-and-drop attachments, video, avatar overrides) fail with "Not allowed to
// load local resource". A custom scheme isn't subject to that rule, so the
// renderer addresses local files through this one instead. Registering it has to
// happen before the app is ready. Packaged builds serve the document from file://
// and keep using plain file:// URLs.
if (__HOT__) {
  Electron.protocol.registerSchemesAsPrivileged([
    {
      privileges: {secure: true, standard: true, stream: true, supportFetchAPI: true},
      scheme: localFileScheme,
    },
  ])
}

Electron.app.commandLine.appendSwitch('disk-cache-size', '1')
// Disable OS keychain prompts — auth state lives in the Go service; we don't use safeStorage, cookie persistence, or any other keychain-backed Chromium feature
Electron.app.commandLine.appendSwitch('use-mock-keychain')
startApp()
