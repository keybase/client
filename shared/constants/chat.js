// @flow
import HiddenString from '../util/hidden-string'
import {Buffer} from 'buffer'
import {Set, List, Map, Record} from 'immutable'
import {clamp, invert} from 'lodash'
import * as ChatTypes from './types/flow-types-chat'
import {getPath, getPathState} from '../route-tree'
import {chatTab} from './tabs'
import {createSelector} from 'reselect'

import type {UserListItem} from '../common-adapters/usernames'
import type {Path} from '../route-tree'
import type {NoErrorTypedAction, TypedAction} from './types/flux'
import type {AssetMetadata, ChatActivity, ConversationInfoLocal, ConversationFinalizeInfo, MessageBody, MessageID as RPCMessageID, OutboxID as RPCOutboxID, ConversationID as RPCConversationID} from './types/flow-types-chat'
import type {DeviceType} from './types/more'
import type {TypedState} from './reducer'

type MessageKey = string
type MessageKeyKind = 'messageID' | 'outboxID' | 'tempAttachment' | 'timestamp' | 'error'

export type MessageType = 'Text'
export type FollowingMap = {[key: string]: boolean}

export type MessageState = 'pending' | 'failed' | 'sent'
export const messageStates: Array<MessageState> = ['pending', 'failed', 'sent']

export type AttachmentMessageState = MessageState | 'placeholder' | 'downloading-preview' | 'downloading' | 'uploading' | 'downloaded'
export type AttachmentType = 'Image' | 'Video' | 'Other'

export type ConversationID = RPCConversationID
export type ConversationIDKey = string

export type OutboxID = RPCOutboxID
export type OutboxIDKey = string

export type MessageID = RPCMessageID

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
  failureDescription: ?string,
  outboxID?: ?OutboxIDKey,
  senderDeviceRevokedAt: ?number,
  key: MessageKey,
  editedCount: number, // increase as we edit it
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
  filename: ?string,
  title: ?string,
  attachmentDurationMs: ?number,
  previewType: ?AttachmentType,
  previewPath: ?string,
  previewSize: ?AttachmentSize,
  previewDurationMs: ?number,
  hdPreviewPath: ?string,
  downloadedPath: ?string,
  outboxID?: OutboxIDKey,
  progress?: number, /* between 0 - 1 */
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
}

export type UpdatingAttachment = {
  type: 'UpdateAttachment',
  key: MessageKey,
  messageID: MessageID,
  targetMessageID: MessageID,
  timestamp: number,
  updates: {
    filename: ?string,
    messageState: 'sent',
    previewType: ?AttachmentType,
    previewSize: ?AttachmentSize,
    title: ?string,
  },
}

export type ClientMessage = TimestampMessage | SupersedesMessage | LoadingMoreMessage | ChatSecuredHeaderMessage
export type ServerMessage = TextMessage | ErrorMessage | AttachmentMessage | DeletedMessage | UnhandledMessage | EditingMessage | UpdatingAttachment | InvisibleErrorMessage

export type Message = ClientMessage | ServerMessage

export type MaybeTimestamp = TimestampMessage | null

export const ConversationStatusByEnum = invert(ChatTypes.CommonConversationStatus)

export const ConversationStateRecord = Record({
  messages: List(),
  seenMessages: Set(),
  moreToLoad: true,
  isLoaded: false,
  isRequesting: false,
  isStale: false,
  loadedOffline: false,
  paginationNext: undefined,
  paginationPrevious: undefined,
  firstNewMessageID: undefined,
  deletedIDs: Set(),
})

export type ConversationState = Record<{
  messages: List<Message>,
  seenMessages: Set<MessageID>,
  moreToLoad: boolean,
  isRequesting: boolean,
  isStale: boolean,
  loadedOffline: boolean,
  paginationNext: ?Buffer,
  paginationPrevious: ?Buffer,
  firstNewMessageID: ?MessageID,
  deletedIDs: Set<MessageID>,
}>

