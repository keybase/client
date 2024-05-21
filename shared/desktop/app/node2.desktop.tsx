import KB2, {type OpenDialogOptions, type SaveDialogOptions} from '@/util/electron.desktop'
import MainWindow, {showDockIcon, closeWindows, getMainWindow} from './main-window.desktop'
import * as Electron from 'electron'
import * as R from '@/constants/remote'
import devTools from './dev-tools.desktop'
import installer from './installer.desktop'
import menuBar from './menu-bar.desktop'
import menuHelper from './menu-helper.desktop'
import os from 'os'
import fs from 'fs'
import path from 'path'
import fse from 'fs-extra'
import {spawn, execFile, exec} from 'child_process'
import * as RemoteGen from '@/actions/remote-gen'
import startWinService from './start-win-service.desktop'
import {
  isDarwin,
  isLinux,
  isWindows,
  cacheRoot,
  socketPath,
  fileUIName,
  dokanPath,
  windowsBinPath,
} from '@/constants/platform.desktop'
import {ctlQuit} from './ctl.desktop'
import logger from '@/logger'
import {assetRoot, htmlPrefix} from './html-root.desktop'
import * as RPCTypes from '@/constants/types/rpc-gen'
import type {Action} from '../app/ipctypes'
import {makeEngine} from '@/engine'
import {showDevTools, skipSecondaryDevtools, allowMultipleInstances} from '@/local-debug.desktop'
const {env} = KB2.constants

const isPathSaltpack = (path: string) =>
  path.endsWith('.signed.saltpack') || path.endsWith('.encrypted.saltpack')

let mainWindow: ReturnType<typeof MainWindow> | null = null
let appStartedUp = false
let startupURL: string | undefined
let saltpackFilePath: string | undefined

Electron.app.commandLine.appendSwitch('disk-cache-size', '1')

