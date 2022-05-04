// Message related constants
import * as DeviceTypes from '../types/devices'
import * as FsTypes from '../types/fs'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCStellarTypes from '../types/rpc-stellar-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as TeamConstants from '../teams'
import * as Types from '../types/chat2'
import * as WalletConstants from '../wallets'
import * as WalletTypes from '../types/wallets'
import HiddenString from '../../util/hidden-string'
import invert from 'lodash/invert'
import logger from '../../logger'
import shallowEqual from 'shallowequal'
import type * as MessageTypes from '../types/chat2/message'
import type {ServiceId} from 'util/platforms'
import type {TypedState} from '../reducer'
import {assertNever} from '../../util/container'
import {isMobile} from '../platform'
import {noConversationIDKey} from '../types/chat2/common'

export const getMessageStateExtras = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  const getLastOrdinal = () =>
    [...(state.chat2.messageOrdinals.get(conversationIDKey) ?? [])].pop() ?? Types.numberToOrdinal(0)
  const username = state.config.username
  const devicename = state.config.deviceName ?? ''
  return {devicename, getLastOrdinal, username}
}

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

export const getRequestMessageInfo = (state: TypedState, message: Types.MessageRequestPayment) => {
  const convMap = state.chat2.accountsInfoMap.get(message.conversationIDKey)
  const maybeRequestInfo = convMap && convMap.get(message.id)
  if (!maybeRequestInfo) {
    return message.requestInfo
  }
  if (maybeRequestInfo.type === 'requestInfo') {
    return maybeRequestInfo
  }
  throw new Error(
    `Found impossible type ${maybeRequestInfo.type} in info meant for requestPayment message. convID: ${message.conversationIDKey} msgID: ${message.id}`
  )
}

