import logger from '@/logger'
import {isChatSessionReady} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {isLoginRequired} from '@/util/errors'

// Runs a chat call only while the chat session is ready. The engine already tried a login-required
// failure again while the session was being set up, so one that still fails means it is not ready:
// nothing loaded, rather than an error.
export const withChatSessionRetry = async <R,>(run: () => Promise<R>): Promise<R | undefined> => {
  if (!useCurrentUserState.getState().username || !isChatSessionReady()) {
    return
  }
  try {
    return await run()
  } catch (error) {
    if (!isLoginRequired(error)) {
      throw error
    }
    logger.info('chat session not ready, giving up')
    return
  }
}
