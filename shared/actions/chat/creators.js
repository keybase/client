// @flow
import * as Constants from '../../constants/chat'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import HiddenString from '../../util/hidden-string'
import {List, Map} from 'immutable'
import {uniq} from 'lodash'

// Whitelisted action loggers
const updateTempMessageTransformer = ({type, payload: {conversationIDKey, outboxID}}: Constants.UpdateTempMessage) => ({
  payload: {conversationIDKey, outboxID},
  type,
})

const updateMessageTransformer = ({type, payload: {conversationIDKey, messageID}}: Constants.UpdateMessage) => ({
  payload: {conversationIDKey, messageID},
  type,
})

const loadedInboxActionTransformer = action => ({
  payload: {
    inbox: action.payload.inbox.map(i => {
      const {conversationIDKey, muted, time, validated, participants, info} = i

      return {
        conversationIDKey,
        info: {status: info && info.status},
        muted,
        participantsCount: participants.count(),
        time,
        validated,
      }
    }),
  },
  type: action.type,
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

function loadedInbox (conversations: List<Constants.InboxState>): Constants.LoadedInbox {
  return {logTransformer: loadedInboxActionTransformer, payload: {inbox: conversations}, type: 'chat:loadedInbox'}
}

function pendingToRealConversation (oldKey: Constants.ConversationIDKey, newKey: Constants.ConversationIDKey): Constants.PendingToRealConversation {
  return {payload: {newKey, oldKey}, type: 'chat:pendingToRealConversation'}
}

function replaceConversation (oldKey: Constants.ConversationIDKey, newKey: Constants.ConversationIDKey): Constants.ReplaceConversation {
  return {payload: {newKey, oldKey}, type: 'chat:replaceConversation'}
}

function updateBadging (conversationIDKey: Constants.ConversationIDKey): Constants.UpdateBadging {
  return {payload: {conversationIDKey}, type: 'chat:updateBadging'}
}

function updateLatestMessage (conversationIDKey: Constants.ConversationIDKey): Constants.UpdateLatestMessage {
  return {payload: {conversationIDKey}, type: 'chat:updateLatestMessage'}
}

function badgeAppForChat (conversations: List<Constants.ConversationBadgeState>): Constants.BadgeAppForChat {
  return {payload: conversations, type: 'chat:badgeAppForChat'}
}

function openFolder (): Constants.OpenFolder {
  return {payload: undefined, type: 'chat:openFolder'}
}

function openTlfInChat (tlf: string): Constants.OpenTlfInChat {
  return {payload: tlf, type: 'chat:openTlfInChat'}
}

function startConversation (users: Array<string>, forceImmediate?: boolean = false): Constants.StartConversation {
  return {payload: {forceImmediate, users: uniq(users)}, type: 'chat:startConversation'}
}

function newChat (existingParticipants: Array<string>): Constants.NewChat {
  return {payload: {existingParticipants}, type: 'chat:newChat'}
}

function postMessage (conversationIDKey: Constants.ConversationIDKey, text: HiddenString): Constants.PostMessage {
  return {logTransformer: postMessageActionTransformer, payload: {conversationIDKey, text}, type: 'chat:postMessage'}
}

function setupChatHandlers (): Constants.SetupChatHandlers {
  return {payload: undefined, type: 'chat:setupChatHandlers'}
}

function retryMessage (conversationIDKey: Constants.ConversationIDKey, outboxIDKey: string): Constants.RetryMessage {
  return {logTransformer: retryMessageActionTransformer, payload: {conversationIDKey, outboxIDKey}, type: 'chat:retryMessage'}
}

function loadInbox (force?: boolean = false): Constants.LoadInbox {
  return {payload: {force}, type: 'chat:loadInbox'}
}

function loadMoreMessages (conversationIDKey: Constants.ConversationIDKey, onlyIfUnloaded: boolean): Constants.LoadMoreMessages {
  return {payload: {conversationIDKey, onlyIfUnloaded}, type: 'chat:loadMoreMessages'}
}

function showEditor (message: Constants.Message): Constants.ShowEditor {
  return {payload: {message}, type: 'chat:showEditor'}
}

function editMessage (message: Constants.Message, text: HiddenString): Constants.EditMessage {
  return {payload: {message, text}, type: 'chat:editMessage'}
}

function muteConversation (conversationIDKey: Constants.ConversationIDKey, muted: boolean): Constants.MuteConversation {
  return {payload: {conversationIDKey, muted}, type: 'chat:muteConversation'}
}

function blockConversation (blocked: boolean, conversationIDKey: Constants.ConversationIDKey): Constants.BlockConversation {
  return {payload: {blocked, conversationIDKey}, type: 'chat:blockConversation'}
}

function deleteMessage (message: Constants.Message): Constants.DeleteMessage {
  return {payload: {message}, type: 'chat:deleteMessage'}
}

function addPending (participants: Array<string>): Constants.AddPendingConversation {
  return {payload: {participants}, type: 'chat:addPendingConversation'}
}

function updateFinalizedState (finalizedState: Constants.FinalizedState): Constants.UpdateFinalizedState {
  return {payload: {finalizedState}, type: 'chat:updateFinalizedState'}
}

function updateSupersedesState (supersedesState: Constants.SupersedesState): Constants.UpdateSupersedesState {
  return {payload: {supersedesState}, type: 'chat:updateSupersedesState'}
}

function updateSupersededByState (supersededByState: Constants.SupersededByState): Constants.UpdateSupersededByState {
  return {payload: {supersededByState}, type: 'chat:updateSupersededByState'}
}

function updateInbox (conversation: Constants.InboxState): Constants.UpdateInbox {
  return {payload: {conversation}, type: 'chat:updateInbox'}
}

function createPendingFailure (failureDescription: string, outboxID: Constants.OutboxIDKey): Constants.CreatePendingFailure {
  return {payload: {failureDescription, outboxID}, type: 'chat:createPendingFailure'}
}

function updatePaginationNext (conversationIDKey: Constants.ConversationIDKey, paginationNext: Buffer): Constants.UpdatePaginationNext {
  return {payload: {conversationIDKey, paginationNext}, type: 'chat:updatePaginationNext'}
}

function markSeenMessage (conversationIDKey: Constants.ConversationIDKey, messageID: Constants.MessageID): Constants.MarkSeenMessage {
  return {payload: {conversationIDKey, messageID}, type: 'chat:markSeenMessage'}
}

function appendMessages (conversationIDKey: Constants.ConversationIDKey, isSelected: boolean, messages: Array<Constants.Message>): Constants.AppendMessages {
  return {logTransformer: appendMessageActionTransformer, payload: {conversationIDKey, isSelected, messages}, type: 'chat:appendMessages'}
}

function getInboxAndUnbox (conversationIDKeys: Array<Constants.ConversationIDKey>): Constants.GetInboxAndUnbox {
  return {payload: {conversationIDKeys}, type: 'chat:getInboxAndUnbox'}
}

function clearMessages (conversationIDKey: Constants.ConversationIDKey): Constants.ClearMessages {
  return {payload: {conversationIDKey}, type: 'chat:clearMessages'}
}

function updateConversationUnreadCounts (conversationUnreadCounts: Map<Constants.ConversationIDKey, number>): Constants.UpdateConversationUnreadCounts {
  return {payload: {conversationUnreadCounts}, type: 'chat:updateConversationUnreadCounts'}
}

function updateMetadata (users: Array<string>): Constants.UpdateMetadata {
  return {payload: {users}, type: 'chat:updateMetadata'}
}

function updatedMetadata (updated: {[key: string]: Constants.MetaData}): Constants.UpdatedMetadata {
  return {payload: {updated}, type: 'chat:updatedMetadata'}
}

function setLoaded (conversationIDKey: Constants.ConversationIDKey, isLoaded: boolean): Constants.SetLoaded {
  return {payload: {conversationIDKey, isLoaded}, type: 'chat:setLoaded'}
}

function prependMessages (conversationIDKey: Constants.ConversationIDKey, messages: Array<Constants.Message>, moreToLoad: boolean, paginationNext: ?Buffer): Constants.PrependMessages {
  return {logTransformer: prependMessagesActionTransformer, payload: {conversationIDKey, messages, moreToLoad, paginationNext}, type: 'chat:prependMessages'}
}

function incomingMessage (activity: ChatTypes.ChatActivity): Constants.IncomingMessage {
  return {payload: {activity}, type: 'chat:incomingMessage'}
}

function updateBrokenTracker (userToBroken: {[username: string]: boolean}): Constants.UpdateBrokenTracker {
  return {payload: {userToBroken}, type: 'chat:updateBrokenTracker'}
}

function inboxStale (): Constants.InboxStale {
  return {payload: undefined, type: 'chat:inboxStale'}
}

function markThreadsStale (convIDs: Array<Constants.ConversationIDKey>): Constants.MarkThreadsStale {
  return {payload: {convIDs}, type: 'chat:markThreadsStale'}
}

function loadingMessages (conversationIDKey: Constants.ConversationIDKey, isRequesting: boolean): Constants.LoadingMessages {
  return {payload: {conversationIDKey, isRequesting}, type: 'chat:loadingMessages'}
}

function retryAttachment (message: Constants.AttachmentMessage): Constants.SelectAttachment {
  const {conversationIDKey, filename, title, previewType, outboxID} = message
  if (!filename || !title || !previewType) {
    throw new Error('attempted to retry attachment without filename')
  }
  const input = {
    conversationIDKey,
    filename,
    outboxID,
    title,
    type: previewType || 'Other',
  }
  return {payload: {input}, type: 'chat:selectAttachment'}
}

function selectAttachment (input: Constants.AttachmentInput): Constants.SelectAttachment {
  return {payload: {input}, type: 'chat:selectAttachment'}
}

function loadAttachment (conversationIDKey: Constants.ConversationIDKey, messageID: Constants.MessageID, filename: string, loadPreview: boolean, isHdPreview: boolean): Constants.LoadAttachment {
  return {payload: {conversationIDKey, filename, isHdPreview, loadPreview, messageID}, type: 'chat:loadAttachment'}
}

function attachmentLoaded (conversationIDKey: Constants.ConversationIDKey, messageID: Constants.MessageID, path: string, isPreview: boolean, isHdPreview: boolean): Constants.AttachmentLoaded {
  return {payload: {conversationIDKey, isHdPreview, isPreview, messageID, path}, type: 'chat:attachmentLoaded'}
}

function downloadProgress (conversationIDKey: Constants.ConversationIDKey, messageID: Constants.MessageID, isPreview: boolean, bytesComplete: number, bytesTotal: number): Constants.DownloadProgress {
  return {payload: {bytesComplete, bytesTotal, conversationIDKey, isPreview, messageID}, type: 'chat:downloadProgress'}
}

function uploadProgress (conversationIDKey: Constants.ConversationIDKey, messageID: Constants.MessageID, bytesComplete: number, bytesTotal: number): Constants.UploadProgress {
  return {payload: {bytesComplete, bytesTotal, conversationIDKey, messageID}, type: 'chat:uploadProgress'}
}

// Select conversation, fromUser indicates it was triggered by a user and not programatically
function selectConversation (conversationIDKey: ?Constants.ConversationIDKey, fromUser: boolean): Constants.SelectConversation {
  return {payload: {conversationIDKey, fromUser}, type: 'chat:selectConversation'}
}

function updateTempMessage (conversationIDKey: Constants.ConversationIDKey, message: $Shape<Constants.AttachmentMessage> | $Shape<Constants.TextMessage>, outboxID: Constants.OutboxIDKey): Constants.UpdateTempMessage {
  return {
    logTransformer: updateTempMessageTransformer,
    payload: {conversationIDKey, message, outboxID},
    type: 'chat:updateTempMessage',
  }
}

function untrustedInboxVisible (conversationIDKey: Constants.ConversationIDKey, rowsVisible: number): Constants.UntrustedInboxVisible {
  return {payload: {conversationIDKey, rowsVisible}, type: 'chat:untrustedInboxVisible'}
}

function setUnboxing (conversationIDKeys: Array<Constants.ConversationIDKey>): Constants.SetUnboxing {
  return {payload: {conversationIDKeys}, type: 'chat:setUnboxing'}
}

function clearRekey (conversationIDKey: Constants.ConversationIDKey): Constants.ClearRekey {
  return {payload: {conversationIDKey}, type: 'chat:clearRekey'}
}

function updateInboxRekeySelf (conversationIDKey: Constants.ConversationIDKey): Constants.UpdateInboxRekeySelf {
  return {payload: {conversationIDKey}, type: 'chat:updateInboxRekeySelf'}
}

function updateInboxRekeyOthers (conversationIDKey: Constants.ConversationIDKey, rekeyers: Array<string>): Constants.UpdateInboxRekeyOthers {
  return {payload: {conversationIDKey, rekeyers}, type: 'chat:updateInboxRekeyOthers'}
}

function updateInboxComplete (): Constants.UpdateInboxComplete {
  return {payload: undefined, type: 'chat:updateInboxComplete'}
}

function receivedMessage (message: Constants.Message): Constants.ReceivedMessage {
  return {payload: {message}, type: 'chat:receivedMessage'}
}

function removeOutboxMessage (conversationIDKey: Constants.ConversationIDKey, outboxID: Constants.OutboxIDKey): Constants.RemoveOutboxMessage {
  return {payload: {conversationIDKey, outboxID}, type: 'chat:removeOutboxMessage'}
}

function removePendingFailure (outboxID: Constants.OutboxIDKey): Constants.RemovePendingFailure {
  return {payload: {outboxID}, type: 'chat:removePendingFailure'}
}

function openConversation (conversationIDKey: Constants.ConversationIDKey): Constants.OpenConversation {
  return {payload: {conversationIDKey}, type: 'chat:openConversation'}
}

function openAttachmentPopup (message: Constants.AttachmentMessage): Constants.OpenAttachmentPopup {
  return {payload: {message}, type: 'chat:openAttachmentPopup'}
}

function threadLoadedOffline (conversationIDKey: Constants.ConversationIDKey): Constants.ThreadLoadedOffline {
  return {payload: {conversationIDKey}, type: 'chat:threadLoadedOffline'}
}

function updateMessage (conversationIDKey: Constants.ConversationIDKey, message: $Shape<Constants.AttachmentMessage> | $Shape<Constants.TextMessage>, messageID: Constants.MessageID): Constants.UpdateMessage {
  return {
    logTransformer: updateMessageTransformer,
    payload: {conversationIDKey, messageID, message},
    type: 'chat:updateMessage',
  }
}

export {
  addPending,
  appendMessages,
  attachmentLoaded,
  badgeAppForChat,
  blockConversation,
  clearMessages,
  clearRekey,
  createPendingFailure,
  deleteMessage,
  downloadProgress,
  editMessage,
  getInboxAndUnbox,
  inboxStale,
  incomingMessage,
  loadAttachment,
  loadInbox,
  loadMoreMessages,
  loadedInbox,
  loadingMessages,
  markSeenMessage,
  markThreadsStale,
  muteConversation,
  newChat,
  openAttachmentPopup,
  openConversation,
  openFolder,
  openTlfInChat,
  pendingToRealConversation,
  postMessage,
  prependMessages,
  receivedMessage,
  removeOutboxMessage,
  removePendingFailure,
  replaceConversation,
  retryAttachment,
  retryMessage,
  selectAttachment,
  selectConversation,
  setLoaded,
  setUnboxing,
  setupChatHandlers,
  showEditor,
  startConversation,
  untrustedInboxVisible,
  threadLoadedOffline,
  updateBadging,
  updateBrokenTracker,
  updateConversationUnreadCounts,
  updateFinalizedState,
  updateInbox,
  updateInboxComplete,
  updateInboxRekeyOthers,
  updateInboxRekeySelf,
  updateLatestMessage,
  updateMessage,
  updateMetadata,
  updatePaginationNext,
  updateSupersededByState,
  updateSupersedesState,
  updateTempMessage,
  updatedMetadata,
  uploadProgress,
}
