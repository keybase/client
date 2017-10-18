// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Constants from '../../constants/chat'
import HiddenString from '../../util/hidden-string'
import {List} from 'immutable'
import {chatTab} from '../../constants/tabs'
import {setRouteState} from '../route-tree'
import uniq from 'lodash/uniq'

import type {DeviceType} from '../../constants/types/more'
import type {Path} from '../../route-tree'
import type {SetRouteState} from '../../constants/route-tree'

// Whitelisted action loggers
const updateTempMessageTransformer = ({
  type,
  payload: {conversationIDKey, outboxID},
}: Constants.UpdateTempMessage) => ({
  payload: {conversationIDKey, outboxID},
  type,
})

const safeServerMessageMap = (m: any) => ({
  key: m.key,
  messageID: m.messageID,
  messageState: m.messageState,
  outboxID: m.outboxID,
  type: m.type,
})

const appendMessageActionTransformer = (action: Constants.AppendMessages) => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    messages: action.payload.messages.map(safeServerMessageMap),
    svcShouldDisplayNotification: action.payload.svcShouldDisplayNotification,
  },
  type: action.type,
})

const prependMessagesActionTransformer = (action: Constants.PrependMessages) => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    hasPaginationNext: !!action.payload.paginationNext,
    messages: action.payload.messages.map(safeServerMessageMap),
    moreToLoad: action.payload.moreToLoad,
  },
  type: action.type,
})

const postMessageActionTransformer = action => ({
  payload: {conversationIDKey: action.payload.conversationIDKey},
  type: action.type,
})

const retryMessageActionTransformer = action => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    outboxIDKey: action.payload.outboxIDKey,
  },
  type: action.type,
})

const attachmentLoadedTransformer = ({
  type,
  payload: {messageKey, isPreview},
}: Constants.AttachmentLoaded) => ({
  payload: {
    messageKey,
    isPreview,
  },
  type,
})

const downloadProgressTransformer = ({
  type,
  payload: {messageKey, isPreview, progress},
}: Constants.DownloadProgress) => ({
  payload: {
    messageKey,
    isPreview,
    progress: progress === 0 ? 'zero' : progress === 1 ? 'one' : 'partial',
  },
  type,
})

const loadAttachmentPreviewTransformer = ({
  type,
  payload: {messageKey},
}: Constants.LoadAttachmentPreview) => ({
  payload: {
    messageKey,
  },
  type,
})

function exitSearch(skipSelectPreviousConversation: boolean): Constants.ExitSearch {
  return {
    payload: {skipSelectPreviousConversation},
    type: 'chat:exitSearch',
  }
}

function pendingToRealConversation(
  oldKey: Constants.ConversationIDKey,
  newKey: Constants.ConversationIDKey
): Constants.PendingToRealConversation {
  return {payload: {newKey, oldKey}, type: 'chat:pendingToRealConversation'}
}

function updateBadging(conversationIDKey: Constants.ConversationIDKey): Constants.UpdateBadging {
  return {payload: {conversationIDKey}, type: 'chat:updateBadging'}
}

function updateLatestMessage(conversationIDKey: Constants.ConversationIDKey): Constants.UpdateLatestMessage {
  return {payload: {conversationIDKey}, type: 'chat:updateLatestMessage'}
}

function badgeAppForChat(conversations: ?Array<RPCTypes.BadgeConversationInfo>): Constants.BadgeAppForChat {
  const convos = List(
    (conversations || []).map(conversation => Constants.ConversationBadgeStateRecord(conversation))
  )
  return {payload: convos, type: 'chat:badgeAppForChat'}
}

function openFolder(): Constants.OpenFolder {
  return {payload: undefined, type: 'chat:openFolder'}
}

function openTlfInChat(tlf: string): Constants.OpenTlfInChat {
  return {payload: tlf, type: 'chat:openTlfInChat'}
}

function startConversation(
  users: Array<string>,
  forceImmediate?: boolean = false,
  temporary?: boolean = false
): Constants.StartConversation {
  return {
    payload: {forceImmediate, users: uniq(users), temporary},
    type: 'chat:startConversation',
  }
}

function newChat(): Constants.NewChat {
  return {payload: {}, type: 'chat:newChat'}
}

function postMessage(
  conversationIDKey: Constants.ConversationIDKey,
  text: HiddenString
): Constants.PostMessage {
  return {
    logTransformer: postMessageActionTransformer,
    payload: {conversationIDKey, text},
    type: 'chat:postMessage',
  }
}

