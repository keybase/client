// TODO remove useChatNavigateAppend
// TODO remove
import * as TeamsUtil from '@/constants/teams'
import * as PlatformSpecific from '@/util/platform-specific'
import {
  clearModals,
  getTab,
  navigateAppend,
  navigateToInbox,
  navigateUp,
  navUpToScreen,
  previewConversation,
  switchTab,
  getVisibleScreen,
  getModalStack,
  navToThread,
  setChatRootParams,
} from '@/constants/router'
import type * as Router2 from '@/constants/router'
import {isIOS} from '@/constants/platform'
import {updateImmer} from '@/constants/utils'
import * as T from '@/constants/types'
import * as Styles from '@/styles'
import * as Common from '@/constants/chat/common'
import * as Tabs from '@/constants/tabs'
import type * as EngineGen from '@/constants/rpc'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as React from 'react'
import * as Z from '@/util/zustand'
import {navToPath} from '@/constants/fs'
import HiddenString from '@/util/hidden-string'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import throttle from 'lodash/throttle'
import type {DebouncedFunc} from 'lodash'
import {RPCError} from '@/util/errors'
import {findLast} from '@/util/arrays'
import {mapGetEnsureValue} from '@/util/map'
import {noConversationIDKey} from '@/constants/types/chat/common'
import {type StoreApi, type UseBoundStore, useStore} from 'zustand'
import * as Platform from '@/constants/platform'
import KB2 from '@/util/electron'
import {NotifyPopup} from '@/util/misc'
import {hexToUint8Array} from '@/util/uint8array'
import {clearChatTimeCache} from '@/util/timestamp'
import {registerExternalResetter} from '@/util/zustand'
import * as Config from '@/constants/config'
import {isMobile} from '@/constants/platform'
import {enumKeys, ignorePromise, shallowEqual, timeoutPromise} from '@/constants/utils'
import {flushInboxRowUpdates, queueInboxRowUpdate} from './inbox-rows'
import * as Strings from '@/constants/strings'
import {chatStores, clearChatStores, convoUIStores} from './convo-registry'

import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import {getUsernameToShow} from '@/chat/conversation/messages/separator-utils'
import type {RefreshReason} from '@/stores/chat-shared'
import {storeRegistry} from '@/stores/store-registry'

const {darwinCopyToChatTempUploadFile} = KB2.functions

const noParticipantInfo: T.Chat.ParticipantInfo = {
  all: [],
  contactName: new Map(),
  name: [],
}

type NavReason =
  | 'focused' // nav focus changed
  | 'clearSelected' // deselect
  | 'desktopNotification' // clicked notification
  | 'createdMessagePrivately' // messaging privately and maybe made it
  | 'extension' // from a notification from iOS share extension
  | 'files' // from the Files tab
  | 'findNewestConversation' // find a new chat to select (from service)
  | 'findNewestConversationFromLayout' // find a small chat to select (from js)
  | 'inboxBig' // inbox row
  | 'inboxFilterArrow' // arrow keys in inbox filter
  | 'inboxFilterChanged' // inbox filter made first one selected
  | 'inboxSmall' // inbox row
  | 'inboxNewConversation' // new conversation row
  | 'inboxSearch' // selected from inbox seaech
  | 'jumpFromReset' // from older reset convo
  | 'jumpToReset' // going to an older reset convo
  | 'justCreated' // just made it and select it
  | 'manageView' // clicked from manage screen
  | 'previewResolved' // did a preview and are now selecting it
  | 'push' // from a push
  | 'savedLastState' // last seen chat tab
  | 'startFoundExisting' // starting a conversation and found one already
  | 'teamChat' // from team
  | 'addedToChannel' // just added people to this channel
  | 'navChanged' // the nav state changed
  | 'misc' // misc
  | 'teamMention' // from team mention

type LoadMoreReason =
  | 'jumpAttachment'
  | 'foregrounding'
  | 'got stale'
  | 'jump to recent'
  | 'centered'
  | 'scroll forward'
  | 'scroll back'
  | 'tab selected'
  | NavReason

type ConvoStore = T.Immutable<{
  id: T.Chat.ConversationIDKey
  // temp cache for requestPayment and sendPayment message data,
  accountsInfoMap: Map<T.RPCChat.MessageID, T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo>
  attachmentViewMap: Map<T.RPCChat.GalleryItemTyp, T.Chat.AttachmentViewInfo>
  badge: number
  botCommandsUpdateStatus: T.RPCChat.UIBotCommandsUpdateStatusTyp
  botSettings: Map<string, T.RPCGen.TeamBotSettings | undefined>
  botTeamRoleMap: Map<string, T.Teams.TeamRoleType | undefined>
  commandMarkdown?: T.RPCChat.UICommandMarkdown
  dismissedInviteBanners: boolean
  explodingMode: number // seconds to exploding message expiration,
  flipStatusMap: Map<string, T.RPCChat.UICoinFlipStatus>
  loaded: boolean // did we ever load this thread yet
  markedAsUnread: T.Chat.Ordinal
  messageCenterOrdinal?: T.Chat.CenterOrdinal // ordinals to center threads on,
  messageIDToOrdinal: Map<T.Chat.MessageID, T.Chat.Ordinal>
  messageTypeMap: Map<T.Chat.Ordinal, T.Chat.RenderMessageType> // messages T.Chat to help the thread, text is never used
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal> // ordered ordinals in a thread,
  messageMap: Map<T.Chat.Ordinal, T.Chat.Message> // messages in a thread,
  meta: T.Chat.ConversationMeta // metadata about a thread, There is a special node for the pending conversation,
  moreToLoadBack: boolean
  moreToLoadForward: boolean
  mutualTeams: ReadonlyArray<T.Teams.TeamID>
  paymentStatusMap: Map<T.Wallets.PaymentID, T.Chat.ChatPaymentInfo>
  participants: T.Chat.ParticipantInfo
  pendingJumpMessageID?: T.Chat.MessageID
  pendingOutboxToOrdinal: Map<T.Chat.OutboxID, T.Chat.Ordinal> // messages waiting to be sent,
  rowRecycleTypeMap: Map<T.Chat.Ordinal, string>
  separatorMap: Map<T.Chat.Ordinal, T.Chat.Ordinal>
  showUsernameMap: Map<T.Chat.Ordinal, string>
  threadLoadStatus: T.RPCChat.UIChatThreadStatusTyp
  typing: ReadonlySet<string>
  unfurlPrompt: Map<T.Chat.MessageID, Set<string>>
  unread: number
  validatedOrdinalRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}
}>

export type ConvoUIStore = T.Immutable<{
  commandStatus?: T.Chat.CommandStatusInfo
  editing: T.Chat.Ordinal
  giphyResult?: T.RPCChat.GiphySearchResults
  giphyWindow: boolean
  replyTo: T.Chat.Ordinal
  unsentText?: string
}>

export interface ConvoUIState extends ConvoUIStore {
  dispatch: {
    injectIntoInput: (text?: string) => void
    resetState: () => void
    setCommandStatusInfo: (info?: T.Chat.CommandStatusInfo) => void
    setEditing: (ordinal: T.Chat.Ordinal | 'last' | 'clear') => void
    setGiphyResult: (result?: T.RPCChat.GiphySearchResults) => void
    setGiphyWindow: (show: boolean) => void
    setReplyTo: (ordinal: T.Chat.Ordinal) => void
    toggleGiphyPrefill: () => void
  }
}

const initialConvoStore: ConvoStore = {
  accountsInfoMap: new Map(),
  attachmentViewMap: new Map(),
  badge: 0,
  botCommandsUpdateStatus: T.RPCChat.UIBotCommandsUpdateStatusTyp.blank,
  botSettings: new Map(),
  botTeamRoleMap: new Map(),
  commandMarkdown: undefined,
  dismissedInviteBanners: false,
  explodingMode: 0,
  flipStatusMap: new Map(),
  id: noConversationIDKey,
  loaded: false,
  markedAsUnread: T.Chat.numberToOrdinal(0),
  messageCenterOrdinal: undefined,
  messageIDToOrdinal: new Map(),
  messageMap: new Map(),
  messageOrdinals: undefined,
  messageTypeMap: new Map(),
  meta: Meta.makeConversationMeta(),
  moreToLoadBack: false,
  moreToLoadForward: false,
  mutualTeams: [],
  participants: noParticipantInfo,
  paymentStatusMap: new Map(),
  pendingJumpMessageID: undefined,
  pendingOutboxToOrdinal: new Map(),
  rowRecycleTypeMap: new Map(),
  separatorMap: new Map(),
  showUsernameMap: new Map(),
  threadLoadStatus: T.RPCChat.UIChatThreadStatusTyp.none,
  typing: new Set(),
  unfurlPrompt: new Map(),
  unread: 0,
  validatedOrdinalRange: undefined,
}

const initialConvoUIStore: ConvoUIStore = {
  commandStatus: undefined,
  editing: T.Chat.numberToOrdinal(0),
  giphyResult: undefined,
  giphyWindow: false,
  replyTo: T.Chat.numberToOrdinal(0),
  unsentText: undefined,
}

type LoadMoreMessagesParams = {
  forceContainsLatestCalc?: boolean
  messageIDControl?: T.RPCChat.MessageIDControl
  centeredMessageID?: {
    conversationIDKey: T.Chat.ConversationIDKey
    messageID: T.Chat.MessageID
    highlightMode: T.Chat.CenterOrdinalHighlightMode
  }
  reason: LoadMoreReason
  knownRemotes?: ReadonlyArray<string>
  scrollDirection?: ScrollDirection
  numberOfMessagesToLoad?: number
}

