// @flow
import * as I from 'immutable'
import * as ChatTypes from './types/flow-types-chat'
import * as SearchConstants from './search'
import * as RPCTypes from './types/flow-types'
import HiddenString from '../util/hidden-string'
import clamp from 'lodash/clamp'
import invert from 'lodash/invert'
import {Buffer} from 'buffer'
import {chatTab} from './tabs'
import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect'
import isEqualWith from 'lodash/isEqualWith'
import {getPath, getPathState} from '../route-tree'
import {parseUserId, serviceIdToIcon} from '../util/platforms'
import {type DeviceType} from './devices'
import {type TypedState} from './reducer'
import {type UserListItem} from '../common-adapters/usernames'

const createShallowEqualSelector = createSelectorCreator(defaultMemoize, (a, b) =>
  isEqualWith(a, b, (a, b, indexOrKey, object, other, stack) => (stack ? a === b : undefined))
)

export type Username = string
export type MessageKey = string
type MessageKeyKind =
  | 'chatSecured'
  | 'error'
  | 'errorInvisible'
  | 'header'
  | 'messageIDAttachment'
  | 'messageIDDeleted'
  | 'messageIDEdit'
  | 'messageIDAttachmentUpdate'
  | 'messageIDError'
  | 'messageIDText'
  | 'messageIDUnhandled'
  | 'outboxIDAttachment'
  | 'outboxIDText'
  | 'timestamp'
  | 'supersedes'
  | 'system'
  | 'joinedleft'

// TODO: Ideally, this would be 'Text' | 'Error' | etc.
export type MessageType = string
export type FollowingMap = {[key: string]: true}

export type MessageState = 'pending' | 'failed' | 'sent'
export const messageStates: Array<MessageState> = ['pending', 'failed', 'sent']

export type AttachmentMessageState = MessageState | 'placeholder' | 'uploading'
export type AttachmentType = 'Image' | 'Video' | 'Other'

export type ConversationID = ChatTypes.ConversationID
export type ConversationIDKey = string

export type OutboxID = ChatTypes.OutboxID
export type OutboxIDKey = string

export type MessageID = string

export type NotifyType = 'atmention' | 'generic' | 'never'
export type Mentions = I.Set<string>
export type ChannelMention = 'None' | 'All' | 'Here'

export type TextMessage = {
  type: 'Text',
  message: HiddenString,
  author: string,
  deviceName: string,
  deviceType: DeviceType,
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID?: MessageID,
  you: string,
  messageState: MessageState,
  rawMessageID: number,
  failureDescription: ?string,
  outboxID?: ?OutboxIDKey,
  senderDeviceRevokedAt: ?number,
  key: MessageKey,
  editedCount: number, // increase as we edit it
  mentions: Mentions,
  channelMention: ChannelMention,
}
export function textMessageEditable(message: TextMessage): boolean {
  // For now, disallow editing of non-sent messages. In the future, we
  // may want to do something more intelligent.
  return message.messageState === 'sent'
}

export type ErrorMessage = {
  type: 'Error',
  reason: string,
  timestamp?: number,
  conversationIDKey: ConversationIDKey,
  messageID?: MessageID,
  key: MessageKey,
}

export type InvisibleErrorMessage = {
  type: 'InvisibleError',
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
  key: MessageKey,
  data: any,
}

export type UnhandledMessage = {
  type: 'Unhandled',
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
  key: MessageKey,
}

export type AttachmentSize = {
  width: number,
  height: number,
}

export type AttachmentInput = {
  conversationIDKey: ConversationIDKey,
  filename: string,
  title: string,
  type: AttachmentType,
}

export type AttachmentMessage = {
  type: 'Attachment',
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  you: string,
  author: string,
  deviceName: string,
  deviceType: DeviceType,
  messageID?: MessageID,
  rawMessageID: number,
  filename: ?string,
  title: ?string,
  attachmentDurationMs: ?number,
  previewType: ?AttachmentType,
  previewSize: ?AttachmentSize,
  previewDurationMs: ?number,
  uploadPath?: string,
  outboxID?: ?OutboxIDKey,
  messageState: AttachmentMessageState,
  senderDeviceRevokedAt: ?number,
  key: MessageKey,
  failureDescription?: ?string,
}

export type TimestampMessage = {
  type: 'Timestamp',
  timestamp: number,
  key: MessageKey,
}

export type LoadingMoreMessage = {
  type: 'LoadingMore',
  key: MessageKey,
}

export type ChatSecuredHeaderMessage = {
  type: 'ChatSecuredHeader',
  key: MessageKey,
}

export type JoinedLeftMessage = {
  type: 'JoinedLeft',
  messageID?: MessageID,
  author: string,
  timestamp: number,
  message: HiddenString,
  key: MessageKey,
}

