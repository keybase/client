// Message related constants
import * as T from '../types'
import * as C from '..'
import type * as ConvoConstants from './convostate'
import HiddenString from '@/util/hidden-string'
import logger from '@/logger'
import type * as MessageTypes from '../types/chat2/message'
import type {ServiceId} from 'util/platforms'
import {noConversationIDKey} from '../types/chat2/common'

const noString = new HiddenString('')

export const isPathHEIC = (path: string) => path.toLowerCase().endsWith('.heic')
// real image or heic
export const isImageViewable = (message: T.Chat.Message) => {
  if (message.type === 'attachment') {
    if (message.attachmentType === 'image') {
      // regular image
      return true
    }
    if (message.attachmentType === 'file' && C.isIOS && isPathHEIC(message.fileName)) {
      return true
    }
  }
  return false
}

export const getMessageRenderType = (m: T.Immutable<T.Chat.Message>): T.Chat.RenderMessageType => {
  switch (m.type) {
    case 'attachment':
      if (m.inlineVideoPlayable && m.attachmentType !== 'audio') {
        return 'attachment:video'
      }
      // allow heic on ios only
      if (isImageViewable(m)) {
        return 'attachment:image'
      }
      return `attachment:${m.attachmentType}`
    default:
      return m.type
  }
}
export const isMessageWithReactions = (message: T.Chat.Message) => {
  return (
    !(
      message.type === 'placeholder' ||
      message.type === 'deleted' ||
      message.type === 'systemJoined' ||
      message.type === 'systemLeft' ||
      message.type === 'journeycard'
    ) &&
    !message.exploded &&
    !message.errorReason
  )
}
export const getMessageID = (m: T.RPCChat.UIMessage) => {
  switch (m.state) {
    case T.RPCChat.MessageUnboxedState.valid:
      return T.Chat.numberToMessageID(m.valid.messageID)
    case T.RPCChat.MessageUnboxedState.error:
      return T.Chat.numberToMessageID(m.error.messageID)
    case T.RPCChat.MessageUnboxedState.placeholder:
      return T.Chat.numberToMessageID(m.placeholder.messageID)
    default:
      return null
  }
}

export const getPaymentMessageInfo = (
  accountsInfoMap: ConvoConstants.ConvoState['accountsInfoMap'],
  message: T.Chat.MessageSendPayment | T.Chat.MessageText
): T.Chat.ChatPaymentInfo | undefined => {
  const maybePaymentInfo = accountsInfoMap.get(message.id)
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

export const isPendingPaymentMessage = (
  accountsInfoMap: ConvoConstants.ConvoState['accountsInfoMap'],
  message?: T.Chat.Message
) => {
  if (message?.type !== 'sendPayment') {
    return false
  }
  const paymentInfo = getPaymentMessageInfo(accountsInfoMap, message)
  return !!(paymentInfo && paymentInfo.status === 'pending')
}

// Map service message types to our message types.
export const serviceMessageTypeToMessageTypes = (t: T.RPCChat.MessageType): Array<T.Chat.MessageType> => {
  switch (t) {
    case T.RPCChat.MessageType.text:
      return ['text']
    case T.RPCChat.MessageType.attachment:
      return ['attachment']
    case T.RPCChat.MessageType.metadata:
      return ['setDescription']
    case T.RPCChat.MessageType.headline:
      return ['setChannelname']
    case T.RPCChat.MessageType.attachmentuploaded:
      return ['attachment']
    case T.RPCChat.MessageType.join:
      return ['systemJoined']
    case T.RPCChat.MessageType.leave:
      return ['systemLeft']
    case T.RPCChat.MessageType.system:
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
    case T.RPCChat.MessageType.sendpayment:
      return ['sendPayment']
    case T.RPCChat.MessageType.requestpayment:
      return ['requestPayment']
    // mutations and other types we don't store directly
    case T.RPCChat.MessageType.none:
    case T.RPCChat.MessageType.edit:
    case T.RPCChat.MessageType.delete:
    case T.RPCChat.MessageType.tlfname:
    case T.RPCChat.MessageType.deletehistory:
    case T.RPCChat.MessageType.reaction:
    case T.RPCChat.MessageType.unfurl:
    case T.RPCChat.MessageType.flip:
      return []
    default:
      return []
  }
}

type Minimum = {
  author: string
  conversationIDKey: T.Chat.ConversationIDKey
  id: T.Chat.MessageID
  ordinal: T.Chat.Ordinal
  timestamp: number
  isDeleteable: boolean
}

const makeMessageMinimum = {
  author: '',
  bodySummary: noString,
  conversationIDKey: noConversationIDKey,
  id: T.Chat.numberToMessageID(0),
  isDeleteable: false,
  ordinal: T.Chat.numberToOrdinal(0),
  timestamp: 0,
}

const makeMessageCommon = {
  ...makeMessageMinimum,
  deviceName: '',
  deviceType: 'mobile' as T.Devices.DeviceType,
  hasBeenEdited: false,
  outboxID: T.Chat.stringToOutboxID(''),
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
  cardType: T.RPCChat.JourneycardType.welcome,
  highlightMsgID: T.Chat.numberToMessageID(0),
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
  inlinePaymentSuccessful: false,
  isDeleteable: true,
  isEditable: true,
  mentionsAt: undefined,
  mentionsChannel: 'none',
  reactions: undefined,
  text: noString,
  type: 'text',
  unfurls: undefined,
  ...m,
})

