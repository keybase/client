import * as T from '../types'
import {isMobile, isTablet} from '../platform'
import {getVisibleScreen} from '@/constants/router2'
import {useConfigState} from '@/stores/config'

export const explodingModeGregorKeyPrefix = 'exploding:'

export const getSelectedConversation = (allowUnderModal: boolean = false): T.Chat.ConversationIDKey => {
  const maybeVisibleScreen = getVisibleScreen(undefined, allowUnderModal)
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
    const maybeVisibleScreen = getVisibleScreen()
    chatThreadSelected =
      (maybeVisibleScreen === undefined ? undefined : maybeVisibleScreen.name) === threadRouteName
  }

  const {appFocused, active: userActive} = useConfigState.getState()

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
