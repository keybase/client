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
export type MessageOrdinal = number

type ChannelMention = 'None' | 'All' | 'Here'

export type _MessageText = {
  author: string,
  content: HiddenString,
  conversationIDKey: Common.ConversationIDKey,
  deviceName: string,
  deviceRevokedAt: ?number,
  deviceType: DeviceType,
  id: MessageID,
  mentionsAt: I.Set<string>,
  mentionsChannel: ChannelMention,
  ordinal: MessageOrdinal,
  timestamp: number,
  type: 'Text',
  // state: MessageState,
  // you: string,
  // rawMessageID: number,
  // failureDescription: ?string, // TODO move to error type?
  // outboxID?: ?OutboxIDKey, // needed?
  // key: MessageKey,
  // editedCount: number, // increase as we edit it
}
export type MessageText = I.RecordOf<_MessageText>

// TODO other types
export type Message = MessageText
