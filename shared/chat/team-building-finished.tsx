import * as T from '@/constants/types'
import {createConversation, navigateToThread} from '@/constants/router'
import {ignorePromise, timeoutPromise} from '@/constants/utils'

export const onTeamBuildingFinished = (users: ReadonlySet<T.TB.User>) => {
  const f = async () => {
    await timeoutPromise(500)
    navigateToThread(T.Chat.pendingWaitingConversationIDKey, 'justCreated')
    createConversation([...users].map(u => u.id))
  }
  ignorePromise(f())
}
