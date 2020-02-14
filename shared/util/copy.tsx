import {promises as fs} from 'fs'
import os from 'os'
import path from 'path'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Chat2Constants from '../constants/chat2'

export const copyToTmp = async (originalFilePath: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'keybase-copyToTmp-'))
  const dst = path.join(dir, path.basename(originalFilePath))
  await fs.copyFile(originalFilePath, dst)
  return dst
}

export const copyToChatTempUploadFile = async (
  originalFilePath: string
): Promise<{outboxID: Buffer; path: string}> => {
  const outboxID = Chat2Constants.generateOutboxID()
  const dst = await RPCChatTypes.localGetUploadTempFileRpcPromise({
    filename: originalFilePath,
    outboxID,
  })
  await fs.copyFile(originalFilePath, dst)
  return {outboxID, path: dst}
}
