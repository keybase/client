// Types related to a message
import * as Common from './common'
import * as RPCTypes from '../rpc-gen'
import * as RPCChatTypes from '../rpc-chat-gen'
import * as RPCStellarTypes from '../rpc-stellar-gen'
import * as WalletTypes from '../wallets'
import * as TeamTypes from '../teams'
import * as I from 'immutable'
import HiddenString from '../../../util/hidden-string'
import {DeviceType} from '../devices'
import {ServiceIdWithContact} from '../team-building'

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
  conversationIDKey: Common.ConversationIDKey
  id: MessageID
  ordinal: Ordinal
  timestamp: number
  bodySummary: HiddenString
}
type _MessageCommonWithDeviceInfo = {
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
} & _MessageCommon

type _MessageCommonWithDeviceDeletableEditable = {
  isDeleteable: boolean
  isEditable: boolean
} & _MessageCommonWithDeviceInfo

type _MessageCommonWithDeviceDeletableEditableReactions = {
  reactions: Reactions
} & _MessageCommonWithDeviceDeletableEditable

// Message types have a lot of copy and paste. Originally I had this split out but this
// causes flow to get confused or makes the error messages a million times harder to understand

export type _MessagePlaceholder = {
  type: 'placeholder'
} & _MessageCommon

export type MessagePlaceholder = I.RecordOf<_MessagePlaceholder>

// We keep deleted messages around so the bookkeeping is simpler
export type _MessageDeleted = {
  hasBeenEdited: boolean
  errorReason: string | null
  errorTyp: number | null
  outboxID: OutboxID | null
  type: 'deleted'
} & _MessageCommonWithDeviceInfo
export type MessageDeleted = I.RecordOf<_MessageDeleted>

export type _MessageText = {
  decoratedText: HiddenString | null
  errorReason: string | null
  errorTyp: number | null
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
  unfurls: UnfurlMap
  type: 'text'
} & _MessageCommonWithDeviceInfo
export type MessageText = I.RecordOf<_MessageText>

export type AttachmentType = 'image' | 'file'

export type PreviewSpec = {
  attachmentType: AttachmentType
  height: number
  width: number
  showPlayButton: boolean
}

export type MessageAttachmentTransferState =
  | 'uploading'
  | 'downloading'
  | 'remoteUploading'
  | 'mobileSaving'
  | null

export type _MessageAttachment = {
  attachmentType: AttachmentType
  showPlayButton: boolean
  fileURL: string
  fileURLCached: boolean
  previewURL: string
  fileType: string // MIME type,
  downloadPath: string | null // string if downloaded,
  errorReason: string | null
  errorTyp: number | null
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
  title: string
  transferProgress: number // 0-1 // only for the file,
  transferState: MessageAttachmentTransferState
  transferErrMsg: string | null
  type: 'attachment'
  videoDuration: string | null
} & _MessageCommonWithDeviceInfo
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
  errorReason: string | null
  errorTyp: number | null
  hasBeenEdited: boolean
  note: HiddenString
  outboxID: OutboxID | null
  reactions: Reactions
  requestID: RPCStellarTypes.KeybaseRequestID
  requestInfo: ChatRequestInfo | null // If null, we are waiting on this from the service,
  type: 'requestPayment'
} & _MessageCommonWithDeviceInfo
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
  errorReason: string | null
  errorTyp: number | null
  hasBeenEdited: boolean
  outboxID: OutboxID | null
  reactions: Reactions
  paymentInfo: ChatPaymentInfo | null // If null, we are waiting on this from the service,
  type: 'sendPayment'
} & _MessageCommonWithDeviceInfo
export type MessageSendPayment = I.RecordOf<_MessageSendPayment>

// Note that all these MessageSystem* messages are generated by the sender's client
// at the time that the message is sent. Associated message data that relates to
// conversation (e.g. teamname, isAdmin) rather than the message may have changed since
// the message was created. Because of this it's probably more reliable to look at
// other places in the store to get that information when possible.
export type _MessageSystemInviteAccepted = {
  adder: string
  inviteType: 'none' | 'unknown' | 'keybase' | 'email' | 'sbs' | 'text'
  invitee: string
  inviter: string
  team: string
  role: TeamTypes.MaybeTeamRoleType
  type: 'systemInviteAccepted'
} & _MessageCommonWithDeviceDeletableEditableReactions
export type MessageSystemInviteAccepted = I.RecordOf<_MessageSystemInviteAccepted>

