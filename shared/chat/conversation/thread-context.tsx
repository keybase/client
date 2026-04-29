import * as C from '@/constants'
import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as TeamsUtil from '@/constants/teams'
import * as React from 'react'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import {
  getVisibleScreen,
  navigateAppend,
  navigateToInbox,
  navigateToThread,
  navigateUp,
  setChatRootParams,
} from '@/constants/router'
import {isMobile, isPhone} from '@/constants/platform'
import logger from '@/logger'
import throttle from 'lodash/throttle'
import type {DebouncedFunc} from 'lodash'
import {clearChatTimeCache} from '@/util/timestamp'
import {findLast} from '@/util/arrays'
import {enumKeys, ignorePromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'
import {uint8ArrayToString} from '@/util/uint8array'
import {useEngineActionListener} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import {useConfigState} from '@/stores/config'
import {produce, type Draft} from 'immer'
import {useStore} from 'zustand'
import {createStore, type StoreApi} from 'zustand/vanilla'
import {
  deleteConversationThreadCacheSnapshot,
  getConversationThreadCacheSnapshot,
  putConversationThreadCacheSnapshot,
  type ConversationThreadSnapshot,
} from './thread-cache'
import {
  addMessagesToThreadState,
  applyOptimisticReactionsToMessage,
  completeAttachmentDownloadInThreadState,
  cloneMessageWithImmer,
  cloneStoreObjectWithImmer,
  clearOptimisticReactionsForUpdatesInThreadState,
  clearOptimisticReactionsForMessagesInThreadState,
  deleteMessagesFromThreadState,
  explodeMessagesInThreadState,
  failAttachmentDownloadInThreadState,
  finishAttachmentDownloadInThreadState,
  getOrdinalForMessageID,
  type OptimisticReaction,
  retryMessageInThreadState,
  setMessageSubmitStateInThreadState,
  setMessageErroredInThreadState,
  setAttachmentMobileSavingInThreadState,
  startAttachmentDownloadInThreadState,
  updateAttachmentDownloadProgressInThreadState,
  updateAttachmentUploadProgressInThreadState,
  updateReactionsInThreadState,
} from './thread-message-state'
import {
  getInboxConversationMeta,
  getInboxConversationParticipants,
  metasReceived,
  participantInfoReceived,
  unboxRows,
  useInboxMetadataState,
} from '@/chat/inbox/metadata'

const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []
const emptyAccountsInfoMap: ReadonlyMap<
  T.RPCChat.MessageID,
  T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo
> = new Map()
const emptyFlipStatusMap: ReadonlyMap<string, T.RPCChat.UICoinFlipStatus> = new Map()
const emptyMessageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message> = new Map()
const emptyMessageTypeMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.RenderMessageType> = new Map()
const emptyPaymentStatusMap: ReadonlyMap<T.Wallets.PaymentID, T.Chat.ChatPaymentInfo> = new Map()
const emptyUnfurlPromptMap: ReadonlyMap<T.Chat.MessageID, ReadonlySet<string>> = new Map()
const emptyStringSet: ReadonlySet<string> = new Set()
const numMessagesOnInitialLoad = isMobile ? 20 : 100
const numMessagesOnScrollback = 100

const sameStringSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
  if (a.size !== b.size) {
    return false
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false
    }
  }
  return true
}

const ignoreErrors = [
  T.RPCGen.StatusCode.scgenericapierror,
  T.RPCGen.StatusCode.scapinetworkerror,
  T.RPCGen.StatusCode.sctimeout,
]

const makeEmptyParticipantInfo = (): T.Chat.ParticipantInfo =>
  produce(
    {
      all: [] as Array<string>,
      contactName: new Map<string, string>(),
      name: [] as Array<string>,
    },
    () => {}
  )

const copyParticipantInfo = (participants: T.Chat.ParticipantInfo): T.Chat.ParticipantInfo =>
  produce(
    {
      all: [...participants.all],
      contactName: new Map(participants.contactName),
      name: [...participants.name],
    },
    () => {}
  )

const copyConversationMeta = (meta: T.Chat.ConversationMeta): T.Chat.ConversationMeta =>
  produce(
    {
      ...meta,
      rekeyers: new Set(meta.rekeyers),
      resetParticipants: new Set(meta.resetParticipants),
    },
    () => {}
  )

const cloneMapWithImmer = <K, V>(map: ReadonlyMap<K, V>): Map<K, V> => {
  const next = new Map<K, V>()
  for (const [key, value] of map) {
    next.set(key, cloneStoreObjectWithImmer(value) as V)
  }
  return next
}

const cloneMessageMapWithImmer = (
  map: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>
): Map<T.Chat.Ordinal, T.Chat.Message> => {
  const next = new Map<T.Chat.Ordinal, T.Chat.Message>()
  for (const [ordinal, message] of map) {
    next.set(ordinal, cloneMessageWithImmer(message, ordinal))
  }
  return next
}

const cloneUnfurlPromptMapWithImmer = (
  map: ReadonlyMap<T.Chat.MessageID, ReadonlySet<string>>
): Map<T.Chat.MessageID, Set<string>> => {
  const next = new Map<T.Chat.MessageID, Set<string>>()
  for (const [messageID, domains] of map) {
    next.set(messageID, new Set(domains))
  }
  return next
}

const getExplodingModeFromGregorItems = (
  conversationIDKey: T.Chat.ConversationIDKey,
  items: ReadonlyArray<{item: T.RPCGen.Gregor1.Item}>
) => {
  const explodingItems = items.filter(i => i.item.category.startsWith(Common.explodingModeGregorKeyPrefix))
  if (!explodingItems.length) {
    return 0
  }
  const category = `${Common.explodingModeGregorKeyPrefix}${conversationIDKey}`
  const item = explodingItems.find(i => i.item.category === category)
  if (!item) {
    return undefined
  }
  const secondsString = uint8ArrayToString(item.item.body)
  const seconds = parseInt(secondsString, 10)
  if (isNaN(seconds)) {
    logger.warn(`Got dirty exploding mode ${secondsString} for category ${category}`)
    return undefined
  }
  return seconds
}

const getExplodingModeFromConfig = (conversationIDKey: T.Chat.ConversationIDKey) =>
  getExplodingModeFromGregorItems(conversationIDKey, useConfigState.getState().gregorPushState) ?? 0

const persistExplodingMode = (
  conversationIDKey: T.Chat.ConversationIDKey,
  meta: T.Chat.ConversationMeta,
  seconds: number
) => {
  const f = async () => {
    logger.info(`Setting exploding mode for conversation ${conversationIDKey} to ${seconds}`)
    const category = `${Common.explodingModeGregorKeyPrefix}${conversationIDKey}`
    const convRetention = Meta.getEffectiveRetentionPolicy(meta)
    try {
      if (seconds === 0 || seconds === convRetention.seconds) {
        await T.RPCGen.gregorDismissCategoryRpcPromise({category})
      } else {
        await T.RPCGen.gregorUpdateCategoryRpcPromise({
          body: seconds.toString(),
          category,
          dtime: {offset: 0, time: 0},
        })
        logger.info(`Successfully set exploding mode for conversation ${conversationIDKey} to ${seconds}`)
      }
    } catch (error) {
      if (error instanceof RPCError) {
        if (seconds !== 0) {
          logger.error(
            `Failed to set exploding mode for conversation ${conversationIDKey} to ${seconds}. Service responded with: ${error.message}`
          )
        } else {
          logger.error(
            `Failed to unset exploding mode for conversation ${conversationIDKey}. Service responded with: ${error.message}`
          )
        }
        if (ignoreErrors.includes(error.code)) {
          return
        }
      }
      throw error
    }
  }
  ignorePromise(f())
}

const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')

const getClientPrevFromSnapshot = (snapshot: ConversationThreadState): T.Chat.MessageID => {
  const ordinal = findLast(snapshot.messageOrdinals ?? [], o => {
    const m = snapshot.messageMap.get(o)
    return !!m?.id
  })
  const message = ordinal ? snapshot.messageMap.get(ordinal) : undefined
  return message?.id || T.Chat.numberToMessageID(0)
}

const ConversationThreadIDContext = React.createContext<T.Chat.ConversationIDKey | undefined>(undefined)
ConversationThreadIDContext.displayName = 'ConversationThreadIDContext'

export type ConversationThreadState = {
  accountsInfoMap: Map<T.RPCChat.MessageID, T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo>
  explodingMode: number
  flipStatusMap: Map<string, T.RPCChat.UICoinFlipStatus>
  loaded: boolean
  liveUpdateVersion: number
  meta: T.Chat.ConversationMeta
  messageIDToOrdinal: Map<T.Chat.MessageID, T.Chat.Ordinal>
  messageMap: Map<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>
  messageTypeMap: Map<T.Chat.Ordinal, T.Chat.RenderMessageType>
  moreToLoadBack: boolean
  moreToLoadForward: boolean
  optimisticReactionMap: Map<T.Chat.OutboxID, OptimisticReaction>
  paymentStatusMap: Map<T.Wallets.PaymentID, T.Chat.ChatPaymentInfo>
  participants: T.Chat.ParticipantInfo
  pendingOutboxToOrdinal: Map<T.Chat.OutboxID, T.Chat.Ordinal>
  typing: Set<string>
  unfurlPrompt: Map<T.Chat.MessageID, Set<string>>
  validatedOrdinalRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}
}

type ConversationThreadStore = StoreApi<ConversationThreadState>
const ConversationThreadStoreContext = React.createContext<ConversationThreadStore | undefined>(undefined)
ConversationThreadStoreContext.displayName = 'ConversationThreadStoreContext'

