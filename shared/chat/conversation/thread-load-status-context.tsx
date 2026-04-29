import * as React from 'react'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import {useShellState} from '@/stores/shell'
import {useIsFocused} from '@react-navigation/core'
import {
  type ThreadLoadStatusOptions,
  type ThreadLoadStatusReporter,
  useConversationThreadMarkThreadAsRead,
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

export const ConversationThreadLoadStatusProvider = (
  p: React.PropsWithChildren<{
    id: T.Chat.ConversationIDKey
    skipThreadLoadOnSelection?: boolean
  }>
) => {
  const {children, id, skipThreadLoadOnSelection = false} = p
  const [initialSkipThreadLoadOnSelection] = React.useState(skipThreadLoadOnSelection)
  const loadMoreMessages = useConversationThreadLoadMoreMessages()
  const markThreadAsRead = useConversationThreadMarkThreadAsRead()
  const selectedConversation = useConversationThreadSelectedConversation()
  const currentIDRef = React.useRef(id)
  React.useLayoutEffect(() => {
    currentIDRef.current = id
  }, [id])
  const appFocused = useShellState(s => s.appFocused)
  const previousAppFocusedRef = React.useRef(appFocused)
  const routeFocused = useIsFocused()
  const previousRouteFocusedRef = React.useRef(routeFocused)
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
      threadLoadGenerationRef.current += 1
    }
  }, [id])

  const status =
    threadLoadStatusState.conversationIDKey === id ? threadLoadStatusState.status : noThreadLoadStatus

  const reloadStaleThread = () => {
    loadMoreMessages({
      ...getThreadLoadStatusOptions(),
      reason: 'got stale',
    })
  }

  const reloadForegroundedThread = React.useEffectEvent(() => {
    loadMoreMessages({
      ...getThreadLoadStatusOptions(),
      reason: 'foregrounding',
    })
    markThreadAsRead()
  })

  const reloadSelectedThread = React.useEffectEvent(() => {
    loadMoreMessages({
      ...getThreadLoadStatusOptions(),
      reason: 'tab selected',
    })
    markThreadAsRead()
  })

  React.useEffect(() => {
    const previousAppFocused = previousAppFocusedRef.current
    previousAppFocusedRef.current = appFocused
    if (appFocused && !previousAppFocused) {
      reloadForegroundedThread()
    }
  }, [appFocused])

  React.useEffect(() => {
    const previousRouteFocused = previousRouteFocusedRef.current
    previousRouteFocusedRef.current = routeFocused
    if (routeFocused && !previousRouteFocused) {
      reloadSelectedThread()
    }
  }, [routeFocused])

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
      ...getThreadLoadStatusOptions(),
      skipThreadLoad: initialSkipThreadLoadOnSelection,
    })
  })

  React.useEffect(() => {
    selectConversation()
  }, [id, initialSkipThreadLoadOnSelection])

  return (
    <ThreadLoadStatusActionContext value={threadLoadStatusActions}>
      <ThreadLoadStatusContext value={status}>{children}</ThreadLoadStatusContext>
    </ThreadLoadStatusActionContext>
  )
}
