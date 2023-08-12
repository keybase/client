import * as C from '..'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as ConfigConstants from '../config'
import {isMobile, isTablet} from '../platform'
import * as Router2 from '../router2'
import * as Types from '../types/chat2'
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

export const getSelectedConversation = (): Types.ConversationIDKey => {
  const maybeVisibleScreen = Router2.getVisibleScreen()
  if (maybeVisibleScreen?.name === threadRouteName) {
    // @ts-ignore TODO better types
    return maybeVisibleScreen.params?.conversationIDKey ?? Types.noConversationIDKey
  }
  return Types.noConversationIDKey
}

// in split mode the root is the 'inbox'
export const isSplit = !isMobile || isTablet // Whether the inbox and conversation panels are visible side-by-side.
export const threadRouteName = isSplit ? 'chatRoot' : 'chatConversation'

export const isUserActivelyLookingAtThisThread = (conversationIDKey: Types.ConversationIDKey) => {
  const selectedConversationIDKey = getSelectedConversation()

  let chatThreadSelected = false
  if (!isSplit) {
    chatThreadSelected = true // conversationIDKey === selectedConversationIDKey is the only thing that matters in the new router
  } else {
    const maybeVisibleScreen = Router2.getVisibleScreen()
    chatThreadSelected =
      (maybeVisibleScreen === null || maybeVisibleScreen === undefined
        ? undefined
        : maybeVisibleScreen.name) === threadRouteName
  }

  const {appFocused} = ConfigConstants.useConfigState.getState()
  const {active: userActive} = C.useActiveState.getState()

  return (
    appFocused && // app focused?
    userActive && // actually interacting w/ the app
    chatThreadSelected && // looking at the chat tab?
    conversationIDKey === selectedConversationIDKey // looking at the selected thread?
  )
}

export const allMessageTypes: Set<Types.MessageType> = new Set([
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

export const generateOutboxID = () => Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))

export const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')