export type SystemMessage = {
  type: 'System',
  messageID?: MessageID,
  author: string,
  timestamp: number,
  message: HiddenString,
  key: MessageKey,
}

export type SupersedesMessage = {
  type: 'Supersedes',
  username: string,
  timestamp: number,
  supersedes: ConversationIDKey,
  key: any,
}

export type DeletedMessage = {
  type: 'Deleted',
  timestamp: number,
  key: MessageKey,
  messageID: MessageID,
  deletedIDs: Array<MessageID>,
}

export type EditingMessage = {
  type: 'Edit',
  key: MessageKey,
  message: HiddenString,
  messageID: MessageID,
  outboxID?: ?OutboxIDKey,
  targetMessageID: MessageID,
  timestamp: number,
  mentions: Mentions,
  channelMention: ChannelMention,
}

export type UpdatingAttachment = {
  type: 'UpdateAttachment',
  key: MessageKey,
  messageID: MessageID,
  targetMessageID: MessageID,
  timestamp: number,
  updates: {
    attachmentDurationMs: ?number,
    filename: ?string,
    messageState: 'sent',
    previewType: ?AttachmentType,
    previewSize: ?AttachmentSize,
    previewDurationMs: ?number,
    title: ?string,
  },
}

export type ClientMessage =
  | TimestampMessage
  | SupersedesMessage
  | LoadingMoreMessage
  | ChatSecuredHeaderMessage
export type ServerMessage =
  | TextMessage
  | ErrorMessage
  | AttachmentMessage
  | DeletedMessage
  | UnhandledMessage
  | EditingMessage
  | UpdatingAttachment
  | InvisibleErrorMessage
  | SystemMessage
  | JoinedLeftMessage

export type Message = ClientMessage | ServerMessage

export type MaybeTimestamp = TimestampMessage | null

export const ConversationStatusByEnum = invert(ChatTypes.commonConversationStatus)
type _ConversationState = {
  moreToLoad: ?boolean,
  isLoaded: boolean,
  isRequesting: boolean,
  isStale: boolean,
  loadedOffline: boolean,
  paginationNext: ?string,
  paginationPrevious: ?string,
  firstNewMessageID: ?MessageID,
  typing: I.Set<Username>,
}
export type ConversationState = I.RecordOf<_ConversationState>
export const makeConversationState: I.RecordFactory<_ConversationState> = I.Record({
  moreToLoad: undefined,
  isLoaded: false,
  isRequesting: false,
  isStale: false,
  loadedOffline: false,
  paginationNext: undefined,
  paginationPrevious: undefined,
  firstNewMessageID: undefined,
  typing: I.Set(),
})

type _ConversationBadgeState = {
  convID: ConversationID,
  unreadMessages: number,
  badgeCounts: {[key: string]: number},
}
export type ConversationBadgeState = I.RecordOf<_ConversationBadgeState>
export const ConversationBadgeStateRecord: I.RecordFactory<_ConversationBadgeState> = I.Record({
  convID: undefined,
  unreadMessages: 0,
  badgeCounts: {},
})

export type ConversationStateEnum = $Keys<typeof ChatTypes.commonConversationStatus>

export type NotificationsKindState = {
  generic: boolean,
  atmention: boolean,
}

export type NotificationsState = {
  channelWide: boolean,
  desktop: NotificationsKindState,
  mobile: NotificationsKindState,
}

// firstUnboxing is when its going from untrusted to unboxing vs unboxed to reUnboxing
export type InboxUntrustedState = 'untrusted' | 'unboxed' | 'error' | 'firstUnboxing' | 'reUnboxing'

type _InboxState = {
  conversationIDKey: ConversationIDKey,
  info: ?ChatTypes.ConversationInfoLocal,
  isEmpty: boolean,
  teamname: ?string,
  channelname: ?string,
  maxMsgID: ?number,
  name: ?string,
  memberStatus: ChatTypes.ConversationMemberStatus,
  membersType: ChatTypes.ConversationMembersType,
  notifications: ?NotificationsState,
  participants: I.List<string>,
  fullNames: I.Map<string, string>,
  status: ConversationStateEnum,
  time: number,
  teamType: ChatTypes.TeamType,
  version: ChatTypes.ConversationVers,
  visibility: RPCTypes.TLFVisibility,
}

export type InboxState = I.RecordOf<_InboxState>
export const makeInboxState: I.RecordFactory<_InboxState> = I.Record({
  conversationIDKey: '',
  info: null,
  isEmpty: false,
  teamname: null,
  channelname: null,
  maxMsgID: null,
  memberStatus: 0,
  membersType: 0,
  notifications: null,
  participants: I.List(),
  fullNames: I.Map(),
  status: 'unfiled',
  time: 0,
  name: '',
  visibility: RPCTypes.commonTLFVisibility.private,
  teamType: ChatTypes.commonTeamType.none,
  version: 0,
})

