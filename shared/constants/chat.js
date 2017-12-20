// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as RPCChatTypes from './types/flow-types-chat'
import * as Types from './types/chat'
import * as RPCTypes from './types/flow-types'
import clamp from 'lodash/clamp'
import invert from 'lodash/invert'
import {Buffer} from 'buffer'
import {chatTab} from './tabs'
import {createSelector} from 'reselect'
import {getPath, getPathState} from '../route-tree'
import type {TypedState} from './reducer'
import type {UserListItem} from '../common-adapters/usernames'

export const messageStates: Array<Types.MessageState> = ['pending', 'failed', 'sent']

export function textMessageEditable(message: Types.TextMessage): boolean {
  // For now, disallow editing of non-sent messages. In the future, we
  // may want to do something more intelligent.
  return message.messageState === 'sent'
}

export const ConversationStatusByEnum = invert(RPCChatTypes.commonConversationStatus)
export const makeConversationState: I.RecordFactory<Types._ConversationState> = I.Record({
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

export const ConversationBadgeStateRecord: I.RecordFactory<Types._ConversationBadgeState> = I.Record({
  convID: undefined,
  unreadMessages: 0,
  badgeCounts: {},
})

export const makeInboxState: I.RecordFactory<Types._InboxState> = I.Record({
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
  teamType: RPCChatTypes.commonTeamType.none,
  version: 0,
})

export const makeMetaData: I.RecordFactory<Types._MetaData> = I.Record({
  fullname: 'Unknown',
  brokenTracker: false,
})

export const makeRekeyInfo: I.RecordFactory<Types._RekeyInfo> = I.Record({
  rekeyParticipants: I.List(),
  youCanRekey: false,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
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
  // inboxSnippet: I.Map(),
  inboxSupersededBy: I.Map(),
  inboxUnreadCountBadge: I.Map(),
  inboxUnreadCountTotal: I.Map(),
  inboxGlobalUntrustedState: 'unloaded',
  inboxSyncingState: 'notSyncing',
  inboxUntrustedState: I.Map(),
  inboxResetParticipants: I.Map(),
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
  teamJoinSuccessTeamName: null,
  tempPendingConversations: I.Map(),
})

const maxAttachmentPreviewSize = 320
export const howLongBetweenTimestampsMs = 1000 * 60 * 15
export const maxMessagesToLoadAtATime = 50
export const nothingSelected = 'chat:noneSelected'

function conversationIDToKey(conversationID: Types.ConversationID): Types.ConversationIDKey {
  return conversationID.toString('hex')
}

function keyToConversationID(key: Types.ConversationIDKey): Types.ConversationID {
  return Buffer.from(key, 'hex')
}

const _outboxPrefix = 'OUTBOXID-'
const _outboxPrefixReg = new RegExp('^' + _outboxPrefix)
function outboxIDToKey(outboxID: Types.OutboxID): Types.OutboxIDKey {
  return `${_outboxPrefix}${outboxID.toString('hex')}`
}

function keyToOutboxID(key: Types.OutboxIDKey): Types.OutboxID {
  return Buffer.from(key.substring(_outboxPrefix.length), 'hex')
}

function stringOutboxIDToKey(outboxID: string): Types.OutboxIDKey {
  return `${_outboxPrefix}${outboxID}`
}

const _messageIDPrefix = 'MSGID-'
const _messageIDPrefixReg = new RegExp('^' + _messageIDPrefix)
function rpcMessageIDToMessageID(rpcMessageID: RPCChatTypes.MessageID): Types.MessageID {
  return `${_messageIDPrefix}${rpcMessageID.toString(16)}`
}

function messageIDToRpcMessageID(msgID: Types.MessageID): RPCChatTypes.MessageID {
  return parseInt(msgID.substring(_messageIDPrefix.length), 16)
}

const _selfInventedID = 'SELFINVENTED-'
const _selfInventedIDReg = new RegExp('^' + _selfInventedID)
function selfInventedIDToMessageID(selfInventedID: number /* < 0 */) {
  return `${_selfInventedID}${selfInventedID.toString(16)}`
}

function messageIDToSelfInventedID(msgID: Types.MessageID) {
  return parseInt(msgID.substring(_selfInventedID.length), 16)
}

function parseMessageID(msgID: Types.MessageID): Types.ParsedMessageID {
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

  logger.error('msgID was not valid', msgID)
  return {
    msgID: -1,
    type: 'invalid',
  }
}

function makeSnippet(messageBody: ?string): ?string {
  return textSnippet(messageBody || '', 100)
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

function serverMessageToMessageText(message: Types.ServerMessage): ?string {
  switch (message.type) {
    case 'Text':
      return message.message.stringValue()
    case 'System':
      return message.message.stringValue()
    default:
      return null
  }
}

function usernamesToUserListItem(
  usernames: Array<string>,
  you: string,
  metaDataMap: Types.MetaDataMap,
  followingMap: Types.FollowingMap
): Array<UserListItem> {
  return usernames.map(username => ({
    username,
    broken: metaDataMap.getIn([username, 'brokenTracker'], false),
    you: username === you,
    following: !!followingMap[username],
  }))
}

function getBrokenUsers(
  participants: Array<string>,
  you: string,
  metaDataMap: Types.MetaDataMap
): Array<string> {
  return participants.filter(user => user !== you && metaDataMap.getIn([user, 'brokenTracker'], false))
}

function clampAttachmentPreviewSize({width, height}: Types.AttachmentSize) {
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

function parseMetadataPreviewSize(metadata: RPCChatTypes.AssetMetadata): ?Types.AttachmentSize {
  if (metadata.assetType === RPCChatTypes.localAssetMetadataType.image && metadata.image) {
    return clampAttachmentPreviewSize(metadata.image)
  } else if (metadata.assetType === RPCChatTypes.localAssetMetadataType.video && metadata.video) {
    return clampAttachmentPreviewSize(metadata.video)
  }
}

function getAssetDuration(assetMetadata: ?RPCChatTypes.AssetMetadata): ?number {
  const assetIsVideo = assetMetadata && assetMetadata.assetType === RPCChatTypes.localAssetMetadataType.video
  if (assetIsVideo) {
    const assetVideoMetadata =
      assetMetadata &&
      assetMetadata.assetType === RPCChatTypes.localAssetMetadataType.video &&
      assetMetadata.video
    return assetVideoMetadata ? assetVideoMetadata.durationMs : null
  }
  return null
}

function getAttachmentInfo(
  preview: ?(RPCChatTypes.Asset | RPCChatTypes.MakePreviewRes),
  object: ?RPCChatTypes.Asset
) {
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

function isResetConversationIDKey(state: TypedState, conversationIDKey: string) {
  const inbox = state.chat.getIn(['inbox', conversationIDKey])
  return inbox ? inbox.memberStatus === RPCChatTypes.commonConversationMemberStatus.reset : false
}

function pendingConversationIDKeyToTlfName(conversationIDKey: string): ?string {
  if (isPendingConversationIDKey(conversationIDKey)) {
    return conversationIDKey.substring('__PendingConversation__'.length)
  }

  return null
}

function convSupersedesInfo(
  conversationID: Types.ConversationIDKey,
  chat: Types.State
): ?Types.SupersedeInfo {
  return chat.getIn(['supersedesState', conversationID])
}

function convSupersededByInfo(
  conversationID: Types.ConversationIDKey,
  chat: Types.State
): ?Types.SupersedeInfo {
  return chat.getIn(['supersededByState', conversationID])
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

function messageKey(
  conversationIDKey: Types.ConversationIDKey,
  kind: Types.MessageKeyKind,
  value: string
): Types.MessageKey {
  return `${conversationIDKey}:${kind}:${value}`
}

function splitMessageIDKey(
  key: Types.MessageKey
): {
  conversationIDKey: Types.ConversationIDKey,
  keyKind: string,
  messageID: Types.MessageID,
} {
  const [conversationIDKey, keyKind, messageID] = key.split(':')
  return {conversationIDKey, keyKind, messageID}
}

function messageKeyValue(key: Types.MessageKey): string {
  return key.split(':')[2]
}

function messageKeyConversationIDKey(key: Types.MessageKey): Types.ConversationIDKey {
  return key.split(':')[0]
}

function messageKeyKindIsMessageID(key: Types.MessageKey): boolean {
  return messageKeyKind(key).startsWith('messageID')
}

function messageKeyKind(key: Types.MessageKey): Types.MessageKeyKind {
  const [, kind] = key.split(':')
  switch (kind) {
    case 'resetUser':
      return 'resetUser'
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

// TODO(mm) type these properly - they return any
const getYou = (state: TypedState) => state.config.username || ''
const getFollowingMap = (state: TypedState) => state.config.following
const getMetaDataMap = (state: TypedState) => state.chat.get('metaData')
const getInbox = (state: TypedState, conversationIDKey: ?Types.ConversationIDKey) =>
  conversationIDKey ? state.chat.getIn(['inbox', conversationIDKey]) : null
const getFullInbox = (state: TypedState) => state.chat.inbox
const getSelectedInbox = (state: TypedState) => getInbox(state, getSelectedConversation(state))
const getEditingMessage = (state: TypedState) => state.chat.get('editingMessage')

const getParticipants = createSelector(
  [getSelectedInbox, getSelectedConversation],
  (selectedInbox, selectedConversation) => {
    if (selectedConversation && isPendingConversationIDKey(selectedConversation)) {
      let tlfName = pendingConversationIDKeyToTlfName(selectedConversation)
      return (tlfName && tlfName.split(',')) || []
    } else if (selectedConversation !== nothingSelected && selectedInbox) {
      return selectedInbox.participants.toArray()
    }
    return []
  }
)

// TOOD(mm) - are these selectors useful? or will they just cache thrash?
const getParticipantsWithFullNames = createSelector(
  [getSelectedInbox, getSelectedConversation],
  (selectedInbox, selected) => {
    if (selected && isPendingConversationIDKey(selected)) {
      return []
    } else if (selected !== nothingSelected && selectedInbox) {
      const s = selectedInbox
      return s.participants
        .map(username => {
          return {username: username, fullname: s.fullNames.get(username)}
        })
        .toArray()
    }
    return []
  }
)

const getGeneralChannelOfSelectedInbox = createSelector(
  [getSelectedInbox, getFullInbox],
  (selectedInbox, inbox) => {
    if (!selectedInbox || selectedInbox.membersType !== RPCChatTypes.commonConversationMembersType.team) {
      return selectedInbox
    }
    const teamName = selectedInbox.teamname
    return inbox.find(value => value.teamname === teamName && value.channelname === 'general')
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

const getTeamType = createSelector(
  [getSelectedInbox],
  selectedInbox => selectedInbox && selectedInbox.get('teamType')
)

const getSelectedConversationStates = (state: TypedState): ?Types.ConversationState => {
  const selectedConversationIDKey = getSelectedConversation(state)
  return selectedConversationIDKey
    ? state.chat.getIn(['conversationStates', selectedConversationIDKey])
    : null
}

const getSupersedes = (state: TypedState): ?Types.SupersedeInfo => {
  const selectedConversationIDKey = getSelectedConversation(state)
  return selectedConversationIDKey ? convSupersedesInfo(selectedConversationIDKey, state.chat) : null
}

const imageFileNameRegex = /[^/]+\.(jpg|png|gif|jpeg|bmp)$/
function isImageFileName(filename: string): boolean {
  return imageFileNameRegex.test(filename)
}

function emptyConversationMessages(): Types.ConversationMessages {
  return makeConversationMessages({high: -1, low: -1, messages: I.List()})
}

function getConversationMessages(
  state: TypedState,
  convIDKey: Types.ConversationIDKey
): Types.ConversationMessages {
  return state.entities.conversationMessages.get(convIDKey, emptyConversationMessages())
}

function getDeletedMessageIDs(state: TypedState, convIDKey: Types.ConversationIDKey): I.Set<Types.MessageID> {
  return state.entities.deletedIDs.get(convIDKey, I.Set())
}

function getMessageUpdateKeys(
  state: TypedState,
  messageKey: Types.MessageKey
): I.OrderedSet<Types.MessageKey> {
  const {conversationIDKey, messageID} = splitMessageIDKey(messageKey)
  return conversationIDKey
    ? state.entities.messageUpdates.getIn([conversationIDKey, String(messageID)], I.OrderedSet())
    : I.OrderedSet()
}

function getTextMessageUpdates(
  state: TypedState,
  messageKey: Types.MessageKey
): {last: ?Types.EditingMessage, count: number} {
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
  messageKey: Types.MessageKey
): {last: ?Types.UpdatingAttachment, count: number} {
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

function getMessageUpdateCount(
  state: TypedState,
  messageType: Types.MessageType,
  messageKey: Types.MessageKey
): number {
  if (messageType === 'Text') {
    return getTextMessageUpdates(state, messageKey).count
  } else if (messageType === 'Attachment') {
    return getAttachmentMessageUpdates(state, messageKey).count
  } else {
    return 0
  }
}

function getMessageFromMessageKey(state: TypedState, messageKey: Types.MessageKey): ?Types.Message {
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
      }: Types.TextMessage)
    }
  } else if (message.type === 'Attachment') {
    const {last} = getAttachmentMessageUpdates(state, messageKey)
    if (last) {
      return ({
        ...message,
        ...last.updates,
      }: Types.AttachmentMessage)
    }
  }

  return message
}

// Sometimes we only have the conv id and msg id. Like when the service tells us something
function getMessageKeyFromConvKeyMessageID(
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey,
  messageID: Types.MessageID | Types.OutboxIDKey // Works for outbox id too since it uses the message key
) {
  const convMsgs = getConversationMessages(state, conversationIDKey)
  const messageKeys = convMsgs.messages
  return messageKeys.find(k => {
    const {messageID: mID} = splitMessageIDKey(k)
    return messageID === mID
  })
}

function getMessageFromConvKeyMessageID(
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey,
  messageID: Types.MessageID
): ?Types.Message {
  const key = getMessageKeyFromConvKeyMessageID(state, conversationIDKey, messageID)
  return key ? getMessageFromMessageKey(state, key) : null
}

function lastMessageID(state: TypedState, conversationIDKey: Types.ConversationIDKey): ?Types.MessageID {
  const convMsgs = getConversationMessages(state, conversationIDKey)
  const messageKeys = convMsgs.messages
  const lastMessageKey = messageKeys.findLast(m => {
    if (m) {
      const {type: msgIDType} = parseMessageID(messageKeyValue(m))
      return msgIDType === 'rpcMessageID'
    }
  })

  return lastMessageKey ? messageKeyValue(lastMessageKey) : null
}

function lastOrdinal(state: TypedState, conversationIDKey: Types.ConversationIDKey): number {
  const convMsgs = getConversationMessages(state, conversationIDKey)
  return convMsgs.high
}

function nextFractionalOrdinal(ord: number): number {
  // Mimic what the service does with outbox items
  return ord + 0.001
}

const getDownloadProgress = (
  {entities: {attachmentDownloadProgress}}: TypedState,
  messageKey: Types.MessageKey
) => attachmentDownloadProgress.get(messageKey, null)

const getUploadProgress = (
  {entities: {attachmentUploadProgress}}: TypedState,
  messageKey: Types.MessageKey
) => attachmentUploadProgress.get(messageKey, null)

const getPreviewProgress = (
  {entities: {attachmentPreviewProgress}}: TypedState,
  messageKey: Types.MessageKey
) => attachmentPreviewProgress.get(messageKey, null)

const getAttachmentSavedPath = (
  {entities: {attachmentSavedPath}}: TypedState,
  messageKey: Types.MessageKey
) => attachmentSavedPath.get(messageKey, null)

const getAttachmentDownloadedPath = (
  {entities: {attachmentDownloadedPath}}: TypedState,
  messageKey: Types.MessageKey
) => attachmentDownloadedPath.get(messageKey, null)

const getAttachmentPreviewPath = (
  {entities: {attachmentPreviewPath}}: TypedState,
  messageKey: Types.MessageKey
) => attachmentPreviewPath.get(messageKey, null)

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

function getSnippet(state: TypedState, conversationIDKey: Types.ConversationIDKey): string {
  const messages = state.chat2.messageIDsList.get(conversationIDKey, I.List())
  const snippetTypes = ['Attachment', 'Text', 'System']
  // TODO map id to type and pull out msg
  return 'TODO'
  // const message = messages.findLast(m => snippetTypes.includes(m.type))

  // return message ? message.message.stringValue() : ''
  // const snippet = state.chat.inboxSnippet.get(conversationIDKey, null)
  // return snippet ? snippet.stringValue() : ''
}

const makeConversationMessages = I.Record({
  high: 0,
  low: 0,
  messages: I.List(),
})

const inviteCategoryEnumToName = invert(RPCTypes.teamsTeamInviteCategory)

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
  getAttachmentSavedPath,
  getSnippet,
  getTeamName,
  getTeamType,
  conversationIDToKey,
  convSupersedesInfo,
  convSupersededByInfo,
  keyToConversationID,
  keyToOutboxID,
  makeConversationMessages,
  makeSnippet,
  messageKey,
  messageKeyKind,
  messageKeyKindIsMessageID,
  messageKeyValue,
  messageKeyConversationIDKey,
  splitMessageIDKey,
  outboxIDToKey,
  stringOutboxIDToKey,
  participantFilter,
  serverMessageToMessageText,
  usernamesToUserListItem,
  pendingConversationIDKey,
  isPendingConversationIDKey,
  isResetConversationIDKey,
  pendingConversationIDKeyToTlfName,
  getAttachmentInfo,
  getSelectedRouteState,
  getYou,
  getFollowingMap,
  getMetaDataMap,
  getParticipants,
  getParticipantsWithFullNames,
  getSelectedInbox,
  getMuted,
  getLocalMessageStateFromMessageKey,
  getMessageFromConvKeyMessageID,
  isImageFileName,
  rpcMessageIDToMessageID,
  messageIDToRpcMessageID,
  selfInventedIDToMessageID,
  parseMessageID,
  lastMessageID,
  getGeneralChannelOfSelectedInbox,
  lastOrdinal,
  nextFractionalOrdinal,
  emptyConversationMessages,
  inviteCategoryEnumToName,
}
