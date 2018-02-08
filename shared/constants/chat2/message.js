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
  errorReason: null,
  hasBeenEdited: false,
  outboxID: Types.stringToOutboxID(''),
}

export const makeMessageDeleted: I.RecordFactory<MessageTypes._MessageDeleted> = I.Record({
  ...makeMessageCommon,
  type: 'deleted',
})

export const makeMessageText: I.RecordFactory<MessageTypes._MessageText> = I.Record({
  ...makeMessageCommon,
  mentionsAt: I.Set(),
  mentionsChannel: 'none',
  mentionsChannelName: I.Map(),
  submitState: null,
  text: new HiddenString(''),
  type: 'text',
})

export const makeMessageAttachment: I.RecordFactory<MessageTypes._MessageAttachment> = I.Record({
  ...makeMessageCommon,
  attachmentType: 'file',
  deviceFilePath: '',
  devicePreviewPath: '',
  downloadPath: null,
  fileName: '',
  fileSize: 0,
  previewHeight: 0,
  previewTransferState: null,
  previewWidth: 0,
  submitState: null,
  title: '',
  transferProgress: 0,
  transferState: null,
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

const makeMessageSystemGitPush: I.RecordFactory<MessageTypes._MessageSystemGitPush> = I.Record({
  ...makeMessageMinimum,
  pusher: '',
  refs: [],
  repo: '',
  repoID: '',
  team: '',
  type: 'systemGitPush',
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
    case RPCChatTypes.localMessageSystemType.gitpush: {
      const {team = '???', pusher = '???', repoName: repo = '???', repoID = '???', refs} = body.gitpush || {}
      return makeMessageSystemGitPush({
        ...minimum,
        pusher,
        refs: refs || [],
        repo,
        repoID,
        team,
      })
    }
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(body.systemType: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return null
  }
}

const maxAttachmentPreviewSize = 320
const clampAttachmentPreviewSize = ({width = 0, height = 0}) =>
  height > width
    ? {
        height: clamp(height || 0, 0, maxAttachmentPreviewSize),
        width: clamp(height || 0, 0, maxAttachmentPreviewSize) * width / (height || 1),
      }
    : {
        height: clamp(width || 0, 0, maxAttachmentPreviewSize) * height / (width || 1),
        width: clamp(width || 0, 0, maxAttachmentPreviewSize),
      }

const validUIMessagetoMessage = (
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage,
  m: RPCChatTypes.UIMessageValid
) => {
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
    outboxID: m.outboxID ? Types.stringToOutboxID(m.outboxID) : null,
  }

  switch (m.messageBody.messageType) {
    case RPCChatTypes.commonMessageType.text:
      const rawText: string = (m.messageBody.text && m.messageBody.text.body) || ''
      return makeMessageText({
        ...common,
        hasBeenEdited: m.superseded,
        mentionsAt: I.Set(m.atMentions || []),
        mentionsChannel: channelMentionToMentionsChannel(m.channelMention),
        mentionsChannelName: I.Map(
          (m.channelNameMentions || []).map(men => [men.name, Types.stringToConversationIDKey(men.convID)])
        ),
        text: new HiddenString(rawText),
      })
    case RPCChatTypes.commonMessageType.attachmentuploaded: // fallthrough
    case RPCChatTypes.commonMessageType.attachment: {
      // The attachment flow is currently pretty complicated. We'll have core do more of this so it'll be simpler but for now
      // 1. On thread load we only get attachment type. It'll have full data
      // 2. On incoming we get attachment first (placeholder), then we get the full data (attachmentuploaded)
      // 3. When we send we place a pending attachment, then get the real attachment then attachmentuploaded
      // We treat all these like a pending text, so any data-less thing will have no message id and map to the same ordinal
      let attachment = {}
      let preview: ?RPCChatTypes.Asset

      if (m.messageBody.messageType === RPCChatTypes.commonMessageType.attachment) {
        attachment = m.messageBody.attachment || {}
        preview =
          attachment.preview ||
          (attachment.previews && attachment.previews.length ? attachment.previews[0] : null)
      } else if (m.messageBody.messageType === RPCChatTypes.commonMessageType.attachmentuploaded) {
        attachment = m.messageBody.attachmentuploaded || {}
        preview = attachment.previews && attachment.previews.length ? attachment.previews[0] : null
      }
      const {filename, title, size} = attachment.object
      let previewHeight = 0
      let previewWidth = 0
      let attachmentType = 'file'

      if (preview && preview.metadata) {
        if (
          preview.metadata.assetType === RPCChatTypes.localAssetMetadataType.image &&
          preview.metadata.image
        ) {
          const wh = clampAttachmentPreviewSize(preview.metadata.image)
          previewHeight = wh.height
          previewWidth = wh.width
          attachmentType = 'image'
        } else if (
          preview.metadata.assetType === RPCChatTypes.localAssetMetadataType.video &&
          preview.metadata.video
        ) {
          const wh = clampAttachmentPreviewSize(preview.metadata.video)
          previewHeight = wh.height
          previewWidth = wh.width
          attachmentType = 'image'
        }
      }

      // attachmentuploaded is basically an 'edit' of an attachment w/ no data
      const ordinal =
        m.messageBody.messageType === RPCChatTypes.commonMessageType.attachmentuploaded &&
        m.messageBody.attachmentuploaded &&
        m.messageBody.attachmentuploaded.messageID
          ? Types.numberToOrdinal(m.messageBody.attachmentuploaded.messageID)
          : common.ordinal

      // make placeholders not have an id so we can override it correctly
      const id = filename ? common.id : Types.numberToMessageID(0)
      return makeMessageAttachment({
        ...common,
        attachmentType,
        fileName: filename,
        fileSize: size,
        id,
        ordinal,
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
    case RPCChatTypes.commonMessageType.deletehistory:
      return null
    default:
      // normally we'd have this but flow gets confused about the fallthrough
      // ;(m.messageBody.messageType: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return null
  }
}

export const rpcErrorToString = (error: RPCChatTypes.OutboxStateError) => {
  switch (error.typ) {
    case RPCChatTypes.localOutboxErrorType.misc:
      return 'unknown error'
    case RPCChatTypes.localOutboxErrorType.offline:
      return 'disconnected from chat server'
    case RPCChatTypes.localOutboxErrorType.identify:
      return 'proofs failed for recipient user'
    case RPCChatTypes.localOutboxErrorType.toolong:
      return 'message is too long'
    default:
      return `unknown error type ${error.typ || ''} ${error.message || ''}`
  }
}

const outboxUIMessagetoMessage = (
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage,
  o: RPCChatTypes.UIMessageOutbox,
  you: string,
  yourDevice: string
) => {
  const errorReason =
    o.state && o.state.state === RPCChatTypes.localOutboxStateType.error && o.state.error
      ? rpcErrorToString(o.state.error)
      : null

  return makeMessageText({
    author: you,
    conversationIDKey,
    deviceName: yourDevice,
    deviceType: isMobile ? 'mobile' : 'desktop',
    errorReason,
    ordinal: Types.numberToOrdinal(o.ordinal),
    outboxID: Types.stringToOutboxID(o.outboxID),
    text: new HiddenString(o.body),
    timestamp: o.ctime,
  })
}

const errorUIMessagetoMessage = (
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage,
  o: RPCChatTypes.MessageUnboxedError
) => {
  return null
}

export const uiMessageToMessage = (
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage,
  you: string,
  yourDevice: string
): ?Types.Message => {
  switch (uiMessage.state) {
    case RPCChatTypes.chatUiMessageUnboxedState.valid:
      if (uiMessage.valid) {
        return validUIMessagetoMessage(conversationIDKey, uiMessage, uiMessage.valid)
      }
      break
    case RPCChatTypes.chatUiMessageUnboxedState.error:
      if (uiMessage.error) {
        return errorUIMessagetoMessage(conversationIDKey, uiMessage, uiMessage.error)
      }
      break
    case RPCChatTypes.chatUiMessageUnboxedState.outbox:
      if (uiMessage.outbox) {
        return outboxUIMessagetoMessage(conversationIDKey, uiMessage, uiMessage.outbox, you, yourDevice)
      }
      break
    case RPCChatTypes.chatUiMessageUnboxedState.placeholder:
      return null
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(uiMessage.state: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return null
  }
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
    ordinal,
    outboxID,
    submitState: 'pending',
    text,
    timestamp: Date.now(),
  })
}

export const makePendingAttachmentMessage = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey,
  attachmentType: Types.AttachmentType,
  title: string,
  devicePreviewPath: string,
  outboxID: Types.OutboxID
) => {
  const lastOrindal =
    state.chat2.messageOrdinals.get(conversationIDKey, I.List()).last() || Types.numberToOrdinal(0)
  const ordinal = nextFractionalOrdinal(lastOrindal)

  return makeMessageAttachment({
    attachmentType,
    author: state.config.username || '',
    conversationIDKey,
    deviceName: '',
    devicePreviewPath,
    deviceType: isMobile ? 'mobile' : 'desktop',
    id: Types.numberToMessageID(0),
    ordinal,
    outboxID,
    submitState: 'pending',
    timestamp: Date.now(),
    title,
  })
}

export const isOldestOrdinal = (ordinal: Types.Ordinal) => Types.ordinalToNumber(ordinal) <= 2

// Daemon doens't like ordinals and its not worth finding the last value value so just 'converting it' into a message id
export const getClientPrev = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  const lastOrdinal =
    state.chat2.messageOrdinals.get(conversationIDKey, I.SortedSet()).last() || Types.numberToOrdinal(0)
  return Math.floor(Types.ordinalToNumber(lastOrdinal))
}

const imageFileNameRegex = /[^/]+\.(jpg|png|gif|jpeg|bmp)$/
export const pathToAttachmentType = (path: string) => (imageFileNameRegex.test(path) ? 'image' : 'file')
