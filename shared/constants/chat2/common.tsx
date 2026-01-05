import * as T from '../types'
import {isMobile, isTablet} from '../platform'
import * as Router2 from '../router2'
import {storeRegistry} from '../store-registry'

export const explodingModeGregorKeyPrefix = 'exploding:'

export const getSelectedConversation = (allowUnderModal: boolean = false): T.Chat.ConversationIDKey => {
  const maybeVisibleScreen = Router2.getVisibleScreen(undefined, allowUnderModal)
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

  // This function is synchronous but needs async store access
  // For now, we'll need to make this async or refactor
  // TODO: Make this function async or refactor to avoid synchronous store access
  // For now, return a default value and handle async loading separately
  return (
    false && // app focused?
    false && // actually interacting w/ the app
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