function setupChatHandlers(): Constants.SetupChatHandlers {
  return {payload: undefined, type: 'chat:setupChatHandlers'}
}

function retryMessage(
  conversationIDKey: Constants.ConversationIDKey,
  outboxIDKey: string
): Constants.RetryMessage {
  return {
    logTransformer: retryMessageActionTransformer,
    payload: {conversationIDKey, outboxIDKey},
    type: 'chat:retryMessage',
  }
}

function loadInbox(): Constants.LoadInbox {
  return {payload: undefined, type: 'chat:loadInbox'}
}

function loadMoreMessages(
  conversationIDKey: Constants.ConversationIDKey,
  onlyIfUnloaded: boolean,
  fromUser?: boolean = false,
  onlyNewerThan?: string
): Constants.LoadMoreMessages {
  return {
    payload: {conversationIDKey, onlyIfUnloaded, fromUser, onlyNewerThan},
    type: 'chat:loadMoreMessages',
  }
}

function showEditor(message: ?Constants.Message): Constants.ShowEditor {
  return {payload: {message}, type: 'chat:showEditor'}
}

function editMessage(message: Constants.Message, text: HiddenString): Constants.EditMessage {
  return {payload: {message, text}, type: 'chat:editMessage'}
}

function leaveConversation(conversationIDKey: Constants.ConversationIDKey): Constants.LeaveConversation {
  return {
    payload: {conversationIDKey},
    type: 'chat:leaveConversation',
  }
}

function muteConversation(
  conversationIDKey: Constants.ConversationIDKey,
  muted: boolean
): Constants.MuteConversation {
  return {
    payload: {conversationIDKey, muted},
    type: 'chat:muteConversation',
  }
}

function blockConversation(
  blocked: boolean,
  conversationIDKey: Constants.ConversationIDKey,
  reportUser: boolean
): Constants.BlockConversation {
  return {
    payload: {blocked, conversationIDKey, reportUser},
    type: 'chat:blockConversation',
  }
}

function deleteMessage(message: Constants.Message): Constants.DeleteMessage {
  return {payload: {message}, type: 'chat:deleteMessage'}
}

function addPending(
  participants: Array<string>,
  temporary: boolean = false
): Constants.AddPendingConversation {
  return {
    payload: {participants, temporary},
    type: 'chat:addPendingConversation',
  }
}

function removeTempPendingConversations(): Constants.RemoveTempPendingConversations {
  return {payload: undefined, type: 'chat:removeTempPendingConversations'}
}

function updateFinalizedState(finalizedState: Constants.FinalizedState): Constants.UpdateFinalizedState {
  return {payload: {finalizedState}, type: 'chat:updateFinalizedState'}
}

function updateSupersedesState(supersedesState: Constants.SupersedesState): Constants.UpdateSupersedesState {
  return {payload: {supersedesState}, type: 'chat:updateSupersedesState'}
}

function updateSupersededByState(
  supersededByState: Constants.SupersededByState
): Constants.UpdateSupersededByState {
  return {
    payload: {supersededByState},
    type: 'chat:updateSupersededByState',
  }
}

function updatePaginationNext(
  conversationIDKey: Constants.ConversationIDKey,
  paginationNext: ?string,
  paginationPrevious: ?string
): Constants.UpdatePaginationNext {
  return {
    payload: {conversationIDKey, paginationNext, paginationPrevious},
    type: 'chat:updatePaginationNext',
  }
}

function markSeenMessage(
  conversationIDKey: Constants.ConversationIDKey,
  messageKey: Constants.MessageKey
): Constants.MarkSeenMessage {
  return {
    payload: {conversationIDKey, messageKey},
    type: 'chat:markSeenMessage',
  }
}

function appendMessages(
  conversationIDKey: Constants.ConversationIDKey,
  isSelected: boolean,
  isAppFocused: boolean,
  messages: Array<Constants.Message>,
  svcShouldDisplayNotification: boolean
): Constants.AppendMessages {
  return {
    logTransformer: appendMessageActionTransformer,
    payload: {
      conversationIDKey,
      isAppFocused,
      isSelected,
      messages,
      svcShouldDisplayNotification,
    },
    type: 'chat:appendMessages',
  }
}

function getInboxAndUnbox(
  conversationIDKeys: Array<Constants.ConversationIDKey>
): Constants.GetInboxAndUnbox {
  return {payload: {conversationIDKeys}, type: 'chat:getInboxAndUnbox'}
}

