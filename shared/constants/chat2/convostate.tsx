import * as C from '..'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Styles from '../../styles'
import * as Common from './common'
import * as Tabs from '../tabs'
import * as EngineGen from '../../actions/engine-gen-gen'
import * as FsTypes from '../types/fs'
import * as Message from './message'
import * as Meta from './meta'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as React from 'react'
import * as TeamsTypes from '../types/teams'
import * as TeamsConstants from '../teams'
import * as Types from '../types/chat2'
import * as Z from '../../util/zustand'
import * as ConfigConstants from '../config'
import HiddenString from '../../util/hidden-string'
import isEqual from 'lodash/isEqual'
import logger from '../../logger'
import partition from 'lodash/partition'
import shallowEqual from 'shallowequal'
import sortedIndexOf from 'lodash/sortedIndexOf'
import throttle from 'lodash/throttle'
import type {RetentionPolicy} from '../types/retention-policy'
import {RPCError} from '../../util/errors'
import {findLast} from '../../util/arrays'
import {isMobile, isIOS} from '../platform'
import {mapGetEnsureValue} from '../../util/map'
import {noConversationIDKey} from '../types/chat2/common'
import {type StoreApi, type UseBoundStore, useStore} from 'zustand'
import {saveAttachmentToCameraRoll, showShareActionSheet} from '../../actions/platform-specific'
import * as Platform from '../platform'
import KB2 from '../../util/electron'
import NotifyPopup from '../../util/notify-popup'
const {darwinCopyToChatTempUploadFile} = KB2.functions

const makeThreadSearchInfo = (): Types.ThreadSearchInfo => ({
  hits: [],
  status: 'initial',
  visible: false,
})

const noParticipantInfo: Types.ParticipantInfo = {
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

// per convo store
type ConvoStore = {
  id: Types.ConversationIDKey
  // temp cache for requestPayment and sendPayment message data,
  accountsInfoMap: Map<RPCChatTypes.MessageID, Types.ChatRequestInfo | Types.ChatPaymentInfo>
  attachmentViewMap: Map<RPCChatTypes.GalleryItemTyp, Types.AttachmentViewInfo>
  badge: number
  botCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatusTyp
  botSettings: Map<string, RPCTypes.TeamBotSettings | undefined>
  botTeamRoleMap: Map<string, TeamsTypes.TeamRoleType | undefined>
  commandMarkdown?: RPCChatTypes.UICommandMarkdown
  commandStatus?: Types.CommandStatusInfo
  containsLatestMessage?: boolean
  dismissedInviteBanners: boolean
  draft?: string
  editing: Types.Ordinal // current message being edited,
  explodingMode: number // seconds to exploding message expiration,
  explodingModeLock?: number // locks set on exploding mode while user is inputting text,
  giphyResult?: RPCChatTypes.GiphySearchResults
  giphyWindow: boolean
  markedAsUnread: boolean // store a bit if we've marked this thread as unread so we don't mark as read when navgiating away
  messageCenterOrdinal?: Types.CenterOrdinal // ordinals to center threads on,
  messageTypeMap: Map<Types.Ordinal, Types.RenderMessageType> // messages types to help the thread, text is never used
  messageOrdinals?: Array<Types.Ordinal> // ordered ordinals in a thread,
  messageMap: Map<Types.Ordinal, Types.Message> // messages in a thread,
  meta: Types.ConversationMeta // metadata about a thread, There is a special node for the pending conversation,
  moreToLoad: boolean
  muted: boolean
  mutualTeams: Array<TeamsTypes.TeamID>
  orangeLine: Types.Ordinal // last message we've seen,
  participants: Types.ParticipantInfo
  pendingOutboxToOrdinal: Map<Types.OutboxID, Types.Ordinal> // messages waiting to be sent,
  replyTo: Types.Ordinal
  threadLoadStatus: RPCChatTypes.UIChatThreadStatusTyp
  threadSearchInfo: Types.ThreadSearchInfo
  threadSearchQuery: string
  typing: Set<string>
  unfurlPrompt: Map<Types.MessageID, Set<string>>
  unread: number
  unsentText?: string
}

const initialConvoStore: ConvoStore = {
  accountsInfoMap: new Map(),
  attachmentViewMap: new Map(),
  badge: 0,
  botCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank,
  botSettings: new Map(),
  botTeamRoleMap: new Map(),
  commandMarkdown: undefined,
  commandStatus: undefined,
  containsLatestMessage: undefined,
  dismissedInviteBanners: false,
  draft: undefined,
  editing: 0,
  explodingMode: 0,
  explodingModeLock: undefined,
  giphyResult: undefined,
  giphyWindow: false,
  id: noConversationIDKey,
  markedAsUnread: false,
  messageCenterOrdinal: undefined,
  messageMap: new Map(),
  messageOrdinals: undefined,
  messageTypeMap: new Map(),
  meta: Meta.makeConversationMeta(),
  moreToLoad: false,
  muted: false,
  mutualTeams: [],
  orangeLine: 0,
  participants: noParticipantInfo,
  pendingOutboxToOrdinal: new Map(),
  replyTo: 0,
  threadLoadStatus: RPCChatTypes.UIChatThreadStatusTyp.none,
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
    attachmentPasted: (data: Buffer) => void
    attachmentPreviewSelect: (ordinal: Types.Ordinal) => void
    attachmentUploadCanceled: (outboxIDs: Array<RPCChatTypes.OutboxID>) => void
    attachmentDownload: (ordinal: Types.Ordinal) => void
    attachmentsUpload: (paths: Array<Types.PathAndOutboxID>, titles: Array<string>, tlfName?: string) => void
    attachFromDragAndDrop: (paths: Array<Types.PathAndOutboxID>, titles: Array<string>) => void
    badgesUpdated: (badge: number) => void
    blockConversation: (reportUser: boolean) => void
    botCommandsUpdateStatus: (b: RPCChatTypes.UIBotCommandsUpdateStatus) => void
    channelSuggestionsTriggered: () => void
    clearAttachmentView: () => void
    clearMessageTypeMap: () => void
    dismissBottomBanner: () => void
    desktopNotification: (author: string, body: string) => void
    editBotSettings: (
      username: string,
      allowCommands: boolean,
      allowMentions: boolean,
      convs?: Array<string>
    ) => void
    giphyGotSearchResult: (results: RPCChatTypes.GiphySearchResults) => void
    giphySend: (result: RPCChatTypes.GiphySearchResult) => void
    giphyToggleWindow: (show: boolean) => void
    hideSearch: () => void
    hideConversation: (hide: boolean) => void
    injectIntoInput: (text: string) => void
    joinConversation: () => void
    leaveConversation: (navToInbox?: boolean) => void
    loadAttachmentView: (viewType: RPCChatTypes.GalleryItemTyp, fromMsgID?: Types.MessageID) => void
    loadMessagesCentered: (
      messageID: Types.MessageID,
      highlightMode: Types.CenterOrdinalHighlightMode
    ) => void
    loadOrangeLine: () => void
    loadOlderMessagesDueToScroll: () => void
    loadNewerMessagesDueToScroll: () => void
    loadMoreMessages: (p: {
      forceContainsLatestCalc?: boolean
      messageIDControl?: RPCChatTypes.MessageIDControl
      centeredMessageID?: {
        conversationIDKey: Types.ConversationIDKey
        messageID: Types.MessageID
        highlightMode: Types.CenterOrdinalHighlightMode
      }
      reason: string
      knownRemotes?: Array<string>
      forceClear?: boolean
      scrollDirection?: ScrollDirection
      numberOfMessagesToLoad?: number
    }) => void
    markThreadAsRead: (unreadLineMessageID?: number) => void
    markTeamAsRead: (teamID: TeamsTypes.TeamID) => void
    messageAttachmentNativeSave: (message: Types.Message) => void
    messageAttachmentNativeShare: (message: Types.Message) => void
    messageDelete: (ordinal: Types.Ordinal) => void
    messageDeleteHistory: () => void
    messageEdit: (ordinal: Types.Ordinal, text: string) => void
    messageReplyPrivately: (ordinal: Types.Ordinal) => void
    messageRetry: (outboxID: Types.OutboxID) => void
    messageSend: (text: string, replyTo?: Types.MessageID, waitingKey?: string) => void
    messagesAdd: (p: {
      contextType: string
      messages: Array<Types.Message>
      // true if these should be the only messages we know about
      shouldClearOthers?: boolean
      centeredMessageID?: {
        conversationIDKey: Types.ConversationIDKey
        messageID: Types.MessageID
        highlightMode: Types.CenterOrdinalHighlightMode
      }
      forceContainsLatestCalc?: boolean
    }) => void
    messagesExploded: (messageIDs: Array<RPCChatTypes.MessageID>, explodedBy?: string) => void
    messagesWereDeleted: (p: {
      messageIDs?: Array<RPCChatTypes.MessageID>
      upToMessageID?: RPCChatTypes.MessageID // expunge calls give us a message we should delete up to (don't delete it)
      deletableMessageTypes?: Set<Types.MessageType> // expunge calls don't delete _all_ messages, only these types
      ordinals?: Array<Types.Ordinal>
    }) => void
    metaReceivedError: (error: RPCChatTypes.InboxUIItemError, username: string) => void
    mute: (m: boolean) => void
    navigateToThread: (reason: NavReason, highlightMessageID?: number, pushBody?: string) => void
    openFolder: () => void
    onEngineIncoming: (
      action:
        | EngineGen.Chat1ChatUiChatInboxFailedPayload
        | EngineGen.Chat1NotifyChatChatSetConvSettingsPayload
        | EngineGen.Chat1NotifyChatChatAttachmentUploadProgressPayload
        | EngineGen.Chat1NotifyChatChatAttachmentUploadStartPayload
    ) => void
    onIncomingMessage: (incoming: RPCChatTypes.IncomingMessage) => void
    onMessageErrored: (outboxID: Types.OutboxID, reason: string, errorTyp?: number) => void
    onMessagesUpdated: (messagesUpdated: RPCChatTypes.MessagesUpdated) => void
    paymentInfoReceived: (messageID: RPCChatTypes.MessageID, paymentInfo: Types.ChatPaymentInfo) => void
    refreshBotRoleInConv: (username: string) => void
    refreshBotSettings: (username: string) => void
    refreshMutualTeamsInConv: () => void
    removeBotMember: (username: string) => void
    replaceMessageMap: (mm: ConvoStore['messageMap']) => void
    requestInfoReceived: (messageID: RPCChatTypes.MessageID, requestInfo: Types.ChatRequestInfo) => void
    resetChatWithoutThem: () => void
    resetLetThemIn: (username: string) => void
    resetState: 'default'
    resetUnsentText: () => void
    selectedConversation: () => void
    sendTyping: (typing: boolean) => void
    setCommandMarkdown: (md?: RPCChatTypes.UICommandMarkdown) => void
    setCommandStatusInfo: (info?: Types.CommandStatusInfo) => void
    setContainsLatestMessage: (c: boolean) => void
    setConvRetentionPolicy: (policy: RetentionPolicy) => void
    setDraft: (d?: string) => void
    setEditing: (ordinal: Types.Ordinal | boolean) => void // true is last, false is clear
    setExplodingMode: (seconds: number, incoming?: boolean) => void
    setExplodingModeLocked: (locked: boolean) => void
    // false to clear
    setMarkAsUnread: (readMsgID?: RPCChatTypes.MessageID | false) => void
    setMessageCenterOrdinal: (m?: Types.CenterOrdinal) => void
    setMessageOrdinals: (os?: Array<Types.Ordinal>) => void
    setMessageTypeMap: (o: Types.Ordinal, t?: Types.RenderMessageType) => void
    setMeta: (m?: Types.ConversationMeta) => void
    setMoreToLoad: (m: boolean) => void
    setMuted: (m: boolean) => void
    setOrangeLine: (o: Types.Ordinal) => void
    setParticipants: (p: ConvoState['participants']) => void
    setPendingOutboxToOrdinal: (p: ConvoState['pendingOutboxToOrdinal']) => void
    setReplyTo: (o: Types.Ordinal) => void
    setThreadLoadStatus: (status: RPCChatTypes.UIChatThreadStatusTyp) => void
    setThreadSearchQuery: (query: string) => void
    setTyping: (t: Set<string>) => void
    setupSubscriptions: () => void
    threadSearch: (query: string) => void
    toggleGiphyPrefill: () => void
    toggleMessageReaction: (ordinal: Types.Ordinal, emoji: string) => void
    toggleThreadSearch: (hide?: boolean) => void
    updateDraft: (text: string) => void
    toggleLocalReaction: (p: {
      decorated: string
      emoji: string
      targetOrdinal: Types.Ordinal
      username: string
    }) => void
    unfurlTogglePrompt: (messageID: Types.MessageID, domain: string, show: boolean) => void
    unreadUpdated: (unread: number) => void
    updateAttachmentViewTransfer: (msgId: number, ratio: number) => void
    updateAttachmentViewTransfered: (msgId: number, path: string) => void
    updateMessage: (ordinal: Types.Ordinal, m: Partial<Types.Message>) => void
    updateMeta: (m: Partial<Types.ConversationMeta>) => void
    updateNotificationSettings: (
      notificationsDesktop: Types.NotificationsType,
      notificationsMobile: Types.NotificationsType,
      notificationsGlobalIgnoreMentions: boolean
    ) => void
    updateReactions: (
      updates: Array<{targetMsgID: RPCChatTypes.MessageID; reactions: Types.Reactions}>
    ) => void
  }
  getExplodingMode: () => number
  getEditInfo: () => {exploded: boolean; ordinal: Types.Ordinal; text: string} | undefined
}

