import KB2, {type OpenDialogOptions, type SaveDialogOptions} from '@/util/electron'
import {showDockIcon, closeWindows, isScreenshotDisabled} from './main-window.desktop'
import {getMainWindow} from './main-window-ref.desktop'
import * as Electron from 'electron'
import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import menuHelper from './menu-helper.desktop'
import fs from 'fs'
import path from 'path'
import {promisify} from 'util'
import {spawn, execFile} from 'child_process'
import startWinService from './start-win-service.desktop'
import {
  cacheRoot,
  isDarwin,
  isLinux,
  isWindows,
  socketPath,
  fileUIName,
  dokanPath,
  windowsBinPath,
} from '@/constants/platform'
import {ctlQuit} from './ctl.desktop'
import logger from '@/logger'
import {htmlURL, preloadPath} from './html-root.desktop'
import {
  cacheRemoteProps,
  getCachedRemoteProps,
  getRemoteWindow,
  registerRemoteWindow,
} from './remote-windows.desktop'
import * as RPCTypes from '@/constants/rpc/rpc-gen'
import {ensureError} from '@/util/errors'
import type {Action} from '../app/ipctypes'
import type {EngineRelay} from './engine-relay.desktop'
import {showDevTools, skipSecondaryDevtools, allowMultipleInstances} from '@/local-debug'
import {
  isBrowserURL,
  isExternalURLAllowed,
  isUploadTempPath,
  parseDokanUninstallCommand,
} from './bridge-rules.desktop'
import {isSenderAllowed} from './ipc-sender.desktop'

const execFileAsync = promisify(execFile)

const remoteURL = (windowComponent: string, windowParam: string) =>
  htmlURL('remote', `component=${windowComponent}&param=${windowParam}`)

const winCheckRPCOwnership = async () => {
  const {env} = KB2.constants
  const localAppData = String(env.LOCALAPPDATA)
  const binPath = localAppData ? path.resolve(localAppData, 'Keybase', 'keybase.exe') : 'keybase.exe'
  const args = ['pipeowner', socketPath]
  const {stdout} = await execFileAsync(binPath, args, {windowsHide: true}).catch((error: unknown) => {
    logger.info(`pipeowner check result: ${(error as {stdout?: string}).stdout ?? ''}`)
    throw ensureError(error)
  })
  const result = JSON.parse(stdout) as undefined | {isOwner?: unknown}
  if (!result?.isOwner) {
    logger.info(`pipeowner check result: ${stdout}`)
    throw new Error('pipeowner check failed')
  }
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
    const canAllowFiles = allowDirectories && windowsOrLinux ? false : (allowFiles ?? true)
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
  if (!isUploadTempPath(dst, cacheRoot, 'kbfs')) {
    logger.warn('darwinCopyToKBFSTempUploadFile: the destination is not a KBFS upload temp dir')
    throw new Error('not an upload temp dir')
  }
  await fs.promises.cp(options.originalFilePath, dst, {recursive: true})
  return dst
}

const darwinCopyToChatTempUploadFile = async (options: {originalFilePath: string; dst: string}) => {
  if (!isUploadTempPath(options.dst, cacheRoot, 'chat')) {
    logger.warn('darwinCopyToChatTempUploadFile: the destination is not a chat upload temp file')
    throw new Error('not an upload temp file')
  }
  await fs.promises.cp(options.originalFilePath, options.dst, {recursive: true})
  return true
}

// Opens a folder in the file manager, or reveals anything else in its folder; never opens a file
const openPathInFileManager = async (openPath: string, isFolder: boolean) => {
  try {
    if (isFolder && (await fs.promises.stat(openPath)).isDirectory()) {
      // Paths in directories might be symlinks, so resolve using realpath. For example
      // /keybase/private/gabrielh,chris gets redirected to /keybase/private/chris,gabrielh.
      const resolvedPath = isWindows ? openPath : await fs.promises.realpath(openPath)
      const err = await Electron.shell.openPath(resolvedPath)
      if (err) {
        logger.warn('openPathInFinder: opening the folder failed', err)
        return false
      }
      return true
    }
    Electron.shell.showItemInFolder(openPath)
    return true
  } catch {
    return false
  }
}

// Runs the Dokan uninstaller named by the registry, without a shell, if it is where Dokan keeps it
const uninstallDokan = async (command: string) => {
  const parsed = parseDokanUninstallCommand(command, process.env['ProgramData'])
  const isFile = parsed
    ? await fs.promises.stat(parsed.file).then(
        s => s.isFile(),
        () => false
      )
    : false
  if (!parsed || !isFile) {
    logger.warn('uninstallDokan: the uninstall command is not the Dokan uninstaller; not running it')
    await showUninstallDokanFromControlPanel()
    return
  }
  await new Promise<void>(resolve => {
    try {
      execFile(parsed.file, parsed.args, {windowsHide: true}, () => resolve())
    } catch (e) {
      logger.error('uninstallDokan caught', e)
      resolve()
    }
  })
}

