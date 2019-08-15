// Message related constants
import * as DeviceTypes from '../types/devices'
import * as I from 'immutable'
import * as MessageTypes from '../types/chat2/message'
import * as RPCTypes from '../types/rpc-gen'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCStellarTypes from '../types/rpc-stellar-gen'
import * as Types from '../types/chat2'
import * as FsTypes from '../types/fs'
import * as WalletConstants from '../wallets'
import * as WalletTypes from '../types/wallets'
import HiddenString from '../../util/hidden-string'
import {isMobile} from '../platform'
import {TypedState} from '../reducer'
import {noConversationIDKey} from '../types/chat2/common'
import logger from '../../logger'

export const getMessageID = (m: RPCChatTypes.UIMessage) => {
  switch (m.state) {
    case RPCChatTypes.MessageUnboxedState.valid:
      return m.valid ? m.valid.messageID : null
    case RPCChatTypes.MessageUnboxedState.error:
      return m.error ? m.error.messageID : null
    case RPCChatTypes.MessageUnboxedState.placeholder:
      return m.placeholder ? m.placeholder.messageID : null
    default:
      return null
  }
}

export const getRequestMessageInfo = (
  state: TypedState,
  message: Types.MessageRequestPayment
): MessageTypes.ChatRequestInfo | null => {
  const maybeRequestInfo = state.chat2.accountsInfoMap.getIn([message.conversationIDKey, message.id], null)
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
  message: Types.MessageSendPayment | Types.MessageText
): MessageTypes.ChatPaymentInfo | null => {
  const maybePaymentInfo = state.chat2.accountsInfoMap.getIn([message.conversationIDKey, message.id], null)
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
    case RPCChatTypes.MessageType.text:
      return ['text']
    case RPCChatTypes.MessageType.attachment:
      return ['attachment']
    case RPCChatTypes.MessageType.metadata:
      return ['setDescription']
    case RPCChatTypes.MessageType.headline:
      return ['setChannelname']
    case RPCChatTypes.MessageType.attachmentuploaded:
      return ['attachment']
    case RPCChatTypes.MessageType.join:
      return ['systemJoined']
    case RPCChatTypes.MessageType.leave:
      return ['systemLeft']
    case RPCChatTypes.MessageType.system:
      return [
        'systemAddedToTeam',
        'systemChangeRetention',
        'systemGitPush',
        'systemInviteAccepted',
        'systemSimpleToComplex',
        'systemText',
        'systemUsersAddedToConversation',
      ]
    case RPCChatTypes.MessageType.sendpayment:
      return ['sendPayment']
    case RPCChatTypes.MessageType.requestpayment:
      return ['requestPayment']
    // mutations and other types we don't store directly
    case RPCChatTypes.MessageType.none:
    case RPCChatTypes.MessageType.edit:
    case RPCChatTypes.MessageType.delete:
    case RPCChatTypes.MessageType.tlfname:
    case RPCChatTypes.MessageType.deletehistory:
    case RPCChatTypes.MessageType.reaction:
    case RPCChatTypes.MessageType.unfurl:
    case RPCChatTypes.MessageType.flip:
      return []
    default:
      return []
  }
}
export const allMessageTypes: I.Set<Types.MessageType> = I.Set([
  'attachment',
  'deleted',
  'requestPayment',
  'sendPayment',
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
  'systemUsersAddedToConversation',
  'text',
  'placeholder',
])
export const getDeletableByDeleteHistory = (state: TypedState) =>
  (!!state.chat2.staticConfig && state.chat2.staticConfig.deletableByDeleteHistory) || allMessageTypes

type Minimum = {
  author: string
  conversationIDKey: Types.ConversationIDKey
  id: Types.MessageID
  ordinal: Types.Ordinal
  timestamp: number
}

const makeMessageMinimum = {
  author: '',
  bodySummary: new HiddenString(''),
  conversationIDKey: noConversationIDKey,
  id: Types.numberToMessageID(0),
  ordinal: Types.numberToOrdinal(0),
  timestamp: 0,
}

