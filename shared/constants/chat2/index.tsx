import * as Chat2Gen from '../../actions/chat2-gen'
import * as EngineGen from '../../actions/engine-gen-gen'
import * as ConfigConstants from '../config'
import * as Message from './message'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as Router2 from '../router2'
import * as TeamConstants from '../teams'
import * as Types from '../types/chat2'
import logger from '../../logger'
import type * as TeamsTypes from '../types/teams'
import type * as Wallet from '../types/wallets'
import {RPCError} from '../../util/errors'
import {inboxUIItemToConversationMeta} from './meta'
import {isMobile, isTablet, isPhone} from '../platform'
import {
  noConversationIDKey,
  pendingWaitingConversationIDKey,
  pendingErrorConversationIDKey,
  conversationIDKeyToString,
  isValidConversationIDKey,
} from '../types/chat2/common'
import HiddenString from '../../util/hidden-string'
import {getEffectiveRetentionPolicy, getMeta} from './meta'
import type * as TeamBuildingTypes from '../types/team-building'
import type {TypedState} from '../reducer'
import * as Z from '../../util/zustand'
import {getConvoState, stores} from './convostate'

export const getMessageRenderType = (m: Types.Message): Types.RenderMessageType => {
  switch (m.type) {
    case 'attachment':
      if (m.inlineVideoPlayable && m.attachmentType !== 'audio') {
        return 'attachment:video'
      }
      return `attachment:${m.attachmentType}`
    default:
      return m.type
  }
}

export const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')

export const defaultTopReacjis = [
  {name: ':+1:'},
  {name: ':-1:'},
  {name: ':tada:'},
  {name: ':joy:'},
  {name: ':sunglasses:'},
]
const defaultSkinTone = 1
export const defaultUserReacjis = {skinTone: defaultSkinTone, topReacjis: defaultTopReacjis}
const emptyArray: Array<unknown> = []
export const isSplit = !isMobile || isTablet // Whether the inbox and conversation panels are visible side-by-side.

// while we're debugging chat issues
export const DEBUG_CHAT_DUMP = true

// in split mode the root is the 'inbox'
export const threadRouteName = isSplit ? 'chatRoot' : 'chatConversation'

export const blockButtonsGregorPrefix = 'blockButtons.'

export const makeState = (): Types.State => ({
  attachmentViewMap: new Map(),
  botCommandsUpdateStatusMap: new Map(),
  botSettings: new Map(),
  botTeamRoleInConvMap: new Map(),
  commandMarkdownMap: new Map(),
  commandStatusMap: new Map(),
  containsLatestMessageMap: new Map(),
  editingMap: new Map(),
  explodingModeLocks: new Map(), // locks set on exploding mode while user is inputting text,
  explodingModes: new Map(), // seconds to exploding message expiration,
  markedAsUnreadMap: new Map(), // store a bit if we've marked this thread as unread so we don't mark as read when navgiating away
  messageCenterOrdinals: new Map(), // ordinals to center threads on,
  messageMap: new Map(), // messages in a thread,
  messageOrdinals: new Map(), // ordered ordinals in a thread,
  messageTypeMap: new Map(),
  metaMap: new Map(), // metadata about a thread, There is a special node for the pending conversation,
  moreToLoadMap: new Map(), // if we have more data to load,
  orangeLineMap: new Map(), // last message we've seen,
  participantMap: new Map(),
  pendingOutboxToOrdinal: new Map(), // messages waiting to be sent,
  replyToMap: new Map(),
  threadLoadStatus: new Map(),
  threadSearchInfoMap: new Map(),
  threadSearchQueryMap: new Map(),
})

export const makeThreadSearchInfo = (): Types.ThreadSearchInfo => ({
  hits: emptyArray as Types.ThreadSearchInfo['hits'],
  status: 'initial',
  visible: false,
})

export const inboxSearchMaxTextMessages = 25
export const inboxSearchMaxTextResults = 50
export const inboxSearchMaxNameResults = 7
export const inboxSearchMaxUnreadNameResults = isMobile ? 5 : 10

export const makeInboxSearchInfo = (): Types.InboxSearchInfo => ({
  botsResults: [],
  botsResultsSuggested: false,
  botsStatus: 'initial',
  indexPercent: 0,
  nameResults: [],
  nameResultsUnread: false,
  nameStatus: 'initial',
  openTeamsResults: [],
  openTeamsResultsSuggested: false,
  openTeamsStatus: 'initial',
  query: '',
  selectedIndex: 0,
  textResults: [],
  textStatus: 'initial',
})

export const makeAttachmentViewInfo = (): Types.AttachmentViewInfo => ({
  last: false,
  messages: [],
  status: 'loading',
})

export const getInboxSearchSelected = (inboxSearch: Types.InboxSearchInfo) => {
  const {selectedIndex, nameResults, botsResults, openTeamsResults, textResults} = inboxSearch
  const firstTextResultIdx = botsResults.length + openTeamsResults.length + nameResults.length
  const firstOpenTeamResultIdx = nameResults.length

  if (selectedIndex < firstOpenTeamResultIdx) {
    const maybeNameResults = nameResults[selectedIndex]
    const conversationIDKey =
      maybeNameResults === null || maybeNameResults === undefined
        ? undefined
        : maybeNameResults.conversationIDKey
    if (conversationIDKey) {
      return {
        conversationIDKey,
        query: undefined,
      }
    }
  } else if (selectedIndex < firstTextResultIdx) {
    return null
  } else if (selectedIndex >= firstTextResultIdx) {
    const result = textResults[selectedIndex - firstTextResultIdx]
    if (result) {
      return {
        conversationIDKey: result.conversationIDKey,
        query: result.query,
      }
    }
  }

  return null
}

export const getThreadSearchInfo = (state: TypedState, conversationIDKey: Types.ConversationIDKey) =>
  state.chat2.threadSearchInfoMap.get(conversationIDKey)

