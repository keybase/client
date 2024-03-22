// Types related to a message
import type * as Common from './common'
import type * as RPCTypes from '../rpc-gen'
import type * as RPCChatTypes from '../rpc-chat-gen'
import type * as RPCStellarTypes from '../rpc-stellar-gen'
import type * as WalletTypes from '../wallets'
import type * as TeamTypes from '../teams'
import type HiddenString from '@/util/hidden-string'
import type * as T from '@/constants/types'
import type {DeviceType} from '../devices'
import type {ServiceIdWithContact} from '../team-building'
import type {Opaque} from '@/constants/types/ts'

// The actual ID the server uses for operations (edit, delete etc)
export type MessageID = Opaque<number, 'MessageID'>
export const numberToMessageID = (n: number) => n as MessageID
export const numbersToMessageIDs = (a: ReadonlyArray<number>) => a as ReadonlyArray<MessageID>
export const messageIDToNumber = (n: MessageID): number => n

export type Reaction = T.Immutable<{
  timestamp: number
  username: string
}>
export type ReactionDesc = T.Immutable<{
  decorated: string
  users: Set<Reaction>
}>
export type Reactions = ReadonlyMap<string, ReactionDesc>

export type UnfurlMap = ReadonlyMap<string, RPCChatTypes.UIMessageUnfurlInfo>

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
export type Ordinal = Opaque<number, 'Ordinal'>
export const numberToOrdinal = (n: number): Ordinal => n as Ordinal
export const ordinalToNumber = (o: Ordinal): number => o

export type OutboxID = string
export const stringToOutboxID = (s: string): OutboxID => s
export const outboxIDToString = (o: OutboxID): string => o

export type MentionsAt = Set<string>
export type MentionsChannel = 'none' | 'all' | 'here'

export type MessageExplodeDescription = {
  text: string
  seconds: number
}

export type PathAndOutboxID = {
  path: string
  outboxID?: RPCChatTypes.OutboxID
  url?: string // if its a kbfs path
}

// optional props here may never get set depending on the type
type _MessageCommon = T.Immutable<{
  adder?: string
  attachmentType?: AttachmentType
  audioAmps?: ReadonlyArray<number>
  audioDuration?: number
  author: string
  bodySummary: HiddenString
  decoratedText?: HiddenString
  text?: HiddenString
  botUsername?: string
  cardType?: RPCChatTypes.JourneycardType
  conversationIDKey: Common.ConversationIDKey
  deviceName?: string
  deviceRevokedAt?: number
  deviceType?: DeviceType
  downloadPath?: string // string if downloaded,
  errorReason?: string
  errorTyp?: number
  exploded?: boolean
  explodedBy?: string // only if 'explode now' happened,
  exploding?: boolean
  explodingTime?: number
  explodingUnreadable?: boolean
  fileName?: string
  fileType?: string // MIME type,
  fileURL?: string
  hasBeenEdited?: boolean
  id: MessageID
  inlineVideoPlayable?: boolean
  invitee?: string
  isCollapsed?: boolean
  isDeleteable?: boolean
  isEditable?: boolean
  joiners?: ReadonlyArray<string>
  leavers?: ReadonlyArray<string>
  mentionsAt?: MentionsAt
  mentionsChannel?: MentionsChannel
  newChannelname?: string
  ordinal: Ordinal
  outboxID?: OutboxID
  previewHeight?: number
  previewURL?: string
  previewWidth?: number
  prover?: string
  reactions?: Reactions
  submitState?: 'deleting' | 'editing' | 'pending' | 'failed'
  timestamp: number
  title?: string
  transferErrMsg?: string
  transferState?: MessageAttachmentTransferState
  unfurls?: UnfurlMap
}>

type _MessageWithDeviceInfo = T.Immutable<{
  deviceName: string
  deviceType: DeviceType
}>

type _MessageWithDeletableEditable = T.Immutable<{
  isDeleteable: boolean
  isEditable: boolean
}>

type _MessageWithReactions = T.Immutable<{
  reactions: undefined | Reactions
}>

// Message types have a lot of copy and paste. Originally I had this split out but this
// causes flow to get confused or makes the error messages a million times harder to understand
// Possibly as a result, some types have sentinel-valued fields hanging off them.

export type MessagePlaceholder = T.Immutable<{
  type: 'placeholder'
}> &
  _MessageCommon

export type MessageJourneycard = T.Immutable<{
  type: 'journeycard'
  cardType: RPCChatTypes.JourneycardType
  highlightMsgID: MessageID
  openTeam: boolean
}> &
  _MessageCommon

