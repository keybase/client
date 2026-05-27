import * as React from 'react'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import {
  type ThreadLoadStatusOptions,
  type ThreadLoadStatusReporter,
  useConversationThreadLoadMoreMessages,
  useConversationThreadSelectedConversation,
} from './thread-context'

type ThreadLoadStatusState = {
  conversationIDKey: T.Chat.ConversationIDKey
  status: T.RPCChat.UIChatThreadStatusTyp
}

type ThreadLoadStatusOptionsCache = {
  generation: number
  options: ThreadLoadStatusOptions
}

type ThreadLoadStatusStatusContextType = T.RPCChat.UIChatThreadStatusTyp

type ThreadLoadStatusActionContextType = {
  getThreadLoadStatusOptions: () => ThreadLoadStatusOptions
  onThreadLoadStatus: ThreadLoadStatusReporter
}

const noThreadLoadStatus = T.RPCChat.UIChatThreadStatusTyp.none
const ignoreThreadLoadStatus: ThreadLoadStatusReporter = () => {}
const ignoreThreadLoadStatusOptions = () => ({
  isThreadLoadCurrent: () => true,
  onThreadLoadStatus: ignoreThreadLoadStatus,
})

const missingThreadLoadStatusContext = () => {
  throw new Error('Missing ConversationThreadLoadStatusProvider in the tree')
}

const missingThreadLoadStatusOptions = () => {
  missingThreadLoadStatusContext()
  return ignoreThreadLoadStatusOptions()
}

const ThreadLoadStatusContext = React.createContext<ThreadLoadStatusStatusContextType>(noThreadLoadStatus)
ThreadLoadStatusContext.displayName = 'ThreadLoadStatusContext'

const ThreadLoadStatusActionContext = React.createContext<ThreadLoadStatusActionContextType>({
  getThreadLoadStatusOptions: missingThreadLoadStatusOptions,
  onThreadLoadStatus: missingThreadLoadStatusContext,
})
ThreadLoadStatusActionContext.displayName = 'ThreadLoadStatusActionContext'

export const useThreadLoadStatus = () => React.useContext(ThreadLoadStatusContext)

export const useThreadLoadStatusReporter = () =>
  React.useContext(ThreadLoadStatusActionContext).onThreadLoadStatus

export const useThreadLoadStatusOptions = () =>
  React.useContext(ThreadLoadStatusActionContext).getThreadLoadStatusOptions()

export const useThreadLoadStatusOptionsGetter = () =>
  React.useContext(ThreadLoadStatusActionContext).getThreadLoadStatusOptions

export const ConversationThreadLoadStatusProvider = (
  p: React.PropsWithChildren<{
    allowMarkReadOnLoad?: boolean
    id: T.Chat.ConversationIDKey
    skipThreadLoadOnSelection?: boolean
  }>
) => {
  const {allowMarkReadOnLoad = true, children, id, skipThreadLoadOnSelection = false} = p
  const [initialSkipThreadLoadOnSelection] = React.useState(skipThreadLoadOnSelection)
  const loadMoreMessages = useConversationThreadLoadMoreMessages()
  const selectedConversation = useConversationThreadSelectedConversation()
  const currentIDRef = React.useRef(id)
  React.useLayoutEffect(() => {
    currentIDRef.current = id
  }, [id])
  const threadLoadGenerationRef = React.useRef(0)
  const threadLoadStatusOptionsRef = React.useRef<ThreadLoadStatusOptionsCache | undefined>(undefined)
  const [threadLoadStatusState, setThreadLoadStatusState] = React.useState<ThreadLoadStatusState>(() => ({
    conversationIDKey: id,
    status: noThreadLoadStatus,
  }))
  const [threadLoadStatusActions] = React.useState<ThreadLoadStatusActionContextType>(() => {
    const onThreadLoadStatus: ThreadLoadStatusReporter = (conversationIDKey, status) => {
      if (conversationIDKey !== currentIDRef.current) {
        return
      }
      setThreadLoadStatusState(previous =>
        previous.conversationIDKey === conversationIDKey && previous.status === status
          ? previous
          : {conversationIDKey, status}
      )
    }

    const getThreadLoadStatusOptions = (): ThreadLoadStatusOptions => {
      const generation = threadLoadGenerationRef.current
      const cached = threadLoadStatusOptionsRef.current
      if (cached?.generation === generation) {
        return cached.options
      }
      const options = {
        isThreadLoadCurrent: () => threadLoadGenerationRef.current === generation,
        onThreadLoadStatus,
      }
      threadLoadStatusOptionsRef.current = {generation, options}
      return options
    }

    return {getThreadLoadStatusOptions, onThreadLoadStatus}
  })
  const {getThreadLoadStatusOptions} = threadLoadStatusActions

  React.useEffect(() => {
    return () => {
      // Only invalidate if the conversation actually changed. In React StrictMode,
      // effects run twice (mount → cleanup → remount) with the same id — we must not
      // increment here or the first RPC's callbacks get discarded as stale while the
      // second (StrictMode) RPC receives no content from the daemon (it deduplicates).
      if (currentIDRef.current !== id) {
        threadLoadGenerationRef.current += 1
      }
    }
  }, [id])

  const status =
    threadLoadStatusState.conversationIDKey === id ? threadLoadStatusState.status : noThreadLoadStatus

  const reloadStaleThread = () => {
    loadMoreMessages({
      allowMarkAsRead: allowMarkReadOnLoad,
      ...getThreadLoadStatusOptions(),
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
    selectedConversation({
      allowMarkAsRead: allowMarkReadOnLoad,
      ...getThreadLoadStatusOptions(),
      skipThreadLoad: initialSkipThreadLoadOnSelection,
    })
  })

  React.useEffect(() => {
    logger.info(
      `ConversationThreadLoadStatusProvider: selecting thread: ${id} skipThreadLoad=${initialSkipThreadLoadOnSelection}`
    )
    selectConversation()
  }, [id, initialSkipThreadLoadOnSelection])

  return (
    <ThreadLoadStatusActionContext value={threadLoadStatusActions}>
      <ThreadLoadStatusContext value={status}>{children}</ThreadLoadStatusContext>
    </ThreadLoadStatusActionContext>
  )
}