export type SupersedeInfo = {
  conversationIDKey: ConversationID,
  finalizeInfo: ChatTypes.ConversationFinalizeInfo,
}

export type FinalizeInfo = ChatTypes.ConversationFinalizeInfo

export type FinalizedState = I.Map<ConversationIDKey, ChatTypes.ConversationFinalizeInfo>

export type SupersedesState = I.Map<ConversationIDKey, SupersedeInfo>
export type SupersededByState = I.Map<ConversationIDKey, SupersedeInfo>

export type _MetaData = {
  fullname: string,
  brokenTracker: boolean,
}
export type MetaData = I.RecordOf<_MetaData>
export type MetaDataMap = I.Map<string, MetaData>

export const makeMetaData: I.RecordFactory<_MetaData> = I.Record({
  fullname: 'Unknown',
  brokenTracker: false,
})

export type Participants = I.List<string>

export type _RekeyInfo = {
  rekeyParticipants: Participants,
  youCanRekey: boolean,
}

export type RekeyInfo = I.RecordOf<_RekeyInfo>
export const makeRekeyInfo: I.RecordFactory<_RekeyInfo> = I.Record({
  rekeyParticipants: I.List(),
  youCanRekey: false,
})

export type LocalMessageState = {
  previewProgress: number | null /* between 0 - 1 */,
  downloadProgress: number | null /* between 0 - 1 */,
  uploadProgress: number | null /* between 0 - 1 */,
  previewPath: ?string,
  downloadedPath: ?string,
  savedPath: string | null | false,
}

export type UntrustedState = 'unloaded' | 'loaded' | 'loading'

export type UnreadCounts = {
  total: number,
  badged: number,
}

type _State = {
  alwaysShow: I.Set<ConversationIDKey>,
  channelCreationError: string,
  conversationStates: I.Map<ConversationIDKey, ConversationState>,
  conversationUnreadCounts: I.Map<ConversationIDKey, UnreadCounts>,
  editingMessage: ?Message,
  finalizedState: FinalizedState,
  inSearch: boolean,
  inbox: I.Map<ConversationIDKey, InboxState>,
  inboxAlwaysShow: I.Map<ConversationIDKey, boolean>,
  inboxBigChannels: I.Map<ConversationIDKey, string>,
  inboxBigChannelsToTeam: I.Map<ConversationIDKey, string>,
  inboxFilter: string,
  inboxIsEmpty: I.Map<ConversationIDKey, boolean>,
  inboxSearch: I.List<string>,
  inboxSmallTimestamps: I.Map<ConversationIDKey, number>,
  inboxSnippet: I.Map<ConversationIDKey, ?HiddenString>,
  inboxSupersededBy: I.Map<ConversationIDKey, boolean>,
  inboxUnreadCountBadge: I.Map<ConversationIDKey, number>,
  inboxUnreadCountTotal: I.Map<ConversationIDKey, number>,
  inboxUntrustedState: I.Map<ConversationIDKey, InboxUntrustedState>,
  inboxGlobalUntrustedState: UntrustedState,
  inboxVersion: I.Map<ConversationIDKey, number>,
  initialConversation: ?ConversationIDKey,
  localMessageStates: I.Map<MessageKey, LocalMessageState>,
  messageMap: I.Map<MessageKey, Message>,
  metaData: MetaDataMap,
  nowOverride: ?Date,
  pendingConversations: I.Map<ConversationIDKey, Participants>,
  previousConversation: ?ConversationIDKey,
  rekeyInfos: I.Map<ConversationIDKey, RekeyInfo>,
  searchPending: boolean,
  searchResultTerm: string,
  searchResults: ?I.List<SearchConstants.SearchResultId>,
  searchShowingSuggestions: boolean,
  selectedUsersInSearch: I.List<SearchConstants.SearchResultId>,
  supersededByState: SupersededByState,
  supersedesState: SupersedesState,
  teamCreationError: string,
  teamCreationPending: boolean,
  teamJoinError: string,
  teamJoinSuccess: boolean,
  tempPendingConversations: I.Map<ConversationIDKey, boolean>,
}

