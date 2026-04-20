import * as T from '../types'
import {getVisibleScreen} from '@/constants/router'
import {useShellState} from '@/stores/shell'
import {isSplit, threadRouteName} from './layout'

export const explodingModeGregorKeyPrefix = 'exploding:'

export const getSelectedConversation = (allowUnderModal: boolean = false): T.Chat.ConversationIDKey => {
  const maybeVisibleScreen = getVisibleScreen(undefined, allowUnderModal)
  if (maybeVisibleScreen?.name === threadRouteName) {
    const mParams = maybeVisibleScreen.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
    return mParams?.conversationIDKey ?? T.Chat.noConversationIDKey
  }
  return T.Chat.noConversationIDKey
}

export {isSplit, threadRouteName} from './layout'

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

  const {appFocused, active: userActive} = useShellState.getState()

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

export const uiParticipantsToParticipantInfo = (
  uiParticipants: ReadonlyArray<T.RPCChat.UIParticipant>
): T.Chat.ParticipantInfo => {
  const participantInfo = {all: new Array<string>(), contactName: new Map(), name: new Array<string>()}
  uiParticipants.forEach(part => {
    const {assertion, contactName, inConvName} = part
    participantInfo.all.push(assertion)
    if (inConvName) {
      participantInfo.name.push(assertion)
    }
    if (contactName) {
      participantInfo.contactName.set(assertion, contactName)
    }
  })
  return participantInfo
}