export type ConversationBadgeState = Record<{
  convID: ConversationID,
  UnreadMessages: number,
}>

export const ConversationBadgeStateRecord = Record({
  convID: undefined,
  UnreadMessages: 0,
})

export type ConversationStateEnum = $Keys<typeof ChatTypes.CommonConversationStatus>

export const InboxStateRecord = Record({
  conversationIDKey: '',
  info: null,
  isEmpty: false,
  participants: List(),
  snippet: '',
  snippetKey: null,
  state: 'untrusted',
  status: 'unfiled',
  time: 0,
})

export type InboxState = Record<{
  conversationIDKey: ConversationIDKey,
  info: ConversationInfoLocal,
  isEmpty: boolean,
  participants: List<string>,
  snippet: string,
  snippetKey: any,
  state: 'untrusted' | 'unboxed' | 'error' | 'unboxing',
  status: ConversationStateEnum,
  time: number,
}>

export type SupersedeInfo = {
  conversationIDKey: ConversationID,
  finalizeInfo: ConversationFinalizeInfo,
}

export type FinalizeInfo = ConversationFinalizeInfo

export type FinalizedState = Map<ConversationIDKey, ConversationFinalizeInfo>

export type SupersedesState = Map<ConversationIDKey, SupersedeInfo>
export type SupersededByState = Map<ConversationIDKey, SupersedeInfo>

export type MetaData = Record<{
  fullname: string,
  brokenTracker: boolean,
}>

export type MetaDataMap = Map<string, MetaData>

export const MetaDataRecord = Record({
  fullname: 'Unknown',
  brokenTracker: false,
})

export type Participants = List<string>

export const RekeyInfoRecord = Record({
  rekeyParticipants: List(),
  youCanRekey: false,
})

export type RekeyInfo = Record<{
  rekeyParticipants: Participants,
  youCanRekey: boolean,
}>

export const StateRecord = Record({
  inbox: List(),
  conversationStates: Map(),
  focused: false,
  metaData: Map(),
  finalizedState: Map(),
  supersedesState: Map(),
  supersededByState: Map(),
  pendingFailures: Map(),
  conversationUnreadCounts: Map(),
  rekeyInfos: Map(),
  alwaysShow: Set(),
  pendingConversations: Map(),
  nowOverride: null,
  editingMessage: null,
  initialConversation: null,
})

export type State = Record<{
  inbox: List<InboxState>,
  conversationStates: Map<ConversationIDKey, ConversationState>,
  finalizedState: FinalizedState,
  supersedesState: SupersedesState,
  supersededByState: SupersededByState,
  focused: boolean,
  metaData: MetaDataMap,
  pendingFailures: Map<OutboxIDKey, ?string>,
  conversationUnreadCounts: Map<ConversationIDKey, number>,
  rekeyInfos: Map<ConversationIDKey, RekeyInfo>,
  alwaysShow: Set<ConversationIDKey>,
  pendingConversations: Map<ConversationIDKey, Participants>,
  nowOverride: ?Date,
  editingMessage: ?Message,
  initialConversation: ?ConversationIDKey,
}>

export const maxAttachmentPreviewSize = 320

export const howLongBetweenTimestampsMs = 1000 * 60 * 15
export const maxMessagesToLoadAtATime = 50

export const nothingSelected = 'chat:noneSelected'