export const makeMessageAttachment = (
  m?: Partial<MessageTypes.MessageAttachment>
): MessageTypes.MessageAttachment => ({
  ...makeMessageCommon,
  ...makeMessageExplodable,
  attachmentType: 'file',
  audioAmps: undefined,
  audioDuration: 0,
  fileName: '',
  fileSize: 0,
  fileType: '',
  fileURL: '',
  fileURLCached: false,
  fullHeight: 0,
  fullWidth: 0,
  inlineVideoPlayable: false,
  isCollapsed: false,
  isDeleteable: true,
  isEditable: true,
  previewHeight: 0,
  previewURL: '',
  previewWidth: 0,
  reactions: undefined,
  showPlayButton: false,
  title: '',
  transferProgress: 0,
  type: 'attachment',
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
  note: noString,
  reactions: undefined,
  requestID: '',
  type: 'requestPayment',
  ...m,
})

export const makeChatPaymentInfo = (
  m?: Partial<MessageTypes.ChatPaymentInfo>
): MessageTypes.ChatPaymentInfo => ({
  accountID: T.Wallets.noAccountID,
  amountDescription: '',
  delta: 'none',
  fromUsername: '',
  issuerDescription: '',
  note: noString,
  paymentID: T.Wallets.noPaymentID,
  showCancel: false,
  sourceAmount: '',
  sourceAsset: C.Wallets.emptyAssetDescription,
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
  reactions: undefined,
  type: 'sendPayment',
  ...m,
})

const makeMessageSystemJoined = (
  m?: Partial<MessageTypes.MessageSystemJoined>
): MessageTypes.MessageSystemJoined => ({
  ...makeMessageCommonNoDeleteNoEdit,
  joiners: undefined,
  leavers: undefined,
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
  bulkAdds: undefined,
  reactions: undefined,
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
  reactions: undefined,
  role: 'none',
  team: '',
  type: 'systemInviteAccepted',
  ...m,
})

export const makeMessageSystemSBSResolved = (
  m?: Partial<MessageTypes.MessageSystemSBSResolved>
): MessageTypes.MessageSystemSBSResolved => ({
  ...makeMessageCommonNoDeleteNoEdit,
  assertionUsername: '',
  prover: '',
  reactions: undefined,
  type: 'systemSBSResolved',
  ...m,
})

const makeMessageSystemSimpleToComplex = (
  m?: Partial<MessageTypes.MessageSystemSimpleToComplex>
): MessageTypes.MessageSystemSimpleToComplex => ({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: undefined,
  team: '',
  type: 'systemSimpleToComplex',
  ...m,
})

export const makeMessageSystemText = (
  m?: Partial<MessageTypes.MessageSystemText>
): MessageTypes.MessageSystemText => ({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: undefined,
  text: noString,
  type: 'systemText',
  ...m,
})

export const makeMessageSystemCreateTeam = (
  m?: Partial<MessageTypes.MessageSystemCreateTeam>
): MessageTypes.MessageSystemCreateTeam => ({
  ...makeMessageCommonNoDeleteNoEdit,
  creator: '',
  reactions: undefined,
  team: '',
  type: 'systemCreateTeam',
  ...m,
})

const branchRefPrefix = 'refs/heads/'
export const systemGitBranchName = (ref: T.RPCGen.GitRefMetadata) => {
  const {refName} = ref
  return refName.startsWith(branchRefPrefix) ? refName.substring(branchRefPrefix.length) : refName
}

export const makeMessageSystemGitPush = (
  m?: Partial<MessageTypes.MessageSystemGitPush>
): MessageTypes.MessageSystemGitPush => ({
  ...makeMessageCommonNoDeleteNoEdit,
  pushType: 0,
  pusher: '',
  reactions: undefined,
  refs: undefined,
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
  newDescription: noString,
  reactions: undefined,
  type: 'setDescription',
  ...m,
})

