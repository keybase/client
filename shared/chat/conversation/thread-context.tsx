import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import * as T from '@/constants/types'
import {
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

type ThreadLoadStatusOptions = {
  onThreadLoadStatus?: ConvoState.ThreadLoadStatusReporter
}

type SelectedConversationOptions = ThreadLoadStatusOptions & {
  skipThreadLoad?: boolean
}

export const useConversationThreadID = () => {
  const conversationIDKey = React.useContext(ConversationThreadIDContext)
  if (!conversationIDKey) {
    throw new Error('Missing ConversationThreadProvider in the tree')
  }
  return conversationIDKey
}

const useCachedSnapshot = () => React.useContext(ConversationThreadCacheContext)

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
  return ConvoState.useConvoState(conversationIDKey, s => s.dispatch.loadMoreMessages)
}

export const useConversationThreadLoadOlderMessagesDueToScroll = () => {
  const conversationIDKey = useConversationThreadID()
  return ConvoState.useConvoState(conversationIDKey, s => s.dispatch.loadOlderMessagesDueToScroll)
}

export const useConversationThreadLoadNewerMessagesDueToScroll = () => {
  const conversationIDKey = useConversationThreadID()
  return ConvoState.useConvoState(conversationIDKey, s => s.dispatch.loadNewerMessagesDueToScroll)
}

export const useConversationThreadLoadMessagesCentered = () => {
  const conversationIDKey = useConversationThreadID()
  return ConvoState.useConvoState(conversationIDKey, s => s.dispatch.loadMessagesCentered)
}

export const useConversationThreadJumpToRecent = () => {
  const conversationIDKey = useConversationThreadID()
  return ConvoState.useConvoState(conversationIDKey, s => s.dispatch.jumpToRecent)
}

export const useConversationThreadMarkThreadAsRead = () => {
  const conversationIDKey = useConversationThreadID()
  return ConvoState.useConvoState(conversationIDKey, s => s.dispatch.markThreadAsRead)
}

export const useConversationThreadSelectedConversation = () => {
  const conversationIDKey = useConversationThreadID()
  return ConvoState.useConvoState(
    conversationIDKey,
    (s): ((options?: SelectedConversationOptions) => void) => s.dispatch.selectedConversation
  )
}

export const useConversationThreadToggleSearch = () => {
  const conversationIDKey = useConversationThreadID()
  return ConvoState.useConvoState(conversationIDKey, s => s.dispatch.toggleThreadSearch)
}
