import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import * as Meta from '@/constants/chat/meta'
import * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {clearChatTimeCache} from '@/util/timestamp'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import {
  deleteConversationThreadCacheSnapshot,
  getConversationThreadCacheSnapshot,
  putConversationThreadCacheSnapshot,
  type ConversationThreadSnapshot,
} from './thread-cache'

const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []
const emptyMessageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message> = new Map()
const emptyMessageTypeMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.RenderMessageType> = new Map()

const ConversationThreadIDContext = React.createContext<T.Chat.ConversationIDKey | undefined>(undefined)
const ConversationThreadCacheContext = React.createContext<ConversationThreadSnapshot | undefined>(
  undefined
)

const selectSnapshot = (s: ConvoState.ConvoState): ConversationThreadSnapshot => ({
  loaded: s.loaded,
  messageIDToOrdinal: s.messageIDToOrdinal,
  messageMap: s.messageMap,
  messageOrdinals: s.messageOrdinals,
  messageTypeMap: s.messageTypeMap,
  moreToLoadBack: s.moreToLoadBack,
  moreToLoadForward: s.moreToLoadForward,
  pendingOutboxToOrdinal: s.pendingOutboxToOrdinal,
  validatedOrdinalRange: s.validatedOrdinalRange,
})

export type ThreadLoadStatusOptions = {
  isThreadLoadCurrent?: () => boolean
  onThreadLoadStatus?: ThreadLoadStatusReporter
}

type SelectedConversationOptions = ThreadLoadStatusOptions & {
  skipThreadLoad?: boolean
}

type LoadMoreMessages = ConvoState.ConvoState['dispatch']['loadMoreMessages']
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
type MessagesClear = () => void
type SelectedConversation = ConvoState.ConvoState['dispatch']['selectedConversation']

export type ThreadLoadStatusReporter = (
  conversationIDKey: T.Chat.ConversationIDKey,
  status: T.RPCChat.UIChatThreadStatusTyp
) => void

export const useConversationThreadID = () => {
  const conversationIDKey = React.useContext(ConversationThreadIDContext)
  if (!conversationIDKey) {
    throw new Error('Missing ConversationThreadProvider in the tree')
  }
  return conversationIDKey
}

const useCachedSnapshot = () => React.useContext(ConversationThreadCacheContext)

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

const useConversationThreadSnapshotValue = <TValue,>(
  selector: (snapshot: ConversationThreadSnapshot) => TValue
) => {
  const conversationIDKey = useConversationThreadID()
  const cachedSnapshot = useCachedSnapshot()
  return ConvoState.useConvoState(conversationIDKey, s => {
    const liveSnapshot = selectSnapshot(s)
    const snapshot = liveSnapshot.loaded || !cachedSnapshot ? liveSnapshot : cachedSnapshot
    return selector(snapshot)
  })
}

const ConversationThreadCacheSync = (p: {
  clearCachedSnapshot: React.Dispatch<React.SetStateAction<ConversationThreadSnapshot | undefined>>
  id: T.Chat.ConversationIDKey
}) => {
  const {clearCachedSnapshot, id} = p
  const snapshot = ConvoState.useConvoState(id, C.useShallow(selectSnapshot))
  React.useEffect(() => {
    if (snapshot.loaded) {
      putConversationThreadCacheSnapshot(id, snapshot)
      clearCachedSnapshot(undefined)
    }
  }, [clearCachedSnapshot, id, snapshot])
  return null
}

export const ConversationThreadProvider = (
  p: React.PropsWithChildren<{id: T.Chat.ConversationIDKey; seedFromCache?: boolean}>
) => {
  const {children, id, seedFromCache = true} = p
  const [cachedSnapshot, setCachedSnapshot] = React.useState(() =>
    seedFromCache && !ConvoState.getConvoState(id).loaded
      ? getConversationThreadCacheSnapshot(id)
      : undefined
  )
  return (
    <ConversationThreadIDContext value={id}>
      <ConversationThreadCacheContext value={cachedSnapshot}>
        <ConversationThreadCacheSync id={id} clearCachedSnapshot={setCachedSnapshot} />
        {children}
      </ConversationThreadCacheContext>
    </ConversationThreadIDContext>
  )
}

export const useConversationThreadLoaded = () =>
  useConversationThreadSnapshotValue(snapshot => snapshot.loaded)

export const useConversationThreadLastOrdinal = () =>
  useConversationThreadSnapshotValue(
    snapshot => snapshot.messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
  )

export const useConversationThreadMessage = (ordinal: T.Chat.Ordinal) =>
  useConversationThreadSnapshotValue(snapshot => snapshot.messageMap.get(ordinal))

