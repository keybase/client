// Types related to a message
import * as Common from './common'
import * as RPCTypes from '../rpc-gen'
import * as RPCChatTypes from '../rpc-chat-gen'
import * as RPCStellarTypes from '../rpc-stellar-gen'
import * as WalletTypes from '../wallets'
import * as TeamTypes from '../teams'
import HiddenString from '../../../util/hidden-string'
import {DeviceType} from '../devices'
import {ServiceIdWithContact} from '../team-building'

// The actual ID the server uses for operations (edit, delete etc)
export type MessageID = number
export const numberToMessageID = (n: number): MessageID => n
export const messageIDToNumber = (n: MessageID): number => n

export type Reaction = {
  timestamp: number
  username: string
}
export type Reactions = Map<string, Set<Reaction>>
export type UnfurlMap = Map<string, RPCChatTypes.UIMessageUnfurlInfo>

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

type Filter<T, U> = T extends U ? T : never
type ReactionType = Filter<Message, {reactions: Reactions}>

export function hasReactions(m: Message): m is ReactionType {
  return Object.prototype.hasOwnProperty.call(m, 'reactions')
}

export type MentionsAt = Set<string>
export type MentionsChannel = 'none' | 'all' | 'here'
export type MentionsChannelName = Map<string, Common.ConversationIDKey>

export type MessageExplodeDescription = {
  text: string
  seconds: number
}

export type PathAndOutboxID = {
  path: string
  outboxID?: RPCChatTypes.OutboxID
}

type MessageCommon = {
  author: string
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  id: MessageID
  ordinal: Ordinal
  timestamp: number
}
type MessageCommonWithDeviceInfo = {
  deviceName: string
  deviceRevokedAt?: number
  deviceType: DeviceType
} & MessageCommon

type MessageCommonWithDeviceDeletableEditable = {
  isDeleteable: boolean
  isEditable: boolean
} & MessageCommonWithDeviceInfo

type MessageCommonWithDeviceDeletableEditableReactions = {
  reactions: Reactions
} & MessageCommonWithDeviceDeletableEditable

// Message types have a lot of copy and paste. Originally I had this split out but this
// causes flow to get confused or makes the error messages a million times harder to understand

export type MessagePlaceholder = {
  type: 'placeholder'
} & MessageCommon

// We keep deleted messages around so the bookkeeping is simpler
export type MessageDeleted = {
  hasBeenEdited: boolean
  errorReason?: string
  errorTyp?: number
  outboxID?: OutboxID
  type: 'deleted'
} & MessageCommonWithDeviceInfo

export type MessageText = {
  decoratedText?: HiddenString
  errorReason?: string
  errorTyp?: number
  exploded: boolean
  explodedBy: string // only if 'explode now' happened,
  exploding: boolean
  explodingTime: number
  explodingUnreadable: boolean // if we can't read this message bc we have no keys,
  hasBeenEdited: boolean
  inlinePaymentIDs?: Array<WalletTypes.PaymentID>
  inlinePaymentSuccessful: boolean
  isDeleteable: boolean
  isEditable: boolean
  flipGameID?: string
  reactions: Reactions
  submitState?: 'deleting' | 'editing' | 'pending' | 'failed'
  mentionsAt: MentionsAt
  mentionsChannel: MentionsChannel
  mentionsChannelName: MentionsChannelName
  outboxID?: OutboxID
  // eslint-disable-next-line no-use-before-define
  replyTo?: Message
  text: HiddenString
  paymentInfo?: ChatPaymentInfo // If null, we are waiting on this from the service,
  unfurls: UnfurlMap
  type: 'text'
} & MessageCommonWithDeviceInfo

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
  | undefined

export type MessageAttachment = {
  attachmentType: AttachmentType
  showPlayButton: boolean
  fileURL: string
  fileURLCached: boolean
  previewURL: string
  fileType: string // MIME type,
  downloadPath?: string // string if downloaded,
  errorReason?: string
  errorTyp?: number
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
  outboxID?: OutboxID
  previewHeight: number
  previewWidth: number
  previewTransferState?: 'downloading' // only for preview,
  reactions: Reactions
  submitState?: 'deleting' | 'pending' | 'failed'
  title: string
  transferProgress: number // 0-1 // only for the file,
  transferState: MessageAttachmentTransferState
  transferErrMsg?: string
  type: 'attachment'
  videoDuration?: string
} & MessageCommonWithDeviceInfo

