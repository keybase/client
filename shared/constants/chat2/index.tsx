import * as Types from '../types/chat2'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as TeamBuildingConstants from '../team-building'
import clamp from 'lodash/clamp'
import {chatTab} from '../tabs'
import {TypedState} from '../reducer'
import {isMobile} from '../platform'
import {
  noConversationIDKey,
  pendingWaitingConversationIDKey,
  pendingErrorConversationIDKey,
  conversationIDKeyToString,
  isValidConversationIDKey,
} from '../types/chat2/common'
import {getEffectiveRetentionPolicy, getMeta} from './meta'
import {formatTextForQuoting} from '../../util/chat'
import * as Router2 from '../router2'
import HiddenString from '../../util/hidden-string'
import {getFullname} from '../users'
import {memoize} from '../../util/memoize'
import * as TeamConstants from '../teams'
import flags from '../../util/feature-flags'

export const defaultTopReacjis = [':+1:', ':-1:', ':tada:', ':joy:', ':sunglasses:']
const defaultSkinTone = 1
export const defaultUserReacjis = {skinTone: defaultSkinTone, topReacjis: defaultTopReacjis}
const emptyArray: Array<unknown> = []
const emptySet = new Set()

export const blockButtonsGregorPrefix = 'blockButtons.'

export const makeState = (): Types.State => ({
  accountsInfoMap: new Map(),
  attachmentViewMap: new Map(),
  audioRecording: new Map(),
  badgeMap: new Map(), // id to the badge count
  blockButtonsMap: new Map(),
  botCommandsUpdateStatusMap: new Map(),
  botPublicCommands: new Map(),
  botSettings: new Map(),
  botTeamRoleInConvMap: new Map(),
  channelSearchText: '',
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
  inboxHasLoaded: false,
  inboxLayout: null,
  inboxNumSmallRows: 5,
  inboxSearch: undefined,
  inboxShowNew: false,
  infoPanelSelectedTab: undefined,
  infoPanelShowing: false,
  isWalletsNew: true,
  lastCoord: undefined,
  maybeMentionMap: new Map(),
  messageCenterOrdinals: new Map(), // ordinals to center threads on,
  messageMap: new Map(), // messages in a thread,
  messageOrdinals: new Map(), // ordered ordinals in a thread,
  metaMap: new Map(), // metadata about a thread, There is a special node for the pending conversation,
  moreToLoadMap: new Map(), // if we have more data to load,
  mutedMap: new Map(),
  orangeLineMap: new Map(), // last message we've seen,
  participantMap: new Map(),
  paymentConfirmInfo: undefined,
  paymentStatusMap: new Map(),
  pendingOutboxToOrdinal: new Map(), // messages waiting to be sent,
  prependTextMap: new Map(),
  previousSelectedConversation: noConversationIDKey,
  quote: undefined,
  replyToMap: new Map(),
  selectedConversation: noConversationIDKey,
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
  indexPercent: 0,
  nameResults: [],
  nameResultsUnread: false,
  nameStatus: 'initial',
  openTeamsResults: [],
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

export const makeAudioRecordingInfo = (): Types.AudioRecordingInfo => ({
  isLocked: false,
  outboxID: new Buffer('hex'),
  path: '',
  recordStart: Date.now(),
  status: Types.AudioRecordingStatus.INITIAL,
})

export const showAudioRecording = (audioRecording: Types.AudioRecordingInfo | undefined) => {
  return !(
    !audioRecording ||
    audioRecording.status === Types.AudioRecordingStatus.INITIAL ||
    audioRecording.status === Types.AudioRecordingStatus.STOPPED ||
    audioRecording.status === Types.AudioRecordingStatus.STAGED ||
    audioRecording.status === Types.AudioRecordingStatus.CANCELLED
  )
}

export const isStoppedAudioRecordingStatus = (status: Types.AudioRecordingStatus) => {
  return (
    status === Types.AudioRecordingStatus.STOPPED ||
    status === Types.AudioRecordingStatus.STAGED ||
    status === Types.AudioRecordingStatus.CANCELLED
  )
}

export const audioRecordingDuration = (audioRecording: Types.AudioRecordingInfo) => {
  return (audioRecording.recordEnd || audioRecording.recordStart) - audioRecording.recordStart
}

export const isCancelledAudioRecording = (audioRecording: Types.AudioRecordingInfo | undefined) => {
  return audioRecording && audioRecording.status === Types.AudioRecordingStatus.CANCELLED
}

export const getInboxSearchSelected = (inboxSearch: Types.InboxSearchInfo) => {
  const {selectedIndex, nameResults, openTeamsResults, textResults} = inboxSearch
  const firstTextResultIdx = flags.openTeamSearch
    ? openTeamsResults.length + nameResults.length
    : nameResults.length
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
  } else if (flags.openTeamSearch && selectedIndex < firstTextResultIdx) {
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

const emptyOrdinals = new Set<Types.Ordinal>()
export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id) || emptyOrdinals
export const getMessageCenterOrdinal = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageCenterOrdinals.get(id)
export const getMessage = (
  state: TypedState,
  id: Types.ConversationIDKey,
  ordinal: Types.Ordinal
): Types.Message | null => {
  const map = state.chat2.messageMap.get(id)
  return (map && map.get(ordinal)) || null
}
export const isMessageWithReactions = (message: Types.Message): message is Types.MessagesWithReactions => {
  return !(
    message.type === 'placeholder' ||
    message.type === 'deleted' ||
    message.type === 'systemJoined' ||
    message.type === 'systemLeft' ||
    message.type === 'journeycard'
  )
}
export const getMessageKey = (message: Types.Message) =>
  `${message.conversationIDKey}:${Types.ordinalToNumber(message.ordinal)}`
export const getHasBadge = (state: TypedState, id: Types.ConversationIDKey) =>
  (state.chat2.badgeMap.get(id) || 0) > 0
export const getHasUnread = (state: TypedState, id: Types.ConversationIDKey) =>
  (state.chat2.unreadMap.get(id) || 0) > 0
export const getSelectedConversation = (state: TypedState) => state.chat2.selectedConversation
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
  if (!message || message.type !== 'text') {
    return null
  }

  return {exploded: message.exploded, ordinal, text: message.text.stringValue()}
}

export const getQuoteInfo = (state: TypedState, id: Types.ConversationIDKey) => {
  const quote = state.chat2.quote
  // Return null if we're not on the target conversation.
  if (!quote || quote.targetConversationIDKey !== id) {
    return null
  }

  const message = getMessage(state, quote.sourceConversationIDKey, quote.ordinal)
  if (!message || message.type !== 'text') {
    return null
  }

  return {counter: quote.counter, text: formatTextForQuoting(message.text.stringValue())}
}

export const getTyping = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.typingMap.get(id) || (emptySet as Set<string>)
export const generateOutboxID = () => Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))
export const isUserActivelyLookingAtThisThread = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey
) => {
  const selectedConversationIDKey = getSelectedConversation(state)

  let chatThreadSelected = false
  if (isMobile) {
    chatThreadSelected = true // conversationIDKey === selectedConversationIDKey is the only thing that matters in the new router
  } else {
    const maybeVisibleScreen = Router2.getVisibleScreen()
    chatThreadSelected =
      (maybeVisibleScreen === null || maybeVisibleScreen === undefined
        ? undefined
        : maybeVisibleScreen.routeName) === 'chatRoot'
  }

  return (
    state.config.appFocused && // app focused?
    state.config.userActive && // actually interacting w/ the app
    chatThreadSelected && // looking at the chat tab?
    conversationIDKey === selectedConversationIDKey // looking at the selected thread?
  )
}
export const isTeamConversationSelected = (state: TypedState, teamname: string) => {
  const meta = getMeta(state, getSelectedConversation(state))
  return meta.teamname === teamname
}

