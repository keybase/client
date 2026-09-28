import * as Meta from '@/constants/chat/meta'
import * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {clearChatTimeCache} from '@/util/timestamp'
import {ignorePromise} from '@/constants/utils'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import {useShellState} from '@/stores/shell'
import {useStore} from 'zustand'
import {useIsFocused} from '@react-navigation/core'
import {applyOptimisticReactionsToMessage} from './thread-message-state'
import {getInboxConversationParticipants, unboxRows, useInboxMetadataState} from '@/chat/inbox/metadata'
import {getChatRpc} from './chat-rpc'
import {emptyConversationMeta, numMessagesOnInitialLoad, numMessagesOnScrollback} from './thread-load'
import {useThreadEngineListeners} from './thread-engine'
import {
  makeThreadStore,
  type ConversationThreadActions,
  type ConversationThreadState,
  type ThreadLoadStatusOptions,
  type ThreadStore,
} from './thread-store'

export type {
  ConversationThreadActions,
  ConversationThreadState,
  LoadMoreMessagesParams,
  ScrollDirection,
  ThreadLoadStatusOptions,
  ThreadLoadStatusReporter,
} from './thread-store'

const emptyParticipantInfo: T.Chat.ParticipantInfo = {
  all: [],
  contactName: new Map(),
  name: [],
}

const ConversationThreadIDContext = React.createContext<T.Chat.ConversationIDKey | undefined>(undefined)
ConversationThreadIDContext.displayName = 'ConversationThreadIDContext'

type ConversationThreadStore = ThreadStore['store']
const ConversationThreadStoreContext = React.createContext<ConversationThreadStore | undefined>(undefined)
ConversationThreadStoreContext.displayName = 'ConversationThreadStoreContext'

// Per-conversation sticky username-header cache (see getMessageShowUsername), owned by the thread
// store so it lives and dies with the conversation rather than as a module global.
export const ShownUsernameCacheContext = React.createContext<Map<T.Chat.Ordinal, string> | undefined>(
  undefined
)
ShownUsernameCacheContext.displayName = 'ShownUsernameCacheContext'

type SelectedConversationOptions = ThreadLoadStatusOptions & {
  allowMarkAsRead?: boolean
  skipThreadLoad?: boolean
}

type LoadMessagesCentered = (
  messageID: T.Chat.MessageID,
  highlightMode: T.Chat.CenterOrdinalHighlightMode,
  options?: ThreadLoadStatusOptions
) => void
type LoadOlderMessagesDueToScroll = (
  numOrdinals: number,
  options?: ThreadLoadStatusOptions
) => void
type LoadNewerMessagesDueToScroll = (
  numOrdinals: number,
  options?: ThreadLoadStatusOptions
) => void
type JumpToRecent = (options?: ThreadLoadStatusOptions) => void
type SelectedConversation = (options?: SelectedConversationOptions) => void

const ConversationThreadActionsContext = React.createContext<ConversationThreadActions | undefined>(
  undefined
)
ConversationThreadActionsContext.displayName = 'ConversationThreadActionsContext'

export const useConversationThreadID = () => {
  const conversationIDKey = React.useContext(ConversationThreadIDContext)
  if (!conversationIDKey) {
    throw new Error('Missing ConversationThreadProvider in the tree')
  }
  return conversationIDKey
}

export const useConversationThreadActions = () => {
  const actions = React.useContext(ConversationThreadActionsContext)
  if (!actions) {
    throw new Error('Missing ConversationThreadProvider actions in the tree')
  }
  return actions
}

const useScrollLoadGate = () => {
  const lastScrollNumOrdinalsRef = React.useRef(0)
  const lastScrollTimeRef = React.useRef(0)
  return (numOrdinals: number) => {
    const now = Date.now()
    if (numOrdinals !== lastScrollNumOrdinalsRef.current) {
      lastScrollNumOrdinalsRef.current = numOrdinals
      lastScrollTimeRef.current = now
      return true
    }

    const ok = now - lastScrollTimeRef.current > 500
    if (ok) {
      lastScrollNumOrdinalsRef.current = numOrdinals
      lastScrollTimeRef.current = now
    }
    return ok
  }
}

export const useConversationThreadSelector = <TValue,>(
  selector: (snapshot: ConversationThreadState) => TValue
) => {
  const store = React.useContext(ConversationThreadStoreContext)
  if (!store) {
    throw new Error('Missing ConversationThreadProvider state in the tree')
  }
  return useStore(store, selector)
}

export const useConversationThreadStore = () => {
  const store = React.useContext(ConversationThreadStoreContext)
  if (!store) {
    throw new Error('Missing ConversationThreadProvider state in the tree')
  }
  return store
}

// Reads the meta for the current thread from its single owner (the inbox metadata
// store). Pass a narrow selector (wrap object results in C.useShallow) so render-hot
// callers don't re-render on unrelated meta churn (e.g. draft updates).
export const useThreadMeta = <TValue,>(
  selector: (meta: T.Immutable<T.Chat.ConversationMeta>) => TValue
): TValue => {
  const id = useConversationThreadID()
  return useInboxMetadataState(s => selector(s.metas.get(id) ?? emptyConversationMeta))
}

