import * as C from '..'
import * as T from '../types'
import * as Styles from '@/styles'
import * as Common from './common'
import * as Tabs from '../tabs'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as Message from './message'
import * as Meta from './meta'
import * as React from 'react'
import * as Z from '@/util/zustand'
import HiddenString from '@/util/hidden-string'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import throttle from 'lodash/throttle'
import type {DebouncedFunc} from 'lodash'
import {RPCError} from '@/util/errors'
import {findLast} from '@/util/arrays'
import {mapGetEnsureValue} from '@/util/map'
import {noConversationIDKey} from '../types/chat2/common'
import {type StoreApi, type UseBoundStore, useStore} from 'zustand'
import * as Platform from '../platform'
import KB2 from '@/util/electron'
import NotifyPopup from '@/util/notify-popup'
import {hexToUint8Array} from 'uint8array-extras'
const {darwinCopyToChatTempUploadFile} = KB2.functions

const makeThreadSearchInfo = (): T.Chat.ThreadSearchInfo => ({
  hits: [],
  status: 'initial',
  visible: false,
})

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
  | 'foregrounding'
  | 'got stale'
  | 'jump to recent'
  | 'centered'
  | 'scroll forward'
  | 'scroll back'
  | 'tab selected'
  | NavReason

// per convo store
type ConvoStore = {
  id: T.Chat.ConversationIDKey
  // temp cache for requestPayment and sendPayment message data,
  accountsInfoMap: Map<T.RPCChat.MessageID, T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo>
  attachmentViewMap: Map<T.RPCChat.GalleryItemTyp, T.Chat.AttachmentViewInfo>
  badge: number
  botCommandsUpdateStatus: T.RPCChat.UIBotCommandsUpdateStatusTyp
  botSettings: Map<string, T.RPCGen.TeamBotSettings | undefined>
  botTeamRoleMap: Map<string, T.Teams.TeamRoleType | undefined>
  commandMarkdown?: T.RPCChat.UICommandMarkdown
  commandStatus?: T.Chat.CommandStatusInfo
  dismissedInviteBanners: boolean
  editing: T.Chat.Ordinal // current message being edited,
  explodingMode: number // seconds to exploding message expiration,
  explodingModeLock?: number // locks set on exploding mode while user is inputting text,
  giphyResult?: T.RPCChat.GiphySearchResults
  giphyWindow: boolean
  markedAsUnread: boolean // store a bit if we've marked this thread as unread so we don't mark as read when navgiating away
  maxMsgIDSeen: number // max id weve seen so far, we do delete things
  messageCenterOrdinal?: T.Chat.CenterOrdinal // ordinals to center threads on,
  messageTypeMap: Map<T.Chat.Ordinal, T.Chat.RenderMessageType> // messages T.Chat to help the thread, text is never used
  messageOrdinals?: Array<T.Chat.Ordinal> // ordered ordinals in a thread,
  messageMap: Map<T.Chat.Ordinal, T.Chat.Message> // messages in a thread,
  meta: T.Chat.ConversationMeta // metadata about a thread, There is a special node for the pending conversation,
  moreToLoad: boolean
  mutualTeams: Array<T.Teams.TeamID>
  participants: T.Chat.ParticipantInfo
  pendingOutboxToOrdinal: Map<T.Chat.OutboxID, T.Chat.Ordinal> // messages waiting to be sent,
  replyTo: T.Chat.Ordinal
  threadLoadStatus: T.RPCChat.UIChatThreadStatusTyp
  threadSearchInfo: T.Chat.ThreadSearchInfo
  threadSearchQuery: string
  typing: Set<string>
  unfurlPrompt: Map<T.Chat.MessageID, Set<string>>
  unread: number
  unsentText?: string
}

