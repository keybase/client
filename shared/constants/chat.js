// @flow
import HiddenString from '../util/hidden-string'
import {Buffer} from 'buffer'
import {Set, List, Map, Record} from 'immutable'

import * as ChatTypes from './types/flow-types-chat'
import type {UserListItem} from '../common-adapters/usernames'
import type {NoErrorTypedAction, TypedAction} from './types/flux'
import type {AssetMetadata, ChatActivity, ConversationInfoLocal, MessageBody, MessageID as RPCMessageID, OutboxID as RPCOutboxID, ConversationID as RPCConversationID} from './types/flow-types-chat'
import type {DeviceType} from './types/more'

export type MessageType = 'Text'
export type FollowingMap = {[key: string]: boolean}

export type MessageState = 'pending' | 'failed' | 'sent'
export const messageStates: Array<MessageState> = ['pending', 'failed', 'sent']

export type AttachmentMessageState = MessageState | 'placeholder' | 'downloading-preview' | 'downloading' | 'uploading' | 'downloaded'
export type AttachmentType = 'Image' | 'Other'

export type ConversationID = RPCConversationID
export type ConversationIDKey = string

export type OutboxID = RPCOutboxID
export type OutboxIDKey = string

export type MessageID = RPCMessageID

export type ClientMessage = TimestampMessage
export type ServerMessage = TextMessage | ErrorMessage | AttachmentMessage | DeletedMessage | UnhandledMessage | EditingMessage | UpdatingAttachment | InvisibleErrorMessage

export type Message = ClientMessage | ServerMessage

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
  outboxID?: ?OutboxIDKey,
  senderDeviceRevokedAt: ?number,
  key: any,
  editedCount: number, // increase as we edit it
}

export type ErrorMessage = {
  type: 'Error',
  reason: string,
  timestamp?: number,
  conversationIDKey: ConversationIDKey,
  messageID?: MessageID,
  key: any,
}

export type InvisibleErrorMessage = {
  type: 'InvisibleError',
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
  key: any,
  data: any,
}

export type UnhandledMessage = {
  type: 'Unhandled',
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
  key: any,
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
  key: any,
}

export type TimestampMessage = {
  type: 'Timestamp',
  timestamp: number,
  key: any,
}

export type DeletedMessage = {
  type: 'Deleted',
  timestamp: number,
  key: any,
  messageID: MessageID,
  deletedIDs: Array<MessageID>,
}

export type EditingMessage = {
  type: 'Edit',
  key: any,
  message: HiddenString,
  messageID: MessageID,
  outboxID?: ?OutboxIDKey,
  targetMessageID: MessageID,
  timestamp: number,
}