export type _MessageSystemSBSResolved = {
  assertionUsername: string
  assertionService: ServiceIdWithContact | null
  prover: string
  type: 'systemSBSResolved'
} & _MessageCommonWithDeviceDeletableEditableReactions
export type MessageSystemSBSResolved = I.RecordOf<_MessageSystemSBSResolved>

export type _MessageSystemSimpleToComplex = {
  team: string
  type: 'systemSimpleToComplex'
} & _MessageCommonWithDeviceDeletableEditableReactions
export type MessageSystemSimpleToComplex = I.RecordOf<_MessageSystemSimpleToComplex>

export type _MessageSystemGitPush = {
  pusher: string
  pushType: RPCTypes.GitPushType
  refs: Array<RPCTypes.GitRefMetadata>
  repo: string
  repoID: string
  team: string
  type: 'systemGitPush'
} & _MessageCommonWithDeviceDeletableEditableReactions
export type MessageSystemGitPush = I.RecordOf<_MessageSystemGitPush>

export type _MessageSystemAddedToTeam = {
  addee: string
  adder: string
  role: TeamTypes.MaybeTeamRoleTypeWithBots
  isAdmin: boolean
  team: string
  type: 'systemAddedToTeam'
} & _MessageCommonWithDeviceDeletableEditableReactions
export type MessageSystemAddedToTeam = I.RecordOf<_MessageSystemAddedToTeam>

export type _MessageSystemJoined = {
  joiners: Array<string>
  leavers: Array<string>
  type: 'systemJoined'
} & _MessageCommonWithDeviceDeletableEditable
export type MessageSystemJoined = I.RecordOf<_MessageSystemJoined>

export type _MessageSystemLeft = {
  type: 'systemLeft'
} & _MessageCommonWithDeviceDeletableEditable
export type MessageSystemLeft = I.RecordOf<_MessageSystemLeft>

export type _MessageSystemText = {
  text: HiddenString
  type: 'systemText'
} & _MessageCommonWithDeviceDeletableEditableReactions
export type MessageSystemText = I.RecordOf<_MessageSystemText>

export type _MessageSetDescription = {
  newDescription: HiddenString
  type: 'setDescription'
} & _MessageCommonWithDeviceDeletableEditableReactions
export type MessageSetDescription = I.RecordOf<_MessageSetDescription>

export type _MessagePin = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  pinnedMessageID: MessageID
  reactions: Reactions
  timestamp: number
  type: 'pin'
} & _MessageCommon
export type MessagePin = I.RecordOf<_MessagePin>

export type _MessageSetChannelname = {
  newChannelname: string
  type: 'setChannelname'
} & _MessageCommonWithDeviceDeletableEditableReactions
export type MessageSetChannelname = I.RecordOf<_MessageSetChannelname>

export type _MessageSystemChangeRetention = {
  isInherit: boolean
  isTeam: boolean
  membersType: RPCChatTypes.ConversationMembersType
  policy: RPCChatTypes.RetentionPolicy | null
  type: 'systemChangeRetention'
  user: string
  you: string
} & _MessageCommonWithDeviceDeletableEditableReactions
export type MessageSystemChangeRetention = I.RecordOf<_MessageSystemChangeRetention>

export type _MessageSystemUsersAddedToConversation = {
  usernames: Array<string>
  type: 'systemUsersAddedToConversation'
} & _MessageCommonWithDeviceDeletableEditableReactions
export type MessageSystemUsersAddedToConversation = I.RecordOf<_MessageSystemUsersAddedToConversation>

export type MessageWithReactionPopup =
  | MessageText
  | MessageSetChannelname
  | MessageSetDescription
  | MessagePin
  | MessageSystemAddedToTeam
  | MessageSystemChangeRetention
  | MessageSystemGitPush
  | MessageSystemInviteAccepted
  | MessageSystemSBSResolved
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
  | MessageSystemSBSResolved
  | MessageSystemSimpleToComplex
  | MessageSystemText
  | MessageSystemUsersAddedToConversation
  | MessageText
  | MessagePlaceholder
  | MessagePin
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
  | 'systemSBSResolved'
  | 'systemSimpleToComplex'
  | 'systemText'
  | 'systemUsersAddedToConversation'
  | 'text'
  | 'placeholder'
  | 'pin'
