import * as Common from './common'
import * as RPCTypes from '../rpc-gen'
import * as _Message from './message'
import type * as ChatInboxRowTypes from './rowitem'
import type * as Meta from './meta'
import type * as RPCChatTypes from '../rpc-chat-gen'
import type * as Team from '../teams'
import type HiddenString from '../../../util/hidden-string'

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
}

export type InboxSearchInfo = {
  indexPercent: number
  botsResults: Array<RPCTypes.FeaturedBot>
  botsResultsSuggested: boolean
  botsStatus: InboxSearchStatus
  nameResults: Array<InboxSearchConvHit>
  nameResultsUnread: boolean
  nameStatus: InboxSearchStatus
  openTeamsResults: Array<InboxSearchOpenTeamHit>
  openTeamsResultsSuggested: boolean
  openTeamsStatus: InboxSearchStatus
  query: HiddenString
  selectedIndex: number
  textResults: Array<InboxSearchTextHit>
  textStatus: InboxSearchStatus
}

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
  topReacjis: Array<RPCTypes.UserReacji>
  skinTone: RPCTypes.ReacjiSkinTone
}

export type Coordinate = {
  accuracy: number
  lat: number
  lon: number
}

export type BlockButtonsInfo = {
  adder: string
}

export type BotPublicCommands = {
  loadError: boolean
  commands: Array<string>
}

export type CreateConversationError = {
  allowedUsers: Array<string>
  code: number
  disallowedUsers: Array<string>
  message: string
}

export type ParticipantInfo = {
  all: Array<string> // all member usernames, including bots
  name: Array<string> // member usernames not including bots
  contactName: Map<string, string> // member username -> contact name
}

// Corresponds to skinTones in emoji-datasource.
export type EmojiSkinTone = '1F3FA' | '1F3FB' | '1F3FC' | '1F3FD' | '1F3FE' | '1F3FF'

export const EmojiSkinToneToRPC = (emojiSkinTone: undefined | EmojiSkinTone): RPCTypes.ReacjiSkinTone => {
  switch (emojiSkinTone) {
    case undefined:
    case '1F3FA':
      return RPCTypes.ReacjiSkinTone.none
    case '1F3FB':
      return RPCTypes.ReacjiSkinTone.skintone1
    case '1F3FC':
      return RPCTypes.ReacjiSkinTone.skintone2
    case '1F3FD':
      return RPCTypes.ReacjiSkinTone.skintone3
    case '1F3FE':
      return RPCTypes.ReacjiSkinTone.skintone4
    case '1F3FF':
      return RPCTypes.ReacjiSkinTone.skintone5
  }
}

export const EmojiSkinToneFromRPC = (reacjiSkinTone: RPCTypes.ReacjiSkinTone): undefined | EmojiSkinTone => {
  switch (reacjiSkinTone) {
    case RPCTypes.ReacjiSkinTone.none:
      return undefined
    case RPCTypes.ReacjiSkinTone.skintone1:
      return '1F3FB'
    case RPCTypes.ReacjiSkinTone.skintone2:
      return '1F3FC'
    case RPCTypes.ReacjiSkinTone.skintone3:
      return '1F3FD'
    case RPCTypes.ReacjiSkinTone.skintone4:
      return '1F3FE'
    case RPCTypes.ReacjiSkinTone.skintone5:
      return '1F3FF'
  }
}

export const SkinToneToDotColor = (skinTone: undefined | EmojiSkinTone): string => {
  switch (skinTone) {
    case undefined:
    case '1F3FA':
      return '#ffc93a'
    case '1F3FB':
      return '#fadcbc'
    case '1F3FC':
      return '#e1bb95'
    case '1F3FD':
      return '#bf9068'
    case '1F3FE':
      return '#9b643d'
    case '1F3FF':
      return '#5a4539'
  }
}

export type RenderMessageType =
  | _Message.MessageType
  | 'attachment:image'
  | 'attachment:audio'
  | 'attachment:file'
  | 'attachment:video'

