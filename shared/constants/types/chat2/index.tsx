import * as RPCChatTypes from '../rpc-chat-gen'
import * as RPCTypes from '../rpc-gen'
import * as I from 'immutable'
import * as Common from './common'
import * as Meta from './meta'
import * as Message from './message'
import * as Wallet from '../wallets'
import * as TeamBuildingTypes from '../team-building'
import HiddenString from '../../../util/hidden-string'

export type QuoteInfo = {
  // Always positive and monotonically increasing.
  counter: number
  ordinal: Message.Ordinal
  sourceConversationIDKey: Common.ConversationIDKey
  targetConversationIDKey: Common.ConversationIDKey
}

export type PaymentConfirmInfo = {
  error?: RPCTypes.Status
  summary?: RPCChatTypes.UIChatPaymentSummary
}

// Static config data we use for various things
export type StaticConfig = {
  deletableByDeleteHistory: Set<Message.MessageType>
  builtinCommands: {
    [K in RPCChatTypes.ConversationBuiltinCommandTyp]: Array<RPCChatTypes.ConversationCommand>
  }
}

export type MetaMap = Map<Common.ConversationIDKey, Meta.ConversationMeta>
export type ConversationCountMap = Map<Common.ConversationIDKey, number>

export type ThreadSearchStatus = 'initial' | 'inprogress' | 'done'

export type ThreadSearchInfo = {
  status: ThreadSearchStatus
  hits: Array<Message.Message>
  visible: boolean
}

export type InboxSearchStatus = 'initial' | 'inprogress' | 'success' | 'error'

export type InboxSearchTextHit = {
  conversationIDKey: Common.ConversationIDKey
  name: string
  numHits: number
  query: string
  teamType: 'big' | 'small'
  time: number
}

export type InboxSearchConvHit = {
  conversationIDKey: Common.ConversationIDKey
  name: string
  teamType: 'big' | 'small'
}

export type InboxSearchInfo = {
  indexPercent: number
  nameResults: Array<InboxSearchConvHit>
  nameStatus: InboxSearchStatus
  nameResultsUnread: boolean
  query: HiddenString
  selectedIndex: number
  textResults: Array<InboxSearchTextHit>
  textStatus: InboxSearchStatus
}

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

export type AttachmentViewStatus = 'loading' | 'success' | 'error'

export type AttachmentViewInfo = {
  status: AttachmentViewStatus
  messages: Array<Message.Message>
  last: boolean
}

export type AttachmentFullscreenSelection = {
  autoPlay: boolean
  message: Message.Message
}

export type CommandStatusInfo = {
  displayText: string
  displayType: RPCChatTypes.UICommandStatusDisplayTyp
  actions: Array<RPCChatTypes.UICommandStatusActionTyp>
}

export type UserReacjis = {
  topReacjis: Array<string>
  skinTone: number
}

export type Coordinate = {
  accuracy: number
  lat: number
  lon: number
}

export type State = Readonly<{
  accountsInfoMap: Map<
    Common.ConversationIDKey,
    Map<RPCChatTypes.MessageID, Message.ChatRequestInfo | Message.ChatPaymentInfo>
  > // temp cache for requestPayment and sendPayment message data,
  attachmentFullscreenSelection?: AttachmentFullscreenSelection
  attachmentViewMap: Map<Common.ConversationIDKey, Map<RPCChatTypes.GalleryItemTyp, AttachmentViewInfo>>
  badgeMap: ConversationCountMap // id to the badge count,
  botCommandsUpdateStatusMap: Map<Common.ConversationIDKey, RPCChatTypes.UIBotCommandsUpdateStatus>
  channelSearchText: string
  commandMarkdownMap: Map<Common.ConversationIDKey, RPCChatTypes.UICommandMarkdown>
  commandStatusMap: Map<Common.ConversationIDKey, CommandStatusInfo>
  containsLatestMessageMap: Map<Common.ConversationIDKey, boolean>
  createConversationError: string | null
  dismissedInviteBannersMap: Map<Common.ConversationIDKey, boolean>
  draftMap: Map<Common.ConversationIDKey, string>
  editingMap: Map<Common.ConversationIDKey, Message.Ordinal> // current message being edited,
  explodingModeLocks: Map<Common.ConversationIDKey, number> // locks set on exploding mode while user is inputting text,
  explodingModes: Map<Common.ConversationIDKey, number> // seconds to exploding message expiration,
  flipStatusMap: Map<string, RPCChatTypes.UICoinFlipStatus>
  focus: Focus
  giphyResultMap: Map<Common.ConversationIDKey, RPCChatTypes.GiphySearchResults>
  giphyWindowMap: Map<Common.ConversationIDKey, boolean>
  inboxHasLoaded: boolean // if we've ever loaded,
  inboxLayout: RPCChatTypes.UIInboxLayout | null // layout of the inbox
  inboxSearch?: InboxSearchInfo
  inboxShowNew: boolean // mark search as new,
  isWalletsNew: boolean // controls new-ness of wallets in chat UI,
  lastCoord?: Coordinate
  maybeMentionMap: Map<string, RPCChatTypes.UIMaybeMentionInfo>
  messageCenterOrdinals: I.Map<Common.ConversationIDKey, CenterOrdinal> // ordinals to center threads on,
  messageMap: I.Map<Common.ConversationIDKey, I.Map<Message.Ordinal, Message.Message>> // messages in a thread,
  messageOrdinals: I.Map<Common.ConversationIDKey, I.OrderedSet<Message.Ordinal>> // ordered ordinals in a thread,
  metaMap: MetaMap // metadata about a thread, There is a special node for the pending conversation,
  moreToLoadMap: Map<Common.ConversationIDKey, boolean> // if we have more data to load,
  mutedMap: Map<Common.ConversationIDKey, boolean> // muted convs
  orangeLineMap: Map<Common.ConversationIDKey, number> // last message we've seen,
  paymentConfirmInfo?: PaymentConfirmInfo // chat payment confirm screen data,
  paymentStatusMap: Map<Wallet.PaymentID, Message.ChatPaymentInfo>
  pendingOutboxToOrdinal: I.Map<Common.ConversationIDKey, I.Map<Message.OutboxID, Message.Ordinal>> // messages waiting to be sent,
  prependTextMap: Map<Common.ConversationIDKey, HiddenString | null>
  previousSelectedConversation: Common.ConversationIDKey // the previous selected conversation, if any,
  quote?: QuoteInfo // last quoted message,
  replyToMap: Map<Common.ConversationIDKey, Message.Ordinal>
  selectedConversation: Common.ConversationIDKey // the selected conversation, if any,
  smallTeamsExpanded: boolean // if we're showing all small teams,
  staticConfig?: StaticConfig // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded,
  teamBuilding: TeamBuildingTypes.TeamBuildingSubState
  threadLoadStatus: Map<Common.ConversationIDKey, RPCChatTypes.UIChatThreadStatus>
  threadSearchInfoMap: Map<Common.ConversationIDKey, ThreadSearchInfo>
  threadSearchQueryMap: Map<Common.ConversationIDKey, HiddenString>
  trustedInboxHasLoaded: boolean // if we've done initial trusted inbox load,
  typingMap: Map<Common.ConversationIDKey, Set<string>> // who's typing currently,
  unfurlPromptMap: Map<Common.ConversationIDKey, Map<Message.MessageID, Set<string>>>
  unreadMap: ConversationCountMap // how many unread messages there are,
  unsentTextMap: Map<Common.ConversationIDKey, HiddenString | undefined>
  userReacjis: UserReacjis
}>

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Common.ConversationIDKey =>
  Common.stringToConversationIDKey(conversationID.toString('hex'))

