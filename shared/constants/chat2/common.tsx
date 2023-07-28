import * as RPCChatTypes from '../types/rpc-chat-gen'
import type * as Types from '../types/chat2'
import type {TypedState} from '../reducer'
import {conversationIDKeyToString} from '../types/chat2/common'

export const waitingKeyJoinConversation = 'chat:joinConversation'
export const waitingKeyLeaveConversation = 'chat:leaveConversation'
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
export const waitingKeyLoadingEmoji = 'chat:loadingEmoji'
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
export const waitingKeyMutualTeams = (conversationIDKey: Types.ConversationIDKey) =>
  `chat:mutualTeams:${conversationIDKeyToString(conversationIDKey)}`
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

const emptyOrdinals = new Array<Types.Ordinal>()
export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id) ?? emptyOrdinals
export const getMessageCenterOrdinal = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageCenterOrdinals.get(id)
export const getMessage = (state: TypedState, id: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
  state.chat2.messageMap.get(id)?.get(ordinal)

export const getReplyToMessageID = (
  ordinal: Types.Ordinal,
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey
) => {
  const maybeMessage = getMessage(state, conversationIDKey, ordinal)
  return ordinal
    ? maybeMessage === null || maybeMessage === undefined
      ? undefined
      : maybeMessage.id
    : undefined
}

export const getEditInfo = (state: TypedState, id: Types.ConversationIDKey) => {
  const ordinal = state.chat2.editingMap.get(id)
  if (!ordinal) {
    return
  }

  const message = getMessage(state, id, ordinal)
  if (!message) {
    return
  }
  switch (message.type) {
    case 'text':
      return {exploded: message.exploded, ordinal, text: message.text.stringValue()}
    case 'attachment':
      return {exploded: message.exploded, ordinal, text: message.title}
    default:
      return
  }
}
export const explodingModeGregorKeyPrefix = 'exploding:'

export const loadThreadMessageTypes = Object.keys(RPCChatTypes.MessageType).reduce<
  Array<RPCChatTypes.MessageType>
>((arr, key) => {
  switch (key) {
    case 'none':
    case 'edit': // daemon filters this out for us so we can ignore
    case 'delete':
    case 'attachmentuploaded':
    case 'reaction':
    case 'unfurl':
    case 'tlfname':
      break
    default:
      {
        const val = RPCChatTypes.MessageType[key as any]
        if (typeof val === 'number') {
          arr.push(val)
        }
      }
      break
  }

  return arr
}, [])

export const reasonToRPCReason = (reason: string): RPCChatTypes.GetThreadReason => {
  switch (reason) {
    case 'extension':
    case 'push':
      return RPCChatTypes.GetThreadReason.push
    case 'foregrounding':
      return RPCChatTypes.GetThreadReason.foreground
    default:
      return RPCChatTypes.GetThreadReason.general
  }
}