const makeEmptyThreadState = (): ConversationThreadState =>
  produce(
    {
      accountsInfoMap: new Map<T.RPCChat.MessageID, T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo>(),
      explodingMode: 0,
      flipStatusMap: new Map<string, T.RPCChat.UICoinFlipStatus>(),
      liveUpdateVersion: 0,
      loaded: false,
      messageIDToOrdinal: new Map<T.Chat.MessageID, T.Chat.Ordinal>(),
      messageMap: new Map<T.Chat.Ordinal, T.Chat.Message>(),
      messageOrdinals: undefined as ReadonlyArray<T.Chat.Ordinal> | undefined,
      messageTypeMap: new Map<T.Chat.Ordinal, T.Chat.RenderMessageType>(),
      meta: copyConversationMeta(Meta.makeConversationMeta()),
      moreToLoadBack: false,
      moreToLoadForward: false,
      optimisticReactionMap: new Map<T.Chat.OutboxID, OptimisticReaction>(),
      participants: makeEmptyParticipantInfo(),
      paymentStatusMap: new Map<T.Wallets.PaymentID, T.Chat.ChatPaymentInfo>(),
      pendingOutboxToOrdinal: new Map<T.Chat.OutboxID, T.Chat.Ordinal>(),
      typing: new Set<string>(),
      unfurlPrompt: new Map<T.Chat.MessageID, Set<string>>(),
      validatedOrdinalRange: undefined as {from: T.Chat.Ordinal; to: T.Chat.Ordinal} | undefined,
    },
    () => {}
  )

const snapshotToThreadState = (
  snapshot: ConversationThreadSnapshot | undefined
): ConversationThreadState =>
  snapshot
    ? produce(
        {
          accountsInfoMap: cloneMapWithImmer(snapshot.accountsInfoMap),
          explodingMode: snapshot.explodingMode,
          flipStatusMap: cloneMapWithImmer(snapshot.flipStatusMap),
          liveUpdateVersion: 0,
          loaded: snapshot.loaded,
          messageIDToOrdinal: produce(new Map(snapshot.messageIDToOrdinal), () => {}),
          messageMap: cloneMessageMapWithImmer(snapshot.messageMap),
          messageOrdinals: snapshot.messageOrdinals
            ? produce([...snapshot.messageOrdinals], () => {})
            : undefined,
          messageTypeMap: produce(new Map(snapshot.messageTypeMap), () => {}),
          meta: copyConversationMeta(snapshot.meta),
          moreToLoadBack: snapshot.moreToLoadBack,
          moreToLoadForward: snapshot.moreToLoadForward,
          optimisticReactionMap: produce(new Map<T.Chat.OutboxID, OptimisticReaction>(), () => {}),
          participants: copyParticipantInfo(snapshot.participants),
          paymentStatusMap: cloneMapWithImmer(snapshot.paymentStatusMap),
          pendingOutboxToOrdinal: produce(new Map(snapshot.pendingOutboxToOrdinal), () => {}),
          typing: produce(new Set<string>(), () => {}),
          unfurlPrompt: cloneUnfurlPromptMapWithImmer(snapshot.unfurlPrompt),
          validatedOrdinalRange: snapshot.validatedOrdinalRange
            ? produce({...snapshot.validatedOrdinalRange}, () => {})
            : undefined,
        },
        () => {}
      )
    : makeEmptyThreadState()

const makeInitialThreadState = (id: T.Chat.ConversationIDKey, seedFromCache: boolean) => {
  const snapshot = seedFromCache ? getConversationThreadCacheSnapshot(id) : undefined
  const meta = getInboxConversationMeta(id)
  const participants = getInboxConversationParticipants(id)
  return produce(snapshotToThreadState(snapshot), s => {
    if (meta) {
      s.meta = T.castDraft(copyConversationMeta(meta))
    }
    if (participants) {
      s.participants = T.castDraft(copyParticipantInfo(participants))
    }
    s.explodingMode = getExplodingModeFromConfig(id)
  })
}

const makeThreadStore = (id: T.Chat.ConversationIDKey, seedFromCache: boolean) =>
  createStore<ConversationThreadState>(() => makeInitialThreadState(id, seedFromCache))

const threadStateToSnapshot = (state: ConversationThreadState): ConversationThreadSnapshot =>
  produce(
    {
      accountsInfoMap: cloneMapWithImmer(state.accountsInfoMap),
      explodingMode: state.explodingMode,
      flipStatusMap: cloneMapWithImmer(state.flipStatusMap),
      loaded: state.loaded,
      messageIDToOrdinal: produce(new Map(state.messageIDToOrdinal), () => {}),
      messageMap: cloneMessageMapWithImmer(state.messageMap),
      messageOrdinals: state.messageOrdinals ? produce([...state.messageOrdinals], () => {}) : undefined,
      messageTypeMap: produce(new Map(state.messageTypeMap), () => {}),
      meta: copyConversationMeta(state.meta),
      moreToLoadBack: state.moreToLoadBack,
      moreToLoadForward: state.moreToLoadForward,
      participants: copyParticipantInfo(state.participants),
      paymentStatusMap: cloneMapWithImmer(state.paymentStatusMap),
      pendingOutboxToOrdinal: produce(new Map(state.pendingOutboxToOrdinal), () => {}),
      unfurlPrompt: cloneUnfurlPromptMapWithImmer(state.unfurlPrompt),
      validatedOrdinalRange: state.validatedOrdinalRange
        ? produce({...state.validatedOrdinalRange}, () => {})
        : undefined,
    },
    () => {}
  )

export type ThreadLoadStatusOptions = {
  isThreadLoadCurrent?: () => boolean
  onThreadLoadStatus?: ThreadLoadStatusReporter
}

type SelectedConversationOptions = ThreadLoadStatusOptions & {
  skipThreadLoad?: boolean
}

type ScrollDirection = 'none' | 'back' | 'forward'
type LoadMoreMessagesParams = ThreadLoadStatusOptions & {
  centeredMessageID?: {
    conversationIDKey: T.Chat.ConversationIDKey
    highlightMode: T.Chat.CenterOrdinalHighlightMode
    messageID: T.Chat.MessageID
  }
  forceContainsLatestCalc?: boolean
  knownRemotes?: ReadonlyArray<string>
  messageIDControl?: T.RPCChat.MessageIDControl | null
  numberOfMessagesToLoad?: number
  reason: string
  scrollDirection?: ScrollDirection
}
type LoadMoreMessages = DebouncedFunc<(p: LoadMoreMessagesParams) => void>
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
type SelectedConversation = (options?: SelectedConversationOptions) => void
type ConversationThreadActions = {
  addMessages: (
    messages: ReadonlyArray<T.Chat.Message>,
    opt?: {
      liveUpdate?: boolean
      markAsRead?: boolean
      validatedRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}
    }
  ) => void
  applyThreadLoad: (p: {
    centered: boolean
    messages: ReadonlyArray<T.Chat.Message>
    moreToLoad: boolean
    scrollDirection: ScrollDirection
    validatedRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}
  }) => void
  clearValidatedOrdinalRange: () => void
  clearUnfurlPrompt: (messageID: T.Chat.MessageID, domain: string) => void
  deleteMessages: (p: {
    messageIDs?: ReadonlyArray<T.Chat.MessageID>
    upToMessageID?: T.Chat.MessageID
    deletableMessageTypes?: ReadonlySet<T.Chat.MessageType>
    ordinals?: ReadonlyArray<T.Chat.Ordinal>
    liveUpdate?: boolean
  }) => void
  explodeMessages: (
    messageIDs: ReadonlyArray<T.Chat.MessageID>,
    explodedBy?: string,
    liveUpdate?: boolean
  ) => void
  getSnapshot: () => ConversationThreadState
  loadMoreMessages: LoadMoreMessages
  markThreadAsRead: (force?: boolean) => void
  messageDelete: (ordinal: T.Chat.Ordinal) => void
  messageReplyPrivately: (ordinal: T.Chat.Ordinal) => void
  messagesClear: MessagesClear
  receivePaymentInfo: (messageID: T.Chat.MessageID, paymentInfo: T.Chat.ChatPaymentInfo) => void
  receiveRequestInfo: (messageID: T.Chat.MessageID, requestInfo: T.Chat.ChatRequestInfo) => void
  retryMessage: (outboxID: T.Chat.OutboxID) => void
  setExplodingMode: (seconds: number, incoming?: boolean) => void
  setMeta: (meta?: T.Chat.ConversationMeta) => void
  setMessageErrored: (outboxID: T.Chat.OutboxID, reason: string, errorTyp?: number) => void
  setMessageSubmitState: (ordinal: T.Chat.Ordinal, submitState: T.Chat.Message['submitState']) => void
  setMarkAsUnread: (readMsgID?: T.Chat.MessageID | false) => void
  setParticipants: (participants: T.Chat.ParticipantInfo) => void
  setTyping: (typing: ReadonlySet<string>) => void
  showUnfurlPrompt: (messageID: T.Chat.MessageID, domain: string) => void
  addOptimisticReaction: (outboxID: T.Chat.OutboxID, reaction: OptimisticReaction) => void
  removeOptimisticReaction: (outboxID: T.Chat.OutboxID) => void
  updateOptimisticReactionDecorated: (outboxID: T.Chat.OutboxID, decorated: string) => void
  toggleMessageCollapse: (messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => void
  toggleMessageReaction: (ordinal: T.Chat.Ordinal, emoji: string) => void
  unfurlRemove: (messageID: T.Chat.MessageID) => void
  updateReactions: (
    updates: ReadonlyArray<{targetMsgID: T.Chat.MessageID; reactions?: T.Chat.Reactions}>
  ) => void
  updateCoinFlipStatuses: (statuses: ReadonlyArray<T.RPCChat.UICoinFlipStatus>) => void
  startAttachmentDownload: (ordinal: T.Chat.Ordinal) => void
  finishAttachmentDownload: (ordinal: T.Chat.Ordinal, path: string) => void
  failAttachmentDownload: (ordinal: T.Chat.Ordinal, errMsg: string) => void
  setAttachmentMobileSaving: (ordinal: T.Chat.Ordinal, saving: boolean) => void
  updateAttachmentDownloadProgress: (msgID: number, bytesComplete: number, bytesTotal: number) => void
  completeAttachmentDownload: (msgID: number) => void
  updateAttachmentUploadProgress: (
    outboxID: Uint8Array,
    bytesComplete?: number,
    bytesTotal?: number
  ) => void
  updateMeta: (meta: Partial<T.Chat.ConversationMeta>) => void
}

