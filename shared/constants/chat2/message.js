// Message related constants
// @flow
import * as DeviceTypes from '../types/devices'
import * as I from 'immutable'
import * as MessageTypes from '../types/chat2/message'
import * as Flow from '../../util/flow'
import * as RPCTypes from '../types/rpc-gen'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCStellarTypes from '../types/rpc-stellar-gen'
import * as Types from '../types/chat2'
import * as FsTypes from '../types/fs'
import * as WalletConstants from '../wallets'
import * as WalletTypes from '../types/wallets'
import HiddenString from '../../util/hidden-string'
import {clamp} from 'lodash-es'
import {isMobile} from '../platform'
import type {TypedState} from '../reducer'
import {noConversationIDKey} from '../types/chat2/common'
import logger from '../../logger'

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

export const getRequestMessageInfo = (
  state: TypedState,
  message: Types.MessageRequestPayment
): ?MessageTypes.ChatRequestInfo => {
  const maybeRequestInfo = state.chat2.getIn(['accountsInfoMap', message.conversationIDKey, message.id], null)
  if (!maybeRequestInfo) {
    return message.requestInfo
  }
  if (maybeRequestInfo.type === 'requestInfo') {
    return maybeRequestInfo
  }
  throw new Error(
    `Found impossible type ${maybeRequestInfo.type} in info meant for requestPayment message. convID: ${
      message.conversationIDKey
    } msgID: ${message.id}`
  )
}

export const getPaymentMessageInfo = (
  state: TypedState,
  message: Types.MessageSendPayment
): ?MessageTypes.ChatPaymentInfo => {
  const maybePaymentInfo = state.chat2.getIn(['accountsInfoMap', message.conversationIDKey, message.id], null)
  if (!maybePaymentInfo) {
    return message.paymentInfo
  }
  if (maybePaymentInfo.type === 'paymentInfo') {
    return maybePaymentInfo
  }
  throw new Error(
    `Found impossible type ${maybePaymentInfo.type} in info meant for sendPayment message. convID: ${
      message.conversationIDKey
    } msgID: ${message.id}`
  )
}

export const isPendingPaymentMessage = (state: TypedState, message: Types.Message) => {
  if (message.type !== 'sendPayment') {
    return false
  }
  const paymentInfo = getPaymentMessageInfo(state, message)
  return !!(paymentInfo && paymentInfo.status === 'pending')
}

// Map service message types to our message types.
export const serviceMessageTypeToMessageTypes = (t: RPCChatTypes.MessageType): Array<Types.MessageType> => {
  switch (t) {
    case RPCChatTypes.commonMessageType.text:
      return ['text']
    case RPCChatTypes.commonMessageType.attachment:
      return ['attachment']
    case RPCChatTypes.commonMessageType.metadata:
      return ['setDescription']
    case RPCChatTypes.commonMessageType.headline:
      return ['setChannelname']
    case RPCChatTypes.commonMessageType.attachmentuploaded:
      return ['attachment']
    case RPCChatTypes.commonMessageType.join:
      return ['systemJoined']
    case RPCChatTypes.commonMessageType.leave:
      return ['systemLeft']
    case RPCChatTypes.commonMessageType.system:
      return [
        'systemAddedToTeam',
        'systemChangeRetention',
        'systemGitPush',
        'systemInviteAccepted',
        'systemSimpleToComplex',
        'systemText',
      ]
    case RPCChatTypes.commonMessageType.sendpayment:
      return ['sendPayment']
    case RPCChatTypes.commonMessageType.requestpayment:
      return ['requestPayment']
    // mutations and other types we don't store directly
    case RPCChatTypes.commonMessageType.none:
    case RPCChatTypes.commonMessageType.edit:
    case RPCChatTypes.commonMessageType.delete:
    case RPCChatTypes.commonMessageType.tlfname:
    case RPCChatTypes.commonMessageType.deletehistory:
    case RPCChatTypes.commonMessageType.reaction:
    case RPCChatTypes.commonMessageType.unfurl:
      return []
    default:
      // $FlowIssue need these to be opaque types
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(t)
      return []
  }
}
export const allMessageTypes: I.Set<Types.MessageType> = I.Set([
  'attachment',
  'deleted',
  'setChannelname',
  'setDescription',
  'systemAddedToTeam',
  'systemChangeRetention',
  'systemGitPush',
  'systemInviteAccepted',
  'systemJoined',
  'systemLeft',
  'systemSimpleToComplex',
  'systemText',
  'text',
  'placeholder',
])
export const getDeletableByDeleteHistory = (state: TypedState) =>
  (!!state.chat2.staticConfig && state.chat2.staticConfig.deletableByDeleteHistory) || allMessageTypes

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

