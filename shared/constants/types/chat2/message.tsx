// Types related to a message
import * as Common from './common'
import * as RPCTypes from '../rpc-gen'
import * as RPCChatTypes from '../rpc-chat-gen'
import * as RPCStellarTypes from '../rpc-stellar-gen'
import * as WalletTypes from '../wallets'
import * as I from 'immutable'
import HiddenString from '../../../util/hidden-string'
import {DeviceType} from '../devices'

// The actual ID the server uses for operations (edit, delete etc)
export type MessageID = number
export const numberToMessageID = (n: number): MessageID => n
export const messageIDToNumber = (n: MessageID): number => n

export type _Reaction = {
  timestamp: number
  username: string
}
export type Reaction = I.RecordOf<_Reaction>
export type Reactions = I.Map<string, I.Set<Reaction>>

export type UnfurlMap = I.Map<string, RPCChatTypes.UIMessageUnfurlInfo>

// We use the ordinal as the primary ID throughout the UI. The reason we have this vs a messageID is
// 1. We don't have messageIDs for messages we're trying to send (pending messages)
// 2. When a message is sent we want to maintain the order of it from our perspective, even though we might have gotten newer messages before it actually went through. In order to make this work we keep the ordinal as-is even though we actually do get a real messageID.
// The ordinals for existing messages is usually 1:1 to message ids. Ordinals for pending messages are fractional increments of the last message we've seen
//
// ex:
// chris: Hi (id: 100, ordinal: 100)
// danny: Hey (id: 101, ordinal: 101)
// chris: this isn't sent yet (id: 0, ordinal: 101.001)
// danny: Are you there? (id: 102, ordinal: 102)
// (later we get an ordinal of 103, so it'll be (id: 103, ordinal: 101.001). We keep the ordinal so our list doesn't re-order itself from our perspective. On a later
// load it will be 100, 101, 102, 103 and be chris, danny, danny, chris
export type Ordinal = number
export const numberToOrdinal = (n: number): Ordinal => n
export const ordinalToNumber = (o: Ordinal): number => o

export type OutboxID = string
export const stringToOutboxID = (s: string): OutboxID => s
export const outboxIDToString = (o: OutboxID): string => o

export type MentionsAt = I.Set<string>
export type MentionsChannel = 'none' | 'all' | 'here'
export type MentionsChannelName = I.Map<string, Common.ConversationIDKey>

export type MessageExplodeDescription = {
  text: string
  seconds: number
}

export type PathAndOutboxID = {
  path: string
  outboxID: RPCChatTypes.OutboxID | null
}

type _MessageCommon = {
  author: string
  id: MessageID
  ordinal: Ordinal
}

// Message types have a lot of copy and paste. Originally I had this split out but this
// causes flow to get confused or makes the error messages a million times harder to understand

export type _MessagePlaceholder = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  timestamp: number
  type: 'placeholder'
} & _MessageCommon

export type MessagePlaceholder = I.RecordOf<_MessagePlaceholder>

// We keep deleted messages around so the bookkeeping is simpler
export type _MessageDeleted = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  hasBeenEdited: boolean
  errorReason: string | null
  outboxID: OutboxID | null
  timestamp: number
  type: 'deleted'
} & _MessageCommon
export type MessageDeleted = I.RecordOf<_MessageDeleted>

export type _MessageText = {
  conversationIDKey: Common.ConversationIDKey
  decoratedText: HiddenString | null
  bodySummary: HiddenString
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  errorReason: string | null
  exploded: boolean
  explodedBy: string // only if 'explode now' happened,
  exploding: boolean
  explodingTime: number
  explodingUnreadable: boolean // if we can't read this message bc we have no keys,
  hasBeenEdited: boolean
  inlinePaymentIDs: I.List<WalletTypes.PaymentID> | null
  inlinePaymentSuccessful: boolean
  isDeleteable: boolean
  isEditable: boolean
  flipGameID: string | null
  reactions: Reactions
  submitState: null | 'deleting' | 'editing' | 'pending' | 'failed'
  mentionsAt: MentionsAt
  mentionsChannel: MentionsChannel
  mentionsChannelName: MentionsChannelName
  outboxID: OutboxID | null
  // eslint-disable-next-line no-use-before-define
  replyTo: Message | null
  text: HiddenString
  paymentInfo: ChatPaymentInfo | null // If null, we are waiting on this from the service,
  timestamp: number
  unfurls: UnfurlMap
  type: 'text'
} & _MessageCommon
export type MessageText = I.RecordOf<_MessageText>