const ConversationThreadActionsContext = React.createContext<ConversationThreadActions | undefined>(
  undefined
)
ConversationThreadActionsContext.displayName = 'ConversationThreadActionsContext'

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

const reasonToRPCReason = (reason: string): T.RPCChat.GetThreadReason => {
  switch (reason) {
    case 'extension':
    case 'push':
      return T.RPCChat.GetThreadReason.push
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

const getLastOrdinalFromSnapshot = (snapshot: ConversationThreadState) =>
  snapshot.messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)

const getOrdinalForMessageIDInSnapshot = (
  snapshot: ConversationThreadState,
  messageID: T.Chat.MessageID
) =>
  getOrdinalForMessageID(
    snapshot.messageMap,
    snapshot.pendingOutboxToOrdinal,
    messageID,
    snapshot.messageIDToOrdinal
  )

const applyMessagesUpdatedToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messagesUpdated: T.RPCChat.MessagesUpdated,
  actions: ConversationThreadActions
) => {
  if (!messagesUpdated.updates) return
  const snapshot = actions.getSnapshot()
  const activelyLookingAtThread = Common.isUserActivelyLookingAtThisThread(conversationIDKey)
  if (!snapshot.loaded && !activelyLookingAtThread) {
    return
  }

  const {username, devicename} = getCurrentUser()
  const messages = messagesUpdated.updates.flatMap(uimsg => {
    if (!Message.getMessageID(uimsg)) return []
    const message = Message.uiMessageToMessage(
      conversationIDKey,
      uimsg,
      username,
      () => getLastOrdinalFromSnapshot(actions.getSnapshot()),
      devicename
    )
    return message ? [message] : []
  })
  if (messages.length === 0) {
    return
  }
  actions.addMessages(messages, {liveUpdate: true, markAsRead: activelyLookingAtThread})
}

const applyIncomingMutationToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  valid: T.RPCChat.UIMessageValid,
  modifiedMessage: T.RPCChat.UIMessage | null | undefined,
  actions: ConversationThreadActions
) => {
  const body = valid.messageBody
  logger.info(`Got chat incoming message of messageType: ${body.messageType}`)
  const mutationOrdinal = T.Chat.numberToOrdinal(valid.messageID)
  if (actions.getSnapshot().messageMap.has(mutationOrdinal)) {
    actions.deleteMessages({liveUpdate: true, ordinals: [mutationOrdinal]})
  }

  switch (body.messageType) {
    case T.RPCChat.MessageType.edit:
      if (modifiedMessage) {
        const {username, devicename} = getCurrentUser()
        const modMessage = Message.uiMessageToMessage(
          conversationIDKey,
          modifiedMessage,
          username,
          () => getLastOrdinalFromSnapshot(actions.getSnapshot()),
          devicename
        )
        if (modMessage) {
          actions.addMessages([modMessage], {liveUpdate: true})
        }
      }
      return true
    case T.RPCChat.MessageType.delete: {
      const {delete: d} = body
      if (d.messageIDs) {
        const messageIDs = T.Chat.numbersToMessageIDs(d.messageIDs)
        const snapshot = actions.getSnapshot()
        const isExplodeNow = messageIDs.some(id => {
          const ordinal = getOrdinalForMessageIDInSnapshot(snapshot, id)
          const message = ordinal ? snapshot.messageMap.get(ordinal) : undefined
          return !!((message?.type === 'text' || message?.type === 'attachment') && message.exploding)
        })

        if (isExplodeNow) {
          actions.explodeMessages(messageIDs, valid.senderUsername, true)
        } else {
          actions.deleteMessages({liveUpdate: true, messageIDs})
        }
      }
      return true
    }
    default:
      return false
  }
}

const applyIncomingMessageToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  incomingMessage: T.RPCChat.IncomingMessage,
  actions: ConversationThreadActions
) => {
  const snapshot = actions.getSnapshot()
  const activelyLookingAtThread = Common.isUserActivelyLookingAtThisThread(conversationIDKey)
  if (!snapshot.loaded && !activelyLookingAtThread) {
    return
  }
  const {message: cMsg, modifiedMessage} = incomingMessage
  const {username, devicename} = getCurrentUser()

  if (
    cMsg.state === T.RPCChat.MessageUnboxedState.outbox &&
    cMsg.outbox.messageType === T.RPCChat.MessageType.reaction
  ) {
    actions.updateOptimisticReactionDecorated(
      T.Chat.stringToOutboxID(cMsg.outbox.outboxID),
      cMsg.outbox.decoratedTextBody ?? cMsg.outbox.body
    )
    return
  }

  if (cMsg.state === T.RPCChat.MessageUnboxedState.valid) {
    const {valid} = cMsg
    const {messageType} = valid.messageBody
    if (
      (messageType === T.RPCChat.MessageType.edit || messageType === T.RPCChat.MessageType.delete) &&
      applyIncomingMutationToThread(conversationIDKey, valid, modifiedMessage, actions)
    ) {
      return
    }
  }

  const message = Message.uiMessageToMessage(
    conversationIDKey,
    cMsg,
    username,
    () => getLastOrdinalFromSnapshot(actions.getSnapshot()),
    devicename
  )
  if (!message) return

  if (
    cMsg.state === T.RPCChat.MessageUnboxedState.valid &&
    cMsg.valid.messageBody.messageType === T.RPCChat.MessageType.attachmentuploaded &&
    message.type === 'attachment'
  ) {
    const placeholderID = cMsg.valid.messageBody.attachmentuploaded.messageID
    const snapshot = actions.getSnapshot()
    const ordinal = getOrdinalForMessageIDInSnapshot(snapshot, T.Chat.numberToMessageID(placeholderID))
    const existing = ordinal ? snapshot.messageMap.get(ordinal) : undefined
    if (ordinal && existing) {
      actions.addMessages([Message.upgradeMessage(existing, {...message, ordinal})], {
        liveUpdate: true,
        markAsRead: activelyLookingAtThread,
      })
    } else {
      actions.addMessages([message], {liveUpdate: true, markAsRead: activelyLookingAtThread})
    }
  } else {
    if (actions.getSnapshot().moreToLoadForward) {
      return
    }
    actions.addMessages([message], {liveUpdate: true, markAsRead: activelyLookingAtThread})
  }
}

const applyFailedMessageToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  failedMessage: T.RPCChat.FailedMessageInfo,
  actions: ConversationThreadActions
) => {
  const {outboxRecords} = failedMessage
  if (!outboxRecords) return
  for (const outboxRecord of outboxRecords) {
    if (T.Chat.conversationIDToKey(outboxRecord.convID) !== conversationIDKey) {
      continue
    }
    const s = outboxRecord.state
    if (s.state !== T.RPCChat.OutboxStateType.error) {
      continue
    }
    const {error} = s
    const outboxID = T.Chat.rpcOutboxIDToOutboxID(outboxRecord.outboxID)
    actions.setMessageErrored(outboxID, Message.rpcErrorToString(error), error.typ)
  }
}

const applyReactionUpdateToThread = (
  reactionUpdate: T.RPCChat.ReactionUpdateNotif,
  actions: ConversationThreadActions
) => {
  if (!reactionUpdate.reactionUpdates || reactionUpdate.reactionUpdates.length === 0) {
    return
  }
  const updates = reactionUpdate.reactionUpdates.map(ru => ({
    reactions: Message.reactionMapToReactions(ru.reactions),
    targetMsgID: T.Chat.numberToMessageID(ru.targetMsgID),
  }))
  actions.updateReactions(updates)
}

const applyExpungeToThread = (expunge: T.RPCChat.ExpungeInfo, actions: ConversationThreadActions) => {
  const deletableMessageTypes =
    useConfigState.getState().chatDeletableByDeleteHistory || Common.allMessageTypes
  actions.deleteMessages({
    deletableMessageTypes,
    liveUpdate: true,
    upToMessageID: T.Chat.numberToMessageID(expunge.expunge.upto),
  })
}

const applyEphemeralPurgeToThread = (
  ephemeralPurge: T.RPCChat.EphemeralPurgeNotifInfo,
  actions: ConversationThreadActions
) => {
  const messageIDs = ephemeralPurge.msgs?.reduce<Array<T.Chat.MessageID>>((arr, msg) => {
    const msgID = Message.getMessageID(msg)
    if (msgID) {
      arr.push(msgID)
    }
    return arr
  }, [])
  if (messageIDs) {
    actions.explodeMessages(messageIDs, undefined, true)
  }
}

const applyConversationMetaToThread = (
  meta: T.Chat.ConversationMeta | undefined,
  actions: ConversationThreadActions
) => {
  if (!meta) {
    return
  }
  const oldMeta = actions.getSnapshot().meta
  if (oldMeta.conversationIDKey === meta.conversationIDKey) {
    actions.setMeta(Meta.updateMeta(oldMeta, meta))
  } else {
    actions.setMeta(meta)
  }
}

const applyInboxUIItemToThread = (
  conv: T.RPCChat.InboxUIItem | null | undefined,
  actions: ConversationThreadActions
) => {
  if (conv) {
    applyConversationMetaToThread(Meta.inboxUIItemToConversationMeta(conv), actions)
  }
}