function clearMessages(conversationIDKey: Constants.ConversationIDKey): Constants.ClearMessages {
  return {payload: {conversationIDKey}, type: 'chat:clearMessages'}
}

function setNotifications(
  conversationIDKey: Constants.ConversationIDKey,
  deviceType: DeviceType,
  notifyType: Constants.NotifyType
) {
  return {payload: {conversationIDKey, deviceType, notifyType}, type: 'chat:setNotifications'}
}

function toggleChannelWideNotifications(
  conversationIDKey: Constants.ConversationIDKey
): Constants.ToggleChannelWideNotifications {
  return {payload: {conversationIDKey}, type: 'chat:toggleChannelWideNotifications'}
}

function updateMetadata(users: Array<string>): Constants.UpdateMetadata {
  return {payload: {users}, type: 'chat:updateMetadata'}
}

function updatedMetadata(updated: {[key: string]: Constants.MetaData}): Constants.UpdatedMetadata {
  return {payload: {updated}, type: 'chat:updatedMetadata'}
}

function setLoaded(conversationIDKey: Constants.ConversationIDKey, isLoaded: boolean): Constants.SetLoaded {
  return {payload: {conversationIDKey, isLoaded}, type: 'chat:setLoaded'}
}

function prependMessages(
  conversationIDKey: Constants.ConversationIDKey,
  messages: Array<Constants.Message>,
  moreToLoad: boolean,
  paginationNext: ?string,
  paginationPrevious: ?string
): Constants.PrependMessages {
  return {
    logTransformer: prependMessagesActionTransformer,
    payload: {conversationIDKey, messages, moreToLoad, paginationNext, paginationPrevious},
    type: 'chat:prependMessages',
  }
}

function incomingMessage(activity: ChatTypes.ChatActivity): Constants.IncomingMessage {
  return {payload: {activity}, type: 'chat:incomingMessage'}
}

function incomingTyping(activity: ChatTypes.TyperInfo): Constants.IncomingTyping {
  return {payload: {activity}, type: 'chat:incomingTyping'}
}

function updateTyping(
  conversationIDKey: Constants.ConversationIDKey,
  typing: boolean
): Constants.UpdateTyping {
  return {payload: {conversationIDKey, typing}, type: 'chat:updateTyping'}
}

function setTypers(conversationIDKey: Constants.ConversationIDKey, typing: Array<string>) {
  return {payload: {conversationIDKey, typing}, type: 'chat:setTypers'}
}

function updateBrokenTracker(userToBroken: {[username: string]: boolean}): Constants.UpdateBrokenTracker {
  return {payload: {userToBroken}, type: 'chat:updateBrokenTracker'}
}

function inboxStale(): Constants.InboxStale {
  return {payload: undefined, type: 'chat:inboxStale'}
}

function markThreadsStale(updates: Array<ChatTypes.ConversationStaleUpdate>): Constants.MarkThreadsStale {
  return {payload: {updates}, type: 'chat:markThreadsStale'}
}

function inboxSynced(convs: Array<ChatTypes.UnverifiedInboxUIItem>): Constants.InboxSynced {
  return {payload: {convs}, type: 'chat:inboxSynced'}
}

function loadingMessages(
  conversationIDKey: Constants.ConversationIDKey,
  isRequesting: boolean
): Constants.LoadingMessages {
  return {
    payload: {conversationIDKey, isRequesting},
    type: 'chat:loadingMessages',
  }
}

function retryAttachment(message: Constants.AttachmentMessage): Constants.RetryAttachment {
  const {conversationIDKey, uploadPath, title, previewType, outboxID} = message
  if (!uploadPath || !title || !previewType) {
    throw new Error('attempted to retry attachment without upload path')
  }
  if (!outboxID) {
    throw new Error('attempted to retry attachment without outboxID')
  }
  const input = {
    conversationIDKey,
    filename: uploadPath,
    title,
    type: previewType || 'Other',
  }
  return {
    payload: {input, oldOutboxID: outboxID},
    type: 'chat:retryAttachment',
  }
}

function selectAttachment(input: Constants.AttachmentInput): Constants.SelectAttachment {
  return {payload: {input}, type: 'chat:selectAttachment'}
}

function loadAttachment(messageKey: Constants.MessageKey, loadPreview: boolean): Constants.LoadAttachment {
  return {payload: {loadPreview, messageKey}, type: 'chat:loadAttachment'}
}

