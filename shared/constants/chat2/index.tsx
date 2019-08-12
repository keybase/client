import * as I from 'immutable'
import * as Types from '../types/chat2'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as TeamBuildingConstants from '../../constants/team-building'
import {clamp} from 'lodash-es'
import {chatTab} from '../tabs'
import {TypedState} from '../reducer'
import {isMobile} from '../platform'
import {
  noConversationIDKey,
  pendingWaitingConversationIDKey,
  pendingErrorConversationIDKey,
  conversationIDKeyToString,
  isValidConversationIDKey,
} from '../types/chat2/common'
import {getEffectiveRetentionPolicy, getMeta} from './meta'
import {formatTextForQuoting} from '../../util/chat'
import * as Router2 from '../router2'
import HiddenString from '../../util/hidden-string'

export const defaultTopReacjis = [':+1:', ':-1:', ':tada:', ':joy:', ':sunglasses:']
const defaultSkinTone = 1
export const defaultUserReacjis = {skinTone: defaultSkinTone, topReacjis: defaultTopReacjis}

export const makeState = I.Record<Types._State>({
  accountsInfoMap: I.Map(),
  attachmentFullscreenSelection: null,
  attachmentViewMap: I.Map(),
  badgeMap: I.Map(),
  botCommandsUpdateStatusMap: I.Map(),
  commandMarkdownMap: I.Map(),
  commandStatusMap: I.Map(),
  containsLatestMessageMap: I.Map(),
  createConversationError: null,
  editingMap: I.Map(),
  explodingModeLocks: I.Map(),
  explodingModes: I.Map(),
  flipStatusMap: I.Map(),
  focus: null,
  giphyResultMap: I.Map(),
  giphyWindowMap: I.Map(),
  inboxHasLoaded: false,
  inboxSearch: null,
  inboxShowNew: false,
  isWalletsNew: true,
  maybeMentionMap: I.Map(),
  messageCenterOrdinals: I.Map(),
  messageMap: I.Map(),
  messageOrdinals: I.Map(),
  metaMap: I.Map(),
  moreToLoadMap: I.Map(),
  orangeLineMap: I.Map(),
  paymentConfirmInfo: null,
  paymentStatusMap: I.Map(),
  pendingOutboxToOrdinal: I.Map(),
  prependTextMap: I.Map(),
  previousSelectedConversation: noConversationIDKey,
  quote: null,
  replyToMap: I.Map(),
  selectedConversation: noConversationIDKey,
  smallTeamsExpanded: false,
  staticConfig: null,
  teamBuilding: TeamBuildingConstants.makeSubState(),
  threadLoadStatus: I.Map(),
  threadSearchInfoMap: I.Map(),
  threadSearchQueryMap: I.Map(),
  trustedInboxHasLoaded: false,
  typingMap: I.Map(),
  unfurlPromptMap: I.Map(),
  unreadMap: I.Map(),
  unsentTextMap: I.Map(),
  userReacjis: defaultUserReacjis,
})

export const makeQuoteInfo = I.Record<Types._QuoteInfo>({
  counter: 0,
  ordinal: Types.numberToOrdinal(0),
  sourceConversationIDKey: noConversationIDKey,
  targetConversationIDKey: noConversationIDKey,
})

export const makeStaticConfig = I.Record<Types._StaticConfig>({
  builtinCommands: {
    [RPCChatTypes.ConversationBuiltinCommandTyp.adhoc]: [],
    [RPCChatTypes.ConversationBuiltinCommandTyp.bigteam]: [],
    [RPCChatTypes.ConversationBuiltinCommandTyp.bigteamgeneral]: [],
    [RPCChatTypes.ConversationBuiltinCommandTyp.none]: [],
    [RPCChatTypes.ConversationBuiltinCommandTyp.smallteam]: [],
  },
  deletableByDeleteHistory: I.Set(),
})

export const makeThreadSearchInfo = I.Record<Types._ThreadSearchInfo>({
  hits: I.List(),
  status: 'initial',
  visible: false,
})

export const inboxSearchMaxTextMessages = 25
export const inboxSearchMaxTextResults = 50
export const inboxSearchMaxNameResults = 7
export const inboxSearchMaxUnreadNameResults = isMobile ? 5 : 10

export const makeInboxSearchInfo = I.Record<Types._InboxSearchInfo>({
  indexPercent: 0,
  nameResults: I.List(),
  nameResultsUnread: false,
  nameStatus: 'initial',
  query: new HiddenString(''),
  selectedIndex: 0,
  textResults: I.List(),
  textStatus: 'initial',
})