const initialConvoStore: ConvoStore = {
  accountsInfoMap: new Map(),
  attachmentViewMap: new Map(),
  badge: 0,
  botCommandsUpdateStatus: T.RPCChat.UIBotCommandsUpdateStatusTyp.blank,
  botSettings: new Map(),
  botTeamRoleMap: new Map(),
  commandMarkdown: undefined,
  commandStatus: undefined,
  dismissedInviteBanners: false,
  editing: T.Chat.numberToOrdinal(0),
  explodingMode: 0,
  explodingModeLock: undefined,
  giphyResult: undefined,
  giphyWindow: false,
  id: noConversationIDKey,
  markedAsUnread: false,
  maxMsgIDSeen: -1,
  messageCenterOrdinal: undefined,
  messageMap: new Map(),
  messageOrdinals: undefined,
  messageTypeMap: new Map(),
  meta: Meta.makeConversationMeta(),
  moreToLoad: false,
  mutualTeams: [],
  participants: noParticipantInfo,
  pendingOutboxToOrdinal: new Map(),
  replyTo: T.Chat.numberToOrdinal(0),
  threadLoadStatus: T.RPCChat.UIChatThreadStatusTyp.none,
  threadSearchInfo: makeThreadSearchInfo(),
  threadSearchQuery: '',
  typing: new Set(),
  unfurlPrompt: new Map(),
  unread: 0,
  unsentText: undefined,
}
export type ConvoState = ConvoStore & {
  dispatch: {
    addBotMember: (
      username: string,
      allowCommands: boolean,
      allowMentions: boolean,
      restricted: boolean,
      convs?: Array<string>
    ) => void
    attachmentPasted: (data: Uint8Array) => void
    attachmentPreviewSelect: (ordinal: T.Chat.Ordinal) => void
    attachmentUploadCanceled: (outboxIDs: Array<T.RPCChat.OutboxID>) => void
    attachmentDownload: (ordinal: T.Chat.Ordinal) => void
    attachmentsUpload: (
      paths: Array<T.Chat.PathAndOutboxID>,
      titles: Array<string>,
      tlfName?: string,
      spoiler?: boolean
    ) => void
    attachFromDragAndDrop: (paths: Array<T.Chat.PathAndOutboxID>, titles: Array<string>) => void
    badgesUpdated: (badge: number) => void
    blockConversation: (reportUser: boolean) => void
    botCommandsUpdateStatus: (b: T.RPCChat.UIBotCommandsUpdateStatus) => void
    channelSuggestionsTriggered: () => void
    clearAttachmentView: () => void
    dismissBottomBanner: () => void
    dismissBlockButtons: (teamID: T.RPCGen.TeamID) => void
    dismissJourneycard: (cardType: T.RPCChat.JourneycardType, ordinal: T.Chat.Ordinal) => void
    desktopNotification: (author: string, body: string) => void
    editBotSettings: (
      username: string,
      allowCommands: boolean,
      allowMentions: boolean,
      convs?: Array<string>
    ) => void
    giphyGotSearchResult: (results: T.RPCChat.GiphySearchResults) => void
    giphySend: (result: T.RPCChat.GiphySearchResult) => void
    giphyToggleWindow: (show: boolean) => void
    hideSearch: () => void
    hideConversation: (hide: boolean) => void
    injectIntoInput: (text: string) => void
    joinConversation: () => void
    jumpToRecent: () => void
    leaveConversation: (navToInbox?: boolean) => void
    loadAttachmentView: (viewType: T.RPCChat.GalleryItemTyp, fromMsgID?: T.Chat.MessageID) => void
    loadMessagesCentered: (
      messageID: T.Chat.MessageID,
      highlightMode: T.Chat.CenterOrdinalHighlightMode
    ) => void
    loadOlderMessagesDueToScroll: () => void
    loadNewerMessagesDueToScroll: () => void
    loadMoreMessages: (p: {
      forceContainsLatestCalc?: boolean
      messageIDControl?: T.RPCChat.MessageIDControl
      centeredMessageID?: {
        conversationIDKey: T.Chat.ConversationIDKey
        messageID: T.Chat.MessageID
        highlightMode: T.Chat.CenterOrdinalHighlightMode
      }
      reason: LoadMoreReason
      knownRemotes?: Array<string>
      forceClear?: boolean
      scrollDirection?: ScrollDirection
      numberOfMessagesToLoad?: number
    }) => void
    loadNextAttachment: (from: T.Chat.Ordinal, backInTime: boolean) => Promise<T.Chat.Ordinal>
    markThreadAsRead: (unreadLineMessageID?: number) => void
    markTeamAsRead: (teamID: T.Teams.TeamID) => void
    messageAttachmentNativeSave: (message: T.Chat.Message) => void
    messageAttachmentNativeShare: (ordinal: T.Chat.Ordinal) => void
    messageDelete: (ordinal: T.Chat.Ordinal) => void
    messageDeleteHistory: () => void
    messageEdit: (ordinal: T.Chat.Ordinal, text: string) => void
    messageReplyPrivately: (ordinal: T.Chat.Ordinal) => void
    messageRetry: (outboxID: T.Chat.OutboxID) => void
    messageSend: (text: string, replyTo?: T.Chat.MessageID, waitingKey?: string) => void
    messagesAdd: (messages: Array<T.Chat.Message>) => void
    messagesClear: () => void
    messagesExploded: (messageIDs: Array<T.Chat.MessageID>, explodedBy?: string) => void
    messagesWereDeleted: (p: {
      messageIDs?: Array<T.Chat.MessageID>
      upToMessageID?: T.Chat.MessageID // expunge calls give us a message we should delete up to (don't delete it)
      deletableMessageTypes?: Set<T.Chat.MessageType> // expunge calls don't delete _all_ messages, only these types
      ordinals?: Array<T.Chat.Ordinal>
    }) => void
    metaReceivedError: (error: T.RPCChat.InboxUIItemError, username: string) => void
    mute: (m: boolean) => void
    navigateToThread: (reason: NavReason, highlightMessageID?: T.Chat.MessageID, pushBody?: string) => void
    openFolder: () => void
    onChatPaymentInfo: (action: EngineGen.Chat1NotifyChatChatPaymentInfoPayload) => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    onGiphyToggleWindow: (action: EngineGen.Chat1ChatUiChatGiphyToggleResultWindowPayload) => void
    onIncomingMessage: (incoming: T.RPCChat.IncomingMessage) => void
    onMessageErrored: (outboxID: T.Chat.OutboxID, reason: string, errorTyp?: number) => void
    onMessagesUpdated: (messagesUpdated: T.RPCChat.MessagesUpdated) => void
    paymentInfoReceived: (messageID: T.RPCChat.MessageID, paymentInfo: T.Chat.ChatPaymentInfo) => void
    pinMessage: (messageID?: T.Chat.MessageID) => void
    ignorePinnedMessage: () => void
    refreshBotRoleInConv: (username: string) => void
    refreshBotSettings: (username: string) => void
    refreshMutualTeamsInConv: () => void
    removeBotMember: (username: string) => void
    replyJump: (messageID: T.Chat.MessageID) => void
    requestInfoReceived: (messageID: T.RPCChat.MessageID, requestInfo: T.Chat.ChatRequestInfo) => void
    resetChatWithoutThem: () => void
    resetLetThemIn: (username: string) => void
    resetState: 'default'
    resetUnsentText: () => void
    resolveMaybeMention: (name: string, channel: string) => void
    selectedConversation: () => void
    sendAudioRecording: (path: string, duration: number, amps: Array<number>) => void
    sendTyping: DebouncedFunc<(typing: boolean) => void>
    setCommandMarkdown: (md?: T.RPCChat.UICommandMarkdown) => void
    setCommandStatusInfo: (info?: T.Chat.CommandStatusInfo) => void
    setConvRetentionPolicy: (policy: T.Retention.RetentionPolicy) => void
    setEditing: (ordinal: T.Chat.Ordinal | boolean) => void // true is last, false is clear
    setExplodingMode: (seconds: number, incoming?: boolean) => void
    setExplodingModeLocked: (locked: boolean) => void
    // false to clear
    setMarkAsUnread: (readMsgID?: T.RPCChat.MessageID | false) => void
    setMessageCenterOrdinal: (m?: T.Chat.CenterOrdinal) => void
    setMeta: (m?: T.Chat.ConversationMeta) => void
    setMinWriterRole: (role: T.Teams.TeamRoleType) => void
    setMoreToLoad: (m: boolean) => void
    setParticipants: (p: ConvoState['participants']) => void
    setPendingOutboxToOrdinal: (p: ConvoState['pendingOutboxToOrdinal']) => void
    setReplyTo: (o: T.Chat.Ordinal) => void
    setThreadLoadStatus: (status: T.RPCChat.UIChatThreadStatusTyp) => void
    setThreadSearchQuery: (query: string) => void
    setTyping: DebouncedFunc<(t: Set<string>) => void>
    setupSubscriptions: () => void
    showInfoPanel: (show: boolean, tab: 'settings' | 'members' | 'attachments' | 'bots' | undefined) => void
    tabSelected: () => void
    threadSearch: (query: string) => void
    toggleGiphyPrefill: () => void
    toggleLocalReaction: (p: {
      decorated: string
      emoji: string
      targetOrdinal: T.Chat.Ordinal
      username: string
    }) => void
    toggleMessageCollapse: (messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => void
    toggleMessageReaction: (ordinal: T.Chat.Ordinal, emoji: string) => void
    toggleThreadSearch: (hide?: boolean) => void
    unfurlResolvePrompt: (
      messageID: T.Chat.MessageID,
      domain: string,
      result: T.RPCChat.UnfurlPromptResult
    ) => void
    unfurlRemove: (messageID: T.Chat.MessageID) => void
    updateDraft: DebouncedFunc<(text: string) => void>
    updateFromUIInboxLayout: (l: {isMuted: boolean; draft?: string | null}) => void
    unfurlTogglePrompt: (messageID: T.Chat.MessageID, domain: string, show: boolean) => void
    unreadUpdated: (unread: number) => void
    updateAttachmentViewTransfer: (msgId: number, ratio: number) => void
    updateAttachmentViewTransfered: (msgId: number, path: string) => void
    updateMessage: (ordinal: T.Chat.Ordinal, m: Partial<T.Chat.Message>) => void
    updateMeta: (m: Partial<T.Chat.ConversationMeta>) => void
    updateNotificationSettings: (
      notificationsDesktop: T.Chat.NotificationsType,
      notificationsMobile: T.Chat.NotificationsType,
      notificationsGlobalIgnoreMentions: boolean
    ) => void
    updateReactions: (updates: Array<{targetMsgID: T.Chat.MessageID; reactions: T.Chat.Reactions}>) => void
  }
  getExplodingMode: () => number
  isMetaGood: () => boolean
  isCaughtUp: () => boolean
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
  messageID: T.Chat.MessageID
) => {
  // A message we didn't send in this session?
  let m = map.get(T.Chat.numberToOrdinal(messageID))
  if (m?.id !== 0 && m?.id === messageID) {
    return m.ordinal
  }
  // Search through our sent messages
  const pendingOrdinal = [...(pendingOutboxToOrdinal?.values() ?? [])].find(o => {
    m = map.get(o)
    if (m?.id !== 0 && m?.id === messageID) {
      return true
    }
    return false
  })

  if (pendingOrdinal) {
    return pendingOrdinal
  }

  return null
}

type ScrollDirection = 'none' | 'back' | 'forward'
export const numMessagesOnInitialLoad = C.isMobile ? 20 : 100
export const numMessagesOnScrollback = C.isMobile ? 100 : 100

const createSlice: Z.ImmerStateCreator<ConvoState> = (set, get) => {
  const closeBotModal = () => {
    C.useRouterState.getState().dispatch.clearModals()
    const meta = get().meta
    if (meta.teamname) {
      C.useTeamsState.getState().dispatch.getMembers(meta.teamID)
    }
  }

  const downloadAttachment = async (downloadToCache: boolean, message: T.Chat.Message) => {
    const {ordinal, conversationIDKey} = message
    try {
      const rpcRes = await T.RPCChat.localDownloadFileAttachmentLocalRpcPromise({
        conversationID: T.Chat.keyToConversationID(conversationIDKey),
        downloadToCache,
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        messageID: message.id,
        preview: false,
      })

      const path = rpcRes.filePath
      const m = get().messageMap.get(ordinal)
      if (m?.type === 'attachment') {
        dispatch.updateMessage(ordinal, {
          downloadPath: path,
          fileURLCached: true, // assume we have this on the service now
          transferErrMsg: undefined,
          transferProgress: 0,
          transferState: undefined,
        })
        dispatch.updateAttachmentViewTransfered(message.id, path)
      }
      return rpcRes.filePath
    } catch (error) {
      if (error instanceof RPCError) {
        logger.info(`downloadAttachment error: ${error.message}`)
        const m = get().messageMap.get(ordinal)
        if (m?.type === 'attachment') {
          dispatch.updateMessage(ordinal, {
            downloadPath: '',
            fileURLCached: true, // assume we have this on the service now
            transferErrMsg: error.message || 'Error downloading attachment',
            transferProgress: 0,
            transferState: undefined,
          })
          dispatch.updateAttachmentViewTransfered(message.id, '')
        }
      } else {
        const m = get().messageMap.get(ordinal)
        if (m?.type === 'attachment') {
          dispatch.updateMessage(ordinal, {
            downloadPath: '',
            fileURLCached: true, // assume we have this on the service now
            transferErrMsg: 'Error downloading attachment',
            transferProgress: 0,
            transferState: undefined,
          })
          dispatch.updateAttachmentViewTransfered(message.id, '')
        }
      }
      return false
    }
  }

  const getClientPrev = (): T.Chat.MessageID => {
    let clientPrev: undefined | T.Chat.MessageID
    const {messageMap, messageOrdinals} = get()
    const mm = messageMap
    // find last valid messageid we know about
    const goodOrdinal = findLast(messageOrdinals ?? [], o => {
      const m = mm.get(o)
      return !!m?.id
    })

    if (goodOrdinal) {
      const message = mm.get(goodOrdinal)
      clientPrev = message && message.id
    }
    return clientPrev || T.Chat.numberToMessageID(0)
  }

  // things that depend on messageMap, like the ordinals and the maxMsgIDSeen
  const syncMessageDerived = (s: ConvoState) => {
    const mo = [...s.messageMap.keys()].sort((a, b) => a - b)
    if (!C.shallowEqual(s.messageOrdinals, mo)) {
      s.messageOrdinals = mo
    }
    const last = mo.at(-1)
    if (last && last > s.maxMsgIDSeen) {
      s.maxMsgIDSeen = last
    }
  }

  const dispatch: ConvoState['dispatch'] = {
    addBotMember: (username, allowCommands, allowMentions, restricted, convs) => {
      const f = async () => {
        const conversationIDKey = get().id
        try {
          await T.RPCChat.localAddBotMemberRpcPromise(
            {
              botSettings: restricted ? {cmds: allowCommands, convs, mentions: allowMentions} : null,
              convID: T.Chat.keyToConversationID(conversationIDKey),
              role: restricted ? T.RPCGen.TeamRole.restrictedbot : T.RPCGen.TeamRole.bot,
              username,
            },
            Common.waitingKeyBotAdd
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('addBotMember: failed to add bot member: ' + error.message)
          }
          return
        }
        closeBotModal()
      }
      C.ignorePromise(f())
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
      C.ignorePromise(f())
    },
    attachmentDownload: ordinal => {
      const {dispatch, messageMap} = get()
      const m = messageMap.get(ordinal)
      if (m?.type === 'attachment') {
        dispatch.updateMessage(ordinal, {
          transferErrMsg: undefined,
          transferState: 'downloading',
        })
      } else {
        dispatch.updateMessage(ordinal, {
          transferErrMsg: 'Trying to download missing / incorrect message?',
          transferState: undefined,
        })
        return
      }
      // Download an attachment to your device
      const f = async () => {
        // already downloaded?
        if (m.downloadPath) {
          logger.warn('Attachment already downloaded')
          return
        }
        await downloadAttachment(false, m)
      }
      C.ignorePromise(f())
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
        C.useRouterState.getState().dispatch.navigateAppend({
          props: {conversationIDKey: get().id, noDragDrop: true, pathAndOutboxIDs},
          selected: 'chatAttachmentGetTitles',
        })
      }
      C.ignorePromise(f())
    },
    attachmentPreviewSelect: ordinal => {
      C.useRouterState.getState().dispatch.navigateAppend({
        props: {conversationIDKey: get().id, ordinal},
        selected: 'chatAttachmentFullscreen',
      })
    },
    attachmentUploadCanceled: outboxIDs => {
      const f = async () => {
        for (const outboxID of outboxIDs) {
          await T.RPCChat.localCancelUploadTempFileRpcPromise({outboxID})
        }
      }
      C.ignorePromise(f())
    },
    attachmentsUpload: (paths, titles, _tlfName, _spoiler) => {
      const f = async () => {
        let tlfName = _tlfName
        const conversationIDKey = get().id
        const meta = get().meta
        if (!get().isMetaGood()) {
          if (!tlfName) {
            logger.warn('attachmentsUpload: missing meta for attachment upload', conversationIDKey)
            return
          }
        } else {
          tlfName = meta.tlfname
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
                conversationID: T.Chat.keyToConversationID(conversationIDKey),
                filename: Styles.unnormalizePath(p.path),
                identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
                metadata: new Uint8Array(),
                outboxID: outboxIDs[i],
                title: titles[i] ?? '',
                tlfName: tlfName ?? '',
                visibility: T.RPCGen.TLFVisibility.private,
              },
              clientPrev,
            })
          )
        )
      }
      C.ignorePromise(f())
    },
    badgesUpdated: badge => {
      set(s => {
        s.badge = badge
      })
    },
    blockConversation: reportUser => {
      const f = async () => {
        C.useChatState.getState().dispatch.navigateToInbox()
        C.useConfigState.getState().dispatch.dynamic.persistRoute?.()
        await T.RPCChat.localSetConversationStatusLocalRpcPromise({
          conversationID: T.Chat.keyToConversationID(get().id),
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          status: reportUser ? T.RPCChat.ConversationStatus.reported : T.RPCChat.ConversationStatus.blocked,
        })
      }
      C.ignorePromise(f())
    },
    botCommandsUpdateStatus: status => {
      set(s => {
        s.botCommandsUpdateStatus = status.typ
        if (status.typ === T.RPCChat.UIBotCommandsUpdateStatusTyp.uptodate) {
          const settingsMap = new Map<string, T.RPCGen.TeamBotSettings | undefined>()
          Object.keys(status.uptodate.settings ?? {}).forEach(u => {
            settingsMap.set(u, status.uptodate.settings?.[u])
          })
          s.botSettings = settingsMap
        }
      })
    },
    channelSuggestionsTriggered: () => {
      const meta = get().meta
      // If this is an impteam, try to refresh mutual team info
      if (!meta.teamname) {
        get().dispatch.refreshMutualTeamsInConv()
      }
    },
    clearAttachmentView: () => {
      set(s => {
        s.attachmentViewMap = new Map()
      })
    },
    desktopNotification: (author, body) => {
      if (C.isMobile) return

      // Show a desktop notification
      const meta = get().meta
      const conversationIDKey = get().id
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
        C.useConfigState.getState().dispatch.showMain()
        C.useChatState.getState().dispatch.navigateToInbox()
        get().dispatch.navigateToThread('desktopNotification')
      }
      const onClose = () => {}
      logger.info('invoking NotifyPopup for chat notification')
      const sound = C.useConfigState.getState().notifySound

      NotifyPopup(title, {body, sound}, -1, author, onClick, onClose)
    },
    dismissBlockButtons: teamID => {
      const f = async () => {
        try {
          await T.RPCGen.userDismissBlockButtonsRpcPromise({tlfID: teamID})
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`Couldn't dismiss block buttons: ${error.message}`)
          }
        }
      }
      C.ignorePromise(f())
    },
    dismissBottomBanner: () => {
      set(s => {
        s.dismissedInviteBanners = true
      })
    },
    dismissJourneycard: (cardType, ordinal) => {
      const f = async () => {
        await T.RPCChat.localDismissJourneycardRpcPromise({
          cardType: cardType,
          convID: T.Chat.keyToConversationID(get().id),
        }).catch((error: unknown) => {
          if (error instanceof RPCError) {
            logger.error(`Failed to dismiss journeycard: ${error.message}`)
          }
        })
        get().dispatch.messagesWereDeleted({ordinals: [ordinal]})
      }
      C.ignorePromise(f())
    },
    editBotSettings: (username, allowCommands, allowMentions, convs) => {
      const f = async () => {
        const conversationIDKey = get().id
        try {
          await T.RPCChat.localSetBotMemberSettingsRpcPromise(
            {
              botSettings: {cmds: allowCommands, convs, mentions: allowMentions},
              convID: T.Chat.keyToConversationID(conversationIDKey),
              username,
            },
            Common.waitingKeyBotAdd
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('addBotMember: failed to edit bot settings: ' + error.message)
          }
          return
        }
        closeBotModal()
      }
      C.ignorePromise(f())
    },
    giphyGotSearchResult: results => {
      set(s => {
        s.giphyResult = results
      })
    },
    giphySend: result => {
      set(s => {
        s.giphyWindow = false
      })
      const f = async () => {
        const replyTo = get().messageMap.get(get().replyTo)?.id
        try {
          await T.RPCChat.localTrackGiphySelectRpcPromise({result})
        } catch {}
        get().dispatch.messageSend(result.targetUrl, replyTo)
      }
      C.ignorePromise(f())
    },
    giphyToggleWindow: (show: boolean) => {
      set(s => {
        s.giphyWindow = show
      })
    },
    hideConversation: hide => {
      const conversationIDKey = get().id
      const f = async () => {
        if (hide) {
          // Nav to inbox but don't use findNewConversation since changeSelectedConversation
          // does that with better information. It knows the conversation is hidden even before
          // that state bounces back.
          C.useChatState.getState().dispatch.navigateToInbox()
          get().dispatch.showInfoPanel(false, undefined)
        }

        await T.RPCChat.localSetConversationStatusLocalRpcPromise(
          {
            conversationID: T.Chat.keyToConversationID(conversationIDKey),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            status: hide ? T.RPCChat.ConversationStatus.ignored : T.RPCChat.ConversationStatus.unfiled,
          },
          Common.waitingKeyConvStatusChange(conversationIDKey)
        )
      }
      C.ignorePromise(f())
    },
    hideSearch: () => {
      set(s => {
        s.threadSearchInfo.visible = false
      })
    },
    ignorePinnedMessage: () => {
      const f = async () => {
        await T.RPCChat.localIgnorePinnedMessageRpcPromise({
          convID: T.Chat.keyToConversationID(get().id),
        })
      }
      C.ignorePromise(f())
    },
    injectIntoInput: text => {
      set(s => {
        s.unsentText = text
      })
      get().dispatch.updateDraft(text)
    },
    joinConversation: () => {
      const f = async () => {
        await T.RPCChat.localJoinConversationByIDLocalRpcPromise(
          {convID: T.Chat.keyToConversationID(get().id)},
          Common.waitingKeyJoinConversation
        )
      }
      C.ignorePromise(f())
    },
    jumpToRecent: () => {
      get().dispatch.setMessageCenterOrdinal()
      get().dispatch.loadMoreMessages({forceClear: true, reason: 'jump to recent'})
    },
    leaveConversation: (navToInbox = true) => {
      const f = async () => {
        await T.RPCChat.localLeaveConversationLocalRpcPromise(
          {convID: T.Chat.keyToConversationID(get().id)},
          Common.waitingKeyLeaveConversation
        )
      }
      C.ignorePromise(f())
      C.useRouterState.getState().dispatch.clearModals()
      if (navToInbox) {
        C.useRouterState.getState().dispatch.navUpToScreen('chatRoot')
        C.useRouterState.getState().dispatch.switchTab(Tabs.chatTab)
        if (!C.isMobile) {
          const vs = C.Router2.getVisibleScreen()
          const params: undefined | {conversationIDKey?: T.Chat.ConversationIDKey} = vs?.params
          if (params?.conversationIDKey === get().id) {
            // select a convo
            const next = C.useChatState.getState().inboxLayout?.smallTeams?.[0]?.convID
            if (next) {
              C.getConvoState(next).dispatch.navigateToThread('findNewestConversationFromLayout')
            }
          }
        }
      }
    },
    loadAttachmentView: (viewType, fromMsgID) => {
      set(s => {
        const {attachmentViewMap} = s
        const info = mapGetEnsureValue(attachmentViewMap, viewType, makeAttachmentViewInfo())
        info.status = 'loading'
      })

      const f = async () => {
        const conversationIDKey = get().id
        try {
          const res = await T.RPCChat.localLoadGalleryRpcListener({
            incomingCallMap: {
              'chat.1.chatUi.chatLoadGalleryHit': (
                hit: T.RPCChat.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['inParam']
              ) => {
                const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
                const username = C.useCurrentUserState.getState().username
                const devicename = C.useCurrentUserState.getState().deviceName
                const message = Message.uiMessageToMessage(
                  conversationIDKey,
                  hit.message,
                  username,
                  getLastOrdinal,
                  devicename
                )

                if (message) {
                  set(s => {
                    const info = mapGetEnsureValue(s.attachmentViewMap, viewType, makeAttachmentViewInfo())
                    if (!info.messages.find(item => item.id === message.id)) {
                      info.messages = info.messages.concat(message).sort((l, r) => r.id - l.id)
                    }
                  })
                  // inject them into the message map
                  get().dispatch.messagesAdd([message])
                }
              },
            },
            params: {
              convID: T.Chat.keyToConversationID(conversationIDKey),
              fromMsgID,
              num: 50,
              typ: viewType,
            },
          })
          set(s => {
            const info = mapGetEnsureValue(s.attachmentViewMap, viewType, makeAttachmentViewInfo())
            info.last = !!res.last
            info.status = 'success'
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error('failed to load attachment view: ' + error.message)
            set(s => {
              const info = mapGetEnsureValue(s.attachmentViewMap, viewType, makeAttachmentViewInfo())
              info.last = false
              info.status = 'error'
            })
          }
        }
      }
      C.ignorePromise(f())
    },
    loadMessagesCentered: (messageID, highlightMode) => {
      get().dispatch.loadMoreMessages({
        centeredMessageID: {
          conversationIDKey: Common.getSelectedConversation(),
          highlightMode,
          messageID,
        },
        forceClear: true,
        forceContainsLatestCalc: true,
        messageIDControl: {
          mode: T.RPCChat.MessageIDControlMode.centered,
          num: numMessagesOnInitialLoad,
          pivot: messageID,
        },
        reason: 'centered',
      })
    },
    loadMoreMessages: p => {
      const {scrollDirection: sd = 'none', numberOfMessagesToLoad = numMessagesOnInitialLoad} = p
      const {forceClear = false, reason, messageIDControl, knownRemotes, centeredMessageID} = p

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
        const {id: conversationIDKey, meta, messageOrdinals, dispatch} = get()

        if (!conversationIDKey || !T.Chat.isValidConversationIDKey(conversationIDKey)) {
          logger.info('loadMoreMessages: bail: no conversationIDKey')
          return
        }
        if (meta.membershipType === 'youAreReset' || meta.rekeyers.size > 0) {
          logger.info('loadMoreMessages: bail: we are reset')
          return
        }
        logger.info(
          `loadMoreMessages: calling rpc convo: ${conversationIDKey} num: ${numberOfMessagesToLoad} reason: ${reason}`
        )

        const loadingKey = Common.waitingKeyThreadLoad(conversationIDKey)
        let calledClear = false
        const onGotThread = (thread: string) => {
          if (!thread) {
            return
          }
          const username = C.useCurrentUserState.getState().username
          const devicename = C.useCurrentUserState.getState().deviceName
          const getLastOrdinal = () => messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
          const uiMessages = JSON.parse(thread) as T.RPCChat.UIMessages
          let shouldClearOthers = false
          if (!calledClear) {
            if (forceClear) {
              shouldClearOthers = true
              calledClear = true
            }
          }

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
          dispatch.setMoreToLoad(moreToLoad)

          if (messages.length) {
            if (shouldClearOthers) {
              dispatch.messagesClear()
            }
            dispatch.messagesAdd(messages)
            if (centeredMessageID) {
              const ordinal = T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(centeredMessageID.messageID))
              dispatch.setMessageCenterOrdinal({highlightMode: centeredMessageID.highlightMode, ordinal})
            }
          }
        }

        const pagination = messageIDControl ? null : scrollDirectionToPagination(sd, numberOfMessagesToLoad)
        try {
          const results = await T.RPCChat.localGetThreadNonblockRpcListener({
            incomingCallMap: {
              'chat.1.chatUi.chatThreadCached': p => onGotThread(p.thread || ''),
              'chat.1.chatUi.chatThreadFull': p => onGotThread(p.thread || ''),
              'chat.1.chatUi.chatThreadStatus': p => {
                logger.info(
                  `loadMoreMessages: thread status received: convID: ${conversationIDKey} typ: ${p.status.typ}`
                )
                get().dispatch.setThreadLoadStatus(p.status.typ)
              },
            },
            params: {
              cbMode: T.RPCChat.GetThreadNonblockCbMode.incremental,
              conversationID: T.Chat.keyToConversationID(conversationIDKey),
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
                messageTypes: Common.loadThreadMessageTypes,
              },
              reason: Common.reasonToRPCReason(reason),
            },
            waitingKey: loadingKey,
          })
          if (get().isMetaGood()) {
            get().dispatch.updateMeta({offline: results.offline})
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.warn(`loadMoreMessages: error: ${error.desc}`)
            // no longer in team
            if (error.code === T.RPCGen.StatusCode.scchatnotinteam) {
              const {inboxRefresh, navigateToInbox} = C.useChatState.getState().dispatch
              inboxRefresh('maybeKickedFromTeam')
              navigateToInbox()
            }
            if (error.code !== T.RPCGen.StatusCode.scteamreaderror) {
              // scteamreaderror = user is not in team. they'll see the rekey screen so don't throw for that
              throw error
            }
          }
        }
      }
      C.ignorePromise(f())
    },
    loadNewerMessagesDueToScroll: () => {
      const {dispatch} = get()
      dispatch.loadMoreMessages({
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
          convID: T.Chat.keyToConversationID(get().id),
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          messageID: id,
        })

        if (result.message) {
          const devicename = C.useCurrentUserState.getState().deviceName
          const username = C.useCurrentUserState.getState().username
          const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
          const goodMessage = Message.uiMessageToMessage(
            get().id,
            result.message,
            username,
            getLastOrdinal,
            devicename
          )
          if (goodMessage?.type === 'attachment') {
            dispatch.messagesAdd([goodMessage])
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
    loadOlderMessagesDueToScroll: () => {
      const {dispatch, moreToLoad} = get()
      if (!moreToLoad) {
        logger.info('bail: scrolling back and at the end')
        return
      }
      dispatch.loadMoreMessages({
        numberOfMessagesToLoad: numMessagesOnScrollback,
        reason: 'scroll back',
        scrollDirection: 'back',
      })
    },
    markTeamAsRead: teamID => {
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          logger.info('bail on not logged in')
          return
        }
        const tlfID = hexToUint8Array(T.Teams.teamIDToString(teamID))
        await T.RPCChat.localMarkTLFAsReadLocalRpcPromise({tlfID})
      }
      C.ignorePromise(f())
    },
    markThreadAsRead: () => {
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          logger.info('mark read bail on not logged in')
          return
        }
        const {id: conversationIDKey, meta, messageMap, messageOrdinals, isMetaGood} = get()
        if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
          logger.info('mark read bail on no selected conversation')
          return
        }
        if (!Common.isUserActivelyLookingAtThisThread(conversationIDKey)) {
          logger.info('mark read bail on not looking at this thread')
          return
        }
        // Check to see if we do not have the latest message, and don't mark anything as read in that case
        // If we have no information at all, then just mark as read
        if (!get().isCaughtUp()) {
          logger.info('mark read bail on not containing latest message')
          return
        }

        const ordinal = findLast([...(messageOrdinals ?? [])], (o: T.Chat.Ordinal) => {
          const m = messageMap.get(o)
          return m ? !!m.id : false
        })
        const message = ordinal ? messageMap.get(ordinal) : undefined

        const readMsgID = message?.id
        // if we have a meta and we think we're already up to date ignore
        if (isMetaGood() && readMsgID === meta.readMsgID) {
          logger.info(`marking read messages is noop bail: ${conversationIDKey} ${readMsgID}`)
          return
        }

        // else just write it
        logger.info(`marking read messages ${conversationIDKey} ${readMsgID}`)
        await T.RPCChat.localMarkAsReadLocalRpcPromise({
          conversationID: T.Chat.keyToConversationID(conversationIDKey),
          forceUnread: false,
          msgID: readMsgID,
        })
      }
      C.ignorePromise(f())
    },
    messageAttachmentNativeSave: message => {
      if (!C.isMobile) return
      if (message.type !== 'attachment') {
        throw new Error('Invalid share message')
      }

      const f = async () => {
        const {ordinal, fileType} = message
        const fileName = await downloadAttachment(true, message)
        if (!fileName) {
          // failed to download
          logger.info('Downloading attachment failed')
          return
        }
        const {dispatch} = get()
        try {
          const m = get().messageMap.get(ordinal)
          if (m?.type === 'attachment') {
            dispatch.updateMessage(ordinal, {
              transferErrMsg: undefined,
              transferState: 'mobileSaving',
            })
          }
          logger.info('Trying to save chat attachment to camera roll')
          await C.PlatformSpecific.saveAttachmentToCameraRoll(fileName, fileType)
          if (m?.type === 'attachment') {
            dispatch.updateMessage(ordinal, {
              transferErrMsg: undefined,
              transferState: undefined,
            })
          }
        } catch (err) {
          logger.error('Failed to save attachment: ' + err)
          throw new Error('Failed to save attachment: ' + err)
        }
      }
      C.ignorePromise(f())
    },
    messageAttachmentNativeShare: ordinal => {
      const message = get().messageMap.get(ordinal)
      if (!message || message.type !== 'attachment') {
        throw new Error('Invalid share message')
      }
      // Native share sheet for attachments
      const f = async () => {
        const filePath = await downloadAttachment(true, message)
        if (!filePath) {
          logger.info('Downloading attachment failed')
          return
        }

        if (C.isIOS && message.fileName.endsWith('.pdf')) {
          C.useRouterState.getState().dispatch.navigateAppend({
            props: {
              conversationIDKey: get().id,
              ordinal,
              // Prepend the 'file://' prefix here. Otherwise when webview
              // automatically does that, it triggers onNavigationStateChange
              // with the new address and we'd call stoploading().
              url: 'file://' + filePath,
            },
            selected: 'chatPDF',
          })
          return
        }

        try {
          await C.PlatformSpecific.showShareActionSheet({filePath, mimeType: message.fileType})
        } catch (e) {
          logger.error('Failed to share attachment: ' + JSON.stringify(e))
        }
      }
      C.ignorePromise(f())
    },
    messageDelete: ordinal => {
      const {id, dispatch, messageMap, meta, isMetaGood} = get()
      const m = messageMap.get(ordinal)
      if (m?.type === 'text') {
        dispatch.updateMessage(ordinal, {submitState: 'deleting'})
      }

      const conversationIDKey = id

      // Delete a message. We cancel pending messages
      const f = async () => {
        const message = messageMap.get(ordinal)
        if (!message) {
          logger.warn('Deleting invalid message')
          return
        }
        if (!isMetaGood()) {
          logger.warn('Deleting message w/ no meta')
          return
        }
        // We have to cancel pending messages
        if (!message.id) {
          if (message.outboxID) {
            await T.RPCChat.localCancelPostRpcPromise(
              {outboxID: T.Chat.outboxIDToRpcOutboxID(message.outboxID)},
              Common.waitingKeyCancelPost
            )
            get().dispatch.messagesWereDeleted({
              ordinals: [message.ordinal],
            })
          } else {
            logger.warn('Delete of no message id and no outboxid')
          }
        } else {
          await T.RPCChat.localPostDeleteNonblockRpcPromise(
            {
              clientPrev: 0,
              conversationID: T.Chat.keyToConversationID(conversationIDKey),
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              outboxID: null,
              supersedes: message.id,
              tlfName: meta.tlfname,
              tlfPublic: false,
            },
            Common.waitingKeyDeletePost
          )
        }
      }
      C.ignorePromise(f())
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
          conversationID: T.Chat.keyToConversationID(get().id),
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          tlfName: meta.tlfname,
          tlfPublic: false,
        })
      }
      C.ignorePromise(f())
    },
    messageEdit: (ordinal, text) => {
      get().dispatch.injectIntoInput('')
      const {id, dispatch, messageMap, meta} = get()
      const message = messageMap.get(ordinal)
      dispatch.updateMessage(ordinal, {
        submitState: 'editing',
      })
      dispatch.setEditing(false)
      if (!message || !(message.type === 'text' || message.type === 'attachment')) {
        logger.warn("Can't find message to edit", ordinal)
        return
      }

      const conversationIDKey = id
      const f = async () => {
        // Skip if the content is the same
        if (message.type === 'text' && message.text.stringValue() === text) {
          dispatch.setEditing(false)
          return
        } else if (message.type === 'attachment' && message.title === text) {
          dispatch.setEditing(false)
          return
        }
        const tlfName = meta.tlfname
        const clientPrev = getClientPrev()
        const outboxID = Common.generateOutboxID()
        const target = {
          messageID: message.id,
          outboxID: message.outboxID ? T.Chat.outboxIDToRpcOutboxID(message.outboxID) : undefined,
        }
        await T.RPCChat.localPostEditNonblockRpcPromise(
          {
            body: text,
            clientPrev,
            conversationID: T.Chat.keyToConversationID(conversationIDKey),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            outboxID,
            target,
            tlfName,
            tlfPublic: false,
          },
          Common.waitingKeyEditPost
        )

        if (!message.id) {
          const m = messageMap.get(ordinal)
          if (m) {
            dispatch.updateMessage(ordinal, {
              ...(m.type === 'text' ? {text} : {}),
              ...(m.type === 'attachment' ? {title: text} : {}),
            })
          }
        }
      }
      C.ignorePromise(f())
    },
    messageReplyPrivately: ordinal => {
      const f = async () => {
        const message = get().messageMap.get(ordinal)
        if (!message) {
          logger.warn("messageReplyPrivately: can't find message to reply to", ordinal)
          return
        }
        const username = C.useCurrentUserState.getState().username
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
          Common.waitingKeyCreating
        )
        const conversationIDKey = T.Chat.conversationIDToKey(result.conv.info.id)
        if (!conversationIDKey) {
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

        const text = Common.formatTextForQuoting(message.text.stringValue())
        _getConvoState(conversationIDKey).dispatch.injectIntoInput(text)
        C.useChatState.getState().dispatch.metasReceived([meta])
        _getConvoState(conversationIDKey).dispatch.navigateToThread('createdMessagePrivately')
      }
      C.ignorePromise(f())
    },
    messageRetry: outboxID => {
      const ordinal = get().pendingOutboxToOrdinal.get(outboxID)
      if (!ordinal) {
        return
      }
      const m = get().messageMap.get(ordinal)
      if (!m) {
        return
      }
      get().dispatch.updateMessage(ordinal, {
        errorReason: undefined,
        submitState: 'pending',
      })

      const f = async () => {
        await T.RPCChat.localRetryPostRpcPromise(
          {outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)},
          Common.waitingKeyRetryPost
        )
      }
      C.ignorePromise(f())
    },
    messageSend: (text, replyTo, waitingKey) => {
      get().dispatch.injectIntoInput('')
      get().dispatch.setReplyTo(T.Chat.numberToOrdinal(0))
      get().dispatch.setCommandMarkdown()
      set(s => {
        s.giphyWindow = false
      })
      const f = async () => {
        const meta = get().meta
        const tlfName = meta.tlfname
        const conversationIDKey = get().id
        const clientPrev = getClientPrev()

        get().dispatch.sendTyping.cancel()
        get().dispatch.sendTyping(false)

        // disable sending exploding messages if flag is false
        const ephemeralLifetime = get().explodingMode
        const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
        const confirmRouteName = 'chatPaymentsConfirm'
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
                const visibleScreen = C.Router2.getVisibleScreen()
                if (visibleScreen && visibleScreen.name === confirmRouteName) {
                  C.useRouterState.getState().dispatch.clearModals()
                  return
                }
                if (canceled) {
                  get().dispatch.injectIntoInput(text)
                }
              },
              'chat.1.chatUi.chatStellarShowConfirm': () => {},
            },
            params: {
              ...ephemeralData,
              body: text,
              clientPrev,
              conversationID: T.Chat.keyToConversationID(conversationIDKey),
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              outboxID: undefined,
              replyTo,
              tlfName,
              tlfPublic: false,
            },
            waitingKey: waitingKey || Common.waitingKeyPost,
          })
          logger.info('success')
        } catch (_) {
          logger.info('error')
        }

        // If there are block buttons on this conversation, clear them.
        if (C.useChatState.getState().blockButtonsMap.has(meta.teamID)) {
          get().dispatch.dismissBlockButtons(meta.teamID)
        }

        // Do some logging to track down the root cause of a bug causing
        // messages to not send. Do this after creating the objects above to
        // narrow down the places where the action can possibly stop.
        logger.info('non-empty text?', text.length > 0)
      }
      C.ignorePromise(f())
    },
    messagesAdd: messages => {
      set(s => {
        for (const m of messages) {
          // we capture the highest one, cause sometimes we'll not track it in the map
          // aka for deleted or placeholders
          if (m.id > s.maxMsgIDSeen) {
            s.maxMsgIDSeen = m.id
          }
          if (m.type === 'deleted') {
            s.messageMap.delete(m.ordinal)
            s.messageTypeMap.delete(m.ordinal)
          } else {
            let mapOrdinal = m.ordinal
            // if we've sent it we use the outbox id to manage the ordinal relationship
            if (m.outboxID) {
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
                return
              }
            }

            const toWrite = {...m, ordinal: mapOrdinal}
            s.messageMap.set(mapOrdinal, toWrite)
            if (m.outboxID && T.Chat.messageIDToNumber(m.id) !== T.Chat.ordinalToNumber(m.ordinal)) {
              s.pendingOutboxToOrdinal.set(m.outboxID, toWrite.ordinal)
            }
            if (m.type === 'text') {
              s.messageTypeMap.delete(mapOrdinal)
            } else {
              s.messageTypeMap.set(mapOrdinal, Message.getMessageRenderType(m))
            }
          }
        }
        syncMessageDerived(s)
      })
      get().dispatch.markThreadAsRead()
    },
    messagesClear: () => {
      set(s => {
        s.pendingOutboxToOrdinal.clear()
        s.messageMap.clear()
        s.maxMsgIDSeen = -1
        syncMessageDerived(s)
        s.messageTypeMap.clear()
      })
    },
    messagesExploded: (messageIDs, explodedBy) => {
      const {pendingOutboxToOrdinal, dispatch, messageMap} = get()
      logger.info(`messagesExploded: exploding ${messageIDs.length} messages`)
      for (const mid of messageIDs) {
        const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, mid)
        const m = ordinal && messageMap.get(ordinal)
        if (m) {
          dispatch.updateMessage(ordinal, {
            exploded: true,
            explodedBy: explodedBy || '',
            flipGameID: '',
            mentionsAt: new Set(),
            reactions: new Map(),
            text: new HiddenString(''),
            unfurls: new Map(),
          })
        }
      }
    },
    messagesWereDeleted: p => {
      const {
        deletableMessageTypes = Common.allMessageTypes,
        messageIDs = [],
        ordinals = [],
        upToMessageID = null,
      } = p
      const {pendingOutboxToOrdinal, messageMap} = get()

      const upToOrdinals: Array<T.Chat.Ordinal> = []
      if (upToMessageID) {
        ;[...messageMap.entries()].reduce((arr, [ordinal, m]) => {
          if (m.id < upToMessageID && deletableMessageTypes.has(m.type)) {
            arr.push(ordinal)
          }
          return arr
        }, upToOrdinals)
      }

      const allOrdinals = new Set(
        [
          ...ordinals,
          ...messageIDs.map(messageID => messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, messageID)),
          ...upToOrdinals,
        ].reduce<Array<T.Chat.Ordinal>>((arr, n) => {
          if (n) {
            arr.push(n)
          }
          return arr
        }, [])
      )

      set(s => {
        allOrdinals.forEach(ordinal => {
          s.messageMap.delete(ordinal)
        })
        syncMessageDerived(s)
      })
    },
    metaReceivedError: (error, username) => {
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
        get().dispatch.updateMeta({
          snippet: error.message,
          snippetDecoration: T.RPCChat.SnippetDecoration.none,
          trustedState: 'error',
        })
      }
    },
    mute: m => {
      const f = async () => {
        await T.RPCChat.localSetConversationStatusLocalRpcPromise({
          conversationID: T.Chat.keyToConversationID(get().id),
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          status: m ? T.RPCChat.ConversationStatus.muted : T.RPCChat.ConversationStatus.unfiled,
        })
      }
      C.ignorePromise(f())
    },
    navigateToThread: (_reason, highlightMessageID, pushBody) => {
      get().dispatch.hideSearch()

      const loadMessages = () => {
        const {dispatch} = get()
        let reason: LoadMoreReason = _reason
        const forceClear = true
        let forceContainsLatestCalc = false
        let messageIDControl: T.RPCChat.MessageIDControl | undefined
        const knownRemotes = pushBody && pushBody.length > 0 ? [pushBody] : []
        const centeredMessageID = highlightMessageID
          ? {
              conversationIDKey: get().id,
              highlightMode: 'flash' as const,
              messageID: highlightMessageID,
            }
          : undefined

        if (highlightMessageID) {
          reason = 'centered'
          messageIDControl = {
            mode: T.RPCChat.MessageIDControlMode.centered,
            num: numMessagesOnInitialLoad,
            pivot: highlightMessageID,
          }
          forceContainsLatestCalc = true
        }
        dispatch.loadMoreMessages({
          centeredMessageID,
          forceClear,
          forceContainsLatestCalc,
          knownRemotes,
          messageIDControl,
          reason,
        })
      }
      loadMessages()

      const updateNav = () => {
        const reason = _reason
        // don't nav if its caused by a nav
        if (reason === 'navChanged') {
          return
        }
        const conversationIDKey = get().id
        const visible = C.Router2.getVisibleScreen()
        const params = visible?.params as {conversationIDKey?: T.Chat.ConversationIDKey} | undefined
        const visibleConvo = params?.conversationIDKey
        const visibleRouteName = visible?.name

        if (visibleRouteName !== Common.threadRouteName && reason === 'findNewestConversation') {
          // service is telling us to change our selection but we're not looking, ignore
          return
        }

        // we select the chat tab and change the params
        if (Common.isSplit) {
          C.Router2.navToThread(conversationIDKey)
          // immediately switch stack to an inbox | thread stack
        } else if (reason === 'push' || reason === 'savedLastState') {
          C.Router2.navToThread(conversationIDKey)
          return
        } else {
          // replace if looking at the pending / waiting screen
          const replace =
            visibleRouteName === Common.threadRouteName &&
            !T.Chat.isValidConversationIDKey(visibleConvo ?? '')
          // note: we don't switch tabs on non split
          const modalPath = C.Router2.getModalStack()
          if (modalPath.length > 0) {
            C.useRouterState.getState().dispatch.clearModals()
          }

          C.useRouterState
            .getState()
            .dispatch.navigateAppend({props: {conversationIDKey}, selected: Common.threadRouteName}, replace)
        }
      }
      updateNav()
    },
    onChatPaymentInfo: (action: EngineGen.Chat1NotifyChatChatPaymentInfoPayload) => {
      const {convID, info, msgID} = action.payload.params
      const conversationIDKey = T.Chat.conversationIDToKey(convID)
      const paymentInfo = Message.uiPaymentInfoToChatPaymentInfo([info])
      if (!paymentInfo) {
        // This should never happen
        const errMsg = `got 'NotifyChat.ChatPaymentInfo' with no valid paymentInfo for convID ${conversationIDKey} messageID: ${msgID}. The local version may be absent or out of date.`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
      C.useChatState.getState().dispatch.paymentInfoReceived(paymentInfo)
      C.getConvoState(conversationIDKey).dispatch.paymentInfoReceived(msgID, paymentInfo)
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.chat1NotifyChatChatAttachmentDownloadComplete: {
          const {msgID} = action.payload.params
          const {pendingOutboxToOrdinal, dispatch, messageMap} = get()
          const ordinal = messageIDToOrdinal(
            messageMap,
            pendingOutboxToOrdinal,
            T.Chat.numberToMessageID(msgID)
          )
          if (!ordinal) {
            logger.info(`downloadComplete: no ordinal found: conversationIDKey: ${get().id} msgID: ${msgID}`)
            return
          }
          const message = messageMap.get(ordinal)
          if (!message) {
            logger.info(
              `downloadComplete: no message found: conversationIDKey: ${get().id} ordinal: ${ordinal}`
            )
            return
          }
          if (message.type === 'attachment') {
            dispatch.updateMessage(ordinal, {
              transferProgress: 0,
              transferState: undefined,
            })
          }
          break
        }
        case EngineGen.chat1NotifyChatChatAttachmentDownloadProgress: {
          const {msgID, bytesComplete, bytesTotal} = action.payload.params
          const ratio = bytesComplete / bytesTotal
          get().dispatch.updateAttachmentViewTransfer(msgID, ratio)

          const {pendingOutboxToOrdinal, dispatch, messageMap} = get()
          const ordinal = messageIDToOrdinal(
            messageMap,
            pendingOutboxToOrdinal,
            T.Chat.numberToMessageID(msgID)
          )
          if (!ordinal) {
            logger.info(`downloadProgress: no ordinal found: conversationIDKey: ${get().id} msgID: ${msgID}`)
            return
          }
          const message = messageMap.get(ordinal)
          if (!message) {
            logger.info(
              `downloadProgress: no message found: conversationIDKey: ${get().id} ordinal: ${ordinal}`
            )
            return
          }
          const m = messageMap.get(message.ordinal)
          if (m?.type === 'attachment') {
            dispatch.updateMessage(ordinal, {
              transferErrMsg: undefined,
              transferProgress: ratio,
              transferState: 'downloading',
            })
          }
          break
        }
        case EngineGen.chat1ChatUiChatCommandStatus: {
          const {displayText, typ, actions} = action.payload.params
          get().dispatch.setCommandStatusInfo({
            actions: actions || [],
            displayText,
            displayType: typ,
          })
          break
        }
        case EngineGen.chat1ChatUiChatBotCommandsUpdateStatus:
          get().dispatch.botCommandsUpdateStatus(action.payload.params.status)
          break
        case EngineGen.chat1ChatUiChatCommandMarkdown:
          get().dispatch.setCommandMarkdown(action.payload.params.md || undefined)
          break
        case EngineGen.chat1ChatUiChatGiphyToggleResultWindow: {
          get().dispatch.onGiphyToggleWindow(action)
          break
        }
        case EngineGen.chat1ChatUiChatGiphySearchResults:
          get().dispatch.giphyGotSearchResult(action.payload.params.results)
          break
        case EngineGen.chat1NotifyChatChatRequestInfo:
          {
            const {info, msgID} = action.payload.params
            const requestInfo = Message.uiRequestInfoToChatRequestInfo(info)
            if (!requestInfo) {
              // This should never happen
              const errMsg = `got 'NotifyChat.ChatRequestInfo' with no valid requestInfo for convID ${
                get().id
              } messageID: ${msgID}. The local version may be absent or out of date.`
              logger.error(errMsg)
              throw new Error(errMsg)
            }
            get().dispatch.requestInfoReceived(msgID, requestInfo)
          }
          break
        case EngineGen.chat1NotifyChatChatPaymentInfo:
          get().dispatch.onChatPaymentInfo(action)
          break
        case EngineGen.chat1NotifyChatChatPromptUnfurl: {
          const {domain, msgID} = action.payload.params
          get().dispatch.unfurlTogglePrompt(T.Chat.numberToMessageID(msgID), domain, true)
          break
        }
        case EngineGen.chat1ChatUiChatInboxFailed: {
          const username = C.useCurrentUserState.getState().username
          const {convID, error} = action.payload.params
          const conversationIDKey = T.Chat.conversationIDToKey(convID)
          switch (error.typ) {
            case T.RPCChat.ConversationErrorType.transient:
              logger.info(
                `onFailed: ignoring transient error for convID: ${conversationIDKey} error: ${error.message}`
              )
              return
            default:
              logger.info(
                `onFailed: displaying error for convID: ${conversationIDKey} error: ${error.message}`
              )
              get().dispatch.metaReceivedError(error, username)
          }
          break
        }
        case EngineGen.chat1NotifyChatChatSetConvSettings: {
          const {conv} = action.payload.params
          const newRole = conv?.convSettings?.minWriterRoleInfo?.role
          const role = newRole && C.Teams.teamRoleByEnum[newRole]
          const conversationIDKey = get().id
          const cannotWrite = conv?.convSettings?.minWriterRoleInfo?.cannotWrite
          logger.info(
            `got new minWriterRole ${role || ''} for convID ${conversationIDKey}, cannotWrite ${
              cannotWrite ? 1 : 0
            }`
          )
          if (role && role !== 'none') {
            // only insert if the convo is already in the inbox
            if (get().isMetaGood()) {
              get().dispatch.updateMeta({
                cannotWrite,
                minWriterRole: role,
              })
            }
          } else {
            logger.warn(
              `got NotifyChat.ChatSetConvSettings with no valid minWriterRole for convID ${conversationIDKey}. The local version may be out of date.`
            )
          }
          break
        }

        case EngineGen.chat1NotifyChatChatAttachmentUploadStart: // fallthrough
        case EngineGen.chat1NotifyChatChatAttachmentUploadProgress: {
          const {params} = action.payload
          const ratio =
            action.type === EngineGen.chat1NotifyChatChatAttachmentUploadProgress
              ? action.payload.params.bytesComplete / action.payload.params.bytesTotal
              : 0.01
          const ordinal = get().pendingOutboxToOrdinal.get(T.Chat.rpcOutboxIDToOutboxID(params.outboxID))
          if (ordinal) {
            set(s => {
              const m = s.messageMap.get(ordinal)
              if (m?.type === 'attachment') {
                m.transferProgress = ratio
                m.transferState = 'uploading'
              }
            })
          }
          break
        }
        default:
      }
    },
    onGiphyToggleWindow: action => {
      const {show, clearInput} = action.payload.params
      if (clearInput) {
        get().dispatch.injectIntoInput('')
      }
      get().dispatch.giphyToggleWindow(show)
    },
    onIncomingMessage: incoming => {
      const {message: cMsg} = incoming
      const username = C.useCurrentUserState.getState().username
      // check for a reaction outbox notification before doing anything
      if (
        cMsg.state === T.RPCChat.MessageUnboxedState.outbox &&
        cMsg.outbox.messageType === T.RPCChat.MessageType.reaction
      ) {
        get().dispatch.toggleLocalReaction({
          decorated: cMsg.outbox.decoratedTextBody ?? '',
          emoji: cMsg.outbox.body,
          targetOrdinal: T.Chat.numberToOrdinal(cMsg.outbox.supersedes),
          username,
        })
        return
      }

      const {modifiedMessage, displayDesktopNotification, desktopNotificationSnippet} = incoming
      const conversationIDKey = get().id
      const devicename = C.useCurrentUserState.getState().deviceName
      const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
      const message = Message.uiMessageToMessage(
        conversationIDKey,
        cMsg,
        username,
        getLastOrdinal,
        devicename
      )
      if (message) {
        // The attachmentuploaded call is like an 'edit' of an attachment. We get the placeholder, then its replaced by the actual image
        if (
          cMsg.state === T.RPCChat.MessageUnboxedState.valid &&
          cMsg.valid.messageBody.messageType === T.RPCChat.MessageType.attachmentuploaded &&
          message.type === 'attachment'
        ) {
          const placeholderID = cMsg.valid.messageBody.attachmentuploaded.messageID
          const ordinal = messageIDToOrdinal(
            get().messageMap,
            get().pendingOutboxToOrdinal,
            T.Chat.numberToMessageID(placeholderID)
          )
          if (ordinal) {
            const m = get().messageMap.get(ordinal)
            dispatch.updateMessage(ordinal, m ? Message.upgradeMessage(m, message) : message)
            const subType = Message.getMessageRenderType(message)
            set(s => {
              s.messageTypeMap.set(ordinal, subType)
            })
          }
        } else {
          // A normal message
          dispatch.messagesAdd([message])
        }
      } else if (cMsg.state === T.RPCChat.MessageUnboxedState.valid) {
        const {valid} = cMsg
        const body = valid.messageBody
        logger.info(`Got chat incoming message of messageType: ${body.messageType}`)
        // Types that are mutations
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
                dispatch.messagesAdd([modMessage])
              }
            }
            break
          case T.RPCChat.MessageType.delete: {
            const {delete: d} = body
            if (d.messageIDs) {
              // check if the delete is acting on an exploding message
              const messageIDs = T.Chat.numbersToMessageIDs(d.messageIDs)
              const messages = get().messageMap
              const isExplodeNow = messageIDs.some(id => {
                const message =
                  messages.get(T.Chat.numberToOrdinal(id)) ??
                  [...messages.values()].find(msg => T.Chat.numberToMessageID(msg.id) === id)
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
            break
          }
          default:
        }
      }
      if (
        !C.isMobile &&
        displayDesktopNotification &&
        desktopNotificationSnippet &&
        cMsg.state === T.RPCChat.MessageUnboxedState.valid
      ) {
        get().dispatch.desktopNotification(cMsg.valid.senderUsername, desktopNotificationSnippet)
      }
    },
    onMessageErrored: (outboxID, reason, errorTyp) => {
      const {pendingOutboxToOrdinal, dispatch, messageMap} = get()
      const ordinal = pendingOutboxToOrdinal.get(outboxID)
      if (!ordinal) {
        return
      }
      const m = messageMap.get(ordinal)
      if (!m) {
        return
      }
      dispatch.updateMessage(ordinal, {
        errorReason: reason,
        errorTyp: errorTyp || undefined,
        submitState: 'failed',
      })
    },
    onMessagesUpdated: messagesUpdated => {
      const {pendingOutboxToOrdinal, dispatch, messageMap} = get()
      const username = C.useCurrentUserState.getState().username
      const devicename = C.useCurrentUserState.getState().deviceName
      const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
      for (const msg of messagesUpdated.updates ?? []) {
        const messageID = Message.getMessageID(msg)
        if (!messageID) {
          return
        }
        const message = Message.uiMessageToMessage(get().id, msg, username, getLastOrdinal, devicename)
        if (!message) {
          return
        }
        const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, messageID)
        if (ordinal) {
          dispatch.updateMessage(ordinal, message)
        }
      }
    },
    openFolder: () => {
      const meta = get().meta
      const participantInfo = get().participants
      const path = T.FS.stringToPath(
        meta.teamType !== 'adhoc'
          ? C.Config.teamFolder(meta.teamname)
          : C.Config.privateFolderWithUsers(participantInfo.name)
      )
      C.FS.makeActionForOpenPathInFilesTab(path)
    },
    paymentInfoReceived: (messageID, paymentInfo) => {
      set(s => {
        s.accountsInfoMap.set(messageID, paymentInfo)
      })
    },
    pinMessage: msgID => {
      const f = async () => {
        const convID = T.Chat.keyToConversationID(get().id)
        try {
          if (msgID) {
            await T.RPCChat.localPinMessageRpcPromise({convID, msgID})
          } else {
            await T.RPCChat.localUnpinMessageRpcPromise({convID}, Common.waitingKeyUnpin(get().id))
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`pinMessage: ${error.message}`)
          }
        }
      }
      C.ignorePromise(f())
    },
    refreshBotRoleInConv: username => {
      const f = async () => {
        let role: T.RPCGen.TeamRole | undefined
        const conversationIDKey = get().id
        try {
          role = await T.RPCChat.localGetTeamRoleInConversationRpcPromise({
            convID: T.Chat.keyToConversationID(conversationIDKey),
            username,
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`refreshBotRoleInConv: failed to refresh bot team role: ${error.message}`)
          }
          return
        }
        const trole = C.Teams.teamRoleByEnum[role]
        const r = !trole || trole === 'none' ? undefined : trole
        set(s => {
          const roles = s.botTeamRoleMap
          if (r !== undefined) {
            roles.set(username, r)
          } else {
            roles.delete(username)
          }
        })
      }
      C.ignorePromise(f())
    },
    refreshBotSettings: username => {
      set(s => {
        s.botSettings.delete(username)
      })
      const conversationIDKey = get().id
      const f = async () => {
        try {
          const settings = await T.RPCChat.localGetBotMemberSettingsRpcPromise({
            convID: T.Chat.keyToConversationID(conversationIDKey),
            username,
          })
          set(s => {
            s.botSettings.set(username, settings)
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`refreshBotSettings: failed to refresh settings for ${username}: ${error.message}`)
          }
          return
        }
      }
      C.ignorePromise(f())
    },
    refreshMutualTeamsInConv: () => {
      const f = async () => {
        const conversationIDKey = get().id
        const username = C.useCurrentUserState.getState().username
        const otherParticipants = Meta.getRowParticipants(get().participants, username || '')
        const results = await T.RPCChat.localGetMutualTeamsLocalRpcPromise(
          {usernames: otherParticipants},
          Common.waitingKeyMutualTeams(conversationIDKey)
        )
        set(s => {
          s.mutualTeams = results.teamIDs ?? []
        })
      }
      C.ignorePromise(f())
    },
    removeBotMember: username => {
      const f = async () => {
        const convID = T.Chat.keyToConversationID(get().id)
        try {
          await T.RPCChat.localRemoveBotMemberRpcPromise({convID, username}, Common.waitingKeyBotRemove)
          closeBotModal()
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('removeBotMember: failed to remove bot member: ' + error.message)
          }
        }
      }
      C.ignorePromise(f())
    },
    replyJump: messageID => {
      get().dispatch.setMessageCenterOrdinal()
      get().dispatch.loadMessagesCentered(messageID, 'flash')
    },
    requestInfoReceived: (messageID, requestInfo) => {
      set(s => {
        s.accountsInfoMap.set(messageID, requestInfo)
      })
    },
    resetChatWithoutThem: () => {
      // Implicit teams w/ reset users we can invite them back in or chat w/o them
      const meta = get().meta
      const participantInfo = get().participants
      // remove all bad people
      const goodParticipants = new Set(participantInfo.all)
      meta.resetParticipants.forEach(r => goodParticipants.delete(r))
      C.useChatState.getState().dispatch.previewConversation({
        participants: [...goodParticipants],
        reason: 'resetChatWithoutThem',
      })
    },
    resetLetThemIn: username => {
      // let them back in after they reset
      const f = async () => {
        await T.RPCChat.localAddTeamMemberAfterResetRpcPromise({
          convID: T.Chat.keyToConversationID(get().id),
          username,
        })
      }
      C.ignorePromise(f())
    },
    resetState: 'default',
    resetUnsentText: () => {
      set(s => {
        s.unsentText = undefined
      })
    },
    resolveMaybeMention: (channel, name) => {
      const f = async () => {
        await T.RPCChat.localResolveMaybeMentionRpcPromise({
          mention: {channel, name},
        })
      }
      C.ignorePromise(f())
    },
    selectedConversation: () => {
      const conversationIDKey = get().id

      const fetchConversationBio = () => {
        const participantInfo = get().participants
        const username = C.useCurrentUserState.getState().username
        const otherParticipants = Meta.getRowParticipants(participantInfo, username || '')
        if (otherParticipants.length === 1) {
          // we're in a one-on-one convo
          const username = otherParticipants[0] || ''

          // if this is an SBS/phone/email convo or we get a garbage username, don't do anything
          if (username === '' || username.includes('@')) {
            return
          }

          C.useUsersState.getState().dispatch.getBio(username)
        }
      }

      const ensureSelectedTeamLoaded = () => {
        const selectedConversation = Common.getSelectedConversation()
        const {meta, isMetaGood} = _getConvoState(selectedConversation)
        if (isMetaGood()) {
          const {teamID, teamname} = meta
          if (teamname) {
            C.useTeamsState.getState().dispatch.getMembers(teamID)
          }
        }
      }
      ensureSelectedTeamLoaded()
      const participantInfo = get().participants
      const force = !get().isMetaGood() || participantInfo.all.length === 0
      C.useChatState.getState().dispatch.unboxRows([conversationIDKey], force)
      get().dispatch.setThreadLoadStatus(T.RPCChat.UIChatThreadStatusTyp.none)
      get().dispatch.setMessageCenterOrdinal()
      fetchConversationBio()
      C.useChatState.getState().dispatch.resetConversationErrored()
    },
    sendAudioRecording: (path, duration, amps) => {
      const f = async () => {
        const conversationIDKey = get().id
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
              conversationID: T.Chat.keyToConversationID(conversationIDKey),
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
      }
      C.ignorePromise(f())
    },
    sendTyping: throttle(
      typing => {
        const f = async () => {
          await T.RPCChat.localUpdateTypingRpcPromise({
            conversationID: T.Chat.keyToConversationID(get().id),
            typing,
          })
        }
        C.ignorePromise(f())
      },
      2000,
      {leading: true, trailing: true}
    ),
    setCommandMarkdown: md => {
      set(s => {
        s.commandMarkdown = md
      })
    },
    setCommandStatusInfo: info => {
      set(s => {
        s.commandStatus = info
      })
    },
    setConvRetentionPolicy: _policy => {
      const f = async () => {
        const convID = T.Chat.keyToConversationID(get().id)
        let policy: T.RPCChat.RetentionPolicy | undefined
        try {
          policy = C.Teams.retentionPolicyToServiceRetentionPolicy(_policy)
          await T.RPCChat.localSetConvRetentionLocalRpcPromise({convID, policy})
        } catch (error) {
          if (error instanceof RPCError) {
            // should never happen
            logger.error(`Unable to parse retention policy: ${error.message}`)
          }
          throw error
        }
      }
      C.ignorePromise(f())
    },
    setEditing: _ordinal => {
      // clearing
      if (_ordinal === false) {
        set(s => {
          s.editing = T.Chat.numberToOrdinal(0)
        })
        get().dispatch.injectIntoInput('')
        return
      }

      const messageMap = get().messageMap

      let ordinal = T.Chat.numberToOrdinal(0)
      // Editing last message
      if (_ordinal === true) {
        const editLastUser = C.useCurrentUserState.getState().username
        // Editing your last message
        const ordinals = get().messageOrdinals
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
        ordinal = _ordinal
      }

      if (!ordinal) {
        return
      }
      const message = messageMap.get(ordinal)
      if (message?.type === 'text' || message?.type === 'attachment') {
        set(s => {
          s.editing = ordinal
        })
        if (message.type === 'text') {
          get().dispatch.injectIntoInput(message.text.stringValue())
        } else {
          get().dispatch.injectIntoInput(message.title)
        }
      }
    },
    setExplodingMode: (seconds, incoming) => {
      set(s => {
        s.explodingMode = seconds
      })
      if (incoming) return
      const conversationIDKey = get().id
      const f = async () => {
        logger.info(`Setting exploding mode for conversation ${conversationIDKey} to ${seconds}`)

        // unset a conversation exploding lock for this convo so we accept the new one
        get().dispatch.setExplodingModeLocked(false)

        const category = `${Common.explodingModeGregorKeyPrefix}${conversationIDKey}`
        const meta = get().meta
        const convRetention = Meta.getEffectiveRetentionPolicy(meta)
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
      C.ignorePromise(f())
    },
    setExplodingModeLocked: locked => {
      set(s => {
        s.explodingModeLock = locked ? get().explodingMode : undefined
      })
    },
    setMarkAsUnread: readMsgID => {
      // false means clear, readMsgID === undefined means last item
      set(s => {
        s.markedAsUnread = readMsgID !== false
      })
      if (readMsgID === false) {
        return
      }
      const conversationIDKey = get().id
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          logger.info('mark unread bail on not logged in')
          return
        }
        const meta = get().meta
        const unreadLineID = readMsgID ? readMsgID : meta.maxVisibleMsgID
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
              const onGotThread = (p: string) => {
                try {
                  const d = JSON.parse(p) as undefined | {messages?: Array<{valid?: {messageID?: unknown}}>}
                  const m = d?.messages?.[1]?.valid?.messageID
                  if (typeof m === 'number') {
                    msgID = m
                  }
                  resolve()
                } catch {}
              }
              T.RPCChat.localGetThreadNonblockRpcListener({
                incomingCallMap: {
                  'chat.1.chatUi.chatThreadCached': p => onGotThread(p.thread || ''),
                  'chat.1.chatUi.chatThreadFull': p => onGotThread(p.thread || ''),
                },
                params: {
                  cbMode: T.RPCChat.GetThreadNonblockCbMode.incremental,
                  conversationID: T.Chat.keyToConversationID(conversationIDKey),
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
                    messageTypes: Common.loadThreadMessageTypes,
                  },
                  reason: Common.reasonToRPCReason(''),
                },
              })
                .then(() => {})
                .catch(() => {
                  resolve()
                })
            })
          } catch {}
        }

        if (!msgID) {
          logger.info(`marking unread messages ${conversationIDKey} failed due to no id`)
          return
        }

        logger.info(`marking unread messages ${conversationIDKey} ${msgID}`)
        T.RPCChat.localMarkAsReadLocalRpcPromise({
          conversationID: T.Chat.keyToConversationID(conversationIDKey),
          forceUnread: true,
          msgID,
        })
          .then(() => {})
          .catch(() => {})
      }
      C.ignorePromise(f())
    },
    setMessageCenterOrdinal: m => {
      set(s => {
        s.messageCenterOrdinal = m
      })
    },
    setMeta: _m => {
      // see updatemeta
      const m = _m ?? Meta.makeConversationMeta()
      const wasGood = get().isMetaGood()
      set(s => {
        C.updateImmer(s.meta, m)
      })
      const isGood = get().isMetaGood()
      if (!wasGood && isGood) {
        // got a good meta, adopt the draft once
        set(s => {
          // bail on if there is something
          if (s.unsentText !== undefined) return
          s.unsentText = s.meta.draft.length ? s.meta.draft : undefined
        })
      }
    },
    setMinWriterRole: role => {
      const f = async () => {
        logger.info(`Setting minWriterRole to ${role} for convID ${get().id}`)
        await T.RPCChat.localSetConvMinWriterRoleLocalRpcPromise({
          convID: T.Chat.keyToConversationID(get().id),
          role: T.RPCGen.TeamRole[role],
        })
      }
      C.ignorePromise(f())
    },
    setMoreToLoad: m => {
      set(s => {
        s.moreToLoad = m
      })
    },
    setParticipants: p => {
      set(s => {
        if (!C.shallowEqual(s.participants.all, p.all)) {
          s.participants.all = p.all
        }
        if (!C.shallowEqual(s.participants.name, p.name)) {
          s.participants.name = p.name
        }
        if (!isEqual(s.participants.contactName, p.contactName)) {
          s.participants.contactName = p.contactName
        }
      })
    },
    setPendingOutboxToOrdinal: p => {
      set(s => {
        s.pendingOutboxToOrdinal = p
      })
    },
    setReplyTo: o => {
      set(s => {
        s.replyTo = o
      })
    },
    setThreadLoadStatus: status => {
      set(s => {
        s.threadLoadStatus = status
      })
    },
    setThreadSearchQuery: query => {
      set(s => {
        s.threadSearchQuery = query
      })
    },
    setTyping: throttle(t => {
      set(s => {
        if (!isEqual(s.typing, t)) {
          s.typing = t
        }
      })
    }, 1000),
    setupSubscriptions: () => {},
    showInfoPanel: (show, tab) => {
      C.useChatState.getState().dispatch.updateInfoPanel(show, tab)
      const conversationIDKey = get().id
      if (Platform.isPhone) {
        const visibleScreen = C.Router2.getVisibleScreen()
        if ((visibleScreen?.name === 'chatInfoPanel') !== show) {
          if (show) {
            C.useRouterState
              .getState()
              .dispatch.navigateAppend({props: {conversationIDKey, tab}, selected: 'chatInfoPanel'})
          } else {
            C.useRouterState.getState().dispatch.navigateUp()
            get().dispatch.clearAttachmentView()
          }
        }
      }
    },
    tabSelected: () => {
      get().dispatch.loadMoreMessages({reason: 'tab selected'})
      get().dispatch.markThreadAsRead()
    },
    threadSearch: query => {
      set(s => {
        s.threadSearchInfo.hits = []
      })
      const f = async () => {
        const conversationIDKey = get().id
        const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
        const username = C.useCurrentUserState.getState().username
        const devicename = C.useCurrentUserState.getState().deviceName
        const onDone = () => {
          set(s => {
            s.threadSearchInfo.status = 'done'
          })
        }
        try {
          await T.RPCChat.localSearchInboxRpcListener({
            incomingCallMap: {
              'chat.1.chatUi.chatSearchDone': onDone,
              'chat.1.chatUi.chatSearchHit': hit => {
                const message = Message.uiMessageToMessage(
                  conversationIDKey,
                  hit.searchHit.hitMessage,
                  username,
                  getLastOrdinal,
                  devicename
                )

                if (message) {
                  set(s => {
                    s.threadSearchInfo.hits.push(message)
                  })
                }
              },
              'chat.1.chatUi.chatSearchInboxDone': onDone,
              'chat.1.chatUi.chatSearchInboxHit': resp => {
                const messages = (resp.searchHit.hits || []).reduce<Array<T.Chat.Message>>((l, h) => {
                  const uiMsg = Message.uiMessageToMessage(
                    conversationIDKey,
                    h.hitMessage,
                    username,
                    getLastOrdinal,
                    devicename
                  )
                  if (uiMsg) {
                    l.push(uiMsg)
                  }
                  return l
                }, [])
                set(s => {
                  if (messages.length > 0) {
                    // entirely replace
                    s.threadSearchInfo.hits = messages
                  }
                })
              },
              'chat.1.chatUi.chatSearchInboxStart': () => {
                set(s => {
                  s.threadSearchInfo.status = 'inprogress'
                })
              },
            },
            params: {
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              namesOnly: false,
              opts: {
                afterContext: 0,
                beforeContext: 0,
                convID: T.Chat.keyToConversationID(conversationIDKey),
                isRegex: false,
                matchMentions: false,
                maxBots: 0,
                maxConvsHit: 0,
                maxConvsSearched: 0,
                maxHits: 1000,
                maxMessages: -1,
                maxNameConvs: 0,
                maxTeams: 0,
                reindexMode: T.RPCChat.ReIndexingMode.postsearchSync,
                sentAfter: 0,
                sentBefore: 0,
                sentBy: '',
                sentTo: '',
                skipBotCache: false,
              },
              query,
            },
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error('search failed: ' + error.message)
            set(s => {
              s.threadSearchInfo.status = 'done'
            })
          }
        }
      }
      C.ignorePromise(f())
    },
    toggleGiphyPrefill: () => {
      // if the window is up, just blow it away
      get().dispatch.injectIntoInput(get().giphyWindow ? '' : '/giphy ')
    },
    toggleLocalReaction: p => {
      const {decorated, emoji, targetOrdinal, username} = p
      set(s => {
        const m = s.messageMap.get(targetOrdinal)
        if (m && Message.isMessageWithReactions(m)) {
          const reactions = m.reactions
          const rs = {
            decorated: reactions.get(emoji)?.decorated ?? decorated,
            users: reactions.get(emoji)?.users ?? new Set(),
          }
          reactions.set(emoji, rs)
          const existing = [...rs.users].find(r => r.username === username)
          if (existing) {
            // found an existing reaction. remove it from our list
            rs.users.delete(existing)
          }
          // no existing reaction. add this one to the map
          rs.users.add(Message.makeReaction({timestamp: Date.now(), username}))
          if (rs.users.size === 0) {
            reactions.delete(emoji)
          }
        }
      })
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
          convID: T.Chat.keyToConversationID(get().id),
          msgID: messageID,
        })
      }
      C.ignorePromise(f())
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
        const supersedes = id
        const conversationIDKey = get().id
        const clientPrev = getClientPrev()
        const meta = get().meta
        const outboxID = Common.generateOutboxID()
        logger.info(`toggleMessageReaction: posting reaction`)
        try {
          await T.RPCChat.localPostReactionNonblockRpcPromise({
            body: emoji,
            clientPrev,
            conversationID: T.Chat.keyToConversationID(conversationIDKey),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            outboxID,
            supersedes,
            tlfName: meta.tlfname,
            tlfPublic: false,
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`toggleMessageReaction: failed to post` + error.message)
          }
        }
      }
      C.ignorePromise(f())
    },
    toggleThreadSearch: hide => {
      set(s => {
        const {threadSearchInfo} = s
        threadSearchInfo.hits = []
        threadSearchInfo.status = 'initial'
        if (hide !== undefined) {
          threadSearchInfo.visible = !hide
        } else {
          threadSearchInfo.visible = !threadSearchInfo.visible
        }
        if (s.messageCenterOrdinal) {
          s.messageCenterOrdinal.highlightMode = 'none'
        }
      })

      const f = async () => {
        const visible = get().threadSearchInfo.visible
        if (!visible) {
          await T.RPCChat.localCancelActiveSearchRpcPromise()
        }
      }
      C.ignorePromise(f())
    },
    unfurlRemove: messageID => {
      const f = async () => {
        const conversationIDKey = get().id
        const meta = get().meta
        if (!get().isMetaGood()) {
          logger.debug('unfurl remove no meta found, aborting!')
          return
        }
        await T.RPCChat.localPostDeleteNonblockRpcPromise(
          {
            clientPrev: 0,
            conversationID: T.Chat.keyToConversationID(conversationIDKey),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            outboxID: null,
            supersedes: messageID,
            tlfName: meta.tlfname,
            tlfPublic: false,
          },
          Common.waitingKeyDeletePost
        )
      }
      C.ignorePromise(f())
    },
    unfurlResolvePrompt: (messageID, domain, result) => {
      const f = async () => {
        get().dispatch.unfurlTogglePrompt(messageID, domain, false)
        await T.RPCChat.localResolveUnfurlPromptRpcPromise({
          convID: T.Chat.keyToConversationID(get().id),
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          msgID: T.Chat.messageIDToNumber(messageID),
          result,
        })
      }
      C.ignorePromise(f())
    },
    unfurlTogglePrompt: (messageID, domain, show) => {
      set(s => {
        const prompts = mapGetEnsureValue(s.unfurlPrompt, messageID, new Set())
        if (show) {
          prompts.add(domain)
        } else {
          prompts.delete(domain)
        }
      })
    },
    unreadUpdated: unread => {
      set(s => {
        s.unread = unread
      })
    },
    updateAttachmentViewTransfer: (msgId, ratio) => {
      set(s => {
        const viewType = T.RPCChat.GalleryItemTyp.doc
        const info = mapGetEnsureValue(s.attachmentViewMap, viewType, makeAttachmentViewInfo())
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
    },
    updateAttachmentViewTransfered: (msgId, path) => {
      set(s => {
        const viewType = T.RPCChat.GalleryItemTyp.doc
        const info = mapGetEnsureValue(s.attachmentViewMap, viewType, makeAttachmentViewInfo())
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
    },
    updateDraft: throttle(
      text => {
        const f = async () => {
          const meta = get().meta
          await T.RPCChat.localUpdateUnsentTextRpcPromise({
            conversationID: T.Chat.keyToConversationID(get().id),
            text,
            tlfName: meta.tlfname,
          })
        }
        C.ignorePromise(f())
      },
      200,
      {trailing: true}
    ),
    updateFromUIInboxLayout: l => {
      if (get().isMetaGood()) return
      const {isMuted, draft} = l
      set(s => {
        s.meta.draft = draft || ''
        s.meta.isMuted = isMuted
      })
    },
    // maybe remove this when reducer is ported
    updateMessage: (ordinal, pm) => {
      set(s => {
        const m = s.messageMap.get(ordinal) as {[key: string]: unknown} | undefined
        if (!m) return

        const opm = pm as typeof m
        const keys = Object.keys(pm)
        keys.forEach(k => {
          m[k] = opm[k]
        })
      })
    },
    updateMeta: pm => {
      // see setmeta
      const opm = pm as {[key: string]: any}
      set(s => {
        const keys = Object.keys(pm) as Array<keyof T.Chat.ConversationMeta>
        keys.forEach(k => {
          const m = s.meta as {[key: string]: any}
          m[k] = opm[k]
        })
      })
    },
    updateNotificationSettings: (
      notificationsDesktop,
      notificationsMobile,
      notificationsGlobalIgnoreMentions
    ) => {
      const f = async () => {
        const conversationIDKey = get().id
        await T.RPCChat.localSetAppNotificationSettingsLocalRpcPromise({
          channelWide: notificationsGlobalIgnoreMentions,
          convID: T.Chat.keyToConversationID(conversationIDKey),
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
      C.ignorePromise(f())
    },
    updateReactions: updates => {
      const {pendingOutboxToOrdinal, dispatch, messageMap} = get()
      for (const u of updates) {
        const reactions = u.reactions
        const targetMsgID = u.targetMsgID
        const targetOrdinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, u.targetMsgID)
        if (!targetOrdinal) {
          logger.info(
            `updateReactions: couldn't find target ordinal for targetMsgID=${targetMsgID} in convID=${
              get().id
            }`
          )
          return
        }
        const m = messageMap.get(targetOrdinal)
        if (m && m.type !== 'deleted' && m.type !== 'placeholder') {
          dispatch.updateMessage(targetOrdinal, {reactions})
        }
      }
      get().dispatch.markThreadAsRead()
    },
  }
  return {
    ...initialConvoStore,
    dispatch,
    getExplodingMode: (): number => {
      const mode = get().explodingModeLock ?? get().explodingMode
      const meta = get().meta
      const convRetention = Meta.getEffectiveRetentionPolicy(meta)
      return convRetention.type === 'explode' ? Math.min(mode || Infinity, convRetention.seconds) : mode
    },
    isCaughtUp: () => {
      return get().maxMsgIDSeen === -1 || get().maxMsgIDSeen >= get().meta.maxVisibleMsgID
    },
    isMetaGood: () => {
      // fake meta doesn't have our actual id in it
      return get().meta.conversationIDKey === get().id
    },
  }
}

type MadeStore = UseBoundStore<StoreApi<ConvoState>>
export const _stores = new Map<T.Chat.ConversationIDKey, MadeStore>()

export const clearChatStores = () => {
  _stores.clear()
}

const createConvoStore = (id: T.Chat.ConversationIDKey) => {
  const existing = _stores.get(id)
  if (existing) return existing
  const next = Z.createZustand<ConvoState>(createSlice)
  next.setState({id})
  _stores.set(id, next)
  next.getState().dispatch.setupSubscriptions()
  return next
}

// non reactive call, used in actions/dispatches
export function _getConvoState(id: T.Chat.ConversationIDKey) {
  const store = createConvoStore(id)
  return store.getState()
}

const Context = React.createContext<MadeStore | null>(null)

type ConvoProviderProps = React.PropsWithChildren<{id: T.Chat.ConversationIDKey; canBeNull?: boolean}>
export function _Provider({canBeNull, children, ...props}: ConvoProviderProps) {
  if (!canBeNull && (!props.id || props.id === noConversationIDKey)) {
    // let it not crash out but likely you'll get wrong answers in prod
    if (__DEV__) {
      console.log('Bad chat provider with id', props.id)
      throw new Error('No convo id in provider')
    }
  }
  return <Context.Provider value={createConvoStore(props.id)}>{children}</Context.Provider>
}

export function useHasContext() {
  const store = React.useContext(Context)
  return !!store
}

// use this if in doubt
export function _useContext<T>(selector: (state: ConvoState) => T): T {
  const store = React.useContext(Context)
  if (!store) {
    throw new Error('Missing ConvoContext.Provider in the tree')
  }
  return useStore(store, selector)
}

// unusual, usually you useContext, but maybe in teams
export function _useConvoState<T>(id: T.Chat.ConversationIDKey, selector: (state: ConvoState) => T): T {
  const store = createConvoStore(id)
  return useStore(store, selector)
}

export type ChatProviderProps<T> = T & {route: {params: {conversationIDKey?: string}}}
type RouteParams = {
  route: {params: {conversationIDKey?: string}}
}
export const ProviderScreen = (p: {children: React.ReactNode; rp: RouteParams; canBeNull?: boolean}) => {
  return (
    <React.Suspense>
      <_Provider id={p.rp.route.params.conversationIDKey ?? noConversationIDKey} canBeNull={p.canBeNull}>
        {p.children}
      </_Provider>
    </React.Suspense>
  )
}

import type {NavigateAppendType} from '@/router-v2/route-params'
export const useChatNavigateAppend = () => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const cid = _useContext(s => s.id)
  return React.useCallback(
    (
      makePath: (cid: T.Chat.ConversationIDKey) => NavigateAppendType,
      replace?: boolean,
      fromKey?: string
    ) => {
      navigateAppend(makePath(cid), replace, fromKey)
    },
    [cid, navigateAppend]
  )
}
