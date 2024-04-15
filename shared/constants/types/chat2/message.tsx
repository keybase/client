// Types related to a message
import type * as Common from './common'
import type * as RPCTypes from '../rpc-gen'
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

export type UnfurlMap = ReadonlyMap<string, T.RPCChat.UIMessageUnfurlInfo>

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

export type MentionsAt = ReadonlySet<string>
export type MentionsChannel = 'none' | 'all' | 'here'

export interface MessageExplodeDescription {
  text: string
  seconds: number
}

export interface PathAndOutboxID {
  path: string
  outboxID?: T.RPCChat.OutboxID
  url?: string // if its a kbfs path
}

// optional props here may never get set depending on the type
interface _MessageCommon {
  readonly adder?: string
  readonly attachmentType?: AttachmentType
  readonly audioAmps?: ReadonlyArray<number>
  readonly audioDuration?: number
  readonly author: string
  readonly bodySummary: HiddenString
  readonly decoratedText?: HiddenString
  readonly text?: HiddenString
  readonly botUsername?: string
  readonly cardType?: T.RPCChat.JourneycardType
  readonly conversationIDKey: Common.ConversationIDKey
  readonly deviceName?: string
  readonly deviceRevokedAt?: number
  readonly deviceType?: DeviceType
  readonly downloadPath?: string // string if downloaded,
  readonly errorReason?: string
  readonly errorTyp?: number
  readonly exploded?: boolean
  readonly explodedBy?: string // only if 'explode now' happened,
  readonly exploding?: boolean
  readonly explodingTime?: number
  readonly explodingUnreadable?: boolean
  readonly fileName?: string
  readonly fileType?: string // MIME type,
  readonly fileURL?: string
  readonly hasBeenEdited?: boolean
  readonly id: MessageID
  readonly inlineVideoPlayable?: boolean
  readonly invitee?: string
  readonly isCollapsed?: boolean
  readonly isDeleteable?: boolean
  readonly isEditable?: boolean
  readonly joiners?: ReadonlyArray<string>
  readonly leavers?: ReadonlyArray<string>
  readonly mentionsAt?: MentionsAt
  readonly mentionsChannel?: MentionsChannel
  readonly newChannelname?: string
  readonly ordinal: Ordinal
  readonly outboxID?: OutboxID
  readonly previewHeight?: number
  readonly previewURL?: string
  readonly previewWidth?: number
  readonly prover?: string
  readonly reactions?: Reactions
  readonly submitState?: 'deleting' | 'editing' | 'pending' | 'failed'
  readonly timestamp: number
  readonly title?: string
  readonly transferErrMsg?: string
  readonly transferState?: MessageAttachmentTransferState
  readonly unfurls?: UnfurlMap
  // can be false for out of band calls like gallery load
  readonly conversationMessage?: boolean
}

// Message types have a lot of copy and paste. Originally I had this split out but this
// causes flow to get confused or makes the error messages a million times harder to understand
// Possibly as a result, some types have sentinel-valued fields hanging off them.

export interface MessagePlaceholder extends _MessageCommon {
  readonly type: 'placeholder'
}

export interface MessageJourneycard extends _MessageCommon {
  readonly type: 'journeycard'
  readonly cardType: T.RPCChat.JourneycardType
  readonly highlightMsgID: MessageID
  readonly openTeam: boolean
}

// We keep deleted messages around so the bookkeeping is simpler
export interface MessageDeleted extends _MessageCommon {
  readonly type: 'deleted'
}

export interface MessageReplyTo extends _MessageCommon {
  readonly type: MessageType
  readonly text?: HiddenString
}

export interface MessageText extends _MessageCommon {
  readonly botUsername?: string
  readonly decoratedText?: HiddenString
  readonly exploded: boolean
  readonly explodedBy: string // only if 'explode now' happened,
  readonly exploding: boolean
  readonly explodingTime: number
  readonly explodingUnreadable: boolean // if we can't read this message bc we have no keys,
  readonly inlinePaymentIDs?: ReadonlyArray<WalletTypes.PaymentID>
  readonly inlinePaymentSuccessful: boolean
  readonly flipGameID?: string
  readonly mentionsAt?: MentionsAt
  readonly mentionsChannel: MentionsChannel
  // this is actually a real Message type but with immutable the circular reference confuses TS, so only expose a small subset of the fields
  readonly replyTo?: MessageReplyTo
  readonly text: HiddenString
  readonly paymentInfo?: ChatPaymentInfo // If null, we are waiting on this from the service,
  readonly unfurls: undefined | UnfurlMap
  readonly type: 'text'
}

export type AttachmentType = 'image' | 'file' | 'audio'