export const howLongBetweenTimestampsMs: number = 1000 * 60 * 15

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
  decoratedText: null,
  inlinePaymentIDs: null,
  inlinePaymentSuccessful: false,
  mentionsAt: I.Set(),
  mentionsChannel: 'none',
  mentionsChannelName: I.Map(),
  reactions: I.Map(),
  submitState: null,
  text: new HiddenString(''),
  type: 'text',
  unfurls: I.Map(),
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
  fileURLCached: false,
  inlineVideoPlayable: false,
  isCollapsed: false,
  previewHeight: 0,
  previewTransferState: null,
  previewURL: '',
  previewWidth: 0,
  reactions: I.Map(),
  showPlayButton: false,
  submitState: null,
  title: '',
  transferProgress: 0,
  transferState: null,
  type: 'attachment',
  videoDuration: null,
})

export const makeChatRequestInfo: I.RecordFactory<MessageTypes._ChatRequestInfo> = I.Record({
  amount: '',
  amountDescription: '',
  asset: 'native',
  canceled: false,
  currencyCode: '',
  done: false,
  type: 'requestInfo',
  worthAtRequestTime: '',
})

export const makeMessageRequestPayment: I.RecordFactory<MessageTypes._MessageRequestPayment> = I.Record({
  ...makeMessageCommon,
  note: new HiddenString(''),
  reactions: I.Map(),
  requestID: '',
  requestInfo: null,
  type: 'requestPayment',
})

export const makeChatPaymentInfo: I.RecordFactory<MessageTypes._ChatPaymentInfo> = I.Record({
  accountID: WalletTypes.noAccountID,
  amountDescription: '',
  delta: 'none',
  fromUsername: '',
  note: new HiddenString(''),
  paymentID: WalletTypes.noPaymentID,
  showCancel: false,
  status: 'none',
  statusDescription: '',
  statusDetail: '',
  toUsername: '',
  type: 'paymentInfo',
  worth: '',
  worthAtSendTime: '',
})

export const makeMessageSendPayment: I.RecordFactory<MessageTypes._MessageSendPayment> = I.Record({
  ...makeMessageCommon,
  paymentInfo: null,
  reactions: I.Map(),
  type: 'sendPayment',
})

const makeMessageSystemJoined: I.RecordFactory<MessageTypes._MessageSystemJoined> = I.Record({
  ...makeMessageMinimum,
  reactions: I.Map(),
  type: 'systemJoined',
})

const makeMessageSystemLeft: I.RecordFactory<MessageTypes._MessageSystemLeft> = I.Record({
  ...makeMessageMinimum,
  reactions: I.Map(),
  type: 'systemLeft',
})

const makeMessageSystemAddedToTeam: I.RecordFactory<MessageTypes._MessageSystemAddedToTeam> = I.Record({
  ...makeMessageMinimum,
  addee: '',
  adder: '',
  isAdmin: false,
  reactions: I.Map(),
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
  reactions: I.Map(),
  team: '',
  type: 'systemInviteAccepted',
})

const makeMessageSystemSimpleToComplex: I.RecordFactory<MessageTypes._MessageSystemSimpleToComplex> = I.Record(
  {
    ...makeMessageMinimum,
    reactions: I.Map(),
    team: '',
    type: 'systemSimpleToComplex',
  }
)

const makeMessageSystemText: I.RecordFactory<MessageTypes._MessageSystemText> = I.Record({
  ...makeMessageMinimum,
  reactions: I.Map(),
  text: new HiddenString(''),
  type: 'systemText',
})

const makeMessageSystemGitPush: I.RecordFactory<MessageTypes._MessageSystemGitPush> = I.Record({
  ...makeMessageMinimum,
  pushType: 0,
  pusher: '',
  reactions: I.Map(),
  refs: [],
  repo: '',
  repoID: '',
  team: '',
  type: 'systemGitPush',
})

const makeMessageSetDescription: I.RecordFactory<MessageTypes._MessageSetDescription> = I.Record({
  ...makeMessageMinimum,
  newDescription: new HiddenString(''),
  reactions: I.Map(),
  type: 'setDescription',
})

