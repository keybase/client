import * as Types from './types/push'
import * as RPCTypes from './types/rpc-gen'
import * as RPCChatTypes from './types/rpc-chat-gen'
import * as ChatTypes from './types/chat2'
import {isIOS} from './platform'
import {isDevApplePushToken} from '../local-debug'
import logger from '../logger'
import {pluralize} from '../util/string'

export const tokenType = isIOS ? (isDevApplePushToken ? 'appledev' : 'apple') : 'androidplay'
export const androidSenderID = '9603251415'
export const permissionsRequestingWaitingKey = 'push:permissionsRequesting'

const anyToConversationMembersType = (a: any): RPCChatTypes.ConversationMembersType | undefined => {
  const membersTypeNumber: number = typeof a === 'string' ? parseInt(a, 10) : a || -1
  switch (membersTypeNumber) {
    case RPCChatTypes.ConversationMembersType.kbfs:
      return RPCChatTypes.ConversationMembersType.kbfs
    case RPCChatTypes.ConversationMembersType.team:
      return RPCChatTypes.ConversationMembersType.team
    case RPCChatTypes.ConversationMembersType.impteamnative:
      return RPCChatTypes.ConversationMembersType.impteamnative
    case RPCChatTypes.ConversationMembersType.impteamupgrade:
      return RPCChatTypes.ConversationMembersType.impteamupgrade
    default:
      return undefined
  }
}

export const normalizePush = (n: any): Types.PushNotification | undefined => {
  try {
    if (!n) {
      return undefined
    }

    const userInteraction = !!n.userInteraction
    const data = isIOS ? n.data || n._data : n
    const message = n.message

    if (!data) {
      return undefined
    }

    if (data.type === 'chat.readmessage') {
      const badges = typeof data.b === 'string' ? parseInt(data.b) : data.b
      return {
        badges,
        type: 'chat.readmessage',
      }
    } else if (data.type === 'chat.newmessage' && data.convID) {
      return {
        conversationIDKey: ChatTypes.stringToConversationIDKey(data.convID),
        membersType: anyToConversationMembersType(data.t),
        type: 'chat.newmessage',
        unboxPayload: data.m || '',
        userInteraction,
      }
    } else if (data.type === 'chat.newmessageSilent_2' && data.c) {
      const membersType = anyToConversationMembersType(data.t)
      if (membersType) {
        return {
          conversationIDKey: ChatTypes.stringToConversationIDKey(data.c),
          membersType,
          type: 'chat.newmessageSilent_2',
          unboxPayload: data.m || '',
        }
      }
    } else if (data.type === 'follow' && data.username) {
      return {
        type: 'follow',
        userInteraction,
        username: data.username,
      }
    } else if (data.type === 'chat.extension' && data.convID) {
      return {
        conversationIDKey: ChatTypes.stringToConversationIDKey(data.convID),
        type: 'chat.extension',
      }
    } else if (typeof message === 'string' && message.startsWith('Your contact') && userInteraction) {
      return {
        type: 'settings.contacts',
      }
    }

    return undefined
  } catch (e) {
    logger.error('Error handling push', e)
    return undefined
  }
}

// When the notif is tapped we are only passed the message, use this as a marker
// so we can handle it correctly.
const contactNotifMarker = 'Your contact'
export const makeContactsResolvedMessage = (cts: Array<RPCTypes.ProcessedContact>) => {
  if (cts.length === 0) {
    return ''
  }
  switch (cts.length) {
    case 1:
      return `${contactNotifMarker} ${cts[0].contactName} joined Keybase!`
    case 2:
      return `${contactNotifMarker}s ${cts[0].contactName} and ${cts[1].contactName} joined Keybase!`
    default: {
      const lenMinusTwo = cts.length - 2
      return `${contactNotifMarker}s ${cts[0].contactName}, ${
        cts[1].contactName
      }, and ${lenMinusTwo} ${pluralize('other', lenMinusTwo)} joined Keybase!`
    }
  }
}
