import * as Electron from 'electron'
import type {WaitingKey} from '../../engine'
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
const isDarwin = process.platform === 'darwin'

const getEngine = () => {
  return require('../../engine').getEngine()
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
          darwinCopyToChatTempUploadFile: async (originalFilePath: string) => {
            if (!isDarwin) {
              throw new Error('Unsupported platform')
            }
            const generateOutboxID = () =>
              Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))
            const outboxID = generateOutboxID()
            const localGetUploadTempFileRpcPromise = async (
              params: ChatMessageTypes['chat.1.local.getUploadTempFile']['inParam'],
              waitingKey?: WaitingKey
            ) => {
              return new Promise<ChatMessageTypes['chat.1.local.getUploadTempFile']['outParam']>(
                (resolve, reject) => {
                  getEngine()._rpcOutgoing({
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

            const res = (await Electron.ipcRenderer.invoke('KBkeybase', {
              payload: {dst, originalFilePath},
              type: 'darwinCopyToChatTempUploadFile',
            })) as boolean
            if (res) {
              return {outboxID, path: dst}
            } else {
              throw new Error("Couldn't save")
            }
          },
          darwinCopyToKBFSTempUploadFile: async (originalFilePath: string) => {
            if (!isDarwin) return ''
            const simpleFSSimpleFSMakeTempDirForUploadRpcPromise = async () =>
              new Promise<FsMessageTypes['keybase.1.SimpleFS.simpleFSMakeTempDirForUpload']['outParam']>(
                (resolve, reject) => {
                  getEngine()._rpcOutgoing({
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
