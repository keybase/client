// Message related constants
// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../types/flow-types-chat'
import * as Types from '../types/chat2'
import * as DeviceTypes from '../types/devices'
import HiddenString from '../../util/hidden-string'
// import type {TypedState} from '../reducer'
// import {toByteArray} from 'base64-js'

export const makeMessageText: I.RecordFactory<Types._MessageText> = I.Record({
  author: '',
  content: new HiddenString(''),
  conversationIDKey: '',
  deviceName: '',
  deviceRevokedAt: null,
  deviceType: 'mobile',
  id: 0,
  mentionsAt: I.Set(),
  mentionsChannel: 'None',
  ordinal: 0,
  timestamp: 0,
  type: 'Text',
})

const channelMentionToMentionsChannel = (channelMention: RPCChatTypes.ChannelMention) => {
  switch (channelMention) {
    case RPCChatTypes.remoteChannelMention.all:
      return 'All'
    case RPCChatTypes.remoteChannelMention.here:
      return 'Here'
    default:
      return 'None'
  }
}

export const uiMessageToMessage = (
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage
): ?Types.Message => {
  if (uiMessage.state === RPCChatTypes.chatUiMessageUnboxedState.valid && uiMessage.valid) {
    const m: RPCChatTypes.UIMessageValid = uiMessage.valid

    switch (m.messageBody.messageType) {
      case RPCChatTypes.commonMessageType.text:
        return makeMessageText({
          author: m.senderUsername,
          content: new HiddenString((m.messageBody && m.messageBody.text && m.messageBody.text.body) || ''),
          conversationIDKey,
          deviceName: m.senderDeviceName,
          deviceRevokedAt: m.senderDeviceRevokedAt,
          deviceType: DeviceTypes.stringToDeviceType(m.senderDeviceType),
          id: m.messageID,
          mentionsAt: I.Set(m.atMentions || []),
          mentionsChannel: channelMentionToMentionsChannel(m.channelMention),
          ordinal: m.messageID,
          timestamp: m.ctime,
        })
      default:
        // TODO other types attachment, etc
        return null
    }
  }

  // TODO errors and unbox
  return null
  // const common = {
  // channelMention: _parseChannelMention(m.channelMention),
  // conversationIDKey,
  // deviceName: payload.senderDeviceName,
  // deviceType: DeviceTypes.stringToDeviceType(payload.senderDeviceType),
  // failureDescription: null,
  // mentions: I.Set(payload.atMentions || []),
  // messageID: Constants.rpcMessageIDToMessageID(payload.messageID),
  // rawMessageID: payload.messageID,
  // outboxID: payload.outboxID && Constants.stringOutboxIDToKey(payload.outboxID),
  // senderDeviceRevokedAt: payload.senderDeviceRevokedAt,
  // timestamp: payload.ctime,
  // you: yourName,
  // ordinal: payload.messageID,
  // }
}
