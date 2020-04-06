import path from 'path'
import os from 'os'
import * as Electron from 'electron'
// @ts-ignore strict
import fse from 'fs-extra'

const isRenderer = typeof process !== 'undefined' && process.type === 'renderer'
const target = isRenderer ? window : global
const {argv, platform, env, type} = process
const isDarwin = platform === 'darwin'
const isWindows = platform === 'win32'
const isLinux = platform === 'linux'

// @ts-ignore strict
const pid = isRenderer ? Electron.remote.process.pid : process.pid

const kbProcess = {
  argv,
  env,
  pid,
  platform,
  type,
}

const darwinCopyToKBFSTempUploadFile = isDarwin
  ? async (originalFilePath: string) => {
      const simpleFSSimpleFSMakeTempDirForUploadRpcPromise = (params: void, waitingKey?: any) =>
        new Promise<any>((resolve, reject) => {
          if (!engine) {
            throw new Error('Preload missing engine')
          }
          engine!._rpcOutgoing({
            callback: (error, result) => (error ? reject(error) : resolve(result)),
            method: 'keybase.1.SimpleFS.simpleFSMakeTempDirForUpload',
            params,
            waitingKey,
          })
        })
      const dir = await simpleFSSimpleFSMakeTempDirForUploadRpcPromise()
      const dst = path.join(dir, path.basename(originalFilePath))
      await fse.copy(originalFilePath, dst)
      return dst
    }
  : () => {
      throw new Error('unsupported platform')
    }

const generateOutboxID = () => Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))

// filled in
let engine: any = null
const setEngine = (e: any) => {
  if (engine) {
    throw new Error('only one engine')
  }
  engine = e
}

const darwinCopyToChatTempUploadFile = isDarwin
  ? async (originalFilePath: string): Promise<{outboxID: Buffer; path: string}> => {
      const outboxID = generateOutboxID()
      const localGetUploadTempFileRpcPromise = (params: any, waitingKey?: any) => {
        return new Promise<any>((resolve, reject) => {
          if (!engine) {
            throw new Error('Preload missing engine')
          }
          engine!._rpcOutgoing({
            callback: (error, result) => (error ? reject(error) : resolve(result)),
            method: 'chat.1.local.getUploadTempFile',
            params,
            waitingKey,
          })
        })
      }

      const dst = await localGetUploadTempFileRpcPromise({
        filename: originalFilePath,
        outboxID,
      })
      await fse.copy(originalFilePath, dst)
      return {outboxID, path: dst}
    }
  : () => {
      throw new Error('unsupported platform')
    }

// Expose native file picker to components.
// Improved experience over HTML <input type='file' />
const showOpenDialog = async (opts: KBElectronOpenDialogOptions) => {
  try {
    const {
      title,
      message,
      buttonLabel,
      allowDirectories,
      allowFiles,
      allowMultiselect,
      defaultPath,
      filters,
    } = opts
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
    const result = await Electron.remote.dialog.showOpenDialog(
      Electron.remote.getCurrentWindow(),
      allowedOptions
    )
    if (!result) return
    if (result.canceled) return
    return result.filePaths
  } catch (err) {
    console.warn('Electron failed to launch showOpenDialog')
    return
  }
}

// A helper to allow console logs while building but have TS catch it
const debugConsoleLog: () => void = console.log.bind(console) as any

const showSaveDialog = async (opts: KBElectronSaveDialogOptions) => {
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
    const result = await Electron.remote.dialog.showSaveDialog(
      Electron.remote.getCurrentWindow(),
      allowedOptions
    )
    if (!result) return
    if (result.canceled) return
    return result.filePath
  } catch (err) {
    console.warn('Electron failed to launch showSaveDialog')
    return
  }
}

target.KB = {
  __dirname: __dirname,
  debugConsoleLog,
  electron: {
    app: {
      appPath: __STORYSHOT__ ? '' : isRenderer ? Electron.remote.app.getAppPath() : Electron.app.getAppPath(),
    },
    dialog: {
      showOpenDialog,
      showSaveDialog,
    },
  },
  kb: {
    darwinCopyToChatTempUploadFile,
    darwinCopyToKBFSTempUploadFile,
    setEngine,
  },
  os: {
    homedir: os.homedir(),
  },
  path: {
    basename: path.basename,
    dirname: path.dirname,
    extname: path.extname,
    join: path.join,
    resolve: path.resolve,
    sep: path.sep as any,
  },
  process: kbProcess,
  // punycode, // used by a dep
}

if (isRenderer) {
  // have to do this else electron blows away process after the initial preload, use this to add it back
  setTimeout(() => {
    window.KB.process = kbProcess
  }, 0)
}