const showUninstallDokanFromControlPanel = async () => {
  await Electron.dialog.showMessageBox({
    buttons: ['Got it'],
    detail:
      'We looked everywhere but did not find a Dokan uninstaller. Please remove it from the Control Panel.',
    message: 'Please uninstall Dokan from the Control Panel.',
    type: 'info',
  })
}

// Sync so the last state lands before quit; written aside and renamed over so the updater never reads partial JSON
const writeAppState = (contents: string) => {
  try {
    const target = path.join(Electron.app.getPath('userData'), 'app-state.json')
    const tmp = `${target}.tmp`
    fs.writeFileSync(tmp, contents, {encoding: 'utf8'})
    fs.renameSync(tmp, target)
  } catch (e) {
    console.warn('update app state failed' + String(e))
  }
}

export const setupIPCHandlers = (deps: {
  markAppStartedUp: () => void
  engineRelay: EngineRelay
}) => {
  Electron.ipcMain.handle('KBdispatchAction', (event, action: unknown) => {
    if (!isSenderAllowed(event, 'KBdispatchAction')) return
    getMainWindow()?.webContents.send('KBdispatchAction', action)
  })

  Electron.ipcMain.on('KBsetupPreloadKB2', event => {
    if (!isSenderAllowed(event, 'KBsetupPreloadKB2')) {
      event.returnValue = undefined
      return
    }
    // read at window load so it reflects the saved preference (applied as themeSource) or the OS
    event.returnValue = {...KB2.constants, startDarkMode: Electron.nativeTheme.shouldUseDarkColors}
  })

  Electron.ipcMain.on('engineSend', (event, send: unknown) => {
    if (!isSenderAllowed(event, 'engineSend')) return
    deps.engineRelay.send(send)
  })

  Electron.ipcMain.on('engineRestartLink', event => {
    if (!isSenderAllowed(event, 'engineRestartLink')) return
    deps.engineRelay.restartLink({afterDelay: true})
  })

  Electron.ipcMain.on('engineDropLink', event => {
    if (!isSenderAllowed(event, 'engineDropLink')) return
    deps.engineRelay.dropLink()
  })

  Electron.ipcMain.handle('KBkeybase', async (event, action: Action) => {
    const type: unknown = (action as {type?: unknown} | undefined)?.type
    if (typeof type !== 'string' || !isSenderAllowed(event, type)) return undefined
    switch (action.type) {
      case 'uninstallDokan': {
        await uninstallDokan(action.payload.execPath)
        return
      }
      case 'installCachedDokan': {
        logger.info('Invoking dokan installer')
        await execFileAsync(dokanPath, [])
        // restart the service, particularly kbfsdokan
        // based on desktop/app/start-win-service.js
        const rqPath = windowsBinPath.replace('keybase.exe', 'keybaserq.exe')
        const args = [windowsBinPath, 'ctl', 'restart']
        spawn(rqPath, args, {detached: true, stdio: 'ignore'})
        return
      }
      case 'readImageFromClipboard': {
        const items = await Electron.clipboard.read()
        // nativeImage only decodes png/jpeg, which is also all chromium normalizes clipboard
        // images to, so those are the only two worth asking for
        const item =
          items.find(i => i.types.includes('image/png')) ?? items.find(i => i.types.includes('image/jpeg'))
        if (!item) return undefined
        const type = item.types.includes('image/png') ? 'image/png' : 'image/jpeg'
        // getType rejects if the clipboard changed out from under us since read()
        const blob = await item.getType(type).catch(() => undefined)
        if (!(blob instanceof Blob)) return undefined
        const image = Electron.nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()))
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
              return fs.promises.writeFile(`/tmp/icon-menubar-${name}@2x.png`, img.toPNG())
            })
          )
        } catch (e) {
          console.log('DEVwriteMenuIcons err', e)
        }
        return
      }
      case 'copyToClipboard': {
        return Electron.clipboard.writeText(action.payload.text)
      }
      case 'isDirectory': {
        try {
          return (await fs.promises.lstat(action.payload.path)).isDirectory()
        } catch {
          return false
        }
      }
      case 'windowsCheckMountFromOtherDokanInstall': {
        const {mountPoint, status} = action.payload
        if (!mountPoint) return status
        const mountExists = await fs.promises.access(mountPoint, fs.constants.F_OK).then(
          () => true,
          () => false
        )
        return mountExists
          ? {
              ...status,
              installAction: RPCTypes.InstallAction.none,
              installStatus: RPCTypes.InstallStatus.installed,
              kextStarted: true,
            }
          : status
      }
      case 'ctlQuit': {
        ctlQuit()
        return
      }
      case 'setNativeTheme': {
        const {theme} = action.payload
        switch (theme) {
          case 'system':
          case 'light':
          case 'dark':
            Electron.nativeTheme.themeSource = theme
            break
        }
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
        await showUninstallDokanFromControlPanel()
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
        let stats: fs.Stats
        try {
          stats = await fs.promises.stat(path)
        } catch {
          throw new Error(`Unable to open/stat file: ${path}`)
        }
        if (stats.isFile()) return 'file'
        if (stats.isDirectory()) return 'directory'
        throw new Error(`Unable to open: Not a file or directory`)
      }
      case 'openURL': {
        const {url, options} = action.payload
        if (!isExternalURLAllowed(url, process.platform)) {
          logger.warn('openURL: only http(s), mailto and system settings links are opened')
          return false
        }
        try {
          const activate = options?.activate
          await Electron.shell.openExternal(url, activate === undefined ? undefined : {activate: !!activate})
          return true
        } catch {
          return false
        }
      }
      case 'openPathInFinder': {
        const {isFolder, path} = action.payload
        return await openPathInFileManager(path, isFolder)
      }
      case 'showContextMenu': {
        const {url} = action.payload
        const win = Electron.BrowserWindow.fromWebContents(event.sender)
        if (!win) return
        const menu = Electron.Menu.buildFromTemplate([
          {
            click: () => {
              void Electron.clipboard.writeText(url)
            },
            label: 'Copy URL',
          },
          ...(isBrowserURL(url)
            ? [
                {
                  click: () => {
                    Electron.shell
                      .openExternal(url)
                      .then(() => {})
                      .catch(() => {})
                  },
                  label: 'Open in browser',
                },
              ]
            : []),
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
          if (win.isMaximized()) {
            win.unmaximize()
          } else {
            win.maximize()
          }
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
          getMainWindow()?.show()
        }
        showDockIcon()
        break
      case 'activeChanged':
        // the updater reads this file so it doesn't interrupt an active user
        writeAppState(
          JSON.stringify({
            changedAtMs: action.payload.changedAtMs,
            isUserActive: action.payload.isUserActive,
          })
        )
        break
      case 'appStartedUp':
        deps.markAppStartedUp()
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
        const {windowComponent, windowParam, propsStr} = action.payload
        // cache so a window that hasn't finished loading can pull these when it's ready
        cacheRemoteProps(windowComponent, windowParam, propsStr)
        getRemoteWindow(windowComponent, windowParam)?.webContents.send('KBprops', propsStr)
        break
      }
      case 'getRemoteProps': {
        const {windowComponent, windowParam} = action.payload
        return getCachedRemoteProps(windowComponent, windowParam) ?? ''
      }
      case 'closeRenderer': {
        const w = getRemoteWindow(action.payload.windowComponent ?? '', action.payload.windowParam ?? '')
        w?.close()
        break
      }
      case 'makeRenderer': {
        // only take the size/appearance keys from the renderer, never webPreferences
        const {hasShadow, height, transparent, width} = action.payload.windowOpts
        const opts: Electron.BrowserWindowConstructorOptions = {
          frame: false,
          fullscreen: false,
          height,
          resizable: false,
          show: false, // Start hidden and show when we actually get props
          titleBarStyle: 'customButtonsOnHover',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInWorker: false,
            preload: preloadPath,
            sandbox: true,
          },
          width,
          ...(hasShadow === undefined ? {} : {hasShadow}),
          ...(transparent === undefined ? {} : {transparent}),
        }

        const remoteWindow = new Electron.BrowserWindow(opts)
        remoteWindow.setContentProtection(isScreenshotDisabled())
        registerRemoteWindow(action.payload.windowComponent, action.payload.windowParam ?? '', remoteWindow)

        remoteWindow.on('show', () => {
          R.remoteDispatch(RemoteGen.createUpdateWindowShown({component: action.payload.windowComponent}))
        })

        if (action.payload.windowPositionBottomRight) {
          const {width: screenWidth, height: screenHeight} = Electron.screen.getPrimaryDisplay().workAreaSize
          remoteWindow.setPosition(
            screenWidth - width - 100,
            screenHeight - height - 100,
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