type ConversationThreadProviderProps = React.PropsWithChildren<{
  id: T.Chat.ConversationIDKey
}>

const ConversationThreadContextProvider = (p: {
  children: React.ReactNode
  id: T.Chat.ConversationIDKey
  thread: ThreadStore
}) => (
  <ConversationThreadIDContext value={p.id}>
    <ConversationThreadActionsContext value={p.thread.actions}>
      <ConversationThreadStoreContext value={p.thread.store}>
        <ShownUsernameCacheContext value={p.thread.shownUsernameCache}>{p.children}</ShownUsernameCacheContext>
      </ConversationThreadStoreContext>
    </ConversationThreadActionsContext>
  </ConversationThreadIDContext>
)

const ConversationThreadProviderInner = (p: ConversationThreadProviderProps) => {
  const {children, id} = p
  const [thread] = React.useState(() => makeThreadStore(id))
  const active = useShellState(s => s.active)
  const appFocused = useShellState(s => s.appFocused)
  const routeFocused = useIsFocused()
  // Mark-read attempts bail while we're not looking at the thread (backgrounded,
  // covered by another route, or idle on desktop), so re-fire when any of those
  // gates reopen. On mobile `active` never changes; appFocused/routeFocused are
  // the only signals that we came back.
  const lookingAtThread = active && appFocused && routeFocused
  // An insertion effect runs before every layout effect of the commit, so a child's layout effect
  // that marks read (the native list's initial mark read) already sees this commit's value.
  React.useInsertionEffect(() => {
    thread.setLookingAtThread(lookingAtThread)
  }, [thread, lookingAtThread])
  const previousLookingAtThreadRef = React.useRef(lookingAtThread)
  React.useEffect(() => {
    const wasLookingAtThread = previousLookingAtThreadRef.current
    previousLookingAtThreadRef.current = lookingAtThread
    if (!wasLookingAtThread && lookingAtThread) {
      thread.markReadIfArmed()
    }
  }, [thread, lookingAtThread])
  // The other half of the store's unlocalized mark-read bail: whatever mark-read attempt was refused
  // for want of a read position, run it again now that there is one. Only on the transition, so an
  // ordinary mark-read moving readMsgID does not bounce back through here.
  //
  // Safe against the orange line: useOrangeLine latches the read position into state on the commit
  // localization lands in, so the position it later asks the unreadline about does not depend on
  // beating this mark-read to it.
  const metaReadMsgID = useInboxMetadataState(
    s => (s.metas.get(id) ?? emptyConversationMeta).readMsgID
  )
  const wasUnlocalizedRef = React.useRef(metaReadMsgID < 0)
  React.useEffect(() => {
    const wasUnlocalized = wasUnlocalizedRef.current
    wasUnlocalizedRef.current = metaReadMsgID < 0
    if (wasUnlocalized && metaReadMsgID >= 0) {
      thread.actions.markThreadAsRead()
    }
  }, [thread, metaReadMsgID])
  React.useEffect(() => {
    return () => {
      thread.dispose()
    }
  }, [thread])
  useThreadEngineListeners(id, thread.actions)

  return (
    <ConversationThreadContextProvider id={id} thread={thread}>
      {children}
    </ConversationThreadContextProvider>
  )
}

export const ConversationThreadProvider = (p: ConversationThreadProviderProps) => {
  const currentConversationIDKey = React.useContext(ConversationThreadIDContext)
  const currentActions = React.useContext(ConversationThreadActionsContext)
  const currentStore = React.useContext(ConversationThreadStoreContext)
  if (currentConversationIDKey === p.id && currentActions && currentStore) {
    // Same-thread wrappers should share the live message/meta state instead of replacing it.
    return <>{p.children}</>
  }
  return <ConversationThreadProviderInner {...p} />
}

export const LiveConversationThreadProvider = (p: ConversationThreadProviderProps) => (
  <ConversationThreadProviderInner {...p} />
)

export const useConversationThreadSetExplodingMode = () => useConversationThreadActions().setExplodingMode

const displayMessageCache = new WeakMap<
  T.Chat.Message,
  {
    displayMessage: T.Chat.Message | undefined
    optimisticReactionMap: ConversationThreadState['optimisticReactionMap']
  }
>()

export const getConversationThreadDisplayMessage = (
  snapshot: ConversationThreadState,
  ordinal: T.Chat.Ordinal
) => {
  const message = snapshot.messageMap.get(ordinal)
  if (!message) {
    return undefined
  }
  const cached = displayMessageCache.get(message)
  if (cached?.optimisticReactionMap === snapshot.optimisticReactionMap) {
    return cached.displayMessage
  }
  const displayMessage = applyOptimisticReactionsToMessage(message, snapshot.optimisticReactionMap)
  displayMessageCache.set(message, {displayMessage, optimisticReactionMap: snapshot.optimisticReactionMap})
  return displayMessage
}

export const useConversationThreadMessage = (ordinal: T.Chat.Ordinal) =>
  useConversationThreadSelector(snapshot => getConversationThreadDisplayMessage(snapshot, ordinal))