const emptyOrdinals = new Array<Types.Ordinal>()
export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id) ?? emptyOrdinals
export const getMessageCenterOrdinal = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageCenterOrdinals.get(id)
export const getMessage = (state: TypedState, id: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
  state.chat2.messageMap.get(id)?.get(ordinal)

export const isTextOrAttachment = (
  message: Types.Message
): message is Types.Message | Types.MessageAttachment => {
  return message.type === 'text' || message.type === 'attachment'
}

export const isMessageWithReactions = (message: Types.Message): message is Types.MessagesWithReactions => {
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
export const getMessageKey = (message: Types.Message) =>
  `${message.conversationIDKey}:${Types.ordinalToNumber(message.ordinal)}`
export const getSelectedConversation = (): Types.ConversationIDKey => {
  const maybeVisibleScreen = Router2.getVisibleScreen()
  if (maybeVisibleScreen?.name === threadRouteName) {
    // @ts-ignore TODO better types
    return maybeVisibleScreen.params?.conversationIDKey ?? noConversationIDKey
  }
  return noConversationIDKey
}

export const getReplyToOrdinal = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  return state.chat2.replyToMap.get(conversationIDKey)
}
export const getReplyToMessageID = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  const ordinal = getReplyToOrdinal(state, conversationIDKey)
  if (!ordinal) return
  const maybeMessage = getMessage(state, conversationIDKey, ordinal)
  return ordinal
    ? maybeMessage === null || maybeMessage === undefined
      ? undefined
      : maybeMessage.id
    : undefined
}

export const getEditInfo = (state: TypedState, id: Types.ConversationIDKey) => {
  const ordinal = state.chat2.editingMap.get(id)
  if (!ordinal) {
    return
  }

  const message = getMessage(state, id, ordinal)
  if (!message) {
    return
  }
  switch (message.type) {
    case 'text':
      return {exploded: message.exploded, ordinal, text: message.text.stringValue()}
    case 'attachment':
      return {exploded: message.exploded, ordinal, text: message.title}
    default:
      return
  }
}

export const generateOutboxID = () => Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))
export const isUserActivelyLookingAtThisThread = (conversationIDKey: Types.ConversationIDKey) => {
  const selectedConversationIDKey = getSelectedConversation()

  let chatThreadSelected = false
  if (!isSplit) {
    chatThreadSelected = true // conversationIDKey === selectedConversationIDKey is the only thing that matters in the new router
  } else {
    const maybeVisibleScreen = Router2.getVisibleScreen()
    chatThreadSelected =
      (maybeVisibleScreen === null || maybeVisibleScreen === undefined
        ? undefined
        : maybeVisibleScreen.name) === threadRouteName
  }

  const {appFocused} = ConfigConstants.useConfigState.getState()
  const {active: userActive} = ConfigConstants.useActiveState.getState()

  return (
    appFocused && // app focused?
    userActive && // actually interacting w/ the app
    chatThreadSelected && // looking at the chat tab?
    conversationIDKey === selectedConversationIDKey // looking at the selected thread?
  )
}
export const isTeamConversationSelected = (state: TypedState, teamname: string) => {
  const meta = getMeta(state, getSelectedConversation())
  return meta.teamname === teamname
}

export const getBotsAndParticipants = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey,
  sort?: boolean
) => {
  const meta = getMeta(state, conversationIDKey)
  const isAdhocTeam = meta.teamType === 'adhoc'
  const participantInfo = getParticipantInfo(state, conversationIDKey)
  const teamMembers = TeamConstants.useState.getState().teamIDToMembers.get(meta.teamID) ?? new Map()
  let bots: Array<string> = []
  if (isAdhocTeam) {
    bots = participantInfo.all.filter(p => !participantInfo.name.includes(p))
  } else {
    bots = [...teamMembers.values()]
      .filter(
        p =>
          TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p.username, 'restrictedbot') ||
          TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p.username, 'bot')
      )
      .map(p => p.username)
      .sort((l, r) => l.localeCompare(r))
  }
  let participants: Array<string> = participantInfo.all
  if (teamMembers && meta.channelname === 'general') {
    participants = [...teamMembers.values()].reduce<Array<string>>((l, mi) => {
      l.push(mi.username)
      return l
    }, [])
  }
  participants = participants.filter(p => !bots.includes(p))
  participants = sort
    ? participants
        .map(p => ({
          isAdmin: !isAdhocTeam ? TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p, 'admin') : false,
          isOwner: !isAdhocTeam ? TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p, 'owner') : false,
          username: p,
        }))
        .sort((l, r) => {
          const leftIsAdmin = l.isAdmin || l.isOwner
          const rightIsAdmin = r.isAdmin || r.isOwner
          if (leftIsAdmin && !rightIsAdmin) {
            return -1
          } else if (!leftIsAdmin && rightIsAdmin) {
            return 1
          }
          return l.username.localeCompare(r.username)
        })
        .map(p => p.username)
    : participants
  return {bots, participants}
}

export const waitingKeyJoinConversation = 'chat:joinConversation'
export const waitingKeyLeaveConversation = 'chat:leaveConversation'
export const waitingKeyDeleteHistory = 'chat:deleteHistory'
export const waitingKeyPost = 'chat:post'
export const waitingKeyRetryPost = 'chat:retryPost'
export const waitingKeyEditPost = 'chat:editPost'
export const waitingKeyDeletePost = 'chat:deletePost'
export const waitingKeyCancelPost = 'chat:cancelPost'
export const waitingKeyInboxRefresh = 'chat:inboxRefresh'
export const waitingKeyCreating = 'chat:creatingConvo'
export const waitingKeyInboxSyncStarted = 'chat:inboxSyncStarted'
export const waitingKeyBotAdd = 'chat:botAdd'
export const waitingKeyBotRemove = 'chat:botRemove'
export const waitingKeyLoadingEmoji = 'chat:loadingEmoji'
export const waitingKeyPushLoad = (conversationIDKey: Types.ConversationIDKey) =>
  `chat:pushLoad:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyThreadLoad = (conversationIDKey: Types.ConversationIDKey) =>
  `chat:loadingThread:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyAddUsersToChannel = 'chat:addUsersToConversation'