export const useConversationThreadMessageMap = () =>
  useConversationThreadSnapshotValue(snapshot =>
    snapshot.messageMap.size === 0 ? emptyMessageMap : snapshot.messageMap
  )

export const useConversationThreadMessageOrdinals = () =>
  useConversationThreadSnapshotValue(snapshot => snapshot.messageOrdinals ?? noOrdinals)

export const useConversationThreadMessageOrdinalsMaybe = () =>
  useConversationThreadSnapshotValue(snapshot => snapshot.messageOrdinals)

export const useConversationThreadMessageType = (ordinal: T.Chat.Ordinal) =>
  useConversationThreadSnapshotValue(snapshot => snapshot.messageTypeMap.get(ordinal) ?? 'text')

export const useConversationThreadMessageTypeMap = () =>
  useConversationThreadSnapshotValue(snapshot =>
    snapshot.messageTypeMap.size === 0 ? emptyMessageTypeMap : snapshot.messageTypeMap
  )

export const useConversationThreadPagination = () =>
  useConversationThreadSnapshotValue(
    C.useShallow(snapshot => ({
      loaded: snapshot.loaded,
      moreToLoadBack: snapshot.moreToLoadBack,
      moreToLoadForward: snapshot.moreToLoadForward,
    }))
  )

export const useConversationThreadListData = () => {
  const conversationIDKey = useConversationThreadID()
  const data = useConversationThreadSnapshotValue(
    C.useShallow(snapshot => ({
      containsLatestMessage: !snapshot.moreToLoadForward,
      loaded: snapshot.loaded,
      messageOrdinals: snapshot.messageOrdinals ?? noOrdinals,
    }))
  )
  return {...data, conversationIDKey}
}

export const useConversationThreadLoadMoreMessages = () => {
  const conversationIDKey = useConversationThreadID()
  return ConvoState.useConvoState(
    conversationIDKey,
    (s): LoadMoreMessages => s.dispatch.loadMoreMessages
  )
}

const useConversationThreadMessagesClear = () => {
  const conversationIDKey = useConversationThreadID()
  const messagesClear: MessagesClear = () => {
    deleteConversationThreadCacheSnapshot(conversationIDKey)
    ConvoState.getConvoState(conversationIDKey).dispatch.messagesClear()
  }
  return messagesClear
}

export const useConversationThreadLoadOlderMessagesDueToScroll = () => {
  const {moreToLoadBack} = useConversationThreadPagination()
  const loadMoreMessages = useConversationThreadLoadMoreMessages()
  const okToLoadMore = useScrollLoadGate()

  const loadOlderMessagesDueToScroll: LoadOlderMessagesDueToScroll = (numOrdinals, options) => {
    if (!moreToLoadBack) {
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
      numberOfMessagesToLoad: ConvoState.numMessagesOnScrollback,
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
      numberOfMessagesToLoad: ConvoState.numMessagesOnScrollback,
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
        num: ConvoState.numMessagesOnInitialLoad,
        pivot: messageID,
      },
      ...(options ?? {}),
      reason: 'centered',
    })
  }
  return loadMessagesCentered
}

export const useConversationThreadJumpToRecent = () => {
  const conversationIDKey = useConversationThreadID()
  const loadMoreMessages = useConversationThreadLoadMoreMessages()

  const jumpToRecent: JumpToRecent = options => {
    ConvoState.clearConvoStateValidatedOrdinalRange(conversationIDKey)
    loadMoreMessages({...(options ?? {}), reason: 'jump to recent'})
  }
  return jumpToRecent
}

export const useConversationThreadMarkThreadAsRead = () => {
  const conversationIDKey = useConversationThreadID()
  return ConvoState.useConvoState(conversationIDKey, s => s.dispatch.markThreadAsRead)
}

export const useConversationThreadSelectedConversation = () => {
  const conversationIDKey = useConversationThreadID()
  const loadMoreMessages = useConversationThreadLoadMoreMessages()

  const selectedConversation: SelectedConversation = (options?: SelectedConversationOptions) => {
    const {skipThreadLoad, ...loadStatusOptions} = options ?? {}
    clearChatTimeCache()

    const state = ConvoState.getConvoState(conversationIDKey)
    const participantInfo = state.participants
    const force = !state.isMetaGood() || participantInfo.all.length === 0
    ConvoState.unboxRows([conversationIDKey], force)

    const username = useCurrentUserState.getState().username
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

export const useConversationThreadToggleSearch = () => {
  const conversationIDKey = useConversationThreadID()
  return ConvoState.useConvoState(conversationIDKey, s => s.dispatch.toggleThreadSearch)
}