export const useConversationThreadLoadMoreMessages = () => useConversationThreadActions().loadMoreMessages

const useConversationThreadMessagesClear = () => useConversationThreadActions().messagesClear

export const useConversationThreadLoadOlderMessagesDueToScroll = () => {
  const threadStore = useConversationThreadStore()
  const loadMoreMessages = useConversationThreadLoadMoreMessages()
  const okToLoadMore = useScrollLoadGate()

  const loadOlderMessagesDueToScroll: LoadOlderMessagesDueToScroll = (numOrdinals, options) => {
    if (!threadStore.getState().moreToLoadBack) {
      logger.info('bail: scrolling back and at the end')
      return
    }

    if (!numOrdinals) {
      return
    }

    if (!okToLoadMore(numOrdinals)) {
      return
    }

    loadMoreMessages({
      ...(options ?? {}),
      numberOfMessagesToLoad: numMessagesOnScrollback,
      reason: 'scroll back',
      scrollDirection: 'back',
    })
  }
  return loadOlderMessagesDueToScroll
}

export const useConversationThreadLoadNewerMessagesDueToScroll = () => {
  const loadMoreMessages = useConversationThreadLoadMoreMessages()
  const okToLoadMore = useScrollLoadGate()

  const loadNewerMessagesDueToScroll: LoadNewerMessagesDueToScroll = (numOrdinals, options) => {
    if (!numOrdinals) {
      return
    }

    if (!okToLoadMore(numOrdinals)) {
      return
    }

    loadMoreMessages({
      ...(options ?? {}),
      numberOfMessagesToLoad: numMessagesOnScrollback,
      reason: 'scroll forward',
      scrollDirection: 'forward',
    })
  }
  return loadNewerMessagesDueToScroll
}

export const useConversationThreadLoadMessagesCentered = () => {
  const conversationIDKey = useConversationThreadID()
  const loadMoreMessages = useConversationThreadLoadMoreMessages()
  const messagesClear = useConversationThreadMessagesClear()

  const loadMessagesCentered: LoadMessagesCentered = (messageID, highlightMode, options) => {
    messagesClear()
    loadMoreMessages({
      centeredMessageID: {
        conversationIDKey,
        highlightMode,
        messageID,
      },
      forceContainsLatestCalc: true,
      messageIDControl: {
        mode: T.RPCChat.MessageIDControlMode.centered,
        num: numMessagesOnInitialLoad,
        pivot: messageID,
      },
      ...(options ?? {}),
      reason: 'centered',
    })
  }
  return loadMessagesCentered
}

export const useConversationThreadJumpToRecent = () => {
  const {setMarkReadBlocked} = useConversationThreadActions()
  const loadMoreMessages = useConversationThreadLoadMoreMessages()
  const messagesClear = useConversationThreadMessagesClear()

  const jumpToRecent: JumpToRecent = options => {
    setMarkReadBlocked(false)
    // The newest window is disjoint from wherever the reader was, so merging the two would leave a
    // gap in the ordinals. Drop the old window first, the way a centered jump does.
    messagesClear()
    loadMoreMessages({...(options ?? {}), reason: 'jump to recent'})
  }
  return jumpToRecent
}

export const useConversationThreadMarkThreadAsRead = () => useConversationThreadActions().markThreadAsRead

export const useConversationThreadSetMarkAsUnread = () => useConversationThreadActions().setMarkAsUnread

export const useConversationThreadSetMarkReadBlocked = () => useConversationThreadActions().setMarkReadBlocked

export const useConversationThreadSelectedConversation = () => {
  const conversationIDKey = useConversationThreadID()
  const loadMoreMessages = useConversationThreadLoadMoreMessages()

  const selectedConversation: SelectedConversation = (options?: SelectedConversationOptions) => {
    const {skipThreadLoad, ...loadStatusOptions} = options ?? {}
    clearChatTimeCache()

    unboxRows([conversationIDKey])

    const username = useCurrentUserState.getState().username
    const participantInfo = getInboxConversationParticipants(conversationIDKey) ?? emptyParticipantInfo
    const otherParticipants = Meta.getRowParticipants(participantInfo, username || '')
    if (otherParticipants.length === 1) {
      const otherUsername = otherParticipants[0] || ''

      if (otherUsername && !otherUsername.includes('@')) {
        useUsersState.getState().dispatch.getBio(otherUsername)
      }
    }

    if (!skipThreadLoad) {
      loadMoreMessages({...loadStatusOptions, reason: 'focused'})
    }
  }
  return selectedConversation
}

export const useConversationThreadUnfurlResolvePrompt = () => {
  const conversationIDKey = useConversationThreadID()
  const {clearUnfurlPrompt} = useConversationThreadActions()
  return (messageID: T.Chat.MessageID, domain: string, result: T.RPCChat.UnfurlPromptResult) => {
    clearUnfurlPrompt(messageID, domain)
    const f = async () => {
      await getChatRpc().resolveUnfurlPrompt({conversationIDKey, messageID, result})
    }
    ignorePromise(f())
  }
}