export interface PreviewSpec {
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

export interface MessageAttachment extends _MessageCommon {
  readonly attachmentType: AttachmentType
  readonly audioAmps: undefined | ReadonlyArray<number>
  readonly audioDuration: number
  readonly decoratedText?: HiddenString
  readonly showPlayButton: boolean
  readonly fileURL: string
  readonly fileURLCached: boolean
  readonly previewURL: string
  readonly fileType: string // MIME type,
  readonly downloadPath?: string // string if downloaded,
  readonly exploded: boolean
  readonly explodedBy: string // only if 'explode now' happened,
  readonly exploding: boolean
  readonly explodingTime: number
  readonly explodingUnreadable: boolean // if we can't read this message bc we have no keys,
  readonly fileName: string
  readonly fileSize: number
  // id: MessageID  that of first attachment message, not second attachment-uploaded message,
  readonly inlineVideoPlayable: boolean
  readonly isCollapsed: boolean
  readonly previewHeight: number
  readonly previewWidth: number
  readonly fullHeight: number
  readonly fullWidth: number
  readonly previewTransferState?: 'downloading' // only for preview,
  readonly title: string
  readonly transferProgress: number // 0-1 // only for the file,
  readonly transferState?: MessageAttachmentTransferState
  readonly transferErrMsg?: string
  readonly type: 'attachment'
  readonly videoDuration?: string
}

export interface ChatRequestInfo {
  amount: string
  amountDescription: string
  asset: WalletTypes.Asset
  canceled: boolean
  currencyCode: string // set if asset === 'currency',
  done: boolean
  type: 'requestInfo'
  worthAtRequestTime: string
}

export interface MessageRequestPayment extends _MessageCommon {
  readonly note: HiddenString
  readonly requestID: RPCStellarTypes.KeybaseRequestID
  readonly requestInfo?: ChatRequestInfo // If null, we are waiting on this from the service,
  readonly type: 'requestPayment'
}

export interface ChatPaymentInfo {
  readonly accountID: WalletTypes.AccountID
  readonly amountDescription: string
  readonly delta: 'none' | 'increase' | 'decrease'
  readonly fromUsername: string
  readonly issuerDescription: string
  readonly note: HiddenString
  readonly paymentID: WalletTypes.PaymentID
  readonly sourceAmount: string
  readonly sourceAsset: WalletTypes.AssetDescription
  readonly status: WalletTypes.StatusSimplified
  readonly statusDescription: string
  readonly statusDetail: string
  readonly showCancel: boolean
  readonly toUsername: string
  readonly type: 'paymentInfo'
  readonly worth: string
  readonly worthAtSendTime: string
}

export interface MessageSendPayment extends _MessageCommon {
  readonly paymentInfo?: ChatPaymentInfo // If null, we are waiting on this from the service,
  readonly type: 'sendPayment'
}

// Note that all these MessageSystem* messages are generated by the sender's client
// at the time that the message is sent. Associated message data that relates to
// conversation (e.g. teamname, isAdmin) rather than the message may have changed since
// the message was created. Because of this it's probably more reliable to look at
// other places in the store to get that information when possible.
export interface MessageSystemInviteAccepted extends _MessageCommon {
  readonly adder: string
  readonly inviteType: 'none' | 'unknown' | 'keybase' | 'email' | 'sbs' | 'text'
  readonly invitee: string
  readonly inviter: string
  readonly team: string
  readonly role: TeamTypes.MaybeTeamRoleType
  readonly type: 'systemInviteAccepted'
}

export interface MessageSystemSBSResolved extends _MessageCommon {
  readonly assertionUsername: string
  readonly assertionService?: ServiceIdWithContact
  readonly prover: string
  readonly type: 'systemSBSResolved'
}

export interface MessageSystemSimpleToComplex extends _MessageCommon {
  readonly team: string
  readonly type: 'systemSimpleToComplex'
}

export interface MessageSystemCreateTeam extends _MessageCommon {
  readonly creator: string
  readonly team: string
  readonly type: 'systemCreateTeam'
}

export interface MessageSystemGitPush extends _MessageCommon {
  readonly pusher: string
  readonly pushType: RPCTypes.GitPushType
  readonly refs: undefined | ReadonlyArray<RPCTypes.GitRefMetadata>
  readonly repo: string
  readonly repoID: string
  readonly team: string
  readonly type: 'systemGitPush'
}

export interface MessageSystemAddedToTeam extends _MessageCommon {
  readonly addee: string
  readonly adder: string
  readonly bulkAdds: undefined | ReadonlyArray<string>
  readonly role: TeamTypes.MaybeTeamRoleType
  readonly team: string
  readonly type: 'systemAddedToTeam'
}

export interface MessageSystemJoined extends _MessageCommon {
  readonly joiners?: ReadonlyArray<string>
  readonly leavers?: ReadonlyArray<string>
  readonly type: 'systemJoined'
}

export interface MessageSystemLeft extends _MessageCommon {
  readonly type: 'systemLeft'
}

export interface MessageSystemChangeAvatar extends _MessageCommon {
  readonly team: string
  readonly type: 'systemChangeAvatar'
  readonly user: string
}

export interface MessageSystemNewChannel extends _MessageCommon {
  readonly text: HiddenString
  readonly type: 'systemNewChannel'
}

export interface MessageSystemText extends _MessageCommon {
  readonly text: HiddenString
  readonly type: 'systemText'
}

export interface MessageSetDescription extends _MessageCommon {
  readonly newDescription: HiddenString
  readonly type: 'setDescription'
}

export interface MessagePin extends _MessageCommon {
  readonly bodySummary: HiddenString
  readonly pinnedMessageID: MessageID
  readonly timestamp: number
  readonly type: 'pin'
}

export interface MessageSetChannelname extends _MessageCommon {
  readonly newChannelname: string
  readonly type: 'setChannelname'
}

export interface MessageSystemChangeRetention extends _MessageCommon {
  readonly isInherit: boolean
  readonly isTeam: boolean
  readonly membersType: T.RPCChat.ConversationMembersType
  readonly policy?: T.RPCChat.RetentionPolicy
  readonly type: 'systemChangeRetention'
  readonly user: string
  readonly you: string
}

export interface MessageSystemUsersAddedToConversation extends _MessageCommon {
  readonly usernames: ReadonlyArray<string>
  readonly type: 'systemUsersAddedToConversation'
}

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
