import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as TeamBuildingConstants from '../team-building'
import * as Types from '../types/chat2'
import * as Router2 from '../router2'
import * as TeamConstants from '../teams'
import {isMobile, isTablet} from '../platform'
import {
  noConversationIDKey,
  pendingWaitingConversationIDKey,
  pendingErrorConversationIDKey,
  conversationIDKeyToString,
  isValidConversationIDKey,
} from '../types/chat2/common'
import HiddenString from '../../util/hidden-string'
import {getEffectiveRetentionPolicy, getMeta} from './meta'
import {memoize} from '../../util/memoize'
import type * as TeamTypes from '../types/teams'
import type * as UserTypes from '../types/users'
import type {TypedState} from '../reducer'

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
const emptySet = new Set()
export const isSplit = !isMobile || isTablet // Whether the inbox and conversation panels are visible side-by-side.

// while we're debugging chat issues
export const DEBUG_CHAT_DUMP = true

// in split mode the root is the 'inbox'
export const threadRouteName = isSplit ? 'chatRoot' : 'chatConversation'

export const blockButtonsGregorPrefix = 'blockButtons.'

export const makeState = (): Types.State => ({
  accountsInfoMap: new Map(),
  attachmentViewMap: new Map(),
  badgeMap: new Map(), // id to the badge count
  bigTeamBadgeCount: 0,
  blockButtonsMap: new Map(),
  botCommandsUpdateStatusMap: new Map(),
  botPublicCommands: new Map(),
  botSearchResults: new Map(),
  botSettings: new Map(),
  botTeamRoleInConvMap: new Map(),
  commandMarkdownMap: new Map(),
  commandStatusMap: new Map(),
  containsLatestMessageMap: new Map(),
  createConversationError: null,
  dismissedInviteBannersMap: new Map(),
  draftMap: new Map(),
  editingMap: new Map(),
  explodingModeLocks: new Map(), // locks set on exploding mode while user is inputting text,
  explodingModes: new Map(), // seconds to exploding message expiration,
  featuredBotsLoaded: false,
  featuredBotsMap: new Map(),
  featuredBotsPage: -1,
  flipStatusMap: new Map(),
  focus: null,
  giphyResultMap: new Map(),
  giphyWindowMap: new Map(),
  hasZzzJourneycard: new Map(),
  inboxHasLoaded: false,
  inboxLayout: null,
  inboxNumSmallRows: 5,
  inboxSearch: undefined,
  infoPanelSelectedTab: undefined,
  infoPanelShowing: false,
  lastCoord: undefined,
  markedAsUnreadMap: new Map(), // store a bit if we've marked this thread as unread so we don't mark as read when navgiating away
  maybeMentionMap: new Map(),
  messageCenterOrdinals: new Map(), // ordinals to center threads on,
  messageMap: new Map(), // messages in a thread,
  messageOrdinals: new Map(), // ordered ordinals in a thread,
  messageTypeMap: new Map(),
  metaMap: new Map(), // metadata about a thread, There is a special node for the pending conversation,
  moreToLoadMap: new Map(), // if we have more data to load,
  mutedMap: new Map(),
  mutualTeamMap: new Map(),
  orangeLineMap: new Map(), // last message we've seen,
  participantMap: new Map(),
  paymentConfirmInfo: undefined,
  paymentStatusMap: new Map(),
  pendingOutboxToOrdinal: new Map(), // messages waiting to be sent,
  replyToMap: new Map(),
  shouldDeleteZzzJourneycard: new Map(),
  smallTeamBadgeCount: 0,
  smallTeamsExpanded: false,
  staticConfig: undefined,
  teamBuilding: TeamBuildingConstants.makeSubState(),
  teamIDToGeneralConvID: new Map(),
  threadLoadStatus: new Map(),
  threadSearchInfoMap: new Map(),
  threadSearchQueryMap: new Map(),
  trustedInboxHasLoaded: false,
  typingMap: new Map(), // who's typing currently,
  unfurlPromptMap: new Map(),
  unreadMap: new Map(),
  unsentTextMap: new Map(),
  userEmojis: undefined,
  userEmojisForAutocomplete: undefined,
  userReacjis: defaultUserReacjis,
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
  query: new HiddenString(''),
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
        query: new HiddenString(result.query),
      }
    }
  }

  return null
}

export const getThreadSearchInfo = (state: TypedState, conversationIDKey: Types.ConversationIDKey) =>
  state.chat2.threadSearchInfoMap.get(conversationIDKey) || makeThreadSearchInfo()

