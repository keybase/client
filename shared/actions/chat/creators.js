// @flow
import * as Constants from '../../constants/chat'
import HiddenString from '../../util/hidden-string'
import {List} from 'immutable'
import {uniq} from 'lodash'

// Whitelisted action loggers
const updateTempMessageTransformer = ({type, payload: {conversationIDKey, outboxID}}: Constants.UpdateTempMessage) => ({
  payload: {
    conversationIDKey,
    outboxID,
  },
  type,
})

const loadedInboxActionTransformer = action => ({
  payload: {
    inbox: action.payload.inbox.map(i => {
      const {
        conversationIDKey,
        muted,
        time,
        validated,
        participants,
        info,
      } = i

      return {
        conversationIDKey,
        info: {
          status: info && info.status,
        },
        muted,
        participantsCount: participants.count(),
        time,
        validated,
      }
    }),
  },
  type: action.type,
})

const postMessageActionTransformer = action => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
  },
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

function loadAttachment (conversationIDKey: Constants.ConversationIDKey, messageID: Constants.MessageID, loadPreview: boolean, isHdPreview: boolean, filename: string): Constants.LoadAttachment {
  return {payload: {conversationIDKey, filename, isHdPreview, loadPreview, messageID}, type: 'chat:loadAttachment'}
}

// Select conversation, fromUser indicates it was triggered by a user and not programatically
function selectConversation (conversationIDKey: ?Constants.ConversationIDKey, fromUser: boolean): Constants.SelectConversation {
  return {payload: {conversationIDKey, fromUser}, type: 'chat:selectConversation'}
}

function updateTempMessage (conversationIDKey: Constants.ConversationIDKey, message: $Shape<Constants.AttachmentMessage> | $Shape<Constants.TextMessage>, outboxID: Constants.OutboxIDKey): Constants.UpdateTempMessage {
  return {
    logTransformer: updateTempMessageTransformer,
    payload: {
      conversationIDKey,
      message,
      outboxID,
    },
    type: 'chat:updateTempMessage',
  }
}

export {
  addPending,
  badgeAppForChat,
  blockConversation,
  deleteMessage,
  editMessage,
  loadAttachment,
  loadInbox,
  loadMoreMessages,
  loadedInbox,
  muteConversation,
  newChat,
  openFolder,
  openTlfInChat,
  pendingToRealConversation,
  postMessage,
  replaceConversation,
  retryAttachment,
  retryMessage,
  selectAttachment,
  selectConversation,
  setupChatHandlers,
  showEditor,
  startConversation,
  updateBadging,
  updateLatestMessage,
  updateTempMessage,
}