const makeMessageSetChannelname: I.RecordFactory<MessageTypes._MessageSetChannelname> = I.Record({
  ...makeMessageMinimum,
  newChannelname: '',
  reactions: I.Map(),
  type: 'setChannelname',
})

const makeMessageSystemChangeRetention: I.RecordFactory<MessageTypes._MessageSystemChangeRetention> = I.Record(
  {
    ...makeMessageMinimum,
    canChange: false,
    isInherit: false,
    isTeam: false,
    membersType: 0,
    policy: RPCChatTypes.RetentionPolicy,
    reactions: I.Map(),
    type: 'systemChangeRetention',
    user: '',
    you: '',
  }
)

export const makeReaction: I.RecordFactory<MessageTypes._Reaction> = I.Record({
  timestamp: 0,
  username: '',
})

export const uiRequestInfoToChatRequestInfo = (
  r: ?RPCChatTypes.UIRequestInfo
): ?MessageTypes.ChatRequestInfo => {
  if (!r) {
    return null
  }
  let asset = 'native'
  let currencyCode = ''
  if (!(r.asset || r.currency)) {
    logger.error('Received UIRequestInfo with no asset or currency code')
    return null
  } else if (r.asset && r.asset.type !== 'native') {
    const assetResult = r.asset
    asset = WalletConstants.makeAssetDescription({
      code: assetResult.code,
      issuerAccountID: WalletTypes.stringToAccountID(assetResult.issuer),
      issuerName: assetResult.issuerName,
      issuerVerifiedDomain: assetResult.verifiedDomain,
    })
  } else if (r.currency) {
    asset = 'currency'
    currencyCode = r.currency
  }
  return makeChatRequestInfo({
    amount: r.amount,
    amountDescription: r.amountDescription,
    asset,
    canceled: r.status === RPCStellarTypes.commonRequestStatus.canceled,
    currencyCode,
    done: r.status === RPCStellarTypes.commonRequestStatus.done,
    worthAtRequestTime: r.worthAtRequestTime,
  })
}

export const uiPaymentInfoToChatPaymentInfo = (
  ps: ?Array<RPCChatTypes.UIPaymentInfo>
): ?MessageTypes.ChatPaymentInfo => {
  if (!ps || ps.length !== 1) {
    return null
  }
  const p = ps[0]
  const serviceStatus = WalletConstants.statusSimplifiedToString[p.status]
  return makeChatPaymentInfo({
    accountID: p.accountID ? WalletTypes.stringToAccountID(p.accountID) : WalletTypes.noAccountID,
    amountDescription: p.amountDescription,
    delta: WalletConstants.balanceDeltaToString[p.delta],
    fromUsername: p.fromUsername,
    note: new HiddenString(p.note),
    paymentID: WalletTypes.rpcPaymentIDToPaymentID(p.paymentID),
    showCancel: p.showCancel,
    status: serviceStatus,
    statusDescription: p.statusDescription,
    statusDetail: p.statusDetail,
    toUsername: p.toUsername,
    worth: p.worth,
    worthAtSendTime: p.worthAtSendTime,
  })
}