const emptyOrdinals = new Array<Types.Ordinal>()
export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id) || emptyOrdinals
export const getMessageCenterOrdinal = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageCenterOrdinals.get(id)
export const getMessage = (
  state: TypedState,
  id: Types.ConversationIDKey,
  ordinal: Types.Ordinal
): Types.Message | null => state.chat2.messageMap.get(id)?.get(ordinal) ?? null

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
export const getHasBadge = (state: TypedState, id: Types.ConversationIDKey) =>
  (state.chat2.badgeMap.get(id) || 0) > 0
export const getHasUnread = (state: TypedState, id: Types.ConversationIDKey) =>
  (state.chat2.unreadMap.get(id) || 0) > 0
export const getSelectedConversation = (): Types.ConversationIDKey => {
  const maybeVisibleScreen = Router2.getVisibleScreen()
  if (maybeVisibleScreen?.name === threadRouteName) {
    // @ts-ignore TODO better types
    return maybeVisibleScreen.params?.conversationIDKey ?? noConversationIDKey
  }
  return noConversationIDKey
}

export const getReplyToOrdinal = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  return state.chat2.replyToMap.get(conversationIDKey) || null
}
export const getReplyToMessageID = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  const ordinal = getReplyToOrdinal(state, conversationIDKey)
  if (!ordinal) return null
  const maybeMessage = getMessage(state, conversationIDKey, ordinal)
  return ordinal ? (maybeMessage === null || maybeMessage === undefined ? undefined : maybeMessage.id) : null
}

export const getEditInfo = (state: TypedState, id: Types.ConversationIDKey) => {
  const ordinal = state.chat2.editingMap.get(id)
  if (!ordinal) {
    return null
  }

  const message = getMessage(state, id, ordinal)
  if (!message) {
    return null
  }
  switch (message.type) {
    case 'text':
      return {exploded: message.exploded, ordinal, text: message.text.stringValue()}
    case 'attachment':
      return {exploded: message.exploded, ordinal, text: message.title}
    default:
      return null
  }
}

export const getTyping = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.typingMap.get(id) || (emptySet as Set<string>)
export const generateOutboxID = () => Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))
export const isUserActivelyLookingAtThisThread = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey
) => {
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

  return (
    state.config.appFocused && // app focused?
    state.config.userActive && // actually interacting w/ the app
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
  const teamMembers = state.teams.teamIDToMembers.get(meta.teamID) ?? new Map()
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

export const anyChatWaitingKeys = (state: TypedState) =>
  [...state.waiting.counts.keys()].some(k => k.startsWith('chat:'))

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

export const isMuted = (state: TypedState, convID: Types.ConversationIDKey) =>
  state.chat2.mutedMap.get(convID) || false

export const getDraft = (state: TypedState, convID: Types.ConversationIDKey) =>
  state.chat2.draftMap.get(convID) || ''

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

const _getParticipantSuggestionsMemoized = memoize(
  (
    teamMembers: Map<string, TeamTypes.MemberInfo> | undefined,
    participantInfo: Types.ParticipantInfo,
    infoMap: Map<string, UserTypes.UserInfo>,
    teamType: Types.TeamType
  ) => {
    const usernames = teamMembers
      ? [...teamMembers.values()].map(m => m.username).sort((a, b) => a.localeCompare(b))
      : participantInfo.all
    const suggestions = usernames.map(username => ({
      fullName: infoMap.get(username)?.fullname || '',
      username,
    }))
    if (teamType !== 'adhoc') {
      const fullName = teamType === 'small' ? 'Everyone in this team' : 'Everyone in this channel'
      suggestions.push({fullName, username: 'channel'}, {fullName, username: 'here'})
    }
    return suggestions
  }
)

export const getParticipantSuggestions = (state: TypedState, id: Types.ConversationIDKey) => {
  const {teamID, teamType} = getMeta(state, id)
  const teamMembers = state.teams.teamIDToMembers.get(teamID)
  const participantInfo = getParticipantInfo(state, id)
  return _getParticipantSuggestionsMemoized(teamMembers, participantInfo, state.users.infoMap, teamType)
}

export const messageAuthorIsBot = (
  state: TypedState,
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
  getCommands,
  getConversationIDKeyMetasToLoad,
  getConversationLabel,
  getEffectiveRetentionPolicy,
  getGeneralChannelForBigTeam,
  getMeta,
  getRowParticipants,
  getRowStyles,
  getTeams,
  inboxUIItemToConversationMeta,
  makeConversationMeta,
  shouldShowWalletsIcon,
  timestampToString,
  unverifiedInboxUIItemToConversationMeta,
  updateMeta,
  updateMetaWithNotificationSettings,
} from './meta'

export {
  allMessageTypes,
  getClientPrev,
  getDeletableByDeleteHistory,
  getMapUnfurl,
  getMessageID,
  getMessageStateExtras,
  getPaymentMessageInfo,
  getRequestMessageInfo,
  hasSuccessfulInlinePayments,
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
  serviceMessageTypeToMessageTypes,
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
