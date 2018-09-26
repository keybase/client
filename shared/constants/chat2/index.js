// @flow
import * as I from 'immutable'
import * as Types from '../types/chat2'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
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
import {makeConversationMeta, getMeta} from './meta'
import {formatTextForQuoting} from '../../util/chat'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  accountsInfoMap: I.Map(),
  badgeMap: I.Map(),
  editingMap: I.Map(),
  explodingModeLocks: I.Map(),
  explodingModes: I.Map(),
  inboxHasLoaded: false,
  inboxFilter: '',
  isExplodingNew: true,
  isWalletsNew: true,
  messageMap: I.Map(),
  messageOrdinals: I.Map(),
  metaMap: I.Map([
    [pendingConversationIDKey, makeConversationMeta({conversationIDKey: noConversationIDKey})],
  ]),
  moreToLoadMap: I.Map(),
  orangeLineMap: I.Map(),
  pendingMode: 'none',
  pendingStatus: 'none',
  pendingOutboxToOrdinal: I.Map(),
  quote: null,
  selectedConversation: noConversationIDKey,
  smallTeamsExpanded: false,
  staticConfig: null,
  typingMap: I.Map(),
  unreadMap: I.Map(),

  // Team Building
  teamBuildingTeamSoFar: I.Set(),
  teamBuildingSearchResults: I.Map(),
  teamBuildingServiceResultCount: I.Map(),
  teamBuildingFinishedTeam: I.Set(),
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
  deletableByDeleteHistory: I.Set(),
})

export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id, I.SortedSet())
export const getMessage = (state: TypedState, id: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
  state.chat2.messageMap.getIn([id, ordinal])
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
  const appFocused = state.config.appFocused
  const routePath = getPath(state.routeTree.routeState)
  let chatThreadSelected = false
  if (isMobile) {
    chatThreadSelected =
      routePath.size === 2 && routePath.get(0) === chatTab && routePath.get(1) === 'conversation'
  } else {
    chatThreadSelected = routePath.size >= 1 && routePath.get(0) === chatTab
  }

  return (
    appFocused && // app focused?
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
  state.waiting.keySeq().some(k => k.startsWith('chat:'))

// When we see that exploding messages are in the app, we set
// seenExplodingGregorKey. Once newExplodingGregorOffset time
// passes, we stop showing the 'NEW' tag.
export const seenExplodingGregorKey = 'chat.seenExplodingMessages'
export const newExplodingGregorOffset = 1000 * 3600 * 24 * 3 // 3 days in ms
export const getIsExplodingNew = (state: TypedState) => state.chat2.get('isExplodingNew')
export const explodingModeGregorKeyPrefix = 'exploding:'
/**
 * Gregor key for exploding conversations
 * Used as the `category` when setting the exploding mode on a conversation
 * `body` is the number of seconds to exploding message etime
 */
export const explodingModeGregorKey = (c: Types.ConversationIDKey): string =>
  `${explodingModeGregorKeyPrefix}${c}`
export const getConversationExplodingMode = (state: TypedState, c: Types.ConversationIDKey) => {
  let mode = state.chat2.getIn(['explodingModeLocks', c], null)
  if (mode === null) {
    mode = state.chat2.getIn(['explodingModes', c], 0)
  }
  return mode
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
    convIDs: convIDKeys.map(Types.keyToConversationID),
    computeActiveList: true,
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
  getConversationIDKeyMetasToLoad,
  getMeta,
  getRowParticipants,
  getRowStyles,
  inboxUIItemToConversationMeta,
  makeConversationMeta,
  timestampToString,
  unverifiedInboxUIItemToConversationMeta,
  updateMeta,
  updateMetaWithNotificationSettings,
} from './meta'

export {
  allMessageTypes,
  authorIsCollapsible,
  decoratedMessageTypes,
  enoughTimeBetweenMessages,
  getClientPrev,
  getDeletableByDeleteHistory,
  getMessageID,
  getRequestMessageInfo,
  getPaymentMessageInfo,
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
  showAuthorMessageTypes,
  uiMessageEditToMessage,
  uiMessageToMessage,
  uiPaymentInfoToChatPaymentInfo,
  uiRequestInfoToChatRequestInfo,
  upgradeMessage,
} from './message'

export {
  isValidConversationIDKey,
  noConversationIDKey,
  numMessagesOnInitialLoad,
  numMessagesOnScrollback,
  pendingConversationIDKey,
  pendingWaitingConversationIDKey,
}
