import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'

type ThreadLoadStatusState = {
  conversationIDKey: T.Chat.ConversationIDKey
  status: T.RPCChat.UIChatThreadStatusTyp
}

type ThreadLoadStatusContextType = {
  onThreadLoadStatus: ConvoState.ThreadLoadStatusReporter
  status: T.RPCChat.UIChatThreadStatusTyp
}

const noThreadLoadStatus = T.RPCChat.UIChatThreadStatusTyp.none
const ignoreThreadLoadStatus: ConvoState.ThreadLoadStatusReporter = () => {}

const ThreadLoadStatusContext = React.createContext<ThreadLoadStatusContextType>({
  onThreadLoadStatus: ignoreThreadLoadStatus,
  status: noThreadLoadStatus,
})

export const useThreadLoadStatus = () => React.useContext(ThreadLoadStatusContext).status

export const useThreadLoadStatusReporter = () =>
  React.useContext(ThreadLoadStatusContext).onThreadLoadStatus

export const ConversationThreadLoadStatusProvider = (
  p: React.PropsWithChildren<{
    id: T.Chat.ConversationIDKey
    skipThreadLoadOnSelection?: boolean
  }>
) => {
  const {children, id, skipThreadLoadOnSelection = false} = p
  const [initialSkipThreadLoadOnSelection] = React.useState(skipThreadLoadOnSelection)
  const [threadLoadStatusState, setThreadLoadStatusState] = React.useState<ThreadLoadStatusState>(() => ({
    conversationIDKey: id,
    status: noThreadLoadStatus,
  }))

  const status =
    threadLoadStatusState.conversationIDKey === id ? threadLoadStatusState.status : noThreadLoadStatus

  const onThreadLoadStatus: ConvoState.ThreadLoadStatusReporter = (conversationIDKey, status) => {
    if (conversationIDKey !== id) {
      return
    }
    setThreadLoadStatusState({conversationIDKey, status})
  }

  const reloadStaleThread = () => {
    ConvoState.getConvoState(id).dispatch.loadMoreMessages({
      onThreadLoadStatus,
      reason: 'got stale',
    })
  }

  useEngineActionListener('chat.1.NotifyChat.ChatThreadsStale', action => {
    const hasStaleThread = (action.payload.params.updates ?? []).some(
      update => T.Chat.conversationIDToKey(update.convID) === id
    )
    if (hasStaleThread) {
      reloadStaleThread()
    }
  })

  useEngineActionListener('chat.1.NotifyChat.ChatInboxSynced', action => {
    const {syncRes} = action.payload.params
    if (syncRes.syncType !== T.RPCChat.SyncInboxResType.incremental) {
      return
    }
    const hasStaleThread = (syncRes.incremental.items ?? []).some(
      item => T.Chat.stringToConversationIDKey(item.conv.convID) === id
    )
    if (hasStaleThread) {
      reloadStaleThread()
    }
  })

  const selectConversation = React.useEffectEvent(() => {
    ConvoState.getConvoState(id).dispatch.selectedConversation({
      onThreadLoadStatus,
      skipThreadLoad: initialSkipThreadLoadOnSelection,
    })
  })

  React.useEffect(() => {
    selectConversation()
  }, [id, initialSkipThreadLoadOnSelection])

  const value = {onThreadLoadStatus, status}
  return <ThreadLoadStatusContext value={value}>{children}</ThreadLoadStatusContext>
}