export type UpdatingAttachment = {
  type: 'UpdateAttachment',
  key: any,
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

export type MaybeTimestamp = TimestampMessage | null

export const ConversationStateRecord = Record({
  messages: List(),
  seenMessages: Set(),
  moreToLoad: true,
  isLoaded: false,
  isRequesting: false,
  isStale: false,
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

export const InboxStateRecord = Record({
  info: null,
  isEmpty: false,
  youCreated: false,
  participants: List(),
  conversationIDKey: '',
  muted: false,
  time: 0,
  snippet: '',
  snippetKey: null,
  validated: false,
})

export type InboxState = Record<{
  info: ConversationInfoLocal,
  isEmpty: boolean,
  youCreated: boolean, // true if you made it this session
  participants: List<string>,
  conversationIDKey: ConversationIDKey,
  muted: boolean,
  time: number,
  snippet: string,
  snippetKey: any,
  validated: boolean,
}>

export type MetaData = Record<{
  fullname: string,
  brokenTracker: boolean,
}>

export type MetaDataMap = Map<string, MetaData>

export const MetaDataRecord = Record({
  fullname: 'Unknown',
  brokenTracker: false,
})

export const RekeyInfoRecord = Record({
  rekeyParticipants: List(),
  youCanRekey: false,
})

export type RekeyInfo = Record<{
  rekeyParticipants: List<string>,
  youCanRekey: boolean,
}>

export const StateRecord = Record({
  inbox: List(),
  conversationStates: Map(),
  focused: false,
  metaData: Map(),
  pendingFailures: Set(),
  conversationUnreadCounts: Map(),
  rekeyInfos: Map(),
})

export type State = Record<{
  inbox: List<InboxState>,
  conversationStates: Map<ConversationIDKey, ConversationState>,
  focused: boolean,
  metaData: MetaDataMap,
  pendingFailures: Set<OutboxIDKey>,
  conversationUnreadCounts: Map<ConversationIDKey, number>,
  rekeyInfos: Map<ConversationIDKey, RekeyInfo>,
}>

export const maxAttachmentPreviewSize = 320

export const howLongBetweenTimestampsMs = 1000 * 60 * 15
export const maxMessagesToLoadAtATime = 50

export const nothingSelected = 'chat:noneSelected'

export type AppendMessages = NoErrorTypedAction<'chat:appendMessages', {conversationIDKey: ConversationIDKey, isSelected: boolean, messages: Array<ServerMessage>}>
export type BadgeAppForChat = NoErrorTypedAction<'chat:badgeAppForChat', List<ConversationBadgeState>>
export type ClearMessages = NoErrorTypedAction<'chat:clearMessages', {conversationIDKey: ConversationIDKey}>
export type ConversationSetStatus = NoErrorTypedAction<'chat:conversationSetStatus', {conversationIDKey: ConversationIDKey, muted: boolean}>
export type CreatePendingFailure = NoErrorTypedAction<'chat:createPendingFailure', {outboxID: OutboxIDKey}>
export type DeleteMessage = NoErrorTypedAction<'chat:deleteMessage', {message: Message}>
export type EditMessage = NoErrorTypedAction<'chat:editMessage', {message: Message, text: HiddenString}>
export type InboxStale = NoErrorTypedAction<'chat:inboxStale', void>
export type IncomingMessage = NoErrorTypedAction<'chat:incomingMessage', {activity: ChatActivity}>
export type LoadInbox = NoErrorTypedAction<'chat:loadInbox', {newConversationIDKey: ?ConversationIDKey}>
export type LoadMoreMessages = NoErrorTypedAction<'chat:loadMoreMessages', {conversationIDKey: ConversationIDKey, onlyIfUnloaded: boolean}>
export type LoadedInbox = NoErrorTypedAction<'chat:loadedInbox', {inbox: List<InboxState>}>
export type LoadingMessages = NoErrorTypedAction<'chat:loadingMessages', {conversationIDKey: ConversationIDKey}>
export type UpdatePaginationNext = NoErrorTypedAction<'chat:updatePaginationNext', {conversationIDKey: ConversationIDKey, paginationNext: Buffer}>
export type MarkThreadsStale = NoErrorTypedAction<'chat:markThreadsStale', {convIDs: Array<ConversationIDKey>}>
export type MuteConversation = NoErrorTypedAction<'chat:muteConversation', {conversationIDKey: ConversationIDKey, muted: boolean}>
export type NewChat = NoErrorTypedAction<'chat:newChat', {existingParticipants: Array<string>}>
export type OpenAttachmentPopup = NoErrorTypedAction<'chat:openAttachmentPopup', {message: AttachmentMessage}>
export type OpenFolder = NoErrorTypedAction<'chat:openFolder', void>
export type OpenTlfInChat = NoErrorTypedAction<'chat:openTlfInChat', string>
export type PostMessage = NoErrorTypedAction<'chat:postMessage', {conversationIDKey: ConversationIDKey, text: HiddenString}>
export type PrependMessages = NoErrorTypedAction<'chat:prependMessages', {conversationIDKey: ConversationIDKey, messages: Array<ServerMessage>, moreToLoad: boolean, paginationNext: ?Buffer}>
export type RemoveOutboxMessage = NoErrorTypedAction<'chat:removeOutboxMessage', {conversationIDKey: ConversationIDKey, outboxID: OutboxIDKey}>
export type RemovePendingFailure = NoErrorTypedAction<'chat:removePendingFailure', {outboxID: OutboxIDKey}>
export type RetryMessage = NoErrorTypedAction<'chat:retryMessage', {conversationIDKey: ConversationIDKey, outboxIDKey: OutboxIDKey}>
export type SelectConversation = NoErrorTypedAction<'chat:selectConversation', {conversationIDKey: ?ConversationIDKey, fromUser: boolean}>
export type SetupChatHandlers = NoErrorTypedAction<'chat:setupChatHandlers', void>
export type StartConversation = NoErrorTypedAction<'chat:startConversation', {users: Array<string>}>
export type UpdateBadging = NoErrorTypedAction<'chat:updateBadging', {conversationIDKey: ConversationIDKey}>
export type UpdateConversationUnreadCounts = NoErrorTypedAction<'chat:updateConversationUnreadCounts', Map<ConversationIDKey, number>>
export type UpdateInbox = NoErrorTypedAction<'chat:updateInbox', {conversation: InboxState}>
export type UpdateInboxComplete = NoErrorTypedAction<'chat:updateInboxComplete', void>
export type UpdateInboxRekeyOthers = NoErrorTypedAction<'chat:updateInboxRekeyOthers', {conversationIDKey: ConversationIDKey, rekeyers: Array<string>}>
export type UpdateInboxRekeySelf = NoErrorTypedAction<'chat:updateInboxRekeySelf', {conversationIDKey: ConversationIDKey}>
export type UpdateLatestMessage = NoErrorTypedAction<'chat:updateLatestMessage', {conversationIDKey: ConversationIDKey}>
export type UpdateMessage = NoErrorTypedAction<'chat:updateMessage', {conversationIDKey: ConversationIDKey, message: $Shape<AttachmentMessage> | $Shape<TextMessage>, messageID: MessageID}>
export type UpdateMetadata = NoErrorTypedAction<'chat:updateMetadata', {users: Array<string>}>
export type UpdatedMetadata = NoErrorTypedAction<'chat:updatedMetadata', {[key: string]: MetaData}>

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

export type MarkSeenMessage = NoErrorTypedAction<'chat:markSeenMessage', {
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
}>

export type Actions = AppendMessages
  | DeleteMessage
  | EditMessage
  | LoadInbox
  | LoadMoreMessages
  | LoadedInbox
  | NewChat
  | OpenFolder
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
      null
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
  const maxSize = Math.max(width, height)
  return {
    width: maxAttachmentPreviewSize * (width / maxSize),
    height: maxAttachmentPreviewSize * (height / maxSize),
  }
}

function parseMetadataPreviewSize (metadata: AssetMetadata): ?AttachmentSize {
  if (metadata.assetType === ChatTypes.LocalAssetMetadataType.image && metadata.image) {
    return clampAttachmentPreviewSize(metadata.image)
  } else if (metadata.assetType === ChatTypes.LocalAssetMetadataType.video && metadata.video) {
    return clampAttachmentPreviewSize(metadata.video)
  }
}

export {
  getBrokenUsers,
  conversationIDToKey,
  keyToConversationID,
  keyToOutboxID,
  makeSnippet,
  outboxIDToKey,
  participantFilter,
  serverMessageToMessageBody,
  usernamesToUserListItem,
  clampAttachmentPreviewSize,
  parseMetadataPreviewSize,
}
