// Entry point for the node part of the electron app.
import '../renderer/preload.desktop'
import * as Electron from 'electron'
import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import {isDarwin} from '@/constants/platform'
import './dynamic-config'
import MainWindow, {registerThemeBackgrounds} from './main-window.desktop'
import {getMainWindow} from './main-window-ref.desktop'
import devTools from './dev-tools.desktop'
import installer from './installer.desktop'
import menuBar from './menu-bar.desktop'
import {EngineRelay} from './engine-relay.desktop'
import logger from '@/logger'
import KB2 from '@/util/electron'
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
import {
  appScheme,
  localFilePathFromURL,
  mimeTypeForPath,
  requestedRange,
  resolveAppFilePath,
} from './app-protocol.desktop'
import fs from 'fs'
import {Readable} from 'stream'
import {localFileHost} from './local-file-host.desktop'
import {appRoot} from './html-root.desktop'
import {pathToFileURL} from 'url'

type DeferredLaunch = {
  saltpackFilePath?: string
  startupURL?: string
}

type AppRuntime = {
  appStartedUp: boolean
  deferredLaunch: DeferredLaunch
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
  }

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

  const engineRelay = new EngineRelay(data => KB2.functions.mainWindowDispatchEngineIncoming?.(data))

  setupIPCHandlers({
    markAppStartedUp: () => {
      if (runtime.appStartedUp) {
        // Renderer reloaded (e.g. Command+R). The new renderer gets a fresh link, so it can complete
        // its handshake and re-register UIs.
        console.log('Renderer reload detected; restarting the engine link')
        engineRelay.restartLink()
        R.remoteDispatch(RemoteGen.createInstallerRan())
        return
      }

      runtime.appStartedUp = true
      engineRelay.replayLinkState()
      flushDeferredLaunch(runtime, getStartupProcessArgs)

      logger.warn('[Installer]: markAppStartedUp invoking installer', {
        keybaseOpenFrom: process.env['KEYBASE_OPEN_FROM'] || '',
        keybaseRestoreUI: process.env['KEYBASE_RESTORE_UI'] || '',
        keybaseStartUI: process.env['KEYBASE_START_UI'] || '',
      })
      installer(err => {
        logger.warn('[Installer]: installer callback', {err: err?.message ?? null})
        R.remoteDispatch(RemoteGen.createInstallerRan())
      })
    },
    engineRelay,
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
      registerPowerMonitorEvents()
      registerThemeBackgrounds()
      registerAppProtocols()
      if (!process.env['KB_E2E_TEST']) {
        menuBar()
      }
      MainWindow()
    })
    .catch((err: unknown) => {
      console.log('Electron app failed to initialize:', err)
      Electron.app.quit()
    })
}

const fileResponse = async (filePath: string | undefined) => {
  if (!filePath) return new Response(undefined, {status: 404})
  try {
    return await Electron.net.fetch(pathToFileURL(filePath).toString())
  } catch {
    return new Response(undefined, {status: 404})
  }
}

// Headers and body come from one open handle, so they describe the same file. Ranges are
// answered with a 206 so media elements can seek.
const localFileResponse = async (filePath: string, req: Request) => {
  let handle: fs.promises.FileHandle | undefined
  try {
    handle = await fs.promises.open(filePath, 'r')
    const stat = await handle.stat()
    if (!stat.isFile()) {
      await handle.close()
      return new Response(undefined, {status: 404})
    }
    const lastModified = stat.mtime.toUTCString()
    const headers = new Headers({'Accept-Ranges': 'bytes', 'Last-Modified': lastModified})
    const range = requestedRange(req.headers.get('range'), req.headers.get('if-range'), lastModified, stat.size)
    if (range === 'unsatisfiable') {
      await handle.close()
      headers.set('Content-Range', `bytes */${stat.size}`)
      return new Response(undefined, {headers, status: 416})
    }
    const type = mimeTypeForPath(filePath)
    if (type) headers.set('Content-Type', type)
    const stream = fs.createReadStream('', {
      autoClose: true,
      fd: handle,
      ...(range ? {end: range.end, start: range.start} : {}),
    })
    const body = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>
    if (!range) {
      headers.set('Content-Length', String(stat.size))
      return new Response(body, {headers, status: 200})
    }
    headers.set('Content-Length', String(range.end - range.start + 1))
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`)
    return new Response(body, {headers, status: 206})
  } catch {
    await handle?.close().catch(() => {})
    return new Response(undefined, {status: 404})
  }
}

// The app scheme serves the app's own files (see html-root.desktop.tsx). Pages
// on it can't load file:// subresources, so local files (drag-and-drop
// attachments, video, avatar overrides) are addressed through the local file
// scheme instead; util/file-url.tsx builds those URLs.
const registerAppProtocols = () => {
  Electron.protocol.handle(appScheme, async req => fileResponse(resolveAppFilePath(appRoot, req.url)))
  Electron.protocol.handle(localFileScheme, async req => {
    const filePath = localFilePathFromURL(req.url, localFileHost, process.platform)
    if (!filePath) return new Response(undefined, {status: 403})
    return localFileResponse(filePath, req)
  })
}

// Schemes have to be registered before the app is ready.
Electron.protocol.registerSchemesAsPrivileged([
  {
    privileges: {codeCache: true, corsEnabled: true, secure: true, standard: true, supportFetchAPI: true},
    scheme: appScheme,
  },
  {
    privileges: {secure: true, standard: true, stream: true, supportFetchAPI: true},
    scheme: localFileScheme,
  },
])

Electron.app.commandLine.appendSwitch('disk-cache-size', '1')
// Disable OS keychain prompts — auth state lives in the Go service; we don't use safeStorage, cookie persistence, or any other keychain-backed Chromium feature
Electron.app.commandLine.appendSwitch('use-mock-keychain')
startApp()