export type AttachmentType = 'image' | 'file'

export type PreviewSpec = {
  attachmentType: AttachmentType
  height: number
  width: number
  showPlayButton: boolean
}

export type _MessageAttachment = {
  attachmentType: AttachmentType
  showPlayButton: boolean
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  fileURL: string
  fileURLCached: boolean
  previewURL: string
  fileType: string // MIME type,
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  downloadPath: string | null // string if downloaded,
  errorReason: string | null
  exploded: boolean
  explodedBy: string // only if 'explode now' happened,
  exploding: boolean
  explodingTime: number
  explodingUnreadable: boolean // if we can't read this message bc we have no keys,
  fileName: string
  fileSize: number
  hasBeenEdited: boolean
  // id: MessageID  that of first attachment message, not second attachment-uploaded message,
  inlineVideoPlayable: boolean
  isEditable: boolean
  isCollapsed: boolean
  isDeleteable: boolean
  outboxID: OutboxID | null
  previewHeight: number
  previewWidth: number
  previewTransferState: 'downloading' | null // only for preview,
  reactions: Reactions
  submitState: null | 'deleting' | 'pending' | 'failed'
  timestamp: number
  title: string
  transferProgress: number // 0-1 // only for the file,
  transferState: 'uploading' | 'downloading' | 'remoteUploading' | 'mobileSaving' | null
  transferErrMsg: string | null
  type: 'attachment'
  videoDuration: string | null
} & _MessageCommon
export type MessageAttachment = I.RecordOf<_MessageAttachment>

export type _ChatRequestInfo = {
  amount: string
  amountDescription: string
  asset: WalletTypes.Asset
  canceled: boolean
  currencyCode: string // set if asset === 'currency',
  done: boolean
  type: 'requestInfo'
  worthAtRequestTime: string
}
export type ChatRequestInfo = I.RecordOf<_ChatRequestInfo>

export type _MessageRequestPayment = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  errorReason: string | null
  hasBeenEdited: boolean
  note: HiddenString
  outboxID: OutboxID | null
  reactions: Reactions
  requestID: RPCStellarTypes.KeybaseRequestID
  requestInfo: ChatRequestInfo | null // If null, we are waiting on this from the service,
  timestamp: number
  type: 'requestPayment'
} & _MessageCommon
export type MessageRequestPayment = I.RecordOf<_MessageRequestPayment>

export type _ChatPaymentInfo = {
  accountID: WalletTypes.AccountID
  amountDescription: string
  delta: 'none' | 'increase' | 'decrease'
  fromUsername: string
  issuerDescription: string
  note: HiddenString
  paymentID: WalletTypes.PaymentID
  sourceAmount: string
  sourceAsset: WalletTypes.AssetDescription
  status: WalletTypes.StatusSimplified
  statusDescription: string
  statusDetail: string
  showCancel: boolean
  toUsername: string
  type: 'paymentInfo'
  worth: string
  worthAtSendTime: string
}

export type ChatPaymentInfo = I.RecordOf<_ChatPaymentInfo>

export type _MessageSendPayment = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  errorReason: string | null
  hasBeenEdited: boolean
  outboxID: OutboxID | null
  reactions: Reactions
  paymentInfo: ChatPaymentInfo | null // If null, we are waiting on this from the service,
  timestamp: number
  type: 'sendPayment'
} & _MessageCommon
export type MessageSendPayment = I.RecordOf<_MessageSendPayment>

// Note that all these MessageSystem* messages are generated by the sender's client
// at the time that the message is sent. Associated message data that relates to
// conversation (e.g. teamname, isAdmin) rather than the message may have changed since
// the message was created. Because of this it's probably more reliable to look at
// other places in the store to get that information when possible.
export type _MessageSystemInviteAccepted = {
  adder: string
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  inviteType: 'none' | 'unknown' | 'keybase' | 'email' | 'sbs' | 'text'
  invitee: string
  inviter: string
  reactions: Reactions
  team: string
  timestamp: number
  type: 'systemInviteAccepted'
} & _MessageCommon
export type MessageSystemInviteAccepted = I.RecordOf<_MessageSystemInviteAccepted>

export type _MessageSystemSimpleToComplex = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  reactions: Reactions
  timestamp: number
  team: string
  type: 'systemSimpleToComplex'
} & _MessageCommon
export type MessageSystemSimpleToComplex = I.RecordOf<_MessageSystemSimpleToComplex>