function loadAttachmentPreview(messageKey: Constants.MessageKey): Constants.LoadAttachmentPreview {
  return {
    logTransformer: loadAttachmentPreviewTransformer,
    payload: {messageKey},
    type: 'chat:loadAttachmentPreview',
  }
}

function saveAttachment(messageKey: Constants.MessageKey): Constants.SaveAttachment {
  return {payload: {messageKey}, type: 'chat:saveAttachment'}
}

function attachmentSaveStart(messageKey: Constants.MessageKey): Constants.AttachmentSaveStart {
  return {payload: {messageKey}, type: 'chat:attachmentSaveStart'}
}

function attachmentSaveFailed(messageKey: Constants.MessageKey): Constants.AttachmentSaveFailed {
  return {payload: {messageKey}, type: 'chat:attachmentSaveFailed'}
}

function attachmentLoaded(
  messageKey: Constants.MessageKey,
  path: ?string,
  isPreview: boolean
): Constants.AttachmentLoaded {
  return {
    logTransformer: attachmentLoadedTransformer,
    payload: {isPreview, messageKey, path},
    type: 'chat:attachmentLoaded',
  }
}

function attachmentSaved(messageKey: Constants.MessageKey, path: ?string): Constants.AttachmentSaved {
  return {payload: {messageKey, path}, type: 'chat:attachmentSaved'}
}

function downloadProgress(
  messageKey: Constants.MessageKey,
  isPreview: boolean,
  progress: ?number
): Constants.DownloadProgress {
  return {
    logTransformer: downloadProgressTransformer,
    payload: {isPreview, messageKey, progress},
    type: 'chat:downloadProgress',
  }
}

function uploadProgress(messageKey: Constants.MessageKey, progress: ?number): Constants.UploadProgress {
  return {payload: {progress, messageKey}, type: 'chat:uploadProgress'}
}

// Select conversation, fromUser indicates it was triggered by a user and not programatically
function selectConversation(
  conversationIDKey: ?Constants.ConversationIDKey,
  fromUser: boolean
): Constants.SelectConversation {
  return {
    payload: {conversationIDKey, fromUser},
    type: 'chat:selectConversation',
  }
}

function updateTempMessage(
  conversationIDKey: Constants.ConversationIDKey,
  message: $Shape<Constants.AttachmentMessage> | $Shape<Constants.TextMessage>,
  outboxID: Constants.OutboxIDKey
): Constants.UpdateTempMessage {
  return {
    logTransformer: updateTempMessageTransformer,
    payload: {conversationIDKey, message, outboxID},
    type: 'chat:updateTempMessage',
  }
}

function outboxMessageBecameReal(
  oldMessageKey: Constants.MessageKey,
  newMessageKey: Constants.MessageKey
): Constants.OutboxMessageBecameReal {
  return {
    payload: {oldMessageKey, newMessageKey},
    type: 'chat:outboxMessageBecameReal',
  }
}

function clearRekey(conversationIDKey: Constants.ConversationIDKey): Constants.ClearRekey {
  return {payload: {conversationIDKey}, type: 'chat:clearRekey'}
}

function updateInboxRekeySelf(
  conversationIDKey: Constants.ConversationIDKey
): Constants.UpdateInboxRekeySelf {
  return {payload: {conversationIDKey}, type: 'chat:updateInboxRekeySelf'}
}

function updateInboxRekeyOthers(
  conversationIDKey: Constants.ConversationIDKey,
  rekeyers: Array<string>
): Constants.UpdateInboxRekeyOthers {
  return {
    payload: {conversationIDKey, rekeyers},
    type: 'chat:updateInboxRekeyOthers',
  }
}

function updateInboxComplete(): Constants.UpdateInboxComplete {
  return {payload: undefined, type: 'chat:updateInboxComplete'}
}

function removeOutboxMessage(
  conversationIDKey: Constants.ConversationIDKey,
  outboxID: Constants.OutboxIDKey
): Constants.RemoveOutboxMessage {
  return {
    payload: {conversationIDKey, outboxID},
    type: 'chat:removeOutboxMessage',
  }
}

function openConversation(conversationIDKey: Constants.ConversationIDKey): Constants.OpenConversation {
  return {payload: {conversationIDKey}, type: 'chat:openConversation'}
}

function openAttachmentPopup(
  message: Constants.AttachmentMessage,
  currentPath: Path
): Constants.OpenAttachmentPopup {
  return {payload: {message, currentPath}, type: 'chat:openAttachmentPopup'}
}