export type ChatRequestInfo = {
  amount: string
  amountDescription: string
  asset: WalletTypes.Asset
  canceled: boolean
  currencyCode: string // set if asset === 'currency',
  done: boolean
  type: 'requestInfo'
  worthAtRequestTime: string
}

export type MessageRequestPayment = {
  errorReason?: string
  errorTyp?: number
  hasBeenEdited: boolean
  note: HiddenString
  outboxID?: OutboxID
  reactions: Reactions
  requestID: RPCStellarTypes.KeybaseRequestID
  requestInfo?: ChatRequestInfo // If null, we are waiting on this from the service,
  type: 'requestPayment'
} & MessageCommonWithDeviceInfo

export type ChatPaymentInfo = {
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

export type MessageSendPayment = {
  errorReason?: string
  errorTyp?: number
  hasBeenEdited: boolean
  outboxID?: OutboxID
  reactions: Reactions
  paymentInfo?: ChatPaymentInfo // If null, we are waiting on this from the service,
  type: 'sendPayment'
} & MessageCommonWithDeviceInfo

// Note that all these MessageSystem* messages are generated by the sender's client
// at the time that the message is sent. Associated message data that relates to
// conversation (e.g. teamname, isAdmin) rather than the message may have changed since
// the message was created. Because of this it's probably more reliable to look at
// other places in the store to get that information when possible.
export type MessageSystemInviteAccepted = {
  adder: string
  inviteType: 'none' | 'unknown' | 'keybase' | 'email' | 'sbs' | 'text'
  invitee: string
  inviter: string
  team: string
  role: TeamTypes.MaybeTeamRoleType
  type: 'systemInviteAccepted'
} & MessageCommonWithDeviceDeletableEditableReactions

export type MessageSystemSBSResolved = {
  assertionUsername: string
  assertionService?: ServiceIdWithContact
  prover: string
  type: 'systemSBSResolved'
} & MessageCommonWithDeviceDeletableEditableReactions

export type MessageSystemSimpleToComplex = {
  team: string
  type: 'systemSimpleToComplex'
} & MessageCommonWithDeviceDeletableEditableReactions

export type MessageSystemGitPush = {
  pusher: string
  pushType: RPCTypes.GitPushType
  refs: Array<RPCTypes.GitRefMetadata>
  repo: string
  repoID: string
  team: string
  type: 'systemGitPush'
} & MessageCommonWithDeviceDeletableEditableReactions

export type MessageSystemAddedToTeam = {
  addee: string
  adder: string
  role: TeamTypes.MaybeTeamRoleType
  isAdmin: boolean
  team: string
  type: 'systemAddedToTeam'
} & MessageCommonWithDeviceDeletableEditableReactions

export type MessageSystemJoined = {
  joiners: Array<string>
  leavers: Array<string>
  type: 'systemJoined'
} & MessageCommonWithDeviceDeletableEditable

export type MessageSystemLeft = {
  type: 'systemLeft'
} & MessageCommonWithDeviceDeletableEditable

export type MessageSystemText = {
  text: HiddenString
  type: 'systemText'
} & MessageCommonWithDeviceDeletableEditableReactions

export type MessageSetDescription = {
  newDescription: HiddenString
  type: 'setDescription'
} & MessageCommonWithDeviceDeletableEditableReactions

export type MessagePin = {
  bodySummary: HiddenString
  conversationIDKey: Common.ConversationIDKey
  deviceName: string
  deviceRevokedAt?: number
  deviceType: DeviceType
  isDeleteable: boolean
  isEditable: boolean
  pinnedMessageID: MessageID
  reactions: Reactions
  timestamp: number
  type: 'pin'
} & MessageCommon

export type MessageSetChannelname = {
  newChannelname: string
  type: 'setChannelname'
} & MessageCommonWithDeviceDeletableEditableReactions

export type MessageSystemChangeRetention = {
  isInherit: boolean
  isTeam: boolean
  membersType: RPCChatTypes.ConversationMembersType
  policy?: RPCChatTypes.RetentionPolicy
  type: 'systemChangeRetention'
  user: string
  you: string
} & MessageCommonWithDeviceDeletableEditableReactions

export type MessageSystemUsersAddedToConversation = {
  usernames: Array<string>
  type: 'systemUsersAddedToConversation'
} & MessageCommonWithDeviceDeletableEditableReactions

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
