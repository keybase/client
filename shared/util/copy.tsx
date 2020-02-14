import {promises as fs} from 'fs'
import * as Platform from '../constants/platform'
import path from 'path'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Chat2Constants from '../constants/chat2'

const cacheRoot = Platform.isDarwin ? require('../constants/platform.desktop').cacheRoot : ''

export const copyToTmp = Platform.isDarwin
  ? async (originalFilePath: string): Promise<string> => {
      const dir = await fs.mkdtemp(path.join(cacheRoot, 'keybase-copyToTmp-'))
      const dst = path.join(dir, path.basename(originalFilePath))
      await fs.copyFile(originalFilePath, dst)
      return dst
    }
  : () => {
      throw new Error('unsupported platform')
    }

export const copyToChatTempUploadFile = Platform.isDarwin
  ? async (originalFilePath: string): Promise<{outboxID: Buffer; path: string}> => {
      const outboxID = Chat2Constants.generateOutboxID()
      const dst = await RPCChatTypes.localGetUploadTempFileRpcPromise({
        filename: originalFilePath,
        outboxID,
      })
      await fs.copyFile(originalFilePath, dst)
      return {outboxID, path: dst}
    }
  : () => {
      throw new Error('unsupported platform')
    }