export const reactionMapToReactions = (r: RPCChatTypes.ReactionMap): MessageTypes.Reactions => {
  if (!r.reactions) {
    return I.Map()
  }
  return I.Map(
    Object.keys(r.reactions).reduce((res, emoji) => {
      if (r.reactions[emoji]) {
        res[emoji] = I.Set(
          Object.keys(r.reactions[emoji]).map(username =>
            makeReaction({
              timestamp: r.reactions[emoji][username].ctime,
              username,
            })
          )
        )
      }
      return res
    }, {})
  )
}

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
  const mentionsChannelName: I.Map<string, Types.ConversationIDKey> = I.Map(
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

const uiMessageToSystemMessage = (minimum, body, reactions): ?Types.Message => {
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
        reactions,
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
          // $FlowIssue need these to be opaque types
          Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(iType)
          inviteType = 'unknown'
          break
      }
      return makeMessageSystemInviteAccepted({
        ...minimum,
        adder,
        inviteType,
        invitee,
        inviter,
        reactions,
        team,
      })
    }
    case RPCChatTypes.localMessageSystemType.complexteam: {
      const {team = ''} = body.complexteam || {}
      return makeMessageSystemSimpleToComplex({
        ...minimum,
        reactions,
        team,
      })
    }
    case RPCChatTypes.localMessageSystemType.createteam: {
      const {team = '???', creator = '????'} = body.createteam || {}
      return makeMessageSystemText({
        reactions,
        text: new HiddenString(`${creator} created a new team ${team}.`),
        ...minimum,
      })
    }
    case RPCChatTypes.localMessageSystemType.gitpush: {
      const {team = '???', pushType = 0, pusher = '???', repoName: repo = '???', repoID = '???', refs} =
        body.gitpush || {}
      return makeMessageSystemGitPush({
        ...minimum,
        pushType,
        pusher,
        reactions,
        refs: refs || [],
        repo,
        repoID,
        team,
      })
    }
    case RPCChatTypes.localMessageSystemType.changeavatar: {
      const {user = '???'} = body.changeavatar || {}
      return makeMessageSystemText({
        reactions,
        text: new HiddenString(`${user} changed team avatar`),
        ...minimum,
      })
    }
    case RPCChatTypes.localMessageSystemType.changeretention: {
      if (!body.changeretention) {
        return null
      }
      return makeMessageSystemChangeRetention({
        ...minimum,
        isInherit: body.changeretention.isInherit,
        isTeam: body.changeretention.isTeam,
        membersType: body.changeretention.membersType,
        policy: body.changeretention.policy,
        reactions,
        user: body.changeretention.user,
      })
    }

    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(body.systemType)
      return null
  }
}

const maxAttachmentPreviewSize = 320
const clampAttachmentPreviewSize = ({width = 0, height = 0}) =>
  height > width
    ? {
        height: clamp(height || 0, 0, maxAttachmentPreviewSize),
        width: (clamp(height || 0, 0, maxAttachmentPreviewSize) * width) / (height || 1),
      }
    : {
        height: (clamp(width || 0, 0, maxAttachmentPreviewSize) * height) / (width || 1),
        width: clamp(width || 0, 0, maxAttachmentPreviewSize),
      }

export const isVideoAttachment = (message: Types.MessageAttachment) => message.fileType.startsWith('video')

export const previewSpecs = (preview: ?RPCChatTypes.AssetMetadata, full: ?RPCChatTypes.AssetMetadata) => {
  const res = {
    attachmentType: 'file',
    height: 0,
    showPlayButton: false,
    width: 0,
  }
  if (!preview) {
    return res
  }
  if (preview.assetType === RPCChatTypes.commonAssetMetadataType.image && preview.image) {
    const wh = clampAttachmentPreviewSize(preview.image)
    res.height = wh.height
    res.width = wh.width
    res.attachmentType = 'image'
    // full is a video but preview is an image?
    if (full && full.assetType === RPCChatTypes.commonAssetMetadataType.video) {
      res.showPlayButton = true
    }
  } else if (preview.assetType === RPCChatTypes.commonAssetMetadataType.video && preview.video) {
    const wh = clampAttachmentPreviewSize(preview.video)
    res.height = wh.height
    res.width = wh.width
    res.attachmentType = 'image'
  }
  return res
}

