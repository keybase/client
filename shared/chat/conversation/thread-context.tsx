import * as C from '@/constants'
import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as ConvoState from '@/stores/convostate'
import * as Meta from '@/constants/chat/meta'
import * as React from 'react'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import {navigateToInbox} from '@/constants/router'
import logger from '@/logger'
import throttle from 'lodash/throttle'
import {clearChatTimeCache} from '@/util/timestamp'
import {enumKeys, ignorePromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'
import {useEngineActionListener} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import {useConfigState} from '@/stores/config'
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
type LoadMoreMessagesParams = Parameters<LoadMoreMessages>[0]
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
type ScrollDirection = 'none' | 'back' | 'forward'
type ConversationThreadActions = {
  loadMoreMessages: LoadMoreMessages
  messagesClear: MessagesClear
}

const ConversationThreadActionsContext = React.createContext<ConversationThreadActions | undefined>(
  undefined
)

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

const useConversationThreadActions = () => {
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

const reasonToRPCReason = (reason: string): T.RPCChat.GetThreadReason => {
  switch (reason) {
    case 'extension':
    case 'push':
      return T.RPCChat.GetThreadReason.push
    case 'foregrounding':
      return T.RPCChat.GetThreadReason.foreground
    default:
      return T.RPCChat.GetThreadReason.general
  }
}

const loadThreadMessageTypes = enumKeys(T.RPCChat.MessageType).reduce<Array<T.RPCChat.MessageType>>(
  (arr, key) => {
    switch (key) {
      case 'none':
      case 'edit':
      case 'delete':
      case 'attachmentuploaded':
      case 'reaction':
      case 'unfurl':
      case 'tlfname':
        break
      default:
        {
          const val = T.RPCChat.MessageType[key]
          if (typeof val === 'number') {
            arr.push(val)
          }
        }
        break
    }

    return arr
  },
  []
)

const scrollDirectionToPagination = (
  scrollDirection: ScrollDirection,
  numberOfMessagesToLoad: number
) => {
  const pagination = {
    last: false,
    next: '',
    num: numberOfMessagesToLoad,
    previous: '',
  }
  switch (scrollDirection) {
    case 'none':
      break
    case 'back':
      pagination.next = 'deadbeef'
      break
    case 'forward':
      pagination.previous = 'deadbeef'
  }
  return pagination
}

const getCurrentUser = () => {
  const s = useCurrentUserState.getState()
  return {devicename: s.deviceName, username: s.username}
}

const getLastOrdinal = (conversationIDKey: T.Chat.ConversationIDKey) =>
  ConvoState.getConvoState(conversationIDKey).messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)

const applyMessagesUpdatedToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messagesUpdated: T.RPCChat.MessagesUpdated
) => {
  if (!messagesUpdated.updates) return
  const state = ConvoState.getConvoState(conversationIDKey)
  const activelyLookingAtThread = Common.isUserActivelyLookingAtThisThread(conversationIDKey)
  if (!state.loaded && !activelyLookingAtThread) {
    return
  }

  const {username, devicename} = getCurrentUser()
  const messages = messagesUpdated.updates.flatMap(uimsg => {
    if (!Message.getMessageID(uimsg)) return []
    const message = Message.uiMessageToMessage(
      conversationIDKey,
      uimsg,
      username,
      () => getLastOrdinal(conversationIDKey),
      devicename
    )
    return message ? [message] : []
  })
  if (messages.length === 0) {
    return
  }
  ConvoState.addMessagesToThreadCompat(conversationIDKey, messages, {
    markAsRead: activelyLookingAtThread,
  })
}

const applyReactionUpdateToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  reactionUpdate: T.RPCChat.ReactionUpdateNotif
) => {
  if (!reactionUpdate.reactionUpdates || reactionUpdate.reactionUpdates.length === 0) {
    return
  }
  const updates = reactionUpdate.reactionUpdates.map(ru => ({
    reactions: Message.reactionMapToReactions(ru.reactions),
    targetMsgID: T.Chat.numberToMessageID(ru.targetMsgID),
  }))
  ConvoState.getConvoState(conversationIDKey).dispatch.updateReactions(updates)
}

const applyExpungeToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  expunge: T.RPCChat.ExpungeInfo
) => {
  const deletableMessageTypes =
    useConfigState.getState().chatDeletableByDeleteHistory || Common.allMessageTypes
  ConvoState.getConvoState(conversationIDKey).dispatch.messagesWereDeleted({
    deletableMessageTypes,
    upToMessageID: T.Chat.numberToMessageID(expunge.expunge.upto),
  })
}

const applyEphemeralPurgeToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  ephemeralPurge: T.RPCChat.EphemeralPurgeNotifInfo
) => {
  const messageIDs = ephemeralPurge.msgs?.reduce<Array<T.Chat.MessageID>>((arr, msg) => {
    const msgID = Message.getMessageID(msg)
    if (msgID) {
      arr.push(msgID)
    }
    return arr
  }, [])
  if (messageIDs) {
    ConvoState.getConvoState(conversationIDKey).dispatch.messagesExploded(messageIDs)
  }
}

const loadConversationThreadMessages = (
  conversationIDKey: T.Chat.ConversationIDKey,
  p: LoadMoreMessagesParams
) => {
  const state = ConvoState.getConvoState(conversationIDKey)
  if (!T.Chat.isValidConversationIDKey(state.id)) {
    return
  }
  const {scrollDirection = 'none', numberOfMessagesToLoad = ConvoState.numMessagesOnInitialLoad} = p
  const {reason, messageIDControl, knownRemotes, centeredMessageID, isThreadLoadCurrent, onThreadLoadStatus} =
    p
  const isCurrentThreadLoad = () => isThreadLoadCurrent?.() ?? true

  const f = async () => {
    if (!isCurrentThreadLoad()) {
      logger.info('loadMoreMessages: bail: stale mounted thread load')
      return
    }

    if (!conversationIDKey || !T.Chat.isValidConversationIDKey(conversationIDKey)) {
      logger.info('loadMoreMessages: bail: no conversationIDKey')
      return
    }

    const currentState = ConvoState.getConvoState(conversationIDKey)
    if (currentState.meta.membershipType === 'youAreReset' || currentState.meta.rekeyers.size > 0) {
      logger.info('loadMoreMessages: bail: we are reset')
      return
    }
    logger.info(
      `loadMoreMessages: calling rpc convo: ${conversationIDKey} num: ${numberOfMessagesToLoad} reason: ${reason}`
    )

    const loadingKey = Strings.waitingKeyChatThreadLoad(conversationIDKey)
    const convID = currentState.getConvID()
    let reconciled = false
    const onGotThread = (thread: string, why: string) => {
      if (!thread) {
        return
      }
      if (!isCurrentThreadLoad()) {
        logger.info(`loadMoreMessages: stale response ignored: ${why}`)
        return
      }

      if (!ConvoState.getConvoState(conversationIDKey).loaded) {
        ConvoState.setThreadLoadedCompat(conversationIDKey, true)
      }

      const {username, devicename} = getCurrentUser()
      const uiMessages = JSON.parse(thread) as T.RPCChat.UIMessages

      const messages = (uiMessages.messages ?? []).reduce<Array<T.Chat.Message>>((arr, m) => {
        const message = Message.uiMessageToMessage(
          conversationIDKey,
          m,
          username,
          () => getLastOrdinal(conversationIDKey),
          devicename
        )
        if (message) {
          arr.push(message)
        }
        return arr
      }, [])

      const moreToLoad = uiMessages.pagination ? !uiMessages.pagination.last : true
      ConvoState.setThreadPaginationCompat(
        conversationIDKey,
        scrollDirection,
        moreToLoad,
        !!centeredMessageID
      )

      if (messages.length) {
        let validatedRange: {from: T.Chat.Ordinal; to: T.Chat.Ordinal} | undefined
        if (scrollDirection === 'none' && !reconciled) {
          const ords = messages
            .filter(m => m.conversationMessage !== false && m.type !== 'deleted')
            .map(m => m.ordinal)
          if (ords.length > 0) {
            validatedRange = {
              from: Math.min(...ords) as T.Chat.Ordinal,
              to: Math.max(...ords) as T.Chat.Ordinal,
            }
          }
          reconciled = true
        }
        ConvoState.addMessagesToThreadCompat(conversationIDKey, messages, {validatedRange})
      }

      const isUserNavigation =
        reason !== 'findNewestConversation' &&
        reason !== 'findNewestConversationFromLayout' &&
        reason !== 'tab selected'
      if (isUserNavigation) {
        ConvoState.getConvoState(conversationIDKey).dispatch.markThreadAsRead(true)
      }
    }

    const pagination = messageIDControl
      ? null
      : scrollDirectionToPagination(scrollDirection, numberOfMessagesToLoad)
    try {
      const results = await T.RPCChat.localGetThreadNonblockRpcListener({
        incomingCallMap: {
          'chat.1.chatUi.chatThreadCached': p => onGotThread(p.thread || '', 'cached'),
          'chat.1.chatUi.chatThreadFull': p => onGotThread(p.thread || '', 'full'),
          'chat.1.chatUi.chatThreadStatus': p => {
            logger.info(
              `loadMoreMessages: thread status received: convID: ${conversationIDKey} typ: ${p.status.typ}`
            )
            if (isCurrentThreadLoad()) {
              onThreadLoadStatus?.(conversationIDKey, p.status.typ)
            }
          },
        },
        params: {
          cbMode: T.RPCChat.GetThreadNonblockCbMode.incremental,
          conversationID: convID,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          knownRemotes,
          pagination,
          pgmode: T.RPCChat.GetThreadNonblockPgMode.server,
          query: {
            disablePostProcessThread: false,
            disableResolveSupersedes: false,
            enableDeletePlaceholders: true,
            markAsRead: false,
            messageIDControl,
            messageTypes: loadThreadMessageTypes,
          },
          reason: reasonToRPCReason(reason),
        },
        waitingKey: loadingKey,
      })
      if (!isCurrentThreadLoad()) {
        return
      }
      if (ConvoState.getConvoState(conversationIDKey).isMetaGood()) {
        ConvoState.setThreadOfflineCompat(conversationIDKey, results.offline)
      }
    } catch (error) {
      if (!isCurrentThreadLoad()) {
        return
      }
      if (error instanceof RPCError) {
        logger.warn(`loadMoreMessages: error: ${error.desc}`)
        if (error.code === T.RPCGen.StatusCode.scchatnotinteam) {
          navigateToInbox(true, 'maybeKickedFromTeam')
        }
        if (error.code !== T.RPCGen.StatusCode.scteamreaderror) {
          throw error
        }
      }
    }
  }

  ignorePromise(f())
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
  const [threadActions] = React.useState<ConversationThreadActions>(() => {
    const loadMoreMessages: LoadMoreMessages = throttle((p: LoadMoreMessagesParams) => {
      loadConversationThreadMessages(id, p)
    }, 500)
    return {
      loadMoreMessages,
      messagesClear: () => {
        deleteConversationThreadCacheSnapshot(id)
        ConvoState.clearThreadMessagesCompat(id)
      },
    }
  })
  React.useEffect(() => {
    return () => {
      threadActions.loadMoreMessages.cancel()
    }
  }, [threadActions])
  useEngineActionListener('chat.1.NotifyChat.NewChatActivity', action => {
    const {activity} = action.payload.params
    switch (activity.activityType) {
      case T.RPCChat.ChatActivityType.messagesUpdated: {
        const {messagesUpdated} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(messagesUpdated.convID)
        if (conversationIDKey === id) {
          applyMessagesUpdatedToThread(conversationIDKey, messagesUpdated)
        }
        break
      }
      case T.RPCChat.ChatActivityType.reactionUpdate: {
        const {reactionUpdate} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(reactionUpdate.convID)
        if (conversationIDKey === id) {
          applyReactionUpdateToThread(conversationIDKey, reactionUpdate)
        }
        break
      }
      case T.RPCChat.ChatActivityType.expunge: {
        const {expunge} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(expunge.convID)
        if (conversationIDKey === id) {
          applyExpungeToThread(conversationIDKey, expunge)
        }
        break
      }
      case T.RPCChat.ChatActivityType.ephemeralPurge: {
        const {ephemeralPurge} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(ephemeralPurge.convID)
        if (conversationIDKey === id) {
          applyEphemeralPurgeToThread(conversationIDKey, ephemeralPurge)
        }
        break
      }
      default:
    }
  })

  return (
    <ConversationThreadIDContext value={id}>
      <ConversationThreadActionsContext value={threadActions}>
        <ConversationThreadCacheContext value={cachedSnapshot}>
          <ConversationThreadCacheSync id={id} clearCachedSnapshot={setCachedSnapshot} />
          {children}
        </ConversationThreadCacheContext>
      </ConversationThreadActionsContext>
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
  const {loadMoreMessages} = useConversationThreadActions()
  return loadMoreMessages
}

const useConversationThreadMessagesClear = () => {
  const {messagesClear} = useConversationThreadActions()
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