export const getPaymentMessageInfo = (
  state: TypedState,
  message: Types.MessageSendPayment | Types.MessageText
) => {
  const convMap = state.chat2.accountsInfoMap.get(message.conversationIDKey)
  const maybePaymentInfo = convMap && convMap.get(message.id)
  if (!maybePaymentInfo) {
    return message.paymentInfo
  }
  if (maybePaymentInfo.type === 'paymentInfo') {
    return maybePaymentInfo
  }
  throw new Error(
    `Found impossible type ${maybePaymentInfo.type} in info meant for sendPayment message. convID: ${message.conversationIDKey} msgID: ${message.id}`
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
        'systemCreateTeam',
        'systemGitPush',
        'systemInviteAccepted',
        'systemSBSResolved',
        'systemSimpleToComplex',
        'systemText',
        'systemUsersAddedToConversation',
        'systemChangeAvatar',
        'systemNewChannel',
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
export const allMessageTypes: Set<Types.MessageType> = new Set([
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
  'systemSBSResolved',
  'systemSimpleToComplex',
  'systemChangeAvatar',
  'systemNewChannel',
  'systemText',
  'systemUsersAddedToConversation',
  'text',
  'placeholder',
])

// The types here are askew. It confuses frontend MessageType with protocol MessageType.
// Placeholder is an example where it doesn't make sense.
export const getDeletableByDeleteHistory = (state: TypedState) =>
  (!!state.chat2.staticConfig && state.chat2.staticConfig.deletableByDeleteHistory) || allMessageTypes

type Minimum = {
  author: string
  conversationIDKey: Types.ConversationIDKey
  id: Types.MessageID
  ordinal: Types.Ordinal
  timestamp: number
  isDeleteable: boolean
}

const makeMessageMinimum = {
  author: '',
  bodySummary: new HiddenString(''),
  conversationIDKey: noConversationIDKey,
  id: Types.numberToMessageID(0),
  isDeleteable: false,
  ordinal: Types.numberToOrdinal(0),
  timestamp: 0,
}

const makeMessageCommon = {
  ...makeMessageMinimum,
  deviceName: '',
  deviceType: 'mobile' as DeviceTypes.DeviceType,
  hasBeenEdited: false,
  outboxID: Types.stringToOutboxID(''),
}

const makeMessageCommonNoDeleteNoEdit = {
  ...makeMessageCommon,
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

export const makeMessagePlaceholder = (
  m?: Partial<MessageTypes.MessagePlaceholder>
): MessageTypes.MessagePlaceholder => ({
  ...makeMessageMinimum,
  type: 'placeholder',
  ...m,
})

export const makeMessageJourneycard = (
  m?: Partial<MessageTypes.MessageJourneycard>
): MessageTypes.MessageJourneycard => ({
  ...makeMessageMinimum,
  cardType: RPCChatTypes.JourneycardType.welcome,
  highlightMsgID: Types.numberToMessageID(0),
  openTeam: false,
  type: 'journeycard',
  ...m,
})

export const makeMessageDeleted = (
  m?: Partial<MessageTypes.MessageDeleted>
): MessageTypes.MessageDeleted => ({
  ...makeMessageCommon,
  type: 'deleted',
  ...m,
})

export const makeMessageText = (m?: Partial<MessageTypes.MessageText>): MessageTypes.MessageText => ({
  ...makeMessageCommon,
  ...makeMessageExplodable,
  decoratedText: null,
  flipGameID: null,
  inlinePaymentIDs: null,
  inlinePaymentSuccessful: false,
  isDeleteable: true,
  isEditable: true,
  mentionsAt: new Set(),
  mentionsChannel: 'none',
  mentionsChannelName: new Map(),
  paymentInfo: null,
  reactions: new Map(),
  replyTo: null,
  text: new HiddenString(''),
  type: 'text',
  unfurls: new Map(),
  ...m,
})

export const makeMessageAttachment = (
  m?: Partial<MessageTypes.MessageAttachment>
): MessageTypes.MessageAttachment => ({
  ...makeMessageCommon,
  ...makeMessageExplodable,
  attachmentType: 'file',
  audioAmps: [],
  audioDuration: 0,
  decoratedText: null,
  downloadPath: null,
  fileName: '',
  fileSize: 0,
  fileType: '',
  fileURL: '',
  fileURLCached: false,
  inlineVideoPlayable: false,
  isCollapsed: false,
  isDeleteable: true,
  isEditable: true,
  mentionsAt: new Set(),
  mentionsChannel: 'none',
  mentionsChannelName: new Map(),
  previewHeight: 0,
  previewTransferState: null,
  previewURL: '',
  previewWidth: 0,
  reactions: new Map(),
  showPlayButton: false,
  title: '',
  transferErrMsg: null,
  transferProgress: 0,
  transferState: null,
  type: 'attachment',
  videoDuration: null,
  ...m,
})

export const makeChatRequestInfo = (
  m?: Partial<MessageTypes.ChatRequestInfo>
): MessageTypes.ChatRequestInfo => ({
  amount: '',
  amountDescription: '',
  asset: 'native',
  canceled: false,
  currencyCode: '',
  done: false,
  type: 'requestInfo',
  worthAtRequestTime: '',
  ...m,
})

export const makeMessageRequestPayment = (
  m?: Partial<MessageTypes.MessageRequestPayment>
): MessageTypes.MessageRequestPayment => ({
  ...makeMessageCommon,
  note: new HiddenString(''),
  reactions: new Map(),
  requestID: '',
  requestInfo: null,
  type: 'requestPayment',
  ...m,
})

export const makeChatPaymentInfo = (
  m?: Partial<MessageTypes.ChatPaymentInfo>
): MessageTypes.ChatPaymentInfo => ({
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
  ...m,
})

export const makeMessageSendPayment = (
  m?: Partial<MessageTypes.MessageSendPayment>
): MessageTypes.MessageSendPayment => ({
  ...makeMessageCommon,
  paymentInfo: null,
  reactions: new Map(),
  type: 'sendPayment',
  ...m,
})

const makeMessageSystemJoined = (
  m?: Partial<MessageTypes.MessageSystemJoined>
): MessageTypes.MessageSystemJoined => ({
  ...makeMessageCommonNoDeleteNoEdit,
  joiners: [],
  leavers: [],
  type: 'systemJoined',
  ...m,
})

const makeMessageSystemLeft = (
  m?: Partial<MessageTypes.MessageSystemLeft>
): MessageTypes.MessageSystemLeft => ({
  ...makeMessageCommonNoDeleteNoEdit,
  type: 'systemLeft',
  ...m,
})

const makeMessageSystemAddedToTeam = (
  m?: Partial<MessageTypes.MessageSystemAddedToTeam>
): MessageTypes.MessageSystemAddedToTeam => ({
  ...makeMessageCommonNoDeleteNoEdit,
  addee: '',
  adder: '',
  bulkAdds: Array(),
  reactions: new Map(),
  role: 'none',
  team: '',
  type: 'systemAddedToTeam',
  ...m,
})

const makeMessageSystemInviteAccepted = (
  m?: Partial<MessageTypes.MessageSystemInviteAccepted>
): MessageTypes.MessageSystemInviteAccepted => ({
  ...makeMessageCommonNoDeleteNoEdit,
  adder: '',
  author: '[Keybase]',
  inviteType: 'none',
  invitee: '',
  inviter: '',
  reactions: new Map(),
  role: 'none',
  team: '',
  type: 'systemInviteAccepted',
  ...m,
})

export const makeMessageSystemSBSResolved = (
  m?: Partial<MessageTypes.MessageSystemSBSResolved>
): MessageTypes.MessageSystemSBSResolved => ({
  ...makeMessageCommonNoDeleteNoEdit,
  assertionService: null,
  assertionUsername: '',
  prover: '',
  reactions: new Map(),
  type: 'systemSBSResolved',
  ...m,
})

const makeMessageSystemSimpleToComplex = (
  m?: Partial<MessageTypes.MessageSystemSimpleToComplex>
): MessageTypes.MessageSystemSimpleToComplex => ({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: new Map(),
  team: '',
  type: 'systemSimpleToComplex',
  ...m,
})

export const makeMessageSystemText = (
  m?: Partial<MessageTypes.MessageSystemText>
): MessageTypes.MessageSystemText => ({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: new Map(),
  text: new HiddenString(''),
  type: 'systemText',
  ...m,
})

export const makeMessageSystemCreateTeam = (
  m?: Partial<MessageTypes.MessageSystemCreateTeam>
): MessageTypes.MessageSystemCreateTeam => ({
  ...makeMessageCommonNoDeleteNoEdit,
  creator: '',
  reactions: new Map(),
  team: '',
  type: 'systemCreateTeam',
  ...m,
})

export const makeMessageSystemGitPush = (
  m?: Partial<MessageTypes.MessageSystemGitPush>
): MessageTypes.MessageSystemGitPush => ({
  ...makeMessageCommonNoDeleteNoEdit,
  pushType: 0,
  pusher: '',
  reactions: new Map(),
  refs: [],
  repo: '',
  repoID: '',
  team: '',
  type: 'systemGitPush',
  ...m,
})

const makeMessageSetDescription = (
  m?: Partial<MessageTypes.MessageSetDescription>
): MessageTypes.MessageSetDescription => ({
  ...makeMessageCommonNoDeleteNoEdit,
  newDescription: new HiddenString(''),
  reactions: new Map(),
  type: 'setDescription',
  ...m,
})

const makeMessagePin = (m?: Partial<MessageTypes.MessagePin>): MessageTypes.MessagePin => ({
  ...makeMessageCommonNoDeleteNoEdit,
  pinnedMessageID: 0,
  reactions: new Map(),
  type: 'pin',
  ...m,
})

const makeMessageSetChannelname = (
  m?: Partial<MessageTypes.MessageSetChannelname>
): MessageTypes.MessageSetChannelname => ({
  ...makeMessageCommonNoDeleteNoEdit,
  newChannelname: '',
  reactions: new Map(),
  type: 'setChannelname',
  ...m,
})

const makeMessageSystemChangeRetention = (
  m?: Partial<MessageTypes.MessageSystemChangeRetention>
): MessageTypes.MessageSystemChangeRetention => ({
  ...makeMessageCommonNoDeleteNoEdit,
  isInherit: false,
  isTeam: false,
  membersType: 0,
  policy: null,
  reactions: new Map(),
  type: 'systemChangeRetention',
  user: '',
  you: '',
  ...m,
})

const makeMessageSystemUsersAddedToConversation = (
  m?: Partial<MessageTypes.MessageSystemUsersAddedToConversation>
): MessageTypes.MessageSystemUsersAddedToConversation => ({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: new Map(),
  type: 'systemUsersAddedToConversation',
  usernames: [],
  ...m,
})

const makeMessageSystemChangeAvatar = (
  m?: Partial<MessageTypes.MessageSystemChangeAvatar>
): MessageTypes.MessageSystemChangeAvatar => ({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: new Map(),
  team: '',
  type: 'systemChangeAvatar',
  user: '',
  ...m,
})

const makeMessageSystemNewChannel = (
  m?: Partial<MessageTypes.MessageSystemNewChannel>
): MessageTypes.MessageSystemNewChannel => ({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: new Map(),
  text: '',
  type: 'systemNewChannel',
  ...m,
})

export const makeReaction = (m?: Partial<MessageTypes.Reaction>): MessageTypes.Reaction => ({
  timestamp: 0,
  username: '',
  ...m,
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

export const reactionMapToReactions = (r: RPCChatTypes.UIReactionMap): MessageTypes.Reactions =>
  new Map(
    Object.keys(r.reactions || {}).reduce((arr: Array<[string, MessageTypes.ReactionDesc]>, emoji) => {
      if (r.reactions[emoji]) {
        arr.push([
          emoji,
          {
            decorated: r.reactions[emoji].decorated,
            users: new Set(
              Object.keys(r.reactions[emoji].users).map(username =>
                makeReaction({
                  timestamp: r.reactions[emoji].users[username].ctime,
                  username,
                })
              )
            ),
          },
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

  const mentionsAt = new Set(valid.atMentions || [])
  const mentionsChannel = channelMentionToMentionsChannel(valid.channelMention)
  const mentionsChannelName: Map<string, Types.ConversationIDKey> = new Map(
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
  reactions: Map<string, MessageTypes.ReactionDesc>,
  m: RPCChatTypes.UIMessageValid
): Types.Message | null => {
  switch (body.systemType) {
    case RPCChatTypes.MessageSystemType.addedtoteam: {
      const {adder = '', addee = '', team = ''} = body.addedtoteam || {}
      const roleEnum = body.addedtoteam ? body.addedtoteam.role : undefined
      const role = roleEnum ? TeamConstants.teamRoleByEnum[roleEnum] : 'none'
      const bulkAdds = body.addedtoteam.bulkAdds || []
      return makeMessageSystemAddedToTeam({
        ...minimum,
        addee,
        adder,
        bulkAdds,
        reactions,
        role,
        team,
      })
    }
    case RPCChatTypes.MessageSystemType.inviteaddedtoteam: {
      const inviteaddedtoteam = body.inviteaddedtoteam || ({} as RPCChatTypes.MessageSystemInviteAddedToTeam)
      const invitee = inviteaddedtoteam.invitee || 'someone'
      const role = TeamConstants.teamRoleByEnum[inviteaddedtoteam.role] || 'none'
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
        role,
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
    case RPCChatTypes.MessageSystemType.sbsresolve: {
      const {prover = '???', assertionUsername = '???'} = body.sbsresolve || {}
      const assertionService = body.sbsresolve && (body.sbsresolve.assertionService as ServiceId)
      return makeMessageSystemSBSResolved({
        ...minimum,
        assertionService,
        assertionUsername,
        prover,
        reactions,
      })
    }
    case RPCChatTypes.MessageSystemType.createteam: {
      const {team = '???', creator = '????'} = body.createteam || {}
      return makeMessageSystemCreateTeam({
        creator,
        reactions,
        team,
        ...minimum,
      })
    }
    case RPCChatTypes.MessageSystemType.gitpush: {
      const {
        team = '???',
        pushType = 0,
        pusher = '???',
        repoName: repo = '???',
        repoID = '???',
        refs = [],
      } = body.gitpush || {}
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
      const {user = '???', team = '???'} = body.changeavatar || {}
      return makeMessageSystemChangeAvatar({
        ...minimum,
        reactions,
        team,
        user,
      })
    }
    case RPCChatTypes.MessageSystemType.newchannel: {
      return m.decoratedTextBody
        ? makeMessageSystemNewChannel({
            ...minimum,
            reactions,
            text: m.decoratedTextBody,
          })
        : null
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
  const res: Types.PreviewSpec = {
    attachmentType: 'file' as Types.AttachmentType,
    audioAmps: [],
    audioDuration: 0,
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
    if (full && full.assetType === RPCChatTypes.AssetMetadataType.video && full.video && full.video.isAudio) {
      res.attachmentType = 'audio'
      res.audioDuration = full.video.durationMs
    } else {
      res.attachmentType = 'image'
      // full is a video but preview is an image?
      if (full && full.assetType === RPCChatTypes.AssetMetadataType.video) {
        res.showPlayButton = true
      }
    }
    res.audioAmps = preview.image.audioAmps || []
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

export const getMapUnfurl = (message: Types.Message): RPCChatTypes.UnfurlGenericDisplay | null => {
  const unfurls = message.type === 'text' && message.unfurls.size ? [...message.unfurls.values()] : null
  const mapInfo = unfurls?.[0]?.unfurl
    ? unfurls[0].unfurl.unfurlType === RPCChatTypes.UnfurlType.generic &&
      unfurls[0].unfurl.generic?.mapInfo &&
      unfurls[0].unfurl.generic
    : null
  return mapInfo || null
}

const validUIMessagetoMessage = (
  conversationIDKey: Types.ConversationIDKey,
  m: RPCChatTypes.UIMessageValid,
  currentUsername: string,
  getLastOrdinal: () => Types.Ordinal,
  currentDeviceName: string
) => {
  const minimum = {
    author: m.senderUsername,
    botUsername: m.botUsername || undefined,
    conversationIDKey,
    id: Types.numberToMessageID(m.messageID),
    isDeleteable: m.isDeleteable,
    ordinal: Types.numberToOrdinal(m.messageID),
    timestamp: m.ctime,
  }

  const reactions = reactionMapToReactions(m.reactions)
  const common = {
    ...minimum,
    bodySummary: new HiddenString(m.bodySummary),
    deviceName: m.senderDeviceName,
    deviceRevokedAt: m.senderDeviceRevokedAt || undefined,
    deviceType: DeviceTypes.stringToDeviceType(m.senderDeviceType),
    outboxID: m.outboxID ? Types.stringToOutboxID(m.outboxID) : undefined,
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
          rawText = m.messageBody.flip.text
          break
        case RPCChatTypes.MessageType.text:
          {
            const messageText = m.messageBody.text
            rawText = messageText.body
            payments = messageText.payments || null
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
          ? payments.reduce((arr: Array<string>, p) => {
              if (p.result.resultTyp === RPCChatTypes.TextPaymentResultTyp.sent) {
                const s = WalletTypes.rpcPaymentIDToPaymentID(p.result.sent)
                s && arr.push(s)
              }
              return arr
            }, [])
          : null,
        inlinePaymentSuccessful: m.paymentInfos
          ? m.paymentInfos.some(pi => successfulInlinePaymentStatuses.includes(pi.statusDescription))
          : false,
        isEditable: m.isEditable,
        mentionsAt: new Set(m.atMentions || []),
        mentionsChannel: channelMentionToMentionsChannel(m.channelMention),
        mentionsChannelName: new Map(
          (m.channelNameMentions || []).map(men => [men.name, Types.stringToConversationIDKey(men.convID)])
        ),
        replyTo: m.replyTo
          ? uiMessageToMessage(
              conversationIDKey,
              m.replyTo,
              currentUsername,
              getLastOrdinal,
              currentDeviceName
            )
          : null,
        text: new HiddenString(rawText),
        unfurls: new Map((m.unfurls || []).map(u => [u.url, u])),
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
        preview =
          attachment.preview ||
          (attachment.previews && attachment.previews.length ? attachment.previews[0] : null)
        full = attachment.object
        if (!attachment.uploaded) {
          transferState = 'remoteUploading' as const
        }
      } else if (m.messageBody.messageType === RPCChatTypes.MessageType.attachmentuploaded) {
        attachment = m.messageBody.attachmentuploaded
        preview = attachment.previews && attachment.previews.length ? attachment.previews[0] : null
        full = attachment.object
        transferState = null
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
        audioAmps: pre.audioAmps,
        audioDuration: pre.audioDuration,
        decoratedText: m.decoratedTextBody ? new HiddenString(m.decoratedTextBody) : null,
        fileName: filename,
        fileSize: size,
        fileType,
        fileURL,
        fileURLCached,
        hasBeenEdited: m.superseded,
        inlineVideoPlayable,
        isCollapsed: m.isCollapsed,
        isEditable: m.isEditable,
        mentionsAt: new Set(m.atMentions || []),
        mentionsChannel: channelMentionToMentionsChannel(m.channelMention),
        mentionsChannelName: new Map(
          (m.channelNameMentions || []).map(men => [men.name, Types.stringToConversationIDKey(men.convID)])
        ),
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
        joiners: m.messageBody.join.joiners || [],
        leavers: m.messageBody.join.leavers || [],
      })
    case RPCChatTypes.MessageType.leave:
      return makeMessageSystemLeft({
        ...common,
      })
    case RPCChatTypes.MessageType.system:
      return m.messageBody.system
        ? uiMessageToSystemMessage(common, m.messageBody.system, common.reactions, m)
        : null
    case RPCChatTypes.MessageType.headline:
      return makeMessageSetDescription({
        ...common,
        newDescription: new HiddenString(m.messageBody.headline.headline),
        reactions,
      })
    case RPCChatTypes.MessageType.pin:
      return makeMessagePin({
        ...common,
        pinnedMessageID: m.pinnedMessageID || m.messageID,
        reactions,
      })
    case RPCChatTypes.MessageType.metadata:
      return makeMessageSetChannelname({
        ...common,
        newChannelname: m.messageBody.metadata.conversationTitle,
        reactions,
      })
    case RPCChatTypes.MessageType.sendpayment:
      return makeMessageSendPayment({
        ...common,
        paymentInfo: uiPaymentInfoToChatPaymentInfo(m.paymentInfos || null),
      })
    case RPCChatTypes.MessageType.requestpayment:
      return makeMessageRequestPayment({
        ...common,
        note: new HiddenString(m.decoratedTextBody ?? ''),
        requestID: m.messageBody.requestpayment.requestID,
        requestInfo: uiRequestInfoToChatRequestInfo(m.requestInfo || null),
      })
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
    case RPCChatTypes.OutboxErrorType.restrictedbot:
      return 'bot is restricted from sending to this conversation'
    case RPCChatTypes.OutboxErrorType.minwriter:
      return 'not high enough team role to post in this conversation'
    default:
      return `${error.message || ''} (code: ${error.typ})`
  }
}

const outboxUIMessagetoMessage = (
  conversationIDKey: Types.ConversationIDKey,
  o: RPCChatTypes.UIMessageOutbox,
  currentUsername: string,
  getLastOrdinal: () => Types.Ordinal,
  currentDeviceName: string
) => {
  const errorReason =
    o.state && o.state.state === RPCChatTypes.OutboxStateType.error
      ? rpcErrorToString(o.state.error)
      : undefined
  const errorTyp =
    o.state && o.state.state === RPCChatTypes.OutboxStateType.error ? o.state.error.typ : undefined

  switch (o.messageType) {
    case RPCChatTypes.MessageType.attachment: {
      const title = o.title
      const fileName = o.filename
      let previewURL = ''
      let pre = previewSpecs(null, null)
      if (o.preview) {
        previewURL =
          o.preview.location && o.preview.location.ltyp === RPCChatTypes.PreviewLocationTyp.url
            ? o.preview.location.url
            : ''
        const md = (o.preview && o.preview.metadata) || null
        const baseMd = (o.preview && o.preview.baseMetadata) || null
        pre = previewSpecs(md, baseMd)
      }
      return makePendingAttachmentMessage(
        conversationIDKey,
        currentUsername,
        getLastOrdinal,
        title,
        FsTypes.getLocalPathName(fileName),
        previewURL,
        pre,
        Types.stringToOutboxID(o.outboxID),
        Types.numberToOrdinal(o.ordinal),
        errorReason,
        errorTyp,
        o.isEphemeral
      )
    }
    case RPCChatTypes.MessageType.flip:
    case RPCChatTypes.MessageType.text:
      return makeMessageText({
        author: currentUsername,
        conversationIDKey,
        decoratedText: o.decoratedTextBody ? new HiddenString(o.decoratedTextBody) : null,
        deviceName: currentDeviceName,
        deviceType: isMobile ? 'mobile' : 'desktop',
        errorReason,
        errorTyp,
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
    botUsername: o.botUsername || undefined,
    conversationIDKey,
    deviceName: o.senderDeviceName,
    deviceType: DeviceTypes.stringToDeviceType(o.senderDeviceType),
    errorReason: o.errMsg,
    exploded: o.isEphemeral && (o.etime < Date.now() || !!o.explodedBy),
    explodedBy: o.explodedBy || '',
    exploding: o.isEphemeral,
    explodingUnreadable: !!o.errType && o.isEphemeral,
    id: Types.numberToMessageID(o.messageID),
    ordinal: Types.numberToOrdinal(o.messageID),
    timestamp: o.ctime,
  })
}

export const journeyCardTypeToType = invert(RPCChatTypes.JourneycardType) as {
  [K in RPCChatTypes.JourneycardType]: keyof typeof RPCChatTypes.JourneycardType
}

const journeycardUIMessageToMessage = (
  conversationIDKey: Types.ConversationIDKey,
  m: RPCChatTypes.UIMessageJourneycard
) => {
  return makeMessageJourneycard({
    cardType: m.cardType,
    conversationIDKey,
    highlightMsgID: m.highlightMsgID,
    openTeam: m.openTeam,
    ordinal: Types.numberToOrdinal(m.ordinal),
  })
}

export const uiMessageToMessage = (
  conversationIDKey: Types.ConversationIDKey,
  uiMessage: RPCChatTypes.UIMessage,
  currentUsername: string,
  getLastOrdinal: () => Types.Ordinal,
  currentDeviceName: string
): Types.Message | null => {
  switch (uiMessage.state) {
    case RPCChatTypes.MessageUnboxedState.valid:
      return validUIMessagetoMessage(
        conversationIDKey,
        uiMessage.valid,
        currentUsername,
        getLastOrdinal,
        currentDeviceName
      )
    case RPCChatTypes.MessageUnboxedState.error:
      return errorUIMessagetoMessage(conversationIDKey, uiMessage.error)
    case RPCChatTypes.MessageUnboxedState.outbox:
      return outboxUIMessagetoMessage(
        conversationIDKey,
        uiMessage.outbox,
        currentUsername,
        getLastOrdinal,
        currentDeviceName
      )
    case RPCChatTypes.MessageUnboxedState.placeholder:
      return placeholderUIMessageToMessage(conversationIDKey, uiMessage.placeholder)
    case RPCChatTypes.MessageUnboxedState.journeycard:
      return journeycardUIMessageToMessage(conversationIDKey, uiMessage.journeycard)
    default:
      assertNever(uiMessage) // A type error here means there is an unhandled message state
      return null
  }
}

export function nextFractionalOrdinal(ord: Types.Ordinal): Types.Ordinal {
  // Mimic what the service does with outbox items
  return Types.numberToOrdinal(Types.ordinalToNumber(ord) + 0.001)
}

export const makePendingTextMessage = (
  conversationIDKey: Types.ConversationIDKey,
  currentUsername: string,
  getLastOrdinal: () => Types.Ordinal,
  text: HiddenString,
  outboxID: Types.OutboxID,
  explodeTime?: number
) => {
  // we could read the exploding mode for the convo from state here, but that
  // would cause the timer to count down while the message is still pending
  // and probably reset when we get the real message back.

  const ordinal = nextFractionalOrdinal(getLastOrdinal())
  const explodeInfo = explodeTime ? {exploding: true, explodingTime: Date.now() + explodeTime * 1000} : {}

  return makeMessageText({
    ...explodeInfo,
    author: currentUsername,
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
  conversationIDKey: Types.ConversationIDKey,
  currentUsername: string,
  getLastOrdinal: () => Types.Ordinal,
  title: string,
  fileName: string,
  previewURL: string,
  previewSpec: Types.PreviewSpec,
  outboxID: Types.OutboxID,
  inOrdinal: Types.Ordinal | null,
  errorReason?: string,
  errorTyp?: number,
  exploding?: boolean
) => {
  const ordinal = !inOrdinal ? nextFractionalOrdinal(getLastOrdinal()) : inOrdinal

  return makeMessageAttachment({
    attachmentType: previewSpec.attachmentType,
    audioAmps: previewSpec.audioAmps,
    audioDuration: previewSpec.audioDuration,
    author: currentUsername,
    conversationIDKey,
    deviceName: '',
    deviceType: isMobile ? 'mobile' : 'desktop',
    errorReason: errorReason,
    errorTyp: errorTyp,
    exploding,
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

export const getClientPrev = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey
): Types.MessageID => {
  let clientPrev: undefined | Types.MessageID

  const mm = state.chat2.messageMap.get(conversationIDKey)
  if (mm) {
    // find last valid messageid we know about
    const goodOrdinal = [...(state.chat2.messageOrdinals.get(conversationIDKey) || [])].reverse().find(o => {
      const m = mm.get(o)
      return m && m.id
    })

    if (goodOrdinal) {
      const message = mm.get(goodOrdinal)
      clientPrev = message && message.id
    }
  }

  return clientPrev || 0
}

const imageFileNameRegex = /[^/]+\.(jpg|png|gif|jpeg|bmp)$/i
export const pathToAttachmentType = (path: string) => (imageFileNameRegex.test(path) ? 'image' : 'file')
export const isSpecialMention = (s: string) => ['here', 'channel', 'everyone'].includes(s)

export const specialMentions = ['here', 'channel', 'everyone']

export const mergeMessage = (old: Types.Message | null, m: Types.Message): Types.Message => {
  if (!old) {
    return m
  }

  // only merge if its the same id and type
  if (old.id !== m.id || old.type !== m.type) {
    return m
  }

  const toRet: any = {...m}

  Object.keys(old).forEach(key => {
    switch (key) {
      case 'mentionsAt':
        if (
          m.type === 'text' &&
          old.type === 'text' &&
          shallowEqual([...old.mentionsAt], [...m.mentionsAt])
        ) {
          toRet.mentionsAt = old.mentionsAt
        }
        break
      case 'mentionsChannelName':
        if (
          m.type === 'text' &&
          old.type === 'text' &&
          shallowEqual([...old.mentionsChannelName.entries()], [...m.mentionsChannelName].entries())
        ) {
          toRet.mentionsChannelName = old.mentionsChannelName
        }
        break
      case 'text':
        if (m.type === 'text' && old.type === 'text' && old.text.stringValue() === m.text.stringValue()) {
          toRet.text = old.text
        }
        break
      default:
        // @ts-ignore strict: key is just a string here so TS doesn't like it
        if (old[key] === m[key]) {
          // @ts-ignore strict
          toRet[key] = old[key]
        }
    }
  })

  return toRet
}

export const upgradeMessage = (old: Types.Message, m: Types.Message): Types.Message => {
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

    return {...m, ordinal: old.ordinal}
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
      return {
        ...m,
        ordinal: old.ordinal,
        previewURL: old.previewURL,
      }
    }
    return {
      ...m,
      // We got an attachment-uploaded message. Hold on to the old ID
      // because that's what the service expects to delete this message
      downloadPath: old.downloadPath,
      id: old.id,
      ordinal: old.ordinal,
      previewURL: old.previewURL && !m.previewURL ? old.previewURL : m.previewURL,
      transferProgress: old.transferProgress,
      transferState: old.transferState === 'remoteUploading' ? null : old.transferState,
    }
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
    case 'setDescription':
    case 'pin':
    case 'systemAddedToTeam':
    case 'systemChangeRetention':
    case 'systemGitPush':
    case 'systemInviteAccepted':
    case 'systemSBSResolved':
    case 'systemSimpleToComplex':
    case 'systemText':
    case 'systemUsersAddedToConversation':
    case 'systemChangeAvatar':
    case 'systemNewChannel':
    case 'journeycard':
      return true
    case 'setChannelname':
      return message.newChannelname !== 'general'
    case 'sendPayment': {
      const paymentInfo = getPaymentMessageInfo(state, message)
      if (!paymentInfo || ['claimable', 'pending', 'canceled'].includes(paymentInfo.status)) {
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

export const messageAttachmentTransferStateToProgressLabel = (
  transferState: Types.MessageAttachmentTransferState
): string => {
  switch (transferState) {
    case 'downloading':
      return 'Downloading'
    case 'uploading':
      return 'Uploading'
    case 'mobileSaving':
      return 'Saving...'
    case 'remoteUploading':
      return 'waiting...'
    default:
      return ''
  }
}

export const messageAttachmentHasProgress = (message: Types.MessageAttachment) => {
  return (
    !!message.transferState &&
    message.transferState !== 'remoteUploading' &&
    message.transferState !== 'mobileSaving'
  )
}