export const inboxSearchNewKey = 'chat:inboxSearchNew'
export const waitingKeyJoinConversation = 'chat:joinConversation'
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
  let mode = state.chat2.explodingModeLocks.get(c) || null
  if (mode === null) {
    mode = state.chat2.explodingModes.get(c) || 0
  }
  const meta = getMeta(state, c)
  const convRetention = getEffectiveRetentionPolicy(meta)
  mode = convRetention.type === 'explode' ? Math.min(mode || Infinity, convRetention.seconds) : mode
  return mode || 0
}
export const isExplodingModeLocked = (state: TypedState, c: Types.ConversationIDKey) =>
  (state.chat2.explodingModeLocks.get(c) || null) !== null

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
  convIDKeys: Array<Types.ConversationIDKey>
): RPCChatTypes.GetInboxLocalQuery => {
  return {
    computeActiveList: true,
    convIDs: convIDKeys.map(Types.keyToConversationID),
    memberStatus: (Object.keys(RPCChatTypes.ConversationMemberStatus)
      .filter(k => typeof RPCChatTypes.ConversationMemberStatus[k as any] === 'number')
      .filter(k => !['neverJoined', 'left', 'removed'].includes(k as any))
      .map(k => RPCChatTypes.ConversationMemberStatus[k as any]) as unknown) as Array<
      RPCChatTypes.ConversationMemberStatus
    >,
    readOnly: false,
    status: (Object.keys(RPCChatTypes.ConversationStatus)
      .filter(k => typeof RPCChatTypes.ConversationStatus[k as any] === 'number')
      .filter(k => !['ignored', 'blocked', 'reported'].includes(k as any))
      .map(k => RPCChatTypes.ConversationStatus[k as any]) as unknown) as Array<
      RPCChatTypes.ConversationStatus
    >,
    tlfVisibility: RPCTypes.TLFVisibility.private,
    topicType: RPCChatTypes.TopicType.chat,
    unreadOnly: false,
  }
}

