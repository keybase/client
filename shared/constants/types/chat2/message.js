// Types related to a message
// @flow
import * as Common from './common'
import * as RPCTypes from '../rpc-gen'
import * as I from 'immutable'
import HiddenString from '../../../util/hidden-string'
import type {DeviceType} from '../devices'

export opaque type MessageID: number = number
export const numberToMessageID = (n: number): MessageID => n

export opaque type Ordinal = number
export const numberToOrdinal = (n: number): Ordinal => n
export const ordinalToNumber = (o: Ordinal): number => o

export opaque type OutboxID: string = string
export const stringToOutboxID = (s: string): OutboxID => s

// Bookkeep us trying to do these operations
type LocalState = null | 'deleting' | 'editing' | 'error' | 'pending'

type ChannelMention = 'none' | 'all' | 'here'

// Message types have a lot of copy and paste. Originally I had this split out but this
// causes flow to get confused or makes the error messages a million times harder to understand

// We keep deleted messages around so the bookkeeping is simpler
export type _MessageDeleted = {
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  deviceName: string,
  deviceRevokedAt: ?number,
  deviceType: DeviceType,
  hasBeenEdited: boolean,
  id: MessageID,
  ordinal: Ordinal,
  outboxID: ?OutboxID,
  timestamp: number,
  type: 'deleted',
}
export type MessageDeleted = I.RecordOf<_MessageDeleted>

export type _MessageText = {
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  deviceName: string,
  deviceRevokedAt: ?number,
  deviceType: DeviceType,
  hasBeenEdited: boolean,
  id: MessageID,
  localState: LocalState,
  mentionsAt: I.Set<string>,
  mentionsChannel: ChannelMention,
  ordinal: Ordinal,
  outboxID: ?OutboxID,
  text: HiddenString,
  timestamp: number,
  type: 'text',
}
export type MessageText = I.RecordOf<_MessageText>

type AttachmentType = 'image' | 'other'

export type _MessageAttachment = {
  attachmentType: AttachmentType,
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  deviceName: string,
  deviceRevokedAt: ?number,
  deviceType: DeviceType,
  durationMs: number,
  filename: ?string,
  hasBeenEdited: boolean,
  id: MessageID,
  localState: LocalState,
  ordinal: Ordinal,
  outboxID: ?OutboxID,
  percentUploaded: number,
  previewHeight: number,
  previewWidth: number,
  timestamp: number,
  title: string,
  type: 'attachment',
}
export type MessageAttachment = I.RecordOf<_MessageAttachment>

export type _MessageError = {
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  id: MessageID,
  ordinal: Ordinal,
  reason: string,
  timestamp: number,
  type: 'error',
}
export type MessageError = I.RecordOf<_MessageError>

export type _MessageSystemInviteAccepted = {
  adder: string,
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  id: MessageID,
  inviteType: 'none' | 'unknown' | 'keybase' | 'email' | 'sbs' | 'text',
  invitee: string,
  inviter: string,
  ordinal: Ordinal,
  team: string,
  timestamp: number,
  type: 'systemInviteAccepted',
}
export type MessageSystemInviteAccepted = I.RecordOf<_MessageSystemInviteAccepted>

export type _MessageSystemSimpleToComplex = {
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  id: MessageID,
  ordinal: Ordinal,
  timestamp: number,
  team: string,
  type: 'systemSimpleToComplex',
}
export type MessageSystemSimpleToComplex = I.RecordOf<_MessageSystemSimpleToComplex>

export type _MessageSystemGitPush = {
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  id: MessageID,
  ordinal: Ordinal,
  pusher: string,
  refs: Array<RPCTypes.GitRefMetadata>,
  repo: string,
  team: string,
  timestamp: number,
  type: 'systemGitPush',
}
export type MessageSystemGitPush = I.RecordOf<_MessageSystemGitPush>

export type _MessageSystemAddedToTeam = {
  addee: string,
  adder: string,
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  id: MessageID,
  isAdmin: boolean,
  ordinal: Ordinal,
  team: string,
  timestamp: number,
  type: 'systemAddedToTeam',
}
export type MessageSystemAddedToTeam = I.RecordOf<_MessageSystemAddedToTeam>

export type _MessageSystemJoined = {
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  id: MessageID,
  ordinal: Ordinal,
  timestamp: number,
  type: 'systemJoined',
}
export type MessageSystemJoined = I.RecordOf<_MessageSystemJoined>

export type _MessageSystemLeft = {
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  id: MessageID,
  ordinal: Ordinal,
  timestamp: number,
  type: 'systemLeft',
}
export type MessageSystemLeft = I.RecordOf<_MessageSystemLeft>

export type Message =
  | MessageAttachment
  | MessageDeleted
  | MessageError
  | MessageSystemAddedToTeam
  | MessageSystemGitPush
  | MessageSystemInviteAccepted
  | MessageSystemJoined
  | MessageSystemLeft
  | MessageSystemSimpleToComplex
  | MessageText