const successfulInlinePaymentStatuses = ['completed', 'claimable']
export const hasSuccessfulInlinePayments = (state: TypedState, message: Types.Message) => {
  if (message.type !== 'text' || !message.inlinePaymentIDs) {
    return false
  }
  return (
    message.inlinePaymentSuccessful ||
    message.inlinePaymentIDs.some(id =>
      successfulInlinePaymentStatuses.includes(state.chat2.paymentStatusMap.get(id)?.status)
    )
  )
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

  const reactions = reactionMapToReactions(m.reactions)
  const common = {
    ...minimum,
    deviceName: m.senderDeviceName,
    deviceRevokedAt: m.senderDeviceRevokedAt,
    deviceType: DeviceTypes.stringToDeviceType(m.senderDeviceType),
    outboxID: m.outboxID ? Types.stringToOutboxID(m.outboxID) : null,
    reactions,
  }
  const explodable = {
    exploded: m.isEphemeralExpired,
    explodedBy: m.explodedBy || '',
    exploding: m.isEphemeral,
    explodingTime: m.etime,
  }

  if (m.isEphemeralExpired) {
    // This message already exploded. Make it an empty text message.
    return makeMessageText({...common, ...explodable})
  }

  switch (m.messageBody.messageType) {
    case RPCChatTypes.commonMessageType.text:
      const messageText = m.messageBody.text
      const rawText: string = messageText?.body ?? ''
      const payments = messageText?.payments ?? null
      return makeMessageText({
        ...common,
        ...explodable,
        decoratedText: m.decoratedTextBody ? new HiddenString(m.decoratedTextBody) : null,
        hasBeenEdited: m.superseded,
        inlinePaymentIDs: payments
          ? I.List(
              payments
                .map(p => {
                  if (p.result.resultTyp === RPCChatTypes.localTextPaymentResultTyp.sent && p.result.sent) {
                    return WalletTypes.rpcPaymentIDToPaymentID(p.result.sent)
                  }
                  return null
                })
                .filter(Boolean)
            )
          : null,
        inlinePaymentSuccessful: m.paymentInfos
          ? m.paymentInfos.some(pi => successfulInlinePaymentStatuses.includes(pi.statusDescription))
          : false,
        mentionsAt: I.Set(m.atMentions || []),
        mentionsChannel: channelMentionToMentionsChannel(m.channelMention),
        mentionsChannelName: I.Map(
          (m.channelNameMentions || []).map(men => [men.name, Types.stringToConversationIDKey(men.convID)])
        ),
        text: new HiddenString(rawText),
        unfurls: I.Map((m.unfurls || []).map(u => [u.url, u])),
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
      let full: ?RPCChatTypes.Asset
      let transferState = null

      if (m.messageBody.messageType === RPCChatTypes.commonMessageType.attachment) {
        attachment = m.messageBody.attachment || {}
        preview =
          attachment.preview ||
          (attachment.previews && attachment.previews.length ? attachment.previews[0] : null)
        full = attachment.object
        if (!attachment.uploaded) {
          transferState = 'remoteUploading'
        }
      } else if (m.messageBody.messageType === RPCChatTypes.commonMessageType.attachmentuploaded) {
        attachment = m.messageBody.attachmentuploaded || {}
        preview = attachment.previews && attachment.previews.length ? attachment.previews[0] : null
        full = attachment.object
        transferState = null
      }
      const {filename, title, size} = attachment.object

      const pre = previewSpecs(preview && preview.metadata, full && full.metadata)
      let previewURL = ''
      let fileURL = ''
      let fileType = ''
      let fileURLCached = false
      let videoDuration = null
      let inlineVideoPlayable = false
      if (m.assetUrlInfo) {
        previewURL = m.assetUrlInfo.previewUrl
        fileURL = m.assetUrlInfo.fullUrl
        fileType = m.assetUrlInfo.mimeType
        fileURLCached = m.assetUrlInfo.fullUrlCached
        videoDuration = m.assetUrlInfo.videoDuration
        inlineVideoPlayable = m.assetUrlInfo.inlineVideoPlayable
      }

      return makeMessageAttachment({
        ...common,
        ...explodable,
        attachmentType: pre.attachmentType,
        fileName: filename,
        fileSize: size,
        fileType,
        fileURL,
        fileURLCached,
        inlineVideoPlayable,
        isCollapsed: m.isCollapsed,
        previewHeight: pre.height,
        previewURL,
        previewWidth: pre.width,
        showPlayButton: pre.showPlayButton,
        title,
        transferState,
        videoDuration,
      })
    }
    case RPCChatTypes.commonMessageType.join:
      return makeMessageSystemJoined({...minimum, reactions})
    case RPCChatTypes.commonMessageType.leave:
      return makeMessageSystemLeft({...minimum, reactions})
    case RPCChatTypes.commonMessageType.system:
      return m.messageBody.system
        ? uiMessageToSystemMessage(minimum, m.messageBody.system, common.reactions)
        : null
    case RPCChatTypes.commonMessageType.headline:
      return m.messageBody.headline
        ? makeMessageSetDescription({
            ...minimum,
            newDescription: new HiddenString(m.messageBody.headline.headline),
            reactions,
          })
        : null
    case RPCChatTypes.commonMessageType.metadata:
      return m.messageBody.metadata
        ? makeMessageSetChannelname({
            ...minimum,
            newChannelname: m.messageBody.metadata.conversationTitle,
            reactions,
          })
        : null
    case RPCChatTypes.commonMessageType.sendpayment:
      return m.messageBody.sendpayment
        ? makeMessageSendPayment({
            ...common,
            paymentInfo: uiPaymentInfoToChatPaymentInfo(m.paymentInfos),
          })
        : null
    case RPCChatTypes.commonMessageType.requestpayment:
      return m.messageBody.requestpayment
        ? makeMessageRequestPayment({
            ...common,
            note: new HiddenString(m.messageBody.requestpayment.note),
            requestID: m.messageBody.requestpayment.requestID,
            requestInfo: uiRequestInfoToChatRequestInfo(m.requestInfo),
          })
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
      // $FlowIssue need these to be opaque types
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(m.messageBody.messageType)
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
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage,
  o: RPCChatTypes.UIMessageOutbox
) => {
  const errorReason =
    o.state && o.state.state === RPCChatTypes.localOutboxStateType.error && o.state.error
      ? rpcErrorToString(o.state.error)
      : null

  switch (o.messageType) {
    case RPCChatTypes.commonMessageType.attachment:
      const title = o.title
      const fileName = o.filename
      let previewURL = ''
      let pre = previewSpecs(null, null)
      if (o.preview) {
        previewURL =
          o.preview.location &&
          o.preview.location.ltyp === RPCChatTypes.localPreviewLocationTyp.url &&
          o.preview.location.url
            ? o.preview.location.url
            : ''
        const md = o.preview && o.preview.metadata
        const baseMd = o.preview && o.preview.baseMetadata
        pre = previewSpecs(md, baseMd)
      }
      return makePendingAttachmentMessage(
        state,
        conversationIDKey,
        title,
        FsTypes.getLocalPathName(fileName),
        previewURL,
        pre,
        Types.stringToOutboxID(o.outboxID),
        Types.numberToOrdinal(o.ordinal),
        errorReason
      )
    case RPCChatTypes.commonMessageType.text:
      return makeMessageText({
        author: state.config.username || '',
        conversationIDKey,
        decoratedText: o.decoratedTextBody ? new HiddenString(o.decoratedTextBody) : null,
        deviceName: state.config.deviceName || '',
        deviceType: isMobile ? 'mobile' : 'desktop',
        errorReason,
        ordinal: Types.numberToOrdinal(o.ordinal),
        outboxID: Types.stringToOutboxID(o.outboxID),
        submitState: 'pending',
        text: new HiddenString(o.body),
        timestamp: o.ctime,
      })
  }
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
    explodingUnreadable: !!o.errType && o.isEphemeral,
    id: Types.numberToMessageID(o.messageID),
    ordinal: Types.numberToOrdinal(o.messageID),
    timestamp: o.ctime,
  })
}