export const isAssertion = (username: string) => username.includes('@')

export const threadRoute = isMobile ? [chatTab, 'chatConversation'] : [{props: {}, selected: chatTab}]
export const newRouterThreadRoute = isMobile ? ['chatConversation'] : [chatTab]

const numMessagesOnInitialLoad = isMobile ? 20 : 100
const numMessagesOnScrollback = isMobile ? 100 : 100

export const flipPhaseToString = (phase: number) => {
  switch (phase) {
    case RPCChatTypes.UICoinFlipPhase.commitment:
      return 'commitments'
    case RPCChatTypes.UICoinFlipPhase.reveals:
      return 'secrets'
    case RPCChatTypes.UICoinFlipPhase.complete:
      return 'complete'
    default:
      return 'loading'
  }
}

export const clampImageSize = (width: number, height: number, maxSize: number) =>
  height > width
    ? {
        height: clamp(height || 0, 0, maxSize),
        width: (clamp(height || 0, 0, maxSize) * width) / (height || 1),
      }
    : {
        height: (clamp(width || 0, 0, maxSize) * height) / (width || 1),
        width: clamp(width || 0, 0, maxSize),
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

// we want the memoized function to have access to state but not have it be a part of the memoization else it'll fail always
let _unmemoizedState: TypedState
const _getParticipantSuggestionsMemoized = memoize(
  (participants: Array<string>, teamType: Types.TeamType) => {
    const suggestions = participants.map(username => ({
      fullName: getFullname(_unmemoizedState, username) || '',
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
  const participants = getParticipantInfo(state, id)
  const {teamType} = getMeta(state, id)
  _unmemoizedState = state
  return _getParticipantSuggestionsMemoized(participants.all, teamType)
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

export {
  getBotCommands,
  getCommands,
  getConversationIDKeyMetasToLoad,
  getEffectiveRetentionPolicy,
  getGeneralChannelForBigTeam,
  getMeta,
  getRowParticipants,
  getRowStyles,
  getTeams,
  inboxUIItemToConversationMeta,
  isDecryptingSnippet,
  makeConversationMeta,
  shouldShowWalletsIcon,
  timestampToString,
  unverifiedInboxUIItemToConversationMeta,
  updateMeta,
  updateMetaWithNotificationSettings,
} from './meta'

export {
  allMessageTypes,
  enoughTimeBetweenMessages,
  getClientPrev,
  getDeletableByDeleteHistory,
  getMapUnfurl,
  getMessageID,
  getRequestMessageInfo,
  getPaymentMessageInfo,
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
  messageExplodeDescriptions,
  messageAttachmentHasProgress,
  messageAttachmentTransferStateToProgressLabel,
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
  mergeMessage,
} from './message'

export {
  isValidConversationIDKey,
  noConversationIDKey,
  numMessagesOnInitialLoad,
  numMessagesOnScrollback,
  pendingErrorConversationIDKey,
  pendingWaitingConversationIDKey,
}
