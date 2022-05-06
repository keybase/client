import * as Electron from 'electron'
import fse from 'fs-extra'
import type {Engine, WaitingKey} from '../../engine'
import type {RPCError} from '../../util/errors'
import type {MessageTypes as FsMessageTypes} from '../../constants/types/rpc-gen'
import type {MessageTypes as ChatMessageTypes} from '../../constants/types/rpc-chat-gen'
import {
  injectPreload,
  type KB2,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from '../../util/electron.desktop'

const isRenderer = process.type === 'renderer'
const target = isRenderer ? window : global
const {platform} = process
const isDarwin = platform === 'darwin'

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

target.KB = {
  kb: {
    darwinCopyToChatTempUploadFile,
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
          darwinCopyToKBFSTempUploadFile: async (originalFilePath: string) => {
            const simpleFSSimpleFSMakeTempDirForUploadRpcPromise = async () =>
              new Promise<FsMessageTypes['keybase.1.SimpleFS.simpleFSMakeTempDirForUpload']['outParam']>(
                (resolve, reject) => {
                  if (!engine) {
                    throw new Error('Preload missing engine')
                  }
                  engine._rpcOutgoing({
                    callback: (error: RPCError | null, result: string) =>
                      error ? reject(error) : resolve(result),
                    method: 'keybase.1.SimpleFS.simpleFSMakeTempDirForUpload',
                  })
                }
              )
            const dir = await simpleFSSimpleFSMakeTempDirForUploadRpcPromise()
            return (await Electron.ipcRenderer.invoke('KBkeybase', {
              payload: {dir, originalFilePath},
              type: 'darwinCopyToKBFSTempUploadFile',
            })) as string
          },
          showOpenDialog: async (options?: OpenDialogOptions) => {
            return (await Electron.ipcRenderer.invoke('KBkeybase', {
              payload: options,
              type: 'showOpenDialog',
            })) as Array<string>
          },
          showSaveDialog: async (options?: SaveDialogOptions) => {
            return (await Electron.ipcRenderer.invoke('KBkeybase', {
              payload: options,
              type: 'showSaveDialog',
            })) as string
          },
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