export type State = I.RecordOf<_State>
export const makeState: I.RecordFactory<_State> = I.Record({
  alwaysShow: I.Set(),
  channelCreationError: '',
  conversationStates: I.Map(),
  conversationUnreadCounts: I.Map(),
  editingMessage: null,
  finalizedState: I.Map(),
  inSearch: false,
  inbox: I.Map(),
  inboxAlwaysShow: I.Map(),
  inboxBigChannels: I.Map(),
  inboxBigChannelsToTeam: I.Map(),
  inboxFilter: '',
  inboxIsEmpty: I.Map(),
  inboxSearch: I.List(),
  inboxSmallTimestamps: I.Map(),
  inboxSnippet: I.Map(),
  inboxSupersededBy: I.Map(),
  inboxUnreadCountBadge: I.Map(),
  inboxUnreadCountTotal: I.Map(),
  inboxGlobalUntrustedState: 'unloaded',
  inboxUntrustedState: I.Map(),
  inboxVersion: I.Map(),
  initialConversation: null,
  localMessageStates: I.Map(),
  messageMap: I.Map(),
  metaData: I.Map(),
  nowOverride: null,
  pendingConversations: I.Map(),
  previousConversation: null,
  rekeyInfos: I.Map(),
  searchPending: false,
  searchResultTerm: '',
  searchResults: null,
  searchShowingSuggestions: false,
  selectedUsersInSearch: I.List(),
  supersededByState: I.Map(),
  supersedesState: I.Map(),
  teamCreationError: '',
  teamCreationPending: false,
  teamJoinError: '',
  teamJoinSuccess: false,
  tempPendingConversations: I.Map(),
})

export const maxAttachmentPreviewSize = 320

export const howLongBetweenTimestampsMs = 1000 * 60 * 15
export const maxMessagesToLoadAtATime = 50

export const nothingSelected = 'chat:noneSelected'
export const blankChat = 'chat:blankChat'

function conversationIDToKey(conversationID: ConversationID): ConversationIDKey {
  return conversationID.toString('hex')
}

function keyToConversationID(key: ConversationIDKey): ConversationID {
  return Buffer.from(key, 'hex')
}

const _outboxPrefix = 'OUTBOXID-'
const _outboxPrefixReg = new RegExp('^' + _outboxPrefix)
function outboxIDToKey(outboxID: OutboxID): OutboxIDKey {
  return `${_outboxPrefix}${outboxID.toString('hex')}`
}

function keyToOutboxID(key: OutboxIDKey): OutboxID {
  return Buffer.from(key.substring(_outboxPrefix.length), 'hex')
}

const _messageIDPrefix = 'MSGID-'
const _messageIDPrefixReg = new RegExp('^' + _messageIDPrefix)
function rpcMessageIDToMessageID(rpcMessageID: ChatTypes.MessageID): MessageID {
  return `${_messageIDPrefix}${rpcMessageID.toString(16)}`
}

function messageIDToRpcMessageID(msgID: MessageID): ChatTypes.MessageID {
  return parseInt(msgID.substring(_messageIDPrefix.length), 16)
}

const _selfInventedID = 'SELFINVENTED-'
const _selfInventedIDReg = new RegExp('^' + _selfInventedID)
function selfInventedIDToMessageID(selfInventedID: number /* < 0 */) {
  return `${_selfInventedID}${selfInventedID.toString(16)}`
}

function messageIDToSelfInventedID(msgID: MessageID) {
  return parseInt(msgID.substring(_selfInventedID.length), 16)
}

export type ParsedMessageID =
  | {
      type: 'rpcMessageID',
      msgID: ChatTypes.MessageID,
    }
  | {
      type: 'outboxID',
      msgID: OutboxID,
    }
  | {
      type: 'selfInventedID',
      msgID: number,
    }
  | {
      type: 'invalid',
      msgID: number,
    }

function parseMessageID(msgID: MessageID): ParsedMessageID {
  if (msgID.match(_messageIDPrefixReg)) {
    return {
      msgID: messageIDToRpcMessageID(msgID),
      type: 'rpcMessageID',
    }
  } else if (msgID.match(_outboxPrefixReg)) {
    return {
      msgID: keyToOutboxID(msgID),
      type: 'outboxID',
    }
  } else if (msgID.match(_selfInventedIDReg)) {
    return {
      msgID: messageIDToSelfInventedID(msgID),
      type: 'selfInventedID',
    }
  }

  console.error('msgID was not valid', msgID)
  return {
    msgID: -1,
    type: 'invalid',
  }
}

function makeSnippet(messageBody: ?string): ?string {
  return textSnippet(messageBody || '', 100)
}

function makeTeamTitle(messageBody: ?ChatTypes.MessageBody): ?string {
  if (!messageBody) {
    return null
  }
  switch (messageBody.messageType) {
    case ChatTypes.commonMessageType.metadata:
      return messageBody.metadata ? `#${messageBody.metadata.conversationTitle}` : '<none>'
    default:
      return null
  }
}

