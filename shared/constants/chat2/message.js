// Message related constants
// @flow
import * as DeviceTypes from '../types/devices'
import * as I from 'immutable'
import * as MessageTypes from '../types/chat2/message'
import * as RPCTypes from '../types/rpc-gen'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as Types from '../types/chat2'
import HiddenString from '../../util/hidden-string'
import clamp from 'lodash/clamp'
import {isMobile} from '../platform'
import type {TypedState} from '../reducer'

const makeMessageMinimum = {
  author: '',
  conversationIDKey: Types.stringToConversationIDKey(''),
  id: Types.numberToMessageID(0),
  ordinal: Types.numberToOrdinal(0),
  timestamp: 0,
}

const makeMessageCommon = {
  ...makeMessageMinimum,
  deviceName: '',
  deviceRevokedAt: null,
  deviceType: 'mobile',
  hasBeenEdited: false,
  outboxID: Types.stringToOutboxID(''),
}

export const makeMessageDeleted: I.RecordFactory<MessageTypes._MessageDeleted> = I.Record({
  ...makeMessageCommon,
  type: 'deleted',
})

export const makeMessageText: I.RecordFactory<MessageTypes._MessageText> = I.Record({
  ...makeMessageCommon,
  localState: null,
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
  localState: null,
  percentUploaded: 0,
  previewHeight: 0,
  previewWidth: 0,
  title: '',
  type: 'attachment',
})

const makeMessageSystemJoined: I.RecordFactory<MessageTypes._MessageSystemJoined> = I.Record({
  ...makeMessageMinimum,
  type: 'systemJoined',
})

const makeMessageSystemLeft: I.RecordFactory<MessageTypes._MessageSystemLeft> = I.Record({
  ...makeMessageMinimum,
  type: 'systemLeft',
})

const makeMessageSystemAddedToTeam: I.RecordFactory<MessageTypes._MessageSystemAddedToTeam> = I.Record({
  ...makeMessageMinimum,
  addee: '',
  adder: '',
  isAdmin: false,
  team: '',
  type: 'systemAddedToTeam',
})

const makeMessageSystemInviteAccepted: I.RecordFactory<MessageTypes._MessageSystemInviteAccepted> = I.Record({
  ...makeMessageMinimum,
  adder: '',
  author: '[Keybase]',
  inviteType: 'none',
  invitee: '',
  inviter: '',
  team: '',
  type: 'systemInviteAccepted',
})

const makeMessageSystemSimpleToComplex: I.RecordFactory<
  MessageTypes._MessageSystemSimpleToComplex
> = I.Record({
  ...makeMessageMinimum,
  team: '',
  type: 'systemSimpleToComplex',
})

