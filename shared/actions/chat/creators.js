// @flow
import * as Constants from '../../constants/chat'
import HiddenString from '../../util/hidden-string'
import {uniq} from 'lodash'
import {List} from 'immutable'

import type {AddPendingConversation, AttachmentInput, BadgeAppForChat, BlockConversation, ConversationBadgeState, ConversationIDKey, DeleteMessage, EditMessage, InboxState, LoadInbox, LoadMoreMessages, LoadedInbox, Message, MuteConversation, NewChat, OpenFolder, OpenTlfInChat, PendingToRealConversation, PostMessage, ReplaceConversation, RetryMessage, SelectConversation, SetupChatHandlers, ShowEditor, StartConversation, UpdateBadging, UpdateLatestMessage} from '../../constants/chat'

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

function loadedInbox (conversations: List<InboxState>): LoadedInbox {
  return {logTransformer: loadedInboxActionTransformer, payload: {inbox: conversations}, type: 'chat:loadedInbox'}
}

function pendingToRealConversation (oldKey: ConversationIDKey, newKey: ConversationIDKey): PendingToRealConversation {
  return {payload: {newKey, oldKey}, type: 'chat:pendingToRealConversation'}
}

function replaceConversation (oldKey: ConversationIDKey, newKey: ConversationIDKey): ReplaceConversation {
  return {payload: {newKey, oldKey}, type: 'chat:replaceConversation'}
}

function updateBadging (conversationIDKey: ConversationIDKey): UpdateBadging {
  return {payload: {conversationIDKey}, type: 'chat:updateBadging'}
}

function updateLatestMessage (conversationIDKey: ConversationIDKey): UpdateLatestMessage {
  return {payload: {conversationIDKey}, type: 'chat:updateLatestMessage'}
}

function badgeAppForChat (conversations: List<ConversationBadgeState>): BadgeAppForChat {
  return {payload: conversations, type: 'chat:badgeAppForChat'}
}

function openFolder (): OpenFolder {
  return {payload: undefined, type: 'chat:openFolder'}
}

function openTlfInChat (tlf: string): OpenTlfInChat {
  return {payload: tlf, type: 'chat:openTlfInChat'}
}

function startConversation (users: Array<string>, forceImmediate?: boolean = false): StartConversation {
  return {payload: {forceImmediate, users: uniq(users)}, type: 'chat:startConversation'}
}

function newChat (existingParticipants: Array<string>): NewChat {
  return {payload: {existingParticipants}, type: 'chat:newChat'}
}

function postMessage (conversationIDKey: ConversationIDKey, text: HiddenString): PostMessage {
  return {logTransformer: postMessageActionTransformer, payload: {conversationIDKey, text}, type: 'chat:postMessage'}
}

function setupChatHandlers (): SetupChatHandlers {
  return {payload: undefined, type: 'chat:setupChatHandlers'}
}

function retryMessage (conversationIDKey: ConversationIDKey, outboxIDKey: string): RetryMessage {
  return {logTransformer: retryMessageActionTransformer, payload: {conversationIDKey, outboxIDKey}, type: 'chat:retryMessage'}
}

function loadInbox (force?: boolean = false): LoadInbox {
  return {payload: {force}, type: 'chat:loadInbox'}
}

function loadMoreMessages (conversationIDKey: ConversationIDKey, onlyIfUnloaded: boolean): LoadMoreMessages {
  return {payload: {conversationIDKey, onlyIfUnloaded}, type: 'chat:loadMoreMessages'}
}

function showEditor (message: Message): ShowEditor {
  return {payload: {message}, type: 'chat:showEditor'}
}

function editMessage (message: Message, text: HiddenString): EditMessage {
  return {payload: {message, text}, type: 'chat:editMessage'}
}

function muteConversation (conversationIDKey: ConversationIDKey, muted: boolean): MuteConversation {
  return {payload: {conversationIDKey, muted}, type: 'chat:muteConversation'}
}

function blockConversation (blocked: boolean, conversationIDKey: ConversationIDKey): BlockConversation {
  return {payload: {blocked, conversationIDKey}, type: 'chat:blockConversation'}
}

function deleteMessage (message: Message): DeleteMessage {
  return {payload: {message}, type: 'chat:deleteMessage'}
}

function addPending (participants: Array<string>): AddPendingConversation {
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

function selectAttachment (input: AttachmentInput): Constants.SelectAttachment {
  return {payload: {input}, type: 'chat:selectAttachment'}
}

function loadAttachment (conversationIDKey: ConversationIDKey, messageID: Constants.MessageID, loadPreview: boolean, isHdPreview: boolean, filename: string): Constants.LoadAttachment {
  return {payload: {conversationIDKey, filename, isHdPreview, loadPreview, messageID}, type: 'chat:loadAttachment'}
}

// Select conversation, fromUser indicates it was triggered by a user and not programatically
function selectConversation (conversationIDKey: ?ConversationIDKey, fromUser: boolean): SelectConversation {
  return {payload: {conversationIDKey, fromUser}, type: 'chat:selectConversation'}
}

function updateTempMessage (conversationIDKey: ConversationIDKey, message: $Shape<Constants.AttachmentMessage> | $Shape<Constants.TextMessage>, outboxID: Constants.OutboxIDKey): Constants.UpdateTempMessage {
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