export type AddPendingConversation = NoErrorTypedAction<'chat:addPendingConversation', {participants: Array<string>}>
export type AppendMessages = NoErrorTypedAction<'chat:appendMessages', {conversationIDKey: ConversationIDKey, isSelected: boolean, messages: Array<Message>}>
export type BadgeAppForChat = NoErrorTypedAction<'chat:badgeAppForChat', List<ConversationBadgeState>>
export type BlockConversation = NoErrorTypedAction<'chat:blockConversation', {blocked: boolean, conversationIDKey: ConversationIDKey}>
export type ClearMessages = NoErrorTypedAction<'chat:clearMessages', {conversationIDKey: ConversationIDKey}>
export type ClearRekey = NoErrorTypedAction<'chat:clearRekey', {conversationIDKey: ConversationIDKey}>
export type CreatePendingFailure = NoErrorTypedAction<'chat:createPendingFailure', {failureDescription: string, outboxID: OutboxIDKey}>
export type DeleteMessage = NoErrorTypedAction<'chat:deleteMessage', {message: Message}>
export type EditMessage = NoErrorTypedAction<'chat:editMessage', {message: Message, text: HiddenString}>
export type GetInboxAndUnbox = NoErrorTypedAction<'chat:getInboxAndUnbox', {conversationIDKeys: Array<ConversationIDKey>}>
export type InboxStale = NoErrorTypedAction<'chat:inboxStale', void>
export type IncomingMessage = NoErrorTypedAction<'chat:incomingMessage', {activity: ChatActivity}>
export type LoadInbox = NoErrorTypedAction<'chat:loadInbox', {force: boolean}>
export type LoadMoreMessages = NoErrorTypedAction<'chat:loadMoreMessages', {conversationIDKey: ConversationIDKey, onlyIfUnloaded: boolean}>
export type LoadedInbox = NoErrorTypedAction<'chat:loadedInbox', {inbox: List<InboxState>}>
export type LoadingMessages = NoErrorTypedAction<'chat:loadingMessages', {conversationIDKey: ConversationIDKey, isRequesting: boolean}>
export type MarkThreadsStale = NoErrorTypedAction<'chat:markThreadsStale', {convIDs: Array<ConversationIDKey>}>
export type MuteConversation = NoErrorTypedAction<'chat:muteConversation', {conversationIDKey: ConversationIDKey, muted: boolean}>
export type NewChat = NoErrorTypedAction<'chat:newChat', {existingParticipants: Array<string>}>
export type OpenAttachmentPopup = NoErrorTypedAction<'chat:openAttachmentPopup', {message: AttachmentMessage, currentPath: Path}>
export type OpenConversation = NoErrorTypedAction<'chat:openConversation', {conversationIDKey: ConversationIDKey}>
export type OpenFolder = NoErrorTypedAction<'chat:openFolder', void>
export type OpenTlfInChat = NoErrorTypedAction<'chat:openTlfInChat', string>
export type PendingToRealConversation = NoErrorTypedAction<'chat:pendingToRealConversation', {oldKey: ConversationIDKey, newKey: ConversationIDKey}>
export type PostMessage = NoErrorTypedAction<'chat:postMessage', {conversationIDKey: ConversationIDKey, text: HiddenString}>
export type PrependMessages = NoErrorTypedAction<'chat:prependMessages', {conversationIDKey: ConversationIDKey, messages: Array<Message>, moreToLoad: boolean, paginationNext: ?Buffer}>
export type RemoveOutboxMessage = NoErrorTypedAction<'chat:removeOutboxMessage', {conversationIDKey: ConversationIDKey, outboxID: OutboxIDKey}>
export type RemovePendingFailure = NoErrorTypedAction<'chat:removePendingFailure', {outboxID: OutboxIDKey}>
export type ReplaceConversation = NoErrorTypedAction<'chat:replaceConversation', {oldKey: ConversationIDKey, newKey: ConversationIDKey}>
export type RetryMessage = NoErrorTypedAction<'chat:retryMessage', {conversationIDKey: ConversationIDKey, outboxIDKey: OutboxIDKey}>
export type SetInitialConversation = NoErrorTypedAction<'chat:setInitialConversation', {conversationIDKey: ?ConversationIDKey}>
export type SelectConversation = NoErrorTypedAction<'chat:selectConversation', {conversationIDKey: ?ConversationIDKey, fromUser: boolean}>
export type SetLoaded = NoErrorTypedAction<'chat:setLoaded', {conversationIDKey: ConversationIDKey, isLoaded: boolean}>
export type SetUnboxing = NoErrorTypedAction<'chat:setUnboxing', {conversationIDKeys: Array<ConversationIDKey>}>
export type SetupChatHandlers = NoErrorTypedAction<'chat:setupChatHandlers', void>
export type ShowEditor = NoErrorTypedAction<'chat:showEditor', {message: ?Message}>
export type StartConversation = NoErrorTypedAction<'chat:startConversation', {users: Array<string>, forceImmediate: boolean}>
export type UnboxInbox = NoErrorTypedAction<'chat:updateSupersededByState', {conversationIDKeys: Array<ConversationIDKey>}>
export type UntrustedInboxVisible = NoErrorTypedAction<'chat:untrustedInboxVisible', {conversationIDKey: ConversationIDKey, rowsVisible: number}>
export type UpdateBadging = NoErrorTypedAction<'chat:updateBadging', {conversationIDKey: ConversationIDKey}>
export type UpdateConversationUnreadCounts = NoErrorTypedAction<'chat:updateConversationUnreadCounts', {conversationUnreadCounts: Map<ConversationIDKey, number>}>
export type UpdateFinalizedState = NoErrorTypedAction<'chat:updateFinalizedState', {finalizedState: FinalizedState}>
export type UpdateInbox = NoErrorTypedAction<'chat:updateInbox', {conversation: InboxState}>
export type UpdateInboxComplete = NoErrorTypedAction<'chat:updateInboxComplete', void>
export type UpdateInboxRekeyOthers = NoErrorTypedAction<'chat:updateInboxRekeyOthers', {conversationIDKey: ConversationIDKey, rekeyers: Array<string>}>
export type UpdateInboxRekeySelf = NoErrorTypedAction<'chat:updateInboxRekeySelf', {conversationIDKey: ConversationIDKey}>
export type UpdateLatestMessage = NoErrorTypedAction<'chat:updateLatestMessage', {conversationIDKey: ConversationIDKey}>
export type UpdateMessage = NoErrorTypedAction<'chat:updateMessage', {conversationIDKey: ConversationIDKey, message: $Shape<AttachmentMessage> | $Shape<TextMessage>, messageID: MessageID}>
export type UpdateMetadata = NoErrorTypedAction<'chat:updateMetadata', {users: Array<string>}>
export type UpdatePaginationNext = NoErrorTypedAction<'chat:updatePaginationNext', {conversationIDKey: ConversationIDKey, paginationNext: Buffer}>
export type UpdateSupersededByState = NoErrorTypedAction<'chat:updateSupersededByState', {supersededByState: SupersededByState}>
export type UpdateSupersedesState = NoErrorTypedAction<'chat:updateSupersedesState', {supersedesState: SupersedesState}>
export type UpdatedMetadata = NoErrorTypedAction<'chat:updatedMetadata', {updated: {[key: string]: MetaData}}>