// This is emoji aware hence all the weird ... stuff. See https://mathiasbynens.be/notes/javascript-unicode#iterating-over-symbols
function textSnippet(message: ?string = '', max: number) {
  // $FlowIssue flow doesn't understand spread + strings
  return [...message.substring(0, max * 4).replace(/\s+/g, ' ')].slice(0, max).join('')
}

// Filters out myself from most of our views of the list, unless the list is just me
function participantFilter(participants: I.List<string>, you: string): I.List<string> {
  const withoutYou = participants.filter(p => p !== you)
  if (withoutYou.count() === 0) {
    return participants
  }
  return withoutYou
}

function serverMessageToMessageText(message: ServerMessage): ?string {
  switch (message.type) {
    case 'Text':
      return message.message.stringValue()
    default:
      return null
  }
}

function usernamesToUserListItem(
  usernames: Array<string>,
  you: string,
  metaDataMap: MetaDataMap,
  followingMap: FollowingMap
): Array<UserListItem> {
  return usernames.map(username => ({
    username,
    broken: metaDataMap.getIn([username, 'brokenTracker'], false),
    you: username === you,
    following: !!followingMap[username],
  }))
}

function getBrokenUsers(participants: Array<string>, you: string, metaDataMap: MetaDataMap): Array<string> {
  return participants.filter(user => user !== you && metaDataMap.getIn([user, 'brokenTracker'], false))
}

function clampAttachmentPreviewSize({width, height}: AttachmentSize) {
  if (height > width) {
    return {
      height: clamp(height || 0, 0, maxAttachmentPreviewSize),
      width: clamp(height || 0, 0, maxAttachmentPreviewSize) * width / (height || 1),
    }
  } else {
    return {
      height: clamp(width || 0, 0, maxAttachmentPreviewSize) * height / (width || 1),
      width: clamp(width || 0, 0, maxAttachmentPreviewSize),
    }
  }
}

function parseMetadataPreviewSize(metadata: ChatTypes.AssetMetadata): ?AttachmentSize {
  if (metadata.assetType === ChatTypes.localAssetMetadataType.image && metadata.image) {
    return clampAttachmentPreviewSize(metadata.image)
  } else if (metadata.assetType === ChatTypes.localAssetMetadataType.video && metadata.video) {
    return clampAttachmentPreviewSize(metadata.video)
  }
}

function getAssetDuration(assetMetadata: ?ChatTypes.AssetMetadata): ?number {
  const assetIsVideo = assetMetadata && assetMetadata.assetType === ChatTypes.localAssetMetadataType.video
  if (assetIsVideo) {
    const assetVideoMetadata =
      assetMetadata &&
      assetMetadata.assetType === ChatTypes.localAssetMetadataType.video &&
      assetMetadata.video
    return assetVideoMetadata ? assetVideoMetadata.durationMs : null
  }
  return null
}

function getAttachmentInfo(preview: ?(ChatTypes.Asset | ChatTypes.MakePreviewRes), object: ?ChatTypes.Asset) {
  const filename = object && object.filename
  const title = object && object.title

  const mimeType = preview && preview.mimeType
  const previewType = mimeType && mimeType.indexOf('image') === 0 ? 'Image' : 'Other'

  const previewMetadata = preview && preview.metadata
  const previewSize = previewMetadata && parseMetadataPreviewSize(previewMetadata)
  const previewDurationMs = getAssetDuration(previewMetadata)

  const objectMetadata = object && object.metadata
  const attachmentDurationMs = getAssetDuration(objectMetadata)

  return {
    attachmentDurationMs,
    filename,
    title,
    previewDurationMs,
    previewSize,
    previewType,
  }
}

function pendingConversationIDKey(tlfName: string) {
  return `__PendingConversation__${tlfName}`
}

function isPendingConversationIDKey(conversationIDKey: string) {
  return conversationIDKey.startsWith('__PendingConversation__')
}

function pendingConversationIDKeyToTlfName(conversationIDKey: string) {
  if (isPendingConversationIDKey(conversationIDKey)) {
    return conversationIDKey.substring('__PendingConversation__'.length)
  }

  return null
}

function convSupersedesInfo(conversationID: ConversationIDKey, chat: State): ?SupersedeInfo {
  return chat.getIn(['supersedesState', conversationID])
}

function convSupersededByInfo(conversationID: ConversationIDKey, chat: State): ?SupersedeInfo {
  return chat.getIn(['supersededByState', conversationID])
}

function newestConversationIDKey(conversationIDKey: ?ConversationIDKey, chat: State): ?ConversationIDKey {
  const supersededBy = conversationIDKey ? chat.getIn(['supersededByState', conversationIDKey]) : null
  if (!supersededBy) {
    return conversationIDKey
  }

  return newestConversationIDKey(supersededBy.conversationIDKey, chat)
}