export const waitingKeyAddUserToChannel = (username: string, conversationIDKey: Types.ConversationIDKey) =>
  `chat:addUserToConversation:${username}:${conversationIDKey}`
export const waitingKeyConvStatusChange = (conversationIDKey: Types.ConversationIDKey) =>
  `chat:convStatusChange:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyUnpin = (conversationIDKey: Types.ConversationIDKey) =>
  `chat:unpin:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyMutualTeams = (conversationIDKey: Types.ConversationIDKey) =>
  `chat:mutualTeams:${conversationIDKeyToString(conversationIDKey)}`

/**
 * Gregor key for exploding conversations
 * Used as the `category` when setting the exploding mode on a conversation
 * `body` is the number of seconds to exploding message etime
 * Note: The core service also uses this value, so if it changes, please notify core
 */
export const explodingModeGregorKeyPrefix = 'exploding:'
export const explodingModeGregorKey = (c: Types.ConversationIDKey): string =>
  `${explodingModeGregorKeyPrefix}${c}`
export const getConversationExplodingMode = (state: TypedState, c: Types.ConversationIDKey): number => {
  let mode = state.chat2.explodingModeLocks.get(c)
  if (mode === undefined) {
    mode = state.chat2.explodingModes.get(c) ?? 0
  }
  const meta = getMeta(state, c)
  const convRetention = getEffectiveRetentionPolicy(meta)
  mode = convRetention.type === 'explode' ? Math.min(mode || Infinity, convRetention.seconds) : mode
  return mode || 0
}
export const isExplodingModeLocked = (state: TypedState, c: Types.ConversationIDKey) =>
  state.chat2.explodingModeLocks.get(c) !== undefined

export const getTeamMentionName = (name: string, channel: string) => {
  return name + (channel ? `#${channel}` : '')
}

// When user clicks wallets icon in chat input, set seenWalletsGregorKey with
// body of 'true'
export const seenWalletsGregorKey = 'chat.seenWallets'

export const makeInboxQuery = (
  convIDKeys: Array<Types.ConversationIDKey>,
  allStatuses?: boolean
): RPCChatTypes.GetInboxLocalQuery => {
  return {
    computeActiveList: true,
    convIDs: convIDKeys.map(Types.keyToConversationID),
    memberStatus: Object.keys(RPCChatTypes.ConversationMemberStatus)
      .filter(
        k =>
          typeof RPCChatTypes.ConversationMemberStatus[k as any] === 'number' &&
          (!!allStatuses || !['neverJoined', 'left', 'removed'].includes(k as any))
      )
      .map(
        k => RPCChatTypes.ConversationMemberStatus[k as any]
      ) as unknown as Array<RPCChatTypes.ConversationMemberStatus>,
    readOnly: false,
    status: Object.keys(RPCChatTypes.ConversationStatus)
      .filter(k => typeof RPCChatTypes.ConversationStatus[k as any] === 'number')
      .filter(k => !['ignored', 'blocked', 'reported'].includes(k as any))
      .map(
        k => RPCChatTypes.ConversationStatus[k as any]
      ) as unknown as Array<RPCChatTypes.ConversationStatus>,
    tlfVisibility: RPCTypes.TLFVisibility.private,
    topicType: RPCChatTypes.TopicType.chat,
    unreadOnly: false,
  }
}

export const isAssertion = (username: string) => username.includes('@')

const numMessagesOnInitialLoad = isMobile ? 20 : 100
const numMessagesOnScrollback = isMobile ? 100 : 100

export const clampImageSize = (width: number, height: number, maxWidth: number, maxHeight: number) => {
  const aspectRatio = width / height

  let newWidth = width
  let newHeight = height

  if (newWidth > maxWidth) {
    newWidth = maxWidth
    newHeight = newWidth / aspectRatio
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight
    newWidth = newHeight * aspectRatio
  }

  return {
    height: Math.ceil(newHeight),
    width: Math.ceil(newWidth),
  }
}

export const zoomImage = (width: number, height: number, maxThumbSize: number) => {
  const dims =
    height > width
      ? {height: (maxThumbSize * height) / width, width: maxThumbSize}
      : {height: maxThumbSize, width: (maxThumbSize * width) / height}
  const marginHeight = dims.height > maxThumbSize ? (dims.height - maxThumbSize) / 2 : 0
  const marginWidth = dims.width > maxThumbSize ? (dims.width - maxThumbSize) / 2 : 0
  return {
    dims,
    margins: {
      marginBottom: -marginHeight,
      marginLeft: -marginWidth,
      marginRight: -marginWidth,
      marginTop: -marginHeight,
    },
  }
}

export const noParticipantInfo: Types.ParticipantInfo = {
  all: [],
  contactName: new Map(),
  name: [],
}

export const getParticipantInfo = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey
): Types.ParticipantInfo => {
  const participantInfo = state.chat2.participantMap.get(conversationIDKey)
  return participantInfo ? participantInfo : noParticipantInfo
}

export const messageAuthorIsBot = (
  state: TeamConstants.State,
  meta: Types.ConversationMeta,
  message: Types.Message,
  participantInfo: Types.ParticipantInfo
) => {
  const teamID = meta.teamID
  return meta.teamname
    ? TeamConstants.userIsRoleInTeam(state, teamID, message.author, 'restrictedbot') ||
        TeamConstants.userIsRoleInTeam(state, teamID, message.author, 'bot')
    : meta.teamType === 'adhoc' && participantInfo.name.length > 0 // teams without info may have type adhoc with an empty participant name list
    ? !participantInfo.name.includes(message.author) // if adhoc, check if author in participants
    : false // if we don't have team information, don't show bot icon
}

export const getBotRestrictBlockMap = (
  settings: Map<string, RPCChatTypes.Keybase1.TeamBotSettings>,
  conversationIDKey: Types.ConversationIDKey,
  bots: Array<string>
) => {
  const blocks = new Map<string, boolean>()
  bots.forEach(b => {
    const botSettings = settings.get(b)
    if (!botSettings) {
      blocks.set(b, false)
      return
    }
    const convs = botSettings.convs
    const cmds = botSettings.cmds
    blocks.set(b, !cmds || (!((convs?.length ?? 0) === 0) && !convs?.find(c => c === conversationIDKey)))
  })
  return blocks
}

