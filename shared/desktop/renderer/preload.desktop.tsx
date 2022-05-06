import path from 'path'
import * as Electron from 'electron'
// @ts-ignore strict
import fse from 'fs-extra'
import type {Engine, WaitingKey} from '../../engine'
import type {RPCError} from '../../util/errors'
import type {MessageTypes as FsMessageTypes} from '../../constants/types/rpc-gen'
import type {MessageTypes as ChatMessageTypes} from '../../constants/types/rpc-chat-gen'
import type {dialog, BrowserWindow, app} from 'electron'
import {injectPreload, type KB2} from '../../util/electron.desktop'

const isRenderer = process.type === 'renderer'
const target = isRenderer ? window : global
const {platform} = process
const isDarwin = platform === 'darwin'
const isWindows = platform === 'win32'
const isLinux = platform === 'linux'

const remote: {
  process: {pid: number}
  dialog: typeof dialog
  app: typeof app
  getCurrentWindow: () => BrowserWindow
} = require(isRenderer ? '@electron/remote' : '@electron/remote/main')

const darwinCopyToKBFSTempUploadFile = isDarwin
  ? async (originalFilePath: string) => {
      const simpleFSSimpleFSMakeTempDirForUploadRpcPromise = async () =>
        new Promise<FsMessageTypes['keybase.1.SimpleFS.simpleFSMakeTempDirForUpload']['outParam']>(
          (resolve, reject) => {
            if (!engine) {
              throw new Error('Preload missing engine')
            }
            engine._rpcOutgoing({
              callback: (error: RPCError | null, result: string) => (error ? reject(error) : resolve(result)),
              method: 'keybase.1.SimpleFS.simpleFSMakeTempDirForUpload',
            })
          }
        )
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
let engine: Engine | null = null
const setEngine = (e: Engine) => {
  if (engine) {
    throw new Error('only one engine')
  }
  engine = e
}

const darwinCopyToChatTempUploadFile = isDarwin
  ? async (originalFilePath: string): Promise<{outboxID: Buffer; path: string}> => {
      const outboxID = generateOutboxID()
      const localGetUploadTempFileRpcPromise = async (
        params: ChatMessageTypes['chat.1.local.getUploadTempFile']['inParam'],
        waitingKey?: WaitingKey
      ) => {
        return new Promise<ChatMessageTypes['chat.1.local.getUploadTempFile']['outParam']>(
          (resolve, reject) => {
            if (!engine) {
              throw new Error('Preload missing engine')
            }
            engine._rpcOutgoing({
              callback: (
                error: RPCError | null,
                result: ChatMessageTypes['chat.1.local.getUploadTempFile']['outParam']
              ) => (error ? reject(error) : resolve(result)),
              method: 'chat.1.local.getUploadTempFile',
              params,
              waitingKey,
            })
          }
        )
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
    const result = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), allowedOptions)
    if (!result) return
    if (result.canceled) return
    return result.filePaths
  } catch (err) {
    console.warn('Electron failed to launch showOpenDialog')
    return
  }
}

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
    const result = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), allowedOptions)
    if (!result) return
    if (result.canceled) return
    return result.filePath
  } catch (err) {
    console.warn('Electron failed to launch showSaveDialog')
    return
  }
}

target.KB = {
  electron: {
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
}

// TODO contextBridge
if (isRenderer) {
  Electron.ipcRenderer
    .invoke('KBkeybase', {type: 'setupPreloadKB2'})
    .then((kb2impl: KB2) => {
      injectPreload({
        constants: {
          ...kb2impl.constants,
          // kb2impl is from node's perspective so isRenderer is incorrect for the other side
          isRenderer: true,
        },
        functions: {
          winCheckRPCOwnership: async () => {
            const res = (await Electron.ipcRenderer.invoke('KBkeybase', {
              type: 'winCheckRPCOwnership',
            })) as boolean
            if (!res) {
              throw new Error('RPCCheck failed!')
            }
          },
        },
      })
    })
    .catch(e => {
      throw e
    })
} else {
  const impl = require('../app/kb2-impl.desktop').default
  injectPreload(impl)
}