const getSelectedConversation = (state: TypedState) => {
  const chatPath = getPath(state.routeTree.routeState, [chatTab])
  if (chatPath.get(0) !== chatTab) {
    return null
  }
  const selected = chatPath.get(1)
  if (selected === nothingSelected) {
    return null
  }
  return selected
}

const getSelectedRouteState = (state: TypedState) => {
  const selected = getSelectedConversation(state)
  if (!selected) return null
  return getPathState(state.routeTree.routeState, [chatTab, selected])
}

function messageKey(conversationIDKey: ConversationIDKey, kind: MessageKeyKind, value: string): MessageKey {
  return `${conversationIDKey}:${kind}:${value}`
}

function splitMessageIDKey(
  key: MessageKey
): {
  conversationIDKey: ConversationIDKey,
  keyKind: string,
  messageID: MessageID,
} {
  const [conversationIDKey, keyKind, messageID] = key.split(':')
  return {conversationIDKey, keyKind, messageID}
}

function messageKeyValue(key: MessageKey): string {
  return key.split(':')[2]
}

function messageKeyConversationIDKey(key: MessageKey): ConversationIDKey {
  return key.split(':')[0]
}

function messageKeyKindIsMessageID(key: MessageKey): boolean {
  return messageKeyKind(key).startsWith('messageID')
}

function messageKeyKind(key: MessageKey): MessageKeyKind {
  const [, kind] = key.split(':')
  switch (kind) {
    case 'joinedleft':
      return 'joinedleft'
    case 'system':
      return 'system'
    case 'error':
      return 'error'
    case 'errorInvisible':
      return 'errorInvisible'
    case 'header':
      return 'header'
    case 'messageIDAttachment':
      return 'messageIDAttachment'
    case 'messageIDAttachmentUpdate':
      return 'messageIDAttachmentUpdate'
    case 'messageIDDeleted':
      return 'messageIDDeleted'
    case 'messageIDEdit':
      return 'messageIDEdit'
    case 'messageIDError':
      return 'messageIDError'
    case 'messageIDText':
      return 'messageIDText'
    case 'messageIDUnhandled':
      return 'messageIDUnhandled'
    case 'outboxIDText':
      return 'outboxIDText'
    case 'outboxIDAttachment':
      return 'outboxIDAttachment'
    case 'timestamp':
      return 'timestamp'
    case 'supersedes':
      return 'supersedes'
  }
  throw new Error(`Invalid messageKeyKind passed key: ${key}`)
}

const getYou = (state: TypedState) => state.config.username || ''
const getFollowingMap = (state: TypedState) => state.config.following
const getMetaDataMap = (state: TypedState) => state.chat.get('metaData')
const getInbox = (state: TypedState, conversationIDKey: ?ConversationIDKey) =>
  conversationIDKey ? state.chat.getIn(['inbox', conversationIDKey]) : null
const getSelectedInbox = (state: TypedState) => getInbox(state, getSelectedConversation(state))
const getEditingMessage = (state: TypedState) => state.chat.get('editingMessage')

const getTLF = createSelector([getSelectedInbox, getSelectedConversation], (selectedInbox, selected) => {
  if (selected && isPendingConversationIDKey(selected)) {
    return pendingConversationIDKeyToTlfName(selected) || ''
  } else if (selected !== nothingSelected && selectedInbox) {
    return selectedInbox.participants.join(',')
  }
  return ''
})

const getParticipantsWithFullNames = createSelector(
  [getSelectedInbox, getSelectedConversation],
  (selectedInbox, selected) => {
    if (selected && isPendingConversationIDKey(selected)) {
      return []
    } else if (selected !== nothingSelected && selectedInbox) {
      const s = selectedInbox
      return s.participants.map(username => {
        return {username: username, fullname: s.fullNames.get(username)}
      })
    }
    return []
  }
)

const getMuted = createSelector(
  [getSelectedInbox],
  selectedInbox => selectedInbox && selectedInbox.get('status') === 'muted'
)

const getChannelName = createSelector(
  [getSelectedInbox],
  selectedInbox => selectedInbox && selectedInbox.get('channelname')
)

const getTeamName = createSelector(
  [getSelectedInbox],
  selectedInbox => selectedInbox && selectedInbox.get('teamname')
)

const getSelectedConversationStates = (state: TypedState): ?ConversationState => {
  const selectedConversationIDKey = getSelectedConversation(state)
  return selectedConversationIDKey
    ? state.chat.getIn(['conversationStates', selectedConversationIDKey])
    : null
}