export interface ConvoState extends ConvoStore {
  dispatch: {
    addBotMember: (
      username: string,
      allowCommands: boolean,
      allowMentions: boolean,
      restricted: boolean,
      convs?: ReadonlyArray<string>
    ) => void
    attachmentPasted: (data: Uint8Array) => void
    attachmentPreviewSelect: (ordinal: T.Chat.Ordinal) => void
    attachmentUploadCanceled: (outboxIDs: ReadonlyArray<T.RPCChat.OutboxID>) => void
    attachmentDownload: (ordinal: T.Chat.Ordinal) => void
    attachmentsUpload: (
      paths: ReadonlyArray<T.Chat.PathAndOutboxID>,
      titles: ReadonlyArray<string>,
      tlfName?: string,
      spoiler?: boolean
    ) => void
    attachFromDragAndDrop: (
      paths: ReadonlyArray<T.Chat.PathAndOutboxID>,
      titles: ReadonlyArray<string>
    ) => void
    badgesUpdated: (badge: number) => void
    blockConversation: (reportUser: boolean) => void
    botCommandsUpdateStatus: (b: T.RPCChat.UIBotCommandsUpdateStatus) => void
    channelSuggestionsTriggered: () => void
    clearAttachmentView: () => void
    defer: {
      chatInboxLayoutSmallTeamsFirstConvID: () => T.Chat.ConversationIDKey | undefined
      chatInboxRefresh: (reason: RefreshReason) => void
      chatMetasReceived: (metas: ReadonlyArray<T.Chat.ConversationMeta>) => void
    }
    dismissBottomBanner: () => void
    dismissJourneycard: (cardType: T.RPCChat.JourneycardType, ordinal: T.Chat.Ordinal) => void
    editBotSettings: (
      username: string,
      allowCommands: boolean,
      allowMentions: boolean,
      convs?: ReadonlyArray<string>
    ) => void
    giphySend: (result: T.RPCChat.GiphySearchResult) => void
    hideConversation: (hide: boolean) => void
    joinConversation: () => void
    jumpToRecent: () => void
    leaveConversation: (navToInbox?: boolean) => void
    loadAttachmentView: (viewType: T.RPCChat.GalleryItemTyp, fromMsgID?: T.Chat.MessageID) => void
    loadMessagesCentered: (
      messageID: T.Chat.MessageID,
      highlightMode: T.Chat.CenterOrdinalHighlightMode
    ) => void
    loadOlderMessagesDueToScroll: (numOrdinals: number) => void
    loadNewerMessagesDueToScroll: (numOrdinals: number) => void
    loadMoreMessages: DebouncedFunc<(p: LoadMoreMessagesParams) => void>
    loadNextAttachment: (from: T.Chat.Ordinal, backInTime: boolean) => Promise<T.Chat.Ordinal>
    markThreadAsRead: (force?: boolean) => void
    markTeamAsRead: (teamID: T.Teams.TeamID) => void
    messageAttachmentNativeSave: (ordinal: T.Chat.Ordinal) => void
    messageAttachmentNativeShare: (ordinal: T.Chat.Ordinal, fromDownload?: boolean) => void
    messageDelete: (ordinal: T.Chat.Ordinal) => void
    messageDeleteHistory: () => void
    messageReplyPrivately: (ordinal: T.Chat.Ordinal) => void
    messageRetry: (outboxID: T.Chat.OutboxID) => void
    messagesClear: () => void
    messagesExploded: (messageIDs: ReadonlyArray<T.Chat.MessageID>, explodedBy?: string) => void
    messagesWereDeleted: (p: {
      messageIDs?: ReadonlyArray<T.Chat.MessageID>
      upToMessageID?: T.Chat.MessageID // expunge calls give us a message we should delete up to (don't delete it)
      deletableMessageTypes?: ReadonlySet<T.Chat.MessageType> // expunge calls don't delete _all_ messages, only these types
      ordinals?: ReadonlyArray<T.Chat.Ordinal>
    }) => void
    mute: (m: boolean) => void
    navigateToThread: (
      reason: NavReason,
      highlightMessageID?: T.Chat.MessageID,
      pushBody?: string,
      threadSearchQuery?: string,
      createConversationError?: T.Chat.CreateConversationError
    ) => void
    openFolder: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    onIncomingMessage: (incoming: T.RPCChat.IncomingMessage) => void
    onMessageErrored: (outboxID: T.Chat.OutboxID, reason: string, errorTyp?: number) => void
    onMessagesUpdated: (messagesUpdated: T.RPCChat.MessagesUpdated) => void
    paymentInfoReceived: (messageID: T.RPCChat.MessageID, paymentInfo: T.Chat.ChatPaymentInfo) => void
    pinMessage: (messageID?: T.Chat.MessageID) => void
    ignorePinnedMessage: () => void
    refreshBotRoleInConv: (username: string) => void
    refreshBotSettings: (username: string) => void
    removeBotMember: (username: string) => void
    replyJump: (messageID: T.Chat.MessageID) => void
    resetChatWithoutThem: () => void
    resetLetThemIn: (username: string) => void
    resetState: () => void
    resetDeleteMe: true
    resolveMaybeMention: (name: string, channel: string) => void
    selectedConversation: () => void
    sendAudioRecording: (path: string, duration: number, amps: ReadonlyArray<number>) => Promise<void>
    sendMessage: (text: string) => void
    setConvRetentionPolicy: (policy: T.Retention.RetentionPolicy) => void
    setExplodingMode: (seconds: number, incoming?: boolean) => void
    setMarkAsUnread: (readMsgID?: T.Chat.MessageID | false) => void
    setMeta: (m?: T.Chat.ConversationMeta) => void
    setMinWriterRole: (role: T.Teams.TeamRoleType) => void
    setParticipants: (p: ConvoState['participants']) => void
    setTyping: DebouncedFunc<(t: Set<string>) => void>
    showInfoPanel: (show: boolean, tab: 'settings' | 'members' | 'attachments' | 'bots' | undefined) => void
    tabSelected: () => void
    toggleMessageCollapse: (messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => void
    toggleMessageReaction: (ordinal: T.Chat.Ordinal, emoji: string) => void
    toggleThreadSearch: (hide?: boolean, query?: string) => void
    unfurlResolvePrompt: (
      messageID: T.Chat.MessageID,
      domain: string,
      result: T.RPCChat.UnfurlPromptResult
    ) => void
    unfurlRemove: (messageID: T.Chat.MessageID) => void
    updateCoinFlipStatus: (status: T.RPCChat.UICoinFlipStatus) => void
    updateCoinFlipStatuses: (statuses: ReadonlyArray<T.RPCChat.UICoinFlipStatus>) => void
    updateDraft: DebouncedFunc<(text: string) => void>
    updateMeta: (pm: Partial<T.Chat.ConversationMeta>) => void
    updateFromUIInboxLayout: (l: {
      isMuted: boolean
      draft?: string | null
      teamname?: string
      channelname?: string
      layoutName?: string
      snippet?: string | null
      snippetDecoration?: T.RPCChat.SnippetDecoration
      time?: number
    }) => void
    unreadUpdated: (unread: number) => void
    updateNotificationSettings: (
      notificationsDesktop: T.Chat.NotificationsType,
      notificationsMobile: T.Chat.NotificationsType,
      notificationsGlobalIgnoreMentions: boolean
    ) => void
    updateReactions: (
      updates: ReadonlyArray<{targetMsgID: T.Chat.MessageID; reactions?: T.Chat.Reactions}>
    ) => void
  }
  isMetaGood: () => boolean
  isCaughtUp: () => boolean
  getConvID: () => Uint8Array
}

// don't bug the users with black bars for network errors. chat isn't going to work in general
const ignoreErrors = [
  T.RPCGen.StatusCode.scgenericapierror,
  T.RPCGen.StatusCode.scapinetworkerror,
  T.RPCGen.StatusCode.sctimeout,
]

const makeAttachmentViewInfo = (): T.Chat.AttachmentViewInfo => ({
  last: false,
  messages: [],
  status: 'loading',
})

// Backend gives us messageIDs sometimes so we need to find our ordinal
const messageIDToOrdinal = (
  map: ConvoState['messageMap'],
  pendingOutboxToOrdinal: ConvoState['pendingOutboxToOrdinal'] | undefined,
  messageID: T.Chat.MessageID,
  indexed?: ReadonlyMap<T.Chat.MessageID, T.Chat.Ordinal>
) => {
  const indexedOrdinal = indexed?.get(messageID)
  if (indexedOrdinal !== undefined && map.get(indexedOrdinal)?.id === messageID) {
    return indexedOrdinal
  }

  // A message we didn't send in this session?
  let m = map.get(T.Chat.numberToOrdinal(messageID))
  if (m?.id !== 0 && m?.id === messageID) {
    return m.ordinal
  }
  // Search through our sent messages
  if (pendingOutboxToOrdinal) {
    for (const ordinal of pendingOutboxToOrdinal.values()) {
      m = map.get(ordinal)
      if (m?.id !== 0 && m?.id === messageID) {
        return ordinal
      }
    }
  }

  return null
}

type ScrollDirection = 'none' | 'back' | 'forward'
export const numMessagesOnInitialLoad = isMobile ? 20 : 100
export const numMessagesOnScrollback = isMobile ? 100 : 100

const stubDefer: ConvoState['dispatch']['defer'] = {
  chatInboxLayoutSmallTeamsFirstConvID: () => {
    throw new Error('convostate defer not initialized')
  },
  chatInboxRefresh: () => {
    throw new Error('convostate defer not initialized')
  },
  chatMetasReceived: () => {
    throw new Error('convostate defer not initialized')
  },
}

let convoDeferImpl: ConvoState['dispatch']['defer'] | undefined = __DEV__
  ? (globalThis.__hmr_convoDeferImpl as ConvoState['dispatch']['defer'] | undefined)
  : undefined

export const setConvoDefer = (impl: ConvoState['dispatch']['defer']) => {
  convoDeferImpl = impl
  if (__DEV__) globalThis.__hmr_convoDeferImpl = impl
  for (const store of chatStores.values()) {
    const s = store.getState()
    store.setState({
      ...s,
      dispatch: {
        ...s.dispatch,
        defer: impl,
      },
    })
  }
}

export const onRouteChanged = (prev: T.Immutable<Router2.NavState>, next: T.Immutable<Router2.NavState>) => {
  const wasModal = prev && getModalStack(prev).length > 0
  const isModal = next && getModalStack(next).length > 0
  // ignore if changes involve a modal
  if (!wasModal && !isModal) {
    const p = getVisibleScreen(prev)
    const n = getVisibleScreen(next)
    const wasChat = p?.name === Common.threadRouteName
    const isChat = n?.name === Common.threadRouteName
    // nothing to do with chat
    if (wasChat || isChat) {
      const pParams = p?.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
      const nParams = n?.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
      const wasID = pParams?.conversationIDKey
      const isID = nParams?.conversationIDKey

      logger.info('maybeChangeChatSelection ', {isChat, isID, wasChat, wasID})

      // same? ignore
      if (!(wasChat && isChat && wasID === isID && (!isID || getConvoState(isID).loaded))) {
        const deselectAction = () => {
          if (wasChat && wasID && T.Chat.isValidConversationIDKey(wasID)) {
            unboxRows([wasID], true)
            // needed?
            // getConvoState(wasID).dispatch.clearOrangeLine('deselected')
          }
        }

        // still chatting? just select new one
        if (wasChat && isChat && isID && T.Chat.isValidConversationIDKey(isID)) {
          deselectAction()
          getConvoState(isID).dispatch.selectedConversation()
        } else if (wasChat && !isChat) {
          // leaving a chat
          deselectAction()
        } else if (isChat && isID && T.Chat.isValidConversationIDKey(isID)) {
          // going into a chat
          deselectAction()
          getConvoState(isID).dispatch.selectedConversation()
        }
      }
    }
  }

  if (getTab(prev) !== Tabs.chatTab && getTab(next) === Tabs.chatTab) {
    const n = getVisibleScreen(next)
    const nParams = n?.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
    const isID = nParams?.conversationIDKey
    isID && getConvoState(isID).dispatch.tabSelected()
  }
}

export const metasReceived = (
  metas: ReadonlyArray<T.Chat.ConversationMeta>,
  removals?: ReadonlyArray<T.Chat.ConversationIDKey>
) => {
  removals?.forEach(r => {
    getConvoState(r).dispatch.setMeta()
  })
  metas.forEach(m => {
    const {meta: oldMeta, dispatch, isMetaGood} = getConvoState(m.conversationIDKey)
    if (isMetaGood()) {
      dispatch.updateMeta(Meta.updateMeta(oldMeta, m))
    } else {
      dispatch.setMeta(m)
    }
  })
}

export const hydrateInboxLayout = (layout: T.RPCChat.UIInboxLayout) => {
  layout.smallTeams?.forEach(t => {
    const cs = getConvoState(t.convID)
    cs.dispatch.updateFromUIInboxLayout({
      ...t,
      layoutName: t.name || '',
      snippet: t.snippet ?? undefined,
      teamname: t.isTeam ? t.name || '' : '',
      time: t.time || 0,
    })
  })
  layout.bigTeams?.forEach(t => {
    if (t.state === T.RPCChat.UIInboxBigTeamRowTyp.channel) {
      const cs = getConvoState(t.channel.convID)
      cs.dispatch.updateFromUIInboxLayout({
        ...t.channel,
        snippet: undefined,
        time: undefined,
      })
    }
  })
  // Flush inbox row updates synchronously to prevent flash of empty content
  flushInboxRowUpdates()
}

let metaQueue: Set<T.Chat.ConversationIDKey> = __DEV__
  ? (((globalThis as {__hmr_convoMetaQueue?: Set<T.Chat.ConversationIDKey>}).__hmr_convoMetaQueue ??=
      new Set()) as Set<T.Chat.ConversationIDKey>)
  : new Set()

const clearMetaQueue = () => {
  metaQueue.clear()
}

registerExternalResetter('convo-meta-queue', clearMetaQueue)

const untrustedConversationIDKeys = (ids: ReadonlyArray<T.Chat.ConversationIDKey>) =>
  ids.filter(id => getConvoState(id).meta.trustedState === 'untrusted')

export const unboxRows = (ids: ReadonlyArray<T.Chat.ConversationIDKey>, force?: boolean) => {
  const f = async () => {
    if (!useConfigState.getState().loggedIn) {
      return
    }

    const conversationIDKeys = ids.reduce<Array<string>>((arr, id) => {
      if (id && T.Chat.isValidConversationIDKey(id)) {
        const cs = getConvoState(id)
        const trustedState = cs.meta.trustedState
        if (force || (trustedState !== 'requesting' && trustedState !== 'trusted')) {
          arr.push(id)
          cs.dispatch.updateMeta({trustedState: 'requesting'})
        }
      }
      return arr
    }, [])

    if (!conversationIDKeys.length) {
      return
    }
    logger.info(`unboxRows: unboxing len: ${conversationIDKeys.length} convs: ${conversationIDKeys.join(',')}`)
    try {
      await T.RPCChat.localRequestInboxUnboxRpcPromise({
        convIDs: conversationIDKeys.map(k => T.Chat.keyToConversationID(k)),
      })
    } catch (error) {
      if (error instanceof RPCError) {
        logger.info(`unboxRows: failed ${error.desc}`)
      }
    }
  }
  ignorePromise(f())
}

export const queueMetaHandle = () => {
  const f = async () => {
    const maxToUnboxAtATime = 10
    const ar = [...metaQueue]
    const maybeUnbox = ar.slice(0, maxToUnboxAtATime)
    metaQueue = new Set(ar.slice(maxToUnboxAtATime))
    if (__DEV__) {
      ;(globalThis as {__hmr_convoMetaQueue?: Set<T.Chat.ConversationIDKey>}).__hmr_convoMetaQueue = metaQueue
    }
    const conversationIDKeys = untrustedConversationIDKeys(maybeUnbox)
    if (conversationIDKeys.length) {
      unboxRows(conversationIDKeys)
    }
    if (metaQueue.size && conversationIDKeys.length) {
      await timeoutPromise(100)
    }
    if (metaQueue.size) {
      queueMetaHandle()
    }
  }
  ignorePromise(f())
}

export const queueMetaToRequest = (ids: ReadonlyArray<T.Chat.ConversationIDKey>) => {
  const prevSize = metaQueue.size
  untrustedConversationIDKeys(ids).forEach(k => metaQueue.add(k))
  if (__DEV__) {
    ;(globalThis as {__hmr_convoMetaQueue?: Set<T.Chat.ConversationIDKey>}).__hmr_convoMetaQueue = metaQueue
  }
  if (metaQueue.size > prevSize) {
    queueMetaHandle()
  } else {
    logger.info('skipping meta queue run, queue unchanged')
  }
}

export const ensureWidgetMetas = (
  widgetList: ReadonlyArray<{convID: T.Chat.ConversationIDKey}> | undefined
) => {
  if (!widgetList) {
    return
  }
  const missing = widgetList.reduce<Array<T.Chat.ConversationIDKey>>((l, v) => {
    if (!getConvoState(v.convID).isMetaGood()) {
      l.push(v.convID)
    }
    return l
  }, [])
  if (missing.length === 0) {
    return
  }
  unboxRows(missing, true)
}

const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')

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
      case 'edit': // daemon filters this out for us so we can ignore
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

const createSlice =
  (
    id: T.Chat.ConversationIDKey = noConversationIDKey,
    getLinkedUIState: () => ConvoUIState = () => getConvoUIState(id)
  ): Z.ImmerStateCreator<ConvoState> =>
  (set, get) => {
    const defer = convoDeferImpl ?? stubDefer
    const getUI = getLinkedUIState
    const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
    const getCurrentUser = () => {
      const s = useCurrentUserState.getState()
      return {devicename: s.deviceName, username: s.username}
    }

    const downloadAttachment = async (downloadToCache: boolean, ordinal: T.Chat.Ordinal) => {
      const messageID = get().messageMap.get(ordinal)?.id
      if (!messageID) return false
      try {
        const rpcRes = await T.RPCChat.localDownloadFileAttachmentLocalRpcPromise({
          conversationID: get().getConvID(),
          downloadToCache,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          messageID,
          preview: false,
        })

        const path = rpcRes.filePath
        set(s => {
          const m = s.messageMap.get(ordinal)
          if (m?.type === 'attachment') {
            m.downloadPath = path
            m.fileURLCached = true // assume we have this on the service now
            m.transferErrMsg = undefined
            m.transferProgress = 1
            m.transferState = undefined
          }
        })
        updateAttachmentViewTransfered(messageID, path)
        return rpcRes.filePath
      } catch (error) {
        const errMsg =
          error instanceof RPCError
            ? error.message || 'Error downloading attachment'
            : 'Error downloading attachment'
        if (error instanceof RPCError) logger.info(`downloadAttachment error: ${error.message}`)
        set(s => {
          const m = s.messageMap.get(ordinal)
          if (m?.type === 'attachment') {
            m.downloadPath = ''
            m.fileURLCached = true // assume we have this on the service now
            m.transferErrMsg = errMsg
            m.transferProgress = 0
            m.transferState = undefined
          }
        })
        updateAttachmentViewTransfered(messageID, '')
        return false
      }
    }

    const getClientPrev = (): T.Chat.MessageID => {
      let clientPrev: undefined | T.Chat.MessageID
      const mm = get().messageMap
      // find last valid messageid we know about
      const goodOrdinal = findLast(get().messageOrdinals ?? [], o => {
        const m = mm.get(o)
        return !!m?.id
      })

      if (goodOrdinal) {
        const message = mm.get(goodOrdinal)
        clientPrev = message?.id
      }
      return clientPrev || T.Chat.numberToMessageID(0)
    }

    const clearMessageIDIndexForOrdinal = (
      state: Z.WritableDraft<ConvoState>,
      ordinal: T.Chat.Ordinal,
      knownMessage?: T.Chat.Message
    ) => {
      const message = knownMessage ?? state.messageMap.get(ordinal)
      if (message?.id) {
        state.messageIDToOrdinal.delete(message.id)
      }
    }

    const indexMessage = (
      state: Z.WritableDraft<ConvoState>,
      ordinal: T.Chat.Ordinal,
      message: T.Chat.Message
    ) => {
      if (message.id) {
        state.messageIDToOrdinal.set(message.id, ordinal)
      }
    }

    const maybeGetOrdinalByMessageID = (
      state: Pick<ConvoState, 'messageIDToOrdinal' | 'messageMap' | 'pendingOutboxToOrdinal'>,
      messageID: T.Chat.MessageID
    ) =>
      messageIDToOrdinal(state.messageMap, state.pendingOutboxToOrdinal, messageID, state.messageIDToOrdinal)

    const findOrdinalIndex = (ordinals: ReadonlyArray<T.Chat.Ordinal>, ordinal: T.Chat.Ordinal) => {
      let low = 0
      let high = ordinals.length
      while (low < high) {
        const mid = Math.floor((low + high) / 2)
        if (ordinals[mid]! < ordinal) {
          low = mid + 1
        } else {
          high = mid
        }
      }
      return low
    }

    const refreshDerivedMetadata = (
      s: Z.WritableDraft<ConvoState>,
      changedOrdinals: ReadonlySet<T.Chat.Ordinal>
    ) => {
      if (changedOrdinals.size === 0) {
        return
      }

      const messageOrdinals = s.messageOrdinals ?? []
      const you = useCurrentUserState.getState().username
      const ordinalsToRefresh = new Set(changedOrdinals)

      for (const ordinal of changedOrdinals) {
        const idx = findOrdinalIndex(messageOrdinals, ordinal)
        const maybeCurrent = messageOrdinals[idx]
        const nextOrdinal = maybeCurrent === ordinal ? messageOrdinals[idx + 1] : maybeCurrent
        if (nextOrdinal !== undefined) {
          ordinalsToRefresh.add(nextOrdinal)
        }
      }

      for (const ordinal of ordinalsToRefresh) {
        const idx = findOrdinalIndex(messageOrdinals, ordinal)
        if (messageOrdinals[idx] !== ordinal) {
          s.rowRecycleTypeMap.delete(ordinal)
          s.separatorMap.delete(ordinal)
          s.showUsernameMap.delete(ordinal)
          continue
        }

        const previousOrdinal = idx > 0 ? messageOrdinals[idx - 1]! : T.Chat.numberToOrdinal(0)
        const message = s.messageMap.get(ordinal)
        if (!message) {
          s.rowRecycleTypeMap.delete(ordinal)
          s.separatorMap.delete(ordinal)
          s.showUsernameMap.delete(ordinal)
          continue
        }

        s.separatorMap.set(ordinal, previousOrdinal)
        const previousMessage = idx > 0 ? s.messageMap.get(previousOrdinal) : undefined
        s.showUsernameMap.set(ordinal, getUsernameToShow(message, previousMessage, you))
        setRowRenderDerivedMetadata(s, ordinal, message)
      }
    }

    const getRowRecycleType = (
      message: T.Chat.Message,
      renderType: T.Chat.RenderMessageType
    ): string | undefined => {
      let rowRecycleType = renderType
      let needsSpecificRecycleType = false

      if (
        (message.type === 'text' || message.type === 'attachment') &&
        (message.submitState === 'pending' || message.submitState === 'failed')
      ) {
        rowRecycleType += ':pending'
        needsSpecificRecycleType = true
      }

      if (message.type === 'text' && message.replyTo) {
        rowRecycleType += ':reply'
        needsSpecificRecycleType = true
      }
      if (message.reactions?.size) {
        rowRecycleType += ':reactions'
        needsSpecificRecycleType = true
      }

      return needsSpecificRecycleType ? rowRecycleType : undefined
    }

    const setRowRenderDerivedMetadata = (
      s: Z.WritableDraft<ConvoState>,
      ordinal: T.Chat.Ordinal,
      message: T.Chat.Message
    ) => {
      const renderType = s.messageTypeMap.get(ordinal) ?? Message.getMessageRenderType(message)
      const rowRecycleType = getRowRecycleType(message, renderType)
      if (rowRecycleType) {
        s.rowRecycleTypeMap.set(ordinal, rowRecycleType)
      } else {
        s.rowRecycleTypeMap.delete(ordinal)
      }
    }

    const mergeMessage = (
      existing: Z.WritableDraft<T.Chat.Message>,
      incoming: Z.WritableDraft<T.Chat.Message>
    ) => {
      const existingRecord = existing as Record<string, unknown>
      const incomingRecord = incoming as Record<string, unknown>
      const allKeys = new Set([...Object.keys(existingRecord), ...Object.keys(incomingRecord)])
      for (const key of allKeys) {
        const val = incomingRecord[key]
        const cur = existingRecord[key]
        if (val instanceof HiddenString) {
          if (!(cur instanceof HiddenString) || !val.equals(cur)) {
            existingRecord[key] = val
          }
        } else if (val instanceof Map) {
          if (cur instanceof Map) {
            for (const k of (cur as Map<unknown, unknown>).keys()) {
              if (!(val as Map<unknown, unknown>).has(k)) {
                ;(cur as Map<unknown, unknown>).delete(k)
              }
            }
            for (const [k, v] of val as Map<unknown, unknown>) {
              ;(cur as Map<unknown, unknown>).set(k, v)
            }
          } else {
            existingRecord[key] = val
          }
        } else {
          // covers: incoming has a value (set it), incoming lacks the key (val is undefined, clears it)
          if (cur !== val) existingRecord[key] = val
        }
      }
    }

    const desktopNotification = (author: string, body: string) => {
      if (isMobile) return

      // Show a desktop notification
      const {meta, id: conversationIDKey} = get()
      if (
        Common.isUserActivelyLookingAtThisThread(conversationIDKey) ||
        meta.isMuted // ignore muted convos
      ) {
        logger.info('not sending notification')
        return
      }

      logger.info('sending chat notification')
      let title = ['small', 'big'].includes(meta.teamType) ? meta.teamname : author
      if (meta.teamType === 'big') {
        title += `#${meta.channelname}`
      }

      const onClick = () => {
        useConfigState.getState().dispatch.showMain()
        navigateToInbox()
        get().dispatch.navigateToThread('desktopNotification')
      }
      const onClose = () => {}
      logger.info('invoking NotifyPopup for chat notification')
      const sound = useConfigState.getState().notifySound

      const cleanBody = body.replaceAll(/!>(.*?)<!/g, '•••')

      NotifyPopup(title, {body: cleanBody, sound}, -1, author, onClick, onClose)
    }

    const messagesAdd = (
      messages: Array<T.Chat.Message>,
      opt: {
        why: string
        markAsRead?: boolean
        incomingMessage?: boolean
        validatedRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}
      }
    ) => {
      const {why, markAsRead = true, incomingMessage = false, validatedRange} = opt
      logger.info('[CHATDEBUG] adding', messages.length, why, messages.at(0)?.id, messages.at(-1)?.id)

      // we can't allow gaps in the ordinals so if we get an incoming message and we're in a search ignore it
      if (incomingMessage && !get().isCaughtUp()) {
        return
      }

      set(s => {
        // Build set of incoming regular ordinals for ordinal management
        const incomingOrdinals = new Set<T.Chat.Ordinal>()
        const touchedOrdinals = new Set<T.Chat.Ordinal>()
        for (const m of messages) {
          if (m.conversationMessage !== false && m.type !== 'deleted') {
            incomingOrdinals.add(m.ordinal)
          }
        }

        for (const _m of messages) {
          const m = T.castDraft(_m)
          const regularMessage = m.conversationMessage !== false

          if (regularMessage && m.type === 'deleted') {
            touchedOrdinals.add(m.ordinal)
            clearMessageIDIndexForOrdinal(s, m.ordinal)
            s.messageMap.delete(m.ordinal)
            s.messageTypeMap.delete(m.ordinal)
          } else {
            let mapOrdinal = m.ordinal
            // if we've sent it we use the outbox id to manage the ordinal relationship
            if (regularMessage && m.outboxID) {
              const existingSent = s.pendingOutboxToOrdinal.get(m.outboxID)
              if (existingSent) {
                mapOrdinal = existingSent
              }
            }
            // never set a placeholder on top of any other data
            if (m.type === 'placeholder') {
              const old = s.messageMap.get(mapOrdinal)
              if (old && old.type !== 'placeholder') {
                // ignore it
                continue
              }
            }

            if (m.ordinal !== mapOrdinal) {
              // Outbox remap: fix incomingOrdinals so the original ordinal doesn't
              // get merged into messageOrdinals with no backing message
              if (regularMessage && m.type !== 'deleted') {
                incomingOrdinals.delete(m.ordinal)
                incomingOrdinals.add(mapOrdinal)
              }
              m.ordinal = mapOrdinal
            }

            if (regularMessage) {
              touchedOrdinals.add(mapOrdinal)
            }

            const existingMsg = s.messageMap.get(mapOrdinal)
            if (existingMsg?.type === m.type) {
              if (existingMsg.id && existingMsg.id !== m.id) {
                s.messageIDToOrdinal.delete(existingMsg.id)
              }
              mergeMessage(existingMsg, m)
              indexMessage(s, mapOrdinal, existingMsg)
              if (m.type !== 'text') {
                s.messageTypeMap.set(mapOrdinal, Message.getMessageRenderType(m))
              }
              continue
            }

            if (existingMsg) {
              clearMessageIDIndexForOrdinal(s, mapOrdinal, existingMsg)
            }
            s.messageMap.set(mapOrdinal, T.castDraft(m))
            indexMessage(s, mapOrdinal, m)
            if (
              regularMessage &&
              m.outboxID &&
              T.Chat.messageIDToNumber(m.id) !== T.Chat.ordinalToNumber(m.ordinal)
            ) {
              s.pendingOutboxToOrdinal.set(m.outboxID, mapOrdinal)
            }
            if (m.type === 'text') {
              s.messageTypeMap.delete(mapOrdinal)
            } else {
              s.messageTypeMap.set(mapOrdinal, Message.getMessageRenderType(m))
            }
          }
        }

        // Merge incoming ordinals into existing
        const existing = new Set(s.messageOrdinals ?? [])
        let changed = false
        for (const o of incomingOrdinals) {
          if (!existing.has(o)) {
            existing.add(o)
            changed = true
          }
        }
        // Remove deleted ordinals
        for (const _m of messages) {
          const m = T.castDraft(_m)
          if (m.conversationMessage !== false && m.type === 'deleted') {
            if (existing.has(m.ordinal)) {
              existing.delete(m.ordinal)
              changed = true
            }
          }
        }
        // Reconcile via validatedRange: prune ordinals within the range that the server didn't return
        if (validatedRange) {
          for (const o of existing) {
            if (o >= validatedRange.from && o <= validatedRange.to && !incomingOrdinals.has(o)) {
              touchedOrdinals.add(o)
              clearMessageIDIndexForOrdinal(s, o)
              existing.delete(o)
              s.messageMap.delete(o)
              s.messageTypeMap.delete(o)
              changed = true
            }
          }
          // Expand the validated range (union of old + new)
          const prev = s.validatedOrdinalRange
          if (prev) {
            s.validatedOrdinalRange = {
              from: Math.min(prev.from, validatedRange.from) as T.Chat.Ordinal,
              to: Math.max(prev.to, validatedRange.to) as T.Chat.Ordinal,
            }
          } else {
            s.validatedOrdinalRange = validatedRange
          }
        }
        if (changed || !s.messageOrdinals) {
          s.messageOrdinals = [...existing].sort((a, b) => a - b)
        }

        refreshDerivedMetadata(s, touchedOrdinals)
      })

      if (markAsRead) {
        get().dispatch.markThreadAsRead()
      }
    }
    const metaReceivedError = (error: T.RPCChat.InboxUIItemError, username: string) => {
      if (
        error.typ === T.RPCChat.ConversationErrorType.otherrekeyneeded ||
        error.typ === T.RPCChat.ConversationErrorType.selfrekeyneeded
      ) {
        const {rekeyInfo} = error
        const participants = [
          ...(rekeyInfo
            ? new Set<string>(
                ([] as Array<string>)
                  .concat(rekeyInfo.writerNames || [], rekeyInfo.readerNames || [])
                  .filter(Boolean)
              )
            : new Set<string>(error.unverifiedTLFName.split(','))),
        ]

        const rekeyers = new Set<string>(
          error.typ === T.RPCChat.ConversationErrorType.selfrekeyneeded
            ? [username || '']
            : rekeyInfo?.rekeyers || []
        )
        const newMeta = Meta.unverifiedInboxUIItemToConversationMeta(error.remoteConv)
        if (!newMeta) {
          // public conversation, do nothing
          return
        }
        get().dispatch.setMeta({
          ...newMeta,
          rekeyers,
          snippet: error.message,
          snippetDecoration: T.RPCChat.SnippetDecoration.none,
          trustedState: 'error' as const,
        })
        get().dispatch.setParticipants({
          all: participants,
          contactName: noParticipantInfo.contactName,
          name: participants,
        })
      } else {
        set(s => {
          s.meta.snippet = error.message
          s.meta.snippetDecoration = T.RPCChat.SnippetDecoration.none
          s.meta.trustedState = 'error'
        })
        queueInboxRowUpdate(get().id)
      }
    }

