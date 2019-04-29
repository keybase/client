// @flow strict
import * as RPCChatTypes from '../rpc-chat-gen'
import * as RPCTypes from '../rpc-gen'
import * as I from 'immutable'
import * as Common from './common'
import * as Meta from './meta'
import * as Message from './message'
import * as Wallet from '../wallets'
import * as TeamBuildingTypes from '../team-building'
import HiddenString from '../../../util/hidden-string'

export type PendingMode =
  | 'none' // no pending
  | 'searchingForUsers' // doing a search
  | 'newChat' // doing a search
  | 'newTeamBuilding' // Users picked via team-building, waiting now.
  | 'fixedSetOfUsers' // selected a set of users externally
  | 'startingFromAReset' // fixedSet but our intention is to restart a reset conversation

export type PendingStatus =
  | 'none' // no special status
  | 'failed' // creating conversation failed

export type _QuoteInfo = {
  // Always positive and monotonically increasing.
  counter: number,
  ordinal: Message.Ordinal,
  sourceConversationIDKey: Common.ConversationIDKey,
  targetConversationIDKey: Common.ConversationIDKey,
}
export type QuoteInfo = I.RecordOf<_QuoteInfo>

export type PaymentConfirmInfo = {
  error?: RPCTypes.Status,
  summary?: RPCChatTypes.UIChatPaymentSummary,
}

// Static config data we use for various things
export type _StaticConfig = {
  deletableByDeleteHistory: I.Set<Message.MessageType>,
  builtinCommands: {
    [typ: RPCChatTypes.ConversationBuiltinCommandTyp]: Array<RPCChatTypes.ConversationCommand>,
  },
}
export type StaticConfig = I.RecordOf<_StaticConfig>

export type MetaMap = I.Map<Common.ConversationIDKey, Meta.ConversationMeta>
export type ConversationCountMap = I.Map<Common.ConversationIDKey, number>

export type ThreadSearchStatus = 'initial' | 'inprogress' | 'done'

export type _ThreadSearchInfo = {
  status: ThreadSearchStatus,
  hits: I.List<Message.Message>,
  visible: boolean,
}

export type ThreadSearchInfo = I.RecordOf<_ThreadSearchInfo>

export type InboxSearchStatus = 'initial' | 'inprogress' | 'success' | 'error'

export type _InboxSearchTextHit = {
  conversationIDKey: Common.ConversationIDKey,
  numHits: number,
  query: string,
  teamType: 'big' | 'small',
  time: number,
}

export type InboxSearchTextHit = I.RecordOf<_InboxSearchTextHit>

export type _InboxSearchConvHit = {
  conversationIDKey: Common.ConversationIDKey,
  teamType: 'big' | 'small',
}

export type InboxSearchConvHit = I.RecordOf<_InboxSearchConvHit>

export type _InboxSearchInfo = {
  indexPercent: number,
  nameResults: I.List<InboxSearchConvHit>,
  nameStatus: InboxSearchStatus,
  nameResultsUnread: boolean,
  query: HiddenString,
  selectedIndex: number,
  textResults: I.List<InboxSearchTextHit>,
  textStatus: InboxSearchStatus,
}

export type InboxSearchInfo = I.RecordOf<_InboxSearchInfo>

// Where focus should be going to.
// Null represents the default chat input.
// This is very simple for now, but we can make
// it fancier by using a stack and more types
export type Focus = 'filter' | null

export type CenterOrdinalHighlightMode = 'none' | 'flash' | 'always'

export type CenterOrdinal = {
  ordinal: Message.Ordinal,
  highlightMode: CenterOrdinalHighlightMode,
}