const makeMessagePin = (m?: Partial<MessageTypes.MessagePin>): MessageTypes.MessagePin => ({
  ...makeMessageCommonNoDeleteNoEdit,
  pinnedMessageID: T.Chat.numberToMessageID(0),
  reactions: undefined,
  type: 'pin',
  ...m,
})

const makeMessageSetChannelname = (
  m?: Partial<MessageTypes.MessageSetChannelname>
): MessageTypes.MessageSetChannelname => ({
  ...makeMessageCommonNoDeleteNoEdit,
  newChannelname: '',
  reactions: undefined,
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
  reactions: undefined,
  type: 'systemChangeRetention',
  user: '',
  you: '',
  ...m,
})

const makeMessageSystemUsersAddedToConversation = (
  m?: Partial<MessageTypes.MessageSystemUsersAddedToConversation>
): MessageTypes.MessageSystemUsersAddedToConversation => ({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: undefined,
  type: 'systemUsersAddedToConversation',
  usernames: [],
  ...m,
})

const makeMessageSystemChangeAvatar = (
  m?: Partial<MessageTypes.MessageSystemChangeAvatar>
): MessageTypes.MessageSystemChangeAvatar => ({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: undefined,
  team: '',
  type: 'systemChangeAvatar',
  user: '',
  ...m,
})

const makeMessageSystemNewChannel = (
  m?: Partial<MessageTypes.MessageSystemNewChannel>
): MessageTypes.MessageSystemNewChannel => ({
  ...makeMessageCommonNoDeleteNoEdit,
  reactions: undefined,
  text: new HiddenString(''),
  type: 'systemNewChannel',
  ...m,
})

export const makeReaction = (m?: Partial<MessageTypes.Reaction>): MessageTypes.Reaction => ({
  timestamp: 0,
  username: '',
  ...m,
})

