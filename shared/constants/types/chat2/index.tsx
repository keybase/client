import * as RPCChatTypes from '../rpc-chat-gen'
import * as RPCTypes from '../rpc-gen'
import * as I from 'immutable'
import * as Common from './common'
import * as Meta from './meta'
import * as Message from './message'
import * as Wallet from '../wallets'
import * as TeamBuildingTypes from '../team-building'
import HiddenString from '../../../util/hidden-string'

export type _QuoteInfo = {
  counter: number
  ordinal: Message.Ordinal
  sourceConversationIDKey: Common.ConversationIDKey
  targetConversationIDKey: Common.ConversationIDKey
}
export type QuoteInfo = I.RecordOf<_QuoteInfo>

export type PaymentConfirmInfo = {
  error?: RPCTypes.Status
  summary?: RPCChatTypes.UIChatPaymentSummary
}

// Static config data we use for various things
export type _StaticConfig = {
  deletableByDeleteHistory: I.Set<Message.MessageType>
  builtinCommands: {
    [K in RPCChatTypes.ConversationBuiltinCommandTyp]: Array<RPCChatTypes.ConversationCommand>
  }
}
export type StaticConfig = I.RecordOf<_StaticConfig>

export type MetaMap = I.Map<Common.ConversationIDKey, Meta.ConversationMeta>
export type ConversationCountMap = I.Map<Common.ConversationIDKey, number>

export type ThreadSearchStatus = 'initial' | 'inprogress' | 'done'

export type _ThreadSearchInfo = {
  status: ThreadSearchStatus
  hits: I.List<Message.Message>
  visible: boolean
}

export type ThreadSearchInfo = I.RecordOf<_ThreadSearchInfo>

export type InboxSearchStatus = 'initial' | 'inprogress' | 'success' | 'error'

export type _InboxSearchTextHit = {
  conversationIDKey: Common.ConversationIDKey
  numHits: number
  query: string
  teamType: 'big' | 'small'
  time: number
}

export type InboxSearchTextHit = I.RecordOf<_InboxSearchTextHit>

export type _InboxSearchConvHit = {
  conversationIDKey: Common.ConversationIDKey
  teamType: 'big' | 'small'
}

export type InboxSearchConvHit = I.RecordOf<_InboxSearchConvHit>

export type _InboxSearchInfo = {
  indexPercent: number
  nameResults: I.List<InboxSearchConvHit>
  nameStatus: InboxSearchStatus
  nameResultsUnread: boolean
  query: HiddenString
  selectedIndex: number
  textResults: I.List<InboxSearchTextHit>
  textStatus: InboxSearchStatus
}

export type InboxSearchInfo = I.RecordOf<_InboxSearchInfo>

// Where focus should be going to.
// Null represents the default chat input.
// This is very simple for now, but we can make
// it fancier by using a stack and more types
export type Focus = 'filter' | null

export type CenterOrdinalHighlightMode = 'none' | 'flash' | 'always'

export type CenterOrdinal = {
  ordinal: Message.Ordinal
  highlightMode: CenterOrdinalHighlightMode
}

export type _State = {
  accountsInfoMap: I.Map<
    Common.ConversationIDKey,
    I.Map<RPCChatTypes.MessageID, Message.ChatRequestInfo | Message.ChatPaymentInfo>
  >
  badgeMap: ConversationCountMap
  editingMap: I.Map<Common.ConversationIDKey, Message.Ordinal>
  focus: Focus
  inboxHasLoaded: boolean
  inboxSearch: InboxSearchInfo | null
  inboxShowNew: boolean
  trustedInboxHasLoaded: boolean
  smallTeamsExpanded: boolean
  isWalletsNew: boolean
  messageCenterOrdinals: I.Map<Common.ConversationIDKey, CenterOrdinal>
  messageMap: I.Map<Common.ConversationIDKey, I.Map<Message.Ordinal, Message.Message>>
  messageOrdinals: I.Map<Common.ConversationIDKey, I.OrderedSet<Message.Ordinal>>
  metaMap: MetaMap
  moreToLoadMap: I.Map<Common.ConversationIDKey, boolean>
  orangeLineMap: I.Map<Common.ConversationIDKey, number>
  explodingModeLocks: I.Map<Common.ConversationIDKey, number>
  explodingModes: I.Map<Common.ConversationIDKey, number>
  quote: QuoteInfo | null
  selectedConversation: Common.ConversationIDKey
  staticConfig: StaticConfig | null
  typingMap: I.Map<Common.ConversationIDKey, I.Set<string>>
  unreadMap: ConversationCountMap
  unfurlPromptMap: I.Map<Common.ConversationIDKey, I.Map<Message.MessageID, I.Set<string>>>
  giphyWindowMap: I.Map<Common.ConversationIDKey, boolean>
  giphyResultMap: I.Map<Common.ConversationIDKey, RPCChatTypes.GiphySearchResults | null>
  pendingOutboxToOrdinal: I.Map<Common.ConversationIDKey, I.Map<Message.OutboxID, Message.Ordinal>>
  attachmentFullscreenMessage: Message.Message | null
  paymentConfirmInfo: PaymentConfirmInfo | null
  paymentStatusMap: I.Map<Wallet.PaymentID, Message.ChatPaymentInfo>
  unsentTextMap: I.Map<Common.ConversationIDKey, HiddenString | null>
  flipStatusMap: I.Map<string, RPCChatTypes.UICoinFlipStatus>
  commandMarkdownMap: I.Map<Common.ConversationIDKey, RPCChatTypes.UICommandMarkdown>
  containsLatestMessageMap: I.Map<Common.ConversationIDKey, boolean>
  threadSearchInfoMap: I.Map<Common.ConversationIDKey, ThreadSearchInfo>
  threadSearchQueryMap: I.Map<Common.ConversationIDKey, HiddenString | null>
  replyToMap: I.Map<Common.ConversationIDKey, Message.Ordinal>
  maybeMentionMap: I.Map<string, RPCChatTypes.UIMaybeMentionInfo>
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

export {ConversationMeta, MetaTrustedState, NotificationsType, TeamType} from './meta'
export {
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
export {ConversationIDKey} from './common'

export {
  messageIDToNumber,
  numberToMessageID,
  numberToOrdinal,
  ordinalToNumber,
  outboxIDToString,
  stringToOutboxID,
} from './message'
export {stringToConversationIDKey, conversationIDKeyToString} from './common'
