// @flow
import * as I from 'immutable'
import * as Types from '../types/chat2'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as TeamBuildingConstants from '../../constants/team-building'
import {chatTab} from '../tabs'
import type {TypedState} from '../reducer'
import {getPath} from '../../route-tree'
import {isMobile} from '../platform'
import {
  pendingConversationIDKey,
  noConversationIDKey,
  pendingWaitingConversationIDKey,
  conversationIDKeyToString,
  isValidConversationIDKey,
} from '../types/chat2/common'
import {makeConversationMeta, getEffectiveRetentionPolicy, getMeta} from './meta'
import {formatTextForQuoting} from '../../util/chat'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  accountsInfoMap: I.Map(),
  attachmentFullscreenMessage: null,
  badgeMap: I.Map(),
  editingMap: I.Map(),
  explodingModeLocks: I.Map(),
  explodingModes: I.Map(),
  focus: null,
  inboxFilter: '',
  inboxHasLoaded: false,
  isWalletsNew: true,
  messageMap: I.Map(),
  messageOrdinals: I.Map(),
  metaMap: I.Map([
    [pendingConversationIDKey, makeConversationMeta({conversationIDKey: noConversationIDKey})],
  ]),
  moreToLoadMap: I.Map(),
  orangeLineMap: I.Map(),
  paymentConfirmInfo: null,
  paymentStatusMap: I.Map(),
  pendingMode: 'none',
  pendingOutboxToOrdinal: I.Map(),
  pendingStatus: 'none',
  quote: null,
  selectedConversation: noConversationIDKey,
  smallTeamsExpanded: false,
  staticConfig: null,
  typingMap: I.Map(),
  unfurlPromptMap: I.Map(),
  unreadMap: I.Map(),
  unsentTextMap: I.Map(),

  // Team Building
  ...TeamBuildingConstants.makeSubState(),
})

// We stash the resolved pending conversation idkey into the meta itself
export const getResolvedPendingConversationIDKey = (state: TypedState) =>
  getMeta(state, pendingConversationIDKey).conversationIDKey

export const makeQuoteInfo: I.RecordFactory<Types._QuoteInfo> = I.Record({
  counter: 0,
  ordinal: Types.numberToOrdinal(0),
  sourceConversationIDKey: noConversationIDKey,
  targetConversationIDKey: noConversationIDKey,
})

export const makeStaticConfig: I.RecordFactory<Types._StaticConfig> = I.Record({
  builtinCommands: [],
  deletableByDeleteHistory: I.Set(),
})

export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id, I.OrderedSet())
export const getMessage = (
  state: TypedState,
  id: Types.ConversationIDKey,
  ordinal: Types.Ordinal
): ?Types.Message => state.chat2.messageMap.getIn([id, ordinal])
export const getMessageKey = (message: Types.Message) =>
  `${message.conversationIDKey}:${Types.ordinalToNumber(message.ordinal)}`
export const getHasBadge = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.badgeMap.get(id, 0) > 0
export const getHasUnread = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.unreadMap.get(id, 0) > 0
export const getSelectedConversation = (state: TypedState) => state.chat2.selectedConversation

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

  const routePath = getPath(state.routeTree.routeState)
  let chatThreadSelected = false
  if (isMobile) {
    chatThreadSelected =
      routePath.size === 2 && routePath.get(0) === chatTab && routePath.get(1) === 'conversation'
  } else {
    chatThreadSelected = routePath.size >= 1 && routePath.get(0) === chatTab
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
export const isInfoPanelOpen = (state: TypedState) => {
  const routePath = getPath(state.routeTree.routeState, [chatTab])
  return routePath.size === 3 && routePath.get(2) === 'infoPanel'
}

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
  let mode = state.chat2.getIn(['explodingModeLocks', c], null)
  if (mode === null) {
    mode = state.chat2.getIn(['explodingModes', c], 0)
  }
  const meta = getMeta(state, c)
  const convRetention = getEffectiveRetentionPolicy(meta)
  mode = convRetention.type === 'explode' ? Math.min(mode || Infinity, convRetention.seconds) : mode
  return mode || 0
}
export const isExplodingModeLocked = (state: TypedState, c: Types.ConversationIDKey) =>
  state.chat2.getIn(['explodingModeLocks', c], null) !== null

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
    status: Object.keys(RPCChatTypes.commonConversationStatus)
      .filter(k => !['ignored', 'blocked', 'reported'].includes(k))
      .map(k => RPCChatTypes.commonConversationStatus[k]),
    tlfVisibility: RPCTypes.commonTLFVisibility.private,
    topicType: RPCChatTypes.commonTopicType.chat,
    unreadOnly: false,
  }
}

export const anyToConversationMembersType = (a: any): ?RPCChatTypes.ConversationMembersType => {
  const membersTypeNumber: number = typeof a === 'string' ? parseInt(a, 10) : a || -1
  switch (membersTypeNumber) {
    case RPCChatTypes.commonConversationMembersType.kbfs:
      return RPCChatTypes.commonConversationMembersType.kbfs
    case RPCChatTypes.commonConversationMembersType.team:
      return RPCChatTypes.commonConversationMembersType.team
    case RPCChatTypes.commonConversationMembersType.impteamnative:
      return RPCChatTypes.commonConversationMembersType.impteamnative
    case RPCChatTypes.commonConversationMembersType.impteamupgrade:
      return RPCChatTypes.commonConversationMembersType.impteamupgrade
    default:
      return null
  }
}

export const threadRoute = isMobile
  ? [chatTab, 'conversation']
  : [{props: {}, selected: chatTab}, {props: {}, selected: null}]

const numMessagesOnInitialLoad = isMobile ? 20 : 100
const numMessagesOnScrollback = isMobile ? 100 : 100

export {
  getChannelSuggestions,
  getCommands,
  getConversationIDKeyMetasToLoad,
  getEffectiveRetentionPolicy,
  getMeta,
  getParticipantSuggestions,
  getRowParticipants,
  getRowStyles,
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
  pendingConversationIDKey,
  pendingWaitingConversationIDKey,
}
