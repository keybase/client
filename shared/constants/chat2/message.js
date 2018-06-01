// Message related constants
// @flow
import * as DeviceTypes from '../types/devices'
import * as I from 'immutable'
import * as MessageTypes from '../types/chat2/message'
import * as RPCTypes from '../types/rpc-gen'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as Types from '../types/chat2'
import HiddenString from '../../util/hidden-string'
import {clamp} from 'lodash-es'
import {isMobile} from '../platform'
import type {TypedState} from '../reducer'
import {noConversationIDKey} from '../types/chat2/common'

export const getMessageID = (m: RPCChatTypes.UIMessage) => {
  switch (m.state) {
    case RPCChatTypes.chatUiMessageUnboxedState.valid:
      return m.valid ? m.valid.messageID : null
    case RPCChatTypes.chatUiMessageUnboxedState.error:
      return m.error ? m.error.messageID : null
    case RPCChatTypes.chatUiMessageUnboxedState.placeholder:
      return m.placeholder ? m.placeholder.messageID : null
    default:
      return null
  }
}

const makeMessageMinimum = {
  author: '',
  conversationIDKey: noConversationIDKey,
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

const makeMessageExplodable = {
  exploded: false,
  explodedBy: '',
  exploding: false,
  explodingTime: Date.now(),
  explodingUnreadable: false,
}

export const makeMessagePlaceholder: I.RecordFactory<MessageTypes._MessagePlaceholder> = I.Record({
  ...makeMessageCommon,
  type: 'placeholder',
})

export const makeMessageDeleted: I.RecordFactory<MessageTypes._MessageDeleted> = I.Record({
  ...makeMessageCommon,
  type: 'deleted',
})

export const makeMessageText: I.RecordFactory<MessageTypes._MessageText> = I.Record({
  ...makeMessageCommon,
  ...makeMessageExplodable,
  mentionsAt: I.Set(),
  mentionsChannel: 'none',
  mentionsChannelName: I.Map(),
  submitState: null,
  text: new HiddenString(''),
  type: 'text',
})

export const makeMessageAttachment: I.RecordFactory<MessageTypes._MessageAttachment> = I.Record({
  ...makeMessageCommon,
  ...makeMessageExplodable,
  attachmentType: 'file',
  downloadPath: null,
  fileName: '',
  fileSize: 0,
  fileType: '',
  fileURL: '',
  previewHeight: 0,
  previewTransferState: null,
  previewURL: '',
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

const makeMessageSetDescription: I.RecordFactory<MessageTypes._MessageSetDescription> = I.Record({
  ...makeMessageMinimum,
  newDescription: new HiddenString(''),
  type: 'setDescription',
})

const makeMessageSetChannelname: I.RecordFactory<MessageTypes._MessageSetChannelname> = I.Record({
  ...makeMessageMinimum,
  newChannelname: '',
  type: 'setChannelname',
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

export const uiMessageEditToMessage = (
  edit: RPCChatTypes.MessageEdit,
  valid: RPCChatTypes.UIMessageValid
) => {
  const text = new HiddenString(edit.body || '')

  const mentionsAt = I.Set(valid.atMentions || [])
  const mentionsChannel = channelMentionToMentionsChannel(valid.channelMention)
  const mentionsChannelName = I.Map(
    (valid.channelNameMentions || []).map(men => [men.name, Types.stringToConversationIDKey(men.convID)])
  )

  return {
    mentionsAt,
    mentionsChannel,
    mentionsChannelName,
    messageID: edit.messageID,
    text,
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
      const inviteaddedtoteam = body.inviteaddedtoteam || {}
      const invitee = inviteaddedtoteam.invitee || 'someone'
      const adder = inviteaddedtoteam.adder || 'someone'
      const inviter = inviteaddedtoteam.inviter || 'someone'
      const team = inviteaddedtoteam.team || '???'
      const iType = inviteaddedtoteam.inviteType || RPCTypes.teamsTeamInviteCategory.unknown
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
          /*::
          // $FlowIssue flow gets confused about this switch statement
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(iType);
      */
          inviteType = 'unknown'
          break
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
    case RPCChatTypes.localMessageSystemType.changeavatar: {
      const {user = '???'} = body.changeavatar || {}
      return makeMessageSystemText({
        text: new HiddenString(`${user} changed team avatar`),
        ...minimum,
      })
    }
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(body.systemType);
      */
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
    exploded: m.isEphemeralExpired,
    explodedBy: m.explodedBy || '',
    exploding: m.isEphemeral,
    explodingTime: m.etime,
    outboxID: m.outboxID ? Types.stringToOutboxID(m.outboxID) : null,
  }

  if (m.isEphemeralExpired) {
    // This message already exploded. Make it an empty text message.
    return makeMessageText({...common})
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
      let transferState = null

      if (m.messageBody.messageType === RPCChatTypes.commonMessageType.attachment) {
        attachment = m.messageBody.attachment || {}
        preview =
          attachment.preview ||
          (attachment.previews && attachment.previews.length ? attachment.previews[0] : null)
        if (!attachment.uploaded) {
          transferState = 'remoteUploading'
        }
      } else if (m.messageBody.messageType === RPCChatTypes.commonMessageType.attachmentuploaded) {
        attachment = m.messageBody.attachmentuploaded || {}
        preview = attachment.previews && attachment.previews.length ? attachment.previews[0] : null
        transferState = null
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
      let previewURL = ''
      let fileURL = ''
      let fileType = ''
      if (m.assetUrlInfo) {
        previewURL = m.assetUrlInfo.previewUrl
        fileURL = m.assetUrlInfo.fullUrl
        fileType = m.assetUrlInfo.mimeType
      }

      return makeMessageAttachment({
        ...common,
        attachmentType,
        fileName: filename,
        fileSize: size,
        previewHeight,
        previewWidth,
        title,
        transferState,
        previewURL,
        fileURL,
        fileType,
      })
    }
    case RPCChatTypes.commonMessageType.join:
      return makeMessageSystemJoined(minimum)
    case RPCChatTypes.commonMessageType.leave:
      return makeMessageSystemLeft(minimum)
    case RPCChatTypes.commonMessageType.system:
      return m.messageBody.system ? uiMessageToSystemMessage(minimum, m.messageBody.system) : null
    case RPCChatTypes.commonMessageType.headline:
      return m.messageBody.headline
        ? makeMessageSetDescription({
            ...minimum,
            newDescription: new HiddenString(m.messageBody.headline.headline),
          })
        : null
    case RPCChatTypes.commonMessageType.metadata:
      return m.messageBody.metadata
        ? makeMessageSetChannelname({...minimum, newChannelname: m.messageBody.metadata.conversationTitle})
        : null
    case RPCChatTypes.commonMessageType.none:
      return null
    case RPCChatTypes.commonMessageType.edit:
      return null
    case RPCChatTypes.commonMessageType.delete:
      return null
    case RPCChatTypes.commonMessageType.tlfname:
      return null
    case RPCChatTypes.commonMessageType.deletehistory:
      return null
    default:
      /*::
      // $FlowIssue flow gets confused by the fallthroughs
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(m.messageBody.messageType);
      */
      return null
  }
}

export const rpcErrorToString = (error: RPCChatTypes.OutboxStateError) => {
  switch (error.typ) {
    case RPCChatTypes.localOutboxErrorType.misc:
      return error.message || 'unknown error'
    case RPCChatTypes.localOutboxErrorType.offline:
      return 'disconnected from chat server'
    case RPCChatTypes.localOutboxErrorType.identify:
      return 'proofs failed for recipient user'
    case RPCChatTypes.localOutboxErrorType.toolong:
      return 'message is too long'
    case RPCChatTypes.localOutboxErrorType.duplicate:
      return 'message already sent'
    case RPCChatTypes.localOutboxErrorType.expired:
      return 'took too long to send'
    default:
      return `${error.message || ''} (code: ${error.typ})`
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
    submitState: 'pending',
    text: new HiddenString(o.body),
    timestamp: o.ctime,
  })
}

const placeholderUIMessageToMessage = (
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage,
  p: RPCChatTypes.MessageUnboxedPlaceholder
) => {
  return !p.hidden
    ? makeMessagePlaceholder({
        conversationIDKey,
        id: Types.numberToMessageID(p.messageID),
        ordinal: Types.numberToOrdinal(p.messageID),
      })
    : makeMessageDeleted({
        conversationIDKey,
        id: Types.numberToMessageID(p.messageID),
        ordinal: Types.numberToOrdinal(p.messageID),
      })
}

const errorUIMessagetoMessage = (
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage,
  o: RPCChatTypes.MessageUnboxedError
) => {
  return makeMessageText({
    author: o.senderUsername,
    conversationIDKey,
    deviceName: o.senderDeviceName,
    deviceType: DeviceTypes.stringToDeviceType(o.senderDeviceType),
    errorReason: o.errMsg,
    exploded: o.isEphemeralExpired,
    exploding: o.isEphemeral,
    explodingUnreadable: o.errType === RPCChatTypes.localMessageUnboxedErrorType.ephemeral,
    id: Types.numberToMessageID(o.messageID),
    ordinal: Types.numberToOrdinal(o.messageID),
    timestamp: o.ctime,
  })
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
      return null
    case RPCChatTypes.chatUiMessageUnboxedState.error:
      if (uiMessage.error) {
        return errorUIMessagetoMessage(conversationIDKey, uiMessage, uiMessage.error)
      }
      return null
    case RPCChatTypes.chatUiMessageUnboxedState.outbox:
      if (uiMessage.outbox) {
        return outboxUIMessagetoMessage(conversationIDKey, uiMessage, uiMessage.outbox, you, yourDevice)
      }
      return null
    case RPCChatTypes.chatUiMessageUnboxedState.placeholder:
      if (uiMessage.placeholder) {
        return placeholderUIMessageToMessage(conversationIDKey, uiMessage, uiMessage.placeholder)
      }
      return null
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(uiMessage.state);
      */
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
  outboxID: Types.OutboxID,
  explodeTime?: number
) => {
  // we could read the exploding mode for the convo from state here, but that
  // would cause the timer to count down while the message is still pending
  // and probably reset when we get the real message back.

  const lastOrdinal =
    state.chat2.messageOrdinals.get(conversationIDKey, I.List()).last() || Types.numberToOrdinal(0)
  const ordinal = nextFractionalOrdinal(lastOrdinal)

  const explodeInfo = explodeTime ? {exploding: true, explodingTime: Date.now() + explodeTime * 1000} : {}

  return makeMessageText({
    ...explodeInfo,
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
  previewURL: string,
  outboxID: Types.OutboxID,
  explodeTime?: number
) => {
  const lastOrdinal =
    state.chat2.messageOrdinals.get(conversationIDKey, I.List()).last() || Types.numberToOrdinal(0)
  const ordinal = nextFractionalOrdinal(lastOrdinal)

  const explodeInfo = explodeTime ? {exploding: true, explodingTime: Date.now() + explodeTime * 1000} : {}

  return makeMessageAttachment({
    ...explodeInfo,
    attachmentType,
    author: state.config.username || '',
    conversationIDKey,
    deviceName: '',
    previewURL,
    deviceType: isMobile ? 'mobile' : 'desktop',
    id: Types.numberToMessageID(0),
    ordinal,
    outboxID,
    submitState: 'pending',
    timestamp: Date.now(),
    title,
  })
}

// We only pass message ids to the service so let's just truncate it so a messageid-like value instead of searching back for it.
// this value is a hint to the service and how the ordinals work this is always a valid messageid
export const getClientPrev = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  const lastOrdinal =
    state.chat2.messageOrdinals.get(conversationIDKey, I.SortedSet()).last() || Types.numberToOrdinal(0)
  return Math.floor(Types.ordinalToNumber(lastOrdinal))
}

const imageFileNameRegex = /[^/]+\.(jpg|png|gif|jpeg|bmp)$/i
export const pathToAttachmentType = (path: string) => (imageFileNameRegex.test(path) ? 'image' : 'file')
export const isSpecialMention = (s: string) => ['here', 'channel', 'everyone'].includes(s)

export const upgradeMessage = (old: Types.Message, m: Types.Message) => {
  if (old.type === 'text' && m.type === 'text') {
    return m.withMutations((ret: Types.MessageText) => {
      ret.set('ordinal', old.ordinal)
    })
  }
  if (old.type === 'attachment' && m.type === 'attachment') {
    if (old.submitState === 'pending') {
      // we sent an attachment, service replied
      // with the real message. replace our placeholder but
      // hold on to the ordinal so it doesn't
      // jump in the conversation view
      // hold on to the previewURL so that we
      // don't show the gray box.
      return m.set('ordinal', old.ordinal).set('previewURL', old.previewURL)
    }
    return m.withMutations((ret: Types.MessageAttachment) => {
      // We got an attachment-uploaded message. Hold on to the old ID
      // because that's what the service expects to delete this message
      ret.set('id', old.id)
      ret.set('ordinal', old.ordinal)
      ret.set('downloadPath', old.downloadPath)
      if (old.previewURL && !m.previewURL) {
        ret.set('previewURL', old.previewURL)
      }
      if (old.transferState === 'remoteUploading') {
        ret.set('transferState', null)
      } else {
        ret.set('transferState', old.transferState)
      }
      ret.set('transferProgress', old.transferProgress)
    })
  }
  return m
}

export const messageExplodeDescriptions: Types.MessageExplodeDescription[] = [
  {text: 'Never', seconds: 0},
  {text: '30 seconds', seconds: 30},
  {text: '1 minute', seconds: 60},
  {text: '3 minutes', seconds: 180},
  {text: '10 minutes', seconds: 600},
  {text: '30 minutes', seconds: 600 * 3},
  {text: '1 hour', seconds: 3600},
  {text: '3 hours', seconds: 3600 * 3},
  {text: '12 hours', seconds: 3600 * 12},
  {text: '24 hours', seconds: 86400},
  {text: '3 days', seconds: 86400 * 3},
  {text: '7 days', seconds: 86400 * 7},
].reverse()