export const makeInboxSearchConvHit = I.Record<Types._InboxSearchConvHit>({
  conversationIDKey: noConversationIDKey,
  teamType: 'small',
})

export const makeInboxSearchTextHit = I.Record<Types._InboxSearchTextHit>({
  conversationIDKey: noConversationIDKey,
  numHits: 0,
  query: '',
  teamType: 'small',
  time: 0,
})

export const makeAttachmentViewInfo = I.Record<Types._AttachmentViewInfo>({
  last: false,
  messages: I.List(),
  status: 'loading',
})

export const initialAttachmentViewInfo = makeAttachmentViewInfo()

export const getInboxSearchSelected = (inboxSearch: Types.InboxSearchInfo) => {
  if (inboxSearch.selectedIndex < inboxSearch.nameResults.size) {
    const maybeNameResults = inboxSearch.nameResults.get(inboxSearch.selectedIndex)
    const conversationIDKey =
      maybeNameResults === null || maybeNameResults === undefined
        ? undefined
        : maybeNameResults.conversationIDKey
    if (conversationIDKey) {
      return {
        conversationIDKey,
        query: undefined,
      }
    }
  } else if (inboxSearch.selectedIndex < inboxSearch.nameResults.size + inboxSearch.textResults.size) {
    const result = inboxSearch.textResults.get(inboxSearch.selectedIndex - inboxSearch.nameResults.size)
    if (result) {
      return {
        conversationIDKey: result.conversationIDKey,
        query: new HiddenString(result.query),
      }
    }
  }
  return null
}

export const getThreadSearchInfo = (state: TypedState, conversationIDKey: Types.ConversationIDKey) =>
  state.chat2.threadSearchInfoMap.get(conversationIDKey, makeThreadSearchInfo())

export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id, I.OrderedSet<Types.Ordinal>())
export const getMessageCenterOrdinal = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageCenterOrdinals.get(id)
export const getMessage = (
  state: TypedState,
  id: Types.ConversationIDKey,
  ordinal: Types.Ordinal
): Types.Message | null => state.chat2.messageMap.getIn([id, ordinal])
export const isDecoratedMessage = (message: Types.Message): message is Types.DecoratedMessage => {
  return !(
    message.type === 'placeholder' ||
    message.type === 'deleted' ||
    message.type === 'systemJoined' ||
    message.type === 'systemLeft'
  )
}
export const getMessageKey = (message: Types.Message) =>
  `${message.conversationIDKey}:${Types.ordinalToNumber(message.ordinal)}`
export const getHasBadge = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.badgeMap.get(id, 0) > 0
export const getHasUnread = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.unreadMap.get(id, 0) > 0
export const getSelectedConversation = (state: TypedState) => state.chat2.selectedConversation
export const getReplyToOrdinal = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  return state.chat2.replyToMap.get(conversationIDKey, null)
}
export const getReplyToMessageID = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  const ordinal = getReplyToOrdinal(state, conversationIDKey)
  if (!ordinal) return null
  const maybeMessage = getMessage(state, conversationIDKey, ordinal)
  return ordinal ? (maybeMessage === null || maybeMessage === undefined ? undefined : maybeMessage.id) : null
}

export const getEditInfo = (state: TypedState, id: Types.ConversationIDKey) => {
  const ordinal = state.chat2.editingMap.get(id)
  if (!ordinal) {
    return null
  }

  const message = getMessage(state, id, ordinal)
  if (!message || message.type !== 'text') {
    return null
  }

  return {exploded: message.exploded, ordinal, text: message.text.stringValue()}
}

export const getQuoteInfo = (state: TypedState, id: Types.ConversationIDKey) => {
  const quote = state.chat2.quote
  // Return null if we're not on the target conversation.
  if (!quote || quote.targetConversationIDKey !== id) {
    return null
  }

  const message = getMessage(state, quote.sourceConversationIDKey, quote.ordinal)
  if (!message || message.type !== 'text') {
    return null
  }

  return {counter: quote.counter, text: formatTextForQuoting(message.text.stringValue())}
}