// We keep deleted messages around so the bookkeeping is simpler
export type MessageDeleted = T.Immutable<{
  type: 'deleted'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo

export type MessageReplyTo = T.Immutable<{
  type: MessageType
  text?: HiddenString
}> &
  _MessageCommon

export type MessageText = T.Immutable<{
  botUsername?: string
  decoratedText?: HiddenString
  exploded: boolean
  explodedBy: string // only if 'explode now' happened,
  exploding: boolean
  explodingTime: number
  explodingUnreadable: boolean // if we can't read this message bc we have no keys,
  inlinePaymentIDs?: ReadonlyArray<WalletTypes.PaymentID>
  inlinePaymentSuccessful: boolean
  flipGameID?: string
  mentionsAt?: MentionsAt
  mentionsChannel: MentionsChannel
  // this is actually a real Message type but with immutable the circular reference confuses TS, so only expose a small subset of the fields
  replyTo?: MessageReplyTo
  text: HiddenString
  paymentInfo?: ChatPaymentInfo // If null, we are waiting on this from the service,
  unfurls: undefined | UnfurlMap
  type: 'text'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithReactions &
  _MessageWithDeletableEditable

export type AttachmentType = 'image' | 'file' | 'audio'

export type PreviewSpec = {
  attachmentType: AttachmentType
  audioAmps: ReadonlyArray<number>
  audioDuration: number
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

export type MessageAttachment = T.Immutable<{
  attachmentType: AttachmentType
  audioAmps: undefined | ReadonlyArray<number>
  audioDuration: number
  decoratedText?: HiddenString
  showPlayButton: boolean
  fileURL: string
  fileURLCached: boolean
  previewURL: string
  fileType: string // MIME type,
  downloadPath?: string // string if downloaded,
  exploded: boolean
  explodedBy: string // only if 'explode now' happened,
  exploding: boolean
  explodingTime: number
  explodingUnreadable: boolean // if we can't read this message bc we have no keys,
  fileName: string
  fileSize: number
  // id: MessageID  that of first attachment message, not second attachment-uploaded message,
  inlineVideoPlayable: boolean
  isCollapsed: boolean
  previewHeight: number
  previewWidth: number
  previewTransferState?: 'downloading' // only for preview,
  title: string
  transferProgress: number // 0-1 // only for the file,
  transferState?: MessageAttachmentTransferState
  transferErrMsg?: string
  type: 'attachment'
  videoDuration?: string
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithReactions &
  _MessageWithDeletableEditable

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

export type MessageRequestPayment = T.Immutable<{
  note: HiddenString
  requestID: RPCStellarTypes.KeybaseRequestID
  requestInfo?: ChatRequestInfo // If null, we are waiting on this from the service,
  type: 'requestPayment'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithReactions

export type ChatPaymentInfo = T.Immutable<{
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
}>

export type MessageSendPayment = T.Immutable<{
  paymentInfo?: ChatPaymentInfo // If null, we are waiting on this from the service,
  type: 'sendPayment'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithReactions

// Note that all these MessageSystem* messages are generated by the sender's client
// at the time that the message is sent. Associated message data that relates to
// conversation (e.g. teamname, isAdmin) rather than the message may have changed since
// the message was created. Because of this it's probably more reliable to look at
// other places in the store to get that information when possible.
export type MessageSystemInviteAccepted = T.Immutable<{
  adder: string
  inviteType: 'none' | 'unknown' | 'keybase' | 'email' | 'sbs' | 'text'
  invitee: string
  inviter: string
  team: string
  role: TeamTypes.MaybeTeamRoleType
  type: 'systemInviteAccepted'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessageSystemSBSResolved = T.Immutable<{
  assertionUsername: string
  assertionService?: ServiceIdWithContact
  prover: string
  type: 'systemSBSResolved'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessageSystemSimpleToComplex = T.Immutable<{
  team: string
  type: 'systemSimpleToComplex'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessageSystemCreateTeam = T.Immutable<{
  creator: string
  team: string
  type: 'systemCreateTeam'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessageSystemGitPush = T.Immutable<{
  pusher: string
  pushType: RPCTypes.GitPushType
  refs: undefined | ReadonlyArray<RPCTypes.GitRefMetadata>
  repo: string
  repoID: string
  team: string
  type: 'systemGitPush'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessageSystemAddedToTeam = T.Immutable<{
  addee: string
  adder: string
  bulkAdds: undefined | ReadonlyArray<string>
  role: TeamTypes.MaybeTeamRoleType
  team: string
  type: 'systemAddedToTeam'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessageSystemJoined = T.Immutable<{
  joiners?: ReadonlyArray<string>
  leavers?: ReadonlyArray<string>
  type: 'systemJoined'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable

export type MessageSystemLeft = T.Immutable<{
  type: 'systemLeft'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable

export type MessageSystemChangeAvatar = T.Immutable<{
  team: string
  type: 'systemChangeAvatar'
  user: string
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithReactions

export type MessageSystemNewChannel = T.Immutable<{
  text: HiddenString
  type: 'systemNewChannel'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessageSystemText = T.Immutable<{
  text: HiddenString
  type: 'systemText'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessageSetDescription = T.Immutable<{
  newDescription: HiddenString
  type: 'setDescription'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessagePin = T.Immutable<{
  bodySummary: HiddenString
  pinnedMessageID: MessageID
  timestamp: number
  type: 'pin'
}> &
  _MessageCommon &
  _MessageWithReactions &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable

export type MessageSetChannelname = T.Immutable<{
  newChannelname: string
  type: 'setChannelname'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessageSystemChangeRetention = T.Immutable<{
  isInherit: boolean
  isTeam: boolean
  membersType: RPCChatTypes.ConversationMembersType
  policy?: RPCChatTypes.RetentionPolicy
  type: 'systemChangeRetention'
  user: string
  you: string
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

export type MessageSystemUsersAddedToConversation = T.Immutable<{
  usernames: ReadonlyArray<string>
  type: 'systemUsersAddedToConversation'
}> &
  _MessageCommon &
  _MessageWithDeviceInfo &
  _MessageWithDeletableEditable &
  _MessageWithReactions

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
  | MessageSystemCreateTeam
  | MessageSystemChangeAvatar
  | MessageSystemNewChannel
  | MessageText
  | MessagePlaceholder
  | MessagePin
  | MessageJourneycard

type GetTypes<T> = T extends {type: string} ? T['type'] : never
export type MessageType = GetTypes<Message>
export type Filter<T, U> = T extends U ? T : never
export type MessagesWithReactions = Filter<Message, _MessageWithReactions>