export const uiRequestInfoToChatRequestInfo = (
  r?: T.RPCChat.UIRequestInfo
): MessageTypes.ChatRequestInfo | undefined => {
  if (!r) {
    return
  }
  let asset: T.Wallets.Asset = 'native'
  let currencyCode = ''
  if (!(r.asset || r.currency)) {
    logger.error('Received UIRequestInfo with no asset or currency code')
    return
  } else if (r.asset && r.asset.type !== 'native') {
    const assetResult = r.asset
    asset = C.Wallets.makeAssetDescription({
      code: assetResult.code,
      issuerAccountID: assetResult.issuer,
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
    canceled: r.status === T.RPCStellar.RequestStatus.canceled,
    currencyCode,
    done: r.status === T.RPCStellar.RequestStatus.done,
    worthAtRequestTime: r.worthAtRequestTime,
  })
}

export const uiPaymentInfoToChatPaymentInfo = (
  ps?: ReadonlyArray<T.RPCChat.UIPaymentInfo>
): MessageTypes.ChatPaymentInfo | undefined => {
  if (!ps || ps.length !== 1) {
    return undefined
  }
  const p = ps[0]!
  const serviceStatus = C.Wallets.statusSimplifiedToString[p.status]
  return makeChatPaymentInfo({
    accountID: p.accountID ?? T.Wallets.noAccountID,
    amountDescription: p.amountDescription,
    delta: C.Wallets.balanceDeltaToString[p.delta],
    fromUsername: p.fromUsername,
    issuerDescription: p.issuerDescription,
    note: new HiddenString(p.note),
    paymentID: p.paymentID,
    showCancel: p.showCancel,
    sourceAmount: p.sourceAmount,
    sourceAsset: C.Wallets.makeAssetDescription({
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

export const reactionMapToReactions = (r: T.RPCChat.UIReactionMap): undefined | MessageTypes.Reactions =>
  r.reactions
    ? new Map(
        Object.keys(r.reactions).reduce((arr: Array<[string, MessageTypes.ReactionDesc]>, emoji) => {
          if (r.reactions?.[emoji]) {
            arr.push([
              emoji,
              {
                decorated: r.reactions[emoji]!.decorated,
                users: new Set(
                  Object.keys(r.reactions[emoji]?.users ?? {}).map(username =>
                    makeReaction({
                      timestamp: r.reactions?.[emoji]!.users?.[username]?.ctime,
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
    : undefined

const uiMessageToSystemMessage = (
  minimum: Minimum,
  body: T.RPCChat.MessageSystem,
  reactions: undefined | ReadonlyMap<string, MessageTypes.ReactionDesc>,
  m: T.RPCChat.UIMessageValid
): T.Chat.Message | undefined => {
  switch (body.systemType) {
    case T.RPCChat.MessageSystemType.addedtoteam: {
      const {adder = '', addee = '', team = ''} = body.addedtoteam
      const roleEnum = body.addedtoteam.role
      const role = roleEnum ? C.Teams.teamRoleByEnum[roleEnum] : 'none'
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
    case T.RPCChat.MessageSystemType.inviteaddedtoteam: {
      const inviteaddedtoteam = body.inviteaddedtoteam
      const invitee = inviteaddedtoteam.invitee || 'someone'
      const role = C.Teams.teamRoleByEnum[inviteaddedtoteam.role]
      const adder = inviteaddedtoteam.adder || 'someone'
      const inviter = inviteaddedtoteam.inviter || 'someone'
      const team = inviteaddedtoteam.team || '???'
      const iType = inviteaddedtoteam.inviteType || T.RPCGen.TeamInviteCategory.unknown
      let inviteType: MessageTypes.MessageSystemInviteAccepted['inviteType']
      switch (iType) {
        case T.RPCGen.TeamInviteCategory.unknown:
          inviteType = 'unknown'
          break
        case T.RPCGen.TeamInviteCategory.keybase:
          inviteType = 'keybase'
          break
        case T.RPCGen.TeamInviteCategory.email:
          inviteType = 'email'
          break
        case T.RPCGen.TeamInviteCategory.sbs:
          inviteType = 'sbs'
          break
        case T.RPCGen.TeamInviteCategory.seitan:
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
    case T.RPCChat.MessageSystemType.complexteam: {
      const {team = ''} = body.complexteam
      return makeMessageSystemSimpleToComplex({
        ...minimum,
        reactions,
        team,
      })
    }
    case T.RPCChat.MessageSystemType.sbsresolve: {
      const {prover = '???', assertionUsername = '???'} = body.sbsresolve
      const assertionService = body.sbsresolve.assertionService as ServiceId
      return makeMessageSystemSBSResolved({
        ...minimum,
        assertionService,
        assertionUsername,
        prover,
        reactions,
      })
    }
    case T.RPCChat.MessageSystemType.createteam: {
      const {team = '???', creator = '????'} = body.createteam
      return makeMessageSystemCreateTeam({
        creator,
        reactions,
        team,
        ...minimum,
      })
    }
    case T.RPCChat.MessageSystemType.gitpush: {
      const {
        team = '???',
        pushType = 0,
        pusher = '???',
        repoName: repo = '???',
        repoID = '???',
        refs = [],
      } = body.gitpush
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
    case T.RPCChat.MessageSystemType.changeavatar: {
      const {user = '???', team = '???'} = body.changeavatar
      return makeMessageSystemChangeAvatar({
        ...minimum,
        reactions,
        team,
        user,
      })
    }
    case T.RPCChat.MessageSystemType.newchannel: {
      return m.decoratedTextBody
        ? makeMessageSystemNewChannel({
            ...minimum,
            reactions,
            text: new HiddenString(m.decoratedTextBody),
          })
        : undefined
    }
    case T.RPCChat.MessageSystemType.changeretention: {
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
    case T.RPCChat.MessageSystemType.bulkaddtoconv: {
      if (!body.bulkaddtoconv.usernames) {
        return undefined
      }
      return makeMessageSystemUsersAddedToConversation({
        ...minimum,
        reactions,
        usernames: body.bulkaddtoconv.usernames,
      })
    }

    default:
      return
  }
}

export const isVideoAttachment = (message: T.Chat.MessageAttachment) => message.fileType.startsWith('video')

export const maxAmpsLength = 60
export const previewSpecs = (preview?: T.RPCChat.AssetMetadata, full?: T.RPCChat.AssetMetadata) => {
  const res: T.Chat.PreviewSpec = {
    attachmentType: 'file' as T.Chat.AttachmentType,
    audioAmps: [],
    audioDuration: 0,
    height: 0,
    showPlayButton: false,
    width: 0,
  }
  if (!preview) {
    return res
  }
  if (preview.assetType === T.RPCChat.AssetMetadataType.image) {
    res.height = preview.image.height
    res.width = preview.image.width
    if (full && full.assetType === T.RPCChat.AssetMetadataType.video && full.video.isAudio) {
      res.attachmentType = 'audio'
      res.audioDuration = full.video.durationMs
    } else {
      res.attachmentType = 'image'
      // full is a video but preview is an image?
      if (full && full.assetType === T.RPCChat.AssetMetadataType.video) {
        res.showPlayButton = true
      }
    }
    const aa = [...(preview.image.audioAmps ?? [])]
    aa.length = Math.min(aa.length, maxAmpsLength)
    res.audioAmps = aa
  } else if (preview.assetType === T.RPCChat.AssetMetadataType.video) {
    res.height = preview.video.height
    res.width = preview.video.width
    res.attachmentType = 'image'
  }
  return res
}

export const getMapUnfurl = (message: T.Chat.Message): T.RPCChat.UnfurlGenericDisplay | undefined => {
  const unfurls = message.type === 'text' && message.unfurls?.size ? [...message.unfurls.values()] : null
  const mapInfo = unfurls?.[0]?.unfurl
    ? unfurls[0].unfurl.unfurlType === T.RPCChat.UnfurlType.generic &&
      unfurls[0].unfurl.generic.mapInfo &&
      unfurls[0].unfurl.generic
    : undefined
  return mapInfo || undefined
}

const successfulInlinePaymentStatuses = ['completed', 'claimable']
const validUIMessagetoMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  m: T.RPCChat.UIMessageValid,
  currentUsername: string,
  getLastOrdinal: () => T.Chat.Ordinal,
  currentDeviceName: string
): MessageTypes.Message | undefined => {
  const minimum = {
    author: m.senderUsername,
    botUsername: m.botUsername || undefined,
    conversationIDKey,
    id: T.Chat.numberToMessageID(m.messageID),
    isDeleteable: m.isDeleteable,
    ordinal: T.Chat.numberToOrdinal(m.messageID),
    timestamp: m.ctime,
  }

  const reactions = reactionMapToReactions(m.reactions)
  const common = {
    ...minimum,
    bodySummary: m.bodySummary ? new HiddenString(m.bodySummary) : noString,
    deviceName: m.senderDeviceName,
    deviceRevokedAt: m.senderDeviceRevokedAt || undefined,
    deviceType: T.Devices.stringToDeviceType(m.senderDeviceType),
    outboxID: m.outboxID ? T.Chat.stringToOutboxID(m.outboxID) : undefined,
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
    case T.RPCChat.MessageType.flip:
    case T.RPCChat.MessageType.text: {
      let rawText: string
      let payments: ReadonlyArray<T.RPCChat.TextPayment> | undefined
      switch (m.messageBody.messageType) {
        case T.RPCChat.MessageType.flip:
          rawText = m.messageBody.flip.text
          break
        case T.RPCChat.MessageType.text:
          {
            const messageText = m.messageBody.text
            rawText = messageText.body
            payments = messageText.payments || undefined
          }
          break
        default:
          rawText = ''
      }
      return makeMessageText({
        ...common,
        ...explodable,
        decoratedText: m.decoratedTextBody ? new HiddenString(m.decoratedTextBody) : undefined,
        flipGameID: m.flipGameID ?? undefined,
        hasBeenEdited: m.superseded,
        inlinePaymentIDs: payments
          ? payments.reduce((arr: Array<string>, p) => {
              if (p.result.resultTyp === T.RPCChat.TextPaymentResultTyp.sent) {
                const s = p.result.sent
                s && arr.push(s)
              }
              return arr
            }, [])
          : undefined,
        inlinePaymentSuccessful: m.paymentInfos
          ? m.paymentInfos.some(pi => successfulInlinePaymentStatuses.includes(pi.statusDescription))
          : false,
        isEditable: m.isEditable,
        replyTo: m.replyTo
          ? (uiMessageToMessage(
              conversationIDKey,
              m.replyTo,
              currentUsername,
              getLastOrdinal,
              currentDeviceName
            ) as T.Chat.MessageReplyTo)
          : undefined,
        text: new HiddenString(rawText),
        unfurls: m.unfurls ? new Map(m.unfurls.map(u => [u.url, u])) : undefined,
      })
    }
    case T.RPCChat.MessageType.attachmentuploaded: // fallthrough
    case T.RPCChat.MessageType.attachment: {
      // The attachment flow is currently pretty complicated. We'll have core do more of this so it'll be simpler but for now
      // 1. On thread load we only get attachment type. It'll have full data
      // 2. On incoming we get attachment first (placeholder), then we get the full data (attachmentuploaded)
      // 3. When we send we place a pending attachment, then get the real attachment then attachmentuploaded
      // We treat all these like a pending text, so any data-less thing will have no message id and map to the same ordinal
      let attachment: T.RPCChat.MessageAttachment | T.RPCChat.MessageAttachmentUploaded | undefined
      let preview: T.RPCChat.Asset | undefined
      let full: T.RPCChat.Asset | undefined
      let transferState: 'remoteUploading' | undefined

      if (m.messageBody.messageType === T.RPCChat.MessageType.attachment) {
        attachment = m.messageBody.attachment
        preview = attachment.previews?.[0]
        full = attachment.object
        if (!attachment.uploaded) {
          transferState = 'remoteUploading' as const
        }
      } else {
        attachment = m.messageBody.attachmentuploaded
        preview = attachment.previews?.[0]
        full = attachment.object
        transferState = undefined
      }

      const a = attachment
      const {filename, title, size} = a.object

      const pre = previewSpecs(preview?.metadata, full.metadata)

      let fullHeight = 0
      let fullWidth = 0
      if (full.metadata.assetType === T.RPCChat.AssetMetadataType.image) {
        fullHeight = full.metadata.image.height
        fullWidth = full.metadata.image.width
      }

      let previewURL = ''
      let fileURL = ''
      let fileType = ''
      let fileURLCached = false
      let videoDuration: string | undefined
      let inlineVideoPlayable = false
      if (m.assetUrlInfo) {
        previewURL = m.assetUrlInfo.previewUrl
        fileURL = m.assetUrlInfo.fullUrl
        fileType = m.assetUrlInfo.mimeType
        fileURLCached = m.assetUrlInfo.fullUrlCached
        videoDuration = m.assetUrlInfo.videoDuration ?? undefined
        inlineVideoPlayable = m.assetUrlInfo.inlineVideoPlayable
      }

      return makeMessageAttachment({
        ...common,
        ...explodable,
        attachmentType: pre.attachmentType,
        audioAmps: pre.audioAmps,
        audioDuration: pre.audioDuration,
        decoratedText: m.decoratedTextBody ? new HiddenString(m.decoratedTextBody) : undefined,
        fileName: filename,
        fileSize: size,
        fileType,
        fileURL,
        fileURLCached,
        fullHeight,
        fullWidth,
        hasBeenEdited: m.superseded,
        inlineVideoPlayable,
        isCollapsed: m.isCollapsed,
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
    case T.RPCChat.MessageType.join:
      return makeMessageSystemJoined({
        ...common,
        joiners: m.messageBody.join.joiners || [],
        leavers: m.messageBody.join.leavers || [],
      })
    case T.RPCChat.MessageType.leave:
      return makeMessageSystemLeft({
        ...common,
      })
    case T.RPCChat.MessageType.system:
      return uiMessageToSystemMessage(common, m.messageBody.system, common.reactions, m)
    case T.RPCChat.MessageType.headline:
      return makeMessageSetDescription({
        ...common,
        newDescription: new HiddenString(m.messageBody.headline.headline),
        reactions,
      })
    case T.RPCChat.MessageType.pin:
      return makeMessagePin({
        ...common,
        pinnedMessageID: T.Chat.numberToMessageID(m.pinnedMessageID || m.messageID),
        reactions,
      })
    case T.RPCChat.MessageType.metadata:
      return makeMessageSetChannelname({
        ...common,
        newChannelname: m.messageBody.metadata.conversationTitle,
        reactions,
      })
    case T.RPCChat.MessageType.sendpayment:
      return makeMessageSendPayment({
        ...common,
        paymentInfo: uiPaymentInfoToChatPaymentInfo(m.paymentInfos ?? undefined),
      })
    case T.RPCChat.MessageType.requestpayment:
      return makeMessageRequestPayment({
        ...common,
        note: m.decoratedTextBody ? new HiddenString(m.decoratedTextBody) : noString,
        requestID: m.messageBody.requestpayment.requestID,
        requestInfo: uiRequestInfoToChatRequestInfo(m.requestInfo ?? undefined),
      })
    case T.RPCChat.MessageType.edit: // fallthrough
    case T.RPCChat.MessageType.delete: // fallthrough
    case T.RPCChat.MessageType.deletehistory: // fallthrough
      // make deleted so we can cleanup placeholders
      return makeMessageDeleted({...common})
    default:
      return
  }
}

export const rpcErrorToString = (error: T.RPCChat.OutboxStateError) => {
  switch (error.typ) {
    case T.RPCChat.OutboxErrorType.misc:
      return error.message || 'unknown error'
    case T.RPCChat.OutboxErrorType.offline:
      return 'disconnected from chat server'
    case T.RPCChat.OutboxErrorType.identify:
      return 'proofs failed for recipient user'
    case T.RPCChat.OutboxErrorType.toolong:
      return 'message is too long'
    case T.RPCChat.OutboxErrorType.duplicate:
      return 'message already sent'
    case T.RPCChat.OutboxErrorType.expired:
      return 'took too long to send'
    case T.RPCChat.OutboxErrorType.restrictedbot:
      return 'bot is restricted from sending to this conversation'
    case T.RPCChat.OutboxErrorType.minwriter:
      return 'not high enough team role to post in this conversation'
    default:
      return `${error.message || ''} (code: ${error.typ})`
  }
}

const outboxUIMessagetoMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  o: T.RPCChat.UIMessageOutbox,
  currentUsername: string,
  getLastOrdinal: () => T.Chat.Ordinal,
  currentDeviceName: string
): MessageTypes.Message | undefined => {
  const errorReason =
    o.state.state === T.RPCChat.OutboxStateType.error ? rpcErrorToString(o.state.error) : undefined
  const errorTyp = o.state.state === T.RPCChat.OutboxStateType.error ? o.state.error.typ : undefined

  switch (o.messageType) {
    case T.RPCChat.MessageType.attachment: {
      const title = o.title
      const fileName = o.filename
      let previewURL = ''
      let pre: T.Chat.PreviewSpec
      if (o.preview) {
        previewURL =
          o.preview.location && o.preview.location.ltyp === T.RPCChat.PreviewLocationTyp.url
            ? o.preview.location.url
            : ''
        const md = o.preview.metadata ?? undefined
        const baseMd = o.preview.baseMetadata ?? undefined
        pre = previewSpecs(md, baseMd)
      } else {
        pre = previewSpecs()
      }
      return makePendingAttachmentMessage(
        conversationIDKey,
        currentUsername,
        getLastOrdinal,
        title,
        T.FS.getLocalPathName(fileName),
        previewURL,
        pre,
        T.Chat.stringToOutboxID(o.outboxID),
        T.Chat.numberToOrdinal(o.ordinal),
        errorReason,
        errorTyp,
        o.isEphemeral
      )
    }
    case T.RPCChat.MessageType.flip: // fallthrough
    case T.RPCChat.MessageType.text:
      return makeMessageText({
        author: currentUsername,
        conversationIDKey,
        decoratedText: o.decoratedTextBody ? new HiddenString(o.decoratedTextBody) : undefined,
        deviceName: currentDeviceName,
        deviceType: C.isMobile ? 'mobile' : 'desktop',
        errorReason,
        errorTyp,
        exploding: o.isEphemeral,
        flipGameID: o.flipGameID ?? undefined,
        ordinal: T.Chat.numberToOrdinal(o.ordinal),
        outboxID: T.Chat.stringToOutboxID(o.outboxID),
        submitState: 'pending',
        text: new HiddenString(o.body),
        timestamp: o.ctime,
      })
    default:
  }
  return
}

const placeholderUIMessageToMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  p: T.RPCChat.MessageUnboxedPlaceholder
) => {
  return !p.hidden
    ? makeMessagePlaceholder({
        conversationIDKey,
        id: T.Chat.numberToMessageID(p.messageID),
        ordinal: T.Chat.numberToOrdinal(p.messageID),
      })
    : makeMessageDeleted({
        conversationIDKey,
        id: T.Chat.numberToMessageID(p.messageID),
        ordinal: T.Chat.numberToOrdinal(p.messageID),
      })
}

const errorUIMessagetoMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  o: T.RPCChat.MessageUnboxedError
) => {
  return makeMessageText({
    author: o.senderUsername,
    botUsername: o.botUsername || undefined,
    conversationIDKey,
    deviceName: o.senderDeviceName,
    deviceType: T.Devices.stringToDeviceType(o.senderDeviceType),
    errorReason: o.errMsg,
    exploded: o.isEphemeral && (o.etime < Date.now() || !!o.explodedBy),
    explodedBy: o.explodedBy || '',
    exploding: o.isEphemeral,
    explodingUnreadable: !!o.errType && o.isEphemeral,
    id: T.Chat.numberToMessageID(o.messageID),
    ordinal: T.Chat.numberToOrdinal(o.messageID),
    timestamp: o.ctime,
  })
}

const journeycardUIMessageToMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  m: T.RPCChat.UIMessageJourneycard
) => {
  // only support these now
  if (
    m.cardType === T.RPCChat.JourneycardType.welcome ||
    m.cardType === T.RPCChat.JourneycardType.popularChannels
  ) {
    return makeMessageJourneycard({
      cardType: m.cardType,
      conversationIDKey,
      highlightMsgID: T.Chat.numberToMessageID(m.highlightMsgID),
      openTeam: m.openTeam,
      ordinal: T.Chat.numberToOrdinal(m.ordinal),
    })
  }

  return
}

export const uiMessageToMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  uiMessage: T.RPCChat.UIMessage,
  currentUsername: string,
  getLastOrdinal: () => T.Chat.Ordinal,
  currentDeviceName: string
): T.Chat.Message | undefined => {
  switch (uiMessage.state) {
    case T.RPCChat.MessageUnboxedState.valid:
      return validUIMessagetoMessage(
        conversationIDKey,
        uiMessage.valid,
        currentUsername,
        getLastOrdinal,
        currentDeviceName
      )
    case T.RPCChat.MessageUnboxedState.error:
      return errorUIMessagetoMessage(conversationIDKey, uiMessage.error)
    case T.RPCChat.MessageUnboxedState.outbox:
      return outboxUIMessagetoMessage(
        conversationIDKey,
        uiMessage.outbox,
        currentUsername,
        getLastOrdinal,
        currentDeviceName
      )
    case T.RPCChat.MessageUnboxedState.placeholder:
      return placeholderUIMessageToMessage(conversationIDKey, uiMessage.placeholder)
    case T.RPCChat.MessageUnboxedState.journeycard:
      return journeycardUIMessageToMessage(conversationIDKey, uiMessage.journeycard)
    default: // A type error here means there is an unhandled message state
      C.assertNever(uiMessage)
      return
  }
}

export function nextFractionalOrdinal(ord: T.Chat.Ordinal) {
  // Mimic what the service does with outbox items
  return T.Chat.numberToOrdinal(T.Chat.ordinalToNumber(ord) + 0.001)
}

export const makePendingTextMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  currentUsername: string,
  getLastOrdinal: () => T.Chat.Ordinal,
  text: HiddenString,
  outboxID: T.Chat.OutboxID,
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
    deviceType: C.isMobile ? 'mobile' : 'desktop',
    id: T.Chat.numberToMessageID(0),
    ordinal,
    outboxID,
    submitState: 'pending',
    text,
    timestamp: Date.now(),
  })
}

export const makePendingAttachmentMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  currentUsername: string,
  getLastOrdinal: () => T.Chat.Ordinal,
  title: string,
  fileName: string,
  previewURL: string,
  previewSpec: T.Chat.PreviewSpec,
  outboxID: T.Chat.OutboxID,
  inOrdinal: T.Chat.Ordinal | null,
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
    deviceType: C.isMobile ? 'mobile' : 'desktop',
    errorReason,
    errorTyp,
    exploding,
    fileName,
    id: T.Chat.numberToMessageID(0),
    inlineVideoPlayable: previewSpec.showPlayButton,
    isCollapsed: false,
    ordinal,
    outboxID,
    previewHeight: previewSpec.height,
    previewURL,
    previewWidth: previewSpec.width,
    showPlayButton: previewSpec.showPlayButton,
    submitState: 'pending',
    timestamp: Date.now(),
    title,
  })
}

const imageFileNameRegex = /[^/]+\.(jpg|png|gif|jpeg|bmp)$/i
const videoFileNameRegex = /[^/]+\.(mp4|mov|avi|mkv)$/i
export const pathToAttachmentType = (path: string) => {
  if (imageFileNameRegex.test(path)) {
    return 'image'
  }
  if (videoFileNameRegex.test(path)) {
    return 'video'
  }
  return 'file'
}
export const isSpecialMention = (s: string) => ['here', 'channel', 'everyone'].includes(s)

export const specialMentions = ['here', 'channel', 'everyone']

export const upgradeMessage = (
  old: T.Immutable<T.Chat.Message>,
  m: T.Immutable<T.Chat.Message>
): T.Immutable<T.Chat.Message> => {
  const validUpgrade = (
    old: T.Immutable<T.Chat.MessageText | T.Chat.MessageAttachment>,
    m: T.Immutable<T.Chat.MessageText | T.Chat.MessageAttachment>
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
      transferState: old.transferState === 'remoteUploading' ? undefined : old.transferState,
    }
  }

  // we never want to convert a non placeholder into a placeholder
  if (m.type === 'placeholder' && old.type !== 'placeholder') {
    return old
  }

  return m
}

export const shouldShowPopup = (
  accountsInfoMap?: ConvoConstants.ConvoState['accountsInfoMap'],
  message?: T.Chat.Message
) => {
  switch (message?.type) {
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
      const paymentInfo = accountsInfoMap && getPaymentMessageInfo(accountsInfoMap, message)
      if (!paymentInfo || ['claimable', 'pending', 'canceled'].includes(paymentInfo.status)) {
        return false
      }
      return true
    }
    default:
      return false
  }
}

export const messageExplodeDescriptions: T.Chat.MessageExplodeDescription[] = [
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
  transferState: T.Chat.MessageAttachmentTransferState
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

export const messageAttachmentHasProgress = (message: T.Chat.MessageAttachment) => {
  return (
    !!message.transferState &&
    message.transferState !== 'remoteUploading' &&
    message.transferState !== 'mobileSaving'
  )
}