export const getTyping = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.typingMap.get(id, I.Set())
export const generateOutboxID = () => Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))
export const isUserActivelyLookingAtThisThread = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey
) => {
  const selectedConversationIDKey = getSelectedConversation(state)

  let chatThreadSelected = false
  if (isMobile) {
    chatThreadSelected = true // conversationIDKey === selectedConversationIDKey is the only thing that matters in the new router
  } else {
    const maybeVisibleScreen = Router2.getVisibleScreen()
    chatThreadSelected =
      (maybeVisibleScreen === null || maybeVisibleScreen === undefined
        ? undefined
        : maybeVisibleScreen.routeName) === 'chatRoot'
  }

  return (
    state.config.appFocused && // app focused?
    state.config.userActive && // actually interacting w/ the app
    chatThreadSelected && // looking at the chat tab?
    conversationIDKey === selectedConversationIDKey // looking at the selected thread?
  )
}
export const isTeamConversationSelected = (state: TypedState, teamname: string) => {
  const meta = getMeta(state, getSelectedConversation(state))
  return meta.teamname === teamname
}
export const isInfoPanelOpen = () => {
  const maybeVisibleScreen = Router2.getVisibleScreen()
  return (
    (maybeVisibleScreen === null || maybeVisibleScreen === undefined
      ? undefined
      : maybeVisibleScreen.routeName) === 'chatInfoPanel'
  )
}

export const inboxSearchNewKey = 'chat:inboxSearchNew'
export const waitingKeyJoinConversation = 'chat:joinConversation'
export const waitingKeyDeleteHistory = 'chat:deleteHistory'
export const waitingKeyPost = 'chat:post'
export const waitingKeyRetryPost = 'chat:retryPost'
export const waitingKeyEditPost = 'chat:editPost'
export const waitingKeyDeletePost = 'chat:deletePost'
export const waitingKeyCancelPost = 'chat:cancelPost'
export const waitingKeyInboxRefresh = 'chat:inboxRefresh'
export const waitingKeyCreating = 'chat:creatingConvo'
export const waitingKeyInboxSyncStarted = 'chat:inboxSyncStarted'
export const waitingKeyPushLoad = (conversationIDKey: Types.ConversationIDKey) =>
  `chat:pushLoad:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyThreadLoad = (conversationIDKey: Types.ConversationIDKey) =>
  `chat:loadingThread:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyUnboxing = (conversationIDKey: Types.ConversationIDKey) =>
  `chat:unboxing:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyAddUsersToChannel = 'chat:addUsersToConversation'
export const waitingKeyConvStatusChange = (conversationIDKey: Types.ConversationIDKey) =>
  `chat:convStatusChange:${conversationIDKeyToString(conversationIDKey)}`

export const anyChatWaitingKeys = (state: TypedState) =>
  state.waiting.counts.keySeq().some(k => k.startsWith('chat:'))

/**
 * Gregor key for exploding conversations
 * Used as the `category` when setting the exploding mode on a conversation
 * `body` is the number of seconds to exploding message etime
 * Note: The core service also uses this value, so if it changes, please notify core
 */
export const explodingModeGregorKeyPrefix = 'exploding:'
export const explodingModeGregorKey = (c: Types.ConversationIDKey): string =>
  `${explodingModeGregorKeyPrefix}${c}`
export const getConversationExplodingMode = (state: TypedState, c: Types.ConversationIDKey): number => {
  let mode = state.chat2.explodingModeLocks.get(c, null)
  if (mode === null) {
    mode = state.chat2.explodingModes.get(c, 0)
  }
  const meta = getMeta(state, c)
  const convRetention = getEffectiveRetentionPolicy(meta)
  mode = convRetention.type === 'explode' ? Math.min(mode || Infinity, convRetention.seconds) : mode
  return mode || 0
}
export const isExplodingModeLocked = (state: TypedState, c: Types.ConversationIDKey) =>
  state.chat2.explodingModeLocks.get(c, null) !== null

export const getTeamMentionName = (name: string, channel: string) => {
  return name + (channel ? `#${channel}` : '')
}

// When user clicks wallets icon in chat input, set seenWalletsGregorKey with
// body of 'true'
export const seenWalletsGregorKey = 'chat.seenWallets'

export const makeInboxQuery = (
  convIDKeys: Array<Types.ConversationIDKey>
): RPCChatTypes.GetInboxLocalQuery => {
  return {
    computeActiveList: true,
    convIDs: convIDKeys.map(Types.keyToConversationID),
    readOnly: false,
    status: (Object.keys(RPCChatTypes.ConversationStatus)
      .filter(k => typeof RPCChatTypes.ConversationStatus[k as any] === 'number')
      .filter(k => !['ignored', 'blocked', 'reported'].includes(k as any))
      .map(k => RPCChatTypes.ConversationStatus[k as any]) as unknown) as Array<
      RPCChatTypes.ConversationStatus
    >,
    tlfVisibility: RPCTypes.TLFVisibility.private,
    topicType: RPCChatTypes.TopicType.chat,
    unreadOnly: false,
  }
}