export type ThreadLoadedOffline = NoErrorTypedAction<'chat:threadLoadedOffline', {conversationIDKey: ConversationIDKey}>

export type SelectAttachment = NoErrorTypedAction<'chat:selectAttachment', {input: AttachmentInput}>
export type UpdateBrokenTracker = NoErrorTypedAction<'chat:updateBrokenTracker', {userToBroken: {[username: string]: boolean}}>
export type UploadProgress = NoErrorTypedAction<'chat:uploadProgress', {
  outboxID: OutboxIDKey,
  bytesComplete: number,
  bytesTotal: number,
  conversationIDKey: ConversationIDKey,
}>
export type DownloadProgress = NoErrorTypedAction<'chat:downloadProgress', {
  bytesComplete: number,
  bytesTotal: number,
  conversationIDKey: ConversationIDKey,
  isPreview: boolean,
  messageID: MessageID,
}>
export type LoadAttachment = NoErrorTypedAction<'chat:loadAttachment', {
  messageID: MessageID,
  conversationIDKey: ConversationIDKey,
  loadPreview: boolean,
  isHdPreview: boolean,
  filename: string,
}>
export type AttachmentLoaded = NoErrorTypedAction<'chat:attachmentLoaded', {
  messageID: MessageID,
  conversationIDKey: ConversationIDKey,
  isPreview: boolean,
  isHdPreview: boolean,
  path: string,
}>
export type UpdateTempMessage = TypedAction<'chat:updateTempMessage', {
  conversationIDKey: ConversationIDKey,
  outboxID: OutboxIDKey,
  message: $Shape<AttachmentMessage> | $Shape<TextMessage>,
}, {
  conversationIDKey: ConversationIDKey,
  outboxID: OutboxIDKey,
  error: Error,
}>