const installCrashReporter = () => {
  if (env.KEYBASE_CRASH_REPORT) {
    console.log(`Adding crash reporting (local). Crash files located in ${Electron.app.getPath('temp')}`)
    Electron.app.setPath('crashDumps', cacheRoot)
    Electron.crashReporter.start({
      companyName: 'Keybase',
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
    if (parseInt(os.release().split('.')[0] ?? '', 10) < 14) {
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
  mainWindow.focus()

  // The new instance might be due to a URL schema handler launch.
  logger.info('Launched with URL', commandLine)
  if (commandLine.length > 1 && commandLine[1]) {
    // Allow both argv1 and argv2 to be the link to support "/usr/lib/electron/electron path-to-app"-style
    // invocations (used in the Arch community packages).
    //
    // Windows looks like:
    // ["Keybase.exe", "--somearg", "--someotherarg", "actuallink"]
    for (const link of commandLine.slice(1)) {
      if (isRelevantDeepLink(link)) {
        R.remoteDispatch(RemoteGen.createLink({link}))
        return
      } else if (isValidSaltpackFilePath(link)) {
        R.remoteDispatch(RemoteGen.createSaltpackFileOpen({path: link}))
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

const isValidSaltpackFilePath = (p: string) => {
  const valid = isPathSaltpack(p)
  if (!valid) {
    logger.warn(
      'Received Electron open-file event with a file not ending in either ".encrypted.saltpack" or ".signed.saltpack".'
    )
    return false
  }
  return valid
}

const handleCrashes = () => {
  process.on('uncaughtException', e => {
    console.log('Uncaught exception on main thread:', e)
  })

  if (__DEV__) {
    return
  }

  Electron.app.on('browser-window-created', (_, win) => {
    win.on('unresponsive', (e: Electron.Event) => {
      console.log('Browser window unresponsive: ', e)
      win.reload()
    })

    win.webContents.on('render-process-gone', (_, details) => {
      if (details.reason === 'clean-exit') return
      console.log('browser window killed', details)
      win.reload()
    })
  })
}

const stopNav = () => {
  Electron.app.on('web-contents-created', (_, contents) => {
    contents.on('will-navigate', event => {
      event.preventDefault()
    })
    contents.setWindowOpenHandler(() => {
      return {action: 'deny'}
    })
  })
}

// On Windows and Linux startup, open-file and open-url arguments will be
// passed via process.argv instead of via Electron event arguments.
const getStartupProcessArgs = () => {
  let arg: string | undefined

  if (
    process.argv.length > 1 &&
    (isRelevantDeepLink(process.argv[1] ?? '') || isValidSaltpackFilePath(process.argv[1] ?? ''))
  ) {
    arg = process.argv[1]
  } else if (
    process.argv.length > 2 &&
    (isRelevantDeepLink(process.argv[2] ?? '') || isValidSaltpackFilePath(process.argv[2] ?? ''))
  ) {
    arg = process.argv[2]
  }

  // Bail if nothing was passed
  if (!arg) {
    logger.info(
      `Received open-file or open-url event on ${
        isWindows ? 'Windows' : 'Linux'
      } but did not get filePath or url from process.argv`
    )
    return
  }

  if (isRelevantDeepLink(arg)) {
    R.remoteDispatch(RemoteGen.createLink({link: arg}))
  } else if (isValidSaltpackFilePath(arg)) {
    R.remoteDispatch(RemoteGen.createSaltpackFileOpen({path: arg}))
  }
}

const handleActivate = () => {
  mainWindow?.show()
  const _dock = Electron.app.dock
  const dock = _dock as typeof _dock | undefined
  dock
    ?.show()
    .then(() => {})
    .catch(() => {})
}

const handleQuitting = (event: Electron.Event) => {
  console.log('Quit through before-quit')
  event.preventDefault()
  ctlQuit()
}

const willFinishLaunching = () => {
  Electron.app.on('open-file', (event, path) => {
    event.preventDefault()
    if (!appStartedUp) {
      saltpackFilePath = path
    } else {
      R.remoteDispatch(RemoteGen.createSaltpackFileOpen({path}))
    }
  })

  Electron.app.on('open-url', (event, link) => {
    event.preventDefault()
    if (!appStartedUp) {
      startupURL = link
    } else {
      R.remoteDispatch(RemoteGen.createLink({link}))
    }
  })
}

const remoteURL = (windowComponent: string, windowParam: string) =>
  `${htmlPrefix}${assetRoot}${windowComponent}${__FILE_SUFFIX__}.html?param=${windowParam}`

const findRemoteComponent = (windowComponent: string, windowParam: string) => {
  const url = remoteURL(windowComponent, windowParam)
  return Electron.BrowserWindow.getAllWindows().find(w => {
    const wc = w.webContents
    return wc.getURL() === url
  })
}

const winCheckRPCOwnership = async () => {
  const localAppData = String(env.LOCALAPPDATA)
  const binPath = localAppData ? path.resolve(localAppData, 'Keybase', 'keybase.exe') : 'keybase.exe'
  const args = ['pipeowner', socketPath]
  return new Promise<void>((resolve, reject) => {
    execFile(binPath, args, {windowsHide: true}, (error, stdout) => {
      if (error) {
        logger.info(`pipeowner check result: ${stdout.toString()}`)
        reject(error)
        return
      }
      const result = JSON.parse(stdout.toString()) as undefined | {isOwner?: unknown}
      if (result?.isOwner) {
        resolve(undefined)
        return
      }
      logger.info(`pipeowner check result: ${stdout.toString()}`)
      reject(new Error('pipeowner check failed'))
    })
  })
}

// Expose native file picker to components.
// Improved experience over HTML <input type='file' />
const showOpenDialog = async (opts: OpenDialogOptions) => {
  try {
    const {title, message, buttonLabel, defaultPath, filters} = opts
    const {allowDirectories, allowFiles, allowMultiselect} = opts
    // If on Windows or Linux and allowDirectories, prefer allowDirectories.
    // Can't have both openFile and openDirectory on Windows/Linux
    // Source: https://www.electronjs.org/docs/api/dialog#dialogshowopendialogbrowserwindow-options
    const windowsOrLinux = isWindows || isLinux
    const canAllowFiles = allowDirectories && windowsOrLinux ? false : allowFiles ?? true
    const allowedProperties = [
      ...(canAllowFiles ? ['openFile' as const] : []),
      ...(allowDirectories ? ['openDirectory' as const] : []),
      ...(allowMultiselect ? ['multiSelections' as const] : []),
    ]
    const allowedOptions = {
      buttonLabel,
      defaultPath,
      filters,
      message,
      properties: allowedProperties,
      title,
    }
    const mw = getMainWindow()
    if (!mw) return []
    const result = await Electron.dialog.showOpenDialog(mw, allowedOptions)
    if (result.canceled) return []
    return result.filePaths
  } catch {
    console.warn('Electron failed to launch showOpenDialog')
    return []
  }
}

const showSaveDialog = async (opts: SaveDialogOptions) => {
  try {
    const {title, message, buttonLabel, defaultPath} = opts
    const allowedProperties = ['showOverwriteConfirmation' as const]
    const allowedOptions = {
      buttonLabel,
      defaultPath,
      message,
      properties: allowedProperties,
      title,
    }
    const mw = getMainWindow()
    if (!mw) return []
    const result = await Electron.dialog.showSaveDialog(mw, allowedOptions)
    if (result.canceled) return []
    return result.filePath
  } catch {
    console.warn('Electron failed to launch showSaveDialog')
    return []
  }
}

const darwinCopyToKBFSTempUploadFile = async (options: {originalFilePath: string; dir: string}) => {
  if (!isDarwin) {
    throw new Error('unsupported platform')
  }
  const dst = path.join(options.dir, path.basename(options.originalFilePath))
  await fse.copy(options.originalFilePath, dst)
  return dst
}

const darwinCopyToChatTempUploadFile = async (options: {originalFilePath: string; dst: string}) => {
  await fse.copy(options.originalFilePath, options.dst)
  return true
}

const plumbEvents = () => {
  Electron.nativeTheme.on('updated', () => {
    R.remoteDispatch(RemoteGen.createSetSystemDarkMode({dark: Electron.nativeTheme.shouldUseDarkColors}))
  })

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

  Electron.ipcMain.handle('KBdispatchAction', (_: unknown, action: unknown) => {
    mainWindow?.webContents.send('KBdispatchAction', action)
  })

  const openInDefaultDirectory = async (openPath: string) => {
    // pathToURL takes path and converts to (file://) url.
    // See https://github.com/sindresorhus/file-url
    const pathToURL = (p: string) => {
      let goodPath = p.replace(/\\/g, '/')

      // Windows drive letter must be prefixed with a slash
      if (!goodPath.startsWith('/')) {
        goodPath = '/' + goodPath
      }

      return encodeURI('file://' + goodPath).replace(/#/g, '%23')
    }
    const prom = new Promise<void>((resolve, reject) => {
      // Paths in directories might be symlinks, so resolve using
      // realpath.
      // For example /keybase/private/gabrielh,chris gets redirected to
      // /keybase/private/chris,gabrielh.
      fs.realpath(openPath, (err, resolvedPath) => {
        if (err) {
          reject(new Error(`No realpath for ${openPath}`))
          return
        }
        // Convert to URL for openExternal call.
        // We use openExternal instead of openItem because it
        // correctly focuses' the Finder, and also uses a newer
        // native API on macOS.
        const url = pathToURL(resolvedPath)
        logger.info('Open URL (directory):', url)

        Electron.shell
          .openExternal(url, {activate: true})
          .then(() => {
            logger.info('Opened directory:', openPath)
            resolve()
          })
          .catch((err: unknown) => {
            reject(err)
          })
      })
    })
    try {
      await prom
      return true
    } catch {
      return false
    }
  }

  // we use this engine to proxy calls to the service from the renderer
  const nodeEngine = makeEngine(
    // no waiting on node side
    () => {},
    (c: boolean) => {
      R.remoteDispatch(RemoteGen.createEngineConnection({connected: c}))
    },
    false
  )

  const timeoutPromise = async (timeMs: number) =>
    new Promise<void>(resolve => {
      setTimeout(() => resolve(), timeMs)
    })

  Electron.ipcMain.handle('KBkeybase', async (event, action: Action) => {
    switch (action.type) {
      case 'engineSend': {
        const {buf} = action.payload
        nodeEngine._rpcClient.transport.send(buf)
        return
      }
      case 'uninstallDokan': {
        return new Promise<void>(resolve => {
          try {
            exec(action.payload.execPath, {windowsHide: true}, () => resolve())
          } catch (e) {
            logger.error('uninstallDokan caught', e)
            resolve(undefined)
          }
        })
      }
      case 'installCachedDokan': {
        return new Promise<void>((resolve, reject) => {
          logger.info('Invoking dokan installer')
          execFile(dokanPath, [], err => {
            if (err) {
              reject(err)
              return
            }
            // restart the service, particularly kbfsdokan
            // based on desktop/app/start-win-service.js
            const rqPath = windowsBinPath.replace('keybase.exe', 'keybaserq.exe')
            const args = [windowsBinPath, 'ctl', 'restart']
            spawn(rqPath, args, {detached: true, stdio: 'ignore'})
            resolve(undefined)
          })
        })
      }
      case 'clipboardAvailableFormats': {
        return Electron.clipboard.availableFormats()
      }
      case 'readImageFromClipboard': {
        const image = Electron.clipboard.readImage()
        if (image.isEmpty()) return undefined
        return image.toPNG()
      }
      case 'DEVwriteMenuIcons': {
        if (!__DEV__) return
        console.log('DEVwriteMenuIcons', action)
        try {
          const win = Electron.BrowserWindow.fromWebContents(event.sender)
          if (!win) return
          win.setBackgroundColor('#00000000')
          await Promise.all(
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 'many'].map(async (name, idx) => {
              const img = await win.capturePage({height: 22, width: 22, x: idx * 22, y: 0})
              return fs.writeFile(`/tmp/icon-menubar-${name}@2x.png`, img.toPNG(), 'binary', () => {})
            })
          )
        } catch (e) {
          console.log('DEVwriteMenuIcons err', e)
        }
        return
      }
      case 'copyToClipboard': {
        Electron.clipboard.writeText(action.payload.text)
        return
      }
      case 'isDirectory': {
        return new Promise(resolve => {
          fs.lstat(action.payload.path, (err, stats) => {
            if (err) {
              resolve(false)
            } else {
              resolve(stats.isDirectory())
            }
          })
        })
      }
      case 'windowsCheckMountFromOtherDokanInstall': {
        const {mountPoint, status} = action.payload
        return mountPoint
          ? new Promise(resolve => {
              fs.access(mountPoint, fs.constants.F_OK, err => resolve(!err))
            }).then(mountExists =>
              mountExists
                ? {
                    ...status,
                    installAction: RPCTypes.InstallAction.none,
                    installStatus: RPCTypes.InstallStatus.installed,
                    kextStarted: true,
                  }
                : status
            )
          : status
      }
      case 'ctlQuit': {
        ctlQuit()
        return
      }
      case 'selectFilesToUploadDialog': {
        const w = Electron.BrowserWindow.getFocusedWindow()
        if (!w) return []
        const {filePaths} = await Electron.dialog.showOpenDialog(w, {
          properties: [
            'multiSelections' as const,
            ...(['file', 'both'].includes(action.payload.type) ? (['openFile'] as const) : []),
            ...(['directory', 'both'].includes(action.payload.type) ? (['openDirectory'] as const) : []),
          ],
          title: 'Select a file or folder to upload',
        })
        return filePaths
      }
      case 'setOpenAtLogin': {
        const old = Electron.app.getLoginItemSettings().openAtLogin
        if (old !== action.payload.enabled) {
          Electron.app.setLoginItemSettings({openAtLogin: action.payload.enabled})
        }
        return
      }
      case 'exitApp': {
        return Electron.app.exit(action.payload.code)
      }
      case 'uninstallDokanDialog': {
        await Electron.dialog.showMessageBox({
          buttons: ['Got it'],
          detail:
            'We looked everywhere but did not find a Dokan uninstaller. Please remove it from the Control Panel.',
          message: 'Please uninstall Dokan from the Control Panel.',
          type: 'info',
        })
        return
      }
      case 'uninstallKBFSDialog': {
        const {response} = await Electron.dialog.showMessageBox({
          buttons: ['Remove & Restart', 'Cancel'],
          detail: `Are you sure you want to remove Keybase from ${fileUIName} and restart the app?`,
          message: `Remove Keybase from ${fileUIName}`,
          type: 'question',
        })
        return response === 0
      }
      case 'relaunchApp': {
        return Electron.app.relaunch()
      }
      case 'quitApp': {
        return Electron.app.quit()
      }
      case 'dumpNodeLogger': {
        return logger.dump()
      }
      case 'getPathType': {
        const {path} = action.payload
        return new Promise((resolve, reject) => {
          fs.stat(path, (err, stats) => {
            if (err) {
              reject(new Error(`Unable to open/stat file: ${path}`))
              return
            }
            if (stats.isFile()) {
              resolve('file')
            } else if (stats.isDirectory()) {
              resolve('directory')
            } else {
              reject(new Error(`Unable to open: Not a file or directory`))
            }
          })
        })
      }
      case 'openURL': {
        const {url, options} = action.payload
        try {
          await Electron.shell.openExternal(url, options)
          return true
        } catch {
          return false
        }
      }
      case 'openPathInFinder': {
        const {isFolder, path} = action.payload
        try {
          if (isFolder) {
            if (isWindows) {
              await Electron.shell.openPath(path)
              return true
            } else {
              await openInDefaultDirectory(path)
              return true
            }
          } else {
            Electron.shell.showItemInFolder(path)
            return true
          }
        } catch {
          return false
        }
      }
      case 'showContextMenu': {
        const {url} = action.payload
        const win = Electron.BrowserWindow.fromWebContents(event.sender)
        if (!win) return
        const menu = Electron.Menu.buildFromTemplate([
          {
            click: () => {
              Electron.clipboard.writeText(url)
            },
            label: 'Copy URL',
          },
          {
            click: () => {
              Electron.shell
                .openExternal(url)
                .then(() => {})
                .catch(() => {})
            },
            label: 'Open in browser',
          },
        ])
        menu.popup({window: win})
        return
      }
      case 'showInactive': {
        Electron.BrowserWindow.fromWebContents(event.sender)?.showInactive()
        return
      }
      case 'hideWindow': {
        Electron.BrowserWindow.fromWebContents(event.sender)?.hide()
        return
      }
      case 'closeWindow': {
        Electron.BrowserWindow.fromWebContents(event.sender)?.close()
        return
      }
      case 'minimizeWindow': {
        Electron.BrowserWindow.getFocusedWindow()?.minimize()
        return
      }
      case 'toggleMaximizeWindow': {
        const win = Electron.BrowserWindow.getFocusedWindow()
        if (win) {
          win.isMaximized() ? win.unmaximize() : win.maximize()
        }
        return
      }
      case 'darwinCopyToChatTempUploadFile': {
        try {
          return await darwinCopyToChatTempUploadFile(action.payload)
        } catch {
          return false
        }
      }
      case 'darwinCopyToKBFSTempUploadFile': {
        try {
          return await darwinCopyToKBFSTempUploadFile(action.payload)
        } catch {
          return ''
        }
      }
      case 'showOpenDialog': {
        try {
          return await showOpenDialog(action.payload.options)
        } catch {
          return []
        }
      }
      case 'showSaveDialog': {
        try {
          return await showSaveDialog(action.payload.options)
        } catch {
          return []
        }
      }
      case 'winCheckRPCOwnership': {
        try {
          await winCheckRPCOwnership()
          return true
        } catch {
          return false
        }
      }
      case 'setupPreloadKB2':
        return KB2.constants
      case 'showMainWindow':
        if (isDarwin && !allowMultipleInstances) {
          // launch the app explicitly so we can switch workspaces
          try {
            const parts = Electron.app.getPath('exe').split('/')
            const exe = parts.slice(0, -3).join('/')
            await Electron.shell.openPath(exe)
          } catch (e) {
            logger.error('launch fail', e)
          }
        } else {
          mainWindow?.show()
        }
        showDockIcon()
        break
      case 'activeChanged':
        // the installer reads this file to understand the gui state to not interrupt
        // TODO change how this works
        try {
          fs.writeFileSync(
            path.join(Electron.app.getPath('userData'), 'app-state.json'),
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
        // tell mainwindow we're connected
        nodeEngine.listenersAreReady()

        if (startupURL) {
          // Mac calls open-url for a launch URL before state is up, so we
          // stash a startupURL to be dispatched when we're ready for it.
          R.remoteDispatch(RemoteGen.createLink({link: startupURL}))
          startupURL = undefined
        } else if (saltpackFilePath) {
          R.remoteDispatch(RemoteGen.createSaltpackFileOpen({path: saltpackFilePath}))
          saltpackFilePath = undefined
        } else if (!isDarwin) {
          getStartupProcessArgs()
        }

        // run installer
        installer(err => {
          err && console.log('Error: ', err)
          R.remoteDispatch(RemoteGen.createInstallerRan())
        })
        break
      case 'requestWindowsStartService':
        if (isWindows) {
          console.log('requestWindowsStartService: starting keybase.exe')
          startWinService()
        }
        break
      case 'closeWindows': {
        closeWindows()
        break
      }
      case 'rendererNewProps': {
        // this can be racy so we try a few
        let count = 0
        while (count < 5) {
          const w = findRemoteComponent(action.payload.windowComponent, action.payload.windowParam)
          if (w) {
            w.webContents.send('KBprops', action.payload.propsStr)
            break
          } else {
            await timeoutPromise(500)
          }
          ++count
        }
        break
      }
      case 'closeRenderer': {
        const w = findRemoteComponent(action.payload.windowComponent ?? '', action.payload.windowParam ?? '')
        w?.close()
        break
      }
      case 'makeRenderer': {
        const opts = {
          frame: false,
          fullscreen: false,
          resizable: false,
          show: false, // Start hidden and show when we actually get props
          titleBarStyle: 'customButtonsOnHover' as const,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInWorker: false,
            preload: `${assetRoot}preload${__FILE_SUFFIX__}.bundle.js`,
          },
          ...action.payload.windowOpts,
        }

        const remoteWindow = new Electron.BrowserWindow(opts)

        remoteWindow.on('show', () => {
          R.remoteDispatch(RemoteGen.createUpdateWindowShown({component: action.payload.windowComponent}))
        })

        if (action.payload.windowPositionBottomRight) {
          const {width, height} = Electron.screen.getPrimaryDisplay().workAreaSize
          remoteWindow.setPosition(
            width - action.payload.windowOpts.width - 100,
            height - action.payload.windowOpts.height - 100,
            false
          )
        }

        remoteWindow
          .loadURL(remoteURL(action.payload.windowComponent, action.payload.windowParam ?? ''))
          .then(() => {})
          .catch(() => {})

        if (action.payload.windowComponent !== 'menubar') {
          menuHelper(remoteWindow)
        }

        if (showDevTools && !skipSecondaryDevtools) {
          remoteWindow.webContents.openDevTools({
            mode: 'detach',
            title: `${__DEV__ ? 'DEV' : 'Prod'} ${action.payload.windowComponent} Devtools`,
          })
        }

        showDockIcon()
        break
      }
    }
    return undefined
  })
}

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
  Electron.app.on('second-instance', (_, commandLine) => focusSelfOnAnotherInstanceLaunching(commandLine))

  fixWindowsNotifications()
  changeCommandLineSwitches()

  devTools()

  menuBar()
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
