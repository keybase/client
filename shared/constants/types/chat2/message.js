// Types related to a message
// @flow
import * as Common from './common'
import * as I from 'immutable'
import HiddenString from '../../../util/hidden-string'
import type {DeviceType} from '../devices'

// TODO put back
// export opaque type MessageID: string = string
export type ID = number
export const numberToMessageID = (n: number): ID => n

// TODO opaque
export type Ordinal = number

type ChannelMention = 'none' | 'all' | 'here'

type _MessageCommon = {
  author: string,
  conversationIDKey: Common.ConversationIDKey,
  deviceName: string,
  deviceRevokedAt: ?number,
  deviceType: DeviceType,
  id: ID,
  hasBeenEdited: boolean,
  ordinal: Ordinal,
  timestamp: number,
}

export type _MessageText = _MessageCommon & {
  type: 'text',
  mentionsAt: I.Set<string>,
  mentionsChannel: ChannelMention,
  text: HiddenString,
}
export type MessageText = I.RecordOf<_MessageText>

type AttachmentType = 'image' | 'other'

export type _MessageAttachment = _MessageCommon & {
  type: 'attachment',
  attachmentType: AttachmentType,
  durationMs: number,
  filename: ?string,
  percentUploaded: number,
  previewHeight: number,
  previewWidth: number,
  title: string,
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

export type Message = MessageText | MessageAttachment
// export type Message = I.RecordOf<_Message>
// | MessageError | MessageSystem