function setPreviousConversation(
  conversationIDKey: ?Constants.ConversationIDKey
): Constants.SetPreviousConversation {
  return {
    payload: {conversationIDKey},
    type: 'chat:setPreviousConversation',
  }
}

function threadLoadedOffline(conversationIDKey: Constants.ConversationIDKey): Constants.ThreadLoadedOffline {
  return {payload: {conversationIDKey}, type: 'chat:threadLoadedOffline'}
}

function setSelectedRouteState(
  selectedConversation: Constants.ConversationIDKey,
  partialState: Object
): SetRouteState {
  return setRouteState(List([chatTab, selectedConversation]), partialState)
}

function setInboxFilter(filter: string): Constants.SetInboxFilter {
  return {payload: {filter}, type: 'chat:inboxFilter'}
}

function setInboxUntrustedState(
  inboxUntrustedState: Constants.UntrustedState
): Constants.SetInboxUntrustedState {
  return {payload: {inboxUntrustedState}, type: 'chat:inboxUntrustedState'}
}

function updateThread(
  thread: ChatTypes.UIMessages,
  yourName: string,
  yourDeviceName: string,
  conversationIDKey: string,
  append: boolean
): Constants.UpdateThread {
  return {
    payload: {thread, yourName, yourDeviceName, conversationIDKey, append},
    type: 'chat:updateThread',
  }
}

function updatedNotifications(
  conversationIDKey: Constants.ConversationIDKey,
  notifications: Constants.NotificationsState
): Constants.UpdatedNotifications {
  return {
    payload: {conversationIDKey, notifications},
    type: 'chat:updatedNotifications',
  }
}

function updateSnippet(
  conversationIDKey: Constants.ConversationIDKey,
  snippet: HiddenString
): Constants.UpdateSnippet {
  return {payload: {conversationIDKey, snippet}, type: 'chat:updateSnippet'}
}

function unboxConversations(
  conversationIDKeys: Array<Constants.ConversationIDKey>,
  force?: boolean = false,
  forInboxSync?: boolean = false
): Constants.UnboxConversations {
  return {payload: {conversationIDKeys, force, forInboxSync}, type: 'chat:unboxConversations'}
}

function unboxMore(): Constants.UnboxMore {
  return {type: 'chat:unboxMore', payload: undefined}
}

function selectNext(rows: Array<any>, direction: -1 | 1): Constants.InboxFilterSelectNext {
  return {type: 'chat:inboxFilterSelectNext', payload: {rows, direction}}
}

export {
  addPending,
  appendMessages,
  attachmentLoaded,
  attachmentSaveFailed,
  attachmentSaveStart,
  attachmentSaved,
  badgeAppForChat,
  blockConversation,
  clearMessages,
  clearRekey,
  deleteMessage,
  downloadProgress,
  editMessage,
  exitSearch,
  getInboxAndUnbox,
  inboxStale,
  inboxSynced,
  incomingMessage,
  incomingTyping,
  leaveConversation,
  loadAttachment,
  loadAttachmentPreview,
  loadInbox,
  loadMoreMessages,
  loadingMessages,
  markSeenMessage,
  markThreadsStale,
  muteConversation,
  newChat,
  openAttachmentPopup,
  openConversation,
  openFolder,
  openTlfInChat,
  outboxMessageBecameReal,
  pendingToRealConversation,
  postMessage,
  prependMessages,
  removeOutboxMessage,
  removeTempPendingConversations,
  retryAttachment,
  retryMessage,
  saveAttachment,
  selectAttachment,
  selectNext,
  selectConversation,
  setInboxFilter,
  setInboxUntrustedState,
  setLoaded,
  setNotifications,
  setPreviousConversation,
  setSelectedRouteState,
  setTypers,
  setupChatHandlers,
  showEditor,
  startConversation,
  threadLoadedOffline,
  toggleChannelWideNotifications,
  unboxConversations,
  unboxMore,
  updateBadging,
  updateBrokenTracker,
  updateFinalizedState,
  updateInboxComplete,
  updateInboxRekeyOthers,
  updateInboxRekeySelf,
  updateLatestMessage,
  updateMetadata,
  updatePaginationNext,
  updateSnippet,
  updateSupersededByState,
  updateSupersedesState,
  updateTempMessage,
  updateThread,
  updateTyping,
  updatedMetadata,
  updatedNotifications,
  uploadProgress,
}