const makeMessageCommon = {
  ...makeMessageMinimum,
  deviceName: '',
  deviceRevokedAt: null,
  deviceType: 'mobile' as DeviceTypes.DeviceType,
  errorReason: null,
  hasBeenEdited: false,
  outboxID: Types.stringToOutboxID(''),
}

const makeMessageCommonNoDeleteNoEdit = {
  ...makeMessageCommon,
  isDeleteable: false,
  isEditable: false,
}

const makeMessageExplodable = {
  exploded: false,
  explodedBy: '',
  exploding: false,
  explodingTime: Date.now(),
  explodingUnreadable: false,
}

export const howLongBetweenTimestampsMs: number = 1000 * 60 * 15

export const makeMessagePlaceholder = I.Record<MessageTypes._MessagePlaceholder>({
  ...makeMessageMinimum,
  type: 'placeholder',
})

export const makeMessageDeleted = I.Record<MessageTypes._MessageDeleted>({
  ...makeMessageCommon,
  type: 'deleted',
})

export const makeMessageText = I.Record<MessageTypes._MessageText>({
  ...makeMessageCommon,
  ...makeMessageExplodable,
  decoratedText: null,
  flipGameID: null,
  inlinePaymentIDs: null,
  inlinePaymentSuccessful: false,
  isDeleteable: true,
  isEditable: true,
  mentionsAt: I.Set(),
  mentionsChannel: 'none',
  mentionsChannelName: I.Map(),
  paymentInfo: null,
  reactions: I.Map(),
  replyTo: null,
  submitState: null,
  text: new HiddenString(''),
  type: 'text',
  unfurls: I.Map(),
})

export const makeMessageAttachment = I.Record<MessageTypes._MessageAttachment>({
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
  isDeleteable: true,
  isEditable: false,
  previewHeight: 0,
  previewTransferState: null,
  previewURL: '',
  previewWidth: 0,
  reactions: I.Map(),
  showPlayButton: false,
  submitState: null,
  title: '',
  transferErrMsg: null,
  transferProgress: 0,
  transferState: null,
  type: 'attachment',
  videoDuration: null,
})

export const makeChatRequestInfo = I.Record<MessageTypes._ChatRequestInfo>({
  amount: '',
  amountDescription: '',
  asset: 'native',
  canceled: false,
  currencyCode: '',
  done: false,
  type: 'requestInfo',
  worthAtRequestTime: '',
})

export const makeMessageRequestPayment = I.Record<MessageTypes._MessageRequestPayment>({
  ...makeMessageCommon,
  note: new HiddenString(''),
  reactions: I.Map(),
  requestID: '',
  requestInfo: null,
  type: 'requestPayment',
})

export const makeChatPaymentInfo = I.Record<MessageTypes._ChatPaymentInfo>({
  accountID: WalletTypes.noAccountID,
  amountDescription: '',
  delta: 'none',
  fromUsername: '',
  issuerDescription: '',
  note: new HiddenString(''),
  paymentID: WalletTypes.noPaymentID,
  showCancel: false,
  sourceAmount: '',
  sourceAsset: WalletConstants.emptyAssetDescription,
  status: 'none',
  statusDescription: '',
  statusDetail: '',
  toUsername: '',
  type: 'paymentInfo',
  worth: '',
  worthAtSendTime: '',
})

export const makeMessageSendPayment = I.Record<MessageTypes._MessageSendPayment>({
  ...makeMessageCommon,
  paymentInfo: null,
  reactions: I.Map(),
  type: 'sendPayment',
})

const makeMessageSystemJoined = I.Record<MessageTypes._MessageSystemJoined>({
  ...makeMessageCommonNoDeleteNoEdit,
  joiners: [],
  leavers: [],
  type: 'systemJoined',
})

const makeMessageSystemLeft = I.Record<MessageTypes._MessageSystemLeft>({
  ...makeMessageCommonNoDeleteNoEdit,
  type: 'systemLeft',
})

const makeMessageSystemAddedToTeam = I.Record<MessageTypes._MessageSystemAddedToTeam>({
  ...makeMessageCommonNoDeleteNoEdit,
  addee: '',
  adder: '',
  isAdmin: false,
  reactions: I.Map(),
  team: '',
  type: 'systemAddedToTeam',
})

