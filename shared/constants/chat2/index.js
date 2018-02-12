// @flow
import * as I from 'immutable'
import * as Types from '../types/chat2'
import {chatTab} from '../tabs'
import type {TypedState} from '../reducer'
import {makeConversationMeta} from './meta'

// TEMP
if (__DEV__) {
  console.warn('DEBUG DUMP CHAT ENABLED-\n-\n-\n-\n-\n-\n-\n-\n-\n-\n-\n-\n-\n')
  window.DEBUGDumpChat = (c: string) => {
    console.log(
      'messageMap',
      window.DEBUGStore.getState()
        .chat2.messageMap.get(c)
        .toJS()
    )
    console.log(
      'messageOrdinals',
      window.DEBUGStore.getState()
        .chat2.messageOrdinals.get(c)
        .toJS()
    )
    console.log(
      'metaMap',
      window.DEBUGStore.getState()
        .chat2.metaMap.get(c)
        .toJS()
    )
  }
}
// TEMP

export const makeState: I.RecordFactory<Types._State> = I.Record({
  badgeMap: I.Map(),
  beforeSearchSelectedConversation: null,
  editingMap: I.Map(),
  inboxFilter: '',
  loadingMap: I.Map(),
  messageMap: I.Map(),
  messageOrdinals: I.Map(),
  metaMap: I.Map(),
  pendingConversationUsers: I.Set(),
  pendingMode: 'none',
  pendingOutboxToOrdinal: I.Map(),
  pendingSelected: false,
  selectedConversation: Types.stringToConversationIDKey(''),
  typingMap: I.Map(),
  unreadMap: I.Map(),
})

const emptyMeta = makeConversationMeta()
export const getMeta = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.metaMap.get(id, emptyMeta)
export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id, I.SortedSet())
export const getMessageMap = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageMap.get(id, I.Map())
export const getHasBadge = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.badgeMap.get(id, 0) > 0
export const getHasUnread = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.unreadMap.get(id, 0) > 0
export const getIsSelected = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.selectedConversation === id
export const getSelectedConversation = (state: TypedState) => state.chat2.selectedConversation
export const getEditingOrdinal = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.editingMap.get(id)
export const getTyping = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.typingMap.get(id, I.Set())
export const generateOutboxID = () => Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))
export const getExistingConversationWithUsers = (
  users: I.Set<string>,
  you: string,
  metaMap: I.Map<Types.ConversationIDKey, Types.ConversationMeta>
) => {
  const toFind = I.Set(users.concat([you]))
  return metaMap.findKey(meta => meta.participants.toSet().equals(toFind)) || ''
}
export const isUserActivelyLookingAtThisThread = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey
) => {
  const selectedConversationIDKey = getSelectedConversation(state)
  const appFocused = state.config.appFocused
  const chatTabSelected = state.routeTree.getIn(['routeState', 'selected']) === chatTab

  return (
    appFocused && // app focused?
    chatTabSelected && // looking at the chat tab?
    conversationIDKey === selectedConversationIDKey // looking at the selected thread?
  )
}

export {
  getConversationIDKeyMetasToLoad,
  getRowParticipants,
  getRowStyles,
  inboxUIItemToConversationMeta,
  makeConversationMeta,
  timestampToString,
  unverifiedInboxUIItemToConversationMeta,
  updateMeta,
} from './meta'

export {
  getClientPrev,
  isOldestOrdinal,
  isSpecialMention,
  makeMessageAttachment,
  makeMessageDeleted,
  makePendingAttachmentMessage,
  makePendingTextMessage,
  pathToAttachmentType,
  rpcErrorToString,
  uiMessageToMessage,
} from './message'