// don't bug the users with black bars for network errors. chat isn't going to work in general
const ignoreErrors = [
  RPCTypes.StatusCode.scgenericapierror,
  RPCTypes.StatusCode.scapinetworkerror,
  RPCTypes.StatusCode.sctimeout,
]

const makeAttachmentViewInfo = (): Types.AttachmentViewInfo => ({
  last: false,
  messages: [],
  status: 'loading',
})

// Backend gives us messageIDs sometimes so we need to find our ordinal
const messageIDToOrdinal = (
  map: ConvoState['messageMap'],
  pendingOutboxToOrdinal: ConvoState['pendingOutboxToOrdinal'] | undefined,
  messageID: Types.MessageID
) => {
  // A message we didn't send in this session?
  let m = map.get(Types.numberToOrdinal(messageID))
  if (m?.id !== 0 && m?.id === messageID) {
    return m.ordinal
  }
  // Search through our sent messages
  const pendingOrdinal = [...(pendingOutboxToOrdinal?.values() ?? [])].find(o => {
    m = map?.get(o)
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

const getClientPrev = (conversationIDKey: Types.ConversationIDKey): Types.MessageID => {
  let clientPrev: undefined | Types.MessageID
  const mm = C.getConvoState(conversationIDKey).messageMap
  if (mm) {
    // find last valid messageid we know about
    const goodOrdinal = findLast(_getConvoState(conversationIDKey).messageOrdinals ?? [], o => {
      const m = mm.get(o)
      return !!m?.id
    })

    if (goodOrdinal) {
      const message = mm.get(goodOrdinal)
      clientPrev = message && message.id
    }
  }

  return clientPrev || 0
}

type ScrollDirection = 'none' | 'back' | 'forward'
export const numMessagesOnInitialLoad = isMobile ? 20 : 100
export const numMessagesOnScrollback = isMobile ? 100 : 100

const createSlice: Z.ImmerStateCreator<ConvoState> = (set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
  const closeBotModal = () => {
    C.useRouterState.getState().dispatch.clearModals()
    const meta = get().meta
    if (meta.teamname) {
      C.useTeamsState.getState().dispatch.getMembers(meta.teamID)
    }
  }

  const downloadAttachment = async (downloadToCache: boolean, message: Types.Message) => {
    const {ordinal, conversationIDKey} = message
    try {
      const rpcRes = await RPCChatTypes.localDownloadFileAttachmentLocalRpcPromise({
        conversationID: Types.keyToConversationID(conversationIDKey),
        downloadToCache,
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
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

  const dispatch: ConvoState['dispatch'] = {
    addBotMember: (username, allowCommands, allowMentions, restricted, convs) => {
      const f = async () => {
        const conversationIDKey = get().id
        try {
          await RPCChatTypes.localAddBotMemberRpcPromise(
            {
              botSettings: restricted ? {cmds: allowCommands, convs, mentions: allowMentions} : null,
              convID: Types.keyToConversationID(conversationIDKey),
              role: restricted ? RPCTypes.TeamRole.restrictedbot : RPCTypes.TeamRole.bot,
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
      Z.ignorePromise(f())
    },
    attachFromDragAndDrop: (paths, titles) => {
      const f = async () => {
        if (Platform.isDarwin && darwinCopyToChatTempUploadFile) {
          const p = await Promise.all(
            paths.map(async p => {
              const outboxID = Common.generateOutboxID()
              const dst = await RPCChatTypes.localGetUploadTempFileRpcPromise({filename: p.path, outboxID})
              await darwinCopyToChatTempUploadFile(dst, p.path)
              return {outboxID, path: dst}
            })
          )

          get().dispatch.attachmentsUpload(p, titles)
        } else {
          get().dispatch.attachmentsUpload(paths, titles)
        }
      }
      Z.ignorePromise(f())
    },
    attachmentDownload: ordinal => {
      const {dispatch, messageMap} = get()
      const m = messageMap.get(ordinal)
      if (m?.type === 'attachment') {
        dispatch.updateMessage(ordinal, {
          transferErrMsg: undefined,
          transferState: 'downloading',
        })
      }
      // Download an attachment to your device
      const f = async () => {
        const message = get().messageMap.get(ordinal)
        if (message?.type !== 'attachment') {
          throw new Error('Trying to download missing / incorrect message?')
        }
        // already downloaded?
        if (message.downloadPath) {
          logger.warn('Attachment already downloaded')
          return
        }
        await downloadAttachment(false, message)
      }
      Z.ignorePromise(f())
    },
    attachmentPasted: data => {
      const f = async () => {
        const outboxID = Common.generateOutboxID()
        const path = await RPCChatTypes.localMakeUploadTempFileRpcPromise({
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
      Z.ignorePromise(f())
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
          await RPCChatTypes.localCancelUploadTempFileRpcPromise({outboxID})
        }
      }
      Z.ignorePromise(f())
    },
    attachmentsUpload: (paths, titles, _tlfName) => {
      const f = async () => {
        let tlfName = _tlfName
        const conversationIDKey = get().id
        const meta = get().meta
        if (meta.conversationIDKey !== conversationIDKey) {
          if (!tlfName) {
            logger.warn('attachmentsUpload: missing meta for attachment upload', conversationIDKey)
            return
          }
        } else {
          tlfName = meta.tlfname
        }
        const clientPrev = getClientPrev(conversationIDKey)
        // disable sending exploding messages if flag is false
        const ephemeralLifetime = get().explodingMode
        const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
        const outboxIDs = paths.reduce<Array<Buffer>>((obids, p) => {
          obids.push(p.outboxID ? p.outboxID : Common.generateOutboxID())
          return obids
        }, [])
        await Promise.all(
          paths.map(async (p, i) =>
            RPCChatTypes.localPostFileAttachmentLocalNonblockRpcPromise({
              arg: {
                ...ephemeralData,
                conversationID: Types.keyToConversationID(conversationIDKey),
                filename: Styles.unnormalizePath(p.path),
                identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
                metadata: Buffer.from([]),
                outboxID: outboxIDs[i],
                title: titles[i] ?? '',
                tlfName: tlfName ?? '',
                visibility: RPCTypes.TLFVisibility.private,
              },
              clientPrev,
            })
          )
        )
      }
      Z.ignorePromise(f())
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
        await RPCChatTypes.localSetConversationStatusLocalRpcPromise({
          conversationID: Types.keyToConversationID(get().id),
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          status: reportUser
            ? RPCChatTypes.ConversationStatus.reported
            : RPCChatTypes.ConversationStatus.blocked,
        })
      }
      Z.ignorePromise(f())
    },
    botCommandsUpdateStatus: status => {
      set(s => {
        s.botCommandsUpdateStatus = status.typ
        if (status.typ === RPCChatTypes.UIBotCommandsUpdateStatusTyp.uptodate) {
          const settingsMap = new Map<string, RPCTypes.TeamBotSettings | undefined>()
          Object.keys(status.uptodate.settings).forEach(u => {
            settingsMap.set(u, status.uptodate.settings[u])
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
    clearMessageTypeMap: () => {
      set(s => {
        s.messageTypeMap.clear()
      })
    },
    desktopNotification: (author, body) => {
      if (isMobile) return

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
    dismissBottomBanner: () => {
      set(s => {
        s.dismissedInviteBanners = true
      })
    },
    editBotSettings: (username, allowCommands, allowMentions, convs) => {
      const f = async () => {
        const conversationIDKey = get().id
        try {
          await RPCChatTypes.localSetBotMemberSettingsRpcPromise(
            {
              botSettings: {cmds: allowCommands, convs, mentions: allowMentions},
              convID: Types.keyToConversationID(conversationIDKey),
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
      Z.ignorePromise(f())
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
        const conversationIDKey = get().id
        const replyTo = get().messageMap.get(get().replyTo)?.id
        try {
          await RPCChatTypes.localTrackGiphySelectRpcPromise({result})
        } catch {}
        _getConvoState(conversationIDKey).dispatch.injectIntoInput('')
        get().dispatch.messageSend(result.targetUrl, replyTo)
      }
      Z.ignorePromise(f())
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
          const {showInfoPanel, navigateToInbox} = C.useChatState.getState().dispatch
          navigateToInbox()
          showInfoPanel(false, undefined, conversationIDKey)
        }

        await RPCChatTypes.localSetConversationStatusLocalRpcPromise(
          {
            conversationID: Types.keyToConversationID(conversationIDKey),
            identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
            status: hide ? RPCChatTypes.ConversationStatus.ignored : RPCChatTypes.ConversationStatus.unfiled,
          },
          Common.waitingKeyConvStatusChange(conversationIDKey)
        )
      }
      Z.ignorePromise(f())
    },
    hideSearch: () => {
      set(s => {
        s.threadSearchInfo.visible = false
      })
    },
    injectIntoInput: text => {
      set(s => {
        s.unsentText = text
      })
      get().dispatch.updateDraft(text)
    },
    joinConversation: () => {
      const f = async () => {
        await RPCChatTypes.localJoinConversationByIDLocalRpcPromise(
          {convID: Types.keyToConversationID(get().id)},
          Common.waitingKeyJoinConversation
        )
      }
      Z.ignorePromise(f())
    },
    leaveConversation: (navToInbox = true) => {
      const f = async () => {
        await RPCChatTypes.localLeaveConversationLocalRpcPromise(
          {convID: Types.keyToConversationID(get().id)},
          Common.waitingKeyLeaveConversation
        )
      }
      Z.ignorePromise(f())
      C.useRouterState.getState().dispatch.clearModals()
      if (navToInbox) {
        C.useRouterState.getState().dispatch.navUpToScreen('chatRoot')
        C.useRouterState.getState().dispatch.switchTab(Tabs.chatTab)
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
          const res = await RPCChatTypes.localLoadGalleryRpcListener(
            {
              incomingCallMap: {
                'chat.1.chatUi.chatLoadGalleryHit': (
                  hit: RPCChatTypes.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['inParam']
                ) => {
                  const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? 0
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
                      if (!info.messages.find((item: any) => item.id === message.id)) {
                        info.messages = info.messages.concat(message).sort((l, r) => r.id - l.id)
                      }
                      // inject them into the message map
                      info.messages.forEach(m => {
                        s.messageMap.set(m.id, m)
                      })
                    })
                  }
                },
              },
              params: {
                convID: Types.keyToConversationID(conversationIDKey),
                fromMsgID,
                num: 50,
                typ: viewType,
              },
            },
            Z.dummyListenerApi
          )
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
      Z.ignorePromise(f())
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
          mode: RPCChatTypes.MessageIDControlMode.centered,
          num: numMessagesOnInitialLoad,
          pivot: messageID,
        },
        reason: 'centered',
      })
    },
    loadMoreMessages: p => {
      const {
        reason,
        messageIDControl,
        knownRemotes,
        forceClear = false,
        forceContainsLatestCalc = false,
        centeredMessageID,
        scrollDirection: sd = 'none',
        numberOfMessagesToLoad = numMessagesOnInitialLoad,
      } = p

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

        if (!conversationIDKey || !Types.isValidConversationIDKey(conversationIDKey)) {
          logger.info('bail: no conversationIDKey')
          return
        }
        if (meta.membershipType === 'youAreReset' || meta.rekeyers.size > 0) {
          logger.info('bail: we are reset')
          return
        }
        logger.info(
          `calling rpc convo: ${conversationIDKey} num: ${numberOfMessagesToLoad} reason: ${reason}`
        )

        const loadingKey = Common.waitingKeyThreadLoad(conversationIDKey)
        let calledClear = false
        const onGotThread = (thread: string) => {
          if (!thread) {
            return
          }
          const username = C.useCurrentUserState.getState().username
          const devicename = C.useCurrentUserState.getState().deviceName
          const getLastOrdinal = () => messageOrdinals?.at(-1) ?? 0
          const uiMessages = JSON.parse(thread) as RPCChatTypes.UIMessages
          let shouldClearOthers = false
          if ((forceClear || sd === 'none') && !calledClear) {
            shouldClearOthers = true
            calledClear = true
          }
          const messages = (uiMessages.messages ?? []).reduce<Array<Types.Message>>((arr, m) => {
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
            dispatch.messagesAdd({
              centeredMessageID,
              contextType: 'threadLoad',
              forceContainsLatestCalc,
              messages,
              shouldClearOthers,
            })
          }
        }

        const pagination = messageIDControl ? null : scrollDirectionToPagination(sd, numberOfMessagesToLoad)

        try {
          let validated = false
          const results = await RPCChatTypes.localGetThreadNonblockRpcListener(
            {
              incomingCallMap: {
                'chat.1.chatUi.chatThreadCached': p => p && onGotThread(p.thread || ''),
                'chat.1.chatUi.chatThreadFull': p => p && onGotThread(p.thread || ''),
                'chat.1.chatUi.chatThreadStatus': p => {
                  // if we're validated, never undo that
                  if (p.status.typ === RPCChatTypes.UIChatThreadStatusTyp.validated) {
                    validated = true
                  } else if (validated) {
                    return
                  }
                  if (p) {
                    get().dispatch.setThreadLoadStatus(p.status.typ)
                  }
                },
              },
              params: {
                cbMode: RPCChatTypes.GetThreadNonblockCbMode.incremental,
                conversationID: Types.keyToConversationID(conversationIDKey),
                identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
                knownRemotes,
                pagination,
                pgmode: RPCChatTypes.GetThreadNonblockPgMode.server,
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
            },
            Z.dummyListenerApi
          )
          if (get().meta.conversationIDKey === conversationIDKey) {
            get().dispatch.updateMeta({offline: results.offline})
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.warn(error.desc)
            // no longer in team
            if (error.code === RPCTypes.StatusCode.scchatnotinteam) {
              const {inboxRefresh, navigateToInbox} = C.useChatState.getState().dispatch
              inboxRefresh('maybeKickedFromTeam')
              navigateToInbox()
            }
            if (error.code !== RPCTypes.StatusCode.scteamreaderror) {
              // scteamreaderror = user is not in team. they'll see the rekey screen so don't throw for that
              throw error
            }
          }
        }
      }
      Z.ignorePromise(f())
    },
    loadNewerMessagesDueToScroll: () => {
      const {dispatch} = get()
      dispatch.loadMoreMessages({
        numberOfMessagesToLoad: numMessagesOnScrollback,
        reason: 'scroll forward',
        scrollDirection: 'forward',
      })
    },
    loadOlderMessagesDueToScroll: () => {
      const {dispatch, moreToLoad} = get()
      if (!moreToLoad) {
        logger.info('bail: scrolling back and at the end')
        return
      }
      dispatch.loadMoreMessages({
        numberOfMessagesToLoad: numMessagesOnScrollback,
        reason: '',
        scrollDirection: 'back',
      })
    },
    loadOrangeLine: () => {
      const f = async () => {
        const conversationIDKey = get().id
        if (!Types.isValidConversationIDKey(conversationIDKey)) {
          logger.info('Load unreadline bail: no conversationIDKey')
          return
        }
        const convID = Types.keyToConversationID(conversationIDKey)
        if (!convID) {
          logger.info('Load unreadline bail: invalid conversationIDKey')
          return
        }
        const {readMsgID} = get().meta
        try {
          const unreadlineRes = await RPCChatTypes.localGetUnreadlineRpcPromise({
            convID,
            identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
            readMsgID: readMsgID < 0 ? 0 : readMsgID,
          })
          const unreadlineID = unreadlineRes.unreadlineID ? unreadlineRes.unreadlineID : 0
          logger.info(`marking unreadline ${conversationIDKey} ${unreadlineID}`)
          Chat2Gen.createUpdateUnreadline({
            conversationIDKey,
            messageID: Types.numberToMessageID(unreadlineID),
          })
          if (get().markedAsUnread) {
            // Remove the force unread bit for the next time we view the thread.
            get().dispatch.setMarkAsUnread(false)
          }
        } catch (error) {
          if (error instanceof RPCError) {
            if (error.code === RPCTypes.StatusCode.scchatnotinteam) {
              const {inboxRefresh, navigateToInbox} = C.useChatState.getState().dispatch
              inboxRefresh('maybeKickedFromTeam')
              navigateToInbox()
            }
          }
          // ignore this error in general
        }
      }
      Z.ignorePromise(f())
    },
    markTeamAsRead: teamID => {
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          logger.info('bail on not logged in')
          return
        }
        const tlfID = Buffer.from(TeamsTypes.teamIDToString(teamID), 'hex')
        await RPCChatTypes.localMarkTLFAsReadLocalRpcPromise({tlfID})
      }
      Z.ignorePromise(f())
    },
    markThreadAsRead: unreadLineMessageID => {
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          logger.info('bail on not logged in')
          return
        }
        const {id: conversationIDKey, meta, messageMap, messageOrdinals} = get()
        if (!Types.isValidConversationIDKey(conversationIDKey)) {
          logger.info('bail on no selected conversation')
          return
        }
        if (!Common.isUserActivelyLookingAtThisThread(conversationIDKey)) {
          logger.info('bail on not looking at this thread')
          return
        }
        // Check to see if we do not have the latest message, and don't mark anything as read in that case
        // If we have no information at all, then just mark as read
        if (!get().containsLatestMessage) {
          logger.info('bail on not containing latest message')
          return
        }

        const ordinal = findLast([...(messageOrdinals ?? [])], (o: Types.Ordinal) => {
          const m = messageMap.get(o)
          return m ? !!m.id : false
        })
        const message = ordinal ? messageMap.get(ordinal) : undefined

        let readMsgID: number | undefined
        if (meta.conversationIDKey === conversationIDKey) {
          readMsgID = message ? (message.id > meta.maxMsgID ? message.id : meta.maxMsgID) : meta.maxMsgID
        }
        if (unreadLineMessageID !== undefined && readMsgID && readMsgID >= unreadLineMessageID) {
          // If we are marking as unread, don't send the local RPC.
          return
        }

        logger.info(`marking read messages ${conversationIDKey} ${readMsgID}`)
        await RPCChatTypes.localMarkAsReadLocalRpcPromise({
          conversationID: Types.keyToConversationID(conversationIDKey),
          forceUnread: false,
          msgID: readMsgID,
        })
      }
      Z.ignorePromise(f())
    },
    messageAttachmentNativeSave: message => {
      if (!isMobile) return
      if (!message || message.type !== 'attachment') {
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
          await saveAttachmentToCameraRoll(fileName, fileType)
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
      Z.ignorePromise(f())
    },
    messageAttachmentNativeShare: message => {
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

        if (isIOS && message.fileName.endsWith('.pdf')) {
          C.useRouterState.getState().dispatch.navigateAppend({
            props: {
              message,
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
          await showShareActionSheet({filePath, mimeType: message.fileType})
        } catch (e) {
          logger.error('Failed to share attachment: ' + JSON.stringify(e))
        }
      }
      Z.ignorePromise(f())
    },
    messageDelete: ordinal => {
      const {id, dispatch, messageMap, meta} = get()
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
        if (meta.conversationIDKey !== conversationIDKey) {
          logger.warn('Deleting message w/ no meta')
          return
        }
        // We have to cancel pending messages
        if (!message.id) {
          if (message.outboxID) {
            await RPCChatTypes.localCancelPostRpcPromise(
              {outboxID: Types.outboxIDToRpcOutboxID(message.outboxID)},
              Common.waitingKeyCancelPost
            )
            get().dispatch.messagesWereDeleted({
              ordinals: [message.ordinal],
            })
          } else {
            logger.warn('Delete of no message id and no outboxid')
          }
        } else {
          await RPCChatTypes.localPostDeleteNonblockRpcPromise(
            {
              clientPrev: 0,
              conversationID: Types.keyToConversationID(conversationIDKey),
              identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
              outboxID: null,
              supersedes: message.id,
              tlfName: meta.tlfname,
              tlfPublic: false,
            },
            Common.waitingKeyDeletePost
          )
        }
      }
      Z.ignorePromise(f())
    },
    messageDeleteHistory: () => {
      // Delete a message and any older
      const f = async () => {
        const meta = get().meta
        if (!meta.tlfname) {
          logger.warn('Deleting message history for non-existent TLF:')
          return
        }
        await RPCChatTypes.localPostDeleteHistoryByAgeRpcPromise({
          age: 0,
          conversationID: Types.keyToConversationID(get().id),
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          tlfName: meta.tlfname,
          tlfPublic: false,
        })
      }
      Z.ignorePromise(f())
    },
    messageEdit: (ordinal, text) => {
      const {id, dispatch, messageMap, meta} = get()
      const message = messageMap.get(ordinal)
      if (message?.type === 'text' || message?.type === 'attachment') {
        dispatch.updateMessage(ordinal, {
          submitState: 'editing',
        })
      }
      dispatch.setEditing(false)
      if (!message) {
        logger.warn("Can't find message to edit", ordinal)
        return
      }

      const conversationIDKey = id
      const f = async () => {
        if (message.type === 'text' || message.type === 'attachment') {
          // Skip if the content is the same
          if (message.type === 'text' && message.text.stringValue() === text) {
            dispatch.setEditing(false)
            return
          } else if (message.type === 'attachment' && message.title === text) {
            dispatch.setEditing(false)
            return
          }
          const tlfName = meta.tlfname
          const clientPrev = getClientPrev(conversationIDKey)
          const outboxID = Common.generateOutboxID()
          const target = {
            messageID: message.id,
            outboxID: message.outboxID ? Types.outboxIDToRpcOutboxID(message.outboxID) : undefined,
          }
          await RPCChatTypes.localPostEditNonblockRpcPromise(
            {
              body: text,
              clientPrev,
              conversationID: Types.keyToConversationID(conversationIDKey),
              identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
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
      }
      Z.ignorePromise(f())
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
        const result = await RPCChatTypes.localNewConversationLocalRpcPromise(
          {
            identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
            membersType: RPCChatTypes.ConversationMembersType.impteamnative,
            tlfName: [...new Set([username, message.author])].join(','),
            tlfVisibility: RPCTypes.TLFVisibility.private,
            topicType: RPCChatTypes.TopicType.chat,
          },
          Common.waitingKeyCreating
        )
        const conversationIDKey = Types.conversationIDToKey(result.conv.info.id)
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
      Z.ignorePromise(f())
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
        await RPCChatTypes.localRetryPostRpcPromise(
          {outboxID: Types.outboxIDToRpcOutboxID(outboxID)},
          Common.waitingKeyRetryPost
        )
      }
      Z.ignorePromise(f())
    },
    messageSend: (text, replyTo, waitingKey) => {
      const f = async () => {
        const meta = get().meta
        const tlfName = meta.tlfname
        const conversationIDKey = get().id
        const clientPrev = getClientPrev(conversationIDKey)

        // disable sending exploding messages if flag is false
        const ephemeralLifetime = get().explodingMode
        const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
        const confirmRouteName = 'chatPaymentsConfirm'
        try {
          await RPCChatTypes.localPostTextNonblockRpcListener(
            {
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
                  const visibleScreen = C.getVisibleScreen()
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
                conversationID: Types.keyToConversationID(conversationIDKey),
                identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
                outboxID: undefined,
                replyTo,
                tlfName,
                tlfPublic: false,
              },
              waitingKey: waitingKey || Common.waitingKeyPost,
            },
            Z.dummyListenerApi
          )
          logger.info('success')
        } catch (_) {
          logger.info('error')
        }

        // If there are block buttons on this conversation, clear them.
        if (C.useChatState.getState().blockButtonsMap.has(meta.teamID)) {
          reduxDispatch(Chat2Gen.createDismissBlockButtons({teamID: meta.teamID}))
        }

        // Do some logging to track down the root cause of a bug causing
        // messages to not send. Do this after creating the objects above to
        // narrow down the places where the action can possibly stop.
        logger.info('non-empty text?', text.length > 0)
      }
      Z.ignorePromise(f())

      get().dispatch.setReplyTo(0)
      get().dispatch.setCommandMarkdown()
    },
    messagesAdd: p => {
      const {contextType, shouldClearOthers} = p
      // pull out deletes and handle at the end
      const [messages, deletedMessages] = partition<Types.Message>(p.messages, m => m.type !== 'deleted')
      logger.info(
        `messagesAdd: running in context: ${contextType} messages: ${messages.length} deleted: ${deletedMessages.length}`
      )
      const conversationIDKey = get().id
      // we want the clear applied when we call findExisting
      const oldPendingOutboxToOrdinal = new Map(get().pendingOutboxToOrdinal)
      const oldMessageMap = new Map(get().messageMap)

      // so we can keep messages if they haven't mutated
      const previousMessageMap = new Map(get().messageMap)
      const {dispatch} = get()

      if (shouldClearOthers) {
        logger.info(`messagesAdd: clearing existing data`)
        oldPendingOutboxToOrdinal.clear()
        oldMessageMap.clear()
        dispatch.clearMessageTypeMap()
        dispatch.setMessageOrdinals(undefined)
      }

      // Update any pending messages
      const pendingOutboxToOrdinal = new Map(oldPendingOutboxToOrdinal)
      messages.forEach(message => {
        if (message.submitState === 'pending' && message.outboxID) {
          logger.info(
            `messagesAdd: setting new outbox ordinal: ${message.ordinal} outboxID: ${message.outboxID}`
          )
          pendingOutboxToOrdinal.set(message.outboxID, message.ordinal)
        }
      })

      const findExistingSentOrPending = (m: Types.Message) => {
        // something we sent
        if (m.outboxID) {
          // and we know about it
          const ordinal = oldPendingOutboxToOrdinal.get(m.outboxID)
          if (ordinal) {
            return oldMessageMap.get(ordinal)
          }
        }
        const pendingOrdinal = messageIDToOrdinal(oldMessageMap, oldPendingOutboxToOrdinal, m.id)
        if (pendingOrdinal) {
          return oldMessageMap.get(pendingOrdinal)
        }
        return null
      }

      // remove all deleted messages from ordinals that we are passed as a parameter
      const os =
        get().messageOrdinals?.reduce((arr, o) => {
          if (deletedMessages.find(m => m.ordinal === o)) {
            return arr
          }
          arr.push(o)
          return arr
        }, new Array<Types.Ordinal>()) ?? []

      dispatch.setMessageOrdinals(os)

      const removedOrdinals: Array<Types.Ordinal> = []
      const ordinals = messages.reduce<Array<Types.Ordinal>>((arr, message) => {
        if (message.type === 'placeholder') {
          // sometimes we send then get a placeholder for that send. Lets see if we already have the message id for the sent
          // and ignore the placeholder in that instance
          logger.info(`messagesAdd: got placeholder message with id: ${message.id}`)
          const existingOrdinal = messageIDToOrdinal(oldMessageMap, pendingOutboxToOrdinal, message.id)
          if (!existingOrdinal) {
            arr.push(message.ordinal)
          } else {
            logger.info(
              `messagesAdd: skipping placeholder for message with id ${message.id} because already exists`
            )
          }
        } else {
          // Sendable so we might have an existing message
          const existing = findExistingSentOrPending(message)
          if (!existing || sortedIndexOf(get().messageOrdinals ?? [], existing.ordinal) === -1) {
            arr.push(message.ordinal)
          } else {
            logger.info(
              `messagesAdd: skipping existing message for ordinal add: ordinal: ${message.ordinal} outboxID: ${message.outboxID}`
            )
          }
          // We might have a placeholder for this message in there with ordinal of its own ID, let's
          // get rid of it if that is the case
          const lookupID = message.id || existing?.id
          if (lookupID) {
            const oldMsg = oldMessageMap.get(Types.numberToOrdinal(lookupID))
            if (
              oldMsg?.type === 'placeholder' &&
              // don't delete the placeholder if we're just about to replace it ourselves
              oldMsg.ordinal !== message.ordinal
            ) {
              logger.info(`messagesAdd: removing old placeholder: ${oldMsg.ordinal}`)
              removedOrdinals.push(oldMsg.ordinal)
            }
          }
        }
        return arr
      }, [])

      // add new ones, remove deleted ones, sort. This pass is for when we remove placeholder messages
      // with their resolved ids
      // need to convert to a set and back due to needing to dedupe, could look into why this is necessary
      const oss =
        get().messageOrdinals?.reduce((s, o) => {
          if (removedOrdinals.includes(o)) {
            return s
          }
          s.add(o)
          return s
        }, new Set(ordinals)) ?? new Set(ordinals)
      dispatch.setMessageOrdinals([...oss].sort((a, b) => a - b))

      // clear out message map of deleted stuff
      const messageMap = new Map(oldMessageMap)
      deletedMessages.forEach(m => messageMap.delete(m.ordinal))
      removedOrdinals.forEach(o => messageMap.delete(o))

      deletedMessages.forEach(m => {
        dispatch.setMessageTypeMap(m.ordinal, undefined)
      })
      removedOrdinals.forEach(o => {
        dispatch.setMessageTypeMap(o, undefined)
      })

      // update messages
      messages.forEach(message => {
        const oldSentOrPending = findExistingSentOrPending(message)
        let toSet: Types.Message | undefined
        if (oldSentOrPending) {
          toSet = Message.upgradeMessage(oldSentOrPending, message)
          logger.info(`messagesAdd: upgrade message: ordinal: ${message.ordinal} id: ${message.id}`)
        } else {
          toSet = Message.mergeMessage(previousMessageMap.get(message.ordinal), message)
        }
        messageMap.set(toSet.ordinal, toSet)

        if (toSet.type === 'text') {
          dispatch.setMessageTypeMap(toSet.ordinal, undefined)
        } else {
          const subType = Message.getMessageRenderType(toSet)
          dispatch.setMessageTypeMap(toSet.ordinal, subType)
        }
      })

      let containsLatestMessage = get().containsLatestMessage || false
      if (!p.forceContainsLatestCalc && containsLatestMessage) {
        // do nothing
      } else {
        const meta = get().meta
        const ordinals = get().messageOrdinals ?? []
        let maxMsgID = 0
        for (let i = ordinals.length - 1; i >= 0; i--) {
          const ordinal = ordinals[i]!
          const message = messageMap.get(ordinal)
          if (message && message.id > 0) {
            maxMsgID = message.id
            break
          }
        }
        if (meta.conversationIDKey === conversationIDKey && maxMsgID >= meta.maxVisibleMsgID) {
          containsLatestMessage = true
        } else if (p.forceContainsLatestCalc) {
          containsLatestMessage = false
        }
      }
      dispatch.setContainsLatestMessage(containsLatestMessage)
      dispatch.replaceMessageMap(messageMap)
      dispatch.setPendingOutboxToOrdinal(pendingOutboxToOrdinal)
      dispatch.markThreadAsRead()
      if (p.centeredMessageID) {
        const cm = p.centeredMessageID
        const ordinal = Types.numberToOrdinal(Types.messageIDToNumber(cm.messageID))
        dispatch.setMessageCenterOrdinal({
          highlightMode: cm.highlightMode,
          ordinal,
        })
      }
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
      const {pendingOutboxToOrdinal, dispatch, messageMap} = get()

      const upToOrdinals: Array<Types.Ordinal> = []
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
        ].reduce<Array<Types.Ordinal>>((arr, n) => {
          if (n) {
            arr.push(n)
          }
          return arr
        }, [])
      )
      allOrdinals.forEach(ordinal => {
        const m = messageMap.get(ordinal)
        if (m) {
          dispatch.updateMessage(
            ordinal,
            Message.makeMessageDeleted({
              author: m.author,
              conversationIDKey: m.conversationIDKey,
              id: m.id,
              ordinal: m.ordinal,
              timestamp: m.timestamp,
            })
          )
        }
      })

      set(s => {
        const os = s.messageOrdinals
        if (!os) return
        allOrdinals.forEach(o => {
          const idx = sortedIndexOf(os, o)
          if (idx !== -1) os.splice(idx, 1)
        })
      })
    },
    metaReceivedError: (error, username) => {
      if (error) {
        if (
          error.typ === RPCChatTypes.ConversationErrorType.otherrekeyneeded ||
          error.typ === RPCChatTypes.ConversationErrorType.selfrekeyneeded
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
            error.typ === RPCChatTypes.ConversationErrorType.selfrekeyneeded
              ? [username || '']
              : (rekeyInfo && rekeyInfo.rekeyers) || []
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
            snippetDecoration: RPCChatTypes.SnippetDecoration.none,
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
            snippetDecoration: RPCChatTypes.SnippetDecoration.none,
            trustedState: 'error',
          })
        }
      } else {
        get().dispatch.setMeta()
      }
    },
    mute: m => {
      const f = async () => {
        await RPCChatTypes.localSetConversationStatusLocalRpcPromise({
          conversationID: Types.keyToConversationID(get().id),
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          status: m ? RPCChatTypes.ConversationStatus.muted : RPCChatTypes.ConversationStatus.unfiled,
        })
      }
      Z.ignorePromise(f())
    },
    navigateToThread: (_reason, highlightMessageID, pushBody) => {
      get().dispatch.hideSearch()

      const loadMessages = () => {
        const {dispatch} = get()
        let reason: string = _reason || 'navigated'
        let forceClear = false
        let forceContainsLatestCalc = false
        let messageIDControl: RPCChatTypes.MessageIDControl | undefined = undefined
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
            mode: RPCChatTypes.MessageIDControlMode.centered,
            num: numMessagesOnInitialLoad,
            pivot: highlightMessageID,
          }
          forceClear = true
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
        const visible = C.getVisibleScreen()
        // @ts-ignore TODO better types
        const visibleConvo: Types.ConversationIDKey | undefined = visible?.params?.conversationIDKey
        const visibleRouteName = visible?.name

        if (visibleRouteName !== Common.threadRouteName && reason === 'findNewestConversation') {
          // service is telling us to change our selection but we're not looking, ignore
          return
        }

        // we select the chat tab and change the params
        if (Common.isSplit) {
          C.navToThread(conversationIDKey)
        } else {
          // immediately switch stack to an inbox | thread stack
          if (reason === 'push' || reason === 'savedLastState') {
            C.navToThread(conversationIDKey)
            return
          } else {
            // replace if looking at the pending / waiting screen
            const replace =
              visibleRouteName === Common.threadRouteName &&
              !Types.isValidConversationIDKey(visibleConvo ?? '')
            // note: we don't switch tabs on non split
            const modalPath = C.getModalStack()
            if (modalPath.length > 0) {
              C.useRouterState.getState().dispatch.clearModals()
            }
            C.useRouterState
              .getState()
              .dispatch.navigateAppend(
                {props: {conversationIDKey}, selected: Common.threadRouteName},
                replace
              )
          }
        }
      }
      updateNav()
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.chat1ChatUiChatInboxFailed: {
          const username = C.useCurrentUserState.getState().username
          const {convID, error} = action.payload.params
          const conversationIDKey = Types.conversationIDToKey(convID)
          switch (error.typ) {
            case RPCChatTypes.ConversationErrorType.transient:
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
          const role = newRole && TeamsConstants.teamRoleByEnum[newRole]
          const conversationIDKey = get().id
          const cannotWrite = conv?.convSettings?.minWriterRoleInfo?.cannotWrite
          logger.info(
            `got new minWriterRole ${role || ''} for convID ${conversationIDKey}, cannotWrite ${
              cannotWrite ? 1 : 0
            }`
          )
          if (role && role !== 'none') {
            // only insert if the convo is already in the inbox
            if (get().meta.conversationIDKey === conversationIDKey) {
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
          const ordinal = get().pendingOutboxToOrdinal.get(Types.rpcOutboxIDToOutboxID(params.outboxID))
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
      }
    },
    onIncomingMessage: incoming => {
      const {message: cMsg} = incoming
      if (!cMsg) return
      const username = C.useCurrentUserState.getState().username
      // check for a reaction outbox notification before doing anything
      if (
        cMsg.state === RPCChatTypes.MessageUnboxedState.outbox &&
        cMsg.outbox.messageType === RPCChatTypes.MessageType.reaction
      ) {
        get().dispatch.toggleLocalReaction({
          decorated: cMsg.outbox.decoratedTextBody ?? '',
          emoji: cMsg.outbox.body,
          targetOrdinal: cMsg.outbox.supersedes,
          username,
        })
        return
      }

      const {modifiedMessage, displayDesktopNotification, desktopNotificationSnippet} = incoming
      const conversationIDKey = get().id
      const shouldAddMessage = get().containsLatestMessage ?? false
      const devicename = C.useCurrentUserState.getState().deviceName
      const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? 0
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
          cMsg.state === RPCChatTypes.MessageUnboxedState.valid &&
          cMsg.valid.messageBody.messageType === RPCChatTypes.MessageType.attachmentuploaded &&
          message.type === 'attachment'
        ) {
          const placeholderID = cMsg.valid.messageBody.attachmentuploaded.messageID
          const ordinal = messageIDToOrdinal(get().messageMap, get().pendingOutboxToOrdinal, placeholderID)
          if (ordinal) {
            const m = get().messageMap.get(ordinal)
            dispatch.updateMessage(ordinal, m ? Message.upgradeMessage(m, message) : message)
            const subType = Message.getMessageRenderType(message)
            dispatch.setMessageTypeMap(ordinal, subType)
          }
        } else if (shouldAddMessage) {
          // A normal message
          dispatch.messagesAdd({
            contextType: 'incoming',
            messages: [message],
          })
        }
      } else if (cMsg.state === RPCChatTypes.MessageUnboxedState.valid) {
        const {valid} = cMsg
        const body = valid.messageBody
        logger.info(`Got chat incoming message of messageType: ${body.messageType}`)
        // Types that are mutations
        switch (body.messageType) {
          case RPCChatTypes.MessageType.edit:
            if (modifiedMessage) {
              const modMessage = Message.uiMessageToMessage(
                conversationIDKey,
                modifiedMessage,
                username,
                getLastOrdinal,
                devicename
              )
              if (modMessage) {
                dispatch.messagesAdd({
                  contextType: 'incoming',
                  messages: [modMessage],
                })
              }
            }
            break
          case RPCChatTypes.MessageType.delete: {
            const {delete: d} = body
            if (d.messageIDs) {
              // check if the delete is acting on an exploding message
              const messageIDs = d.messageIDs
              const messages = get().messageMap
              const isExplodeNow = messageIDs.some(_id => {
                const id = Types.numberToOrdinal(_id)
                const message = messages.get(id) ?? [...messages.values()].find(msg => msg.id === id)
                if ((message?.type === 'text' || message?.type === 'attachment') && message?.exploding) {
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
        !isMobile &&
        displayDesktopNotification &&
        desktopNotificationSnippet &&
        cMsg.state === RPCChatTypes.MessageUnboxedState.valid
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
      const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? 0
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
      const path = FsTypes.stringToPath(
        meta.teamType !== 'adhoc'
          ? ConfigConstants.teamFolder(meta.teamname)
          : ConfigConstants.privateFolderWithUsers(participantInfo.name)
      )
      C.makeActionForOpenPathInFilesTab(path)
    },
    paymentInfoReceived: (messageID, paymentInfo) => {
      set(s => {
        s.accountsInfoMap.set(messageID, paymentInfo)
      })
    },
    refreshBotRoleInConv: username => {
      const f = async () => {
        let role: RPCTypes.TeamRole | undefined
        const conversationIDKey = get().id
        try {
          role = await RPCChatTypes.localGetTeamRoleInConversationRpcPromise({
            convID: Types.keyToConversationID(conversationIDKey),
            username,
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`refreshBotRoleInConv: failed to refresh bot team role: ${error.message}`)
          }
          return
        }
        const trole = TeamsConstants.teamRoleByEnum[role]
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
      Z.ignorePromise(f())
    },
    refreshBotSettings: username => {
      set(s => {
        s.botSettings.delete(username)
      })
      const conversationIDKey = get().id
      const f = async () => {
        try {
          const settings = await RPCChatTypes.localGetBotMemberSettingsRpcPromise({
            convID: Types.keyToConversationID(conversationIDKey),
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
      Z.ignorePromise(f())
    },
    refreshMutualTeamsInConv: () => {
      const f = async () => {
        const conversationIDKey = get().id
        const username = C.useCurrentUserState.getState().username
        const otherParticipants = Meta.getRowParticipants(get().participants, username || '')
        const results = await RPCChatTypes.localGetMutualTeamsLocalRpcPromise(
          {usernames: otherParticipants},
          Common.waitingKeyMutualTeams(conversationIDKey)
        )
        set(s => {
          s.mutualTeams = results.teamIDs ?? []
        })
      }
      Z.ignorePromise(f())
    },
    removeBotMember: username => {
      const f = async () => {
        const convID = Types.keyToConversationID(get().id)
        try {
          await RPCChatTypes.localRemoveBotMemberRpcPromise({convID, username}, Common.waitingKeyBotRemove)
          closeBotModal()
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('removeBotMember: failed to remove bot member: ' + error.message)
          }
        }
      }
      Z.ignorePromise(f())
    },
    replaceMessageMap: mm => {
      set(s => {
        s.messageMap = mm
      })
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
        await RPCChatTypes.localAddTeamMemberAfterResetRpcPromise({
          convID: Types.keyToConversationID(get().id),
          username,
        })
      }
      Z.ignorePromise(f())
    },
    resetState: 'default',
    resetUnsentText: () => {
      set(s => {
        s.unsentText = undefined
      })
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

      const updateOrangeAfterSelected = () => {
        get().dispatch.setContainsLatestMessage(true)
        const {readMsgID, maxVisibleMsgID} = get().meta
        logger.info(
          `rootReducer: selectConversation: setting orange line: convID: ${conversationIDKey} maxVisible: ${maxVisibleMsgID} read: ${readMsgID}`
        )
        if (maxVisibleMsgID > readMsgID) {
          // Store the message ID that will display the orange line above it,
          // which is the first message after the last read message. We can't
          // just increment `readMsgID` since that msgID might be a
          // non-visible (edit, delete, reaction...) message so we scan the
          // ordinals for the appropriate value.
          const messageMap = get().messageMap
          const ordinals = get().messageOrdinals
          const ord = ordinals?.find(o => {
            const message = messageMap.get(o)
            return !!(message && message.id >= readMsgID + 1)
          })
          const message = ord ? messageMap.get(ord) : null
          if (message?.id) {
            get().dispatch.setOrangeLine(message.id)
          } else {
            get().dispatch.setOrangeLine(0)
          }
        } else {
          // If there aren't any new messages, we don't want to display an
          // orange line so remove its entry from orangeLineMap
          get().dispatch.setOrangeLine(0)
        }
      }

      const ensureSelectedTeamLoaded = () => {
        const selectedConversation = Common.getSelectedConversation()
        const meta = _getConvoState(selectedConversation).meta
        if (meta.conversationIDKey === selectedConversation) {
          const {teamID, teamname} = meta
          if (teamname) {
            C.useTeamsState.getState().dispatch.getMembers(teamID)
          }
        }
      }
      ensureSelectedTeamLoaded()
      get().dispatch.loadOrangeLine()
      const meta = get().meta
      const participantInfo = get().participants
      const force = meta.conversationIDKey !== conversationIDKey || participantInfo.all.length === 0
      C.useChatState.getState().dispatch.unboxRows([conversationIDKey], force)
      get().dispatch.setThreadLoadStatus(RPCChatTypes.UIChatThreadStatusTyp.none)
      get().dispatch.setMessageCenterOrdinal()
      updateOrangeAfterSelected()
      fetchConversationBio()
      C.useChatState.getState().dispatch.resetConversationErrored()
    },
    sendTyping: throttle(typing => {
      const f = async () => {
        await RPCChatTypes.localUpdateTypingRpcPromise({
          conversationID: Types.keyToConversationID(get().id),
          typing,
        })
      }
      Z.ignorePromise(f())
    }, 2000),
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
    setContainsLatestMessage: c => {
      set(s => {
        s.containsLatestMessage = c
      })
    },
    setConvRetentionPolicy: _policy => {
      const f = async () => {
        const convID = Types.keyToConversationID(get().id)
        let policy: RPCChatTypes.RetentionPolicy | undefined
        try {
          policy = TeamsConstants.retentionPolicyToServiceRetentionPolicy(_policy)
          if (policy) {
            await RPCChatTypes.localSetConvRetentionLocalRpcPromise({convID, policy})
          }
        } catch (error) {
          if (error instanceof RPCError) {
            // should never happen
            logger.error(`Unable to parse retention policy: ${error.message}`)
          }
          throw error
        }
      }
      Z.ignorePromise(f())
    },
    setDraft: d => {
      set(s => {
        s.draft = d
      })
    },
    setEditing: _ordinal => {
      // clearing
      if (_ordinal === false) {
        set(s => {
          s.editing = 0
        })
        get().dispatch.resetUnsentText()
        return
      }

      const messageMap = get().messageMap

      let ordinal = 0
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
        } else if (message.type === 'attachment') {
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
          await RPCTypes.gregorDismissCategoryRpcPromise({category})
        } else {
          // update the category with the exploding time
          try {
            await RPCTypes.gregorUpdateCategoryRpcPromise({
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
      Z.ignorePromise(f())
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
          logger.info('bail on not logged in')
          return
        }
        const meta = get().meta
        const unreadLineID = readMsgID ? readMsgID : meta ? meta.maxVisibleMsgID : 0
        let msgID = unreadLineID

        // Find first visible message prior to what we have marked as unread. The
        // server will use this value to calculate our badge state.
        const messageMap = get().messageMap

        if (messageMap) {
          const ordinals = get().messageOrdinals
          const ord =
            ordinals &&
            findLast(ordinals, (o: Types.Ordinal) => {
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
              const onGotThread = (p: any) => {
                try {
                  const d = JSON.parse(p)
                  msgID = d?.messages[1]?.valid?.messageID
                  resolve()
                } catch {}
              }
              RPCChatTypes.localGetThreadNonblockRpcListener(
                {
                  incomingCallMap: {
                    'chat.1.chatUi.chatThreadCached': p => p && onGotThread(p.thread || ''),
                    'chat.1.chatUi.chatThreadFull': p => p && onGotThread(p.thread || ''),
                  },
                  params: {
                    cbMode: RPCChatTypes.GetThreadNonblockCbMode.incremental,
                    conversationID: Types.keyToConversationID(conversationIDKey),
                    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
                    knownRemotes: [],
                    pagination,
                    pgmode: RPCChatTypes.GetThreadNonblockPgMode.server,
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
                },
                Z.dummyListenerApi
              )
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
        RPCChatTypes.localMarkAsReadLocalRpcPromise({
          conversationID: Types.keyToConversationID(conversationIDKey),
          forceUnread: true,
          msgID,
        })
          .then(() => {})
          .catch(() => {})
        get().dispatch.setOrangeLine(unreadLineID)
      }
      Z.ignorePromise(f())
    },
    setMessageCenterOrdinal: m => {
      set(s => {
        s.messageCenterOrdinal = m
      })
    },
    setMessageOrdinals: os => {
      set(s => {
        if (!shallowEqual(s.messageOrdinals, os)) {
          s.messageOrdinals = os
        }
      })
    },
    setMessageTypeMap: (o, t) => {
      set(s => {
        if (t) {
          s.messageTypeMap.set(o, t)
        } else {
          s.messageTypeMap.delete(o)
        }
      })
    },
    setMeta: _m => {
      // see updatemeta
      const m = _m ?? Meta.makeConversationMeta()
      set(s => {
        s.meta = m
      })
      get().dispatch.setDraft(get().meta.draft)
      get().dispatch.setMuted(get().meta.isMuted)
    },
    setMoreToLoad: m => {
      set(s => {
        s.moreToLoad = m
      })
    },
    setMuted: m => {
      set(s => {
        s.muted = m
      })
    },
    setOrangeLine: o => {
      set(s => {
        s.orangeLine = o
      })
    },
    setParticipants: p => {
      set(s => {
        if (!isEqual(s.participants, p)) {
          s.participants = p
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
    setTyping: t => {
      set(s => {
        if (!isEqual(s.typing, t)) {
          s.typing = t
        }
      })
    },
    setupSubscriptions: () => {
      // TODO
    },
    threadSearch: query => {
      set(s => {
        s.threadSearchInfo.hits = []
      })
      const f = async () => {
        const conversationIDKey = get().id
        const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? 0
        const username = C.useCurrentUserState.getState().username
        const devicename = C.useCurrentUserState.getState().deviceName
        const onDone = () => {
          set(s => {
            s.threadSearchInfo.status = 'done'
          })
        }
        try {
          await RPCChatTypes.localSearchInboxRpcListener(
            {
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
                      s.threadSearchInfo.hits = [message]
                    })
                  }
                },
                'chat.1.chatUi.chatSearchInboxDone': onDone,
                'chat.1.chatUi.chatSearchInboxHit': resp => {
                  const messages = (resp.searchHit.hits || []).reduce<Array<Types.Message>>((l, h) => {
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
                identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
                namesOnly: false,
                opts: {
                  afterContext: 0,
                  beforeContext: 0,
                  convID: Types.keyToConversationID(conversationIDKey),
                  isRegex: false,
                  matchMentions: false,
                  maxBots: 0,
                  maxConvsHit: 0,
                  maxConvsSearched: 0,
                  maxHits: 1000,
                  maxMessages: -1,
                  maxNameConvs: 0,
                  maxTeams: 0,
                  reindexMode: RPCChatTypes.ReIndexingMode.postsearchSync,
                  sentAfter: 0,
                  sentBefore: 0,
                  sentBy: '',
                  sentTo: '',
                  skipBotCache: false,
                },
                query,
              },
            },
            Z.dummyListenerApi
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error('search failed: ' + error.message)
            set(s => {
              s.threadSearchInfo.status = 'done'
            })
          }
        }
      }
      Z.ignorePromise(f())
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
        const clientPrev = getClientPrev(conversationIDKey)
        const meta = get().meta
        const outboxID = Common.generateOutboxID()
        logger.info(`toggleMessageReaction: posting reaction`)
        try {
          await RPCChatTypes.localPostReactionNonblockRpcPromise({
            body: emoji,
            clientPrev,
            conversationID: Types.keyToConversationID(conversationIDKey),
            identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
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
      Z.ignorePromise(f())
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
        s.messageCenterOrdinal = undefined
      })

      const f = async () => {
        const visible = get().threadSearchInfo.visible
        if (!visible) {
          await RPCChatTypes.localCancelActiveSearchRpcPromise()
        }
      }
      Z.ignorePromise(f())
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
        const viewType = RPCChatTypes.GalleryItemTyp.doc
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
        const viewType = RPCChatTypes.GalleryItemTyp.doc
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
    updateDraft: throttle(text => {
      const f = async () => {
        const meta = get().meta
        await RPCChatTypes.localUpdateUnsentTextRpcPromise({
          conversationID: Types.keyToConversationID(get().id),
          text,
          tlfName: meta.tlfname,
        })
      }
      Z.ignorePromise(f())
    }, 200),
    // maybe remove this when reducer is ported
    updateMessage: (ordinal: Types.Ordinal, pm: Partial<Types.Message>) => {
      set(s => {
        const m = s.messageMap.get(ordinal)
        if (!m) return

        const keys = Object.keys(pm)
        keys.forEach(k => {
          // @ts-ignore
          m[k] = pm[k]
        })
      })
    },
    updateMeta: (pm: Partial<Types.ConversationMeta>) => {
      // see setmeta
      set(s => {
        const keys = Object.keys(pm) as Array<keyof Types.ConversationMeta>
        keys.forEach(k => {
          // @ts-ignore
          s.meta[k] = pm[k]
        })
      })
      get().dispatch.setDraft(get().meta.draft)
      get().dispatch.setMuted(get().meta.isMuted)
    },
    updateNotificationSettings: (
      notificationsDesktop,
      notificationsMobile,
      notificationsGlobalIgnoreMentions
    ) => {
      const f = async () => {
        const conversationIDKey = get().id
        await RPCChatTypes.localSetAppNotificationSettingsLocalRpcPromise({
          channelWide: notificationsGlobalIgnoreMentions,
          convID: Types.keyToConversationID(conversationIDKey),
          settings: [
            {
              deviceType: RPCTypes.DeviceType.desktop,
              enabled: notificationsDesktop === 'onWhenAtMentioned',
              kind: RPCChatTypes.NotificationKind.atmention,
            },
            {
              deviceType: RPCTypes.DeviceType.desktop,
              enabled: notificationsDesktop === 'onAnyActivity',
              kind: RPCChatTypes.NotificationKind.generic,
            },
            {
              deviceType: RPCTypes.DeviceType.mobile,
              enabled: notificationsMobile === 'onWhenAtMentioned',
              kind: RPCChatTypes.NotificationKind.atmention,
            },
            {
              deviceType: RPCTypes.DeviceType.mobile,
              enabled: notificationsMobile === 'onAnyActivity',
              kind: RPCChatTypes.NotificationKind.generic,
            },
          ],
        })
      }
      Z.ignorePromise(f())
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
    getEditInfo: () => {
      const ordinal = get().editing
      if (!ordinal) {
        return
      }

      const message = get().messageMap.get(ordinal)
      if (!message) {
        return
      }
      switch (message.type) {
        case 'text':
          return {exploded: message.exploded, ordinal, text: message.text.stringValue()}
        case 'attachment':
          return {exploded: message.exploded, ordinal, text: message.title}
        default:
          return
      }
    },
    getExplodingMode: (): number => {
      const mode = get().explodingModeLock ?? get().explodingMode
      const meta = get().meta
      const convRetention = Meta.getEffectiveRetentionPolicy(meta)
      return convRetention.type === 'explode' ? Math.min(mode || Infinity, convRetention.seconds) : mode
    },
  }
}

type MadeStore = UseBoundStore<StoreApi<ConvoState>>
export const _stores = new Map<Types.ConversationIDKey, MadeStore>()

const createConvoStore = (id: Types.ConversationIDKey) => {
  const existing = _stores.get(id)
  if (existing) return existing
  const next = Z.createZustand<ConvoState>(createSlice)
  next.setState({id})
  _stores.set(id, next)
  next.getState().dispatch.setupSubscriptions()
  return next
}

// non reactive call, used in actions/dispatches
export function _getConvoState(id: Types.ConversationIDKey) {
  const store = createConvoStore(id)
  return store.getState()
}

const Context = React.createContext<MadeStore | null>(null)

type ConvoProviderProps = React.PropsWithChildren<{id: Types.ConversationIDKey; canBeNull?: boolean}>
export function _Provider({canBeNull, children, ...props}: ConvoProviderProps) {
  if (!canBeNull && (!props.id || props.id === noConversationIDKey)) {
    throw new Error('No convo id in provider')
  }
  return <Context.Provider value={createConvoStore(props.id)}>{children}</Context.Provider>
}

// use this if in doubt
export function _useContext<T>(
  selector: (state: ConvoState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = React.useContext(Context)
  if (!store) throw new Error('Missing ConvoContext.Provider in the tree')
  return useStore(store, selector, equalityFn)
}

// unusual, usually you useContext, but maybe in teams
export function _useConvoState<T>(
  id: Types.ConversationIDKey,
  selector: (state: ConvoState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = createConvoStore(id)
  return useStore(store, selector, equalityFn)
}