const getSupersedes = (state: TypedState): ?SupersedeInfo => {
  const selectedConversationIDKey = getSelectedConversation(state)
  return selectedConversationIDKey ? convSupersedesInfo(selectedConversationIDKey, state.chat) : null
}

const imageFileNameRegex = /[^/]+\.(jpg|png|gif|jpeg|bmp)$/
function isImageFileName(filename: string): boolean {
  return imageFileNameRegex.test(filename)
}

const getFollowingStates = (state: TypedState) => {
  const ids = SearchConstants.getUserInputItemIds(state, {searchKey: 'chatSearch'})
  let followingStateMap = {}
  ids.forEach(id => {
    const {username, serviceId} = parseUserId(id)
    const service = SearchConstants.serviceIdToService(serviceId)
    followingStateMap[id] = SearchConstants.followStateHelper(state, username, service)
  })
  return followingStateMap
}

const getUserItems = createShallowEqualSelector(
  [s => SearchConstants.getUserInputItemIds(s, {searchKey: 'chatSearch'}), getFollowingStates],
  (userInputItemIds, followingStates) =>
    userInputItemIds.map(id => {
      const {username, serviceId} = parseUserId(id)
      const service = SearchConstants.serviceIdToService(serviceId)
      return {
        id: id,
        followingState: followingStates[id],
        // $FlowIssue ??
        icon: serviceIdToIcon(serviceId),
        username,
        service,
      }
    })
)

function getConversationMessages(state: TypedState, convIDKey: ConversationIDKey): I.OrderedSet<MessageKey> {
  return state.entities.conversationMessages.get(convIDKey, I.OrderedSet())
}

function getDeletedMessageIDs(state: TypedState, convIDKey: ConversationIDKey): I.Set<MessageID> {
  return state.entities.deletedIDs.get(convIDKey, I.Set())
}

function getMessageUpdateKeys(state: TypedState, messageKey: MessageKey): I.OrderedSet<MessageKey> {
  const {conversationIDKey, messageID} = splitMessageIDKey(messageKey)
  return conversationIDKey
    ? state.entities.messageUpdates.getIn([conversationIDKey, String(messageID)], I.OrderedSet())
    : I.OrderedSet()
}

function getTextMessageUpdates(
  state: TypedState,
  messageKey: MessageKey
): {last: ?EditingMessage, count: number} {
  const updateKeys = getMessageUpdateKeys(state, messageKey)
  return updateKeys.reduce(
    (ret, k) => {
      const message = state.entities.messages.get(k)
      if (message && message.type === 'Edit') {
        return {last: message, count: ret.count + 1}
      } else {
        return ret
      }
    },
    {last: null, count: 0}
  )
}

function getAttachmentMessageUpdates(
  state: TypedState,
  messageKey: MessageKey
): {last: ?UpdatingAttachment, count: number} {
  const updateKeys = getMessageUpdateKeys(state, messageKey)
  return updateKeys.reduce(
    (ret, k) => {
      const message = state.entities.messages.get(k)
      if (message && message.type === 'UpdateAttachment') {
        return {last: message, count: ret.count + 1}
      } else {
        return ret
      }
    },
    {last: null, count: 0}
  )
}

function getMessageUpdateCount(state: TypedState, messageType: MessageType, messageKey: MessageKey): number {
  if (messageType === 'Text') {
    return getTextMessageUpdates(state, messageKey).count
  } else if (messageType === 'Attachment') {
    return getAttachmentMessageUpdates(state, messageKey).count
  } else {
    return 0
  }
}

function getMessageFromMessageKey(state: TypedState, messageKey: MessageKey): ?Message {
  const message = state.entities.messages.get(messageKey)
  if (!message) {
    return null
  }

  if (message.type === 'Text') {
    const {last} = getTextMessageUpdates(state, messageKey)
    if (last) {
      return ({
        ...message,
        message: last.message,
        mentions: last.mentions,
        channelMention: last.channelMention,
      }: TextMessage)
    }
  } else if (message.type === 'Attachment') {
    const {last} = getAttachmentMessageUpdates(state, messageKey)
    if (last) {
      return ({
        ...message,
        ...last.updates,
      }: AttachmentMessage)
    }
  }

  return message
}

// Sometimes we only have the conv id and msg id. Like when the service tells us something
function getMessageKeyFromConvKeyMessageID(
  state: TypedState,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID | OutboxIDKey // Works for outbox id too since it uses the message key
) {
  const convMsgs = getConversationMessages(state, conversationIDKey)
  return convMsgs.find(k => {
    const {messageID: mID} = splitMessageIDKey(k)
    return messageID === mID
  })
}