export const uiParticipantsToParticipantInfo = (uiParticipants: Array<RPCChatTypes.UIParticipant>) => {
  const participantInfo: Types.ParticipantInfo = {all: [], contactName: new Map(), name: []}
  uiParticipants.forEach(part => {
    const {assertion, contactName, inConvName} = part
    participantInfo.all.push(assertion)
    if (inConvName) {
      participantInfo.name.push(assertion)
    }
    if (contactName) {
      participantInfo.contactName.set(assertion, contactName)
    }
  })
  return participantInfo
}

export {
  getBotCommands,
  getConversationIDKeyMetasToLoad,
  getConversationLabel,
  getEffectiveRetentionPolicy,
  getMeta,
  getRowParticipants,
  getRowStyles,
  getTeams,
  inboxUIItemToConversationMeta,
  makeConversationMeta,
  timestampToString,
  unverifiedInboxUIItemToConversationMeta,
  updateMeta,
  updateMetaWithNotificationSettings,
} from './meta'

export {
  getClientPrev,
  getMapUnfurl,
  getMessageID,
  getMessageStateExtras,
  getPaymentMessageInfo,
  isPendingPaymentMessage,
  isSpecialMention,
  isVideoAttachment,
  journeyCardTypeToType,
  makeChatRequestInfo,
  makeMessageAttachment,
  makeMessageDeleted,
  makeMessageText,
  makePendingAttachmentMessage,
  makePendingTextMessage,
  makeReaction,
  mergeMessage,
  messageAttachmentHasProgress,
  messageAttachmentTransferStateToProgressLabel,
  messageExplodeDescriptions,
  nextFractionalOrdinal,
  pathToAttachmentType,
  previewSpecs,
  reactionMapToReactions,
  rpcErrorToString,
  shouldShowPopup,
  specialMentions,
  uiMessageEditToMessage,
  uiMessageToMessage,
  uiPaymentInfoToChatPaymentInfo,
  uiRequestInfoToChatRequestInfo,
  upgradeMessage,
} from './message'