export type _State = {
  accountsInfoMap: I.Map<
    Common.ConversationIDKey,
    I.Map<RPCChatTypes.MessageID, Message.ChatRequestInfo | Message.ChatPaymentInfo>
  >, // temp cache for requestPayment and sendPayment message data
  badgeMap: ConversationCountMap, // id to the badge count
  editingMap: I.Map<Common.ConversationIDKey, Message.Ordinal>, // current message being edited
  focus: Focus,
  inboxHasLoaded: boolean, // if we've ever loaded
  inboxSearch: ?InboxSearchInfo,
  trustedInboxHasLoaded: boolean, // if we've done initial trusted inbox load
  smallTeamsExpanded: boolean, // if we're showing all small teams
  isWalletsNew: boolean, // controls new-ness of wallets in chat UI
  messageCenterOrdinals: I.Map<Common.ConversationIDKey, CenterOrdinal>, // ordinals to center threads on
  messageMap: I.Map<Common.ConversationIDKey, I.Map<Message.Ordinal, Message.Message>>, // messages in a thread
  messageOrdinals: I.Map<Common.ConversationIDKey, I.OrderedSet<Message.Ordinal>>, // ordered ordinals in a thread
  metaMap: MetaMap, // metadata about a thread, There is a special node for the pending conversation
  moreToLoadMap: I.Map<Common.ConversationIDKey, boolean>, // if we have more data to load
  orangeLineMap: I.Map<Common.ConversationIDKey, number>, // last message we've seen
  explodingModeLocks: I.Map<Common.ConversationIDKey, number>, // locks set on exploding mode while user is inputting text
  explodingModes: I.Map<Common.ConversationIDKey, number>, // seconds to exploding message expiration
  quote: ?QuoteInfo, // last quoted message
  selectedConversation: Common.ConversationIDKey, // the selected conversation, if any
  staticConfig: ?StaticConfig, // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded
  typingMap: I.Map<Common.ConversationIDKey, I.Set<string>>, // who's typing currently
  unreadMap: ConversationCountMap, // how many unread messages there are
  unfurlPromptMap: I.Map<Common.ConversationIDKey, I.Map<Message.MessageID, I.Set<string>>>,
  giphyWindowMap: I.Map<Common.ConversationIDKey, boolean>,
  giphyResultMap: I.Map<Common.ConversationIDKey, ?RPCChatTypes.GiphySearchResults>,
  pendingOutboxToOrdinal: I.Map<Common.ConversationIDKey, I.Map<Message.OutboxID, Message.Ordinal>>, // messages waiting to be sent
  pendingMode: PendingMode, // we're about to talk to people we're searching for or a set of users from somewhere else (folder)
  pendingStatus: PendingStatus, // the status of creating a new conversation
  attachmentFullscreenMessage: ?Message.Message,
  paymentConfirmInfo: ?PaymentConfirmInfo, // chat payment confirm screen data
  paymentStatusMap: I.Map<Wallet.PaymentID, Message.ChatPaymentInfo>,
  unsentTextMap: I.Map<Common.ConversationIDKey, ?HiddenString>,
  flipStatusMap: I.Map<string, RPCChatTypes.UICoinFlipStatus>,
  commandMarkdownMap: I.Map<Common.ConversationIDKey, RPCChatTypes.UICommandMarkdown>,
  containsLatestMessageMap: I.Map<Common.ConversationIDKey, boolean>,
  threadSearchInfoMap: I.Map<Common.ConversationIDKey, ThreadSearchInfo>,
  threadSearchQueryMap: I.Map<Common.ConversationIDKey, ?HiddenString>,
  replyToMap: I.Map<Common.ConversationIDKey, Message.Ordinal>,
} & TeamBuildingTypes.TeamBuildingSubState

export type State = I.RecordOf<_State>

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Common.ConversationIDKey =>
  Common.stringToConversationIDKey(conversationID.toString('hex'))

export const keyToConversationID = (key: Common.ConversationIDKey): RPCChatTypes.ConversationID =>
  Buffer.from(Common.conversationIDKeyToString(key), 'hex')

export const rpcOutboxIDToOutboxID = (outboxID: RPCChatTypes.OutboxID): Message.OutboxID =>
  Message.stringToOutboxID(outboxID.toString('hex'))

export const outboxIDToRpcOutboxID = (outboxID: Message.OutboxID): RPCChatTypes.OutboxID =>
  Buffer.from(Message.outboxIDToString(outboxID), 'hex')

export type {ConversationMeta, MetaTrustedState, NotificationsType, TeamType} from './meta'
export type {
  AttachmentType,
  ChatPaymentInfo,
  ChatRequestInfo,
  DecoratedMessage,
  MentionsAt,
  MentionsChannel,
  MentionsChannelName,
  Message,
  MessageAttachment,
  MessageExplodeDescription,
  MessageID,
  MessageRequestPayment,
  MessageSendPayment,
  MessageSetChannelname,
  MessageSetDescription,
  MessageSystemAddedToTeam,
  MessageSystemChangeRetention,
  MessageSystemGitPush,
  MessageSystemInviteAccepted,
  MessageSystemJoined,
  MessageSystemLeft,
  MessageSystemSimpleToComplex,
  MessageSystemText,
  MessageSystemUsersAddedToConversation,
  MessageText,
  MessageType,
  Ordinal,
  OutboxID,
  PathAndOutboxID,
  PreviewSpec,
  Reaction,
  Reactions,
} from './message'
export type {ConversationIDKey} from './common'

export {
  messageIDToNumber,
  numberToMessageID,
  numberToOrdinal,
  ordinalToNumber,
  outboxIDToString,
  stringToOutboxID,
} from './message'
export {stringToConversationIDKey, conversationIDKeyToString} from './common'
