import type * as T from '@/constants/types'
import {createConversation, navigateToPendingThread} from '@/constants/router'
import {ignorePromise, timeoutPromise} from '@/constants/utils'

export const onTeamBuildingFinished = (users: ReadonlySet<T.TB.User>) => {
  const f = async () => {
    await timeoutPromise(500)
    const participants = [...users].map(u => u.id)
    navigateToPendingThread(participants)
    createConversation(participants)
  }
  ignorePromise(f())
}