export const uiMessageToMessage = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage
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
        return outboxUIMessagetoMessage(state, conversationIDKey, uiMessage, uiMessage.outbox)
      }
      return null
    case RPCChatTypes.chatUiMessageUnboxedState.placeholder:
      if (uiMessage.placeholder) {
        return placeholderUIMessageToMessage(conversationIDKey, uiMessage, uiMessage.placeholder)
      }
      return null
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(uiMessage.state)
      return null
  }
}

export function nextFractionalOrdinal(ord: Types.Ordinal): Types.Ordinal {
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
  title: string,
  fileName: string,
  previewURL: string,
  previewSpec: Types.PreviewSpec,
  outboxID: Types.OutboxID,
  inOrdinal: ?Types.Ordinal,
  errorReason: ?string,
  explodeTime?: number
) => {
  const lastOrdinal =
    state.chat2.messageOrdinals.get(conversationIDKey, I.List()).last() || Types.numberToOrdinal(0)
  const ordinal = !inOrdinal ? nextFractionalOrdinal(lastOrdinal) : inOrdinal
  const explodeInfo = explodeTime ? {exploding: true, explodingTime: Date.now() + explodeTime * 1000} : {}

  return makeMessageAttachment({
    ...explodeInfo,
    attachmentType: previewSpec.attachmentType,
    author: state.config.username || '',
    conversationIDKey,
    deviceName: '',
    deviceType: isMobile ? 'mobile' : 'desktop',
    errorReason: errorReason,
    fileName: fileName,
    id: Types.numberToMessageID(0),
    isCollapsed: false,
    ordinal: ordinal,
    outboxID: outboxID,
    previewHeight: previewSpec.height,
    previewURL: previewURL,
    previewWidth: previewSpec.width,
    showPlayButton: previewSpec.showPlayButton,
    submitState: 'pending',
    timestamp: Date.now(),
    title: title,
  })
}