const loadConversationThreadMessages = (
  conversationIDKey: T.Chat.ConversationIDKey,
  p: LoadMoreMessagesParams,
  actions: ConversationThreadActions
) => {
  if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
    return
  }
  const {scrollDirection = 'none', numberOfMessagesToLoad = numMessagesOnInitialLoad} = p
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

    const loadStartedSnapshot = actions.getSnapshot()
    const currentMeta = loadStartedSnapshot.meta
    if (currentMeta.membershipType === 'youAreReset' || currentMeta.rekeyers.size > 0) {
      logger.info('loadMoreMessages: bail: we are reset')
      return
    }
    const loadStartedLiveUpdateVersion = loadStartedSnapshot.liveUpdateVersion
    const protectLoadedFocusRefresh =
      loadStartedSnapshot.loaded &&
      scrollDirection === 'none' &&
      !centeredMessageID &&
      !messageIDControl &&
      (reason === 'focused' || reason === 'tab selected')
    logger.info(
      `loadMoreMessages: calling rpc convo: ${conversationIDKey} num: ${numberOfMessagesToLoad} reason: ${reason}`
    )

    const loadingKey = Strings.waitingKeyChatThreadLoad(conversationIDKey)
    const convID = T.Chat.keyToConversationID(conversationIDKey)
    let reconciled = false
    const onGotThread = (thread: string, why: string) => {
      if (!thread) {
        return
      }
      if (!isCurrentThreadLoad()) {
        logger.info(`loadMoreMessages: stale response ignored: ${why}`)
        return
      }
      if (
        protectLoadedFocusRefresh &&
        actions.getSnapshot().liveUpdateVersion !== loadStartedLiveUpdateVersion
      ) {
        logger.info(
          `loadMoreMessages: stale response ignored after live update: ${why} reason=${reason} convID=${conversationIDKey}`
        )
        return
      }

      const {username, devicename} = getCurrentUser()
      const uiMessages = JSON.parse(thread) as T.RPCChat.UIMessages

      const messages = (uiMessages.messages ?? []).reduce<Array<T.Chat.Message>>((arr, m) => {
        const message = Message.uiMessageToMessage(
          conversationIDKey,
          m,
          username,
          () => getLastOrdinalFromSnapshot(actions.getSnapshot()),
          devicename
        )
        if (message) {
          arr.push(message)
        }
        return arr
      }, [])

      const moreToLoad = uiMessages.pagination ? !uiMessages.pagination.last : true
      let validatedRange: {from: T.Chat.Ordinal; to: T.Chat.Ordinal} | undefined
      if (messages.length) {
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
      }
      actions.applyThreadLoad({
        centered: !!centeredMessageID,
        messages,
        moreToLoad,
        scrollDirection,
        validatedRange,
      })

      const isUserNavigation =
        reason !== 'findNewestConversation' &&
        reason !== 'findNewestConversationFromLayout' &&
        reason !== 'scroll back' &&
        reason !== 'tab selected'
      if (isUserNavigation) {
        actions.markThreadAsRead(true)
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
      if (actions.getSnapshot().meta.conversationIDKey === conversationIDKey) {
        actions.updateMeta({offline: results.offline})
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

export const useConversationThreadSnapshotValue = <TValue,>(
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

type ConversationThreadProviderProps = React.PropsWithChildren<{
  id: T.Chat.ConversationIDKey
  seedFromCache?: boolean
}>

type ConversationThreadProviderInnerProps = ConversationThreadProviderProps & {
  registerLive?: boolean
}

type ConversationThreadProviderEntry = {
  actions: ConversationThreadActions
  store: ConversationThreadStore
}

const liveConversationThreadProviders = new Map<T.Chat.ConversationIDKey, ConversationThreadProviderEntry>()
const liveConversationThreadProviderListeners = new Set<() => void>()

const notifyLiveConversationThreadProviderListeners = () => {
  liveConversationThreadProviderListeners.forEach(listener => listener())
}

const subscribeLiveConversationThreadProviders = (listener: () => void) => {
  liveConversationThreadProviderListeners.add(listener)
  return () => {
    liveConversationThreadProviderListeners.delete(listener)
  }
}

const registerLiveConversationThreadProvider = (
  id: T.Chat.ConversationIDKey,
  entry: ConversationThreadProviderEntry
) => {
  liveConversationThreadProviders.set(id, entry)
  notifyLiveConversationThreadProviderListeners()
}

const unregisterLiveConversationThreadProvider = (
  id: T.Chat.ConversationIDKey,
  entry: ConversationThreadProviderEntry
) => {
  if (liveConversationThreadProviders.get(id) === entry) {
    liveConversationThreadProviders.delete(id)
    notifyLiveConversationThreadProviderListeners()
  }
}

const ConversationThreadContextProvider = (p: {
  actions: ConversationThreadActions
  children: React.ReactNode
  id: T.Chat.ConversationIDKey
  store: ConversationThreadStore
}) => (
  <ConversationThreadIDContext value={p.id}>
    <ConversationThreadActionsContext value={p.actions}>
      <ConversationThreadStoreContext value={p.store}>{p.children}</ConversationThreadStoreContext>
    </ConversationThreadActionsContext>
  </ConversationThreadIDContext>
)

const ConversationThreadProviderInner = (p: ConversationThreadProviderInnerProps) => {
  const {children, id, registerLive = false, seedFromCache = true} = p
  const [threadStore] = React.useState(() => makeThreadStore(id, seedFromCache))

  const getSnapshot = React.useEffectEvent(() => threadStore.getState())
  const updateThreadState = React.useEffectEvent(
    (updater: (draft: Draft<ConversationThreadState>) => void) => {
      const current = threadStore.getState()
      const next = produce(current, draft => updater(draft))
      if (current === next) {
        return
      }
      threadStore.setState(next, true)
    }
  )
  const markThreadAsRead = React.useEffectEvent((force?: boolean) => {
    const f = async () => {
      if (!useConfigState.getState().loggedIn) {
        logger.info('mark read bail on not logged in')
        return
      }
      if (!T.Chat.isValidConversationIDKey(id)) {
        logger.info('mark read bail on no selected conversation')
        return
      }
      if (!force && !Common.isUserActivelyLookingAtThisThread(id)) {
        logger.info('mark read bail on not looking at this thread')
        return
      }
      const snapshot = getSnapshot()
      if (snapshot.moreToLoadForward) {
        logger.info('mark read bail on not containing latest message')
        return
      }
      const ordinal = findLast([...(snapshot.messageOrdinals ?? [])], (o: T.Chat.Ordinal) => {
        const m = snapshot.messageMap.get(o)
        return m ? !!m.id : false
      })
      const message = ordinal ? snapshot.messageMap.get(ordinal) : undefined
      const readMsgID = message?.id
      if (snapshot.meta.conversationIDKey === id && readMsgID === snapshot.meta.readMsgID) {
        logger.info(`marking read messages is noop bail: ${id} ${readMsgID}`)
        return
      }
      logger.info(`marking read messages ${id} ${readMsgID}`)
      await T.RPCChat.localMarkAsReadLocalRpcPromise({
        conversationID: T.Chat.keyToConversationID(id),
        forceUnread: false,
        msgID: readMsgID,
      })
    }
    ignorePromise(f())
  })
  const addMessages = React.useEffectEvent(
    (
      messages: ReadonlyArray<T.Chat.Message>,
      opt: {
        liveUpdate?: boolean
        markAsRead?: boolean
        validatedRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}
      } = {}
    ) => {
      updateThreadState(s => {
        if (opt.liveUpdate) {
          s.liveUpdateVersion += 1
        }
        addMessagesToThreadState(s, messages, {validatedRange: opt.validatedRange})
        clearOptimisticReactionsForMessagesInThreadState(s, messages)
      })
      if (opt.markAsRead) {
        markThreadAsRead()
      }
    }
  )
  const applyThreadLoad = React.useEffectEvent(
    (p: {
      centered: boolean
      messages: ReadonlyArray<T.Chat.Message>
      moreToLoad: boolean
      scrollDirection: ScrollDirection
      validatedRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}
    }) => {
      updateThreadState(s => {
        s.loaded = true
        switch (p.scrollDirection) {
          case 'forward':
            s.moreToLoadForward = p.moreToLoad
            break
          case 'back':
            s.moreToLoadBack = p.moreToLoad
            break
          case 'none':
            s.moreToLoadBack = p.moreToLoad
            s.moreToLoadForward = p.centered
            break
        }
        if (p.messages.length) {
          addMessagesToThreadState(s, p.messages, {validatedRange: p.validatedRange})
          clearOptimisticReactionsForMessagesInThreadState(s, p.messages)
        }
      })
    }
  )
  const deleteMessages = React.useEffectEvent(
    (p: {
      messageIDs?: ReadonlyArray<T.Chat.MessageID>
      upToMessageID?: T.Chat.MessageID
      deletableMessageTypes?: ReadonlySet<T.Chat.MessageType>
      ordinals?: ReadonlyArray<T.Chat.Ordinal>
      liveUpdate?: boolean
    }) => {
      updateThreadState(s => {
        if (p.liveUpdate) {
          s.liveUpdateVersion += 1
        }
        deleteMessagesFromThreadState(s, {
          deletableMessageTypes: p.deletableMessageTypes ?? Common.allMessageTypes,
          messageIDs: p.messageIDs,
          ordinals: p.ordinals,
          upToMessageID: p.upToMessageID,
        })
      })
    }
  )
  const explodeMessages = React.useEffectEvent(
    (messageIDs: ReadonlyArray<T.Chat.MessageID>, explodedBy?: string, liveUpdate?: boolean) => {
      updateThreadState(s => {
        if (liveUpdate) {
          s.liveUpdateVersion += 1
        }
        explodeMessagesInThreadState(s, messageIDs, explodedBy)
      })
    }
  )
  const setMessageErrored = React.useEffectEvent(
    (outboxID: T.Chat.OutboxID, reason: string, errorTyp?: number) => {
      updateThreadState(s => {
        setMessageErroredInThreadState(s, outboxID, reason, errorTyp)
      })
    }
  )
  const retryMessage = React.useEffectEvent((outboxID: T.Chat.OutboxID) => {
    updateThreadState(s => {
      retryMessageInThreadState(s, outboxID)
    })
    ignorePromise(
      (async () => {
        await T.RPCChat.localRetryPostRpcPromise({outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)})
      })()
    )
  })
  const setExplodingMode = React.useEffectEvent((seconds: number, incoming?: boolean) => {
    updateThreadState(s => {
      s.explodingMode = seconds
    })
    if (!incoming) {
      persistExplodingMode(id, getSnapshot().meta, seconds)
    }
  })
  const setMeta = React.useEffectEvent((meta?: T.Chat.ConversationMeta) => {
    updateThreadState(s => {
      s.meta = T.castDraft(copyConversationMeta(meta ?? Meta.makeConversationMeta()))
    })
    if (meta) {
      metasReceived([getSnapshot().meta])
    }
  })
  const updateMeta = React.useEffectEvent((meta: Partial<T.Chat.ConversationMeta>) => {
    updateThreadState(s => {
      Object.assign(s.meta, meta)
    })
    const nextMeta = getSnapshot().meta
    if (nextMeta.conversationIDKey === id) {
      metasReceived([nextMeta])
    }
  })
  const setParticipants = React.useEffectEvent((participants: T.Chat.ParticipantInfo) => {
    updateThreadState(s => {
      s.participants = T.castDraft(copyParticipantInfo(participants))
    })
    participantInfoReceived(id, participants, getSnapshot().meta)
  })
  const setMarkAsUnread = React.useEffectEvent((readMsgID?: T.Chat.MessageID | false) => {
    if (readMsgID === false) {
      return
    }
    const f = async () => {
      if (!useConfigState.getState().loggedIn) {
        logger.info('mark unread bail on not logged in')
        return
      }
      const snapshot = getSnapshot()
      const unreadLineID = readMsgID ? readMsgID : snapshot.meta.maxVisibleMsgID
      let msgID = unreadLineID

      if (snapshot.messageMap.size) {
        const ord =
          snapshot.messageOrdinals &&
          findLast(snapshot.messageOrdinals, o => {
            const message = snapshot.messageMap.get(o)
            return !!(message && message.id < unreadLineID)
          })
        const message = ord ? snapshot.messageMap.get(ord) : undefined
        if (message) {
          msgID = message.id
        }
      } else {
        const pagination = {
          last: false,
          next: '',
          num: 2,
          previous: '',
        }
        try {
          await new Promise<void>(resolve => {
            let settled = false
            const done = () => {
              if (!settled) {
                settled = true
                resolve()
              }
            }
            const onGotThread = (p: string) => {
              try {
                const d = JSON.parse(p) as undefined | {messages?: Array<{valid?: {messageID?: unknown}}>}
                const m = d?.messages?.[1]?.valid?.messageID
                if (typeof m === 'number') {
                  msgID = T.Chat.numberToMessageID(m)
                }
                done()
              } catch {
                done()
              }
            }
            T.RPCChat.localGetThreadNonblockRpcListener({
              incomingCallMap: {
                'chat.1.chatUi.chatThreadCached': p => onGotThread(p.thread || ''),
                'chat.1.chatUi.chatThreadFull': p => onGotThread(p.thread || ''),
              },
              params: {
                cbMode: T.RPCChat.GetThreadNonblockCbMode.incremental,
                conversationID: T.Chat.keyToConversationID(id),
                identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
                knownRemotes: [],
                pagination,
                pgmode: T.RPCChat.GetThreadNonblockPgMode.server,
                query: {
                  disablePostProcessThread: false,
                  disableResolveSupersedes: false,
                  enableDeletePlaceholders: true,
                  markAsRead: false,
                  messageIDControl: null,
                  messageTypes: loadThreadMessageTypes,
                },
                reason: reasonToRPCReason(''),
              },
            })
              .then(() => {
                done()
              })
              .catch(() => {
                done()
              })
          })
        } catch {}
      }

      if (!msgID) {
        logger.info(`marking unread messages ${id} failed due to no id`)
        return
      }

      logger.info(`marking unread messages ${id} ${msgID}`)
      await T.RPCChat.localMarkAsReadLocalRpcPromise({
        conversationID: T.Chat.keyToConversationID(id),
        forceUnread: true,
        msgID,
      })
    }
    ignorePromise(f())
  })
  const messageDelete = React.useEffectEvent((ordinal: T.Chat.Ordinal) => {
    updateThreadState(s => {
      const m = s.messageMap.get(ordinal)
      if (m?.type === 'text') {
        m.submitState = 'deleting'
      }
    })

    const f = async () => {
      const snapshot = getSnapshot()
      const message = snapshot.messageMap.get(ordinal)
      if (!message) {
        logger.warn('Deleting invalid message')
        return
      }
      if (snapshot.meta.conversationIDKey !== id) {
        logger.warn('Deleting message w/ no meta')
        return
      }
      if (!message.id) {
        if (message.outboxID) {
          await T.RPCChat.localCancelPostRpcPromise({
            outboxID: T.Chat.outboxIDToRpcOutboxID(message.outboxID),
          })
          deleteMessages({ordinals: [message.ordinal]})
        } else {
          logger.warn('Delete of no message id and no outboxid')
        }
        return
      }
      await T.RPCChat.localPostDeleteNonblockRpcPromise({
        clientPrev: 0,
        conversationID: T.Chat.keyToConversationID(id),
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        outboxID: null,
        supersedes: message.id,
        tlfName: snapshot.meta.tlfname,
        tlfPublic: false,
      })
    }
    ignorePromise(f())
  })
  const messageReplyPrivately = React.useEffectEvent((ordinal: T.Chat.Ordinal) => {
    const f = async () => {
      const message = getSnapshot().messageMap.get(ordinal)
      if (!message) {
        logger.warn("messageReplyPrivately: can't find message to reply to", ordinal)
        return
      }
      const username = useCurrentUserState.getState().username
      if (!username) {
        throw new Error('messageReplyPrivately: making a convo while logged out?')
      }
      const result = await T.RPCChat.localNewConversationLocalRpcPromise(
        {
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          membersType: T.RPCChat.ConversationMembersType.impteamnative,
          tlfName: [...new Set([username, message.author])].join(','),
          tlfVisibility: T.RPCGen.TLFVisibility.private,
          topicType: T.RPCChat.TopicType.chat,
        },
        Strings.waitingKeyChatCreating
      )
      const newThreadCID = T.Chat.conversationIDToKey(result.conv.info.id)
      if (!newThreadCID) {
        logger.warn("messageReplyPrivately: couldn't make a new conversation?")
        return
      }
      const meta = Meta.inboxUIItemToConversationMeta(result.uiConv)
      if (!meta) {
        logger.warn('messageReplyPrivately: unable to make meta')
        return
      }
      if (message.type !== 'text') {
        return
      }

      const text = formatTextForQuoting(message.text.stringValue())
      metasReceived([meta])
      navigateToThread(newThreadCID, 'createdMessagePrivately', undefined, undefined, undefined, text)
    }
    ignorePromise(f())
  })
  const addOptimisticReaction = React.useEffectEvent(
    (outboxID: T.Chat.OutboxID, reaction: OptimisticReaction) => {
      updateThreadState(s => {
        s.optimisticReactionMap.set(outboxID, reaction)
      })
    }
  )
  const removeOptimisticReaction = React.useEffectEvent((outboxID: T.Chat.OutboxID) => {
    updateThreadState(s => {
      s.optimisticReactionMap.delete(outboxID)
    })
  })
  const updateOptimisticReactionDecorated = React.useEffectEvent(
    (outboxID: T.Chat.OutboxID, decorated: string) => {
      updateThreadState(s => {
        const reaction = s.optimisticReactionMap.get(outboxID)
        if (reaction) {
          s.optimisticReactionMap.set(outboxID, {...reaction, decorated})
        }
      })
    }
  )
  const toggleMessageCollapse = React.useEffectEvent(
    (messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => {
      const f = async () => {
        const snapshot = getSnapshot()
        const m = snapshot.messageMap.get(ordinal)
        let isCollapsed = false

        if (T.Chat.messageIDToNumber(messageID) !== T.Chat.ordinalToNumber(ordinal)) {
          const unfurlInfos = [...(m?.unfurls?.values() ?? [])]
          const ui = unfurlInfos.find(u => u.unfurlMessageID === messageID)
          if (ui) {
            isCollapsed = ui.isCollapsed
          }
        } else {
          isCollapsed = m?.isCollapsed ?? false
        }
        await T.RPCChat.localToggleMessageCollapseRpcPromise({
          collapse: !isCollapsed,
          convID: T.Chat.keyToConversationID(id),
          msgID: messageID,
        })
      }
      ignorePromise(f())
    }
  )
  const toggleMessageReaction = React.useEffectEvent((ordinal: T.Chat.Ordinal, emoji: string) => {
    const f = async () => {
      if (!emoji) {
        return
      }
      const snapshot = getSnapshot()
      const message = snapshot.messageMap.get(ordinal)
      if (!message) {
        logger.warn(`toggleMessageReaction: no message found`)
        return
      }
      const {type, exploded, id: messageID} = message
      if ((type === 'text' || type === 'attachment') && exploded) {
        logger.warn(`toggleMessageReaction: message is exploded`)
        return
      }
      const username = useCurrentUserState.getState().username
      if (!username) {
        logger.warn(`toggleMessageReaction: no current username`)
        return
      }
      const displayMessage = applyOptimisticReactionsToMessage(message, snapshot.optimisticReactionMap)
      const add =
        !displayMessage?.reactions?.get(emoji)?.users.some(reaction => reaction.username === username)
      const outboxID = Common.generateOutboxID()
      const localOutboxID = T.Chat.rpcOutboxIDToOutboxID(outboxID)
      addOptimisticReaction(localOutboxID, {
        add,
        decorated: emoji,
        emoji,
        targetOrdinal: ordinal,
        timestamp: Date.now(),
        username,
      })
      try {
        await T.RPCChat.localPostReactionNonblockRpcPromise({
          body: emoji,
          clientPrev: getClientPrevFromSnapshot(snapshot),
          conversationID: T.Chat.keyToConversationID(id),
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          outboxID,
          supersedes: messageID,
          tlfName: snapshot.meta.tlfname,
          tlfPublic: false,
        })
      } catch (error) {
        removeOptimisticReaction(localOutboxID)
        if (error instanceof RPCError) {
          logger.info(`toggleMessageReaction: failed to post` + error.message)
        }
      }
    }
    ignorePromise(f())
  })
  const unfurlRemove = React.useEffectEvent((messageID: T.Chat.MessageID) => {
    const f = async () => {
      const snapshot = getSnapshot()
      if (snapshot.meta.conversationIDKey !== id) {
        logger.debug('unfurl remove no meta found, aborting!')
        return
      }
      await T.RPCChat.localPostDeleteNonblockRpcPromise({
        clientPrev: 0,
        conversationID: T.Chat.keyToConversationID(id),
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        outboxID: null,
        supersedes: messageID,
        tlfName: snapshot.meta.tlfname,
        tlfPublic: false,
      })
    }
    ignorePromise(f())
  })
  const setMessageSubmitState = React.useEffectEvent(
    (ordinal: T.Chat.Ordinal, submitState: T.Chat.Message['submitState']) => {
      updateThreadState(s => {
        setMessageSubmitStateInThreadState(s, ordinal, submitState)
      })
    }
  )
  const updateReactions = React.useEffectEvent(
    (updates: ReadonlyArray<{targetMsgID: T.Chat.MessageID; reactions?: T.Chat.Reactions}>) => {
      const missingTargetMsgIDs = new Array<T.Chat.MessageID>()
      updateThreadState(s => {
        missingTargetMsgIDs.push(...updateReactionsInThreadState(s, updates))
        if (missingTargetMsgIDs.length !== updates.length) {
          s.liveUpdateVersion += 1
        }
        clearOptimisticReactionsForUpdatesInThreadState(s, updates)
      })
      for (const targetMsgID of missingTargetMsgIDs) {
        logger.info(
          `updateReactions: couldn't find target ordinal for targetMsgID=${targetMsgID} in convID=${id}`
        )
      }
      markThreadAsRead()
    }
  )
  const clearValidatedOrdinalRange = React.useEffectEvent(() => {
    updateThreadState(s => {
      s.validatedOrdinalRange = undefined
    })
  })
  const messagesClear = React.useEffectEvent(() => {
    deleteConversationThreadCacheSnapshot(id)
    updateThreadState(s => {
      s.pendingOutboxToOrdinal.clear()
      s.loaded = false
      s.messageIDToOrdinal.clear()
      s.messageMap.clear()
      s.messageOrdinals = undefined
      s.messageTypeMap.clear()
      s.optimisticReactionMap.clear()
      s.validatedOrdinalRange = undefined
    })
  })
  const setTyping = React.useEffectEvent((typing: ReadonlySet<string>) => {
    updateThreadState(s => {
      if (sameStringSet(s.typing, typing)) {
        return
      }
      s.typing = new Set(typing)
    })
  })
  const receiveRequestInfo = React.useEffectEvent(
    (messageID: T.Chat.MessageID, requestInfo: T.Chat.ChatRequestInfo) => {
      updateThreadState(s => {
        s.accountsInfoMap.set(messageID, requestInfo)
      })
    }
  )
  const receivePaymentInfo = React.useEffectEvent(
    (messageID: T.Chat.MessageID, paymentInfo: T.Chat.ChatPaymentInfo) => {
      updateThreadState(s => {
        s.accountsInfoMap.set(messageID, paymentInfo)
        s.paymentStatusMap.set(paymentInfo.paymentID, paymentInfo)
      })
    }
  )
  const showUnfurlPrompt = React.useEffectEvent((messageID: T.Chat.MessageID, domain: string) => {
    updateThreadState(s => {
      let prompts = s.unfurlPrompt.get(messageID)
      if (!prompts) {
        prompts = new Set()
        s.unfurlPrompt.set(messageID, prompts)
      }
      prompts.add(domain)
    })
  })
  const clearUnfurlPrompt = React.useEffectEvent((messageID: T.Chat.MessageID, domain: string) => {
    updateThreadState(s => {
      const prompts = s.unfurlPrompt.get(messageID)
      prompts?.delete(domain)
    })
  })
  const updateCoinFlipStatuses = React.useEffectEvent(
    (statuses: ReadonlyArray<T.RPCChat.UICoinFlipStatus>) => {
      updateThreadState(s => {
        statuses.forEach(status => {
          s.flipStatusMap.set(status.gameID, T.castDraft(status))
        })
      })
    }
  )
  const updateAttachmentDownloadProgress = React.useEffectEvent(
    (msgID: number, bytesComplete: number, bytesTotal: number) => {
      updateThreadState(s => {
        updateAttachmentDownloadProgressInThreadState(s, msgID, bytesComplete, bytesTotal)
      })
    }
  )
  const completeAttachmentDownload = React.useEffectEvent((msgID: number) => {
    updateThreadState(s => {
      completeAttachmentDownloadInThreadState(s, msgID)
    })
  })
  const startAttachmentDownload = React.useEffectEvent((ordinal: T.Chat.Ordinal) => {
    updateThreadState(s => {
      startAttachmentDownloadInThreadState(s, ordinal)
    })
  })
  const finishAttachmentDownload = React.useEffectEvent((ordinal: T.Chat.Ordinal, path: string) => {
    updateThreadState(s => {
      finishAttachmentDownloadInThreadState(s, ordinal, path)
    })
  })
  const failAttachmentDownload = React.useEffectEvent((ordinal: T.Chat.Ordinal, errMsg: string) => {
    updateThreadState(s => {
      failAttachmentDownloadInThreadState(s, ordinal, errMsg)
    })
  })
  const setAttachmentMobileSaving = React.useEffectEvent(
    (ordinal: T.Chat.Ordinal, saving: boolean) => {
      updateThreadState(s => {
        setAttachmentMobileSavingInThreadState(s, ordinal, saving)
      })
    }
  )
  const updateAttachmentUploadProgress = React.useEffectEvent(
    (outboxID: Uint8Array, bytesComplete?: number, bytesTotal?: number) => {
      updateThreadState(s => {
        updateAttachmentUploadProgressInThreadState(s, outboxID, bytesComplete, bytesTotal)
      })
    }
  )
  const [threadActions] = React.useState<ConversationThreadActions>(() => {
    const threadActionsHolder: {current?: ConversationThreadActions} = {}
    const loadMoreMessages: LoadMoreMessages = throttle((p: LoadMoreMessagesParams) => {
      const actions = threadActionsHolder.current
      if (actions) {
        loadConversationThreadMessages(id, p, actions)
      }
    }, 500)
    const threadActions: ConversationThreadActions = {
      addMessages,
      addOptimisticReaction,
      applyThreadLoad,
      clearUnfurlPrompt,
      clearValidatedOrdinalRange,
      completeAttachmentDownload,
      deleteMessages,
      explodeMessages,
      failAttachmentDownload,
      finishAttachmentDownload,
      getSnapshot,
      loadMoreMessages,
      markThreadAsRead,
      messageDelete,
      messageReplyPrivately,
      messagesClear,
      receivePaymentInfo,
      receiveRequestInfo,
      removeOptimisticReaction,
      retryMessage,
      setAttachmentMobileSaving,
      setExplodingMode,
      setMarkAsUnread,
      setMessageErrored,
      setMessageSubmitState,
      setMeta,
      setParticipants,
      setTyping,
      showUnfurlPrompt,
      startAttachmentDownload,
      toggleMessageCollapse,
      toggleMessageReaction,
      unfurlRemove,
      updateAttachmentDownloadProgress,
      updateAttachmentUploadProgress,
      updateCoinFlipStatuses,
      updateMeta,
      updateOptimisticReactionDecorated,
      updateReactions,
    }
    threadActionsHolder.current = threadActions
    return threadActions
  })
  React.useEffect(() => {
    return () => {
      threadActions.loadMoreMessages.cancel()
      const snapshot = threadStore.getState()
      if (snapshot.loaded) {
        putConversationThreadCacheSnapshot(id, threadStateToSnapshot(snapshot))
      }
    }
  }, [id, threadActions, threadStore])
  React.useLayoutEffect(() => {
    if (!registerLive) {
      return
    }
    const entry = {actions: threadActions, store: threadStore}
    registerLiveConversationThreadProvider(id, entry)
    return () => {
      unregisterLiveConversationThreadProvider(id, entry)
    }
  }, [id, registerLive, threadActions, threadStore])
  const inboxParticipants = useInboxMetadataState(s => s.participants.get(id))
  React.useEffect(() => {
    if (!inboxParticipants) {
      return
    }
    updateThreadState(s => {
      s.participants = T.castDraft(copyParticipantInfo(inboxParticipants))
    })
  }, [inboxParticipants])
  useEngineActionListener('chat.1.NotifyChat.NewChatActivity', action => {
    const {activity} = action.payload.params
    switch (activity.activityType) {
      case T.RPCChat.ChatActivityType.incomingMessage: {
        const {incomingMessage} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(incomingMessage.convID)
        if (conversationIDKey === id) {
          applyInboxUIItemToThread(incomingMessage.conv, threadActions)
          applyIncomingMessageToThread(conversationIDKey, incomingMessage, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.setStatus: {
        const {setStatus} = activity
        const conversationIDKey = setStatus.conv
          ? T.Chat.stringToConversationIDKey(setStatus.conv.convID)
          : T.Chat.noConversationIDKey
        if (conversationIDKey === id) {
          applyInboxUIItemToThread(setStatus.conv, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.readMessage: {
        const {readMessage} = activity
        const conversationIDKey = readMessage.conv
          ? T.Chat.stringToConversationIDKey(readMessage.conv.convID)
          : T.Chat.noConversationIDKey
        if (conversationIDKey === id) {
          applyInboxUIItemToThread(readMessage.conv, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.newConversation: {
        const {newConversation} = activity
        const conversationIDKey = newConversation.conv
          ? T.Chat.stringToConversationIDKey(newConversation.conv.convID)
          : T.Chat.noConversationIDKey
        if (conversationIDKey === id) {
          applyInboxUIItemToThread(newConversation.conv, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.setAppNotificationSettings: {
        const {setAppNotificationSettings} = activity
        if (T.Chat.conversationIDToKey(setAppNotificationSettings.convID) === id) {
          threadActions.updateMeta(Meta.parseNotificationSettings(setAppNotificationSettings.settings))
        }
        break
      }
      case T.RPCChat.ChatActivityType.messagesUpdated: {
        const {messagesUpdated} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(messagesUpdated.convID)
        if (conversationIDKey === id) {
          applyMessagesUpdatedToThread(conversationIDKey, messagesUpdated, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.failedMessage: {
        const {failedMessage} = activity
        applyInboxUIItemToThread(failedMessage.conv, threadActions)
        applyFailedMessageToThread(id, failedMessage, threadActions)
        break
      }
      case T.RPCChat.ChatActivityType.reactionUpdate: {
        const {reactionUpdate} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(reactionUpdate.convID)
        if (conversationIDKey === id) {
          applyReactionUpdateToThread(reactionUpdate, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.expunge: {
        const {expunge} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(expunge.convID)
        if (conversationIDKey === id) {
          applyExpungeToThread(expunge, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.ephemeralPurge: {
        const {ephemeralPurge} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(ephemeralPurge.convID)
        if (conversationIDKey === id) {
          applyEphemeralPurgeToThread(ephemeralPurge, threadActions)
        }
        break
      }
      default:
    }
  })
  useEngineActionListener('keybase.1.gregorUI.pushState', action => {
    const items = (action.payload.params.state.items ?? []).reduce<
      Array<{md: T.RPCGen.Gregor1.Metadata; item: T.RPCGen.Gregor1.Item}>
    >((arr, {md, item}) => {
      if (md && item) {
        arr.push({item, md})
      }
      return arr
    }, [])
    const seconds = getExplodingModeFromGregorItems(id, items)
    if (seconds !== undefined) {
      threadActions.setExplodingMode(seconds, true)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatConvUpdate', action => {
    const {conv} = action.payload.params
    const conversationIDKey = conv ? T.Chat.stringToConversationIDKey(conv.convID) : T.Chat.noConversationIDKey
    if (conversationIDKey === id) {
      applyInboxUIItemToThread(conv, threadActions)
    }
  })
  useEngineActionListener('chat.1.chatUi.chatInboxFailed', action => {
    const {convID, error} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) !== id) {
      return
    }
    const {meta, participants} = Meta.inboxUIItemErrorToConversationMetaAndParticipants(
      error,
      useCurrentUserState.getState().username,
      threadActions.getSnapshot().meta
    )
    if (meta) {
      threadActions.setMeta(meta)
    }
    if (participants) {
      threadActions.setParticipants(participants)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatSetConvSettings', action => {
    const {conv, convID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) !== id) {
      return
    }
    const newRole = conv?.convSettings?.minWriterRoleInfo?.role
    const role = newRole && TeamsUtil.teamRoleByEnum[newRole]
    const cannotWrite = conv?.convSettings?.minWriterRoleInfo?.cannotWrite || false
    if (role) {
      threadActions.updateMeta({cannotWrite, minWriterRole: role})
    } else {
      logger.warn(
        `got NotifyChat.ChatSetConvSettings with no valid minWriterRole for convID ${id}. The local version may be out of date.`
      )
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatSetConvRetention', action => {
    const {conv, convID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) !== id) {
      return
    }
    if (!conv) {
      logger.warn('onChatSetConvRetention: no conv given')
      return
    }
    const meta = Meta.inboxUIItemToConversationMeta(conv)
    if (!meta) {
      logger.warn(`onChatSetConvRetention: no meta found for ${convID.toString()}`)
      return
    }
    applyConversationMetaToThread(meta, threadActions)
  })
  useEngineActionListener('chat.1.NotifyChat.ChatSetTeamRetention', action => {
    const meta = (action.payload.params.convs ?? []).reduce<T.Chat.ConversationMeta | undefined>(
      (found, conv) => {
        if (found) {
          return found
        }
        const meta = Meta.inboxUIItemToConversationMeta(conv)
        return meta?.conversationIDKey === id ? meta : undefined
      },
      undefined
    )
    if (meta) {
      applyConversationMetaToThread(meta, threadActions)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatParticipantsInfo', action => {
    const participants = action.payload.params.participants?.[id]
    if (participants) {
      threadActions.setParticipants(Common.uiParticipantsToParticipantInfo(participants))
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatRequestInfo', action => {
    const {convID, info, msgID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) !== id) {
      return
    }
    const requestInfo = Message.uiRequestInfoToChatRequestInfo(info)
    if (!requestInfo) {
      const errMsg = `got 'NotifyChat.ChatRequestInfo' with no valid requestInfo for convID ${id} messageID: ${msgID}. The local version may be absent or out of date.`
      logger.error(errMsg)
      throw new Error(errMsg)
    }
    threadActions.receiveRequestInfo(T.Chat.numberToMessageID(msgID), requestInfo)
  })
  useEngineActionListener('chat.1.NotifyChat.ChatPaymentInfo', action => {
    const {convID, info, msgID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) !== id) {
      return
    }
    const paymentInfo = Message.uiPaymentInfoToChatPaymentInfo([info])
    if (!paymentInfo) {
      const errMsg = `got 'NotifyChat.ChatPaymentInfo' with no valid paymentInfo for convID ${id} messageID: ${msgID}. The local version may be absent or out of date.`
      logger.error(errMsg)
      throw new Error(errMsg)
    }
    threadActions.receivePaymentInfo(T.Chat.numberToMessageID(msgID), paymentInfo)
  })
  useEngineActionListener('chat.1.NotifyChat.ChatPromptUnfurl', action => {
    const {convID, domain, msgID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) !== id) {
      return
    }
    threadActions.showUnfurlPrompt(T.Chat.numberToMessageID(msgID), domain)
  })
  useEngineActionListener('chat.1.chatUi.chatCoinFlipStatus', action => {
    const statuses = action.payload.params.statuses?.filter(status => {
      return T.Chat.stringToConversationIDKey(status.convID) === id
    })
    if (statuses?.length) {
      threadActions.updateCoinFlipStatuses(statuses)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatTypingUpdate', action => {
    action.payload.params.typingUpdates?.forEach(update => {
      if (T.Chat.conversationIDToKey(update.convID) === id) {
        threadActions.setTyping(new Set(update.typers?.map(typer => typer.username)))
      }
    })
  })
  useEngineActionListener('chat.1.NotifyChat.ChatAttachmentDownloadProgress', action => {
    const {bytesComplete, bytesTotal, convID, msgID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) === id) {
      threadActions.updateAttachmentDownloadProgress(msgID, bytesComplete, bytesTotal)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatAttachmentDownloadComplete', action => {
    const {convID, msgID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) === id) {
      threadActions.completeAttachmentDownload(msgID)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatAttachmentUploadStart', action => {
    const {convID, outboxID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) === id) {
      threadActions.updateAttachmentUploadProgress(outboxID)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatAttachmentUploadProgress', action => {
    const {bytesComplete, bytesTotal, convID, outboxID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) === id) {
      threadActions.updateAttachmentUploadProgress(outboxID, bytesComplete, bytesTotal)
    }
  })

  return (
    <ConversationThreadContextProvider id={id} actions={threadActions} store={threadStore}>
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
  <ConversationThreadProviderInner {...p} registerLive={true} />
)

const useLiveConversationThreadProviderEntry = (id: T.Chat.ConversationIDKey) =>
  React.useSyncExternalStore(
    subscribeLiveConversationThreadProviders,
    () => liveConversationThreadProviders.get(id),
    () => undefined
  )

// React Navigation headers, routes, and popup roots can render outside the live conversation tree.
// This fallback is only for surfaces that can still work from cache, inbox meta, or participants.
export const ConversationThreadBridgeProvider = (p: ConversationThreadProviderProps) => {
  const currentConversationIDKey = React.useContext(ConversationThreadIDContext)
  const currentActions = React.useContext(ConversationThreadActionsContext)
  const currentStore = React.useContext(ConversationThreadStoreContext)
  const liveEntry = useLiveConversationThreadProviderEntry(p.id)
  if (currentConversationIDKey === p.id && currentActions && currentStore) {
    return <>{p.children}</>
  }
  if (liveEntry) {
    return (
      <ConversationThreadContextProvider id={p.id} actions={liveEntry.actions} store={liveEntry.store}>
        {p.children}
      </ConversationThreadContextProvider>
    )
  }
  return <ConversationThreadProviderInner {...p} />
}

// Use this for message-scoped routes and actions. Rendering without the live thread would no-op later.
export const RequiredConversationThreadBridgeProvider = (p: ConversationThreadProviderProps) => {
  const currentConversationIDKey = React.useContext(ConversationThreadIDContext)
  const currentActions = React.useContext(ConversationThreadActionsContext)
  const currentStore = React.useContext(ConversationThreadStoreContext)
  const liveEntry = useLiveConversationThreadProviderEntry(p.id)
  React.useEffect(() => {
    const missingLiveThread =
      !(currentConversationIDKey === p.id && currentActions && currentStore) &&
      !liveConversationThreadProviders.get(p.id)
    if (missingLiveThread && T.Chat.isValidConversationIDKey(p.id)) {
      logger.warn(`RequiredConversationThreadBridgeProvider: missing live thread for ${p.id}`)
    }
  }, [currentActions, currentConversationIDKey, currentStore, p.id, liveEntry])
  if (currentConversationIDKey === p.id && currentActions && currentStore) {
    return <>{p.children}</>
  }
  if (!liveEntry) {
    return null
  }
  return (
    <ConversationThreadContextProvider id={p.id} actions={liveEntry.actions} store={liveEntry.store}>
      {p.children}
    </ConversationThreadContextProvider>
  )
}

export const useConversationThreadLoaded = () =>
  useConversationThreadSnapshotValue(snapshot => snapshot.loaded)

export const useConversationThreadMeta = () => useConversationThreadSnapshotValue(snapshot => snapshot.meta)

export const useConversationThreadParticipants = () =>
  useConversationThreadSnapshotValue(snapshot => snapshot.participants)

export const useConversationThreadExplodingMode = () =>
  useConversationThreadSnapshotValue(snapshot => snapshot.explodingMode)

export const useConversationThreadSetExplodingMode = () => {
  const {setExplodingMode} = useConversationThreadActions()
  return setExplodingMode
}

export const useConversationThreadIsMetaGood = () => {
  const conversationIDKey = useConversationThreadID()
  return useConversationThreadSnapshotValue(snapshot => snapshot.meta.conversationIDKey === conversationIDKey)
}

export const useConversationThreadLastOrdinal = () =>
  useConversationThreadSnapshotValue(
    snapshot => snapshot.messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
  )

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
  useConversationThreadSnapshotValue(snapshot => getConversationThreadDisplayMessage(snapshot, ordinal))

export const useConversationThreadMessageMap = () =>
  useConversationThreadSnapshotValue(snapshot =>
    snapshot.messageMap.size === 0 ? emptyMessageMap : snapshot.messageMap
  )

export const useConversationThreadMessageOrdinals = () =>
  useConversationThreadSnapshotValue(snapshot => snapshot.messageOrdinals ?? noOrdinals)

export const useConversationThreadMessageOrdinalsMaybe = () =>
  useConversationThreadSnapshotValue(snapshot => snapshot.messageOrdinals)

export const useConversationThreadPendingOutboxToOrdinal = () =>
  useConversationThreadSnapshotValue(snapshot => snapshot.pendingOutboxToOrdinal)

export const useConversationThreadMessageType = (ordinal: T.Chat.Ordinal) =>
  useConversationThreadSnapshotValue(snapshot => snapshot.messageTypeMap.get(ordinal) ?? 'text')

export const useConversationThreadMessageTypeMap = () =>
  useConversationThreadSnapshotValue(snapshot =>
    snapshot.messageTypeMap.size === 0 ? emptyMessageTypeMap : snapshot.messageTypeMap
  )

export const useConversationThreadAccountsInfoMap = () =>
  useConversationThreadSnapshotValue(snapshot =>
    snapshot.accountsInfoMap.size === 0 ? emptyAccountsInfoMap : snapshot.accountsInfoMap
  )

export const useConversationThreadPaymentStatus = (paymentID?: T.Wallets.PaymentID) =>
  useConversationThreadSnapshotValue(snapshot =>
    paymentID ? snapshot.paymentStatusMap.get(paymentID) : undefined
  )

export const useConversationThreadPaymentStatusMap = () =>
  useConversationThreadSnapshotValue(snapshot =>
    snapshot.paymentStatusMap.size === 0 ? emptyPaymentStatusMap : snapshot.paymentStatusMap
  )

export const useConversationThreadUnfurlPromptDomains = (messageID: T.Chat.MessageID) =>
  useConversationThreadSnapshotValue(snapshot => snapshot.unfurlPrompt.get(messageID) ?? emptyStringSet)

export const useConversationThreadUnfurlPromptMap = () =>
  useConversationThreadSnapshotValue(snapshot =>
    snapshot.unfurlPrompt.size === 0 ? emptyUnfurlPromptMap : snapshot.unfurlPrompt
  )

export const useConversationThreadCoinFlipStatus = (gameID: string) =>
  useConversationThreadSnapshotValue(snapshot => snapshot.flipStatusMap.get(gameID))

export const useConversationThreadFlipStatusMap = () =>
  useConversationThreadSnapshotValue(snapshot =>
    snapshot.flipStatusMap.size === 0 ? emptyFlipStatusMap : snapshot.flipStatusMap
  )

export const useConversationThreadTyping = () =>
  useConversationThreadSnapshotValue(snapshot =>
    snapshot.typing.size === 0 ? emptyStringSet : snapshot.typing
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

export const useConversationThreadGalleryMessagesLoaded = () => {
  const {addMessages} = useConversationThreadActions()
  return (messages: ReadonlyArray<T.Chat.Message>) => {
    addMessages(messages, {markAsRead: false})
  }
}

const useConversationThreadMessagesClear = () => {
  const {messagesClear} = useConversationThreadActions()
  return messagesClear
}

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
  const {clearValidatedOrdinalRange} = useConversationThreadActions()
  const loadMoreMessages = useConversationThreadLoadMoreMessages()

  const jumpToRecent: JumpToRecent = options => {
    clearValidatedOrdinalRange()
    loadMoreMessages({...(options ?? {}), reason: 'jump to recent'})
  }
  return jumpToRecent
}

export const useConversationThreadMarkThreadAsRead = () => {
  const {markThreadAsRead} = useConversationThreadActions()
  return markThreadAsRead
}

export const useConversationThreadSetMarkAsUnread = () => {
  const {setMarkAsUnread} = useConversationThreadActions()
  return setMarkAsUnread
}

export const useConversationThreadMessageActions = () => {
  const {messageDelete, messageReplyPrivately, toggleMessageCollapse, toggleMessageReaction, unfurlRemove} =
    useConversationThreadActions()
  return {messageDelete, messageReplyPrivately, toggleMessageCollapse, toggleMessageReaction, unfurlRemove}
}

export const useConversationThreadSelectedConversation = () => {
  const conversationIDKey = useConversationThreadID()
  const isMetaGood = useConversationThreadIsMetaGood()
  const loadMoreMessages = useConversationThreadLoadMoreMessages()
  const participantInfo = useConversationThreadParticipants()

  const selectedConversation: SelectedConversation = (options?: SelectedConversationOptions) => {
    const {skipThreadLoad, ...loadStatusOptions} = options ?? {}
    clearChatTimeCache()

    const force = !isMetaGood || participantInfo.all.length === 0
    unboxRows([conversationIDKey], force)

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
  return (hide?: boolean, query?: string) => {
    toggleConversationThreadSearch(conversationIDKey, hide, query)
  }
}

export const toggleConversationThreadSearch = (
  conversationIDKey: T.Chat.ConversationIDKey,
  hide?: boolean,
  query?: string
) => {
  const visible = getVisibleScreen()
  const params = visible?.params as
    | {conversationIDKey?: T.Chat.ConversationIDKey; threadSearch?: {query?: string}}
    | undefined
  const nextVisible = hide !== undefined ? !hide : !params?.threadSearch

  const threadSearch = nextVisible ? (query ? {query} : {}) : undefined
  if (Common.isSplit) {
    setChatRootParams({conversationIDKey, threadSearch})
  } else {
    navigateAppend({name: Common.threadRouteName, params: {conversationIDKey, threadSearch}}, true)
  }

  const f = async () => {
    if (!nextVisible) {
      await T.RPCChat.localCancelActiveSearchRpcPromise()
    }
  }
  ignorePromise(f())
}

export type ConversationInfoPanelTab = 'settings' | 'members' | 'attachments' | 'bots' | undefined

export const showConversationInfoPanel = (
  conversationIDKey: T.Chat.ConversationIDKey,
  show: boolean,
  tab: ConversationInfoPanelTab
) => {
  if (isPhone) {
    const visibleScreen = getVisibleScreen()
    if (show) {
      navigateAppend(
        {
          name: 'chatInfoPanel',
          params: {conversationIDKey, tab},
        },
        visibleScreen?.name === 'chatInfoPanel'
      )
    } else if (visibleScreen?.name === 'chatInfoPanel') {
      navigateUp()
    }
    return
  }
  setChatRootParams({conversationIDKey, infoPanel: show ? {tab} : undefined})
}

export const useConversationShowInfoPanel = () => {
  const conversationIDKey = useConversationThreadID()
  return (show: boolean, tab: ConversationInfoPanelTab) => {
    showConversationInfoPanel(conversationIDKey, show, tab)
  }
}

export const useConversationThreadDismissJourneycard = () => {
  const conversationIDKey = useConversationThreadID()
  const {deleteMessages} = useConversationThreadActions()
  return (cardType: T.RPCChat.JourneycardType, ordinal: T.Chat.Ordinal) => {
    const f = async () => {
      await T.RPCChat.localDismissJourneycardRpcPromise({
        cardType,
        convID: T.Chat.keyToConversationID(conversationIDKey),
      }).catch((error: unknown) => {
        if (error instanceof RPCError) {
          logger.error(`Failed to dismiss journeycard: ${error.message}`)
        }
      })
      deleteMessages({ordinals: [ordinal]})
    }
    ignorePromise(f())
  }
}

export const useConversationThreadUnfurlResolvePrompt = () => {
  const conversationIDKey = useConversationThreadID()
  const {clearUnfurlPrompt} = useConversationThreadActions()
  return (messageID: T.Chat.MessageID, domain: string, result: T.RPCChat.UnfurlPromptResult) => {
    clearUnfurlPrompt(messageID, domain)
    const f = async () => {
      await T.RPCChat.localResolveUnfurlPromptRpcPromise({
        convID: T.Chat.keyToConversationID(conversationIDKey),
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        msgID: T.Chat.messageIDToNumber(messageID),
        result,
      })
    }
    ignorePromise(f())
  }
}