export const keyToConversationID = (key: Common.ConversationIDKey): RPCChatTypes.ConversationID =>
  Buffer.from(Common.conversationIDKeyToString(key), 'hex')

export const rpcOutboxIDToOutboxID = (outboxID: RPCChatTypes.OutboxID): Message.OutboxID =>
  Message.stringToOutboxID(outboxID.toString('hex'))

export const outboxIDToRpcOutboxID = (outboxID: Message.OutboxID): RPCChatTypes.OutboxID =>
  Buffer.from(Message.outboxIDToString(outboxID), 'hex')

// meta passthroughs
export type ConversationMeta = Meta.ConversationMeta
export type MembershipType = Meta.MembershipType
export type MetaTrustedState = Meta.MetaTrustedState
export type NotificationsType = Meta.NotificationsType
export type TeamType = Meta.TeamType

// message passthroughs
export type AttachmentType = Message.AttachmentType
export type ChatPaymentInfo = Message.ChatPaymentInfo
export type ChatRequestInfo = Message.ChatRequestInfo
export type MessageWithReactionPopup = Message.MessageWithReactionPopup
export type DecoratedMessage = Message.DecoratedMessage
export type MentionsAt = Message.MentionsAt
export type MentionsChannel = Message.MentionsChannel
export type MentionsChannelName = Message.MentionsChannelName
export type Message = Message.Message
export type MessageAttachmentTransferState = Message.MessageAttachmentTransferState
export type MessageAttachment = Message.MessageAttachment
export type MessageExplodeDescription = Message.MessageExplodeDescription
export type MessageID = Message.MessageID
export type MessageRequestPayment = Message.MessageRequestPayment
export type MessageSendPayment = Message.MessageSendPayment
export type MessageSetChannelname = Message.MessageSetChannelname
export type MessageSetDescription = Message.MessageSetDescription
export type MessagePin = Message.MessagePin
export type MessageSystemAddedToTeam = Message.MessageSystemAddedToTeam
export type MessageSystemChangeRetention = Message.MessageSystemChangeRetention
export type MessageSystemGitPush = Message.MessageSystemGitPush
export type MessageSystemInviteAccepted = Message.MessageSystemInviteAccepted
export type MessageSystemJoined = Message.MessageSystemJoined
export type MessageSystemLeft = Message.MessageSystemLeft
export type MessageSystemSBSResolved = Message.MessageSystemSBSResolved
export type MessageSystemSimpleToComplex = Message.MessageSystemSimpleToComplex
export type MessageSystemText = Message.MessageSystemText
export type MessageSystemUsersAddedToConversation = Message.MessageSystemUsersAddedToConversation
export type MessageText = Message.MessageText
export type MessageType = Message.MessageType
export type Ordinal = Message.Ordinal
export type OutboxID = Message.OutboxID
export type PathAndOutboxID = Message.PathAndOutboxID
export type PreviewSpec = Message.PreviewSpec
export type Reaction = Message.Reaction
export type Reactions = Message.Reactions

// common passthroughs
export type ConversationIDKey = Common.ConversationIDKey

export {
  messageIDToNumber,
  numberToMessageID,
  numberToOrdinal,
  ordinalToNumber,
  outboxIDToString,
  stringToOutboxID,
} from './message'
export {stringToConversationIDKey, conversationIDKeyToString} from './common'