function getMessageFromConvKeyMessageID(
  state: TypedState,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID
): ?Message {
  const key = getMessageKeyFromConvKeyMessageID(state, conversationIDKey, messageID)
  return key ? getMessageFromMessageKey(state, key) : null
}

function lastMessageID(state: TypedState, conversationIDKey: ConversationIDKey): ?MessageID {
  const messageKeys = getConversationMessages(state, conversationIDKey)
  const lastMessageKey = messageKeys.findLast(m => {
    if (m) {
      const {type: msgIDType} = parseMessageID(messageKeyValue(m))
      return msgIDType === 'rpcMessageID'
    }
  })

  return lastMessageKey ? messageKeyValue(lastMessageKey) : null
}

const getDownloadProgress = ({entities: {attachmentDownloadProgress}}: TypedState, messageKey: MessageKey) =>
  attachmentDownloadProgress.get(messageKey, null)

const getUploadProgress = ({entities: {attachmentUploadProgress}}: TypedState, messageKey: MessageKey) =>
  attachmentUploadProgress.get(messageKey, null)

const getPreviewProgress = ({entities: {attachmentPreviewProgress}}: TypedState, messageKey: MessageKey) =>
  attachmentPreviewProgress.get(messageKey, null)

const getAttachmentSavedPath = ({entities: {attachmentSavedPath}}: TypedState, messageKey: MessageKey) =>
  attachmentSavedPath.get(messageKey, null)

const getAttachmentDownloadedPath = (
  {entities: {attachmentDownloadedPath}}: TypedState,
  messageKey: MessageKey
) => attachmentDownloadedPath.get(messageKey, null)

const getAttachmentPreviewPath = ({entities: {attachmentPreviewPath}}: TypedState, messageKey: MessageKey) =>
  attachmentPreviewPath.get(messageKey, null)

const getLocalMessageStateFromMessageKey = createSelector(
  [
    getDownloadProgress,
    getPreviewProgress,
    getUploadProgress,
    getAttachmentDownloadedPath,
    getAttachmentPreviewPath,
    getAttachmentSavedPath,
  ],
  (downloadProgress, previewProgress, uploadProgress, downloadedPath, previewPath, savedPath) => ({
    downloadProgress,
    downloadedPath,
    previewPath,
    previewProgress,
    savedPath,
    uploadProgress,
  })
)

function getSnippet(state: TypedState, conversationIDKey: ConversationIDKey): string {
  const snippet = state.chat.inboxSnippet.get(conversationIDKey, null)
  return snippet ? snippet.stringValue() : ''
}

function getPaginationNext(state: TypedState, conversationIDKey: ConversationIDKey): ?string {
  return state.entities.pagination.next.get(conversationIDKey, null)
}

function getPaginationPrev(state: TypedState, conversationIDKey: ConversationIDKey): ?string {
  return state.entities.pagination.prev.get(conversationIDKey, null)
}

export {
  getBrokenUsers,
  getConversationMessages,
  getDeletedMessageIDs,
  getChannelName,
  getEditingMessage,
  getInbox,
  getMessageFromMessageKey,
  getMessageUpdateCount,
  getSelectedConversation,
  getSelectedConversationStates,
  getSupersedes,
  getAttachmentDownloadedPath,
  getAttachmentPreviewPath,
  getAttachmentSavedPath,
  getDownloadProgress,
  getPaginationNext,
  getPaginationPrev,
  getPreviewProgress,
  getUploadProgress,
  getSnippet,
  getTeamName,
  conversationIDToKey,
  convSupersedesInfo,
  convSupersededByInfo,
  keyToConversationID,
  keyToOutboxID,
  makeSnippet,
  makeTeamTitle,
  messageKey,
  messageKeyKind,
  messageKeyKindIsMessageID,
  messageKeyValue,
  messageKeyConversationIDKey,
  splitMessageIDKey,
  outboxIDToKey,
  participantFilter,
  serverMessageToMessageText,
  usernamesToUserListItem,
  clampAttachmentPreviewSize,
  newestConversationIDKey,
  parseMetadataPreviewSize,
  pendingConversationIDKey,
  isPendingConversationIDKey,
  pendingConversationIDKeyToTlfName,
  getAttachmentInfo,
  getSelectedRouteState,
  getYou,
  getFollowingMap,
  getMetaDataMap,
  getParticipantsWithFullNames,
  getSelectedInbox,
  getTLF,
  getMuted,
  getUserItems,
  getLocalMessageStateFromMessageKey,
  getMessageFromConvKeyMessageID,
  isImageFileName,
  rpcMessageIDToMessageID,
  messageIDToRpcMessageID,
  selfInventedIDToMessageID,
  messageIDToSelfInventedID,
  parseMessageID,
  lastMessageID,
}