const makeMessageSystemText: I.RecordFactory<MessageTypes._MessageSystemText> = I.Record({
  ...makeMessageMinimum,
  text: new HiddenString(''),
  type: 'systemText',
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

const uiMessageToSystemMessage = (minimum, body): ?Types.Message => {
  switch (body.systemType) {
    case RPCChatTypes.localMessageSystemType.addedtoteam: {
      // TODO @mikem admins is always empty?
      const {adder = '', addee = '', team = '', admins} = body.addedtoteam || {}
      const isAdmin = (admins || []).includes(minimum.author)
      return makeMessageSystemAddedToTeam({
        ...minimum,
        addee,
        adder,
        isAdmin,
        team,
      })
    }
    case RPCChatTypes.localMessageSystemType.inviteaddedtoteam: {
      const {
        invitee = 'someone',
        adder = 'someone',
        inviter = 'someone',
        team = '???',
        inviteType: iType = RPCTypes.teamsTeamInviteCategory.unknown,
      } =
        body.inviteaddedtoteam || {}
      let inviteType
      switch (iType) {
        case RPCTypes.teamsTeamInviteCategory.unknown:
          inviteType = 'unknown'
          break
        case RPCTypes.teamsTeamInviteCategory.none:
          inviteType = 'none'
          break
        case RPCTypes.teamsTeamInviteCategory.keybase:
          inviteType = 'keybase'
          break
        case RPCTypes.teamsTeamInviteCategory.email:
          inviteType = 'email'
          break
        case RPCTypes.teamsTeamInviteCategory.sbs:
          inviteType = 'sbs'
          break
        case RPCTypes.teamsTeamInviteCategory.seitan:
          inviteType = 'text'
          break
        default:
          // $FlowIssue : Flow gets confused here for some reason, unclear
          ;(iType: empty) // eslint-disable-line no-unused-expressions
          return null
      }
      // messageText = `${invitee} accepted an invite to join ${team}`
      return makeMessageSystemInviteAccepted({
        ...minimum,
        adder,
        inviteType,
        invitee,
        inviter,
        team,
      })
    }
    case RPCChatTypes.localMessageSystemType.complexteam: {
      const {team = ''} = body.complexteam || {}
      return makeMessageSystemSimpleToComplex({
        ...minimum,
        team,
      })
    }
    case RPCChatTypes.localMessageSystemType.createteam: {
      const {team = '???', creator = '????'} = body.createteam || {}
      return makeMessageSystemText({
        text: new HiddenString(`${creator} created a new team ${team}.`),
        ...minimum,
      })
    }
    case RPCChatTypes.localMessageSystemType.gitpush:
      return null
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(body.systemType: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return null
  }
}

export const uiMessageToMessage = (
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage
): ?Types.Message => {
  if (uiMessage.state === RPCChatTypes.chatUiMessageUnboxedState.valid && uiMessage.valid) {
    const m: RPCChatTypes.UIMessageValid = uiMessage.valid
    const minimum = {
      author: m.senderUsername,
      conversationIDKey,
      id: Types.numberToMessageID(m.messageID),
      ordinal: Types.numberToOrdinal(m.messageID),
      timestamp: m.ctime,
    }
    const common = {
      ...minimum,
      deviceName: m.senderDeviceName,
      deviceRevokedAt: m.senderDeviceRevokedAt,
      deviceType: DeviceTypes.stringToDeviceType(m.senderDeviceType),
      hasBeenEdited: m.superseded,
      outboxID: m.outboxID ? Types.stringToOutboxID(m.outboxID) : null,
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
      case RPCChatTypes.commonMessageType.join:
        return makeMessageSystemJoined(minimum)
      case RPCChatTypes.commonMessageType.leave:
        return makeMessageSystemLeft(minimum)
      case RPCChatTypes.commonMessageType.system:
        return m.messageBody.system ? uiMessageToSystemMessage(minimum, m.messageBody.system) : null
      case RPCChatTypes.commonMessageType.none:
        return null
      case RPCChatTypes.commonMessageType.edit:
        return null
      case RPCChatTypes.commonMessageType.delete:
        return null
      case RPCChatTypes.commonMessageType.metadata:
        return null
      case RPCChatTypes.commonMessageType.tlfname:
        return null
      case RPCChatTypes.commonMessageType.headline:
        return null
      case RPCChatTypes.commonMessageType.attachmentuploaded:
        return null
      case RPCChatTypes.commonMessageType.deletehistory:
        return null
      default:
        // eslint-disable-next-line no-unused-expressions
        ;(m.messageBody.messageType: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
        return null
    }
  }
  return null
}

function nextFractionalOrdinal(ord: Types.Ordinal): Types.Ordinal {
  // Mimic what the service does with outbox items
  return Types.numberToOrdinal(Types.ordinalToNumber(ord) + 0.001)
}

export const makePendingTextMessage = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey,
  text: HiddenString,
  outboxID: Types.OutboxID
) => {
  const lastOrindal =
    state.chat2.messageOrdinals.get(conversationIDKey, I.List()).last() || Types.numberToOrdinal(0)
  const ordinal = nextFractionalOrdinal(lastOrindal)

  return makeMessageText({
    author: state.config.username || '',
    conversationIDKey,
    deviceName: '',
    deviceType: isMobile ? 'mobile' : 'desktop',
    id: Types.numberToMessageID(0),
    localState: 'pending',
    ordinal,
    outboxID,
    text,
    timestamp: Date.now(),
  })
}

export const isOldestOrdinal = (ordinal: Types.Ordinal) => ordinal === 2

// Daemon doens't like ordinals and its not worth finding the last value value so just 'converting it' into a message id
export const getClientPrev = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  const lastOrdinal =
    state.chat2.messageOrdinals.get(conversationIDKey, I.SortedSet()).last() || Types.numberToOrdinal(0)
  return Math.floor(Types.ordinalToNumber(lastOrdinal))
}