export type State = {
  accountsInfoMap: Map<
    Common.ConversationIDKey,
    Map<RPCChatTypes.MessageID, _Message.ChatRequestInfo | _Message.ChatPaymentInfo>
  > // temp cache for requestPayment and sendPayment message data,
  attachmentViewMap: Map<Common.ConversationIDKey, Map<RPCChatTypes.GalleryItemTyp, AttachmentViewInfo>>
  badgeMap: ConversationCountMap // id to the badge count,
  blockButtonsMap: Map<RPCTypes.TeamID, BlockButtonsInfo> // Should we show block buttons for this team ID?
  botCommandsUpdateStatusMap: Map<Common.ConversationIDKey, RPCChatTypes.UIBotCommandsUpdateStatusTyp>
  botPublicCommands: Map<string, BotPublicCommands>
  botSettings: Map<Common.ConversationIDKey, Map<string, RPCTypes.TeamBotSettings>>
  botTeamRoleInConvMap: Map<Common.ConversationIDKey, Map<string, Team.TeamRoleType | undefined>>
  commandMarkdownMap: Map<Common.ConversationIDKey, RPCChatTypes.UICommandMarkdown>
  commandStatusMap: Map<Common.ConversationIDKey, CommandStatusInfo>
  containsLatestMessageMap: Map<Common.ConversationIDKey, boolean>
  dismissedInviteBannersMap: Map<Common.ConversationIDKey, boolean>
  draftMap: Map<Common.ConversationIDKey, string>
  editingMap: Map<Common.ConversationIDKey, _Message.Ordinal> // current message being edited,
  explodingModeLocks: Map<Common.ConversationIDKey, number> // locks set on exploding mode while user is inputting text,
  explodingModes: Map<Common.ConversationIDKey, number> // seconds to exploding message expiration,
  flipStatusMap: Map<string, RPCChatTypes.UICoinFlipStatus>
  giphyResultMap: Map<Common.ConversationIDKey, RPCChatTypes.GiphySearchResults | undefined>
  giphyWindowMap: Map<Common.ConversationIDKey, boolean>
  hasZzzJourneycard: Map<Common.ConversationIDKey, MessageJourneycard>
  shouldDeleteZzzJourneycard: Map<Common.ConversationIDKey, MessageJourneycard> // messages scheduled for deletion
  inboxNumSmallRows?: number
  inboxHasLoaded: boolean // if we've ever loaded,
  inboxLayout?: RPCChatTypes.UIInboxLayout // layout of the inbox
  inboxSearch?: InboxSearchInfo
  infoPanelShowing: boolean
  infoPanelSelectedTab?: 'settings' | 'members' | 'attachments' | 'bots'
  maybeMentionMap: Map<string, RPCChatTypes.UIMaybeMentionInfo>
  messageCenterOrdinals: Map<Common.ConversationIDKey, CenterOrdinal> // ordinals to center threads on,
  messageMap: Map<Common.ConversationIDKey, Map<_Message.Ordinal, _Message.Message>> // messages in a thread,
  messageTypeMap: Map<Common.ConversationIDKey, Map<_Message.Ordinal, RenderMessageType>> // messages types to help the thread, text is never used
  messageOrdinals: Map<Common.ConversationIDKey, Array<_Message.Ordinal>> // ordered ordinals in a thread,
  metaMap: MetaMap // metadata about a thread, There is a special node for the pending conversation,
  moreToLoadMap: Map<Common.ConversationIDKey, boolean> // if we have more data to load,
  mutedMap: Map<Common.ConversationIDKey, boolean> // muted convs
  mutualTeamMap: Map<Common.ConversationIDKey, Array<Team.TeamID>>
  orangeLineMap: Map<Common.ConversationIDKey, number> // last message we've seen,
  markedAsUnreadMap: Map<Common.ConversationIDKey, boolean> // store a bit if we've marked this thread as unread so we don't mark as read when navgiating away
  participantMap: Map<Common.ConversationIDKey, ParticipantInfo>
  pendingOutboxToOrdinal: Map<Common.ConversationIDKey, Map<_Message.OutboxID, _Message.Ordinal>> // messages waiting to be sent,
  replyToMap: Map<Common.ConversationIDKey, _Message.Ordinal>
  smallTeamsExpanded: boolean // if we're showing all small teams,
  teamIDToGeneralConvID: Map<Team.TeamID, Common.ConversationIDKey>
  threadLoadStatus: Map<Common.ConversationIDKey, RPCChatTypes.UIChatThreadStatus>
  threadSearchInfoMap: Map<Common.ConversationIDKey, ThreadSearchInfo>
  threadSearchQueryMap: Map<Common.ConversationIDKey, HiddenString>
  trustedInboxHasLoaded: boolean // if we've done initial trusted inbox load,
  unfurlPromptMap: Map<Common.ConversationIDKey, Map<_Message.MessageID, Set<string>>>
  unreadMap: ConversationCountMap // how many unread messages there are,
  unsentTextMap: Map<Common.ConversationIDKey, HiddenString | undefined>
  userReacjis: UserReacjis
  userEmojis?: RPCChatTypes.EmojiGroup[]
  userEmojisForAutocomplete?: Array<RPCChatTypes.Emoji>
}

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Common.ConversationIDKey =>
  Common.stringToConversationIDKey(Buffer.from(conversationID).toString('hex'))

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
export type MessageSystemNewChannel = _Message.MessageSystemNewChannel
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
export type ReactionDesc = _Message.ReactionDesc

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

export type ChatInboxRowItemSmall = ChatInboxRowTypes.ChatInboxRowItemSmall
export type ChatInboxRowItemBigTeamsLabel = ChatInboxRowTypes.ChatInboxRowItemBigTeamsLabel
export type ChatInboxRowItemBigHeader = ChatInboxRowTypes.ChatInboxRowItemBigHeader
export type ChatInboxRowItemBig = ChatInboxRowTypes.ChatInboxRowItemBig
export type ChatInboxRowItemDivider = ChatInboxRowTypes.ChatInboxRowItemDivider
export type ChatInboxRowItemTeamBuilder = ChatInboxRowTypes.ChatInboxRowItemTeamBuilder
export type ChatInboxRowItem = ChatInboxRowTypes.ChatInboxRowItem
export type ChatInboxRowType = ChatInboxRowTypes.ChatInboxRowType
