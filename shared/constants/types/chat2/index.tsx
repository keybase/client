import * as RPCChatTypes from '../rpc-chat-gen'
import * as RPCTypes from '../rpc-gen'
import * as I from 'immutable'
import * as Common from './common'
import * as Meta from './meta'
import * as Message from './message'
import * as Wallet from '../wallets'
import * as TeamBuildingTypes from '../team-building'
import HiddenString from '../../../util/hidden-string'

export type PendingMode = "none" | "searchingForUsers" | "newChat" | "newTeamBuilding" | "fixedSetOfUsers" | "startingFromAReset"; // fixedSet but our intention is to restart a reset conversation

export type PendingStatus = "none" | "failed"; // creating conversation failed

export type _QuoteInfo = {
  counter: number,
  ordinal: Message.Ordinal,
  sourceConversationIDKey: Common.ConversationIDKey,
  targetConversationIDKey: Common.ConversationIDKey
};
export type QuoteInfo = I.RecordOf<_QuoteInfo>;

export type PaymentConfirmInfo = {
  error?: RPCTypes.Status,
  summary?: RPCChatTypes.UIChatPaymentSummary
};

// Static config data we use for various things
export type _StaticConfig = {
  deletableByDeleteHistory: I.Set<Message.MessageType>,
  builtinCommands: {
    [K in RPCChatTypes.ConversationBuiltinCommandTyp]: Array<RPCChatTypes.ConversationCommand>;
  }
};
export type StaticConfig = I.RecordOf<_StaticConfig>;

export type MetaMap = I.Map<Common.ConversationIDKey, Meta.ConversationMeta>;
export type ConversationCountMap = I.Map<Common.ConversationIDKey, number>;

// Where focus should be going to.
// Null represents the default chat input.
// This is very simple for now, but we can make
// it fancier by using a stack and more types
export type Focus = "filter" | null;

export type _State = {
  accountsInfoMap: I.Map<Common.ConversationIDKey, I.Map<RPCChatTypes.MessageID, Message.ChatRequestInfo | Message.ChatPaymentInfo>>,
  badgeMap: ConversationCountMap,
  editingMap: I.Map<Common.ConversationIDKey, Message.Ordinal>,
  focus: Focus,
  inboxFilter: string,
  inboxHasLoaded: boolean,
  trustedInboxHasLoaded: boolean,
  smallTeamsExpanded: boolean,
  isWalletsNew: boolean,
  messageMap: I.Map<Common.ConversationIDKey, I.Map<Message.Ordinal, Message.Message>>,
  messageOrdinals: I.Map<Common.ConversationIDKey, I.OrderedSet<Message.Ordinal>>,
  metaMap: MetaMap,
  moreToLoadMap: I.Map<Common.ConversationIDKey, boolean>,
  orangeLineMap: I.Map<Common.ConversationIDKey, number>,
  explodingModeLocks: I.Map<Common.ConversationIDKey, number>,
  explodingModes: I.Map<Common.ConversationIDKey, number>,
  quote: QuoteInfo | null,
  selectedConversation: Common.ConversationIDKey,
  staticConfig: StaticConfig | null,
  typingMap: I.Map<Common.ConversationIDKey, I.Set<string>>,
  unreadMap: ConversationCountMap,
  unfurlPromptMap: I.Map<Common.ConversationIDKey, I.Map<Message.MessageID, I.Set<string>>>,
  giphyWindowMap: I.Map<Common.ConversationIDKey, boolean>,
  giphyResultMap: I.Map<Common.ConversationIDKey, Array<RPCChatTypes.GiphySearchResult> | null>,
  pendingOutboxToOrdinal: I.Map<Common.ConversationIDKey, I.Map<Message.OutboxID, Message.Ordinal>>,
  pendingMode: PendingMode,
  pendingStatus: PendingStatus,
  attachmentFullscreenMessage: Message.Message | null,
  paymentConfirmInfo: PaymentConfirmInfo | null,
  paymentStatusMap: I.Map<Wallet.PaymentID, Message.ChatPaymentInfo>,
  unsentTextMap: I.Map<Common.ConversationIDKey, HiddenString | null>,
  flipStatusMap: I.Map<string, RPCChatTypes.UICoinFlipStatus>,
  commandMarkdownMap: I.Map<Common.ConversationIDKey, RPCChatTypes.UICommandMarkdown>
} & TeamBuildingTypes.TeamBuildingSubState;

export type State = I.RecordOf<_State>;

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Common.ConversationIDKey => Common.stringToConversationIDKey(conversationID.toString('hex'))

export const keyToConversationID = (key: Common.ConversationIDKey): RPCChatTypes.ConversationID => Buffer.from(Common.conversationIDKeyToString(key), 'hex')

export const rpcOutboxIDToOutboxID = (outboxID: RPCChatTypes.OutboxID): Message.OutboxID => Message.stringToOutboxID(outboxID.toString('hex'))

export const outboxIDToRpcOutboxID = (outboxID: Message.OutboxID): RPCChatTypes.OutboxID => Buffer.from(Message.outboxIDToString(outboxID), 'hex')

export { ConversationMeta, MetaTrustedState, NotificationsType } from './meta';
export { AttachmentType, ChatPaymentInfo, ChatRequestInfo, DecoratedMessage, MentionsAt, MentionsChannel, MentionsChannelName, Message, MessageAttachment, MessageExplodeDescription, MessageID, MessageRequestPayment, MessageSendPayment, MessageSetChannelname, MessageSetDescription, MessageSystemAddedToTeam, MessageSystemChangeRetention, MessageSystemGitPush, MessageSystemInviteAccepted, MessageSystemJoined, MessageSystemLeft, MessageSystemSimpleToComplex, MessageSystemText, MessageSystemUsersAddedToConversation, MessageText, MessageType, Ordinal, OutboxID, PathAndOutboxID, PreviewSpec, Reaction, Reactions } from './message';
export { ConversationIDKey } from './common';

export {
  messageIDToNumber,
  numberToMessageID,
  numberToOrdinal,
  ordinalToNumber,
  outboxIDToString,
  stringToOutboxID,
} from './message'
export {stringToConversationIDKey, conversationIDKeyToString} from './common'