const makeMessageSystemInviteAccepted = I.Record<MessageTypes._MessageSystemInviteAccepted>({
  ...makeMessageCommonNoDeleteNoEdit,
  adder: '',
  author: '[Keybase]',
  inviteType: 'none',
  invitee: '',
  inviter: '',
  reactions: I.Map(),
  team: '',
  type: 'systemInviteAccepted',
})

const makeMessageSystemSimpleToComplex = I.Record<MessageTypes._MessageSystemSimpleToComplex>({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: I.Map(),
  team: '',
  type: 'systemSimpleToComplex',
})

export const makeMessageSystemText = I.Record<MessageTypes._MessageSystemText>({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: I.Map(),
  text: new HiddenString(''),
  type: 'systemText',
})

export const makeMessageSystemGitPush = I.Record<MessageTypes._MessageSystemGitPush>({
  ...makeMessageCommonNoDeleteNoEdit,
  pushType: 0,
  pusher: '',
  reactions: I.Map(),
  refs: [],
  repo: '',
  repoID: '',
  team: '',
  type: 'systemGitPush',
})

const makeMessageSetDescription = I.Record<MessageTypes._MessageSetDescription>({
  ...makeMessageCommonNoDeleteNoEdit,
  newDescription: new HiddenString(''),
  reactions: I.Map(),
  type: 'setDescription',
})

const makeMessageSetChannelname = I.Record<MessageTypes._MessageSetChannelname>({
  ...makeMessageCommonNoDeleteNoEdit,
  newChannelname: '',
  reactions: I.Map(),
  type: 'setChannelname',
})

const makeMessageSystemChangeRetention = I.Record<MessageTypes._MessageSystemChangeRetention>({
  ...makeMessageCommonNoDeleteNoEdit,
  isInherit: false,
  isTeam: false,
  membersType: 0,
  policy: null,
  reactions: I.Map(),
  type: 'systemChangeRetention',
  user: '',
  you: '',
})

const makeMessageSystemUsersAddedToConversation = I.Record<
  MessageTypes._MessageSystemUsersAddedToConversation
>({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: I.Map(),
  type: 'systemUsersAddedToConversation',
  usernames: [],
})

export const makeReaction = I.Record<MessageTypes._Reaction>({
  timestamp: 0,
  username: '',
})

export const uiRequestInfoToChatRequestInfo = (
  r: RPCChatTypes.UIRequestInfo | null
): MessageTypes.ChatRequestInfo | null => {
  if (!r) {
    return null
  }
  let asset: WalletTypes.Asset = 'native'
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
    canceled: r.status === RPCStellarTypes.RequestStatus.canceled,
    currencyCode,
    done: r.status === RPCStellarTypes.RequestStatus.done,
    worthAtRequestTime: r.worthAtRequestTime,
  })
}

export const uiPaymentInfoToChatPaymentInfo = (
  ps: Array<RPCChatTypes.UIPaymentInfo> | null
): MessageTypes.ChatPaymentInfo | null => {
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
    issuerDescription: p.issuerDescription,
    note: new HiddenString(p.note),
    paymentID: WalletTypes.rpcPaymentIDToPaymentID(p.paymentID),
    showCancel: p.showCancel,
    sourceAmount: p.sourceAmount,
    sourceAsset: WalletConstants.makeAssetDescription({
      code: p.sourceAsset.code,
      issuerAccountID: p.sourceAsset.issuer,
      issuerName: p.sourceAsset.issuerName,
      issuerVerifiedDomain: p.sourceAsset.verifiedDomain,
    }),
    status: serviceStatus,
    statusDescription: p.statusDescription,
    statusDetail: p.statusDetail,
    toUsername: p.toUsername,
    worth: p.worth,
    worthAtSendTime: p.worthAtSendTime,
  })
}

export const reactionMapToReactions = (r: RPCChatTypes.ReactionMap): MessageTypes.Reactions =>
  I.Map(
    Object.keys(r.reactions || {}).reduce((arr: Array<[string, I.Set<MessageTypes.Reaction>]>, emoji) => {
      if (r.reactions[emoji]) {
        arr.push([
          emoji,
          I.Set(
            Object.keys(r.reactions[emoji]).map(username =>
              makeReaction({
                timestamp: r.reactions[emoji][username].ctime,
                username,
              })
            )
          ),
        ])
      }
      return arr
    }, [])
  )