    const onChatPaymentInfo = (action: EngineGen.EngineAction<'chat.1.NotifyChat.ChatPaymentInfo'>) => {
      const {convID, info, msgID} = action.payload.params
      const conversationIDKey = T.Chat.conversationIDToKey(convID)
      const paymentInfo = Message.uiPaymentInfoToChatPaymentInfo([info])
      if (!paymentInfo) {
        // This should never happen
        const errMsg = `got 'NotifyChat.ChatPaymentInfo' with no valid paymentInfo for convID ${conversationIDKey} messageID: ${msgID}. The local version may be absent or out of date.`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      getConvoState(conversationIDKey).dispatch.paymentInfoReceived(msgID, paymentInfo)
    }

    const onGiphyToggleWindow = (
      action: EngineGen.EngineAction<'chat.1.chatUi.chatGiphyToggleResultWindow'>
    ) => {
      const {show, clearInput} = action.payload.params
      if (clearInput) {
        getUI().dispatch.injectIntoInput('')
      }
      getUI().dispatch.setGiphyWindow(show)
    }

    const refreshMutualTeamsInConv = () => {
      const f = async () => {
        const {id: conversationIDKey} = get()
        const username = useCurrentUserState.getState().username
        const otherParticipants = Meta.getRowParticipants(get().participants, username || '')
        const results = await T.RPCChat.localGetMutualTeamsLocalRpcPromise(
          {usernames: otherParticipants},
          Strings.waitingKeyChatMutualTeams(conversationIDKey)
        )
        set(s => {
          s.mutualTeams = T.castDraft(results.teamIDs) ?? []
        })
      }
      ignorePromise(f())
    }

    const setMessageCenterOrdinal = (m?: T.Chat.CenterOrdinal) => {
      set(s => {
        s.messageCenterOrdinal = m
      })
    }

    const toggleLocalReaction = (p: {
      decorated: string
      emoji: string
      targetOrdinal: T.Chat.Ordinal
      username: string
    }) => {
      const {decorated, emoji, targetOrdinal, username} = p
      set(s => {
        const m = s.messageMap.get(targetOrdinal)
        if (m && Message.isMessageWithReactions(m)) {
          if (!m.reactions) {
            m.reactions = new Map()
          }
          const existing = m.reactions.get(emoji)
          if (existing) {
            const userIndex = existing.users.findIndex(u => u.username === username)
            if (userIndex >= 0) {
              existing.users = existing.users.filter(u => u.username !== username)
              if (existing.users.length === 0) {
                m.reactions.delete(emoji)
              }
            } else {
              existing.users = [...existing.users, {timestamp: Date.now(), username}]
            }
          } else {
            m.reactions.set(emoji, {
              decorated,
              users: [{timestamp: Date.now(), username}],
            })
          }
          setRowRenderDerivedMetadata(s, targetOrdinal, m)
        }
      })
    }

    const unfurlTogglePrompt = (messageID: T.Chat.MessageID, domain: string, show: boolean) => {
      set(s => {
        const prompts = mapGetEnsureValue(s.unfurlPrompt, messageID, new Set())
        if (show) {
          prompts.add(domain)
        } else {
          prompts.delete(domain)
        }
      })
    }

    const updateAttachmentViewTransfer = (msgId: number, ratio: number) => {
      set(s => {
        const viewType = T.RPCChat.GalleryItemTyp.doc
        const info = mapGetEnsureValue(s.attachmentViewMap, viewType, T.castDraft(makeAttachmentViewInfo()))
        const {messages} = info
        const idx = messages.findIndex(item => item.id === msgId)
        if (idx !== -1) {
          const m = messages[idx]
          if (m!.type === 'attachment') {
            m.transferState = 'downloading'
            m.transferProgress = ratio
          }
        }
      })
    }

    const updateAttachmentViewTransfered = (msgId: number, path: string) => {
      set(s => {
        const viewType = T.RPCChat.GalleryItemTyp.doc
        const info = mapGetEnsureValue(s.attachmentViewMap, viewType, T.castDraft(makeAttachmentViewInfo()))
        const {messages} = info
        const idx = messages.findIndex(item => item.id === msgId)
        if (idx !== -1) {
          const m = messages[idx]
          if (m!.type === 'attachment') {
            m.downloadPath = path
            m.fileURLCached = true
            m.transferProgress = 0
            m.transferState = undefined
          }
        }
      })
    }

    let lastScrollNumOrdinals = 0
    let lastScrollTime = 0
    const okToLoadMore = (n: number) => {
      const now = Date.now()
      if (n !== lastScrollNumOrdinals) {
        lastScrollNumOrdinals = n
        lastScrollTime = now
        return true
      }

      const delta = now - lastScrollTime
      const ok = delta > 500
      if (ok) {
        lastScrollNumOrdinals = n
        lastScrollTime = now
      }
      return ok
    }

    const onDownloadComplete = (msgID: number) => {
      const ordinal = maybeGetOrdinalByMessageID(get(), T.Chat.numberToMessageID(msgID))
      if (!ordinal) {
        logger.info(`downloadComplete: no ordinal found: conversationIDKey: ${get().id} msgID: ${msgID}`)
        return
      }
      set(s => {
        const m = s.messageMap.get(ordinal)
        if (!m) {
          logger.info(
            `downloadComplete: no message found: conversationIDKey: ${get().id} ordinal: ${ordinal}`
          )
        } else {
          if (m.type === 'attachment') {
            m.transferProgress = 0
            m.transferState = undefined
          }
        }
      })
    }

    const onDownloadProgress = (msgID: number, bytesComplete: number, bytesTotal: number) => {
      const ratio = bytesComplete / bytesTotal
      updateAttachmentViewTransfer(msgID, ratio)
      const ordinal = maybeGetOrdinalByMessageID(get(), T.Chat.numberToMessageID(msgID))
      if (!ordinal) {
        logger.info(`downloadProgress: no ordinal found: conversationIDKey: ${get().id} msgID: ${msgID}`)
        return
      }
      set(s => {
        const m = s.messageMap.get(ordinal)
        if (!m) {
          logger.info(
            `downloadProgress: no message found: conversationIDKey: ${get().id} ordinal: ${ordinal}`
          )
          return
        }

        if (m.type !== 'attachment') return

        // don't update if we're 'done'
        if (!m.downloadPath && m.transferProgress !== 1) {
          m.transferErrMsg = undefined
          m.transferProgress = ratio
          m.transferState = 'downloading'
        }
      })
    }

    const onChatRequestInfo = (info: T.RPCChat.UIRequestInfo, msgID: number) => {
      const requestInfo = Message.uiRequestInfoToChatRequestInfo(info)
      if (!requestInfo) {
        // This should never happen
        const errMsg = `got 'NotifyChat.ChatRequestInfo' with no valid requestInfo for convID ${
          get().id
        } messageID: ${msgID}. The local version may be absent or out of date.`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      set(s => {
        s.accountsInfoMap.set(msgID, requestInfo)
      })
    }

    const onInboxFailed = (convID: Uint8Array, error: T.RPCChat.InboxUIItemError) => {
      const username = useCurrentUserState.getState().username
      const conversationIDKey = T.Chat.conversationIDToKey(convID)
      switch (error.typ) {
        case T.RPCChat.ConversationErrorType.transient:
          logger.info(
            `onFailed: ignoring transient error for convID: ${conversationIDKey} error: ${error.message}`
          )
          return
        default:
          logger.info(`onFailed: displaying error for convID: ${conversationIDKey} error: ${error.message}`)
          metaReceivedError(error, username)
      }
    }

    const onSetConvSettings = (conv: T.RPCChat.InboxUIItem | null | undefined) => {
      const newRole = conv?.convSettings?.minWriterRoleInfo?.role
      const role = newRole && TeamsUtil.teamRoleByEnum[newRole]
      const conversationIDKey = get().id
      const cannotWrite = conv?.convSettings?.minWriterRoleInfo?.cannotWrite || false
      logger.info(
        `got new minWriterRole ${role || ''} for convID ${conversationIDKey}, cannotWrite ${
          cannotWrite ? 1 : 0
        }`
      )
      if (role) {
        // only insert if the convo is already in the inbox
        if (get().isMetaGood()) {
          set(s => {
            s.meta.cannotWrite = cannotWrite
            s.meta.minWriterRole = role
          })
        }
      } else {
        logger.warn(
          `got NotifyChat.ChatSetConvSettings with no valid minWriterRole for convID ${conversationIDKey}. The local version may be out of date.`
        )
      }
    }

    const onAttachmentUpload = (params: {
      uid: string
      convID: Uint8Array
      outboxID: Uint8Array
      bytesComplete?: number
      bytesTotal?: number
    }) => {
      const ordinal = get().pendingOutboxToOrdinal.get(T.Chat.rpcOutboxIDToOutboxID(params.outboxID))
      if (!ordinal) return
      const {bytesComplete = 0, bytesTotal} = params
      const ratio = bytesTotal ? bytesComplete / bytesTotal : 0.01
      set(s => {
        const m = s.messageMap.get(ordinal)
        if (m?.type === 'attachment') {
          m.transferProgress = ratio
          m.transferState = 'uploading'
        }
      })
    }

    const onIncomingMutation = (
      conversationIDKey: string,
      valid: T.RPCChat.UIMessageValid,
      username: string,
      getLastOrdinal: () => T.Chat.Ordinal,
      devicename: string,
      modifiedMessage: T.RPCChat.UIMessage | null | undefined
    ) => {
      const body = valid.messageBody
      logger.info(`Got chat incoming message of messageType: ${body.messageType}`)
      // Types that are mutations, not rendered directly
      // see if we need to kill placeholders that resolved to these
      const toDelOrdinal = T.Chat.numberToOrdinal(valid.messageID)
      const existing = get().messageMap.get(toDelOrdinal)
      if (existing) {
        set(s => {
          clearMessageIDIndexForOrdinal(s, toDelOrdinal, existing)
          s.messageMap.delete(toDelOrdinal)
          s.messageTypeMap.delete(toDelOrdinal)
          if (s.messageOrdinals) {
            s.messageOrdinals = s.messageOrdinals.filter(o => o !== toDelOrdinal)
          }
          refreshDerivedMetadata(s, new Set([toDelOrdinal]))
        })
      }

      switch (body.messageType) {
        case T.RPCChat.MessageType.edit:
          if (modifiedMessage) {
            const modMessage = Message.uiMessageToMessage(
              conversationIDKey,
              modifiedMessage,
              username,
              getLastOrdinal,
              devicename
            )
            if (modMessage) {
              messagesAdd([modMessage], {why: 'onincoming edit'})
            }
          }
          return true
        case T.RPCChat.MessageType.delete: {
          const {delete: d} = body
          if (d.messageIDs) {
            // check if the delete is acting on an exploding message
            const messageIDs = T.Chat.numbersToMessageIDs(d.messageIDs)
            const messages = get().messageMap
            const isExplodeNow = messageIDs.some(id => {
              const ordinal = maybeGetOrdinalByMessageID(get(), id)
              const message = ordinal ? messages.get(ordinal) : undefined
              if ((message?.type === 'text' || message?.type === 'attachment') && message.exploding) {
                return true
              }
              return false
            })

            if (isExplodeNow) {
              get().dispatch.messagesExploded(messageIDs, valid.senderUsername)
            } else {
              get().dispatch.messagesWereDeleted({messageIDs})
            }
          }
          return true
        }
        default:
      }
      return false
    }

    const onAttachmentEdit = (placeholderID: number, message: Z.WritableDraft<T.Chat.MessageAttachment>) => {
      const ordinal = maybeGetOrdinalByMessageID(get(), T.Chat.numberToMessageID(placeholderID))
      const existing = ordinal ? get().messageMap.get(ordinal) : undefined
      if (ordinal && existing) {
        // keep this
        message.ordinal = ordinal
        const next = Message.upgradeMessage(existing, message)
        messagesAdd([next], {why: 'incoming existing attachupload'})
      } else {
        messagesAdd([message], {why: 'incoming new attachupload'})
      }
    }

    const _messageEdit = (ordinal: T.Chat.Ordinal, text: string) => {
      getUI().dispatch.injectIntoInput('')
      const m = get().messageMap.get(ordinal)
      if (!m || !(m.type === 'text' || m.type === 'attachment')) {
        logger.warn("Can't find message to edit", ordinal)
        return
      }
      // Skip if the content is the same
      if (m.type === 'text' && m.text.stringValue() === text) {
        getUI().dispatch.setEditing('clear')
        return
      } else if (m.type === 'attachment' && m.title === text) {
        getUI().dispatch.setEditing('clear')
        return
      }
      set(s => {
        const m1 = s.messageMap.get(ordinal)
        if (m1) {
          m1.submitState = 'editing'
        }
      })
      getUI().dispatch.setEditing('clear')

      const f = async () => {
        await T.RPCChat.localPostEditNonblockRpcPromise({
          body: text,
          clientPrev: getClientPrev(),
          conversationID: get().getConvID(),
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          outboxID: Common.generateOutboxID(),
          target: {
            messageID: m.id,
            outboxID: m.outboxID ? T.Chat.outboxIDToRpcOutboxID(m.outboxID) : undefined,
          },
          tlfName: get().meta.tlfname,
          tlfPublic: false,
        })
      }
      ignorePromise(f())
    }

    const _messageSend = (text: string, replyTo?: T.Chat.MessageID, waitingKey?: string) => {
      getUI().dispatch.injectIntoInput('')
      getUI().dispatch.setReplyTo(T.Chat.numberToOrdinal(0))
      set(s => {
        s.commandMarkdown = undefined
      })
      getUI().dispatch.setGiphyWindow(false)
      const f = async () => {
        const meta = get().meta
        const tlfName = meta.tlfname
        const clientPrev = getClientPrev()
        const convID = get().getConvID()

        // disable sending exploding messages if flag is false
        const ephemeralLifetime = get().explodingMode
        const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
        try {
          await T.RPCChat.localPostTextNonblockRpcListener({
            customResponseIncomingCallMap: {
              'chat.1.chatUi.chatStellarDataConfirm': (_, response) => {
                response.result(false) // immediate fail
              },
              'chat.1.chatUi.chatStellarDataError': (_, response) => {
                response.result(false) // immediate fail
              },
            },
            incomingCallMap: {
              'chat.1.chatUi.chatStellarDone': ({canceled}) => {
                if (canceled) {
                  getUI().dispatch.injectIntoInput(text)
                }
              },
              'chat.1.chatUi.chatStellarShowConfirm': () => {},
            },
            params: {
              ...ephemeralData,
              body: text,
              clientPrev,
              conversationID: convID,
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              outboxID: undefined,
              replyTo,
              tlfName,
              tlfPublic: false,
            },
            waitingKey,
          })
          logger.info('success')
        } catch {
          logger.info('error')
        }

        // If there are block buttons on this conversation, clear them.
        storeRegistry.getState('chat').dispatch.dismissBlockButtonsIfPresent(meta.teamID)

        // Do some logging to track down the root cause of a bug causing
        // messages to not send. Do this after creating the objects above to
        // narrow down the places where the action can possibly stop.
        logger.info('non-empty text?', text.length > 0)
      }
      ignorePromise(f())
    }

    const dispatch: ConvoState['dispatch'] = {
      addBotMember: (username, allowCommands, allowMentions, restricted, convs) => {
        const f = async () => {
          try {
            await T.RPCChat.localAddBotMemberRpcPromise(
              {
                botSettings: restricted ? {cmds: allowCommands, convs, mentions: allowMentions} : null,
                convID: get().getConvID(),
                role: restricted ? T.RPCGen.TeamRole.restrictedbot : T.RPCGen.TeamRole.bot,
                username,
              },
              Strings.waitingKeyChatBotAdd
            )
          } catch (error) {
            if (error instanceof RPCError) {
              logger.info('addBotMember: failed to add bot member: ' + error.message)
            }
            return
          }
        }
        ignorePromise(f())
      },
      attachFromDragAndDrop: (paths, titles) => {
        const f = async () => {
          if (Platform.isDarwin && darwinCopyToChatTempUploadFile) {
            const p = await Promise.all(
              paths.map(async p => {
                const outboxID = Common.generateOutboxID()
                const dst = await T.RPCChat.localGetUploadTempFileRpcPromise({filename: p.path, outboxID})
                await darwinCopyToChatTempUploadFile(dst, p.path)
                return {outboxID, path: dst}
              })
            )

            get().dispatch.attachmentsUpload(p, titles)
          } else {
            get().dispatch.attachmentsUpload(paths, titles)
          }
        }
        ignorePromise(f())
      },
      attachmentDownload: ordinal => {
        const old = get().messageMap.get(ordinal)
        if (!old) return

        if (old.type !== 'attachment') {
          set(s => {
            const m = s.messageMap.get(ordinal)
            if (m) {
              m.transferErrMsg = 'Trying to download missing / incorrect message?'
              m.transferState = undefined
            }
          })
          return
        }

        if (old.downloadPath) {
          logger.warn('Attachment already downloaded')
          return
        }

        set(s => {
          const m = s.messageMap.get(ordinal)
          if (m) {
            m.transferErrMsg = undefined
            m.transferState = 'downloading'
          }
        })
        // Download an attachment to your device
        const f = async () => {
          await downloadAttachment(false, ordinal)
        }
        ignorePromise(f())
      },
      attachmentPasted: data => {
        const f = async () => {
          const outboxID = Common.generateOutboxID()
          const path = await T.RPCChat.localMakeUploadTempFileRpcPromise({
            data,
            filename: 'paste.png',
            outboxID,
          })

          const pathAndOutboxIDs = [{outboxID, path}]
          navigateAppend({
            name: 'chatAttachmentGetTitles',
            params: {conversationIDKey: get().id, noDragDrop: true, pathAndOutboxIDs},
          })
        }
        ignorePromise(f())
      },
      attachmentPreviewSelect: ordinal => {
        navigateAppend({
          name: 'chatAttachmentFullscreen',
          params: {conversationIDKey: get().id, ordinal},
        })
      },
      attachmentUploadCanceled: outboxIDs => {
        const f = async () => {
          const promises = outboxIDs.map(async outboxID =>
            T.RPCChat.localCancelUploadTempFileRpcPromise({outboxID})
          )
          await Promise.allSettled(promises)
        }
        ignorePromise(f())
      },
      attachmentsUpload: (paths, titles, _tlfName, _spoiler) => {
        const f = async () => {
          let tlfName = _tlfName
          const {id: conversationIDKey} = get()
          if (!get().isMetaGood()) {
            if (!tlfName) {
              logger.warn('attachmentsUpload: missing meta for attachment upload', conversationIDKey)
              return
            }
          } else {
            tlfName = get().meta.tlfname
          }
          const clientPrev = getClientPrev()
          // disable sending exploding messages if flag is false
          const ephemeralLifetime = get().explodingMode
          const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
          const outboxIDs = paths.reduce<Array<Uint8Array>>((obids, p) => {
            obids.push(p.outboxID ? p.outboxID : Common.generateOutboxID())
            return obids
          }, [])
          // TODO plumb spoiler
          await Promise.all(
            paths.map(async (p, i) =>
              T.RPCChat.localPostFileAttachmentLocalNonblockRpcPromise({
                arg: {
                  ...ephemeralData,
                  conversationID: get().getConvID(),
                  filename: Styles.unnormalizePath(p.path),
                  identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
                  metadata: new Uint8Array(),
                  outboxID: outboxIDs[i],
                  title: titles[i] ?? '',
                  tlfName,
                  visibility: T.RPCGen.TLFVisibility.private,
                },
                clientPrev,
              })
            )
          )
        }
        ignorePromise(f())
      },
      badgesUpdated: badge => {
        set(s => {
          s.badge = badge
        })
        queueInboxRowUpdate(get().id)
      },
      blockConversation: reportUser => {
        const f = async () => {
          navigateToInbox()
          useConfigState.getState().dispatch.defer.persistRoute?.(false, false)
          await T.RPCChat.localSetConversationStatusLocalRpcPromise({
            conversationID: get().getConvID(),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            status: reportUser ? T.RPCChat.ConversationStatus.reported : T.RPCChat.ConversationStatus.blocked,
          })
        }
        ignorePromise(f())
      },
      botCommandsUpdateStatus: status => {
        set(s => {
          s.botCommandsUpdateStatus = status.typ
          if (status.typ === T.RPCChat.UIBotCommandsUpdateStatusTyp.uptodate) {
            const settingsMap = new Map<string, T.RPCGen.TeamBotSettings | undefined>()
            Object.keys(status.uptodate.settings ?? {}).forEach(u => {
              settingsMap.set(u, status.uptodate.settings?.[u])
            })
            s.botSettings = T.castDraft(settingsMap)
          }
        })
      },
      channelSuggestionsTriggered: () => {
        // If this is an impteam, try to refresh mutual team info
        if (!get().meta.teamname) {
          refreshMutualTeamsInConv()
        }
      },
      clearAttachmentView: () => {
        set(s => {
          s.attachmentViewMap = new Map()
        })
      },
      defer,
      dismissBottomBanner: () => {
        set(s => {
          s.dismissedInviteBanners = true
        })
      },
      dismissJourneycard: (cardType, ordinal) => {
        const f = async () => {
          await T.RPCChat.localDismissJourneycardRpcPromise({
            cardType: cardType,
            convID: get().getConvID(),
          }).catch((error: unknown) => {
            if (error instanceof RPCError) {
              logger.error(`Failed to dismiss journeycard: ${error.message}`)
            }
          })
          get().dispatch.messagesWereDeleted({ordinals: [ordinal]})
        }
        ignorePromise(f())
      },
      editBotSettings: (username, allowCommands, allowMentions, convs) => {
        const f = async () => {
          try {
            await T.RPCChat.localSetBotMemberSettingsRpcPromise(
              {
                botSettings: {cmds: allowCommands, convs, mentions: allowMentions},
                convID: get().getConvID(),
                username,
              },
              Strings.waitingKeyChatBotAdd
            )
          } catch (error) {
            if (error instanceof RPCError) {
              logger.info('addBotMember: failed to edit bot settings: ' + error.message)
            }
            return
          }
        }
        ignorePromise(f())
      },
      giphySend: result => {
        getUI().dispatch.setGiphyWindow(false)
        const f = async () => {
          try {
            await T.RPCChat.localTrackGiphySelectRpcPromise({result})
          } catch {}
          const replyTo = get().messageMap.get(getUI().replyTo)?.id
          _messageSend(result.targetUrl, replyTo)
        }
        ignorePromise(f())
      },
      hideConversation: hide => {
        const f = async () => {
          if (hide) {
            // Nav to inbox but don't use findNewConversation since changeSelectedConversation
            // does that with better information. It knows the conversation is hidden even before
            // that state bounces back.
            navigateToInbox()
            get().dispatch.showInfoPanel(false, undefined)
          }

          await T.RPCChat.localSetConversationStatusLocalRpcPromise({
            conversationID: get().getConvID(),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            status: hide ? T.RPCChat.ConversationStatus.ignored : T.RPCChat.ConversationStatus.unfiled,
          })
        }
        ignorePromise(f())
      },
      ignorePinnedMessage: () => {
        const f = async () => {
          await T.RPCChat.localIgnorePinnedMessageRpcPromise({
            convID: get().getConvID(),
          })
        }
        ignorePromise(f())
      },
      joinConversation: () => {
        const f = async () => {
          await T.RPCChat.localJoinConversationByIDLocalRpcPromise({convID: get().getConvID()})
        }
        ignorePromise(f())
      },
      jumpToRecent: () => {
        setMessageCenterOrdinal()
        set(s => {
          s.validatedOrdinalRange = undefined
        })
        get().dispatch.loadMoreMessages({reason: 'jump to recent'})
      },
      leaveConversation: (navToInbox = true) => {
        const f = async () => {
          await T.RPCChat.localLeaveConversationLocalRpcPromise(
            {convID: get().getConvID()},
            Strings.waitingKeyChatLeaveConversation
          )
        }
        ignorePromise(f())
        clearModals()
        if (navToInbox) {
          navUpToScreen('chatRoot')
          switchTab(Tabs.chatTab)
          if (!isMobile) {
            const vs = getVisibleScreen()
            const params = vs?.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
            if (params?.conversationIDKey === get().id) {
              // select a convo
              const next = get().dispatch.defer.chatInboxLayoutSmallTeamsFirstConvID()
              if (next) {
                getConvoState(next).dispatch.navigateToThread('findNewestConversationFromLayout')
              }
            }
          }
        }
      },
      loadAttachmentView: (viewType, fromMsgID) => {
        set(s => {
          const {attachmentViewMap} = s
          const info = mapGetEnsureValue(attachmentViewMap, viewType, T.castDraft(makeAttachmentViewInfo()))
          info.status = 'loading'
        })

        const f = async () => {
          const {id: conversationIDKey} = get()
          const convID = get().getConvID()
          try {
            const res = await T.RPCChat.localLoadGalleryRpcListener({
              incomingCallMap: {
                'chat.1.chatUi.chatLoadGalleryHit': (
                  hit: T.RPCChat.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['inParam']
                ) => {
                  const {username, devicename} = getCurrentUser()
                  const m = Message.uiMessageToMessage(
                    conversationIDKey,
                    hit.message,
                    username,
                    getLastOrdinal,
                    devicename
                  )

                  if (m) {
                    // conversationMessage is used to tell if its this gallery load or not but if we
                    // load a message we already have we don't want to overwrite that it really belongs
                    const message = {...m, conversationMessage: get().messageMap.has(m.ordinal)}
                    set(s => {
                      const info = mapGetEnsureValue(
                        s.attachmentViewMap,
                        viewType,
                        T.castDraft(makeAttachmentViewInfo())
                      )
                      if (!info.messages.find(item => item.id === message.id)) {
                        info.messages = info.messages.concat(T.castDraft(message)).sort((l, r) => r.id - l.id)
                      }
                    })
                    // inject them into the message map
                    messagesAdd([message], {markAsRead: false, why: 'gallery inject'})
                  }
                },
              },
              params: {
                convID,
                fromMsgID,
                num: 50,
                typ: viewType,
              },
            })
            set(s => {
              const info = mapGetEnsureValue(
                s.attachmentViewMap,
                viewType,
                T.castDraft(makeAttachmentViewInfo())
              )
              info.last = !!res.last
              info.status = 'success'
            })
          } catch (error) {
            if (error instanceof RPCError) {
              logger.error('failed to load attachment view: ' + error.message)
              set(s => {
                const info = mapGetEnsureValue(
                  s.attachmentViewMap,
                  viewType,
                  T.castDraft(makeAttachmentViewInfo())
                )
                info.last = false
                info.status = 'error'
              })
            }
          }
        }
        ignorePromise(f())
      },
      loadMessagesCentered: (messageID, highlightMode) => {
        get().dispatch.messagesClear()
        get().dispatch.loadMoreMessages({
          centeredMessageID: {
            conversationIDKey: Common.getSelectedConversation(),
            highlightMode,
            messageID,
          },
          forceContainsLatestCalc: true,
          messageIDControl: {
            mode: T.RPCChat.MessageIDControlMode.centered,
            num: numMessagesOnInitialLoad,
            pivot: messageID,
          },
          reason: 'centered',
        })
      },
      loadMoreMessages: throttle((p: LoadMoreMessagesParams) => {
        if (!T.Chat.isValidConversationIDKey(get().id)) {
          return
        }
        const {scrollDirection: sd = 'none', numberOfMessagesToLoad = numMessagesOnInitialLoad} = p
        const {reason, messageIDControl, knownRemotes, centeredMessageID} = p

        const scrollDirectionToPagination = (sd: ScrollDirection, numberOfMessagesToLoad: number) => {
          const pagination = {
            last: false,
            next: '',
            num: numberOfMessagesToLoad,
            previous: '',
          }
          switch (sd) {
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
        // Load new messages on a thread. We call this when you select a conversation,
        // we get a thread-is-stale notification, or when you scroll up and want more
        // messages
        const f = async () => {
          // Get the conversationIDKey
          const {id: conversationIDKey} = get()

          if (!conversationIDKey || !T.Chat.isValidConversationIDKey(conversationIDKey)) {
            logger.info('loadMoreMessages: bail: no conversationIDKey')
            return
          }

          if (get().meta.membershipType === 'youAreReset' || get().meta.rekeyers.size > 0) {
            logger.info('loadMoreMessages: bail: we are reset')
            return
          }
          logger.info(
            `loadMoreMessages: calling rpc convo: ${conversationIDKey} num: ${numberOfMessagesToLoad} reason: ${reason}`
          )

          const loadingKey = Strings.waitingKeyChatThreadLoad(conversationIDKey)
          const convID = get().getConvID()
          let reconciled = false
          const onGotThread = (thread: string, why: string) => {
            if (!thread) {
              return
            }

            if (!get().loaded) {
              set(s => {
                s.loaded = true
              })
            }

            const {username, devicename} = getCurrentUser()
            const uiMessages = JSON.parse(thread) as T.RPCChat.UIMessages

            const messages = (uiMessages.messages ?? []).reduce<Array<T.Chat.Message>>((arr, m) => {
              const message = conversationIDKey
                ? Message.uiMessageToMessage(conversationIDKey, m, username, getLastOrdinal, devicename)
                : undefined
              if (message) {
                arr.push(message)
              }
              return arr
            }, [])

            // logger.info(`thread load ordinals ${messages.map(m => m.ordinal)}`)

            const moreToLoad = uiMessages.pagination ? !uiMessages.pagination.last : true
            set(s => {
              switch (sd) {
                case 'forward':
                  s.moreToLoadForward = moreToLoad
                  break
                case 'back':
                  s.moreToLoadBack = moreToLoad
                  break
                case 'none':
                  s.moreToLoadBack = moreToLoad
                  s.moreToLoadForward = !!centeredMessageID
                  break
              }
            })

            if (messages.length) {
              // Only reconcile on the first response of an initial load (not scrolls)
              let validatedRange: {from: T.Chat.Ordinal; to: T.Chat.Ordinal} | undefined
              if (sd === 'none' && !reconciled) {
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
              messagesAdd(messages, {validatedRange, why: `load more ongotthread: ${why}`})
              if (centeredMessageID) {
                const ordinal = T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(centeredMessageID.messageID))
                setMessageCenterOrdinal({highlightMode: centeredMessageID.highlightMode, ordinal})
              }
            }

            // Force mark as read for user-initiated navigations (not auto-selection by service)
            const isUserNavigation =
              reason !== 'findNewestConversation' &&
              reason !== 'findNewestConversationFromLayout' &&
              reason !== 'tab selected'
            if (isUserNavigation) {
              get().dispatch.markThreadAsRead(true)
            }
          }

          const pagination = messageIDControl ? null : scrollDirectionToPagination(sd, numberOfMessagesToLoad)
          try {
            const results = await T.RPCChat.localGetThreadNonblockRpcListener({
              incomingCallMap: {
                'chat.1.chatUi.chatThreadCached': p => onGotThread(p.thread || '', 'cached'),
                'chat.1.chatUi.chatThreadFull': p => onGotThread(p.thread || '', 'full'),
                'chat.1.chatUi.chatThreadStatus': p => {
                  logger.info(
                    `loadMoreMessages: thread status received: convID: ${conversationIDKey} typ: ${p.status.typ}`
                  )
                  set(s => {
                    s.threadLoadStatus = p.status.typ
                  })
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
            if (get().isMetaGood()) {
              set(s => {
                s.meta.offline = results.offline
              })
            }
          } catch (error) {
            if (error instanceof RPCError) {
              logger.warn(`loadMoreMessages: error: ${error.desc}`)
              // no longer in team
              if (error.code === T.RPCGen.StatusCode.scchatnotinteam) {
                get().dispatch.defer.chatInboxRefresh('maybeKickedFromTeam')
                navigateToInbox()
              }
              if (error.code !== T.RPCGen.StatusCode.scteamreaderror) {
                // scteamreaderror = user is not in team. they'll see the rekey screen so don't throw for that
                throw error
              }
            }
          }
        }

        ignorePromise(f())
      }, 500),
      loadNewerMessagesDueToScroll: numOrdinals => {
        if (!numOrdinals) {
          return
        }

        if (!okToLoadMore(numOrdinals)) {
          return
        }

        get().dispatch.loadMoreMessages({
          numberOfMessagesToLoad: numMessagesOnScrollback,
          reason: 'scroll forward',
          scrollDirection: 'forward',
        })
      },
      loadNextAttachment: async (from, backInTime) => {
        const fromMsg = get().messageMap.get(from)
        if (!fromMsg) return Promise.reject(new Error('Incorrect from'))
        const {id} = fromMsg

        const f = async () => {
          const result = await T.RPCChat.localGetNextAttachmentMessageLocalRpcPromise({
            assetTypes: [T.RPCChat.AssetMetadataType.image, T.RPCChat.AssetMetadataType.video],
            backInTime,
            convID: get().getConvID(),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            messageID: id,
          })

          if (result.message) {
            const {username, devicename} = getCurrentUser()
            const goodMessage = Message.uiMessageToMessage(
              get().id,
              result.message,
              username,
              getLastOrdinal,
              devicename
            )
            if (goodMessage?.type === 'attachment') {
              messagesAdd([goodMessage], {why: 'loadnextattachment'})
              let ordinal = goodMessage.ordinal
              // sent?
              if (goodMessage.outboxID && !get().messageMap.get(ordinal)) {
                const po = get().pendingOutboxToOrdinal.get(goodMessage.outboxID)
                if (po) {
                  ordinal = po
                }
              }
              return ordinal
            }
          }
          return Promise.reject(new Error('No more results'))
        }

        return f()
      },
      loadOlderMessagesDueToScroll: numOrdinals => {
        if (!get().moreToLoadBack) {
          logger.info('bail: scrolling back and at the end')
          return
        }

        if (!numOrdinals) {
          return
        }

        if (!okToLoadMore(numOrdinals)) {
          return
        }

        get().dispatch.loadMoreMessages({
          numberOfMessagesToLoad: numMessagesOnScrollback,
          reason: 'scroll back',
          scrollDirection: 'back',
        })
      },
      markTeamAsRead: teamID => {
        const f = async () => {
          if (!useConfigState.getState().loggedIn) {
            logger.info('bail on not logged in')
            return
          }
          const tlfID = hexToUint8Array(T.Teams.teamIDToString(teamID))
          await T.RPCChat.localMarkTLFAsReadLocalRpcPromise({tlfID})
        }
        ignorePromise(f())
      },
      markThreadAsRead: force => {
        const f = async () => {
          if (!useConfigState.getState().loggedIn) {
            logger.info('mark read bail on not logged in')
            return
          }
          const {id: conversationIDKey} = get()
          if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
            logger.info('mark read bail on no selected conversation')
            return
          }
          if (!force && !Common.isUserActivelyLookingAtThisThread(conversationIDKey)) {
            logger.info('mark read bail on not looking at this thread')
            return
          }
          // Check to see if we do not have the latest message, and don't mark anything as read in that case
          // If we have no information at all, then just mark as read
          if (!get().isCaughtUp()) {
            logger.info('mark read bail on not containing latest message')
            return
          }

          const ordinal = findLast([...(get().messageOrdinals ?? [])], (o: T.Chat.Ordinal) => {
            const m = get().messageMap.get(o)
            return m ? !!m.id : false
          })
          const message = ordinal ? get().messageMap.get(ordinal) : undefined

          const readMsgID = message?.id
          // if we have a meta and we think we're already up to date ignore
          if (get().isMetaGood() && readMsgID === get().meta.readMsgID) {
            logger.info(`marking read messages is noop bail: ${conversationIDKey} ${readMsgID}`)
            return
          }

          // else just write it
          logger.info(`marking read messages ${conversationIDKey} ${readMsgID}`)

          await T.RPCChat.localMarkAsReadLocalRpcPromise({
            conversationID: get().getConvID(),
            forceUnread: false,
            msgID: readMsgID,
          })
        }
        ignorePromise(f())
      },
      messageAttachmentNativeSave: ordinal => {
        if (!isMobile) return
        const existing = get().messageMap.get(ordinal)
        if (existing?.type !== 'attachment') {
          throw new Error('Invalid share message')
        }

        const f = async () => {
          const {fileType} = existing
          const fileName = await downloadAttachment(true, ordinal)
          if (!fileName) {
            // failed to download
            logger.info('Downloading attachment failed')
            return
          }
          try {
            if (!get().messageMap.get(ordinal)) {
              logger.error('Failed to save attachment: missing now?')
              return
            }
            set(s => {
              const m2 = s.messageMap.get(ordinal)
              if (m2?.type === 'attachment') {
                m2.transferErrMsg = undefined
                m2.transferState = 'mobileSaving'
              }
            })
            logger.info('Trying to save chat attachment to camera roll')
            await PlatformSpecific.saveAttachmentToCameraRoll(fileName, fileType)
            set(s => {
              const m3 = s.messageMap.get(ordinal)
              if (m3?.type === 'attachment') {
                m3.transferErrMsg = undefined
                m3.transferState = undefined
              }
            })
          } catch (err) {
            logger.error('Failed to save attachment: ' + err)
            throw new Error('Failed to save attachment: ' + err)
          }
        }
        ignorePromise(f())
      },
      messageAttachmentNativeShare: (ordinal, fromDownload = false) => {
        const message = get().messageMap.get(ordinal)
        if (message?.type !== 'attachment') {
          throw new Error('Invalid share message')
        }
        // Native share sheet for attachments
        const f = async () => {
          const filePath = await downloadAttachment(true, ordinal)
          if (!filePath) {
            logger.info('Downloading attachment failed')
            return
          }

          // kinda hacky, on download we need to download and showing
          if (isIOS && message.fileName.endsWith('.pdf') && fromDownload) {
            navigateAppend({
              name: 'chatPDF',
              params: {
                conversationIDKey: get().id,
                ordinal,
                // Prepend the 'file://' prefix here. Otherwise when webview
                // automatically does that, it triggers onNavigationStateChange
                // with the new address and we'd call stoploading().
                url: 'file://' + filePath,
              },
            })
            return
          }

          try {
            await PlatformSpecific.showShareActionSheet({filePath, mimeType: message.fileType})
          } catch (_e: unknown) {
            const e = _e as undefined | {message: string}
            logger.error('Failed to share attachment: ' + JSON.stringify(e?.message))
          }
        }
        ignorePromise(f())
      },
      messageDelete: ordinal => {
        set(s => {
          const m = s.messageMap.get(ordinal)
          if (m?.type === 'text') {
            m.submitState = 'deleting'
          }
        })

        // Delete a message. We cancel pending messages
        const f = async () => {
          const message = get().messageMap.get(ordinal)
          if (!message) {
            logger.warn('Deleting invalid message')
            return
          }
          if (!get().isMetaGood()) {
            logger.warn('Deleting message w/ no meta')
            return
          }
          // We have to cancel pending messages
          if (!message.id) {
            if (message.outboxID) {
              await T.RPCChat.localCancelPostRpcPromise({
                outboxID: T.Chat.outboxIDToRpcOutboxID(message.outboxID),
              })
              get().dispatch.messagesWereDeleted({ordinals: [message.ordinal]})
            } else {
              logger.warn('Delete of no message id and no outboxid')
            }
          } else {
            await T.RPCChat.localPostDeleteNonblockRpcPromise({
              clientPrev: 0,
              conversationID: get().getConvID(),
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              outboxID: null,
              supersedes: message.id,
              tlfName: get().meta.tlfname,
              tlfPublic: false,
            })
          }
        }
        ignorePromise(f())
      },
      messageDeleteHistory: () => {
        // Delete a message and any older
        const f = async () => {
          const meta = get().meta
          if (!meta.tlfname) {
            logger.warn('Deleting message history for non-existent TLF:')
            return
          }
          await T.RPCChat.localPostDeleteHistoryByAgeRpcPromise({
            age: 0,
            conversationID: get().getConvID(),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            tlfName: meta.tlfname,
            tlfPublic: false,
          })
        }
        ignorePromise(f())
      },
      messageReplyPrivately: ordinal => {
        const f = async () => {
          const message = get().messageMap.get(ordinal)
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
          // switch to new thread
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
          getConvoUIState(newThreadCID).dispatch.injectIntoInput(text)
          get().dispatch.defer.chatMetasReceived([meta])
          getConvoState(newThreadCID).dispatch.navigateToThread('createdMessagePrivately')
        }
        ignorePromise(f())
      },
      messageRetry: outboxID => {
        const ordinal = get().pendingOutboxToOrdinal.get(outboxID)
        if (!ordinal || !get().messageMap.get(ordinal)) return
        set(s => {
          const m = s.messageMap.get(ordinal)
          if (m) {
            m.errorReason = undefined
            m.submitState = 'pending'
          }
        })
        ignorePromise(
          (async () => {
            await T.RPCChat.localRetryPostRpcPromise({outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)})
          })()
        )
      },
      messagesClear: () => {
        set(s => {
          s.pendingOutboxToOrdinal.clear()
          s.loaded = false
          s.messageIDToOrdinal.clear()
          s.messageMap.clear()
          s.messageOrdinals = undefined
          s.messageTypeMap.clear()
          s.rowRecycleTypeMap.clear()
          s.separatorMap.clear()
          s.showUsernameMap.clear()
          s.validatedOrdinalRange = undefined
        })
      },
      messagesExploded: (messageIDs, explodedBy) => {
        logger.info(`messagesExploded: exploding ${messageIDs.length} messages`)
        set(s => {
          messageIDs.forEach(mid => {
            const ordinal = maybeGetOrdinalByMessageID(s, mid)
            const m = ordinal && s.messageMap.get(ordinal)
            if (!m) return
            m.exploded = true
            m.explodedBy = explodedBy || ''
            m.reactions = new Map()
            m.unfurls = new Map()
            if (ordinal) {
              setRowRenderDerivedMetadata(s, ordinal, m)
            }
            if (m.type === 'text') {
              m.flipGameID = ''
              m.mentionsAt = new Set()
              m.text = new HiddenString('')
            }
          })
        })
      },
      messagesWereDeleted: p => {
        const {
          deletableMessageTypes = Common.allMessageTypes,
          messageIDs = [],
          ordinals = [],
          upToMessageID = null,
        } = p
        const state = get()
        const {messageMap} = state

        let upToOrdinals: Array<T.Chat.Ordinal> = []
        if (upToMessageID) {
          upToOrdinals = [...messageMap.entries()].reduce((arr, [ordinal, m]) => {
            if (m.id < upToMessageID && deletableMessageTypes.has(m.type)) {
              arr.push(ordinal)
            }
            return arr
          }, new Array<T.Chat.Ordinal>())
        }

        const allOrdinals = new Set([
          ...ordinals,
          ...messageIDs.flatMap(id => {
            const o = maybeGetOrdinalByMessageID(state, id)
            return o ? [o] : []
          }),
          ...upToOrdinals,
        ])

        set(s => {
          allOrdinals.forEach(ordinal => {
            clearMessageIDIndexForOrdinal(s, ordinal)
            s.messageMap.delete(ordinal)
            s.messageTypeMap.delete(ordinal)
          })
          if (s.messageOrdinals) {
            s.messageOrdinals = s.messageOrdinals.filter(o => !allOrdinals.has(o))
          }
          refreshDerivedMetadata(s, allOrdinals)
        })
      },
      mute: m => {
        const f = async () => {
          await T.RPCChat.localSetConversationStatusLocalRpcPromise({
            conversationID: get().getConvID(),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            status: m ? T.RPCChat.ConversationStatus.muted : T.RPCChat.ConversationStatus.unfiled,
          })
        }
        ignorePromise(f())
      },
      navigateToThread: (
        _reason,
        highlightMessageID,
        _pushBody,
        threadSearchQuery,
        createConversationError
      ) => {
        set(s => {
          // force loaded if we're an error
          if (s.id === T.Chat.pendingErrorConversationIDKey) {
            s.loaded = true
          }
          s.pendingJumpMessageID = highlightMessageID
        })

        const updateNav = () => {
          const reason = _reason
          if (reason === 'navChanged') {
            return
          }
          const conversationIDKey = get().id
          const visible = getVisibleScreen()
          const params = visible?.params as {conversationIDKey?: T.Chat.ConversationIDKey} | undefined
          const visibleConvo = params?.conversationIDKey
          const visibleRouteName = visible?.name

          if (visibleRouteName !== Common.threadRouteName && reason === 'findNewestConversation') {
            // service is telling us to change our selection but we're not looking, ignore
            return
          }

          // we select the chat tab and change the params
          const threadSearch = threadSearchQuery ? {query: threadSearchQuery} : undefined
          const navParams = {createConversationError, threadSearch}
          if (Common.isSplit) {
            navToThread(conversationIDKey, navParams)
            // immediately switch stack to an inbox | thread stack
          } else if (reason === 'push' || reason === 'savedLastState') {
            navToThread(conversationIDKey, navParams)
            return
          } else {
            // replace if looking at the pending / waiting screen
            const replace =
              visibleRouteName === Common.threadRouteName &&
              !T.Chat.isValidConversationIDKey(visibleConvo ?? '')
            // note: we don't switch tabs on non split
            const modalPath = getModalStack()
            if (modalPath.length > 0) {
              clearModals()
            }

            navigateAppend(
              {
                name: Common.threadRouteName,
                params: {conversationIDKey, createConversationError, threadSearch},
              },
              replace
            )
          }
        }
        updateNav()
      },
      onEngineIncoming: action => {
        switch (action.type) {
          case 'chat.1.NotifyChat.ChatAttachmentDownloadComplete': {
            const {msgID} = action.payload.params
            onDownloadComplete(msgID)
            break
          }
          case 'chat.1.NotifyChat.ChatAttachmentDownloadProgress': {
            const {msgID, bytesComplete, bytesTotal} = action.payload.params
            onDownloadProgress(msgID, bytesComplete, bytesTotal)
            break
          }
          case 'chat.1.chatUi.chatCommandStatus': {
            const {displayText, typ, actions} = action.payload.params
            getUI().dispatch.setCommandStatusInfo({
              actions: T.castDraft(actions) || [],
              displayText,
              displayType: typ,
            })
            break
          }
          case 'chat.1.chatUi.chatBotCommandsUpdateStatus':
            get().dispatch.botCommandsUpdateStatus(action.payload.params.status)
            break
          case 'chat.1.chatUi.chatCommandMarkdown':
            set(s => {
              s.commandMarkdown = action.payload.params.md || undefined
            })
            break
          case 'chat.1.chatUi.chatGiphyToggleResultWindow': {
            onGiphyToggleWindow(action)
            break
          }
          case 'chat.1.chatUi.chatGiphySearchResults':
            getUI().dispatch.setGiphyResult(action.payload.params.results)
            break
          case 'chat.1.NotifyChat.ChatRequestInfo':
            {
              const {info, msgID} = action.payload.params
              onChatRequestInfo(info, msgID)
            }
            break
          case 'chat.1.NotifyChat.ChatPaymentInfo':
            onChatPaymentInfo(action)
            break
          case 'chat.1.NotifyChat.ChatPromptUnfurl': {
            const {domain, msgID} = action.payload.params
            unfurlTogglePrompt(T.Chat.numberToMessageID(msgID), domain, true)
            break
          }
          case 'chat.1.chatUi.chatInboxFailed': {
            const {convID, error} = action.payload.params
            onInboxFailed(convID, error)
            break
          }
          case 'chat.1.NotifyChat.ChatSetConvSettings': {
            const {conv} = action.payload.params
            onSetConvSettings(conv)
            break
          }
          case 'chat.1.NotifyChat.ChatAttachmentUploadStart': // fallthrough
          case 'chat.1.NotifyChat.ChatAttachmentUploadProgress': {
            const {params} = action.payload
            onAttachmentUpload(params)
            break
          }
          default:
        }
      },
      onIncomingMessage: incoming => {
        const {message: cMsg} = incoming
        const {username, devicename} = getCurrentUser()
        // check for a reaction outbox notification before doing anything
        if (
          cMsg.state === T.RPCChat.MessageUnboxedState.outbox &&
          cMsg.outbox.messageType === T.RPCChat.MessageType.reaction
        ) {
          toggleLocalReaction({
            decorated: cMsg.outbox.decoratedTextBody ?? '',
            emoji: cMsg.outbox.body,
            targetOrdinal: T.Chat.numberToOrdinal(cMsg.outbox.supersedes),
            username,
          })
          return
        }

        const {modifiedMessage, displayDesktopNotification, desktopNotificationSnippet} = incoming
        if (
          !isMobile &&
          displayDesktopNotification &&
          desktopNotificationSnippet &&
          cMsg.state === T.RPCChat.MessageUnboxedState.valid
        ) {
          desktopNotification(cMsg.valid.senderUsername, desktopNotificationSnippet)
        }

        const conversationIDKey = get().id

        // special case mutations
        if (cMsg.state === T.RPCChat.MessageUnboxedState.valid) {
          const {valid} = cMsg
          const body = valid.messageBody
          if (
            body.messageType === T.RPCChat.MessageType.edit ||
            body.messageType === T.RPCChat.MessageType.delete
          ) {
            if (
              onIncomingMutation(
                conversationIDKey,
                valid,
                username,
                getLastOrdinal,
                devicename,
                modifiedMessage
              )
            ) {
              return
            }
          }
        }
        const message = T.castDraft(
          Message.uiMessageToMessage(conversationIDKey, cMsg, username, getLastOrdinal, devicename)
        )

        if (!message) return

        // The attachmentuploaded call is like an 'edit' of an attachment. We get the placeholder, then its replaced by the actual image
        if (
          cMsg.state === T.RPCChat.MessageUnboxedState.valid &&
          cMsg.valid.messageBody.messageType === T.RPCChat.MessageType.attachmentuploaded &&
          message.type === 'attachment'
        ) {
          const placeholderID = cMsg.valid.messageBody.attachmentuploaded.messageID
          onAttachmentEdit(placeholderID, message)
        } else {
          // A normal message
          messagesAdd([message], {incomingMessage: true, why: 'incoming general'})
        }
      },
      onMessageErrored: (outboxID, reason, errorTyp) => {
        set(s => {
          const ordinal = s.pendingOutboxToOrdinal.get(outboxID)
          const m = ordinal ? s.messageMap.get(ordinal) : undefined
          if (!m) return
          m.errorReason = reason
          m.errorTyp = errorTyp || undefined
          m.submitState = 'failed'
        })
      },
      onMessagesUpdated: messagesUpdated => {
        if (!messagesUpdated.updates) return
        const activelyLookingAtThread = Common.isUserActivelyLookingAtThisThread(get().id)
        if (!get().loaded && !activelyLookingAtThread) {
          return
        }
        const {username, devicename} = getCurrentUser()
        const messages = messagesUpdated.updates.flatMap(uimsg => {
          if (!Message.getMessageID(uimsg)) return []
          const message = Message.uiMessageToMessage(get().id, uimsg, username, getLastOrdinal, devicename)
          return message ? [message] : []
        })
        if (messages.length === 0) {
          return
        }
        messagesAdd(messages, {markAsRead: activelyLookingAtThread, why: 'messages updated'})
      },
      openFolder: () => {
        const meta = get().meta
        const participantInfo = get().participants
        const path = T.FS.stringToPath(
          meta.teamType !== 'adhoc'
            ? Config.teamFolder(meta.teamname)
            : Config.privateFolderWithUsers(participantInfo.name)
        )
        navToPath(path)
      },
      paymentInfoReceived: (messageID, paymentInfo) => {
        set(s => {
          s.accountsInfoMap.set(messageID, paymentInfo)
          s.paymentStatusMap.set(paymentInfo.paymentID, paymentInfo)
        })
      },
      pinMessage: msgID => {
        const f = async () => {
          const convID = get().getConvID()
          try {
            if (msgID) {
              await T.RPCChat.localPinMessageRpcPromise({convID, msgID})
            } else {
              await T.RPCChat.localUnpinMessageRpcPromise({convID}, Strings.waitingKeyChatUnpin(get().id))
            }
          } catch (error) {
            if (error instanceof RPCError) {
              logger.error(`pinMessage: ${error.message}`)
            }
          }
        }
        ignorePromise(f())
      },
      refreshBotRoleInConv: username => {
        const f = async () => {
          let role: T.RPCGen.TeamRole | undefined
          try {
            role = await T.RPCChat.localGetTeamRoleInConversationRpcPromise({
              convID: get().getConvID(),
              username,
            })
          } catch (error) {
            if (error instanceof RPCError) {
              logger.info(`refreshBotRoleInConv: failed to refresh bot team role: ${error.message}`)
            }
            return
          }
          const trole = TeamsUtil.teamRoleByEnum[role]
          const r = trole === 'none' ? undefined : trole
          set(s => {
            const roles = s.botTeamRoleMap
            if (r !== undefined) {
              roles.set(username, r)
            } else {
              roles.delete(username)
            }
          })
        }
        ignorePromise(f())
      },
      refreshBotSettings: username => {
        set(s => {
          s.botSettings.delete(username)
        })
        const f = async () => {
          try {
            const settings = await T.RPCChat.localGetBotMemberSettingsRpcPromise({
              convID: get().getConvID(),
              username,
            })
            set(s => {
              s.botSettings.set(username, T.castDraft(settings))
            })
          } catch (error) {
            if (error instanceof RPCError) {
              logger.info(`refreshBotSettings: failed to refresh settings for ${username}: ${error.message}`)
            }
            return
          }
        }
        ignorePromise(f())
      },
      removeBotMember: username => {
        const f = async () => {
          const convID = get().getConvID()
          try {
            await T.RPCChat.localRemoveBotMemberRpcPromise(
              {convID, username},
              Strings.waitingKeyChatBotRemove
            )
          } catch (error) {
            if (error instanceof RPCError) {
              logger.info('removeBotMember: failed to remove bot member: ' + error.message)
            }
          }
        }
        ignorePromise(f())
      },
      replyJump: messageID => {
        setMessageCenterOrdinal()
        get().dispatch.loadMessagesCentered(messageID, 'flash')
      },
      resetChatWithoutThem: () => {
        // Implicit teams w/ reset users we can invite them back in or chat w/o them
        const meta = get().meta
        const participantInfo = get().participants
        // remove all bad people
        const goodParticipants = new Set(participantInfo.all)
        meta.resetParticipants.forEach(r => goodParticipants.delete(r))
        previewConversation({
          participants: [...goodParticipants],
          reason: 'resetChatWithoutThem',
        })
      },
      resetDeleteMe: true,
      resetLetThemIn: username => {
        // let them back in after they reset
        const f = async () => {
          await T.RPCChat.localAddTeamMemberAfterResetRpcPromise({
            convID: get().getConvID(),
            username,
          })
        }
        ignorePromise(f())
      },
      resetState: Z.defaultReset,
      resolveMaybeMention: (channel, name) => {
        const f = async () => {
          await T.RPCChat.localResolveMaybeMentionRpcPromise({
            mention: {channel, name},
          })
        }
        ignorePromise(f())
      },
      selectedConversation: () => {
        const conversationIDKey = get().id
        clearChatTimeCache()
        setMessageCenterOrdinal()

        const fetchConversationBio = () => {
          const participantInfo = get().participants
          const username = useCurrentUserState.getState().username
          const otherParticipants = Meta.getRowParticipants(participantInfo, username || '')
          if (otherParticipants.length === 1) {
            // we're in a one-on-one convo
            const username = otherParticipants[0] || ''

            // if this is an SBS/phone/email convo or we get a garbage username, don't do anything
            if (username === '' || username.includes('@')) {
              return
            }

            useUsersState.getState().dispatch.getBio(username)
          }
        }

        const participantInfo = get().participants
        const force = !get().isMetaGood() || participantInfo.all.length === 0
        unboxRows([conversationIDKey], force)
        set(s => {
          s.threadLoadStatus = T.RPCChat.UIChatThreadStatusTyp.none
        })
        fetchConversationBio()
        // Handle pending jump (e.g. from notification deep link)
        const pendingJump = get().pendingJumpMessageID
        if (pendingJump) {
          set(s => {
            s.pendingJumpMessageID = undefined
          })
          get().dispatch.loadMessagesCentered(pendingJump, 'flash')
        } else {
          get().dispatch.loadMoreMessages({reason: 'focused'})
        }
      },
      sendAudioRecording: async (path, duration, amps) => {
        const outboxID = Common.generateOutboxID()
        const clientPrev = getClientPrev()
        const ephemeralLifetime = get().explodingMode
        const meta = get().meta
        if (!get().isMetaGood()) {
          logger.warn('sendAudioRecording: no meta for send')
          return
        }

        const callerPreview = await T.RPCChat.localMakeAudioPreviewRpcPromise({amps, duration})
        const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
        try {
          await T.RPCChat.localPostFileAttachmentLocalNonblockRpcPromise({
            arg: {
              ...ephemeralData,
              callerPreview,
              conversationID: get().getConvID(),
              filename: path,
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              metadata: new Uint8Array(),
              outboxID,
              title: '',
              tlfName: meta.tlfname,
              visibility: T.RPCGen.TLFVisibility.private,
            },
            clientPrev,
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.warn('sendAudioRecording: failed to send attachment: ' + error.message)
          }
        }
      },
      sendMessage: text => {
        const editOrdinal = getUI().editing
        if (editOrdinal) {
          _messageEdit(editOrdinal, text)
        } else {
          const replyTo = get().messageMap.get(getUI().replyTo)?.id
          _messageSend(text, replyTo)
        }
      },
      setConvRetentionPolicy: _policy => {
        const f = async () => {
          const convID = get().getConvID()
          let policy: T.RPCChat.RetentionPolicy | undefined
          try {
            policy = TeamsUtil.retentionPolicyToServiceRetentionPolicy(_policy)
            await T.RPCChat.localSetConvRetentionLocalRpcPromise({convID, policy})
          } catch (error) {
            if (error instanceof RPCError) {
              // should never happen
              logger.error(`Unable to parse retention policy: ${error.message}`)
            }
            throw error
          }
        }
        ignorePromise(f())
      },
      setExplodingMode: (seconds, incoming) => {
        set(s => {
          s.explodingMode = seconds
        })
        if (incoming) return
        const conversationIDKey = get().id
        const f = async () => {
          logger.info(`Setting exploding mode for conversation ${conversationIDKey} to ${seconds}`)
          const category = `${Common.explodingModeGregorKeyPrefix}${conversationIDKey}`
          const convRetention = Meta.getEffectiveRetentionPolicy(get().meta)
          if (seconds === 0 || seconds === convRetention.seconds) {
            // dismiss the category so we don't leave cruft in the push state
            await T.RPCGen.gregorDismissCategoryRpcPromise({category})
          } else {
            // update the category with the exploding time
            try {
              await T.RPCGen.gregorUpdateCategoryRpcPromise({
                body: seconds.toString(),
                category,
                dtime: {offset: 0, time: 0},
              })
              if (seconds !== 0) {
                logger.info(
                  `Successfully set exploding mode for conversation ${conversationIDKey} to ${seconds}`
                )
              } else {
                logger.info(`Successfully unset exploding mode for conversation ${conversationIDKey}`)
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
        }
        ignorePromise(f())
      },
      setMarkAsUnread: readMsgID => {
        if (readMsgID === false) {
          return
        }
        if (readMsgID) {
          set(s => {
            s.markedAsUnread = T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(readMsgID))
          })
        }
        const conversationIDKey = get().id
        const f = async () => {
          if (!useConfigState.getState().loggedIn) {
            logger.info('mark unread bail on not logged in')
            return
          }
          const unreadLineID = readMsgID ? readMsgID : get().meta.maxVisibleMsgID
          let msgID = unreadLineID

          // Find first visible message prior to what we have marked as unread. The
          // server will use this value to calculate our badge state.
          const messageMap = get().messageMap

          if (messageMap.size) {
            const ordinals = get().messageOrdinals
            const ord =
              ordinals &&
              findLast(ordinals, o => {
                const message = messageMap.get(o)
                return !!(message && message.id < unreadLineID)
              })
            const message = ord ? messageMap.get(ord) : undefined
            if (message) {
              msgID = message.id
            }
          } else {
            const pagination = {
              last: false,
              next: '',
              num: 2, // we need 2 items
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
                    conversationID: get().getConvID(),
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
            logger.info(`marking unread messages ${conversationIDKey} failed due to no id`)
            return
          }

          logger.info(`marking unread messages ${conversationIDKey} ${msgID}`)
          await T.RPCChat.localMarkAsReadLocalRpcPromise({
            conversationID: get().getConvID(),
            forceUnread: true,
            msgID,
          })
        }
        ignorePromise(f())
      },
      setMeta: _m => {
        const m = _m ?? Meta.makeConversationMeta()
        const wasGood = get().isMetaGood()
        set(s => {
          updateImmer(s.meta, m)
        })
        queueInboxRowUpdate(get().id)
        const isGood = get().isMetaGood()
        if (!wasGood && isGood) {
          // got a good meta, adopt the draft once
          const ui = getUI()
          if (ui.unsentText === undefined) {
            ui.dispatch.injectIntoInput(get().meta.draft.length ? get().meta.draft : undefined)
          }
        }
      },
      setMinWriterRole: role => {
        const f = async () => {
          logger.info(`Setting minWriterRole to ${role} for convID ${get().id}`)
          await T.RPCChat.localSetConvMinWriterRoleLocalRpcPromise({
            convID: get().getConvID(),
            role: T.RPCGen.TeamRole[role],
          })
        }
        ignorePromise(f())
      },
      setParticipants: p => {
        set(s => {
          if (!shallowEqual(s.participants.all, p.all)) {
            s.participants.all = T.castDraft(p.all)
          }
          if (!shallowEqual(s.participants.name, p.name)) {
            s.participants.name = T.castDraft(p.name)
          }
          if (!isEqual(s.participants.contactName, p.contactName)) {
            s.participants.contactName = T.castDraft(p.contactName)
          }
        })
        queueInboxRowUpdate(get().id)
      },
      setTyping: throttle((t: Set<string>) => {
        set(s => {
          if (!isEqual(s.typing, t)) {
            s.typing = t
          }
        })
        queueInboxRowUpdate(get().id)
      }, 1000),
      showInfoPanel: (show, tab) => {
        const conversationIDKey = get().id
        if (Platform.isPhone) {
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
            get().dispatch.clearAttachmentView()
          }
          return
        }
        setChatRootParams({conversationIDKey, infoPanel: show ? {tab} : undefined})
      },
      tabSelected: () => {
        get().dispatch.loadMoreMessages({reason: 'tab selected'})
        get().dispatch.markThreadAsRead()
      },
      toggleMessageCollapse: (messageID, ordinal) => {
        const f = async () => {
          const m = get().messageMap.get(ordinal)
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
            convID: get().getConvID(),
            msgID: messageID,
          })
        }
        ignorePromise(f())
      },
      toggleMessageReaction: (ordinal, emoji) => {
        const f = async () => {
          // The service translates this to a delete if an identical reaction already exists
          // so we only need to call this RPC to toggle it on & off
          if (!emoji) {
            return
          }
          const message = get().messageMap.get(ordinal)
          if (!message) {
            logger.warn(`toggleMessageReaction: no message found`)
            return
          }
          const {type, exploded, id} = message
          if ((type === 'text' || type === 'attachment') && exploded) {
            logger.warn(`toggleMessageReaction: message is exploded`)
            return
          }
          logger.info(`toggleMessageReaction: posting reaction`)
          try {
            await T.RPCChat.localPostReactionNonblockRpcPromise({
              body: emoji,
              clientPrev: getClientPrev(),
              conversationID: get().getConvID(),
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              outboxID: Common.generateOutboxID(),
              supersedes: id,
              tlfName: get().meta.tlfname,
              tlfPublic: false,
            })
          } catch (error) {
            if (error instanceof RPCError) {
              logger.info(`toggleMessageReaction: failed to post` + error.message)
            }
          }
        }
        ignorePromise(f())
      },
      toggleThreadSearch: (hide, query) => {
        const conversationIDKey = get().id
        const visible = getVisibleScreen()
        const params = visible?.params as
          | {conversationIDKey?: T.Chat.ConversationIDKey; threadSearch?: {query?: string}}
          | undefined
        const nextVisible = hide !== undefined ? !hide : !params?.threadSearch
        set(s => {
          if (!nextVisible) {
            s.messageCenterOrdinal = undefined
          } else if (s.messageCenterOrdinal) {
            s.messageCenterOrdinal.highlightMode = 'none'
          }
        })

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
      },
      unfurlRemove: messageID => {
        const f = async () => {
          if (!get().isMetaGood()) {
            logger.debug('unfurl remove no meta found, aborting!')
            return
          }
          await T.RPCChat.localPostDeleteNonblockRpcPromise({
            clientPrev: 0,
            conversationID: get().getConvID(),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            outboxID: null,
            supersedes: messageID,
            tlfName: get().meta.tlfname,
            tlfPublic: false,
          })
        }
        ignorePromise(f())
      },
      unfurlResolvePrompt: (messageID, domain, result) => {
        const f = async () => {
          unfurlTogglePrompt(messageID, domain, false)
          await T.RPCChat.localResolveUnfurlPromptRpcPromise({
            convID: get().getConvID(),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            msgID: T.Chat.messageIDToNumber(messageID),
            result,
          })
        }
        ignorePromise(f())
      },
      unreadUpdated: unread => {
        set(s => {
          s.unread = unread
        })
        queueInboxRowUpdate(get().id)
      },
      updateCoinFlipStatus: status => {
        set(s => {
          s.flipStatusMap.set(status.gameID, T.castDraft(status))
        })
      },
      updateCoinFlipStatuses: statuses => {
        set(s => {
          statuses.forEach(status => {
            s.flipStatusMap.set(status.gameID, T.castDraft(status))
          })
        })
      },
      updateDraft: throttle(
        (text: string) => {
          const f = async () => {
            await T.RPCChat.localUpdateUnsentTextRpcPromise({
              conversationID: get().getConvID(),
              text,
              tlfName: get().meta.tlfname,
            })
          }
          ignorePromise(f())
        },
        200,
        {trailing: true}
      ),
      updateFromUIInboxLayout: l => {
        if (get().isMetaGood()) return
        const {isMuted, draft, teamname, channelname, layoutName, snippet, snippetDecoration, time} = l
        set(s => {
          s.meta.draft = draft || ''
          s.meta.isMuted = isMuted
          if (teamname !== undefined) s.meta.teamname = teamname
          if (channelname !== undefined) s.meta.channelname = channelname
          if (snippet != null) {
            s.meta.snippetDecorated = snippet
            s.meta.snippet = snippet
          }
          if (snippetDecoration !== undefined) s.meta.snippetDecoration = snippetDecoration
          if (time !== undefined) s.meta.timestamp = time
          // For non-team convos, use layout name as participant fallback
          if (layoutName && !teamname && s.participants.name.length === 0) {
            const names = layoutName
              .split(',')
              .map(n => n.trim())
              .filter(Boolean)
            s.participants = {all: names, contactName: s.participants.contactName, name: names}
          }
        })
        queueInboxRowUpdate(get().id)
      },
      updateMeta: pm => {
        set(s => {
          Object.assign(s.meta, pm)
        })
        queueInboxRowUpdate(get().id)
      },
      updateNotificationSettings: (
        notificationsDesktop,
        notificationsMobile,
        notificationsGlobalIgnoreMentions
      ) => {
        const f = async () => {
          await T.RPCChat.localSetAppNotificationSettingsLocalRpcPromise({
            channelWide: notificationsGlobalIgnoreMentions,
            convID: get().getConvID(),
            settings: [
              {
                deviceType: T.RPCGen.DeviceType.desktop,
                enabled: notificationsDesktop === 'onWhenAtMentioned',
                kind: T.RPCChat.NotificationKind.atmention,
              },
              {
                deviceType: T.RPCGen.DeviceType.desktop,
                enabled: notificationsDesktop === 'onAnyActivity',
                kind: T.RPCChat.NotificationKind.generic,
              },
              {
                deviceType: T.RPCGen.DeviceType.mobile,
                enabled: notificationsMobile === 'onWhenAtMentioned',
                kind: T.RPCChat.NotificationKind.atmention,
              },
              {
                deviceType: T.RPCGen.DeviceType.mobile,
                enabled: notificationsMobile === 'onAnyActivity',
                kind: T.RPCChat.NotificationKind.generic,
              },
            ],
          })
        }
        ignorePromise(f())
      },
      updateReactions: updates => {
        for (const u of updates) {
          const reactions = u.reactions
          const targetMsgID = u.targetMsgID
          const targetOrdinal = maybeGetOrdinalByMessageID(get(), u.targetMsgID)
          if (!targetOrdinal) {
            logger.info(
              `updateReactions: couldn't find target ordinal for targetMsgID=${targetMsgID} in convID=${
                get().id
              }`
            )
            continue
          }
          set(s => {
            const m = s.messageMap.get(targetOrdinal)
            if (m && m.type !== 'deleted' && m.type !== 'placeholder') {
              if (!reactions) {
                m.reactions = undefined
              } else if (!m.reactions) {
                m.reactions = T.castDraft(reactions)
              } else {
                const existingOrder = [...m.reactions.keys()]
                const scoreMap = new Map(
                  [...reactions.entries()].map(([key, value]) => {
                    return [
                      key,
                      value.users.reduce(
                        (minTimestamp, reaction) => Math.min(minTimestamp, reaction.timestamp),
                        Infinity
                      ),
                    ]
                  })
                )
                const newReactions = new Map<string, T.Chat.ReactionDesc>()
                for (const emoji of existingOrder) {
                  if (reactions.has(emoji)) {
                    newReactions.set(emoji, reactions.get(emoji)!)
                  }
                }
                const remainingEmojis = [...reactions.keys()].filter(emoji => !newReactions.has(emoji))
                remainingEmojis.sort((a, b) => scoreMap.get(a)! - scoreMap.get(b)!)
                for (const emoji of remainingEmojis) {
                  newReactions.set(emoji, reactions.get(emoji)!)
                }
                m.reactions = T.castDraft(newReactions)
              }
              setRowRenderDerivedMetadata(s, targetOrdinal, m)
            }
          })
        }
        get().dispatch.markThreadAsRead()
      },
    }
    const convIDCache = new Map<string, Uint8Array>()
    return {
      ...initialConvoStore,
      dispatch,
      getConvID: () => {
        const id = get().id
        if (!T.Chat.isValidConversationIDKey(id)) {
          return new Uint8Array(0)
        }

        const cached = convIDCache.get(id)
        if (cached) return cached
        const cid = T.Chat.keyToConversationID(id)
        convIDCache.set(id, cid)
        return cid
      },
      id,
      isCaughtUp: () => {
        return !get().moreToLoadForward
      },
      isMetaGood: () => {
        // fake meta doesn't have our actual id in it
        return get().meta.conversationIDKey === get().id
      },
    }
  }

type MadeStore = UseBoundStore<StoreApi<ConvoState>>
type MadeUIStore = UseBoundStore<StoreApi<ConvoUIState>>

const createConvoUISlice =
  (
    id: T.Chat.ConversationIDKey,
    getLinkedConvoState: () => ConvoState = () => getConvoState(id)
  ): Z.ImmerStateCreator<ConvoUIState> =>
  (set, get) => ({
    ...initialConvoUIStore,
    dispatch: {
      injectIntoInput: text => {
        set(s => {
          s.unsentText = text
        })
      },
      resetState: Z.defaultReset,
      setCommandStatusInfo: info => {
        set(s => {
          s.commandStatus = info ? T.castDraft(info) : undefined
        })
      },
      setEditing: e => {
        if (e === 'clear') {
          set(s => {
            s.editing = T.Chat.numberToOrdinal(0)
            s.unsentText = ''
          })
          return
        }

        const messageMap = getLinkedConvoState().messageMap
        let ordinal = T.Chat.numberToOrdinal(0)
        if (e === 'last') {
          const editLastUser = useCurrentUserState.getState().username
          const ordinals = getLinkedConvoState().messageOrdinals
          const found =
            !!ordinals &&
            findLast(ordinals, o => {
              const message = messageMap.get(o)
              return !!(
                (message?.type === 'text' || message?.type === 'attachment') &&
                message.author === editLastUser &&
                !message.exploded &&
                message.isEditable
              )
            })
          if (!found) return
          ordinal = found
        } else {
          ordinal = e
        }

        if (!ordinal) return
        const message = messageMap.get(ordinal)
        if (message?.type === 'text' || message?.type === 'attachment') {
          set(s => {
            s.editing = ordinal
            s.unsentText = message.type === 'text' ? message.text.stringValue() : message.title
          })
        }
      },
      setGiphyResult: result => {
        set(s => {
          s.giphyResult = result ? T.castDraft(result) : undefined
        })
      },
      setGiphyWindow: show => {
        set(s => {
          s.giphyWindow = show
        })
      },
      setReplyTo: ordinal => {
        set(s => {
          s.replyTo = ordinal
        })
      },
      toggleGiphyPrefill: () => {
        const shouldClear = get().giphyWindow
        set(s => {
          s.unsentText = shouldClear ? '' : '/giphy '
        })
      },
    },
  })

const createConvoStore = (id: T.Chat.ConversationIDKey) => {
  const existing = chatStores.get(id)
  if (existing) return existing
  const next = Z.createZustand<ConvoState>(createSlice(id))
  chatStores.set(id, next)
  return next
}

const createConvoUIStore = (id: T.Chat.ConversationIDKey) => {
  const existing = convoUIStores.get(id)
  if (existing) return existing
  const next = Z.createZustand<ConvoUIState>(createConvoUISlice(id))
  convoUIStores.set(id, next)
  return next
}

export const createConvoStoreForTesting = (id: T.Chat.ConversationIDKey) => {
  return createConvoStoresForTesting(id).convoStore
}

export const createConvoStoresForTesting = (id: T.Chat.ConversationIDKey) => {
  const pair = {} as {
    convoStore: UseBoundStore<StoreApi<ConvoState>>
    uiStore: UseBoundStore<StoreApi<ConvoUIState>>
  }
  const convoStore = Z.createZustand<ConvoState>(createSlice(id, () => pair.uiStore.getState()))
  const uiStore = Z.createZustand<ConvoUIState>(createConvoUISlice(id, () => pair.convoStore.getState()))
  pair.convoStore = convoStore
  pair.uiStore = uiStore
  return {convoStore, uiStore}
}

export const createConvoUIStoreForTesting = (id: T.Chat.ConversationIDKey) => {
  return createConvoStoresForTesting(id).uiStore
}

// debug only
export function hasConvoState(id: T.Chat.ConversationIDKey) {
  return chatStores.has(id)
}

// non reactive call, used in actions/dispatches
export function getConvoState(id: T.Chat.ConversationIDKey) {
  const store = createConvoStore(id)
  return store.getState()
}

export function getConvoUIState(id: T.Chat.ConversationIDKey) {
  const store = createConvoUIStore(id)
  return store.getState()
}

const Context = React.createContext<MadeStore | null>(null)

type ConvoProviderProps = React.PropsWithChildren<{
  id: T.Chat.ConversationIDKey
  canBeNull?: boolean
}>
export function ChatProvider({canBeNull, children, ...props}: ConvoProviderProps) {
  if (!canBeNull && (!props.id || props.id === noConversationIDKey)) {
    // let it not crash out but likely you'll get wrong answers in prod
    if (__DEV__) {
      console.log('Bad chat provider with id', props.id)
      throw new Error('No convo id in provider')
    }
  }
  return <Context value={createConvoStore(props.id)}>{children}</Context>
}

export function useHasContext() {
  const store = React.useContext(Context)
  return !!store
}

// use this if in doubt
export function useChatContext<T>(selector: (state: ConvoState) => T): T {
  const store = React.useContext(Context)
  if (!store) {
    throw new Error('Missing ConvoContext in the tree')
  }
  return useStore(store, selector)
}

export function useChatUIContext<T>(selector: (state: ConvoUIState) => T): T {
  const id = useChatContext(s => s.id)
  return useConvoUIState(id, selector)
}

// unusual, usually you useContext, but maybe in teams
export function useConvoState<T>(id: T.Chat.ConversationIDKey, selector: (state: ConvoState) => T): T {
  const store = createConvoStore(id)
  return useStore(store, selector)
}

export function useConvoUIState<T>(id: T.Chat.ConversationIDKey, selector: (state: ConvoUIState) => T): T {
  const store = createConvoUIStore(id)
  return useStore(store, selector)
}

type ChatRouteParams = {conversationIDKey?: T.Chat.ConversationIDKey}

type RouteParams = {
  route: {params?: ChatRouteParams}
}
export function ProviderScreen(p: {children: React.ReactNode; rp: RouteParams; canBeNull?: boolean}) {
  return (
    <ChatProvider id={p.rp.route.params?.conversationIDKey ?? noConversationIDKey} canBeNull={p.canBeNull}>
      {p.children}
    </ChatProvider>
  )
}

import type {NavigateAppendType} from '@/router-v2/route-params'
export const useChatNavigateAppend = () => {
  const cid = useChatContext(s => s.id)
  const chatNavigateAppend = (
    makePath: (cid: T.Chat.ConversationIDKey) => NavigateAppendType,
    replace?: boolean
  ) => {
    navigateAppend(makePath(cid) as never, replace)
  }
  return chatNavigateAppend
}