export {
  isValidConversationIDKey,
  noConversationIDKey,
  numMessagesOnInitialLoad,
  numMessagesOnScrollback,
  pendingErrorConversationIDKey,
  pendingWaitingConversationIDKey,
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

/**
 * Returns true if the team is big and you're a member
 */
export const isBigTeam = (state: State, teamID: string): boolean => {
  const bigTeams = state.inboxLayout?.bigTeams
  return (bigTeams || []).some(
    v => v.state === RPCChatTypes.UIInboxBigTeamRowTyp.label && v.label.id === teamID
  )
}

type Store = {
  // increments when the convo stores values change, badges and unread
  badgeCountsChanged: number
  botPublicCommands: Map<string, Types.BotPublicCommands>
  createConversationError?: Types.CreateConversationError
  smallTeamBadgeCount: number
  bigTeamBadgeCount: number
  smallTeamsExpanded: boolean // if we're showing all small teams,
  lastCoord?: Types.Coordinate
  paymentStatusMap: Map<Wallet.PaymentID, Types.ChatPaymentInfo>
  staticConfig?: Types.StaticConfig // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded,
  trustedInboxHasLoaded: boolean // if we've done initial trusted inbox load,
  userReacjis: Types.UserReacjis
  userEmojis?: RPCChatTypes.EmojiGroup[]
  userEmojisForAutocomplete?: Array<RPCChatTypes.Emoji>
  infoPanelShowing: boolean
  infoPanelSelectedTab?: 'settings' | 'members' | 'attachments' | 'bots'
  inboxNumSmallRows?: number
  inboxHasLoaded: boolean // if we've ever loaded,
  inboxLayout?: RPCChatTypes.UIInboxLayout // layout of the inbox
  inboxSearch?: Types.InboxSearchInfo
  teamIDToGeneralConvID: Map<TeamsTypes.TeamID, Types.ConversationIDKey>
  flipStatusMap: Map<string, RPCChatTypes.UICoinFlipStatus>
  maybeMentionMap: Map<string, RPCChatTypes.UIMaybeMentionInfo>
  blockButtonsMap: Map<RPCTypes.TeamID, Types.BlockButtonsInfo> // Should we show block buttons for this team ID?
}

const initialStore: Store = {
  badgeCountsChanged: 0,
  bigTeamBadgeCount: 0,
  blockButtonsMap: new Map(),
  botPublicCommands: new Map(),
  createConversationError: undefined,
  flipStatusMap: new Map(),
  inboxHasLoaded: false,
  inboxLayout: undefined,
  inboxNumSmallRows: 5,
  inboxSearch: undefined,
  infoPanelSelectedTab: undefined,
  infoPanelShowing: false,
  lastCoord: undefined,
  maybeMentionMap: new Map(),
  paymentStatusMap: new Map(),
  smallTeamBadgeCount: 0,
  smallTeamsExpanded: false,
  staticConfig: undefined,
  teamIDToGeneralConvID: new Map(),
  trustedInboxHasLoaded: false,
  userEmojis: undefined,
  userEmojisForAutocomplete: undefined,
  userReacjis: defaultUserReacjis,
}

export type State = Store & {
  dispatch: {
    badgesUpdated: (bigTeamBadgeCount: number, smallTeamBadgeCount: number) => void
    conversationErrored: (
      allowedUsers: Array<string>,
      disallowedUsers: Array<string>,
      code: number,
      message: string
    ) => void
    findGeneralConvIDFromTeamID: (teamID: TeamsTypes.TeamID) => void
    loadStaticConfig: () => void
    loadedUserEmoji: (results: RPCChatTypes.UserEmojiRes) => void
    onEngineConnected: () => void
    onEngineIncoming: (action: EngineGen.Chat1NotifyChatChatTypingUpdatePayload) => void
    onTeamBuildingFinished: (users: Set<TeamBuildingTypes.User>) => void
    paymentInfoReceived: (paymentInfo: Types.ChatPaymentInfo) => void
    refreshBotPublicCommands: (username: string) => void
    resetConversationErrored: () => void
    resetState: () => void
    setMaybeMentionInfo: (name: string, info: RPCChatTypes.UIMaybeMentionInfo) => void
    setTrustedInboxHasLoaded: () => void
    toggleInboxSearch: (enabled: boolean) => void
    toggleSmallTeamsExpanded: () => void
    updateCoinFlipStatus: (statuses: Array<RPCChatTypes.UICoinFlipStatus>) => void
    updateLastCoord: (coord: Types.Coordinate) => void
    updateUserReacjis: (userReacjis: RPCTypes.UserReacjis) => void
    updatedGregor: (items: ConfigConstants.Store['gregorPushState']) => void
    showInfoPanel: (
      show: boolean,
      tab?: 'settings' | 'members' | 'attachments' | 'bots',
      conversationIDKey?: Types.ConversationIDKey
    ) => void
    setInboxNumSmallRows: (rows: number, ignoreWrite?: boolean) => void
    inboxRefresh: (
      reason:
        | 'bootstrap'
        | 'componentNeverLoaded'
        | 'inboxStale'
        | 'inboxSyncedClear'
        | 'inboxSyncedUnknown'
        | 'joinedAConversation'
        | 'leftAConversation'
        | 'teamTypeChanged'
        | 'maybeKickedFromTeam'
        | 'widgetRefresh'
        | 'shareConfigSearch'
    ) => void

    inboxSearch: (query: string) => void
    inboxSearchMoveSelectedIndex: (increment: boolean) => void
    inboxSearchSelect: (
      conversationIDKey?: Types.ConversationIDKey,
      query?: string,
      selectedIndex?: number
    ) => void
    updateInboxLayout: (layout: string) => void
  }
  getBadgeMap: (badgeCountsChanged: number) => Map<string, number>
  getUnreadMap: (badgeCountsChanged: number) => Map<string, number>
}

// generic chat store
export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
  const getReduxStore = Z.getReduxStore()
  const dispatch: State['dispatch'] = {
    badgesUpdated: (bigTeamBadgeCount, smallTeamBadgeCount) => {
      set(s => {
        s.smallTeamBadgeCount = smallTeamBadgeCount
        s.bigTeamBadgeCount = bigTeamBadgeCount
        s.badgeCountsChanged++
      })
    },
    conversationErrored: (allowedUsers, disallowedUsers, code, message) => {
      set(s => {
        s.createConversationError = {
          allowedUsers,
          code,
          disallowedUsers,
          message,
        }
      })
    },
    findGeneralConvIDFromTeamID: teamID => {
      const f = async () => {
        try {
          const conv = await RPCChatTypes.localFindGeneralConvFromTeamIDRpcPromise({teamID})
          const meta = inboxUIItemToConversationMeta(undefined, conv)
          if (!meta) {
            logger.info(`findGeneralConvIDFromTeamID: failed to convert to meta`)
            return
          }
          reduxDispatch(Chat2Gen.createMetasReceived({metas: [meta]}))
          set(s => {
            s.teamIDToGeneralConvID.set(teamID, Types.stringToConversationIDKey(conv.convID))
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`findGeneralConvIDFromTeamID: failed to get general conv: ${error.message}`)
          }
        }
      }
      Z.ignorePromise(f())
    },
    inboxRefresh: reason => {
      const f = async () => {
        const {username} = ConfigConstants.useCurrentUserState.getState()
        const {loggedIn} = ConfigConstants.useConfigState.getState()
        if (!loggedIn || !username) {
          return
        }
        const clearExistingMetas = reason === 'inboxSyncedClear'
        const clearExistingMessages = reason === 'inboxSyncedClear'

        logger.info(`Inbox refresh due to ${reason}`)
        const reselectMode =
          get().inboxHasLoaded || isPhone
            ? RPCChatTypes.InboxLayoutReselectMode.default
            : RPCChatTypes.InboxLayoutReselectMode.force
        await RPCChatTypes.localRequestInboxLayoutRpcPromise({reselectMode})
        if (clearExistingMetas) {
          reduxDispatch(Chat2Gen.createClearMetas())
        }
        if (clearExistingMessages) {
          reduxDispatch(Chat2Gen.createClearMessages())
        }
      }
      Z.ignorePromise(f())
    },
    inboxSearch: query => {
      set(s => {
        const {inboxSearch} = s
        if (inboxSearch) {
          inboxSearch.query = query
        }
      })
      const f = async () => {
        const teamType = (t: RPCChatTypes.TeamType) => (t === RPCChatTypes.TeamType.complex ? 'big' : 'small')

        const onConvHits = (
          resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchConvHits']['inParam']
        ) => {
          const results = (resp.hits.hits || []).reduce<Array<Types.InboxSearchConvHit>>((arr, h) => {
            arr.push({
              conversationIDKey: Types.stringToConversationIDKey(h.convID),
              name: h.name,
              teamType: teamType(h.teamType),
            })
            return arr
          }, [])

          set(s => {
            const unread = resp.hits.unreadMatches
            const {inboxSearch} = s
            if (inboxSearch?.nameStatus === 'inprogress') {
              inboxSearch.nameResults = results
              inboxSearch.nameResultsUnread = unread
              inboxSearch.nameStatus = 'success'
            }
          })

          const missingMetas = results.reduce<Array<Types.ConversationIDKey>>((arr, r) => {
            if (!getReduxStore().chat2.metaMap.get(r.conversationIDKey)) {
              arr.push(r.conversationIDKey)
            }
            return arr
          }, [])
          if (missingMetas.length > 0) {
            reduxDispatch(
              Chat2Gen.createMetaRequestTrusted({
                conversationIDKeys: missingMetas,
                force: true,
                reason: 'inboxSearchResults',
              })
            )
          }
        }

        const onOpenTeamHits = (
          resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchTeamHits']['inParam']
        ) => {
          const results = (resp.hits.hits || []).reduce<Array<Types.InboxSearchOpenTeamHit>>((arr, h) => {
            const {description, name, memberCount, inTeam} = h
            arr.push({
              description: description ?? '',
              inTeam,
              memberCount,
              name,
              publicAdmins: [],
            })
            return arr
          }, [])
          const suggested = resp.hits.suggestedMatches
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch?.openTeamsStatus === 'inprogress') {
              inboxSearch.openTeamsResultsSuggested = suggested
              inboxSearch.openTeamsResults = results
              inboxSearch.openTeamsStatus = 'success'
            }
          })
        }

        const onBotsHits = (
          resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchBotHits']['inParam']
        ) => {
          const results = resp.hits.hits || []
          const suggested = resp.hits.suggestedMatches
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch?.botsStatus === 'inprogress') {
              inboxSearch.botsResultsSuggested = suggested
              inboxSearch.botsResults = results
              inboxSearch.botsStatus = 'success'
            }
          })
        }

        const onTextHit = (
          resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam']
        ) => {
          const {convID, convName, hits, query, teamType: tt, time} = resp.searchHit

          const result = {
            conversationIDKey: Types.conversationIDToKey(convID),
            name: convName,
            numHits: hits?.length ?? 0,
            query,
            teamType: teamType(tt),
            time,
          } as const
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch && inboxSearch.textStatus === 'inprogress') {
              const {conversationIDKey} = result
              const textResults = inboxSearch.textResults.filter(
                r => r.conversationIDKey !== conversationIDKey
              )
              textResults.push(result)
              inboxSearch.textResults = textResults.sort((l, r) => r.time - l.time)
            }
          })

          if (!getReduxStore().chat2.metaMap.get(result.conversationIDKey)) {
            reduxDispatch(
              Chat2Gen.createMetaRequestTrusted({
                conversationIDKeys: [result.conversationIDKey],
                force: true,
                reason: 'inboxSearchResults',
              })
            )
          }
        }
        const onStart = () => {
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch) {
              inboxSearch.nameStatus = 'inprogress'
              inboxSearch.selectedIndex = 0
              inboxSearch.textResults = []
              inboxSearch.textStatus = 'inprogress'
              inboxSearch.openTeamsStatus = 'inprogress'
              inboxSearch.botsStatus = 'inprogress'
            }
          })
        }
        const onDone = () => {
          set(s => {
            const status = 'success'
            const inboxSearch = s.inboxSearch ?? makeInboxSearchInfo()
            s.inboxSearch = inboxSearch
            inboxSearch.textStatus = status
          })
        }

        const onIndexStatus = (
          resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam']
        ) => {
          const percent = resp.status.percentIndexed
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch?.textStatus === 'inprogress') {
              inboxSearch.indexPercent = percent
            }
          })
        }

        try {
          await RPCChatTypes.localSearchInboxRpcListener(
            {
              incomingCallMap: {
                'chat.1.chatUi.chatSearchBotHits': onBotsHits,
                'chat.1.chatUi.chatSearchConvHits': onConvHits,
                'chat.1.chatUi.chatSearchInboxDone': onDone,
                'chat.1.chatUi.chatSearchInboxHit': onTextHit,
                'chat.1.chatUi.chatSearchInboxStart': onStart,
                'chat.1.chatUi.chatSearchIndexStatus': onIndexStatus,
                'chat.1.chatUi.chatSearchTeamHits': onOpenTeamHits,
              },
              params: {
                identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
                namesOnly: false,
                opts: {
                  afterContext: 0,
                  beforeContext: 0,
                  isRegex: false,
                  matchMentions: false,
                  maxBots: 10,
                  maxConvsHit: inboxSearchMaxTextResults,
                  maxConvsSearched: 0,
                  maxHits: inboxSearchMaxTextMessages,
                  maxMessages: -1,
                  maxNameConvs:
                    query.length > 0 ? inboxSearchMaxNameResults : inboxSearchMaxUnreadNameResults,
                  maxTeams: 10,
                  reindexMode: RPCChatTypes.ReIndexingMode.postsearchSync,
                  sentAfter: 0,
                  sentBefore: 0,
                  sentBy: '',
                  sentTo: '',
                  skipBotCache: false,
                },
                query,
              },
            },
            Z.dummyListenerApi
          )
        } catch (error) {
          if (error instanceof RPCError) {
            if (!(error.code === RPCTypes.StatusCode.sccanceled)) {
              logger.error('search failed: ' + error.message)
              set(s => {
                const status = 'error'
                const inboxSearch = s.inboxSearch ?? makeInboxSearchInfo()
                s.inboxSearch = inboxSearch
                inboxSearch.textStatus = status
              })
            }
          }
        }
      }
      Z.ignorePromise(f())
    },
    inboxSearchMoveSelectedIndex: increment => {
      set(s => {
        const {inboxSearch} = s
        if (inboxSearch) {
          const {selectedIndex} = inboxSearch
          const totalResults = inboxSearch.nameResults.length + inboxSearch.textResults.length
          if (increment && selectedIndex < totalResults - 1) {
            inboxSearch.selectedIndex = selectedIndex + 1
          } else if (!increment && selectedIndex > 0) {
            inboxSearch.selectedIndex = selectedIndex - 1
          }
        }
      })
    },
    inboxSearchSelect: (conversationIDKey, q, selectedIndex) => {
      let query = q
      set(s => {
        const {inboxSearch} = s
        if (inboxSearch && selectedIndex != null) {
          inboxSearch.selectedIndex = selectedIndex
        }
      })

      const {inboxSearch} = get()
      if (!inboxSearch) {
        return
      }
      const selected = getInboxSearchSelected(inboxSearch)
      if (!conversationIDKey) {
        conversationIDKey = selected?.conversationIDKey
      }

      if (!conversationIDKey) {
        return
      }
      if (!query) {
        query = selected?.query
      }

      reduxDispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'inboxSearch'}))
      if (query) {
        reduxDispatch(
          Chat2Gen.createSetThreadSearchQuery({conversationIDKey, query: new HiddenString(query)})
        )
        reduxDispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey}))
        reduxDispatch(Chat2Gen.createThreadSearch({conversationIDKey, query: new HiddenString(query)}))
      } else {
        get().dispatch.toggleInboxSearch(false)
      }
    },
    loadStaticConfig: () => {
      if (get().staticConfig) {
        return
      }
      const {handshakeVersion, dispatch} = ConfigConstants.useDaemonState.getState()
      const f = async () => {
        const name = 'chat.loadStatic'
        dispatch.wait(name, handshakeVersion, true)
        try {
          const res = await RPCChatTypes.localGetStaticConfigRpcPromise()
          if (!res.deletableByDeleteHistory) {
            logger.error('chat.loadStaticConfig: got no deletableByDeleteHistory in static config')
            return
          }
          const deletableByDeleteHistory = res.deletableByDeleteHistory.reduce<Array<Types.MessageType>>(
            (res, type) => {
              const ourTypes = Message.serviceMessageTypeToMessageTypes(type)
              if (ourTypes) {
                res.push(...ourTypes)
              }
              return res
            },
            []
          )
          set(s => {
            s.staticConfig = {
              builtinCommands: (res.builtinCommands || []).reduce<Types.StaticConfig['builtinCommands']>(
                (map, c) => {
                  map[c.typ] = c.commands || []
                  return map
                },
                {
                  [RPCChatTypes.ConversationBuiltinCommandTyp.none]: [],
                  [RPCChatTypes.ConversationBuiltinCommandTyp.adhoc]: [],
                  [RPCChatTypes.ConversationBuiltinCommandTyp.smallteam]: [],
                  [RPCChatTypes.ConversationBuiltinCommandTyp.bigteam]: [],
                  [RPCChatTypes.ConversationBuiltinCommandTyp.bigteamgeneral]: [],
                }
              ),
              deletableByDeleteHistory: new Set(deletableByDeleteHistory),
            }
          })
        } finally {
          dispatch.wait(name, handshakeVersion, false)
        }
      }
      Z.ignorePromise(f())
    },
    loadedUserEmoji: results => {
      set(s => {
        const newEmojis: Array<RPCChatTypes.Emoji> = []
        results.emojis.emojis?.forEach(group => {
          group.emojis?.forEach(e => newEmojis.push(e))
        })
        s.userEmojisForAutocomplete = newEmojis
        s.userEmojis = results.emojis.emojis ?? []
      })
    },
    onEngineConnected: () => {
      const f = async () => {
        try {
          await RPCTypes.delegateUiCtlRegisterChatUIRpcPromise()
          await RPCTypes.delegateUiCtlRegisterLogUIRpcPromise()
          console.log('Registered Chat UI')
        } catch (error) {
          console.warn('Error in registering Chat UI:', error)
        }
      }
      Z.ignorePromise(f())
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.chat1NotifyChatChatTypingUpdate: {
          const {typingUpdates} = action.payload.params
          typingUpdates?.forEach(u => {
            getConvoState(Types.conversationIDToKey(u.convID)).dispatch.setTyping(
              new Set(u.typers?.map(t => t.username))
            )
          })
          break
        }
      }
    },
    onTeamBuildingFinished: (users: Set<TeamBuildingTypes.User>) => {
      const f = async () => {
        // need to let the mdoal hide first else its thrashy
        await Z.timeoutPromise(500)
        reduxDispatch(
          Chat2Gen.createNavigateToThread({
            conversationIDKey: pendingWaitingConversationIDKey,
            reason: 'justCreated',
          })
        )
        reduxDispatch(
          Chat2Gen.createCreateConversation({
            participants: [...users].map(u => u.id),
          })
        )
      }
      Z.ignorePromise(f())
    },
    paymentInfoReceived: paymentInfo => {
      set(s => {
        s.paymentStatusMap.set(paymentInfo.paymentID, paymentInfo)
      })
    },
    refreshBotPublicCommands: username => {
      set(s => {
        s.botPublicCommands.delete(username)
      })
      const f = async () => {
        let res: RPCChatTypes.ListBotCommandsLocalRes | undefined
        try {
          res = await RPCChatTypes.localListPublicBotCommandsLocalRpcPromise({
            username,
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('refreshBotPublicCommands: failed to get public commands: ' + error.message)
            set(s => {
              s.botPublicCommands.set(username, {commands: [], loadError: true})
            })
          }
        }
        const commands = (res?.commands ?? []).reduce<Array<string>>((l, c) => {
          l.push(c.name)
          return l
        }, [])

        set(s => {
          s.botPublicCommands.set(username, {commands, loadError: false})
        })
      }
      Z.ignorePromise(f())
    },
    resetConversationErrored: () => {
      set(s => {
        s.createConversationError = undefined
      })
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
        staticConfig: s.staticConfig,
      }))
    },
    setInboxNumSmallRows: (rows, ignoreWrite) => {
      set(s => {
        if (rows > 0) {
          s.inboxNumSmallRows = rows
        }
      })
      if (ignoreWrite) {
        return
      }
      const {inboxNumSmallRows} = get()
      if (inboxNumSmallRows === undefined || inboxNumSmallRows <= 0) {
        return
      }
      const f = async () => {
        try {
          await RPCTypes.configGuiSetValueRpcPromise({
            path: 'ui.inboxSmallRows',
            value: {i: inboxNumSmallRows, isNull: false},
          })
        } catch (_) {}
      }
      Z.ignorePromise(f())
    },
    setMaybeMentionInfo: (name, info) => {
      set(s => {
        const {maybeMentionMap} = s
        maybeMentionMap.set(name, info)
      })
    },
    setTrustedInboxHasLoaded: () => {
      set(s => {
        s.trustedInboxHasLoaded = true
      })
    },
    showInfoPanel: (
      show: boolean,
      tab?: 'settings' | 'members' | 'attachments' | 'bots',
      conversationIDKey?: Types.ConversationIDKey
    ) => {
      set(s => {
        s.infoPanelShowing = show
        s.infoPanelSelectedTab = show ? tab : undefined
      })

      if (isPhone) {
        const visibleScreen = Router2.getVisibleScreen()
        if ((visibleScreen?.name === 'chatInfoPanel') !== show) {
          if (show) {
            Router2.useState
              .getState()
              .dispatch.navigateAppend({props: {conversationIDKey, tab}, selected: 'chatInfoPanel'})
          } else {
            Router2.useState.getState().dispatch.navigateUp()
            conversationIDKey && reduxDispatch(Chat2Gen.createClearAttachmentView({conversationIDKey}))
          }
        }
      }
    },
    toggleInboxSearch: enabled => {
      set(s => {
        const {inboxSearch} = s
        if (enabled && !inboxSearch) {
          s.inboxSearch = makeInboxSearchInfo()
        } else if (!enabled && inboxSearch) {
          s.inboxSearch = undefined
        }
      })
      const f = async () => {
        const {inboxSearch} = get()
        if (!inboxSearch) {
          await RPCChatTypes.localCancelActiveInboxSearchRpcPromise()
          return
        }
        if (inboxSearch.nameStatus === 'initial') {
          get().dispatch.inboxSearch('')
        }
      }
      Z.ignorePromise(f())
    },
    toggleSmallTeamsExpanded: () => {
      set(s => {
        s.smallTeamsExpanded = !s.smallTeamsExpanded
      })
    },
    updateCoinFlipStatus: statuses => {
      set(s => {
        const {flipStatusMap} = s
        statuses.forEach(status => {
          flipStatusMap.set(status.gameID, status)
        })
      })
    },
    updateInboxLayout: str => {
      set(s => {
        try {
          const {inboxHasLoaded} = s
          const layout: RPCChatTypes.UIInboxLayout = JSON.parse(str)
          s.inboxLayout = layout
          s.inboxHasLoaded = true
          if (!inboxHasLoaded) {
            // on first layout, initialize any drafts and muted status
            // After the first layout, any other updates will come in the form of meta updates.
            layout.smallTeams?.forEach(t => {
              const cs = getConvoState(t.convID)
              cs.dispatch.setMuted(t.isMuted)
              cs.dispatch.setDraft(t.draft ?? '')
            })
            layout.bigTeams?.forEach(t => {
              if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
                const cs = getConvoState(t.channel.convID)
                cs.dispatch.setMuted(t.channel.isMuted)
                cs.dispatch.setDraft(t.channel.draft ?? '')
              }
            })
          }
        } catch (e) {
          logger.info('failed to JSON parse inbox layout: ' + e)
        }
      })
    },
    updateLastCoord: coord => {
      set(s => {
        s.lastCoord = coord
      })
      const f = async () => {
        const {accuracy, lat, lon} = coord
        await RPCChatTypes.localLocationUpdateRpcPromise({coord: {accuracy, lat, lon}})
      }
      Z.ignorePromise(f())
    },
    updateUserReacjis: userReacjis => {
      set(s => {
        const {skinTone, topReacjis} = userReacjis
        s.userReacjis.skinTone = skinTone
        s.userReacjis.topReacjis = topReacjis || defaultTopReacjis
      })
    },
    updatedGregor: items => {
      const explodingItems = items.filter(i => i.item.category.startsWith(explodingModeGregorKeyPrefix))
      if (!explodingItems.length) {
        // No conversations have exploding modes, clear out what is set
        reduxDispatch(Chat2Gen.createUpdateConvExplodingModes({modes: []}))
      } else {
        logger.info('Got push state with some exploding modes')
        const modes = explodingItems.reduce<
          Array<{conversationIDKey: Types.ConversationIDKey; seconds: number}>
        >((current, i) => {
          try {
            const {category, body} = i.item
            const secondsString = Buffer.from(body).toString()
            const seconds = parseInt(secondsString, 10)
            if (isNaN(seconds)) {
              logger.warn(`Got dirty exploding mode ${secondsString} for category ${category}`)
              return current
            }
            const _conversationIDKey = category.substring(explodingModeGregorKeyPrefix.length)
            const conversationIDKey = Types.stringToConversationIDKey(_conversationIDKey)
            current.push({conversationIDKey, seconds})
          } catch (e) {
            logger.info('Error parsing exploding' + e)
          }
          return current
        }, [])
        reduxDispatch(Chat2Gen.createUpdateConvExplodingModes({modes}))
      }

      const f = async () => {
        const GregorConstants = await import('../gregor')
        set(s => {
          const blockButtons = items.some(i => i.item.category.startsWith(blockButtonsGregorPrefix))
          if (blockButtons || s.blockButtonsMap.size > 0) {
            const shouldKeepExistingBlockButtons = new Map<string, boolean>()
            s.blockButtonsMap.forEach((_, teamID: string) =>
              shouldKeepExistingBlockButtons.set(teamID, false)
            )
            items
              .filter(i => i.item.category.startsWith(blockButtonsGregorPrefix))
              .forEach(i => {
                try {
                  const teamID = i.item.category.substring(blockButtonsGregorPrefix.length)
                  if (!s.blockButtonsMap.get(teamID)) {
                    const body = GregorConstants.bodyToJSON(i.item.body) as {adder: string}
                    const adder = body.adder
                    s.blockButtonsMap.set(teamID, {adder})
                  } else {
                    shouldKeepExistingBlockButtons.set(teamID, true)
                  }
                } catch (e) {
                  logger.info('block buttons parse fail', e)
                }
              })
            shouldKeepExistingBlockButtons.forEach((keep, teamID) => {
              if (!keep) {
                s.blockButtonsMap.delete(teamID)
              }
            })
          }
        })
      }
      Z.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
    getBadgeMap: badgeCountsChanged => {
      badgeCountsChanged // this param is just to ensure the selector reruns on a change
      const badgeMap = new Map()
      stores.forEach(s => {
        const {id, badge} = s.getState()
        badgeMap.set(id, badge)
      })
      return badgeMap
    },
    getUnreadMap: badgeCountsChanged => {
      badgeCountsChanged // this param is just to ensure the selector reruns on a change
      const unreadMap = new Map()
      stores.forEach(s => {
        const {id, unread} = s.getState()
        unreadMap.set(id, unread)
      })
      return unreadMap
    },
  }
})

export {type ConvoState, useContext, getConvoState, Provider} from './convostate'
