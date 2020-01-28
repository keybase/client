import * as RPCChatTypes from '../rpc-chat-gen'
import * as RPCTypes from '../rpc-gen'
import * as Common from './common'
import * as Meta from './meta'
import * as _Message from './message'
import * as Wallet from '../wallets'
import * as TeamBuildingTypes from '../team-building'
import * as Team from '../teams'
import HiddenString from '../../../util/hidden-string'
import {AmpTracker} from '../../../chat/audio/amptracker'

export type QuoteInfo = {
  // Always positive and monotonically increasing.
  counter: number
  ordinal: _Message.Ordinal
  sourceConversationIDKey: Common.ConversationIDKey
  targetConversationIDKey: Common.ConversationIDKey
}

export type PaymentConfirmInfo = {
  error?: RPCTypes.Status
  summary?: RPCChatTypes.UIChatPaymentSummary
}

// Static config data we use for various things
export type StaticConfig = {
  deletableByDeleteHistory: Set<_Message.MessageType>
  builtinCommands: {
    [K in RPCChatTypes.ConversationBuiltinCommandTyp]: Array<RPCChatTypes.ConversationCommand>
  }
}

export type MetaMap = Map<Common.ConversationIDKey, Meta.ConversationMeta>
export type ConversationCountMap = Map<Common.ConversationIDKey, number>

export type ThreadSearchStatus = 'initial' | 'inprogress' | 'done'