export const getClientPrev = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  let clientPrev

  const mm = state.chat2.messageMap.get(conversationIDKey)
  if (mm) {
    // find last valid messageid we know about
    const goodOrdinal = state.chat2.messageOrdinals.get(conversationIDKey, I.OrderedSet()).findLast(o =>
      // $FlowIssue not going to fix this message resolution stuff now, they all have ids that we care about
      mm.getIn([o, 'id'])
    )

    if (goodOrdinal) {
      clientPrev = mm.getIn([goodOrdinal, 'id'])
    }
  }

  return clientPrev || 0
}

const imageFileNameRegex = /[^/]+\.(jpg|png|gif|jpeg|bmp)$/i
export const pathToAttachmentType = (path: string) => (imageFileNameRegex.test(path) ? 'image' : 'file')
export const isSpecialMention = (s: string) => ['here', 'channel', 'everyone'].includes(s)

export const specialMentions = ['here', 'channel', 'everyone']

export const mergeMessage = (old: ?Types.Message, m: Types.Message) => {
  if (!old) {
    return m
  }

  // only merge if its the same id and type
  if (old.id !== m.id || old.type !== m.type) {
    return m
  }

  // $FlowIssue doens't understand mergeWith
  return old.mergeWith((oldVal, newVal, key) => {
    if (key === 'mentionsAt' || key === 'reactions' || key === 'mentionsChannelName') {
      return oldVal.equals(newVal) ? oldVal : newVal
    } else if (key === 'text') {
      return oldVal.stringValue() === newVal.stringValue() ? oldVal : newVal
    }
    return newVal === oldVal ? oldVal : newVal
  }, m)
}

export const upgradeMessage = (old: Types.Message, m: Types.Message) => {
  const validUpgrade = (
    old: Types.MessageText | Types.MessageAttachment,
    m: Types.MessageText | Types.MessageAttachment
  ) => {
    if (old.submitState !== 'pending' && m.submitState === 'pending') {
      // we may be making sure we got our pending message in the thread view, but if we already
      // got the message, then don't blow it away with a pending version.
      return false
    }
    return true
  }
  if (old.type === 'text' && m.type === 'text') {
    if (!validUpgrade(old, m)) {
      return old
    }
    return (m.set('ordinal', old.ordinal): Types.MessageText)
  }
  if (old.type === 'attachment' && m.type === 'attachment') {
    if (!validUpgrade(old, m)) {
      return old
    }
    if (old.submitState === 'pending') {
      // we sent an attachment, service replied
      // with the real message. replace our placeholder but
      // hold on to the ordinal so it doesn't
      // jump in the conversation view
      // hold on to the previewURL so that we
      // don't show the gray box.
      return (m.merge({
        ordinal: old.ordinal,
        previewURL: old.previewURL,
      }): Types.MessageAttachment)
    }
    return (m.withMutations((ret: Types.MessageAttachment) => {
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
    }): Types.MessageAttachment)
  }
  return m
}

export const enoughTimeBetweenMessages = (
  message: MessageTypes.Message,
  previous: ?MessageTypes.Message
): boolean =>
  Boolean(
    previous &&
      previous.timestamp &&
      message.timestamp &&
      message.timestamp - previous.timestamp > howLongBetweenTimestampsMs
  )

export const shouldShowPopup = (state: TypedState, message: Types.Message) => {
  switch (message.type) {
    case 'text':
    case 'attachment':
    case 'requestPayment':
      return true
    case 'sendPayment': {
      const paymentInfo = getPaymentMessageInfo(state, message)
      if (!paymentInfo || ['claimable', 'pending', 'canceled'].includes(paymentInfo.get('status'))) {
        return false
      }
      return true
    }
    default:
      return false
  }
}

export const messageExplodeDescriptions: Types.MessageExplodeDescription[] = [
  {seconds: 30, text: '30 seconds'},
  {seconds: 300, text: '5 minutes'},
  {seconds: 3600, text: '60 minutes'},
  {seconds: 3600 * 6, text: '6 hours'},
  {seconds: 86400, text: '24 hours'},
  {seconds: 86400 * 3, text: '3 days'},
  {seconds: 86400 * 7, text: '7 days'},
  {seconds: 0, text: 'Never explode (turn off)'},
].reverse()
