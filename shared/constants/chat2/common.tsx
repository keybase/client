import * as C from '..'
import * as T from '../types'
import {isMobile, isTablet} from '../platform'
import * as Router2 from '../router2'
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
export const waitingKeyPushLoad = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:pushLoad:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyThreadLoad = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:loadingThread:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyAddUsersToChannel = 'chat:addUsersToConversation'
export const waitingKeyAddUserToChannel = (username: string, conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:addUserToConversation:${username}:${conversationIDKey}`
export const waitingKeyConvStatusChange = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:convStatusChange:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyUnpin = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:unpin:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyMutualTeams = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:mutualTeams:${conversationIDKeyToString(conversationIDKey)}`

export const explodingModeGregorKeyPrefix = 'exploding:'

export const loadThreadMessageTypes = C.enumKeys(T.RPCChat.MessageType).reduce<Array<T.RPCChat.MessageType>>(
  (arr, key) => {
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
          const val = T.RPCChat.MessageType[key]
          if (typeof val === 'number') {
            arr.push(val)
          }
        }
        break
    }

    return arr
  },
  []
)

export const reasonToRPCReason = (reason: string): T.RPCChat.GetThreadReason => {
  switch (reason) {
    case 'extension':
    case 'push':
      return T.RPCChat.GetThreadReason.push
    case 'foregrounding':
      return T.RPCChat.GetThreadReason.foreground
    default:
      return T.RPCChat.GetThreadReason.general
  }
}

export const getSelectedConversation = (): T.Chat.ConversationIDKey => {
  const maybeVisibleScreen = Router2.getVisibleScreen()
  if (maybeVisibleScreen?.name === threadRouteName) {
    const mParams = maybeVisibleScreen.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
    return mParams?.conversationIDKey ?? T.Chat.noConversationIDKey
  }
  return T.Chat.noConversationIDKey
}

// in split mode the root is the 'inbox'
export const isSplit = !isMobile || isTablet // Whether the inbox and conversation panels are visible side-by-side.
export const threadRouteName = isSplit ? 'chatRoot' : 'chatConversation'

export const isUserActivelyLookingAtThisThread = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const selectedConversationIDKey = getSelectedConversation()

  let chatThreadSelected = false
  if (!isSplit) {
    chatThreadSelected = true // conversationIDKey === selectedConversationIDKey is the only thing that matters in the new router
  } else {
    const maybeVisibleScreen = Router2.getVisibleScreen()
    chatThreadSelected =
      (maybeVisibleScreen === undefined ? undefined : maybeVisibleScreen.name) === threadRouteName
  }

  const {appFocused} = C.useConfigState.getState()
  const {active: userActive} = C.useActiveState.getState()

  return (
    appFocused && // app focused?
    userActive && // actually interacting w/ the app
    chatThreadSelected && // looking at the chat tab?
    conversationIDKey === selectedConversationIDKey // looking at the selected thread?
  )
}

export const allMessageTypes: Set<T.Chat.MessageType> = new Set([
  'attachment',
  'deleted',
  'requestPayment',
  'sendPayment',
  'setChannelname',
  'setDescription',
  'systemAddedToTeam',
  'systemChangeRetention',
  'systemGitPush',
  'systemInviteAccepted',
  'systemJoined',
  'systemLeft',
  'systemSBSResolved',
  'systemSimpleToComplex',
  'systemChangeAvatar',
  'systemNewChannel',
  'systemText',
  'systemUsersAddedToConversation',
  'text',
  'placeholder',
])

export const generateOutboxID = () =>
  Uint8Array.from([...Array<number>(8)], () => Math.floor(Math.random() * 256))

export const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')