export type DeleteTempMessage = NoErrorTypedAction<'chat:deleteTempMessage', {
  conversationIDKey: ConversationIDKey,
  outboxID: OutboxIDKey,
}>

export type MarkSeenMessage = NoErrorTypedAction<'chat:markSeenMessage', {
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
}>

export type SaveAttachment = NoErrorTypedAction<'chat:saveAttachmentNative', {
  message: AttachmentMessage,
}>

export type ShareAttachment = NoErrorTypedAction<'chat:shareAttachment', {
  message: AttachmentMessage,
}>

export type Actions = AddPendingConversation
  | AppendMessages
  | ClearRekey
  | DeleteMessage
  | EditMessage
  | ShowEditor
  | LoadInbox
  | LoadMoreMessages
  | LoadedInbox
  | NewChat
  | OpenFolder
  | PendingToRealConversation
  | PrependMessages
  | SelectConversation
  | StartConversation
  | UpdateBadging
  | UpdateBrokenTracker
  | UpdateInbox
  | UpdateInboxComplete
  | UpdateLatestMessage
  | UpdateMetadata
  | UpdatedMetadata
  | UpdateTempMessage
  | MarkSeenMessage
  | AttachmentLoaded
  | UpdateFinalizedState
  | UpdateSupersedesState
  | UpdateSupersededByState

function conversationIDToKey (conversationID: ConversationID): ConversationIDKey {
  return conversationID.toString('hex')
}

function keyToConversationID (key: ConversationIDKey): ConversationID {
  return Buffer.from(key, 'hex')
}

function outboxIDToKey (outboxID: OutboxID): OutboxIDKey {
  return outboxID.toString('hex')
}

function keyToOutboxID (key: OutboxIDKey): OutboxID {
  return Buffer.from(key, 'hex')
}

function makeSnippet (messageBody: ?MessageBody): ?string {
  if (!messageBody) {
    return null
  }
  switch (messageBody.messageType) {
    case ChatTypes.CommonMessageType.text:
      return textSnippet(messageBody.text && messageBody.text.body, 100)
    case ChatTypes.CommonMessageType.attachment:
      return 'Attachment'
    default:
      return null
  }
}

// This is emoji aware hence all the weird ... stuff. See https://mathiasbynens.be/notes/javascript-unicode#iterating-over-symbols
function textSnippet (message: ?string = '', max: number) {
  // $FlowIssue flow doesn't understand spread + strings
  return [...(message.substring(0, max * 4).replace(/\s+/g, ' '))].slice(0, max).join('')
}

// Filters out myself from most of our views of the list, unless the list is just me
function participantFilter (participants: List<string>, you: string): List<string> {
  const withoutYou = participants.filter(p => p !== you)
  if (withoutYou.count() === 0) {
    return participants
  }
  return withoutYou
}

function serverMessageToMessageBody (message: ServerMessage): ?MessageBody {
  switch (message.type) {
    case 'Text':
      return {
        messageType: ChatTypes.CommonMessageType.text,
        text: {
          body: message.message.stringValue(),
        },
      }
    default:
      return null
  }
}

function usernamesToUserListItem (usernames: Array<string>, you: string, metaDataMap: MetaDataMap, followingMap: FollowingMap): Array<UserListItem> {
  return usernames.map(username => ({
    username,
    broken: metaDataMap.get(username, Map()).get('brokenTracker', false),
    you: username === you,
    following: !!followingMap[username],
  }))
}