export const anyToConversationMembersType = (a: any): RPCChatTypes.ConversationMembersType | null => {
  const membersTypeNumber: number = typeof a === 'string' ? parseInt(a, 10) : a || -1
  switch (membersTypeNumber) {
    case RPCChatTypes.ConversationMembersType.kbfs:
      return RPCChatTypes.ConversationMembersType.kbfs
    case RPCChatTypes.ConversationMembersType.team:
      return RPCChatTypes.ConversationMembersType.team
    case RPCChatTypes.ConversationMembersType.impteamnative:
      return RPCChatTypes.ConversationMembersType.impteamnative
    case RPCChatTypes.ConversationMembersType.impteamupgrade:
      return RPCChatTypes.ConversationMembersType.impteamupgrade
    default:
      return null
  }
}

export const threadRoute = isMobile ? [chatTab, 'chatConversation'] : [{props: {}, selected: chatTab}]
export const newRouterThreadRoute = isMobile ? ['chatConversation'] : [chatTab]

const numMessagesOnInitialLoad = isMobile ? 20 : 100
const numMessagesOnScrollback = isMobile ? 100 : 100

export const flipPhaseToString = (phase: number) => {
  switch (phase) {
    case RPCChatTypes.UICoinFlipPhase.commitment:
      return 'commitments'
    case RPCChatTypes.UICoinFlipPhase.reveals:
      return 'secrets'
    case RPCChatTypes.UICoinFlipPhase.complete:
      return 'complete'
    default:
      return 'loading'
  }
}

export const clampImageSize = (width: number, height: number, maxSize: number) =>
  height > width
    ? {
        height: clamp(height || 0, 0, maxSize),
        width: (clamp(height || 0, 0, maxSize) * width) / (height || 1),
      }
    : {
        height: (clamp(width || 0, 0, maxSize) * height) / (width || 1),
        width: clamp(width || 0, 0, maxSize),
      }

export const zoomImage = (width: number, height: number, maxThumbSize: number) => {
  const dims =
    height > width
      ? {height: (maxThumbSize * height) / width, width: maxThumbSize}
      : {height: maxThumbSize, width: (maxThumbSize * width) / height}
  const marginHeight = dims.height > maxThumbSize ? (dims.height - maxThumbSize) / 2 : 0
  const marginWidth = dims.width > maxThumbSize ? (dims.width - maxThumbSize) / 2 : 0
  return {
    dims,
    margins: {
      marginBottom: -marginHeight,
      marginLeft: -marginWidth,
      marginRight: -marginWidth,
      marginTop: -marginHeight,
    },
  }
}

export {
  getAllChannels,
  getBotCommands,
  getChannelForTeam,
  getChannelSuggestions,
  getCommands,
  getConversationIDKeyMetasToLoad,
  getEffectiveRetentionPolicy,
  getMeta,
  getParticipantSuggestions,
  getRowParticipants,
  getRowStyles,
  getTeams,
  inboxUIItemToConversationMeta,
  isDecryptingSnippet,
  makeConversationMeta,
  shouldShowWalletsIcon,
  timestampToString,
  unverifiedInboxUIItemToConversationMeta,
  updateMeta,
  updateMetaWithNotificationSettings,
} from './meta'

export {
  allMessageTypes,
  enoughTimeBetweenMessages,
  getClientPrev,
  getDeletableByDeleteHistory,
  getMessageID,
  getRequestMessageInfo,
  getPaymentMessageInfo,
  hasSuccessfulInlinePayments,
  isPendingPaymentMessage,
  isSpecialMention,
  isVideoAttachment,
  makeChatRequestInfo,
  makeMessageAttachment,
  makeMessageDeleted,
  makeMessageText,
  makePendingAttachmentMessage,
  makePendingTextMessage,
  makeReaction,
  messageExplodeDescriptions,
  nextFractionalOrdinal,
  pathToAttachmentType,
  previewSpecs,
  reactionMapToReactions,
  rpcErrorToString,
  serviceMessageTypeToMessageTypes,
  shouldShowPopup,
  specialMentions,
  uiMessageEditToMessage,
  uiMessageToMessage,
  uiPaymentInfoToChatPaymentInfo,
  uiRequestInfoToChatRequestInfo,
  upgradeMessage,
  mergeMessage,
} from './message'

export {
  isValidConversationIDKey,
  noConversationIDKey,
  numMessagesOnInitialLoad,
  numMessagesOnScrollback,
  pendingErrorConversationIDKey,
  pendingWaitingConversationIDKey,
}