export type _MessageSystemGitPush = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  pusher: string
  pushType: RPCTypes.GitPushType
  reactions: Reactions
  refs: Array<RPCTypes.GitRefMetadata>
  repo: string
  repoID: string
  team: string
  timestamp: number
  type: 'systemGitPush'
} & _MessageCommon
export type MessageSystemGitPush = I.RecordOf<_MessageSystemGitPush>

export type _MessageSystemAddedToTeam = {
  addee: string
  adder: string
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  isAdmin: boolean
  reactions: Reactions
  team: string
  timestamp: number
  type: 'systemAddedToTeam'
} & _MessageCommon
export type MessageSystemAddedToTeam = I.RecordOf<_MessageSystemAddedToTeam>

export type _MessageSystemJoined = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  joiners: Array<string>
  leavers: Array<string>
  timestamp: number
  type: 'systemJoined'
} & _MessageCommon
export type MessageSystemJoined = I.RecordOf<_MessageSystemJoined>

export type _MessageSystemLeft = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  timestamp: number
  type: 'systemLeft'
} & _MessageCommon
export type MessageSystemLeft = I.RecordOf<_MessageSystemLeft>

export type _MessageSystemText = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  reactions: Reactions
  timestamp: number
  text: HiddenString
  type: 'systemText'
} & _MessageCommon
export type MessageSystemText = I.RecordOf<_MessageSystemText>

export type _MessageSetDescription = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  reactions: Reactions
  timestamp: number
  newDescription: HiddenString
  type: 'setDescription'
} & _MessageCommon
export type MessageSetDescription = I.RecordOf<_MessageSetDescription>

export type _MessageSetChannelname = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  reactions: Reactions
  timestamp: number
  newChannelname: string
  type: 'setChannelname'
} & _MessageCommon
export type MessageSetChannelname = I.RecordOf<_MessageSetChannelname>

export type _MessageSystemChangeRetention = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  isInherit: boolean
  isTeam: boolean
  membersType: RPCChatTypes.ConversationMembersType
  policy: RPCChatTypes.RetentionPolicy | null
  reactions: Reactions
  timestamp: number
  type: 'systemChangeRetention'
  user: string
  you: string
} & _MessageCommon
export type MessageSystemChangeRetention = I.RecordOf<_MessageSystemChangeRetention>

export type _MessageSystemUsersAddedToConversation = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  reactions: Reactions
  timestamp: number
  usernames: Array<string>
  type: 'systemUsersAddedToConversation'
} & _MessageCommon
export type MessageSystemUsersAddedToConversation = I.RecordOf<_MessageSystemUsersAddedToConversation>

export type MessageWithReactionPopup =
  | MessageText
  | MessageSetChannelname
  | MessageSetDescription
  | MessageSystemAddedToTeam
  | MessageSystemChangeRetention
  | MessageSystemGitPush
  | MessageSystemInviteAccepted
  | MessageSystemSimpleToComplex
  | MessageSystemText
  | MessageSystemUsersAddedToConversation

export type DecoratedMessage =
  | MessageWithReactionPopup
  | MessageAttachment
  | MessageRequestPayment
  | MessageSendPayment

// If you add a message type here, you'll probably want to check
// `deletableByDeleteHistory` stuff in constants/chat2/message
export type Message =
  | MessageAttachment
  | MessageDeleted
  | MessageRequestPayment
  | MessageSendPayment
  | MessageSetChannelname
  | MessageSetDescription
  | MessageSystemAddedToTeam
  | MessageSystemChangeRetention
  | MessageSystemGitPush
  | MessageSystemInviteAccepted
  | MessageSystemJoined
  | MessageSystemLeft
  | MessageSystemSimpleToComplex
  | MessageSystemText
  | MessageSystemUsersAddedToConversation
  | MessageText
  | MessagePlaceholder
export type MessageType =
  | 'attachment'
  | 'deleted'
  | 'requestPayment'
  | 'sendPayment'
  | 'setChannelname'
  | 'setDescription'
  | 'systemAddedToTeam'
  | 'systemChangeRetention'
  | 'systemGitPush'
  | 'systemInviteAccepted'
  | 'systemJoined'
  | 'systemLeft'
  | 'systemSimpleToComplex'
  | 'systemText'
  | 'systemUsersAddedToConversation'
  | 'text'
  | 'placeholder'