export type ThreadSearchInfo = {
  status: ThreadSearchStatus
  hits: Array<_Message.Message>
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

export type InboxSearchOpenTeamHit = {
  description: string
  inTeam: boolean
  name: string
  memberCount: number
  publicAdmins: Array<string>
  id: Team.TeamID
}

export type InboxSearchInfo = {
  indexPercent: number
  nameResults: Array<InboxSearchConvHit>
  nameStatus: InboxSearchStatus
  nameResultsUnread: boolean
  openTeamsResults: Array<InboxSearchOpenTeamHit>
  openTeamsStatus: InboxSearchStatus
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
  ordinal: _Message.Ordinal
  highlightMode: CenterOrdinalHighlightMode
}

export type AttachmentViewStatus = 'loading' | 'success' | 'error'

export type AttachmentViewInfo = {
  status: AttachmentViewStatus
  messages: Array<_Message.Message>
  last: boolean
}

export type AttachmentFullscreenSelection = {
  autoPlay: boolean
  message: _Message.Message
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

export enum AudioRecordingStatus {
  INITIAL = 0,
  RECORDING,
  STAGED,
  STOPPED,
  CANCELLED,
}

export enum AudioStopType {
  CANCEL = 0,
  RELEASE,
  SEND,
  STOPBUTTON,
}

export type AudioRecordingInfo = {
  status: AudioRecordingStatus
  outboxID: Buffer
  path: string
  recordEnd?: number
  recordStart: number
  isLocked: boolean
  amps?: AmpTracker
}

export type BlockButtonsInfo = {
  adder: string
}

export type BotPublicCommands = {
  loadError: boolean
  commands: Array<string>
}

export type BotSearchResults = {
  bots: Array<RPCTypes.FeaturedBot>
  users: Array<string>
}

export type CreateConversationError = {
  allowedUsers: Array<string>
  code: number
  disallowedUsers: Array<string>
  message: string
}

export type ParticipantInfo = {
  all: Array<string>
  name: Array<string>
  contactName: Map<string, string>
}

export type State = Readonly<{
  accountsInfoMap: Map<
    Common.ConversationIDKey,
    Map<RPCChatTypes.MessageID, _Message.ChatRequestInfo | _Message.ChatPaymentInfo>
  > // temp cache for requestPayment and sendPayment message data,
  attachmentViewMap: Map<Common.ConversationIDKey, Map<RPCChatTypes.GalleryItemTyp, AttachmentViewInfo>>
  audioRecording: Map<Common.ConversationIDKey, AudioRecordingInfo>
  badgeMap: ConversationCountMap // id to the badge count,
  blockButtonsMap: Map<RPCTypes.TeamID, BlockButtonsInfo> // Should we show block buttons for this team ID?
  botCommandsUpdateStatusMap: Map<Common.ConversationIDKey, RPCChatTypes.UIBotCommandsUpdateStatusTyp>
  botPublicCommands: Map<string, BotPublicCommands>
  botSearchResults?: BotSearchResults
  botSettings: Map<Common.ConversationIDKey, Map<string, RPCTypes.TeamBotSettings>>
  botTeamRoleInConvMap: Map<Common.ConversationIDKey, Map<string, Team.TeamRoleType | null>>
  channelSearchText: string
  commandMarkdownMap: Map<Common.ConversationIDKey, RPCChatTypes.UICommandMarkdown>
  commandStatusMap: Map<Common.ConversationIDKey, CommandStatusInfo>
  containsLatestMessageMap: Map<Common.ConversationIDKey, boolean>
  createConversationError: CreateConversationError | null
  dismissedInviteBannersMap: Map<Common.ConversationIDKey, boolean>
  draftMap: Map<Common.ConversationIDKey, string>
  editingMap: Map<Common.ConversationIDKey, _Message.Ordinal> // current message being edited,
  explodingModeLocks: Map<Common.ConversationIDKey, number> // locks set on exploding mode while user is inputting text,
  explodingModes: Map<Common.ConversationIDKey, number> // seconds to exploding message expiration,
  featuredBotsMap: Map<string, RPCTypes.FeaturedBot>
  featuredBotsPage: number
  featuredBotsLoaded: boolean
  flipStatusMap: Map<string, RPCChatTypes.UICoinFlipStatus>
  focus: Focus
  giphyResultMap: Map<Common.ConversationIDKey, RPCChatTypes.GiphySearchResults | undefined>
  giphyWindowMap: Map<Common.ConversationIDKey, boolean>
  inboxNumSmallRows?: number
  inboxHasLoaded: boolean // if we've ever loaded,
  inboxLayout: RPCChatTypes.UIInboxLayout | null // layout of the inbox
  inboxSearch?: InboxSearchInfo
  inboxShowNew: boolean // mark search as new,
  infoPanelShowing: boolean
  infoPanelSelectedTab: 'settings' | 'members' | 'attachments' | 'bots' | undefined
  isWalletsNew: boolean // controls new-ness of wallets in chat UI,
  lastCoord?: Coordinate
  maybeMentionMap: Map<string, RPCChatTypes.UIMaybeMentionInfo>
  messageCenterOrdinals: Map<Common.ConversationIDKey, CenterOrdinal> // ordinals to center threads on,
  messageMap: Map<Common.ConversationIDKey, Map<_Message.Ordinal, _Message.Message>> // messages in a thread,
  messageOrdinals: Map<Common.ConversationIDKey, Set<_Message.Ordinal>> // ordered ordinals in a thread,
  metaMap: MetaMap // metadata about a thread, There is a special node for the pending conversation,
  moreToLoadMap: Map<Common.ConversationIDKey, boolean> // if we have more data to load,
  mutedMap: Map<Common.ConversationIDKey, boolean> // muted convs
  orangeLineMap: Map<Common.ConversationIDKey, number> // last message we've seen,
  participantMap: Map<Common.ConversationIDKey, ParticipantInfo>
  paymentConfirmInfo?: PaymentConfirmInfo // chat payment confirm screen data,
  paymentStatusMap: Map<Wallet.PaymentID, _Message.ChatPaymentInfo>
  pendingOutboxToOrdinal: Map<Common.ConversationIDKey, Map<_Message.OutboxID, _Message.Ordinal>> // messages waiting to be sent,
  prependTextMap: Map<Common.ConversationIDKey, HiddenString | null>
  previousSelectedConversation: Common.ConversationIDKey // the previous selected conversation, if any,
  quote?: QuoteInfo // last quoted message,
  replyToMap: Map<Common.ConversationIDKey, _Message.Ordinal>
  selectedConversation: Common.ConversationIDKey // the selected conversation, if any,
  smallTeamsExpanded: boolean // if we're showing all small teams,
  staticConfig?: StaticConfig // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded,
  teamBuilding: TeamBuildingTypes.TeamBuildingSubState
  teamIDToGeneralConvID: Map<Team.TeamID, Common.ConversationIDKey>
  threadLoadStatus: Map<Common.ConversationIDKey, RPCChatTypes.UIChatThreadStatus>
  threadSearchInfoMap: Map<Common.ConversationIDKey, ThreadSearchInfo>
  threadSearchQueryMap: Map<Common.ConversationIDKey, HiddenString>
  trustedInboxHasLoaded: boolean // if we've done initial trusted inbox load,
  typingMap: Map<Common.ConversationIDKey, Set<string>> // who's typing currently,
  unfurlPromptMap: Map<Common.ConversationIDKey, Map<_Message.MessageID, Set<string>>>
  unreadMap: ConversationCountMap // how many unread messages there are,
  unsentTextMap: Map<Common.ConversationIDKey, HiddenString | undefined>
  userReacjis: UserReacjis
}>

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Common.ConversationIDKey =>
  Common.stringToConversationIDKey(conversationID.toString('hex'))

export const keyToConversationID = (key: Common.ConversationIDKey): RPCChatTypes.ConversationID =>
  Buffer.from(Common.conversationIDKeyToString(key), 'hex')

export const rpcOutboxIDToOutboxID = (outboxID: RPCChatTypes.OutboxID): _Message.OutboxID =>
  _Message.stringToOutboxID(outboxID.toString('hex'))

export const outboxIDToRpcOutboxID = (outboxID: _Message.OutboxID): RPCChatTypes.OutboxID =>
  Buffer.from(_Message.outboxIDToString(outboxID), 'hex')

// meta passthroughs
export type ConversationMeta = Meta.ConversationMeta
export type MembershipType = Meta.MembershipType
export type MetaTrustedState = Meta.MetaTrustedState
export type NotificationsType = Meta.NotificationsType
export type TeamType = Meta.TeamType

// message passthroughs
export type AttachmentType = _Message.AttachmentType
export type ChatPaymentInfo = _Message.ChatPaymentInfo
export type ChatRequestInfo = _Message.ChatRequestInfo
export type MessagesWithReactions = _Message.MessagesWithReactions
export type MentionsAt = _Message.MentionsAt
export type MentionsChannel = _Message.MentionsChannel
export type MentionsChannelName = _Message.MentionsChannelName
export type Message = _Message.Message
export type MessageAttachmentTransferState = _Message.MessageAttachmentTransferState
export type MessageAttachment = _Message.MessageAttachment
export type MessageExplodeDescription = _Message.MessageExplodeDescription
export type MessageID = _Message.MessageID
export type MessageRequestPayment = _Message.MessageRequestPayment
export type MessageSendPayment = _Message.MessageSendPayment
export type MessageSetChannelname = _Message.MessageSetChannelname
export type MessageSetDescription = _Message.MessageSetDescription
export type MessagePin = _Message.MessagePin
export type MessageSystemAddedToTeam = _Message.MessageSystemAddedToTeam
export type MessageSystemCreateTeam = _Message.MessageSystemCreateTeam
export type MessageSystemChangeRetention = _Message.MessageSystemChangeRetention
export type MessageSystemGitPush = _Message.MessageSystemGitPush
export type MessageSystemInviteAccepted = _Message.MessageSystemInviteAccepted
export type MessageSystemJoined = _Message.MessageSystemJoined
export type MessageSystemLeft = _Message.MessageSystemLeft
export type MessageSystemSBSResolved = _Message.MessageSystemSBSResolved
export type MessageSystemSimpleToComplex = _Message.MessageSystemSimpleToComplex
export type MessageSystemText = _Message.MessageSystemText
export type MessageSystemUsersAddedToConversation = _Message.MessageSystemUsersAddedToConversation
export type MessageSystemChangeAvatar = _Message.MessageSystemChangeAvatar
export type MessageJourneycard = _Message.MessageJourneycard
export type MessageText = _Message.MessageText
export type MessageType = _Message.MessageType
export type Ordinal = _Message.Ordinal
export type OutboxID = _Message.OutboxID
export type PathAndOutboxID = _Message.PathAndOutboxID
export type PreviewSpec = _Message.PreviewSpec
export type Reaction = _Message.Reaction
export type Reactions = _Message.Reactions

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
