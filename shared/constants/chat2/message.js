// Message related constants
// @flow
import * as DeviceTypes from '../types/devices'
import * as I from 'immutable'
import * as MessageTypes from '../types/chat2/message'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as Types from '../types/chat2'
import HiddenString from '../../util/hidden-string'
import clamp from 'lodash/clamp'
import {formatTimeForConversationList} from '../../util/timestamp'

// flow is geting confused
const makeMessageCommon = {
  author: '',
  conversationIDKey: '',
  deviceName: '',
  deviceRevokedAt: null,
  deviceType: 'mobile',
  hasBeenEdited: false,
  id: 0,
  ordinal: 0,
  timestamp: 0,
}

export const makeMessageDeleted: I.RecordFactory<MessageTypes._MessageDeleted> = I.Record({
  ...makeMessageCommon,
  type: 'deleted',
})

export const makeMessageText: I.RecordFactory<MessageTypes._MessageText> = I.Record({
  ...makeMessageCommon,
  mentionsAt: I.Set(),
  mentionsChannel: 'none',
  text: new HiddenString(''),
  type: 'text',
})

export const makeMessageAttachment: I.RecordFactory<MessageTypes._MessageAttachment> = I.Record({
  ...makeMessageCommon,
  attachmentType: 'other',
  durationMs: 0,
  filename: null,
  percentUploaded: 0,
  previewHeight: 0,
  previewWidth: 0,
  title: '',
  type: 'attachment',
})

const channelMentionToMentionsChannel = (channelMention: RPCChatTypes.ChannelMention) => {
  switch (channelMention) {
    case RPCChatTypes.remoteChannelMention.all:
      return 'all'
    case RPCChatTypes.remoteChannelMention.here:
      return 'here'
    default:
      return 'none'
  }
}

const maxAttachmentPreviewSize = 320
const clampAttachmentPreviewSize = (width: number, height: number) =>
  height > width
    ? {
        height: clamp(height || 0, 0, maxAttachmentPreviewSize),
        width: clamp(height || 0, 0, maxAttachmentPreviewSize) * width / (height || 1),
      }
    : {
        height: clamp(width || 0, 0, maxAttachmentPreviewSize) * height / (width || 1),
        width: clamp(width || 0, 0, maxAttachmentPreviewSize),
      }

export const uiMessageToMessage = (
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage
): ?Types.Message => {
  if (uiMessage.state === RPCChatTypes.chatUiMessageUnboxedState.valid && uiMessage.valid) {
    const m: RPCChatTypes.UIMessageValid = uiMessage.valid
    const common = {
      author: m.senderUsername,
      conversationIDKey,
      deviceName: m.senderDeviceName,
      deviceRevokedAt: m.senderDeviceRevokedAt,
      deviceType: DeviceTypes.stringToDeviceType(m.senderDeviceType),
      hasBeenEdited: m.superseded,
      id: m.messageID,
      ordinal: m.messageID,
      timestamp: m.ctime,
    }

    switch (m.messageBody.messageType) {
      case RPCChatTypes.commonMessageType.text:
        const rawText: string = (m.messageBody.text && m.messageBody.text.body) || ''
        return makeMessageText({
          ...common,
          mentionsAt: I.Set(m.atMentions || []),
          mentionsChannel: channelMentionToMentionsChannel(m.channelMention),
          text: new HiddenString(rawText),
        })
      case RPCChatTypes.commonMessageType.attachment: {
        const attachment = m.messageBody.attachment
        if (!attachment) {
          break // make an error
        }
        const {filename, title, mimeType, metadata} = attachment.object
        const metadataVideo =
          metadata.assetType === RPCChatTypes.localAssetMetadataType.video ? metadata.video : null
        const metadataImage =
          metadata.assetType === RPCChatTypes.localAssetMetadataType.image ? metadata.image : null
        const attachmentType = mimeType.indexOf('image') === 0 ? 'image' : 'other'
        const {width, height} = metadataVideo || metadataImage || {height: 0, width: 0}
        const {width: previewWidth = 0, height: previewHeight = 0} = clampAttachmentPreviewSize(width, height)
        const durationMs = (metadataVideo && metadataVideo.durationMs) || 0
        const percentUploaded = 0 // TODO

        return makeMessageAttachment({
          ...common,
          attachmentType,
          durationMs,
          filename,
          percentUploaded,
          previewHeight,
          previewWidth,
          title,
        })
      }

      // TODO
      // case RPCChatTypes.commonMessageType.join:
      // case RPCChatTypes.commonMessageType.leave:
      // case RPCChatTypes.commonMessageType.system:
      default:
        return null
    }
  }

  // TODO errors and unbox
  return null
}

// This is emoji aware hence all the weird ... stuff. See https://mathiasbynens.be/notes/javascript-unicode#iterating-over-symbols
const textSnippet = (message: ?string = '', max: number) =>
  // $FlowIssue flow doesn't understand spread + strings
  [...message.substring(0, max * 4).replace(/\s+/g, ' ')].slice(0, max).join('')

export const getSnippetTimestamp = (message: ?Types.Message) =>
  message ? formatTimeForConversationList(message.timestamp) : ''

export const getSnippetText = (message: ?Types.Message) => {
  if (!message) {
    return ''
  }
  switch (message.type) {
    case 'deleted':
      return '[deleted]'
    case 'attachment': {
      const m: Types.MessageAttachment = message
      return textSnippet(m.title || '[attachment]', 100)
    }
    // case 'System':
    case 'text': {
      const m: Types.MessageText = message
      return textSnippet(m.text.stringValue(), 100)
    }
    default:
      return ''
  }
}

export const getSnippetMessage = (
  messageMap: I.Map<Types.Ordinal, Types.Message>,
  messageOrdinals: I.List<Types.Ordinal>,
  conversationIDKey: Types.ConversationIDKey
) => {
  const messageOrdinal: ?Types.Ordinal = messageOrdinals.findLast(id => {
    const message: ?Types.Message = messageMap.get(id)
    if (!message) {
      return false
    }
    switch (message.type) {
      case 'text':
      case 'attachment':
        // case 'system':
        return true
      default:
        return false
    }
  })

  if (!messageOrdinal) {
    // Have a deleted one?
    const messageOrdinal = messageOrdinals.last()
    if (messageOrdinal) {
      const message = messageMap.get(messageOrdinal)
      return message
    }

    return null
  }
  return messageMap.get(messageOrdinal)
}

export const isOldestOrdinal = (ordinal: Types.Ordinal) => ordinal === 2