function getBrokenUsers (participants: Array<string>, you: string, metaDataMap: MetaDataMap): Array<string> {
  return participants.filter(user => user !== you && metaDataMap.get(user, Map()).get('brokenTracker', false))
}

function clampAttachmentPreviewSize ({width, height}: AttachmentSize) {
  if (height > width) {
    return {
      height: clamp(height, maxAttachmentPreviewSize),
      width: clamp(height, maxAttachmentPreviewSize) * width / height,
    }
  } else {
    return {
      height: clamp(width, maxAttachmentPreviewSize) * height / width,
      width: clamp(width, maxAttachmentPreviewSize),
    }
  }
}

function parseMetadataPreviewSize (metadata: AssetMetadata): ?AttachmentSize {
  if (metadata.assetType === ChatTypes.LocalAssetMetadataType.image && metadata.image) {
    return clampAttachmentPreviewSize(metadata.image)
  } else if (metadata.assetType === ChatTypes.LocalAssetMetadataType.video && metadata.video) {
    return clampAttachmentPreviewSize(metadata.video)
  }
}

function pendingConversationIDKey (tlfName: string) {
  return `PendingConversation:${tlfName}`
}

function isPendingConversationIDKey (conversationIDKey: string) {
  return conversationIDKey.startsWith('PendingConversation:')
}

function pendingConversationIDKeyToTlfName (conversationIDKey: string) {
  if (isPendingConversationIDKey(conversationIDKey)) {
    return conversationIDKey.substring('PendingConversation:'.length)
  }

  return null
}

function convSupersedesInfo (conversationID: ConversationIDKey, chat: State): ?SupersedeInfo {
  return chat.get('supersedesState').get(conversationID)
}

function convSupersededByInfo (conversationID: ConversationIDKey, chat: State): ?SupersedeInfo {
  return chat.get('supersededByState').get(conversationID)
}

function newestConversationIDKey (conversationIDKey: ?ConversationIDKey, chat: State): ?ConversationIDKey {
  const supersededBy = chat.get('supersededByState').get(conversationIDKey)
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

function messageKey (kind: MessageKeyKind, value: string | number): MessageKey {
  return `${kind}:${value}`
}

const getYou = (state: TypedState) => state.config.username || ''
const getFollowingMap = (state: TypedState) => state.config.following
const getMetaDataMap = (state: TypedState) => state.chat.get('metaData')
const getSelectedInbox = (state: TypedState) => {
  const selected = getSelectedConversation(state)
  return state.chat.get('inbox').find(inbox => inbox.get('conversationIDKey') === selected)
}

const getTLF = createSelector(
  [getSelectedInbox, getSelectedConversation],
  (selectedInbox, selected) => {
    if (isPendingConversationIDKey(selected)) {
      return pendingConversationIDKeyToTlfName(selected) || ''
    } else if (selected !== nothingSelected && selectedInbox) {
      return selectedInbox.participants.join(',')
    }
    return ''
  }
)

const getMuted = createSelector(
  [getSelectedInbox],
  (selectedInbox) => selectedInbox && selectedInbox.get('status') === 'muted',
)

export {
  getBrokenUsers,
  getSelectedConversation,
  conversationIDToKey,
  convSupersedesInfo,
  convSupersededByInfo,
  keyToConversationID,
  keyToOutboxID,
  makeSnippet,
  messageKey,
  outboxIDToKey,
  participantFilter,
  serverMessageToMessageBody,
  usernamesToUserListItem,
  clampAttachmentPreviewSize,
  newestConversationIDKey,
  parseMetadataPreviewSize,
  pendingConversationIDKey,
  isPendingConversationIDKey,
  pendingConversationIDKeyToTlfName,
  getSelectedRouteState,
  getYou,
  getFollowingMap,
  getMetaDataMap,
  getSelectedInbox,
  getTLF,
  getMuted,
}
