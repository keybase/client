// Types related to a message
// @flow
import * as Common from './common'
import * as I from 'immutable'
import HiddenString from '../../../util/hidden-string'
import type {DeviceType} from '../devices'

// TODO put back
// export opaque type MessageID: string = string
export type MessageID = number
export const numberToMessageID = (n: number): MessageID => n

// TODO opaque
export type Ordinal = number

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
  percentUploaded: number,
  previewHeight: number,
  previewWidth: number,
  timestamp: number,
  title: string,
  type: 'attachment',
}

export type MessageAttachment = I.RecordOf<_MessageAttachment>

// export type _MessageError = {|
// conversationIDKey: Common.ConversationIDKey,
// ordinal: Ordinal,
// type: 'error',
// // errorType unknown version, etc
// |}
// export type MessageError = I.RecordOf<_MessageError>

// export type _MessageSystem = {|
// conversationIDKey: Common.ConversationIDKey,
// ordinal: Ordinal,
// type: 'system',
// // systemType: joinLeft/etc
// |}
// export type MessageSystem = I.RecordOf<_MessageSystem>

export type Message = MessageText | MessageAttachment | MessageDeleted
// export type Message = I.RecordOf<_Message>
// | MessageError | MessageSystem
