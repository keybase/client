import * as RPCChatTypes from '../rpc-chat-gen'
import * as RPCTypes from '../rpc-gen'
import * as Common from './common'
import * as Meta from './meta'
import * as Message from './message'
import * as Wallet from '../wallets'
import * as TeamBuildingTypes from '../team-building'
import * as Team from '../teams'
import HiddenString from '../../../util/hidden-string'
import {AmpTracker} from '../../../chat/audio/amptracker'

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

export type State = {
  readonly accountsInfoMap: Map<
    Common.ConversationIDKey,
    Map<RPCChatTypes.MessageID, Message.ChatRequestInfo | Message.ChatPaymentInfo>
  > // temp cache for requestPayment and sendPayment message data,
  readonly attachmentViewMap: Map<
    Common.ConversationIDKey,
    Map<RPCChatTypes.GalleryItemTyp, AttachmentViewInfo>
  >
  readonly audioRecording: Map<Common.ConversationIDKey, AudioRecordingInfo>
  readonly badgeMap: ConversationCountMap // id to the badge count,
  readonly blockButtonsMap: Map<RPCTypes.TeamID, BlockButtonsInfo> // Should we show block buttons for this team ID?
  readonly botCommandsUpdateStatusMap: Map<
    Common.ConversationIDKey,
    RPCChatTypes.UIBotCommandsUpdateStatusTyp
  >
  readonly botPublicCommands: Map<string, BotPublicCommands>
  readonly botSearchResults?: BotSearchResults
  readonly botSettings: Map<Common.ConversationIDKey, Map<string, RPCTypes.TeamBotSettings>>
  readonly botTeamRoleInConvMap: Map<Common.ConversationIDKey, Map<string, Team.TeamRoleType | null>>
  readonly channelSearchText: string
  readonly commandMarkdownMap: Map<Common.ConversationIDKey, RPCChatTypes.UICommandMarkdown>
  readonly commandStatusMap: Map<Common.ConversationIDKey, CommandStatusInfo>
  readonly containsLatestMessageMap: Map<Common.ConversationIDKey, boolean>
  readonly createConversationError: CreateConversationError | null
  readonly dismissedInviteBannersMap: Map<Common.ConversationIDKey, boolean>
  readonly draftMap: Map<Common.ConversationIDKey, string>
  readonly editingMap: Map<Common.ConversationIDKey, Message.Ordinal> // current message being edited,
  readonly explodingModeLocks: Map<Common.ConversationIDKey, number> // locks set on exploding mode while user is inputting text,
  readonly explodingModes: Map<Common.ConversationIDKey, number> // seconds to exploding message expiration,
  readonly featuredBotsMap: Map<string, RPCTypes.FeaturedBot>
  readonly featuredBotsPage: number
  readonly featuredBotsLoaded: boolean
  readonly flipStatusMap: Map<string, RPCChatTypes.UICoinFlipStatus>
  readonly focus: Focus
  readonly giphyResultMap: Map<Common.ConversationIDKey, RPCChatTypes.GiphySearchResults | undefined>
  readonly giphyWindowMap: Map<Common.ConversationIDKey, boolean>
  readonly inboxNumSmallRows?: number
  readonly inboxHasLoaded: boolean // if we've ever loaded,
  readonly inboxLayout: RPCChatTypes.UIInboxLayout | null // layout of the inbox
  readonly inboxSearch?: InboxSearchInfo
  readonly inboxShowNew: boolean // mark search as new,
  readonly infoPanelShowing: boolean
  readonly infoPanelSelectedTab: 'settings' | 'members' | 'attachments' | 'bots' | undefined
  readonly isWalletsNew: boolean // controls new-ness of wallets in chat UI,
  readonly lastCoord?: Coordinate
  readonly maybeMentionMap: Map<string, RPCChatTypes.UIMaybeMentionInfo>
  readonly messageCenterOrdinals: Map<Common.ConversationIDKey, CenterOrdinal> // ordinals to center threads on,
  readonly messageMap: Map<Common.ConversationIDKey, Map<Message.Ordinal, Message.Message>> // messages in a thread,
  readonly messageOrdinals: Map<Common.ConversationIDKey, Set<Message.Ordinal>> // ordered ordinals in a thread,
  readonly metaMap: MetaMap // metadata about a thread, There is a special node for the pending conversation,
  readonly moreToLoadMap: Map<Common.ConversationIDKey, boolean> // if we have more data to load,
  readonly mutedMap: Map<Common.ConversationIDKey, boolean> // muted convs
  readonly orangeLineMap: Map<Common.ConversationIDKey, number> // last message we've seen,
  readonly participantMap: Map<Common.ConversationIDKey, ParticipantInfo>
  readonly paymentConfirmInfo?: PaymentConfirmInfo // chat payment confirm screen data,
  readonly paymentStatusMap: Map<Wallet.PaymentID, Message.ChatPaymentInfo>
  readonly pendingOutboxToOrdinal: Map<Common.ConversationIDKey, Map<Message.OutboxID, Message.Ordinal>> // messages waiting to be sent,
  readonly prependTextMap: Map<Common.ConversationIDKey, HiddenString | null>
  readonly previousSelectedConversation: Common.ConversationIDKey // the previous selected conversation, if any,
  readonly quote?: QuoteInfo // last quoted message,
  readonly replyToMap: Map<Common.ConversationIDKey, Message.Ordinal>
  readonly selectedConversation: Common.ConversationIDKey // the selected conversation, if any,
  readonly smallTeamsExpanded: boolean // if we're showing all small teams,
  readonly staticConfig?: StaticConfig // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded,
  readonly teamBuilding: TeamBuildingTypes.TeamBuildingSubState
  readonly teamIDToGeneralConvID: Map<Team.TeamID, Common.ConversationIDKey>
  readonly threadLoadStatus: Map<Common.ConversationIDKey, RPCChatTypes.UIChatThreadStatus>
  readonly threadSearchInfoMap: Map<Common.ConversationIDKey, ThreadSearchInfo>
  readonly threadSearchQueryMap: Map<Common.ConversationIDKey, HiddenString>
  readonly trustedInboxHasLoaded: boolean // if we've done initial trusted inbox load,
  readonly typingMap: Map<Common.ConversationIDKey, Set<string>> // who's typing currently,
  readonly unfurlPromptMap: Map<Common.ConversationIDKey, Map<Message.MessageID, Set<string>>>
  readonly unreadMap: ConversationCountMap // how many unread messages there are,
  readonly unsentTextMap: Map<Common.ConversationIDKey, HiddenString | undefined>
  readonly userReacjis: UserReacjis
}

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
export type MessagesWithReactions = Message.MessagesWithReactions
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
export type MessageSystemCreateTeam = Message.MessageSystemCreateTeam
export type MessageSystemChangeRetention = Message.MessageSystemChangeRetention
export type MessageSystemGitPush = Message.MessageSystemGitPush
export type MessageSystemInviteAccepted = Message.MessageSystemInviteAccepted
export type MessageSystemJoined = Message.MessageSystemJoined
export type MessageSystemLeft = Message.MessageSystemLeft
export type MessageSystemSBSResolved = Message.MessageSystemSBSResolved
export type MessageSystemSimpleToComplex = Message.MessageSystemSimpleToComplex
export type MessageSystemText = Message.MessageSystemText
export type MessageSystemUsersAddedToConversation = Message.MessageSystemUsersAddedToConversation
export type MessageSystemChangeAvatar = Message.MessageSystemChangeAvatar
export type MessageJourneycard = Message.MessageJourneycard
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
