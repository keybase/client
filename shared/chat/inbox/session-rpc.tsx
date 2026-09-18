import * as T from '@/constants/types'
import logger from '@/logger'
import {isChatSessionReady} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {timeoutPromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'

const retryDelaysMs = [250, 750]

export const withChatSessionRetry = async <R,>(run: () => Promise<R>): Promise<R | undefined> => {
  const username = useCurrentUserState.getState().username
  const sameSession = () =>
    !!username && isChatSessionReady() && useCurrentUserState.getState().username === username
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (!sameSession()) {
      return
    }
    try {
      return await run()
    } catch (error) {
      const delay = retryDelaysMs[attempt]
      if (!(error instanceof RPCError) || error.code !== T.RPCGen.StatusCode.scloginrequired) {
        throw error
      }
      if (delay === undefined || !sameSession()) {
        logger.info('chat session not ready, giving up')
        return
      }
      logger.info(`chat session not ready, retrying in ${delay}ms`)
      await timeoutPromise(delay)
    }
  }
  return
}