const channelMentionToMentionsChannel = (channelMention: RPCChatTypes.ChannelMention) => {
  switch (channelMention) {
    case RPCChatTypes.ChannelMention.all:
      return 'all'
    case RPCChatTypes.ChannelMention.here:
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

const uiMessageToSystemMessage = (
  minimum: Minimum,
  body: RPCChatTypes.MessageSystem,
  reactions: I.Map<string, I.Set<MessageTypes.Reaction>>
): Types.Message | null => {
  switch (body.systemType) {
    case RPCChatTypes.MessageSystemType.addedtoteam: {
      // TODO @mikem admins is always empty?
      const {adder = '', addee = '', team = '', admins = null} = body.addedtoteam || {}
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
    case RPCChatTypes.MessageSystemType.inviteaddedtoteam: {
      const inviteaddedtoteam = body.inviteaddedtoteam || ({} as RPCChatTypes.MessageSystemInviteAddedToTeam)
      const invitee = inviteaddedtoteam.invitee || 'someone'
      const adder = inviteaddedtoteam.adder || 'someone'
      const inviter = inviteaddedtoteam.inviter || 'someone'
      const team = inviteaddedtoteam.team || '???'
      const iType = inviteaddedtoteam.inviteType || RPCTypes.TeamInviteCategory.unknown
      let inviteType: MessageTypes.MessageSystemInviteAccepted['inviteType']
      switch (iType) {
        case RPCTypes.TeamInviteCategory.unknown:
          inviteType = 'unknown'
          break
        case RPCTypes.TeamInviteCategory.keybase:
          inviteType = 'keybase'
          break
        case RPCTypes.TeamInviteCategory.email:
          inviteType = 'email'
          break
        case RPCTypes.TeamInviteCategory.sbs:
          inviteType = 'sbs'
          break
        case RPCTypes.TeamInviteCategory.seitan:
          inviteType = 'text'
          break
        default:
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
    case RPCChatTypes.MessageSystemType.complexteam: {
      const {team = ''} = body.complexteam || {}
      return makeMessageSystemSimpleToComplex({
        ...minimum,
        reactions,
        team,
      })
    }
    case RPCChatTypes.MessageSystemType.createteam: {
      const {team = '???', creator = '????'} = body.createteam || {}
      return makeMessageSystemText({
        reactions,
        text: new HiddenString(`${creator} created a new team ${team}.`),
        ...minimum,
      })
    }
    case RPCChatTypes.MessageSystemType.gitpush: {
      const {team = '???', pushType = 0, pusher = '???', repoName: repo = '???', repoID = '???', refs = []} =
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
    case RPCChatTypes.MessageSystemType.changeavatar: {
      const {user = '???'} = body.changeavatar || {}
      return makeMessageSystemText({
        reactions,
        text: new HiddenString(`${user} changed team avatar`),
        ...minimum,
      })
    }
    case RPCChatTypes.MessageSystemType.changeretention: {
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
    case RPCChatTypes.MessageSystemType.bulkaddtoconv: {
      if (!body.bulkaddtoconv || !body.bulkaddtoconv.usernames) {
        return null
      }
      return makeMessageSystemUsersAddedToConversation({
        ...minimum,
        reactions,
        usernames: body.bulkaddtoconv.usernames,
      })
    }

    default:
      return null
  }
}

export const isVideoAttachment = (message: Types.MessageAttachment) => message.fileType.startsWith('video')

export const previewSpecs = (
  preview: RPCChatTypes.AssetMetadata | null,
  full: RPCChatTypes.AssetMetadata | null
) => {
  const res = {
    attachmentType: 'file' as Types.AttachmentType,
    height: 0,
    showPlayButton: false,
    width: 0,
  }
  if (!preview) {
    return res
  }
  if (preview.assetType === RPCChatTypes.AssetMetadataType.image && preview.image) {
    res.height = preview.image.height
    res.width = preview.image.width
    res.attachmentType = 'image'
    // full is a video but preview is an image?
    if (full && full.assetType === RPCChatTypes.AssetMetadataType.video) {
      res.showPlayButton = true
    }
  } else if (preview.assetType === RPCChatTypes.AssetMetadataType.video && preview.video) {
    res.height = preview.video.height
    res.width = preview.video.width
    res.attachmentType = 'image'
  }
  return res
}

const successfulInlinePaymentStatuses = ['completed', 'claimable']
export const hasSuccessfulInlinePayments = (state: TypedState, message: Types.Message): boolean => {
  if (message.type !== 'text' || !message.inlinePaymentIDs) {
    return false
  }
  return (
    message.inlinePaymentSuccessful ||
    message.inlinePaymentIDs.some(id => {
      const s = state.chat2.paymentStatusMap.get(id)
      return !!s && successfulInlinePaymentStatuses.includes(s.status)
    })
  )
}

const validUIMessagetoMessage = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey,
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
    bodySummary: new HiddenString(m.bodySummary),
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
    case RPCChatTypes.MessageType.flip:
    case RPCChatTypes.MessageType.text: {
      let rawText: string
      let payments: Array<RPCChatTypes.TextPayment> | null = null
      switch (m.messageBody.messageType) {
        case RPCChatTypes.MessageType.flip:
          rawText = (m.messageBody.flip && m.messageBody.flip.text) || ''
          break
        case RPCChatTypes.MessageType.text:
          {
            const messageText = m.messageBody.text
            rawText = (messageText && messageText.body) || ''
            payments = (messageText && messageText.payments) || null
          }
          break
        default:
          rawText = ''
      }
      return makeMessageText({
        ...common,
        ...explodable,
        decoratedText: m.decoratedTextBody ? new HiddenString(m.decoratedTextBody) : null,
        flipGameID: m.flipGameID,
        hasBeenEdited: m.superseded,
        inlinePaymentIDs: payments
          ? I.List(
              payments.reduce((arr: Array<string>, p) => {
                if (p.result.resultTyp === RPCChatTypes.TextPaymentResultTyp.sent && p.result.sent) {
                  const s = WalletTypes.rpcPaymentIDToPaymentID(p.result.sent)
                  s && arr.push(s)
                }
                return arr
              }, [])
            )
          : null,
        inlinePaymentSuccessful: m.paymentInfos
          ? m.paymentInfos.some(pi => successfulInlinePaymentStatuses.includes(pi.statusDescription))
          : false,
        isDeleteable: m.isDeleteable,
        isEditable: m.isEditable,
        mentionsAt: I.Set(m.atMentions || []),
        mentionsChannel: channelMentionToMentionsChannel(m.channelMention),
        mentionsChannelName: I.Map(
          (m.channelNameMentions || []).map(men => [men.name, Types.stringToConversationIDKey(men.convID)])
        ),
        replyTo: m.replyTo ? uiMessageToMessage(state, conversationIDKey, m.replyTo) : null,
        text: new HiddenString(rawText),
        unfurls: I.Map((m.unfurls || []).map(u => [u.url, u])),
      })
    }
    case RPCChatTypes.MessageType.attachmentuploaded: // fallthrough
    case RPCChatTypes.MessageType.attachment: {
      // The attachment flow is currently pretty complicated. We'll have core do more of this so it'll be simpler but for now
      // 1. On thread load we only get attachment type. It'll have full data
      // 2. On incoming we get attachment first (placeholder), then we get the full data (attachmentuploaded)
      // 3. When we send we place a pending attachment, then get the real attachment then attachmentuploaded
      // We treat all these like a pending text, so any data-less thing will have no message id and map to the same ordinal
      let attachment: RPCChatTypes.MessageAttachment | RPCChatTypes.MessageAttachmentUploaded | null = null
      let preview: RPCChatTypes.Asset | null = null
      let full: RPCChatTypes.Asset | null = null
      let transferState: 'remoteUploading' | null = null

      if (m.messageBody.messageType === RPCChatTypes.MessageType.attachment) {
        attachment = m.messageBody.attachment
        if (attachment) {
          preview =
            attachment.preview ||
            (attachment.previews && attachment.previews.length ? attachment.previews[0] : null)
          full = attachment.object
          if (!attachment.uploaded) {
            transferState = 'remoteUploading' as const
          }
        }
      } else if (m.messageBody.messageType === RPCChatTypes.MessageType.attachmentuploaded) {
        attachment = m.messageBody.attachmentuploaded
        if (attachment) {
          preview = attachment.previews && attachment.previews.length ? attachment.previews[0] : null
          full = attachment.object
          transferState = null
        }
      }

      const a = attachment || {object: {filename: undefined, size: undefined, title: undefined}}
      const {filename, title, size} = a.object

      const pre = previewSpecs(preview && preview.metadata, full && full.metadata)
      let previewURL = ''
      let fileURL = ''
      let fileType = ''
      let fileURLCached = false
      let videoDuration: string | null = null
      let inlineVideoPlayable = false
      if (m.assetUrlInfo) {
        previewURL = m.assetUrlInfo.previewUrl
        fileURL = m.assetUrlInfo.fullUrl
        fileType = m.assetUrlInfo.mimeType
        fileURLCached = m.assetUrlInfo.fullUrlCached
        videoDuration = m.assetUrlInfo.videoDuration || null
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
        isDeleteable: m.isDeleteable,
        isEditable: m.isEditable,
        previewHeight: pre.height,
        previewURL,
        previewWidth: pre.width,
        showPlayButton: pre.showPlayButton,
        title,
        transferState,
        videoDuration,
      })
    }
    case RPCChatTypes.MessageType.join:
      return makeMessageSystemJoined({
        ...common,
        joiners: m.messageBody.join ? m.messageBody.join.joiners || [] : [],
        leavers: m.messageBody.join ? m.messageBody.join.leavers || [] : [],
      })
    case RPCChatTypes.MessageType.leave:
      return makeMessageSystemLeft({
        ...common,
      })
    case RPCChatTypes.MessageType.system:
      return m.messageBody.system
        ? uiMessageToSystemMessage(common, m.messageBody.system, common.reactions)
        : null
    case RPCChatTypes.MessageType.headline:
      return m.messageBody.headline
        ? makeMessageSetDescription({
            ...common,
            newDescription: new HiddenString(m.messageBody.headline.headline),
            reactions,
          })
        : null
    case RPCChatTypes.MessageType.metadata:
      return m.messageBody.metadata
        ? makeMessageSetChannelname({
            ...common,
            newChannelname: m.messageBody.metadata.conversationTitle,
            reactions,
          })
        : null
    case RPCChatTypes.MessageType.sendpayment:
      return m.messageBody.sendpayment
        ? makeMessageSendPayment({
            ...common,
            paymentInfo: uiPaymentInfoToChatPaymentInfo(m.paymentInfos || null),
          })
        : null
    case RPCChatTypes.MessageType.requestpayment:
      return m.messageBody.requestpayment
        ? makeMessageRequestPayment({
            ...common,
            note: new HiddenString(m.messageBody.requestpayment.note),
            requestID: m.messageBody.requestpayment.requestID,
            requestInfo: uiRequestInfoToChatRequestInfo(m.requestInfo || null),
          })
        : null
    case RPCChatTypes.MessageType.edit:
      return null
    case RPCChatTypes.MessageType.delete:
      return null
    case RPCChatTypes.MessageType.deletehistory:
      return null
    default:
      return null
  }
}

export const rpcErrorToString = (error: RPCChatTypes.OutboxStateError) => {
  switch (error.typ) {
    case RPCChatTypes.OutboxErrorType.misc:
      return error.message || 'unknown error'
    case RPCChatTypes.OutboxErrorType.offline:
      return 'disconnected from chat server'
    case RPCChatTypes.OutboxErrorType.identify:
      return 'proofs failed for recipient user'
    case RPCChatTypes.OutboxErrorType.toolong:
      return 'message is too long'
    case RPCChatTypes.OutboxErrorType.duplicate:
      return 'message already sent'
    case RPCChatTypes.OutboxErrorType.expired:
      return 'took too long to send'
    default:
      return `${error.message || ''} (code: ${error.typ})`
  }
}

const outboxUIMessagetoMessage = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey,
  o: RPCChatTypes.UIMessageOutbox
) => {
  const errorReason =
    o.state && o.state.state === RPCChatTypes.OutboxStateType.error && o.state.error
      ? rpcErrorToString(o.state.error)
      : null

  switch (o.messageType) {
    case RPCChatTypes.MessageType.attachment: {
      const title = o.title
      const fileName = o.filename
      let previewURL = ''
      let pre = previewSpecs(null, null)
      if (o.preview) {
        previewURL =
          o.preview.location &&
          o.preview.location.ltyp === RPCChatTypes.PreviewLocationTyp.url &&
          o.preview.location.url
            ? o.preview.location.url
            : ''
        const md = (o.preview && o.preview.metadata) || null
        const baseMd = (o.preview && o.preview.baseMetadata) || null
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
    }
    case RPCChatTypes.MessageType.flip:
    case RPCChatTypes.MessageType.text:
      return makeMessageText({
        author: state.config.username || '',
        conversationIDKey,
        decoratedText: o.decoratedTextBody ? new HiddenString(o.decoratedTextBody) : null,
        deviceName: state.config.deviceName || '',
        deviceType: isMobile ? 'mobile' : 'desktop',
        errorReason,
        exploding: o.isEphemeral,
        flipGameID: o.flipGameID,
        ordinal: Types.numberToOrdinal(o.ordinal),
        outboxID: Types.stringToOutboxID(o.outboxID),
        submitState: 'pending',
        text: new HiddenString(o.body),
        timestamp: o.ctime,
      })
  }
  return null
}

const placeholderUIMessageToMessage = (
  conversationIDKey: Types.ConversationIDKey,
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
): Types.Message | null => {
  switch (uiMessage.state) {
    case RPCChatTypes.MessageUnboxedState.valid:
      if (uiMessage.valid) {
        return validUIMessagetoMessage(state, conversationIDKey, uiMessage.valid)
      }
      return null
    case RPCChatTypes.MessageUnboxedState.error:
      if (uiMessage.error) {
        return errorUIMessagetoMessage(conversationIDKey, uiMessage.error)
      }
      return null
    case RPCChatTypes.MessageUnboxedState.outbox:
      if (uiMessage.outbox) {
        return outboxUIMessagetoMessage(state, conversationIDKey, uiMessage.outbox)
      }
      return null
    case RPCChatTypes.MessageUnboxedState.placeholder:
      if (uiMessage.placeholder) {
        return placeholderUIMessageToMessage(conversationIDKey, uiMessage.placeholder)
      }
      return null
    default:
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

  const lastOrdinal = state.chat2.messageOrdinals
    .get(conversationIDKey, I.List())
    .last(Types.numberToOrdinal(0))
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
  inOrdinal: Types.Ordinal | null,
  errorReason: string | null,
  explodeTime?: number
) => {
  const lastOrdinal = state.chat2.messageOrdinals
    .get(conversationIDKey, I.List())
    .last(Types.numberToOrdinal(0))
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
    const goodOrdinal = (state.chat2.messageOrdinals.get(conversationIDKey) || I.OrderedSet()).findLast(o =>
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

export const mergeMessage = (old: Types.Message | null, m: Types.Message) => {
  if (!old) {
    return m
  }

  // only merge if its the same id and type
  if (old.id !== m.id || old.type !== m.type) {
    return m
  }

  // @ts-ignore doens't understand mergeWith
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
    return m.set('ordinal', old.ordinal) as Types.MessageText
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
      return m.merge({
        ordinal: old.ordinal,
        previewURL: old.previewURL,
      }) as Types.MessageAttachment
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
    }) as Types.MessageAttachment
  }
  return m
}

export const enoughTimeBetweenMessages = (
  message: MessageTypes.Message,
  previous?: MessageTypes.Message
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
    case 'setChannelname':
    case 'setDescription':
    case 'systemAddedToTeam':
    case 'systemChangeRetention':
    case 'systemGitPush':
    case 'systemInviteAccepted':
    case 'systemSimpleToComplex':
    case 'systemText':
    case 'systemUsersAddedToConversation':
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
